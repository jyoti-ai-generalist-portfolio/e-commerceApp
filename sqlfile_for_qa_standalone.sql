-- ============================================================================
-- QA Schema Setup inside Project 1 (coexists alongside public = Dev)
-- Run once in Project 1's Supabase SQL Editor (do NOT place in migrations/)
-- ============================================================================

create schema if not exists qa;

grant usage on schema qa to anon, authenticated, service_role;
alter default privileges in schema qa grant all on tables to anon, authenticated, service_role;
alter default privileges in schema qa grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema qa grant all on routines to anon, authenticated, service_role;

-- 1. Tables
create table if not exists qa.admins (
  id bigint generated always as identity primary key,
  admin_email text not null unique,
  admin_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists qa.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qa.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references qa.profiles(id) on delete cascade,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  pincode text not null,
  mobilenumber text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_qa_customer_addresses_profile on qa.customer_addresses(profile_id);

create table if not exists qa.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists qa.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references qa.categories(id) on delete set null,
  title text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  images text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_qa_products_category on qa.products(category_id);
create index if not exists idx_qa_products_active on qa.products(is_active);

create table if not exists qa.carts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references qa.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qa.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references qa.carts(id) on delete cascade,
  product_id uuid not null references qa.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, product_id)
);
create index if not exists idx_qa_cart_items_cart on qa.cart_items(cart_id);

create table if not exists qa.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references qa.profiles(id) on delete restrict,
  shipping_address_id uuid references qa.customer_addresses(id) on delete set null,
  razorpay_order_id text unique,
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(10, 2) not null default 0 check (tax_amount >= 0),
  shipping_fee numeric(10, 2) not null default 0 check (shipping_fee >= 0),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'payment_failed', 'refunded')),
  order_shipping_status text not null default 'Processing'
    check (order_shipping_status in ('Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned')),
  tracking_number text,
  delivery_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_qa_orders_customer on qa.orders(customer_id);
create index if not exists idx_qa_orders_status on qa.orders(status);
create index if not exists idx_qa_orders_shipping_status on qa.orders(order_shipping_status);

create table if not exists qa.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references qa.orders(id) on delete cascade,
  product_id uuid references qa.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  price_at_purchase numeric(10, 2) not null check (price_at_purchase >= 0)
);
create index if not exists idx_qa_order_items_order on qa.order_items(order_id);

create table if not exists qa.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references qa.orders(id) on delete cascade,
  customer_id uuid references qa.profiles(id) on delete set null,
  razorpay_order_id text,
  razorpay_payment_id text unique,
  razorpay_signature text,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'created'
    check (status in ('created', 'authorized', 'captured', 'failed', 'refunded')),
  method text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_qa_payment_records_order on qa.payment_records(order_id);
create index if not exists idx_qa_payment_records_customer on qa.payment_records(customer_id);
create index if not exists idx_qa_payment_records_razorpay_order on qa.payment_records(razorpay_order_id);

