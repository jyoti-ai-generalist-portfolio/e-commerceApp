# Use Case 19 — Store Admin: Catalog Management

Implements the catalog management use case as **Supabase Edge Functions**
(matching the rest of this project's order-lifecycle build) plus a React
admin page, rather than the Node.js/Express + Vercel backend the use-case
doc itself describes — per your decision.

## What's included

```
app/admin/catalog/
  CatalogManager.jsx        — page component, target route /admin/dashboard/catalog
  api.js                    — fetch wrappers around the edge functions
  validation.js             — client-side field validation
  components/
    CategoryGrid.jsx
    ProductTable.jsx
    ProductFormDrawer.jsx   — Add/Edit drawer (General Info / Inventory & Pricing / Media Upload tabs)
    ImageUploader.jsx
    StockAdjuster.jsx

supabase/functions/
  _shared/adminAuth.ts      — verifies JWT + admin-table lookup, shared by all functions below
  _shared/cors.ts
  admin-categories/         — GET/POST/PUT/DELETE (soft-delete)
  admin-catalog-products/   — GET (list, paginated)/POST/PUT/DELETE (soft-delete via is_published)
  admin-catalog-stock/      — PATCH, atomic delta-based stock adjustment
  admin-media-upload/       — POST, multipart upload to the public "images" bucket

supabase/migrations/
  20260916_catalog_management.sql  — adds categories.is_active, tightens categories' RLS to filter on it, and adds adjust_product_stock() RPC

Schema_Markdown_Format.txt        — your schema doc, updated in place to reflect the above and to
                                     document how each conflict below was actually resolved
```

## Deviations from the Use Case 19 document (flagged, not silently resolved)

1. **`image_url` vs `image_urls`.** The doc's own schema snippet defines a
   singular, required `image_url`, but its own example payload sends
   `image_urls` as an array — and your real schema has `image_urls _text`
   (nullable array). Built against your real schema: products can have
   0-5 images in `image_urls`.
2. **Admin auth.** The doc assumes a `role === 'admin'` JWT claim. Your
   schema has no role column anywhere; it has a separate `admins` table
   keyed by email. `_shared/adminAuth.ts` authenticates the JWT, then
   checks the user's email against `admins`.
3. **Stock updates: absolute vs. delta.** The doc's request example sends
   an absolute `stock_quantity`, but its own Edge Cases section calls for
   atomic increments to avoid concurrent-admin overwrites. Built the
   safer version: `PATCH /admin-catalog-stock/:id` takes a signed
   `delta` and applies it atomically via a Postgres function
   (`adjust_product_stock`), logging every change to `inventory_logs`.
   The table's +/- stepper naturally produces a delta.
4. **Category soft-delete.** The doc asks for soft-deleting categories,
   but `categories` had no active/inactive flag (only `products` does,
   via `is_published`). The migration adds `categories.is_active` and
   `DELETE /admin-categories/:id` sets it to `false` rather than removing
   the row — so the FK `ON DELETE RESTRICT` the doc mentions never
   actually gets exercised here. The migration also replaces the old
   `Public can view categories` RLS policy (`USING (true)`) with
   `Public can view active categories` (`USING (is_active = true)`) —
   otherwise the new column would do nothing for storefront reads, since
   RLS, not the admin UI, is what actually gates what customers see.
5. **Backend framework.** Built as Edge Functions per your choice, not
   the Node.js/Express + Vercel setup the master prompt template and the
   use case doc both specify. If a future use case needs Express instead,
   worth deciding once rather than mixing patterns per use case.

## Setup & deployment

1. **Apply the migration** (adds `categories.is_active` and the
   `adjust_product_stock` RPC):
   ```bash
   supabase db push
   # or, against a specific project:
   supabase migration up --db-url "$SUPABASE_DB_URL"
   ```

2. **Create the storage bucket** (if it doesn't already exist) and make
   it public, matching the URL pattern the use case specifies
   (`https://[project_id].supabase.co/storage/v1/object/public/images/`):
   ```bash
   supabase storage buckets create images --public
   ```

3. **Deploy the edge functions** — this project's existing GitHub Actions
   workflow deploys on push to `main`; the four new functions under
   `supabase/functions/` will be picked up automatically. To deploy
   manually instead:
   ```bash
   supabase functions deploy admin-categories
   supabase functions deploy admin-catalog-products
   supabase functions deploy admin-catalog-stock
   supabase functions deploy admin-media-upload
   ```
   No new environment variables are required beyond what the project
   already sets for Edge Functions (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`); `ALLOWED_ORIGIN` is optional (defaults
   to `*`) if you want to lock CORS down to your production domain.

4. **Front end:** copy `app/admin/catalog/` into your existing app,
   confirm the import path in `api.js` (`../../../lib/supabaseClient`)
   matches where your shared Supabase client actually lives, and set
   `NEXT_PUBLIC_SUPABASE_URL` / `REACT_APP_SUPABASE_URL` (whichever your
   project uses) in your Vercel environment variables — it's how the
   front end builds the Edge Functions base URL.

5. Route `CatalogManager` at `/admin/dashboard/catalog` in your router,
   guarded the same way your other `/admin/*` pages already are.

## Not covered here (left for a separate use case)

- The admin login/role-assignment flow that populates the `admins`
  table in the first place.
- Bulk category/product import.
