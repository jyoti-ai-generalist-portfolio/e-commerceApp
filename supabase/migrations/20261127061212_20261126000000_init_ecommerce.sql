-- ============================================================================
-- Consolidated E-Commerce Schema, Triggers, RLS, Storage & RPCs
-- Target schema: public (Project 1 Dev & Project 2 Production)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLES & INDEXES
-- ============================================================================
-- ============================================================================
-- MISSING TABLES: public.admins & public.payment_records
-- ============================================================================

create table if not exists public.admins (
  id bigint generated always as identity primary key,
  admin_email text not null unique,
  admin_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
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
create index if not exists idx_payment_records_order on public.payment_records(order_id);
create index if not exists idx_payment_records_customer on public.payment_records(customer_id);
create index if not exists idx_payment_records_razorpay_order on public.payment_records(razorpay_order_id);

drop trigger if exists trg_payment_records_updated_at on public.payment_records;
create trigger trg_payment_records_updated_at before update on public.payment_records
  for each row execute function public.set_updated_at();

-- RLS for admins & payment_records
alter table public.admins enable row level security;
alter table public.payment_records enable row level security;

drop policy if exists "admins: admin read" on public.admins;
create policy "admins: admin read" on public.admins
  for select using (public.is_admin());

drop policy if exists "payment_records: own or admin read" on public.payment_records;
create policy "payment_records: own or admin read" on public.payment_records
  for select using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid()
    )
  );


