# Deploying: VS Code → GitHub → Supabase (auto-run SQL on commit)

Goal: write SQL in VS Code, commit and push to GitHub, and have it run
against your Supabase database automatically — no manual paste into the
SQL editor.

## 1. Install the Supabase CLI locally
```bash
npm install -g supabase
supabase --version
```

## 2. Set up the local project structure
From your project root (matches the layout of the files delivered here):
```bash
supabase init
```
This creates `supabase/config.toml`. Drop the delivered files in:
```
supabase/
  migrations/
    001_schema.sql
    002_triggers.sql
  functions/
    _shared/
    stripe-webhook/
    order-confirmation/
    shipment-dispatched/
    out-for-delivery/
    delivered-review-request/
    return-request-notify/
    refund-processed/
```

## 3. Link VS Code's local project to your live Supabase project
```bash
supabase login
supabase link --project-ref <your-project-ref>
```
Find `<your-project-ref>` in the Supabase Dashboard URL:
`https://supabase.com/dashboard/project/<project-ref>`.

## 4. Verify migrations run locally first (recommended, not required)
```bash
supabase start        # spins up local Postgres in Docker
supabase db reset      # applies every file in supabase/migrations in order
```
Fix any SQL errors here — much faster than debugging in CI.

## 5. Commit and push to GitHub
```bash
git add supabase/
git commit -m "Add e-commerce schema and edge functions"
git push origin main
```

## 6. Add repo secrets (one-time)
In GitHub → your repo → **Settings → Secrets and variables → Actions**, add:
- `SUPABASE_ACCESS_TOKEN` — generate at Supabase Dashboard → Account →
  Access Tokens
- `SUPABASE_PROJECT_REF` — from the dashboard URL, same as step 3
- `SUPABASE_DB_PASSWORD` — the database password you set when the project
  was created (Dashboard → Project Settings → Database, or reset it there)

## 7. Add the GitHub Actions workflow
The delivered file `.github/workflows/deploy-supabase.yml` already does
this — commit it to `.github/workflows/` in your repo. On every push to
`main` that touches anything under `supabase/`, it will:
1. Check out the repo
2. Install the Supabase CLI
3. Link to your project using the stored secrets
4. Run `supabase db push` — applies any new migration files
5. Run `supabase functions deploy` — deploys every function under
   `supabase/functions/`

## 8. Set your function secrets (one-time, not per-commit)
Edge Function secrets (Resend/Stripe keys etc.) are **not** part of the git
push — set them once directly against the project:
```bash
supabase secrets set --project-ref <your-project-ref> \
  RESEND_API_KEY=... \
  STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  STORE_FROM_EMAIL=... \
  STORE_ADMIN_EMAIL=...
```
See `environment-variables.md` for the full list.

## 9. Enable required Postgres extensions once
In Supabase Dashboard → Database → Extensions, enable: `pg_net`,
`pg_cron`, `pgcrypto`, `vault` (vault is on by default on most projects).
`002_triggers.sql` depends on all four.

## 10. Register the Stripe webhook
In the Stripe Dashboard → Developers → Webhooks → **Add endpoint**:
- URL: `https://<project-ref>.functions.supabase.co/stripe-webhook`
- Event: `checkout.session.completed`
- Copy the generated signing secret into `STRIPE_WEBHOOK_SECRET` (step 8)

## From here on
Every future schema change is: **edit SQL in VS Code → commit → push** —
the GitHub Action applies it to Supabase automatically. Edge function code
changes deploy the same way. Only secrets (step 8) and one-time extension
enablement (step 9) are manual and outside the git flow.
