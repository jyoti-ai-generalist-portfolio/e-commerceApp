# Environment Variables

Two different places need environment variables, and they are **not** the
same set — don't paste one list into both places.

## A. Supabase Edge Function secrets
Set with the Supabase CLI (or Dashboard → Project Settings → Edge Functions → Secrets):

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxx \
  STORE_FROM_EMAIL=orders@yourstore.com \
  STORE_ADMIN_EMAIL=admin@yourstore.com \
  STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx \
  SUPABASE_URL=https://<project-ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

| Variable | Used by | Notes |
|---|---|---|
| `RESEND_API_KEY` | all email-sending functions | from Resend dashboard → API Keys |
| `STORE_FROM_EMAIL` | `order-confirmation`, `shipment-dispatched`, etc. | must be a domain verified in Resend |
| `STORE_ADMIN_EMAIL` | `return-request-notify` | where return alerts land |
| `STRIPE_SECRET_KEY` | `stripe-webhook` | from Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | from Stripe dashboard → Developers → Webhooks → your endpoint |
| `SUPABASE_URL` | every function (via `_shared/supabaseAdmin.ts`) | auto-injected by Supabase at runtime — you usually don't need to set this manually, but it's listed for completeness |
| `SUPABASE_SERVICE_ROLE_KEY` | every function | auto-injected by Supabase at runtime too — same note |
| `PUSH_PROVIDER_URL` *(optional)* | `out-for-delivery` | only if you wire up push/SMS; unset = skipped |
| `PUSH_PROVIDER_KEY` *(optional)* | `out-for-delivery` | pairs with the above |

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available
> inside every Edge Function's runtime — you don't need to `secrets set`
> them yourself. They're documented here only so `_shared/supabaseAdmin.ts`
> is self-explanatory.

## B. Database secrets (Vault, used inside SQL triggers)
Set once via SQL (already included in `002_triggers.sql`, shown here for reference):

```sql
select vault.create_secret('https://<project-ref>.functions.supabase.co', 'functions_base_url');
select vault.create_secret('<your-service-role-key>', 'service_role_key');
```

These let Postgres triggers call your Edge Functions via `pg_net` without a
key sitting in plain text inside your migration files.

## C. Frontend / VS Code project `.env` (client + build-time)
For the Node.js/frontend app calling Supabase and initiating Stripe Checkout:

```bash
# .env (client-safe — anon key only, never the service role key)
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx
```

**Never** put `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` in a
client-side `.env` — those two are server/Edge-Function-only and bypass
Row Level Security if leaked.

## D. GitHub Actions repo secrets (for the CI/CD deploy pipeline)
Set in GitHub → repo → Settings → Secrets and variables → Actions:

| Secret | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | authenticates the Supabase CLI in CI |
| `SUPABASE_PROJECT_REF` | which project to push migrations/functions to |
| `SUPABASE_DB_PASSWORD` | needed for `supabase db push` |

See `deployment-guide.md` for how these are used.
