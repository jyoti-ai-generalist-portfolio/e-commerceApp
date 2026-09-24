

--- Added column to orders table to store the Razorpay order ID for payment verification
alter table public.orders
  add column razorpay_order_id text;

-- Speeds up the lookup in /api/v1/payments/verify
create index if not exists orders_razorpay_order_id_idx
  on public.orders (razorpay_order_id);

-- ============================================================================
-- Migration: payment_records table + atomic payment/order-finalization logic
-- For: UC-05 (Cart Checkout) & UC-09 (Payment Process / Razorpay)
-- Run this in the Supabase SQL editor, or via `supabase db push` /
-- your existing migrations pipeline. Safe to re-run (uses IF NOT EXISTS /
-- CREATE OR REPLACE where possible).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. payment_records table
--    A single order can have MULTIPLE payment_records rows (partial payments).
--    Payment is "complete" when sum(amount) for an order_id equals
--    orders.total_amount for that order_id. This rule is enforced centrally
--    inside submit_payment_and_finalize() below, not re-implemented per route.
-- ----------------------------------------------------------------------------
create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on update cascade on delete cascade,
  amount numeric not null check (amount > 0),
  utr_number text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists payment_records_order_id_idx on public.payment_records (order_id);

alter table public.payment_records enable row level security;

drop policy if exists "Users can view own payment records" on public.payment_records;
create policy "Users can view own payment records"
  on public.payment_records
  for select
  to public
  using (
    exists (
      select 1 from public.orders o
      where o.id = payment_records.order_id
        and o.customer_id = auth.uid()
    )
  );
-- No INSERT/UPDATE/DELETE policy is granted to the `public`/anon role on
-- purpose: all writes to payment_records happen exclusively through the
-- submit_payment_and_finalize() function below, called with the
-- service-role key from trusted server code (verify-payment route and the
-- Razorpay webhook). This keeps money-affecting writes off the client.