create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  pincode text not null,
  mobilenumber text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_addresses_profile on public.customer_addresses(profile_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  images text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_active on public.products(is_active);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, product_id)
);
create index if not exists idx_cart_items_cart on public.cart_items(cart_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  shipping_address_id uuid references public.customer_addresses(id) on delete set null,
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
create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_shipping_status on public.orders(order_shipping_status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  price_at_purchase numeric(10, 2) not null check (price_at_purchase >= 0)
);
create index if not exists idx_order_items_order on public.order_items(order_id);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reason text not null,
  status text not null default 'Requested'
    check (status in ('Requested', 'Approved', 'Rejected', 'Refunded')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_returns_order on public.returns(order_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (product_id, customer_id)
);

create index if not exists idx_reviews_product on public.reviews(product_id);

create table if not exists public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  change_amount integer not null,
  reason text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_inventory_logs_product on public.inventory_logs(product_id);

-- ============================================================================
-- 2. HELPER FUNCTIONS, TRIGGERS & RPCs
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_carts_updated_at on public.carts;
create trigger trg_carts_updated_at before update on public.carts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_returns_updated_at on public.returns;
create trigger trg_returns_updated_at before update on public.returns
  for each row execute function public.set_updated_at();

-- Atomic stock adjustment RPC (prevents negative stock)
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_delta integer,
  p_reason text default 'adjustment'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_stock integer;
begin
  update public.products
  set stock = stock + p_delta
  where id = p_product_id
    and stock + p_delta >= 0
  returning stock into v_new_stock;

  if not found then
    raise exception 'Insufficient stock or unknown product %', p_product_id;
  end if;

  insert into public.inventory_logs (product_id, change_amount, reason)
  values (p_product_id, p_delta, p_reason);

  return v_new_stock;
end;
$$;

revoke all on function public.adjust_product_stock(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.adjust_product_stock(uuid, integer, text) to service_role;

-- Release reserved stock automatically when an order transitions to payment_failed
create or replace function public.release_stock_on_payment_failed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  if new.status = 'payment_failed' and old.status is distinct from 'payment_failed' then
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = new.id and product_id is not null
    loop
      update public.products
      set stock = stock + v_item.quantity
      where id = v_item.product_id;

      insert into public.inventory_logs (product_id, change_amount, reason, order_id)
      values (v_item.product_id, v_item.quantity, 'payment_failed_release', new.id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_payment_failed_release_stock on public.orders;
create trigger trg_order_payment_failed_release_stock
  after update of status on public.orders
  for each row execute function public.release_stock_on_payment_failed();

-- Atomic refund approval + stock restoration RPC
create or replace function public.approve_refund_restore(
  p_order_id uuid, p_return_id uuid, p_is_cancellation boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
perform 1 from public.orders where id = p_order_id for update;
if not found then raise exception 'Order not found'; end if;
if exists (select 1 from public.returns
where id = p_return_id and order_id = p_order_id
and status in ('Approved', 'Refunded')) then
raise exception 'Return request is already processed or approved';
end if;
update public.orders
set status = 'refunded',
order_shipping_status = case when p_is_cancellation then 'Cancelled' else 'Returned' end,
updated_at = now()
where id = p_order_id;
update public.returns
set status = 'Refunded',
updated_at = now()
where id = p_return_id and order_id = p_order_id;
if not found then raise exception 'Return request not found for this order'; end if;
for v_item in
select product_id, quantity
from public.order_items
where order_id = p_order_id
and product_id is not null
loop
update public.products
set stock = stock + v_item.quantity,
updated_at = now()
where id = v_item.product_id;
insert into public.inventory_logs (product_id, change_amount, reason, order_id)
values (
v_item.product_id,
v_item.quantity,
case when p_is_cancellation then 'Order Cancelled / Refunded' else 'Return Refunded' end,
p_order_id
);
end loop;
end;
$$;
revoke all on function public.approve_refund_restore(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.approve_refund_restore(uuid, uuid, boolean) to service_role;
-- 
-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.returns enable row level security;
alter table public.reviews enable row level security;
alter table public.inventory_logs enable row level security;
-- profiles
drop policy if exists "profiles: own or admin read" on public.profiles;
create policy "profiles: own or admin read" on public.profiles
for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: own insert" on public.profiles;
create policy "profiles: own insert" on public.profiles
for insert with check (id = auth.uid());
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own update" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());
-- customer_addresses
drop policy if exists "addresses: own or admin read" on public.customer_addresses;
create policy "addresses: own or admin read" on public.customer_addresses
for select using (profile_id = auth.uid() or public.is_admin());
drop policy if exists "addresses: own insert" on public.customer_addresses;
create policy "addresses: own insert" on public.customer_addresses
for insert with check (profile_id = auth.uid());
drop policy if exists "addresses: own update" on public.customer_addresses;
create policy "addresses: own update" on public.customer_addresses
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "addresses: own delete" on public.customer_addresses;
create policy "addresses: own delete" on public.customer_addresses
for delete using (profile_id = auth.uid());
-- categories & products
drop policy if exists "categories: public read" on public.categories;
create policy "categories: public read" on public.categories
for select using (true);
drop policy if exists "categories: admin write" on public.categories;
create policy "categories: admin write" on public.categories
for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "products: public read" on public.products;
create policy "products: public read" on public.products
for select using (true);
drop policy if exists "products: admin write" on public.products;
create policy "products: admin write" on public.products
for all using (public.is_admin()) with check (public.is_admin());
-- carts & cart_items
drop policy if exists "carts: own all" on public.carts;
create policy "carts: own all" on public.carts
for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "cart_items: own all" on public.cart_items;
create policy "cart_items: own all" on public.cart_items
for all
using (exists (select 1 from public.carts c where c.id = cart_id and c.profile_id = auth.uid()))
with check (exists (select 1 from public.carts c where c.id = cart_id and c.profile_id = auth.uid()));
-- orders & order_items
drop policy if exists "orders: own or admin read" on public.orders;
create policy "orders: own or admin read" on public.orders
for select using (customer_id = auth.uid() or public.is_admin());
drop policy if exists "orders: own insert" on public.orders;
create policy "orders: own insert" on public.orders
for insert with check (customer_id = auth.uid());
drop policy if exists "orders: own or admin update" on public.orders;
create policy "orders: own or admin update" on public.orders
for update using (customer_id = auth.uid() or public.is_admin());
drop policy if exists "order_items: own or admin read" on public.order_items;
create policy "order_items: own or admin read" on public.order_items
for select using (
exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_admin()))
);
drop policy if exists "order_items: own insert" on public.order_items;
create policy "order_items: own insert" on public.order_items
for insert with check (
exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
-- returns
drop policy if exists "returns: own or admin read" on public.returns;
create policy "returns: own or admin read" on public.returns
for select using (
exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_admin()))
);
drop policy if exists "returns: own insert" on public.returns;
create policy "returns: own insert" on public.returns
for insert with check (
exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
drop policy if exists "returns: admin update" on public.returns;
create policy "returns: admin update" on public.returns
for update using (public.is_admin());
-- reviews
drop policy if exists "reviews: public read" on public.reviews;
create policy "reviews: public read" on public.reviews
for select using (true);
drop policy if exists "reviews: own insert" on public.reviews;
create policy "reviews: own insert" on public.reviews
for insert with check (customer_id = auth.uid());
drop policy if exists "reviews: own update" on public.reviews;
create policy "reviews: own update" on public.reviews
for update using (customer_id = auth.uid());
drop policy if exists "reviews: own delete" on public.reviews;
create policy "reviews: own delete" on public.reviews
for delete using (customer_id = auth.uid() or public.is_admin());
-- inventory_logs
drop policy if exists "inventory_logs: admin read" on public.inventory_logs;
create policy "inventory_logs: admin read" on public.inventory_logs
for select using (public.is_admin());
-- 
--============================================================================
-- 4. STORAGE BUCKET
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;
drop policy if exists "product-images: public read" on storage.objects;
create policy "product-images: public read" on storage.objects
for select using (bucket_id = 'product-images');
drop policy if exists "product-images: admin write" on storage.objects;
create policy "product-images: admin write" on storage.objects
for insert with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product-images: admin update" on storage.objects;
create policy "product-images: admin update" on storage.objects
for update using (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product-images: admin delete" on storage.objects;
create policy "product-images: admin delete" on storage.objects
for delete using (bucket_id = 'product-images' and public.is_admin());

-- ============================================================================
-- Abandoned Order Cleanup & Cron Schedule
-- ============================================================================
create extension if not exists pg_cron;

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
  update public.orders
  set status = 'payment_failed'
  where status = 'pending_payment'
    and created_at < now() - p_abandon_after;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

revoke all on function public.release_abandoned_orders(interval) from public, anon, authenticated;
grant execute on function public.release_abandoned_orders(interval) to service_role;

-- Unschedule first if it already exists so the migration is idempotent
do $$
begin
  if exists (select 1 from cron.job where jobname = 'release-abandoned-orders') then
    perform cron.unschedule('release-abandoned-orders');
  end if;
end $$;

select cron.schedule(
  'release-abandoned-orders',
  '*/5 * * * *',
  $$select public.release_abandoned_orders();$$
);
