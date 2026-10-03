# OIMES Deployment Guide

This guide deploys the OIMES React/Vite frontend to Vercel and its Supabase services to a Supabase Free project. It is written for a thesis/demo deployment, not for handling real money or production financial transactions.

> **Important:** Do not publish the repository or deploy a public demo until you have handled the tracked credentials and reviewed the security items in [Deployment Blockers](#deployment-blockers). The project currently tracks `env.test`, which contains test-account credentials.

## 1. Project Architecture

| Part | OIMES implementation | What it does |
|---|---|---|
| Frontend | React, TypeScript, Vite, `src/` | Renders the customer app and `/admin` portal in the visitor's browser. Zustand stores client UI state. |
| Backend | Supabase managed services | There is no separate Express or Node.js API server. The Supabase JavaScript client calls Supabase Auth, the PostgreSQL API, Storage, and Realtime. |
| Authentication | Supabase Auth | Email/password sign-in and registration. Customer and admin sessions use separate Supabase clients/storage keys. Password reset returns to `/reset-password`. |
| Database | Supabase PostgreSQL | Stores profiles, wallets, rates, transactions, escrow balances, notifications, support messages, and admin activity. |
| Authorization | PostgreSQL RLS policies and SQL functions | Restricts data by signed-in user/admin. Transaction creation, approval, denial, and demo top-up use database RPC functions. |

Typical exchange flow:

1. The browser signs in through Supabase Auth.
2. The React app reads the user's wallets and exchange rates through the Supabase client.
3. The app calls `create_exchange_transaction` using Supabase RPC.
4. PostgreSQL validates wallet ownership/status and balance, debits the source wallet, credits the escrow ledger, and records a pending transaction.
5. An admin signs in at `/admin` and approves or denies the pending transaction. Realtime updates refresh customer/admin views.

The code configures both the customer and admin Supabase clients in [`src/lib/supabase.ts`](src/lib/supabase.ts). The browser-safe key identifies the application; Auth identifies the user; RLS and database functions must enforce the user's actual permissions.

## 2. Requirements

1. A GitHub account to host the repository and connect it to Vercel.
2. A Vercel account. The Hobby plan is free for eligible personal, non-commercial projects; review current terms for your university use.
3. A Supabase account and project.
4. Git installed.
5. Node.js **22 LTS is recommended**. The locked Vite 6.3.5 supports Node `^18.0.0`, `^20.0.0`, or `>=22.0.0`; Node 21 is outside that declared range. The optional performance script uses Node's `--env-file`, available from Node 20.6.
6. npm. The repository includes `package-lock.json` (lockfile version 3), but does not pin a specific npm version; npm 9 or later is a suitable choice.
7. VS Code is optional, but useful for editing environment files and viewing the project.

Confirm your local installations:

```bash
node --version
npm --version
git --version
```

## 3. Pre-Deployment Checklist

Run these commands from the OIMES project root, the folder containing `package.json`:

1. Install the exact dependencies recorded in the npm lockfile:

   ```bash
   npm ci
   ```

2. Create a local environment file as described in [Environment Variables](#5-environment-variables).
3. Start the Vite development server:

   ```bash
   npm run dev
   ```

   Open the local URL printed by Vite. Test customer sign-up/login, dashboard, wallet linking, rates, and exchange against a non-production Supabase project. Stop the server with `Ctrl+C`.

4. Run the production build:

   ```bash
   npm run build
   ```

   The exact build script in `package.json` is `vite build`; the Vite output directory is `dist`.

5. There is no `test`, `lint`, or `typecheck` script in `package.json`. Do not treat a missing test command as a passing test suite. The current production build succeeds, but Vite reports that the main JavaScript chunk is larger than 500 kB after minification.

## 4. Supabase Setup

### Create the project

1. Sign in to [Supabase](https://supabase.com/dashboard) and create a new project.
2. Choose a project name, a strong database password, and a region appropriate for your demo audience. Store the database password in a password manager; it is not a frontend environment variable.
3. Wait until the project reports that it is ready.

### Get the URL and browser-safe key

1. In the project dashboard, open **Connect** or **Project Settings → API Keys**. The dashboard labels can change; use the current API keys page.
2. Copy the project URL.
3. Copy the **publishable key** for browser use. Supabase's newer key begins with `sb_publishable_`. This project expects that value in the variable named `VITE_SUPABASE_ANON_KEY`; the variable name is historical, but a publishable key is accepted by the Supabase client.
4. A legacy `anon` / public key is also intended for client applications, but Supabase is deprecating the legacy `anon` and `service_role` keys by the end of 2026. Prefer the publishable key where available.
5. Never use a `service_role` or secret key in React, a `VITE_` variable, the Vercel frontend environment, or a committed file. Those keys bypass Row Level Security and are server-only.

### Configure Auth

1. Open **Authentication → Providers** and make sure the **Email** provider is enabled. OIMES uses email/password; the source contains no OAuth sign-in flow.
2. Decide whether to require email confirmation. The app handles the no-session case by telling a new registrant to confirm their email before signing in.
3. Open **Authentication → URL Configuration**. Set **Site URL** to the final Vercel production URL, for example `https://your-oimes-project.vercel.app`.
4. Add the production reset callback to allowed redirect URLs:

   ```text
   https://your-oimes-project.vercel.app/reset-password
   ```

5. Add your local development URL as an allowed redirect while developing, for example `http://localhost:5173/reset-password`. Keep the final host and scheme exact. `ForgotPasswordView.tsx` creates its redirect from the current browser origin and `/reset-password`.
6. Test delivery of confirmation and password-reset emails. Supabase's default email service is intended for limited development use; configure a trusted SMTP provider if recipients need reliable thesis-demo email delivery.

### Apply the schema and migrations

The repository has [`supabase/schema.sql`](supabase/schema.sql) and numbered SQL files directly inside `supabase/`. There is **no** `supabase/migrations/` directory, no `supabase/config.toml`, and no existing Supabase CLI workflow. For this project, the simplest supported setup is the Supabase Dashboard SQL Editor; the CLI is not required.

1. Before a public frontend is pointed at this project, open **SQL Editor → New query**.
2. Open `supabase/schema.sql` locally, copy its complete contents into the SQL Editor, and run it once on this new, empty project. This creates the initial enums, core tables, RLS policies, triggers, realtime publication entries, escrow rows, and initial exchange-rate seed rows.
3. Run each numbered SQL file as a separate query, in ascending order:

   ```text
   supabase/002_auto_profile_trigger.sql
   supabase/003_fix_rls_recursion.sql
   supabase/004_realtime_users.sql
   supabase/005_extend_wallets.sql
   supabase/006_transactions_and_escrow_rpc.sql
   supabase/007_activity_log_and_chat.sql
   supabase/008_rates_kyc_escrow_notifications.sql
   supabase/009_topup_kyc_docs.sql
   supabase/010_enforce_suspension.sql
   supabase/011_public_exchange_rates.sql
   supabase/012_reseed_exchange_rates.sql
   supabase/013_profile_insert_fallback.sql
   supabase/014_avatar_storage.sql
   supabase/015_address_fields.sql
   supabase/016_lock_down_admin_role.sql
   ```

   For each file: open a new SQL Editor query, paste that file's entire contents, run it, and confirm there is no error before continuing. These migrations build on the baseline and on one another. Migration 016 is especially important because it is the final database-side protection that prevents an ordinary user from assigning themselves an admin role.

4. Do **not** run `schema.sql` again over a database that already has these tables. It creates enum types and tables without `IF NOT EXISTS`; rerunning can fail or leave you unsure which migration completed. Several later migrations are also not safe to blindly repeat, including migration 008's policy creation. If any query partially fails, stop, inspect the database state and error, then resolve it before rerunning anything.
5. Do not deploy the public frontend before the complete migration sequence succeeds. In particular, do not make customer registration available before migration 016 has replaced the earlier signup role behavior.

### Verify database setup

1. In **Database → Tables** (or **Table Editor**), confirm these public tables exist:

   ```text
   users
   wallets
   escrow_wallets
   exchange_rates
   transactions
   audit_log
   admin_activity_log
   support_messages
   notifications
   ```

   Supabase Auth also uses its built-in `auth.users` table; it is not one of the public application tables above.

2. Confirm `exchange_rates` contains the 12 seeded directional pairs. Migration 012 includes a count query as a sanity check. The rates are demo seed data, not a live provider feed.
3. In **Database → Policies**, verify RLS is enabled and policies exist for the tables that the client accesses. The baseline schema enables RLS on its core tables; later migrations enable it on support messages, activity log, and notifications.
4. In **Database → Functions**, verify the application RPCs exist, particularly `create_exchange_transaction`, `approve_transaction`, `deny_transaction`, `simulate_wallet_topup`, and `admin_adjust_wallet_balance`.
5. Verify the `avatars` Storage bucket exists after migration 014. Its reads are public by design; uploads/updates/deletes are restricted by the migration's owner-folder policies.
6. Review effective table grants and function execute permissions as well as RLS policies. RLS does not replace PostgreSQL grants, and the SQL files do not include a comprehensive explicit grant/revoke review.

### Test Auth and exchange

1. After connecting the frontend, register a fresh customer with the app. If email confirmation is enabled, confirm the email before logging in.
2. Link at least two different wallet providers in the customer app. Newly linked wallets start at a zero balance.
3. Use the wallet screen's clearly labelled **Top up (demo)** control to fund a test wallet. The database function simulates a top-up, caps one request at $1,000, and does not call a mobile-money payment provider.
4. Submit an exchange between two distinct active wallets. Confirm a `pending` transaction is stored, the source wallet is debited into escrow, and the customer's transaction view updates.
5. Use an authorized admin account at `/admin` to approve or deny the request. Confirm transaction status, balances/escrow, notifications, and history update as expected.
6. Use a separate test Supabase project for these tests. Never run demo or performance transactions against a financial or otherwise important dataset.

## 5. Environment Variables

The frontend source reads exactly two required variables in [`src/lib/supabase.ts`](src/lib/supabase.ts):

| Variable | Required value |
|---|---|
| `VITE_SUPABASE_URL` | URL for this Supabase project. |
| `VITE_SUPABASE_ANON_KEY` | Supabase browser-safe publishable key (preferred) or legacy anon/public key. Despite the variable name, do not put a service-role/secret key here. |

Example only; replace both placeholders with values from your own Supabase project:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-key
```

### Local setup

1. From the project root, copy `.env.example` to `.env.local`.

   PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   macOS/Linux/Git Bash:

   ```bash
   cp .env.example .env.local
   ```

2. Set the two variables in `.env.local`. Vite reads `.env.local` automatically. Do not enter a database password, Supabase secret key, or `service_role` key there.
3. Restart `npm run dev` after changing variables, because Vite loads them when it starts.

### Vercel setup and exposure

1. In Vercel, open **Project → Settings → Environment Variables**.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using values for the production Supabase project. Enable them for Production and, if appropriate, Preview/Development.
3. Trigger a new deployment after changing an environment variable. Vite embeds `VITE_` values in browser assets at build time.
4. A Supabase publishable key and project URL are expected to be visible in a browser application. They are not authorization secrets; RLS and server-side authorization protect data. Passwords, database credentials, private keys, Supabase secret/service-role keys, and test-user passwords must never be in frontend variables, GitHub, or browser bundles.

There are also server-side environment names used only by the optional Node performance test: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_CUSTOMER_EMAIL`, `TEST_CUSTOMER_PASSWORD`, `TEST_ADMIN_EMAIL`, and `TEST_ADMIN_PASSWORD`. They are **not** required to build/deploy the frontend. The current `env.test` is tracked and contains test-account credentials; remove it from source control and reset those test-account passwords before using a public repository. Keep future local test credentials in an ignored file and never add them to Vercel's frontend environment.

## 6. Database Deployment

Deploy the database with the Supabase SQL Editor as described in Section 4. No Supabase CLI is required by the current repository.

The database is deployed from the actual baseline and ordered migrations, not from a newly invented schema:

| File(s) | Purpose verified in the SQL |
|---|---|
| `schema.sql` | Base enums/tables, baseline RLS, transaction audit/update triggers, realtime tables, escrow seed rows, and exchange-rate seed rows. |
| `002`–`004` | Auth profile trigger, admin RLS helper/policies, and realtime for users. |
| `005`–`006` | Wallet columns and transaction snapshot fields; initial admin approve/deny functions. |
| `007`–`008` | Admin activity log, support chat, rates administration, KYC protections, escrow/RPC functions, notifications, and admin balance adjustment. |
| `009`–`010` | Demo top-up and KYC reference field; enforce suspension for existing sessions and customer RPCs. |
| `011`–`013` | Public exchange-rate reads, idempotent rate/escrow seed insert, and customer profile insert fallback. |
| `014`–`016` | Avatar Storage bucket/policies, address fields, and database-enforced admin-role protection. |

The schema defines primary-key and unique constraints (which create their own indexes), but no explicit `CREATE INDEX` statements were found in the SQL files. Do not add indexes by guessing; review query performance separately if the demo grows. Migration 014 creates a public-read avatar bucket. Migration 009 stores a KYC document reference; it does not configure KYC-document file storage.

If the project later adopts Supabase CLI migrations, first add and validate a proper CLI configuration and migration layout in a separate development project. The existing flat `supabase/002_...sql` files are not in the CLI's conventional `supabase/migrations/` directory; do not assume `supabase db push` will apply them as-is.

## 7. GitHub Setup

### Secure the repository first

1. Confirm the repository `.gitignore` contains these entries before staging new work. They have been added during deployment preparation; they protect local environment files and Vite's build output:

   ```gitignore
   node_modules/
   dist/
   .vercel/
   .env
   .env.*
   !.env.example
   env.test
   ```

2. The current Git index tracks `.env` and `env.test`. Remove them from Git's index without deleting your local working copies:

   ```bash
   git rm --cached .env env.test
   ```

3. The test-account passwords in the tracked `env.test` must be considered exposed. Reset those test users' passwords in Supabase Auth. If these commits have ever been pushed, removing the latest files is not enough: old commits still contain the files. Before publishing, remove those paths from repository history (for example with `git-filter-repo`) or publish a new repository containing only the cleaned project, and rotate any credentials that were exposed. Back up the repository before rewriting history.
4. Check that the project-specific ignore rules work and that no env file remains tracked:

   ```bash
   git check-ignore .env.local env.test
   git ls-files -- .env .env.local env.test
   git status --short
   ```

   The second command should print no paths. `.env.example` may remain tracked because it contains placeholders only.

### Push to GitHub

1. The OIMES project already has a `.git` directory. If you are copying this project into a new folder without Git history, initialize Git once:

   ```bash
   git init
   ```

2. Create an empty GitHub repository. Do not upload `.env`, `env.test`, `node_modules`, or `dist`.
3. From the OIMES project root, stage the cleaned project, inspect the staged file list, and confirm no credentials are included:

   ```bash
   git add .
   git status --short
   git diff --cached --name-only
   ```

4. Commit and connect the GitHub repository. Replace the URL with your own repository URL:

   ```bash
   git commit -m "Prepare OIMES deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_NAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

   If `origin` already exists, inspect it with `git remote -v` and use `git remote set-url origin ...` instead of adding a second `origin`.

## 8. Vercel Deployment

1. Sign in to Vercel and choose **Add New → Project**.
2. Connect GitHub and authorize access to the cleaned OIMES repository.
3. Select the OIMES repository. Set **Root Directory** to the folder containing `package.json` (normally `./` when the GitHub repository is the OIMES project root).
4. Select or confirm the **Vite** framework preset. The detected commands should match the repository:

   | Setting | Value |
   |---|---|
   | Install command | `npm ci` (or Vercel's npm install detection using `package-lock.json`) |
   | Build command | `npm run build` |
   | Output directory | `dist` |

   These values come from `package.json` and `vite.config.ts`; there is no custom Vercel configuration in the project.

5. Add the two frontend variables from [Section 5](#5-environment-variables). Use the production Supabase project's URL and publishable key.
6. Choose **Deploy** and wait for the build to complete. If the build fails, open the Vercel deployment logs and compare the root directory, environment variables, Node version, and build command with this guide.
7. Open the generated `https://...vercel.app` URL. Copy that exact URL into Supabase Auth's Site URL and redirect allow list as described in Section 10.
8. Push later changes to the connected production branch (typically `main`) to trigger a new Vercel production deployment. Preview branches can produce preview deployments.

## 9. SPA Routing

The app uses `BrowserRouter` from `react-router` in [`src/main.tsx`](src/main.tsx). The actual top-level route declarations are:

| Path | Behavior |
|---|---|
| `/admin/*` | Admin login/dashboard shell. |
| `/reset-password` | Password-reset landing page. |
| `/*` | Customer app shell. |

Dashboard, wallets, exchange, transactions/history, and profile/settings are selected inside the customer app; they are not declared as routes such as `/dashboard`, `/exchange`, or `/transactions`. Do not tell demo users that those tab names are standalone URLs.

Because this is a `BrowserRouter` SPA, the web host must return `index.html` for app routes on a direct browser refresh. Deploy and test `/admin` and `/reset-password` by pasting each URL directly into a new tab. If Vercel returns a 404 rather than serving the SPA entry point, add a Vercel rewrite configuration such as the following at the repository root, then redeploy:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This file is not currently present; do not add it unless direct-route testing shows it is needed.

## 10. Supabase Authentication Configuration

1. In Supabase **Authentication → URL Configuration**, set **Site URL** to your exact production Vercel URL, for example:

   ```text
   https://your-oimes-project.vercel.app
   ```

2. Add these allowed redirects, replacing the example host with your real Vercel hostname:

   ```text
   https://your-oimes-project.vercel.app/reset-password
   http://localhost:5173/reset-password
   ```

   The local URL is only for development. Add Vercel preview URLs only if you intend to test Auth emails from preview deployments; limit patterns to the domains you actually use.

3. Enable Email sign-in and set the email confirmation behavior deliberately. With confirmation enabled, a new user must click the email link before normal login.
4. Test password reset from the production hostname. OIMES constructs the callback from `window.location.origin` plus `/reset-password`, so the domain must match the redirect allow list.
5. OAuth provider settings are not needed for the current source; no OAuth sign-in call exists.
6. Keep the admin account invite-only. Create a customer normally, then promote only the intended account using the SQL editor after migration 016 has run. Replace the placeholder with the exact account email and confirm the affected row before running:

   ```sql
   update public.users
   set role = 'super_admin'
   where email = 'YOUR_ADMIN_EMAIL';
   ```

   There is no admin self-signup page. The final migration forces ordinary signup to `customer` and protects the role column.

## 11. Production Security Checklist

Use this checklist before any public demo. “Verified” describes code/SQL behavior found in this repository, not an independent penetration test.

| Check | Finding / action |
|---|---|
| RLS enabled | The baseline enables RLS on `users`, `wallets`, `transactions`, `audit_log`, `exchange_rates`, and `escrow_wallets`; migrations enable it on `admin_activity_log`, `support_messages`, and `notifications`. Verify all nine in the deployed database. |
| RLS policies | Owner/admin policies exist, but a policy name alone does not prove least privilege. Review table grants plus policy operations and `USING`/`WITH CHECK` expressions. |
| RPC authorization | `approve_transaction`, `deny_transaction`, and `admin_adjust_wallet_balance` check `is_admin()`. `create_exchange_transaction` checks active status, wallet ownership/status, and available source balance. Test with normal, admin, suspended, and unauthenticated sessions. |
| Browser key | `VITE_SUPABASE_ANON_KEY` is sent to browser code. Use only the publishable key or legacy anon/public key. Never place a secret/service-role key there. |
| Secrets in source control | **Needs attention before production:** `.env` and `env.test` are tracked. The latter contains test-account credentials. Untrack them, ignore future env files, reset the test passwords, and clean pushed history before publishing. |
| Admin signup | There is no admin signup UI. Migration 016 hardcodes new profiles to `customer` and protects role changes for regular sessions. Do not omit this final migration. |
| Authentication checks | Customer and admin login use Supabase email/password Auth, and admin UI checks the profile role. Database functions also check the admin role for privileged transaction decisions. |
| Database permissions | **Needs attention before production:** the SQL files do not provide a comprehensive explicit `GRANT`/`REVOKE` review. Verify effective table privileges and function `EXECUTE` permissions in Supabase in addition to RLS. |
| Wallet mutation | **Needs attention before production:** the baseline `wallet_owner_policy` has no explicit `FOR` clause, so it applies to all operations, and wallet owner updates are not column-limited. Review effective policies/grants to ensure a customer cannot directly change balance, verification, or status outside authorized RPCs. |
| Transaction insertion | **Needs attention before production:** `transactions_owner_insert` checks that `user_id` equals the caller, but does not constrain all inserted fields to values calculated by the RPC. The UI uses the RPC, but direct API calls must also be safe. Restrict direct inserts if not needed. |
| Exchange validation | **Needs attention before production:** the RPC checks ownership, active wallet status, and source balance, but accepts rate, destination amount, spread, and fee from the client. It does not visibly re-read/validate the rate pair or independently enforce every client-side rule (for example, daily limit and distinct platforms). Move authoritative calculations/limits into trusted database logic before real funds are involved. |
| Input validation | Forms do client-side validation; RPCs contain some server-side checks, but the exchange validation gaps above remain. Validate every security-critical amount and state transition in PostgreSQL. |
| Duplicate submission protection | The transaction reference has a unique constraint, and approval/denial serialize on the transaction row and reject non-pending states. No client request idempotency key was found; repeated submissions can still create multiple requests. |
| Audit log | **Needs attention before production:** `audit_log_insert_only` allows inserts with `WITH CHECK (true)`. Review whether authenticated clients need direct insert access and prevent forged audit rows; the transaction trigger also writes audit records. |
| Avatar Storage | The avatar bucket is public-read by design, with owner-folder write policies. Do not store private identity documents in this bucket. |
| Error handling | The UI reports many Auth/RPC errors, but verify production logs and user-visible failures without leaking sensitive details. |
| Real payment provider | **Needs attention before production:** top-up is explicitly simulated; there is no real Sahal/EVC/Zaad payment adapter or external settlement integration in this repo. Do not represent balances as real funds. |
| OTP | **Needs attention before production:** the exchange OTP is generated and checked in the browser, not delivered or verified by a trusted server/SMS provider. It is demo UI only, not transaction authentication. |
| Financial suitability | **Needs attention before production:** this is a thesis/demo ledger. Complete an independent security and financial review before processing real funds or personal identity documents. |

## 12. OIMES Demo Preparation

Use a dedicated Supabase project and clearly labelled test accounts/data. Never put demo credentials in this guide, GitHub, or a public Vercel variable. Replace the placeholders below with accounts you create yourself.

1. Register one **customer test account** in the deployed app. Confirm the email if enabled. Record its email/password in a private password manager, not in project files.
2. Register a separate account for the **admin demo**. After applying all migrations, run the role-promotion SQL in Section 10 for that account. Sign in at `/admin` to verify it has admin access. Do not use your everyday personal account if a separate test identity is practical.
3. As the customer, link two different sample providers. OIMES supports `Sahal`, `eDahab`, `EVC Plus`, and `Zaad`; use test phone numbers only.
4. New wallets start with a zero balance. Use **Top up (demo)** for test funds. The RPC caps each top-up request at $1,000; this is not a payment or proof of funds.
5. The database seeds 12 exchange-rate pairs. Check that rates load, then submit a small exchange between two different providers. The OTP shown in the flow is simulated locally; no SMS is sent.
6. As admin, open `/admin`, confirm the transaction appears, then approve or deny it. Verify the resulting customer balance, transaction status/history, notifications, and admin activity log in the app and Supabase Table Editor.
7. Refresh the customer session and verify the database-backed state remains. Sign out, confirm protected views return to the login shell, and test customer and admin sessions separately.
8. For presentation, prepare a short repeatable dataset: one customer, one admin, two active wallets, demo balances, one completed exchange, and one pending transaction for the admin approval workflow. Reset/reseed only in a disposable project, not through ad hoc deletion in a shared project.
9. Do not depend on invented sample credentials or hardcoded mock balances. The app includes seeded/local mock state, but after a real user signs in it hydrates the user's Supabase-backed data.

## 13. Final Testing Checklist

- [ ] Website opens from the public Vercel URL.
- [ ] Customer registration works (if enabled) and email confirmation behaves as configured.
- [ ] Customer login and logout work.
- [ ] Dashboard loads using the signed-in user's data.
- [ ] Wallet linking works for two different providers.
- [ ] Demo top-up updates the wallet in Supabase and is clearly treated as simulated.
- [ ] Exchange request creates a pending transaction.
- [ ] Transaction history reflects the new row.
- [ ] Admin login at `/admin` works only for the promoted admin account.
- [ ] Admin approval/denial updates the transaction and expected balances.
- [ ] Realtime changes appear for the customer/admin sessions.
- [ ] Password reset email opens `/reset-password` on the correct domain.
- [ ] Supabase tables, RLS policies, functions, and avatar bucket are present.
- [ ] Unauthorized and suspended-user operations are rejected by the database.
- [ ] Direct refresh of `/admin` and `/reset-password` does not return a host-level 404.
- [ ] No browser console errors or failed Supabase requests remain in normal flows.
- [ ] No `.env`, `env.test`, test passwords, database passwords, secret keys, or service-role keys are in GitHub or built assets.
- [ ] Test from another browser/device using only the public site URL.

The repository has no automated test script. `npm run build` is a required build check, not a substitute for these manual Auth/database/security tests.

## 14. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Vercel build failed | Check the build log, Root Directory, and the exact `npm run build` command. Run `npm ci` and `npm run build` locally with a supported Node version. Confirm Vercel output is `dist`. |
| `npm install` failed | Use Node 22 LTS and npm 9+; run `npm ci` from the directory containing `package.json`. If the lockfile was deliberately changed, regenerate and commit the matching `package-lock.json` rather than deleting it during deployment. |
| Supabase environment variable is undefined | Confirm both exact `VITE_` names are set in `.env.local` locally or Vercel Project Settings. Restart local Vite or redeploy Vercel after edits. Check the Vercel project root points at the right package. |
| Supabase connection failed | Verify the project is active, the URL and publishable/anon key belong to the same project, and the browser network request reaches the expected Supabase URL. Never troubleshoot by substituting a service-role key. |
| Authentication redirect failed | Set Supabase Site URL to the deployed origin and allow the exact `/reset-password` production URL. Confirm the email link is not expired and email delivery is working. |
| React route gives 404 | Test the actual declared routes `/admin/...` and `/reset-password`. If Vercel does not serve `index.html` for them, add the optional SPA rewrite in Section 9. The tab views are not `/dashboard`, `/exchange`, or `/transactions` URLs. |
| Database permission denied | Check the SQL Editor migration results, table grants, function grants, and whether a required migration was skipped. RLS cannot grant privileges missing from PostgreSQL grants. |
| RLS policy violation | Verify the user has a Supabase Auth session, the profile row exists, and the operation matches the deployed policy. Confirm migration 013/016 for signup/profile fallback and later wallet/notification tables were applied. Use the Supabase logs to identify the exact table/operation. |
| RPC function permission denied/not found | Confirm all relevant migrations ran in order and check the function name/parameter names. Inspect PostgreSQL function execute grants and the caller's Auth role; do not make the function public or switch to a secret key as a workaround. |
| CORS/API-related error | The browser client uses Supabase's own API, not a custom Node API. Verify the project URL and browser origin. Check Supabase Auth redirect configuration and Supabase logs. Do not add permissive CORS settings to Vercel without identifying the failing endpoint. |
| Rates are empty | Confirm migrations 008, 011, and 012 completed and `exchange_rates` contains the seeded 12 pairs. Review the table's RLS and grants. |
| Customer signup returns an account/profile error | Confirm Email provider is enabled, the auth trigger from 002 and final profile/role migrations are installed, confirmation behavior is understood, and `public.users` has the expected columns. |

## 15. Rollback / Redeployment

1. For frontend changes, push a reviewed commit to the connected GitHub production branch. Vercel builds a new deployment automatically and retains prior deployments for inspection/rollback from the Vercel dashboard.
2. If a deployment fails, leave the current production deployment in place while diagnosing the failed build. Correct the source/environment setting, then push or redeploy.
3. Changing Vercel environment variables requires a new build/deployment for Vite because `VITE_` values are compiled into frontend assets.
4. Database migrations are not automatically run by Vercel. Apply and verify SQL changes separately in Supabase, preferably in a staging project first. Do not try to roll back by rerunning `schema.sql`; the repository does not provide down-migrations or an automated migration history table.
5. Before a database change, export/back up data using an appropriate process for your risk level. Supabase Free does not include downloadable automatic backups according to the current plan information; do not treat the free demo as a reliable backup system.

## 16. Free Tier Notes

The intended setup is a Vercel Hobby frontend and Supabase Free backend/database for a small thesis demo. Free tier limits and terms can change; review the linked service dashboards before presenting.

| Service | Current considerations |
|---|---|
| Supabase Free | Current pricing lists 500 MB database size, 50,000 monthly active Auth users, 1 GB Storage, 5 GB egress plus 5 GB cached egress, and up to two active projects. Free projects may pause after about one week of inactivity and must be restored in the dashboard. The free tier does not include downloadable database backups and has limited support. |
| Vercel Hobby | Free and intended for personal/non-commercial use, with monthly quotas (for example CDN requests and transfer). Exceeding a quota can pause/limit the affected feature until its reset. Review current terms to ensure they allow the university's intended use. |

Neither plan is unlimited or guaranteed to stay free forever. A paid plan or alternative hosting may be needed for persistent uptime, reliable production email, backups, higher database/storage/traffic usage, business/commercial use, support, or stronger operational guarantees. Do not promise that a thesis demo will always be available: wake/check the Supabase project before the defense.

## 17. Final Deployment Summary

```text
GitHub
  ↓ push
Vercel (Hobby)
  ↓ serves static build from dist/
React + TypeScript + Vite
  ↓ Supabase JS client using the public publishable key
Supabase (Free)
  ├── Authentication
  ├── PostgreSQL
  ├── API
  ├── RLS
  ├── Storage (public-read avatars)
  └── SQL/RPC Functions
```

## Deployment Blockers

Resolve these before making the repository public or describing OIMES as a production financial service:

1. **Tracked credentials:** `.env` and `env.test` are in the current Git index. `env.test` contains test login credentials. Untrack both, update `.gitignore`, reset those test passwords, and remove exposed file contents from any remote Git history before publishing. The guide intentionally does not reproduce any values.
2. **Weak database write boundaries:** current RLS policy definitions allow broader direct wallet operations and owner transaction inserts than the intended RPC-only workflow. Audit effective table grants/policies and restrict direct operations.
3. **Client-controlled financial parameters:** the exchange RPC accepts the rate, destination amount, spread, and fee from its caller. It must calculate or verify those values server-side and enforce the applicable limits before real funds are in scope.
4. **Audit-log insert policy:** the baseline permits inserts under a `WITH CHECK (true)` policy. Restrict direct user inserts if the audit log is intended to be trustworthy.
5. **Demo-only verification and funding:** OTP is a browser-generated code and wallet funding is simulated. There is no real mobile-money provider integration or server-delivered OTP.
6. **Deployment is manual for the database:** no Supabase CLI config/migrations directory or automated database deploy pipeline exists. Apply the SQL sequence carefully and retain a tested backup/restore plan appropriate to the data.

## Project-Specific Findings

1. `package.json` has `dev` (`vite`) and `build` (`vite build`) scripts only; there is no test, lint, or typecheck script. A local production build succeeded, with a warning for a minified JavaScript chunk over 500 kB.
2. The lockfile is npm `package-lock.json` version 3. `pnpm-workspace.yaml` exists, but there is no `pnpm-lock.yaml`; the Vercel instructions use npm.
3. Vite outputs to `dist`; `vite.config.ts` sets React and Tailwind plugins and has no custom base path or server rewrites.
4. Frontend configuration uses exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. No other frontend environment variables are referenced.
5. The repository has `.env`, `.env.example`, and `env.test`. The `.env.example` values are placeholders. During deployment preparation, `.env` and `env.test` were removed from the Git index, and `.gitignore` was updated to ignore local env files/build artifacts while allowing `.env.example`. Verify the Git status before committing these changes.
6. The SQL layout is `supabase/schema.sql` plus flat migrations `002` through `016`; there is no `001`, `supabase/migrations/`, `config.toml`, `vercel.json`, or edge-function directory.
7. Customer Auth uses Supabase email/password sign-up/sign-in, confirmation-aware UI, logout, password update, and password reset. The admin portal uses a separate Supabase client/session, has no signup screen, and checks the stored user role.
8. Top-level routes are `/admin/*`, `/reset-password`, and the customer catch-all. Customer tabs are component state, not URL routes. The app uses `BrowserRouter`.
9. The database has nine public application tables after migrations. No explicit custom `CREATE INDEX` statements were found; primary/unique constraints provide their own indexes.
10. The exchange-rate seed is static demo data. Wallet top-up and exchange OTP are simulated; no live mobile-money gateway integration is present.
11. Migration 016 is required to lock user role assignment to admins and make normal sign-up create only customer accounts. Admin promotion is a manual Supabase SQL operation.
12. The existing `README.md` is a short generic quick-start for installing packages and running Vite; it does not document Supabase or production deployment.
13. The optional `oimes-performance-test (2).mjs` instructions expect a `.env.test` file and Node's `--env-file=.env.test`, but the checked-in file is named `env.test` (no leading dot) and contains credentials. Do not use or rename that file before removing its tracked credentials; create a fresh ignored test file with the documented name and new test-account passwords instead.