-- ----------------------------------------------------------------------------
-- 2. submit_payment_and_finalize(p_order_id, p_amount, p_utr_number)
--
--    ONE atomic entry point for every rupee that comes back from Razorpay,
--    called from BOTH verify-payment (client-initiated) and the Razorpay
--    webhook (async/server-initiated). Both paths funnel through here so
--    a client verify call racing the webhook for the same order can't
--    double-finalize or double-deduct stock.
--
--    Steps:
--      1. Lock the orders row (FOR UPDATE) — this is what makes the whole
--         operation atomic across concurrent callers for the same order.
--      2. Idempotency: if this exact utr_number was already recorded,
--         return the current state without inserting again (handles
--         webhook + client verify both reporting the same payment).
--      3. If the order is already 'paid', return early (idempotent).
--      4. Insert the payment_records row.
--      5. Compare sum(payment_records.amount) against orders.total_amount.
--         - If sum < total: mark order 'partial_paid', return remaining.
--         - If sum >= total: attempt to finalize (see step 6).
--      6. Finalize: for every cart_item on this customer's cart, call the
--         existing adjust_product_stock() (security definer, raises if
--         stock would go below zero — this is what resolves the "two
--         customers buy the last unit" race condition: whichever
--         transaction's lock arrives first wins; the second one's stock
--         adjustment raises and finalize is aborted for that caller).
--         On success: copy cart_items -> order_items (price_at_purchase =
--         current products.price), delete the cart_items, set orders
--         status = 'paid'.
--         On stock failure: the money has already been captured by
--         Razorpay, so we do NOT lose the payment_records row (that would
--         make the money unaccounted for). Instead we set orders.status =
--         'payment_failed_stock' and return that status so the caller can
--         surface "you'll be refunded" messaging and hand off to the
--         refund flow — see the "Refunds & Cancellations" edge case.
--
--    Returns jsonb:
--      { status, order_status, paid_amount, total_amount, remaining_amount }
--    status is one of: 'partial', 'paid', 'already_paid', 'stock_conflict'
-- ----------------------------------------------------------------------------
create or replace function public.submit_payment_and_finalize(
  p_order_id uuid,
  p_amount numeric,
  p_utr_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order        orders%rowtype;
  v_paid_amount  numeric;
  v_cart_id      uuid;
  v_item         record;
  v_existing_id  uuid;
begin
  -- Idempotency guard: same Razorpay payment reported twice (webhook +
  -- client, or a webhook retry) should not double count.
  select id into v_existing_id from payment_records where utr_number = p_utr_number;

  -- Lock the order row for the duration of this transaction.
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'P0002';
  end if;

  if v_order.status = 'paid' then
    return jsonb_build_object(
      'status', 'already_paid',
      'order_status', v_order.status,
      'paid_amount', v_order.total_amount,
      'total_amount', v_order.total_amount,
      'remaining_amount', 0
    );
  end if;

  if v_existing_id is null then
    insert into payment_records (order_id, amount, utr_number)
    values (p_order_id, p_amount, p_utr_number);
  end if;

  select coalesce(sum(amount), 0) into v_paid_amount
  from payment_records where order_id = p_order_id;

  if v_paid_amount < v_order.total_amount then
    update orders set status = 'partial_paid', updated_at = now() where id = p_order_id;
    return jsonb_build_object(
      'status', 'partial',
      'order_status', 'partial_paid',
      'paid_amount', v_paid_amount,
      'total_amount', v_order.total_amount,
      'remaining_amount', v_order.total_amount - v_paid_amount
    );
  end if;

  -- Fully paid (or overpaid) as of this call — attempt finalization.
  select id into v_cart_id from carts where profile_id = v_order.customer_id;

  begin
    for v_item in
      select ci.id as cart_item_id, ci.product_id, ci.quantity, p.price
      from cart_items ci
      join products p on p.id = ci.product_id
      where ci.cart_id = v_cart_id
    loop
      -- Raises if stock would go below zero; caught below.
      perform adjust_product_stock(v_item.product_id, -v_item.quantity, 'order:' || p_order_id);

      insert into order_items (order_id, product_id, quantity, price_at_purchase)
      values (p_order_id, v_item.product_id, v_item.quantity, v_item.price);
    end loop;

    delete from cart_items where cart_id = v_cart_id;

    update orders set status = 'paid', updated_at = now() where id = p_order_id;

    return jsonb_build_object(
      'status', 'paid',
      'order_status', 'paid',
      'paid_amount', v_paid_amount,
      'total_amount', v_order.total_amount,
      'remaining_amount', 0
    );
  exception when others then
    -- Stock (or any other) failure during finalization. The payment_records
    -- row inserted above is kept — it is not rolled back because it is
    -- outside this inner BEGIN/EXCEPTION block's scope of concern; money
    -- was actually captured and must stay auditable for a refund.
    update orders set status = 'payment_failed_stock', updated_at = now() where id = p_order_id;
    return jsonb_build_object(
      'status', 'stock_conflict',
      'order_status', 'payment_failed_stock',
      'paid_amount', v_paid_amount,
      'total_amount', v_order.total_amount,
      'remaining_amount', 0,
      'error', sqlerrm
    );
  end;
end;
$$;

revoke all on function public.submit_payment_and_finalize(uuid, numeric, text) from public;
grant execute on function public.submit_payment_and_finalize(uuid, numeric, text) to service_role;


-- ----------------------------------------------------------------------------
-- 3. get_order_payment_status(p_order_id) — read-only helper the checkout
--    page uses to render "already partially paid, ₹X remaining" state
--    without re-deriving the sum logic client-side.
-- ----------------------------------------------------------------------------
create or replace function public.get_order_payment_status(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_paid  numeric;
begin
  select * into v_order from orders where id = p_order_id and customer_id = auth.uid();
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0) into v_paid from payment_records where order_id = p_order_id;

  return jsonb_build_object(
    'order_status', v_order.status,
    'total_amount', v_order.total_amount,
    'paid_amount', v_paid,
    'remaining_amount', greatest(v_order.total_amount - v_paid, 0)
  );
end;
$$;

grant execute on function public.get_order_payment_status(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. NOTE / flagged gap: customer_addresses has no RLS policy in the
--    schema this was generated against (every other customer-owned table
--    does). Recommended policy set, NOT applied automatically — review and
--    run separately if you want it:
--
--    alter table public.customer_addresses enable row level security;
--    create policy "Users can view own addresses" on public.customer_addresses
--      for select to public using (auth.uid() = profile_id);
--    create policy "Users can insert own addresses" on public.customer_addresses
--      for insert to public with check (auth.uid() = profile_id);
--    create policy "Users can update own addresses" on public.customer_addresses
--      for update to public using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
--    create policy "Users can delete own addresses" on public.customer_addresses
--      for delete to public using (auth.uid() = profile_id);
--
--    Left commented-out rather than applied because enabling RLS on a table
--    that currently has none is a behavior change worth a deliberate call,
--    not a silent side effect of a checkout-flow migration.
-- ----------------------------------------------------------------------------



-- Enable RLS (if not already on)
alter table public.customer_addresses enable row level security;

-- Users can view their own addresses
create policy "Users can view own addresses"
  on public.customer_addresses
  for select
  to public
  using (auth.uid() = profile_id);

-- Users can insert their own addresses
create policy "Users can insert own addresses"
  on public.customer_addresses
  for insert
  to public
  with check (auth.uid() = profile_id);

-- Users can update their own addresses
create policy "Users can update own addresses"
  on public.customer_addresses
  for update
  to public
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Users can delete their own addresses
create policy "Users can delete own addresses"
  on public.customer_addresses
  for delete
  to public
  using (auth.uid() = profile_id);


-- Drop the old paid-decrement trigger/function — stock now moves at
-- order-creation time instead.
drop trigger if exists trg_order_paid_decrement_stock on public.orders;
drop function if exists public.decrement_stock_on_order_paid();

-- Fires when an order's status changes FROM 'pending_payment' TO
-- 'payment_failed'. Releases the stock that was reserved at order
-- creation, since adjust_product_stock() already decremented it there.
create or replace function public.release_stock_on_payment_failed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  if new.status = 'payment_failed' and old.status = 'pending_payment' then
    for item in
      select product_id, quantity
      from order_items
      where order_id = new.id
    loop
      perform adjust_product_stock(
        item.product_id,
        item.quantity,  -- positive delta: give the reserved stock back
        'payment_failed_release'
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_payment_failed_release_stock on public.orders;

create trigger trg_order_payment_failed_release_stock
  after update on public.orders
  for each row
  execute function public.release_stock_on_payment_failed();


-- Requires the pg_cron extension (enable once, in the Supabase
-- dashboard: Database → Extensions → pg_cron, or via SQL if you have
-- superuser access).
create extension if not exists pg_cron;

-- Sweeps orders stuck at 'pending_payment' for longer than the
-- abandonment window and marks them 'payment_failed'. This UPDATE is
-- what fires trg_order_payment_failed_release_stock (5a) per row,
-- releasing each order's reserved stock back to the products table.
create or replace function public.release_abandoned_orders(
  p_abandon_after interval default interval '20 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  update orders
  set status = 'payment_failed'
  where status = 'pending_payment'
    and created_at < now() - p_abandon_after;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

-- Runs every 5 minutes. cron.schedule requires the calling role to own
-- or have execute rights on the function; as postgres/service role this
-- is fine by default in Supabase.
select cron.schedule(
  'release-abandoned-orders',
  '*/5 * * * *',
  $$select public.release_abandoned_orders();$$
);