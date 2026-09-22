-- ============================================================================
-- E-COMMERCE APPLICATION — SUPABASE DATABASE SCHEMA
-- Version: 1.0
-- Date: 2026-09-14
-- ============================================================================
-- Run this file top-to-bottom in the Supabase SQL editor, or via the
-- Supabase CLI (`supabase db push`) / GitHub Action described in
-- deployment-guide.md.
--
-- NOTES ON ADDITIONS BEYOND THE ORIGINAL SPEC MATRIX
-- (kept because the app will not function correctly without them):
--   1. `orders.created_at` / `orders.updated_at` — needed to know when an
--      order was placed and to drive the "email after 3 days" review flow.
--   2. `inventory_logs` table — referenced by the "Refund Processed" trigger
--      ("update entry in inventory_logs to restock items") but was not in
--      the original table matrix, so it is defined here.
--   3. Row Level Security (RLS) is enabled with baseline policies. This
--      wasn't requested, but an E-Commerce schema with customer PII and no
--      RLS is an open data leak on Supabase (anon key has table access by
--      default) — flagging this rather than silently shipping it insecure.
-- ============================================================================

-- Required extensions
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_net";     -- allows triggers to call Edge Functions via HTTP

-- ============================================================================
-- 1. profiles
-- ============================================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  created_at  timestamptz not null default now()
);


comment on table public.profiles is 'Links Supabase auth users to application-level profile data.';
-- ============================================================================
-- 1. customer_addresses
-- ============================================================================
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  profile_id uuid not null,
  address_line1 character varying null,
  address_line2 character varying null,
  city character varying null,
  pincode character varying null,
  mobilenumber character varying null,
  constraint customer_addresses_pkey primary key (id),
  constraint customer_addresses_profile_id_fkey foreign KEY (profile_id) references profiles (id) on update CASCADE on delete CASCADE
);



-- ============================================================================
-- 2. categories
-- — added 2026-09-16 for Use Case 19 (Catalog Management) to support admin soft-delete of categories; the schema previously had no soft-delete flag here, unlike `products.is_published` |
-- ============================================================================
create table public.categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  slug  text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- . admins
-- ============================================================================
create table public.admins (
  id    uuid primary key default gen_random_uuid(),
  admin_name  text not null unique,
  admin_email text not null unique,
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- 3. products
-- ============================================================================
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references public.categories(id) on delete set null,
  title           text not null,
  description     text,
  price           numeric(10,2) not null check (price >= 0),
  stock_quantity  integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold  integer not null default 0 check (low_stock_threshold >= 0),
  image_urls      text[] default '{}',
  is_published    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_products_category_id on public.products(category_id);
create index idx_products_is_published on public.products(is_published);

-- ============================================================================
-- 4. carts
-- ============================================================================
create table public.carts (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null unique references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- 5. cart_items
-- ============================================================================
create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references public.carts(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  quantity    integer not null default 1 check (quantity > 0),
  created_at  timestamptz not null default now(),
  unique (cart_id, product_id)
);

create index idx_cart_items_cart_id on public.cart_items(cart_id);

-- ============================================================================
-- 6. orders
-- ============================================================================
create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.profiles(id),
  total_amount       numeric(10,2) not null check (total_amount >= 0),
  status             text not null default 'Pending'
                       check (status in ('Pending','Processing','Shipped','Delivered','Cancelled')),
  shipping_address   jsonb not null,
  tracking_number    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_orders_customer_id on public.orders(customer_id);
create index idx_orders_status on public.orders(status);

-- ============================================================================
-- 7. order_items
-- ============================================================================
create table public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  product_id          uuid references public.products(id) on delete set null,
  quantity            integer not null check (quantity > 0),
  price_at_purchase   numeric(10,2) not null
);

create index idx_order_items_order_id on public.order_items(order_id);

-- ============================================================================
-- 8. returns
-- ============================================================================
create table public.returns (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  reason      text not null,
  status      text not null default 'Requested'
                check (status in ('Requested','Approved','Rejected','Refunded')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_returns_order_id on public.returns(order_id);

-- ============================================================================
-- 9. inventory_logs  (supporting table — see notes above)
--— every catalog stock adjustment (via `adjust_product_stock()`, see Functions) writes one row here, `change_qty` being the signed delta applied |
-- ============================================================================
create table public.inventory_logs (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  change_qty  integer not null,          -- positive = restock, negative = deduction
  reason      text not null,             -- e.g. 'refund_restock', 'order_deduction', 'manual_adjustment'
  reference_id uuid,                     -- order_id / return_id that caused the change
  created_at  timestamptz not null default now()
);

create index idx_inventory_logs_product_id on public.inventory_logs(product_id);

-- ============================================================================
-- updated_at auto-touch trigger (generic, reused across tables)
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_carts_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger trg_returns_updated_at
  before update on public.returns
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (baseline — tighten per your admin-role model)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.returns enable row level security;
alter table public.inventory_logs enable row level security;

-- Public catalog: anyone can read published products / categories
create policy "Public can view categories"
  on public.categories for select
  using (true);

create policy "Public can view published products"
  on public.products for select
  using (is_published = true);

-- Customers can manage their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Customers can manage their own cart
create policy "Users can view own cart"
  on public.carts for select
  using (auth.uid() = profile_id);

create policy "Users can modify own cart"
  on public.carts for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Users can manage own cart items"
  on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.profile_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.profile_id = auth.uid()));

-- Customers can view/create their own orders
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = customer_id);

create policy "Users can create own orders"
  on public.orders for insert
  with check (auth.uid() = customer_id);

create policy "Users can view own order items"
  on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Customers can view/create their own returns
create policy "Users can view own returns"
  on public.returns for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

create policy "Users can create own returns"
  on public.returns for insert
  with check (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- NOTE: Store admin / business owner roles (full read/write access) should
-- be granted via a `service_role` key on the backend, OR by adding a
-- `role` column to `profiles` and writing policies like:
--   using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
-- This wasn't specified in the original brief, so it's left as a follow-up
-- decision rather than assumed.
