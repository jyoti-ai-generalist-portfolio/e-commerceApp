-- 20260916_catalog_management.sql
--
-- Supports Use Case 19 (Store Admin - Catalog Management). Two gaps in the
-- existing schema needed to be closed for this use case to work as spec'd:
--
-- 1. The use case asks for "soft-deleting categories". `products` already
--    has `is_published` to soft-delete a product, but `categories` has no
--    equivalent column. This adds one, mirroring that pattern.
--
-- 2. The use case's own Edge Cases section calls for atomic stock
--    adjustments ("SET stock_quantity = stock_quantity + :delta") rather
--    than overwriting with an absolute value, to avoid concurrent-admin
--    overwrites. The Supabase JS client can't express a raw SQL increment,
--    so this adds a Postgres function the edge function calls via RPC.

-- 1. Soft-delete flag for categories
alter table public.categories
  add column if not exists is_active boolean not null default true;

-- The existing "Public can view categories" policy is USING (true), so on
-- its own it would keep exposing soft-deleted categories to storefront
-- reads even after this column exists. Tighten it so the DB itself
-- enforces the soft-delete, not just app-level query filters.
drop policy if exists "Public can view categories" on public.categories;

create policy "Public can view active categories"
  on public.categories
  for select
  to public
  using (is_active = true);

-- Admins still need to see inactive categories (to reactivate/manage them)
-- in the admin UI. The admin edge functions use the service-role client,
-- which bypasses RLS entirely, so no separate admin SELECT policy is
-- required here.

-- 2. Atomic, logged stock adjustment
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_delta int,
  p_reason text default 'admin_adjustment'
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
begin
  update public.products
  set stock_quantity = stock_quantity + p_delta,
      updated_at = now()
  where id = p_product_id
  returning * into v_product;

  if not found then
    raise exception 'Product % not found', p_product_id
      using errcode = 'P0002';
  end if;

  if v_product.stock_quantity < 0 then
    raise exception 'Stock adjustment would result in negative stock (%).',
      v_product.stock_quantity
      using errcode = '23514';
  end if;

  insert into public.inventory_logs (product_id, change_qty, reason, reference_id, created_at)
  values (p_product_id, p_delta, p_reason, null, now());

  return v_product;
end;
$$;

-- Only the service role (used exclusively by the admin edge functions,
-- never exposed to the browser) should be able to call this.
revoke all on function public.adjust_product_stock(uuid, int, text) from public, anon, authenticated;
grant execute on function public.adjust_product_stock(uuid, int, text) to service_role;
