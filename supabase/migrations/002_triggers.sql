-- ============================================================================
-- E-COMMERCE APPLICATION — DATABASE TRIGGERS -> EDGE FUNCTIONS
-- Version: 1.0
-- Date: 2026-09-14
-- ============================================================================
-- Run this AFTER 001_schema.sql. It wires Postgres row-level events to the
-- Supabase Edge Functions in /supabase/functions using the `pg_net`
-- extension (async HTTP calls from inside Postgres — the standard Supabase
-- pattern for this; the alternative, Database Webhooks configured in the
-- Dashboard UI, does the same thing without SQL but isn't scriptable/
-- committable to git, so triggers are used here instead).
--
-- Replace <PROJECT_REF> below with your actual Supabase project reference.
-- The service role key used in each call comes from Vault (see bottom of
-- this file) rather than being hardcoded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Supporting schema additions needed by the trigger/function logic
-- (not in the original table matrix — added because the described
-- behaviors depend on them; each is called out inline).
-- ----------------------------------------------------------------------------

-- Needed so delivered-review-request doesn't email the same order twice.
alter table public.orders
  add column review_email_sent boolean not null default false;

-- ----------------------------------------------------------------------------
-- Vault: store secrets once, reference them from triggers (never hardcode
-- keys in trigger SQL, since SQL migrations often end up in git history).
-- ----------------------------------------------------------------------------
select vault.create_secret('https://<PROJECT_REF>.functions.supabase.co', 'functions_base_url');
select vault.create_secret('<YOUR_SERVICE_ROLE_KEY>', 'service_role_key');

-- Helper to call an Edge Function by name with a JSON body
create or replace function public.call_edge_function(function_name text, payload jsonb)
returns void
language plpgsql
security definer
as $$
declare
  base_url text;
  svc_key  text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'functions_base_url';
  select decrypted_secret into svc_key  from vault.decrypted_secrets where name = 'service_role_key';

  perform net.http_post(
    url     := base_url || '/' || function_name,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || svc_key
               ),
    body    := payload
  );
end;
$$;

-- ============================================================================
-- 1. Order Placed successfully -> order-confirmation
-- ============================================================================
create or replace function public.trg_fn_order_placed()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.call_edge_function('order-confirmation', jsonb_build_object('order_id', new.id));
  return new;
end;
$$;

create trigger trg_order_placed
  after insert on public.orders
  for each row execute function public.trg_fn_order_placed();

-- ============================================================================
-- 2. Package Dispatched -> shipment-dispatched
-- ============================================================================
create or replace function public.trg_fn_order_shipped()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'Shipped' and old.status is distinct from 'Shipped' then
    perform public.call_edge_function('shipment-dispatched', jsonb_build_object('order_id', new.id));
  end if;
  return new;
end;
$$;

create trigger trg_order_shipped
  after update on public.orders
  for each row execute function public.trg_fn_order_shipped();

-- ============================================================================
-- 3. Out for Delivery -> out-for-delivery
-- (requires 'Out for Delivery' added to the status check constraint)
-- ============================================================================
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('Pending','Processing','Shipped','Out for Delivery','Delivered','Cancelled'));

create or replace function public.trg_fn_out_for_delivery()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'Out for Delivery' and old.status is distinct from 'Out for Delivery' then
    perform public.call_edge_function('out-for-delivery', jsonb_build_object('order_id', new.id));
  end if;
  return new;
end;
$$;

create trigger trg_out_for_delivery
  after update on public.orders
  for each row execute function public.trg_fn_out_for_delivery();

-- ============================================================================
-- 4. Delivered Successfully
--    Immediate: nothing to send synchronously per the brief.
--    Delayed:   review email 3 days later, handled by pg_cron -> the
--               delivered-review-request function (batch job, not a
--               row trigger — see that function's header comment).
-- ============================================================================

-- Requires pg_cron extension (enable via Database > Extensions in the
-- Supabase Dashboard, or: create extension if not exists pg_cron;)
select cron.schedule(
  'review-request-daily',
  '0 10 * * *',  -- every day at 10:00 UTC
  $$ select public.call_edge_function('delivered-review-request', '{}'::jsonb); $$
);

-- ============================================================================
-- 5. Return Request Submitted -> return-request-notify
-- ============================================================================
create or replace function public.trg_fn_return_requested()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.call_edge_function('return-request-notify', jsonb_build_object('return_id', new.id));
  return new;
end;
$$;

create trigger trg_return_requested
  after insert on public.returns
  for each row execute function public.trg_fn_return_requested();

-- ============================================================================
-- 6. Refund Processed -> refund-processed
-- ============================================================================
create or replace function public.trg_fn_refund_processed()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'Refunded' and old.status is distinct from 'Refunded' then
    perform public.call_edge_function('refund-processed', jsonb_build_object('return_id', new.id));
  end if;
  return new;
end;
$$;

create trigger trg_refund_processed
  after update on public.returns
  for each row execute function public.trg_fn_refund_processed();

-- ============================================================================
-- Supporting RPCs used by the Edge Functions (stock adjustment)
-- ============================================================================
create or replace function public.decrement_stock(p_product_id uuid, p_qty integer)
returns void
language sql
security definer
as $$
  update public.products
  set stock_quantity = greatest(stock_quantity - p_qty, 0)
  where id = p_product_id;
$$;

create or replace function public.increment_stock(p_product_id uuid, p_qty integer)
returns void
language sql
security definer
as $$
  update public.products
  set stock_quantity = stock_quantity + p_qty
  where id = p_product_id;
$$;
