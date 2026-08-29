# Lobe

Multi-shop piercing studio operations for the Philippines. This build includes a polished owner dashboard, a three-step public booking-request flow, server-side request validation, core scheduling/money/state rules, and a Supabase tenant schema with RLS.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/app` for studio operations or `http://localhost:3000/shop/aura-collective/book` for the guest flow.

## Data setup

Copy `.env.example` to `.env.local`, provide Supabase and Resend credentials, then apply `supabase/migrations/202608280001_initial.sql` with the Supabase CLI. The current UI uses representative demonstration data when those services are not configured.

All monetary snapshots are integer centavos, completed sales are immutable, customer tokens are designed to be stored only as hashes, and report business dates must be derived in `Asia/Manila`. Platform administrators provision tenants using service-role endpoints and are excluded from normal health/consent access policies.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