create table if not exists qa.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references qa.orders(id) on delete cascade,
  reason text not null,
  status text not null default 'Requested'
    check (status in ('Requested', 'Approved', 'Rejected', 'Refunded')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_qa_returns_order on qa.returns(order_id);

create table if not exists qa.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references qa.products(id) on delete cascade,
  customer_id uuid not null references qa.profiles(id) on delete cascade,
  order_id uuid references qa.orders(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (product_id, customer_id)
);
create index if not exists idx_qa_reviews_product on qa.reviews(product_id);

create table if not exists qa.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references qa.products(id) on delete cascade,
  change_amount integer not null,
  reason text not null,
  order_id uuid references qa.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_qa_inventory_logs_product on qa.inventory_logs(product_id);

-- 2. Functions & Triggers
create or replace function qa.is_admin()
returns boolean
language sql
stable
security definer
set search_path = qa
as $$
  select exists (
    select 1
    from qa.admins
    where lower(admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function qa.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_profiles_updated_at on qa.profiles;
create trigger trg_profiles_updated_at before update on qa.profiles for each row execute function qa.set_updated_at();
drop trigger if exists trg_products_updated_at on qa.products;
create trigger trg_products_updated_at before update on qa.products for each row execute function qa.set_updated_at();
drop trigger if exists trg_carts_updated_at on qa.carts;
create trigger trg_carts_updated_at before update on qa.carts for each row execute function qa.set_updated_at();
drop trigger if exists trg_orders_updated_at on qa.orders;
create trigger trg_orders_updated_at before update on qa.orders for each row execute function qa.set_updated_at();
drop trigger if exists trg_payment_records_updated_at on qa.payment_records;
create trigger trg_payment_records_updated_at before update on qa.payment_records for each row execute function qa.set_updated_at();
drop trigger if exists trg_returns_updated_at on qa.returns;
create trigger trg_returns_updated_at before update on qa.returns for each row execute function qa.set_updated_at();

create or replace function qa.adjust_product_stock(p_product_id uuid, p_delta integer, p_reason text default 'adjustment')
returns integer language plpgsql security definer set search_path = qa as $$
declare v_new_stock integer;
begin
  update qa.products set stock = stock + p_delta
  where id = p_product_id and stock + p_delta >= 0
  returning stock into v_new_stock;

  if not found then raise exception 'Insufficient stock or unknown product %', p_product_id; end if;

  insert into qa.inventory_logs (product_id, change_amount, reason)
  values (p_product_id, p_delta, p_reason);

  return v_new_stock;
end;
$$;

create or replace function qa.release_stock_on_payment_failed()
returns trigger language plpgsql security definer set search_path = qa as $$
declare v_item record;
begin
  if new.status = 'payment_failed' and old.status is distinct from 'payment_failed' then
    for v_item in select product_id, quantity from qa.order_items where order_id = new.id and product_id is not null loop
      update qa.products set stock = stock + v_item.quantity where id = v_item.product_id;
      insert into qa.inventory_logs (product_id, change_amount, reason, order_id)
      values (v_item.product_id, v_item.quantity, 'payment_failed_release', new.id);
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_order_payment_failed_release_stock on qa.orders;
create trigger trg_order_payment_failed_release_stock
  after update of status on qa.orders for each row execute function qa.release_stock_on_payment_failed();

create or replace function qa.approve_refund_restore(p_order_id uuid, p_return_id uuid, p_is_cancellation boolean)
returns void language plpgsql security definer set search_path = qa as $$
declare v_item record;
begin
  perform 1 from qa.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if exists (select 1 from qa.returns where id = p_return_id and order_id = p_order_id and status in ('Approved', 'Refunded')) then
    raise exception 'Return request is already processed or approved';
  end if;
  update qa.orders set status = 'refunded',
    order_shipping_status = case when p_is_cancellation then 'Cancelled' else 'Returned' end,
    updated_at = now() where id = p_order_id;
  update qa.returns set status = 'Refunded', updated_at = now()
    where id = p_return_id and order_id = p_order_id;
  if not found then raise exception 'Return request not found for this order'; end if;
  for v_item in select product_id, quantity from qa.order_items where order_id = p_order_id and product_id is not null loop
    update qa.products set stock = stock + v_item.quantity, updated_at = now() where id = v_item.product_id;
    insert into qa.inventory_logs (product_id, change_amount, reason, order_id)
    values (v_item.product_id, v_item.quantity,
      case when p_is_cancellation then 'Order Cancelled / Refunded' else 'Return Refunded' end, p_order_id);
  end loop;
end;
$$;

-- 3. RLS Policies
alter table qa.admins enable row level security;
alter table qa.profiles enable row level security;
alter table qa.customer_addresses enable row level security;
alter table qa.categories enable row level security;
alter table qa.products enable row level security;
alter table qa.carts enable row level security;
alter table qa.cart_items enable row level security;
alter table qa.orders enable row level security;
alter table qa.order_items enable row level security;
alter table qa.payment_records enable row level security;
alter table qa.returns enable row level security;
alter table qa.reviews enable row level security;
alter table qa.inventory_logs enable row level security;

drop policy if exists "admins: admin read" on qa.admins;
create policy "admins: admin read" on qa.admins for select using (qa.is_admin());

drop policy if exists "profiles: own or admin read" on qa.profiles;
create policy "profiles: own or admin read" on qa.profiles for select using (id = auth.uid() or qa.is_admin());
drop policy if exists "profiles: own insert" on qa.profiles;
create policy "profiles: own insert" on qa.profiles for insert with check (id = auth.uid());
drop policy if exists "profiles: own update" on qa.profiles;
create policy "profiles: own update" on qa.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "addresses: own or admin read" on qa.customer_addresses;
create policy "addresses: own or admin read" on qa.customer_addresses for select using (profile_id = auth.uid() or qa.is_admin());
drop policy if exists "addresses: own insert" on qa.customer_addresses;
create policy "addresses: own insert" on qa.customer_addresses for insert with check (profile_id = auth.uid());
drop policy if exists "addresses: own update" on qa.customer_addresses;
create policy "addresses: own update" on qa.customer_addresses for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "addresses: own delete" on qa.customer_addresses;
create policy "addresses: own delete" on qa.customer_addresses for delete using (profile_id = auth.uid());

drop policy if exists "categories: public read" on qa.categories;
create policy "categories: public read" on qa.categories for select using (true);
drop policy if exists "categories: admin write" on qa.categories;
create policy "categories: admin write" on qa.categories for all using (qa.is_admin()) with check (qa.is_admin());

drop policy if exists "products: public read" on qa.products;
create policy "products: public read" on qa.products for select using (true);
drop policy if exists "products: admin write" on qa.products;
create policy "products: admin write" on qa.products for all using (qa.is_admin()) with check (qa.is_admin());

drop policy if exists "carts: own all" on qa.carts;
create policy "carts: own all" on qa.carts for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "cart_items: own all" on qa.cart_items;
create policy "cart_items: own all" on qa.cart_items for all
using (exists (select 1 from qa.carts c where c.id = cart_id and c.profile_id = auth.uid()))
with check (exists (select 1 from qa.carts c where c.id = cart_id and c.profile_id = auth.uid()));

drop policy if exists "orders: own or admin read" on qa.orders;
create policy "orders: own or admin read" on qa.orders for select using (customer_id = auth.uid() or qa.is_admin());
drop policy if exists "orders: own insert" on qa.orders;
create policy "orders: own insert" on qa.orders for insert with check (customer_id = auth.uid());
drop policy if exists "orders: own or admin update" on qa.orders;
create policy "orders: own or admin update" on qa.orders for update using (customer_id = auth.uid() or qa.is_admin());

drop policy if exists "order_items: own or admin read" on qa.order_items;
create policy "order_items: own or admin read" on qa.order_items for select using (
  exists (select 1 from qa.orders o where o.id = order_id and (o.customer_id = auth.uid() or qa.is_admin()))
);
drop policy if exists "order_items: own insert" on qa.order_items;
create policy "order_items: own insert" on qa.order_items for insert with check (
  exists (select 1 from qa.orders o where o.id = order_id and o.customer_id = auth.uid())
);

drop policy if exists "payment_records: own or admin read" on qa.payment_records;
create policy "payment_records: own or admin read" on qa.payment_records for select using (
  customer_id = auth.uid()
  or qa.is_admin()
  or exists (
    select 1 from qa.orders o
    where o.id = order_id and o.customer_id = auth.uid()
  )
);

drop policy if exists "returns: own or admin read" on qa.returns;
create policy "returns: own or admin read" on qa.returns for select using (
  exists (select 1 from qa.orders o where o.id = order_id and (o.customer_id = auth.uid() or qa.is_admin()))
);
drop policy if exists "returns: own insert" on qa.returns;
create policy "returns: own insert" on qa.returns for insert with check (
  exists (select 1 from qa.orders o where o.id = order_id and o.customer_id = auth.uid())
);
drop policy if exists "returns: admin update" on qa.returns;
create policy "returns: admin update" on qa.returns for update using (qa.is_admin());

drop policy if exists "reviews: public read" on qa.reviews;
create policy "reviews: public read" on qa.reviews for select using (true);
drop policy if exists "reviews: own insert" on qa.reviews;
create policy "reviews: own insert" on qa.reviews for insert with check (customer_id = auth.uid());
drop policy if exists "reviews: own update" on qa.reviews;
create policy "reviews: own update" on qa.reviews for update using (customer_id = auth.uid());
drop policy if exists "reviews: own delete" on qa.reviews;
create policy "reviews: own delete" on qa.reviews for delete using (customer_id = auth.uid() or qa.is_admin());

drop policy if exists "inventory_logs: admin read" on qa.inventory_logs;
create policy "inventory_logs: admin read" on qa.inventory_logs for select using (qa.is_admin());

grant all on all tables in schema qa to anon, authenticated, service_role;
grant all on all sequences in schema qa to anon, authenticated, service_role;
grant all on all routines in schema qa to anon, authenticated, service_role;

-- ============================================================================
-- Abandoned Order Cleanup & Cron Schedule
-- ============================================================================
create extension if not exists pg_cron;

create or replace function qa.release_abandoned_orders(
  p_abandon_after interval default interval '20 minutes'
)
returns integer
language plpgsql
security definer
set search_path = qa
as $$
declare
  affected_count integer;
begin
  update qa.orders
  set status = 'payment_failed'
  where status = 'pending_payment'
    and created_at < now() - p_abandon_after;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

-- Lock down all privileged functions (must run AFTER grant all on all routines)
revoke all on function qa.adjust_product_stock(uuid, integer, text) from public, anon, authenticated;
grant execute on function qa.adjust_product_stock(uuid, integer, text) to service_role;

revoke all on function qa.approve_refund_restore(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function qa.approve_refund_restore(uuid, uuid, boolean) to service_role;

revoke all on function qa.release_abandoned_orders(interval) from public, anon, authenticated;
grant execute on function qa.release_abandoned_orders(interval) to service_role;

-- Unschedule first if it already exists so the migration is idempotent
do $$
begin
  if exists (select 1 from cron.job where jobname = 'qa-release-abandoned-orders') then
    perform cron.unschedule('qa-release-abandoned-orders');
  end if;
end $$;

select cron.schedule(
  'qa-release-abandoned-orders',
  '*/5 * * * *',
  $$select qa.release_abandoned_orders();$$
);