# ecommerce-customer

Customer-facing storefront implementing:
- **UC-02** — Login & Registration (`components/auth/AuthModal.jsx`, `app/api/v1/auth/*`)
- **UC-03** — Catalog landing page + shopping cart (`app/page.jsx`, `app/api/v1/products`, `app/api/v1/cart*`)

Plain JavaScript / JSX (no TypeScript), Next.js App Router, Tailwind CSS, Supabase (Postgres + Auth), Resend for transactional email.

## 1. Local setup

```bash
cd e-Commerceapp/ecommerce-customer
npm install
cp .env.example .env.local   # fill in real values, see below
npm run dev
```

Open http://localhost:3000 — the catalog page is the root route (`/`).

## 2. Environment variables

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL, safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public anon key, safe to expose — RLS does the real access control |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Used to write `profiles`/`customer_addresses` right after sign-up, and for the login existence check. **Never** expose this to the client or commit it. |
| `RESEND_API_KEY` | server only | Powers the welcome email |
| `RESEND_FROM_EMAIL` | server only | e.g. `"Your Store <onboarding@resend.dev>"` — must be a verified sender/domain in Resend |

## 3. Database prerequisites

This build assumes the schema in `Schema_Markdown_Format.txt` as-is. Two things worth doing in Supabase before go-live:

1. **Unique constraint on `cart_items`** — the schema has no unique constraint on `(cart_id, product_id)`. The cart-mutation endpoints work around this with a select-then-insert/update flow, but adding
   ```sql
   alter table cart_items add constraint cart_items_cart_product_unique unique (cart_id, product_id);
   ```
   would remove a small race-condition window (two near-simultaneous requests for the same product) and let the code use a single upsert.
2. **Email confirmation setting** — if your Supabase Auth project has "Confirm email" turned on, `signUp()` returns no session until the user clicks the confirmation link. The register endpoint and `AuthModal` already handle this (they show "check your email" instead of assuming login), but if you want instant login after sign-up, turn confirmation off in Supabase Auth settings.

## 4. VS Code → GitHub → Vercel

1. Open the `e-Commerceapp` folder in VS Code (this customer app lives at `e-Commerceapp/ecommerce-customer`; the admin app, if/when built, would sit alongside it at `e-Commerceapp/ecommerce-admin`).
2. Initialize git and push:
   ```bash
   cd e-Commerceapp
   git init
   git add .
   git commit -m "Customer storefront: catalog + auth (UC-02, UC-03)"
   git branch -M main
   git remote add origin https://github.com/<your-org>/<your-repo>.git
   git push -u origin main
   ```
3. In Vercel: **Add New Project → Import** your GitHub repo.
4. Set the **Root Directory** to `e-Commerceapp/ecommerce-customer` (Vercel builds from a subfolder — this matters since the repo also has room for the admin app alongside it).
5. Framework preset: Next.js (auto-detected via `vercel.json`).
6. Add the five environment variables from the table above in **Project Settings → Environment Variables** (Production + Preview).
7. Deploy. Every push to `main` redeploys automatically.

## 5. What's implemented vs. spec, and where I filled gaps

- **`GET /api/v1/categories`** isn't one of the named endpoints in either use case doc, but the catalog UI needs a category list for the filter pills — added it, reusing the existing `categories.is_active = true` public-read policy.
- **Login's "user not found" signal**: Supabase's `signInWithPassword` returns the same generic error for a wrong password and a non-existent email (this is intentional, to avoid leaking which emails are registered). To still support the spec's "auto-switch to Sign Up" UX, the login route does a secondary lookup against `profiles` using the service role. That reintroduces a small amount of email-enumeration surface, scoped only to gating a UI hint — flagging it as a product decision rather than making it silently.
- **Registration writes `profiles`/`customer_addresses` with the service role**, not the new user's own session — because if your Supabase project requires email confirmation, there's no session/JWT yet at the moment of sign-up for RLS to key off.
- **No DB unique constraint on `(cart_id, product_id)`** — see §3 above.
- Stock is intentionally **not** checked anywhere in this build (catalog, add-to-cart, quantity changes) — per the spec, that check is deferred to checkout, which is out of scope for UC-02/UC-03.
