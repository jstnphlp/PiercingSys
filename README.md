# Piercing Corner studio system

Private, single-studio software for Piercing Corner in Parañaque. Customers book at `/book`; invited staff work at `/app` after authenticating through `/login`. `/` redirects to the public booking page.

The application intentionally has no tenant, subscription, workspace-switching, or “powered by” concepts. Exact address, contact details, hours, services, prices, and staff are empty until the studio configures them.

## Local setup

Requirements: Node.js 20+, npm, a Supabase project (or Supabase CLI for local development), and optionally a Resend account.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Fill the Supabase values in `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are server-only and must never be exposed with a `NEXT_PUBLIC_` prefix.

Without Supabase credentials, `/book` provides a clearly labeled, non-submitting preview of the customer flow. `/app` always requires an authenticated, active staff account and reads live Supabase records.

## Database reset

The initial migration at `supabase/migrations/202608280001_initial.sql` is the clean, undeployed single-studio schema. For a local Supabase stack:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

For a hosted project, link the CLI and push the migration:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The schema stores PHP amounts as integer centavos and evaluates business dates in `Asia/Manila`. PostgreSQL exclusion constraints block piercer and station overlaps. Completed sales and their line items/payments are immutable; refunds and voids are appended to `sale_adjustments`.

## Prisma

Prisma 7 is initialized against the same Postgres database. Supabase migrations remain the source of truth for schema changes; Prisma is used for typed database access, introspection, Studio, and the local owner seed. Do not use `prisma migrate` or `prisma db push` against this project.

If `prisma db push` reports `must be owner of index idx_users_created_at_desc` (or another index in the `auth` schema), stop the command. Prisma is attempting to reconcile Supabase-managed Auth metadata, not an application migration; accepting the data-loss prompt cannot grant ownership. Apply application schema changes through the checked-in Supabase migrations instead:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Then refresh Prisma's read-only view of the database and regenerate the client:

```bash
npm run prisma:pull
npm run prisma:generate
```

Never paste a database URL containing a password into source control, logs, or support requests. Rotate the database password if one has been exposed.

After starting or resetting local Supabase, refresh the Prisma schema and client when the Supabase migration changes:

```bash
npm run prisma:pull
npm run prisma:generate
```

Create the local email/password owner from the `PRISMA_SEED_EMAIL` and `PRISMA_SEED_PASSWORD` values in `.env.local`:

```bash
npm run prisma:seed
```

The seed is idempotent: rerunning it refreshes that local account's password without creating another staff profile. It refuses to replace a different existing owner and blocks non-local Supabase URLs unless `PRISMA_SEED_ALLOW_REMOTE=true` is explicitly set. Keep that flag off for normal development. Prisma tooling prefers `DIRECT_URL` and falls back to `DATABASE_URL`, while user creation still goes through the server-only Supabase Admin Auth API rather than writing directly to `auth.users`.

### Vercel database configuration

Runtime page and API requests use the Supabase HTTPS API through `@supabase/supabase-js`; they do not open PostgreSQL connections through `DATABASE_URL`. Configure the Supabase URL, anon key, and server-only service-role key in Vercel for application traffic.

If Prisma is later used in a serverless runtime, set `DATABASE_URL` to the Supabase transaction pooler on port `6543` with `?pgbouncer=true`. Set `DIRECT_URL` to the direct Postgres endpoint on port `5432` for Prisma inspection and seed operations. The current Prisma CLI configuration automatically prefers `DIRECT_URL`, and local development can use the same direct URL for both variables.

The public studio/service/piercer catalog is cached for 60 seconds and is invalidated immediately by settings, service, assignment, invitation, and staff-status mutations. Authenticated dashboard data remains uncached so RLS-protected operational records are always current.

To inspect the local database with Prisma Studio, run `npm run prisma:studio`. Prisma introspects the Supabase-managed `auth` schema only because the public staff tables reference it; application code should continue managing authentication through Supabase Auth.

## Bootstrap the first owner

No person’s name or owner email is embedded in the repository.

For local development, use the Prisma seed above. For a hosted project, use Supabase's invitation flow:

1. In Supabase Dashboard → Authentication → Users, invite the first owner’s email.
2. In the SQL editor, run the following once, replacing the email:

```sql
select public.bootstrap_first_owner('owner@example.com');
```

3. The invited user sets a password using the Supabase email and signs in at `/login`.

The bootstrap function is unavailable to anonymous and authenticated API roles and refuses to run after any staff profile exists. After bootstrap, the owner can invite managers and piercers from Settings → Team. Managers can operate the studio but cannot invite staff, change roles, or transfer ownership.

## Required pre-launch configuration

After Supabase is connected, live public booking remains in “being set up” mode until all three are present:

- at least one business-hours day;
- at least one active service;
- at least one active staff member assigned to a service.

Before opening the booking link, also add weekly availability for each assigned piercer. Optional but recommended items are the exact address, studio email and phone, stations, cancellation policy, booking lead time/horizon, and Resend delivery credentials.

Services created in Settings can be assigned to active staff. Availability must overlap studio hours. Openings are calculated from studio hours, service duration, qualified staff, weekly availability, closures, confirmed appointments, lead time, booking horizon, and the booking interval.

## Authentication and permissions

Supabase Auth uses SSR cookies refreshed by `src/proxy.ts`. Data access checks use `auth.getUser()` and PostgreSQL RLS remains the final enforcement boundary.

- Owner: full access, staff invitations, and roles.
- Manager: appointments, customers, services, schedules, sales, settings, and reports; no ownership or role changes.
- Piercer: assigned schedule plus relevant customer and consent records; no sales, reports, or administration.

Public booking creation, photo uploads, invitations, and email dispatch use the service role only inside server modules and route handlers. The anonymous database role has no direct table policies.

## Google OAuth

Google is visually prepared but disabled by default and grants no access while disabled.

1. Create Google OAuth credentials and add the Supabase callback URL shown under Authentication → Providers → Google.
2. Enable Google in Supabase and add the client ID and secret.
3. Add `${NEXT_PUBLIC_APP_URL}/auth/callback` to the allowed redirect URLs.
4. Set `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` and rebuild the app.

A Google-authenticated user still needs an active `staff_profiles` row; OAuth alone does not grant studio access.

## Resend email

Set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL`. Confirmation, reschedule, and cancellation messages are recorded in `notification_deliveries` before dispatch. When Resend is absent, deliveries are marked `skipped` with a configuration error so staff can see what happened; booking creation still succeeds.

## Public and staff interfaces

- `GET /api/public/availability?serviceId=…&date=YYYY-MM-DD&piercerId=…`
- `POST /api/public/bookings` (`multipart/form-data`, optional JPG/PNG up to 5 MB)
- `PATCH /api/appointments/:id`
- `POST /api/customers`
- `POST /api/sales`
- `PATCH /api/settings`
- `POST /api/services`
- `POST /api/availability`
- `POST /api/closures`
- `POST /api/stations`
- `POST /api/staff/invitations`
- `PATCH /api/staff/:id` (owner-only role, access, and ownership changes)
- `POST /api/sales/:id/adjustments` (append-only refunds and voids)
- `GET /api/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD`

Validation errors use `{ error: { code, message, fields? } }`. A slot lost to a simultaneous booking returns HTTP `409` with `SLOT_UNAVAILABLE`.

## Verification

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Unit tests cover booking transitions, balances/refunds, Manila boundaries, overlap helpers, slot duration and interval, lead time, horizon, closures, existing appointments, and piercer filters. `supabase/tests/database.test.sql` covers the singleton schema, RLS policies, immutable sales, adjustments, and overlap constraints; run it against a reset local Supabase database.
