# eCommerce Admin Portal

A Next.js (App Router, plain JavaScript) admin application implementing two use cases
against the shared Supabase e-commerce schema:

- **UC-01 — Store Admin Authentication & Login** (`/admin/login`)
- **UC-13 — Store Admin Dashboard** (`/admin/dashboard`)

## Stack

- **Frontend:** React via Next.js App Router, Tailwind CSS, Recharts
- **Backend:** Next.js Route Handlers (`app/api/**/route.js`) — deploy as Vercel
  serverless functions, no separate Express server needed
- **Auth:** Google Identity Services (OAuth) → verified server-side → app-level JWT
  in an `httpOnly` cookie
- **Data:** Supabase Postgres, queried from the server with the service role key

## Folder structure

```
ecommerce-admin/
├── app/
│   ├── admin/
│   │   ├── login/page.jsx          UC-01 login screen
│   │   └── dashboard/page.jsx      UC-13 dashboard screen
│   ├── api/v1/admin/
│   │   ├── auth/google/route.js    POST — verify Google token, issue JWT
│   │   ├── auth/me/route.js        GET  — verify session, re-check admin status
│   │   ├── auth/logout/route.js    POST — clear session cookie
│   │   └── dashboard/
│   │       ├── metrics/route.js    GET — KPIs, revenue chart, recent orders
│   │       └── export/route.js     GET — CSV export
│   ├── layout.jsx
│   └── globals.css
├── components/                     Sidebar, top bar, KPI card, chart, table
├── lib/                            supabaseClient.js, jwt.js, googleAuth.js
├── middleware.js                   Redirects unauthenticated users to /admin/login
├── .env.example
└── vercel.json
```

Customer-facing pages, the `/admin/catalog`, `/admin/orders`, `/admin/customers`, and
`/admin/settings` screens referenced by the sidebar are not part of UC-01/UC-13 and are
left as follow-up use cases — add them under `app/admin/<section>/page.jsx` and
`app/api/v1/admin/<section>/route.js` following the same pattern.

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values (see comments in that file
for where each one comes from: Supabase project settings, Google Cloud Console OAuth
client, and a generated JWT secret).

## Data validation implemented

- Google `id_token` is verified against Google's public keys and this app's
  `GOOGLE_CLIENT_ID` (audience check) before any session is issued.
- Admin email lookups are case-insensitive (`ilike`) to avoid mismatches from
  formatting differences.
- Dashboard date-range params are parsed defensively; average order value guards
  against divide-by-zero when there are no orders in a period.
- The `/admin/*` middleware guard and the `/api/v1/admin/auth/me` re-check together
  mean a revoked admin loses access even with a still-valid JWT.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

Visit `http://localhost:3000/admin/login`.

See `DEPLOYMENT.md` for pushing this to GitHub and deploying on Vercel.
