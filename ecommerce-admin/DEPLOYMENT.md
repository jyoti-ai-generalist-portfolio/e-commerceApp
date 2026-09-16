# Deployment Guide: VS Code → GitHub → Vercel

## 1. Open the project in VS Code

1. Extract/copy this folder onto your machine as `ecommerce-admin`.
2. In VS Code: **File → Open Folder…** and select `ecommerce-admin`.
3. Open a terminal in VS Code (`` Ctrl+` ``) and install dependencies:
   ```bash
   npm install
   ```

## 2. Configure Supabase

1. In the Supabase dashboard for your project, go to **Project Settings → API**.
2. Copy the **Project URL** → this is `SUPABASE_URL`.
3. Copy the **service_role** key (not the `anon` key — this backend needs to bypass
   RLS to aggregate across all customers' orders) → this is `SUPABASE_SERVICE_ROLE_KEY`.
   Keep this secret; never expose it to the client.
4. Confirm the `admins`, `profiles`, `orders`, `order_items`, and `products` tables
   already exist per the shared schema (they do, per the migrations in this project's
   companion Supabase repo).

## 3. Configure Google OAuth

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000` (local dev)
   - `https://your-project.vercel.app` (after your first Vercel deploy, add the real URL)
4. Copy the **Client ID** → use it for both `GOOGLE_CLIENT_ID` and
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
5. Add at least one row to the `admins` table with the email address you'll sign in
   with, so the login use case (UC-01) can authorize you.

## 4. Set local environment variables

```bash
cp .env.example .env.local
```

Fill in the four values from steps 2–3, plus a `JWT_SECRET`:

```bash
openssl rand -base64 48
```

Run locally to confirm it works:

```bash
npm run dev
```

Visit `http://localhost:3000/admin/login` and sign in with the admin email you added.

## 5. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: admin login and dashboard (UC-01, UC-13)"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`.env.local` is already excluded via `.gitignore` — never commit real secrets.

## 6. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository.
2. Vercel auto-detects the Next.js framework from `vercel.json` / `package.json` —
   no build command changes needed.
3. Under **Environment Variables**, add the same five variables from `.env.local`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_CLIENT_ID`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - `JWT_SECRET`
4. Click **Deploy**.
5. Once deployed, copy the assigned `https://your-project.vercel.app` URL and add it
   back into the Google OAuth client's **Authorized JavaScript origins** (step 3),
   since Google validates the origin the sign-in request comes from.

## 7. Verify in production

1. Visit `https://your-project.vercel.app/admin/login`.
2. Sign in with an email present in the `admins` table → should redirect to
   `/admin/dashboard` with live KPIs, the revenue chart, and recent orders.
3. Sign in (or ask a teammate to try) with a non-admin Google account → should see the
   "Access Denied" message and get no session cookie.

## 8. Ongoing deploys

Every `git push` to `main` triggers a new Vercel deployment automatically. Use Vercel's
preview deployments (automatic on pull requests) to review changes before merging.

## Notes on scaling past this scaffold

- The dashboard's low-stock count currently scans the `products` table in the API
  route; for a large catalog, move that comparison into a Postgres view or scheduled
  job, per the caching note already flagged for UC-13.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security by design (the admin backend
  needs cross-customer visibility) — never expose it in client-side code or logs.
