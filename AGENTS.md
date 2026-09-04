<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Piercing Corner studio system

## Product and scope

- This is private, single-studio software for Piercing Corner in Parañaque. Keep the product free of tenant, subscription, workspace-switching, and “powered by” concepts.
- The public customer flow lives at `/book`; authenticated staff use `/app`; `/` redirects to `/book`.
- Do not invent or seed real studio contact details, hours, services, prices, staff, or owner identity. The studio configures these after deployment.

## Architecture

- This is a TypeScript, Next.js App Router project using React 19, Tailwind CSS 4, shadcn, Base UI, Supabase, Zod, and Vitest.
- Prefer Server Components. Add `"use client"` only where browser state, effects, or event handlers genuinely require it. Keep server-only modules and credentials out of the client graph.
- Use the existing Supabase helpers in `src/lib/supabase/`. Staff-facing reads and mutations must use the cookie-backed server client so RLS remains effective. Use the service-role admin client only inside server modules or route handlers where privileged work is explicitly required (for example public booking or email side effects).
- Protect staff routes and mutations with `getStaffSession()` plus the appropriate `hasRole()` check. RLS is the final authorization boundary; never treat a UI restriction as authorization.
- Validate every route-handler input with Zod. Return the established error shape: `{ error: { code, message, fields? } }`; use `422` for validation failures and preserve `409 SLOT_UNAVAILABLE` for booking races.

## Data and business rules

- Supabase migrations in `supabase/migrations/` are the schema source of truth. Add a new, timestamped migration for database changes; do not edit applied migrations.
- Do **not** run `prisma migrate` or `prisma db push`. Prisma is only for typed access, introspection, Studio, and the local owner seed. After a migration change, run `npm run prisma:pull` and `npm run prisma:generate` when a local database is available.
- Treat sales and their line items/payments as immutable. Model refunds and voids as appended `sale_adjustments`, never updates or deletes.
- Store money as integer PHP centavos; never use floating point for persisted amounts or financial calculations.
- Treat business dates, availability, lead time, and booking horizon in `Asia/Manila`. Use the domain helpers in `src/lib/domain.ts` instead of duplicating slot, overlap, or date-boundary logic.
- Never expose credentials in client code, source control, test output, or logs. `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` are server-only and must not receive a `NEXT_PUBLIC_` prefix.

## Caching and side effects

- Public catalog data is cached under the `public-catalog` tag. Revalidate that tag after mutations that affect public settings, services, service/staff assignments, availability, closures, or active staff status.
- Staff operational data is intentionally uncached. Do not add caching that could serve stale RLS-protected records.
- Record notification delivery attempts before sending email. Missing Resend configuration should be visible as a skipped delivery, without causing a successful booking to fail.

## UI and code style

- Reuse the project’s established Tailwind tokens and components under `src/components/ui/`; preserve the warm Piercing Corner visual language rather than introducing a generic dashboard theme.
- Follow the existing TypeScript and ESLint conventions: explicit domain types, `@/` imports, trailing commas, and small focused modules. Avoid `any`; narrow untrusted Supabase rows deliberately.
- Add or update focused tests beside the behavior being changed. Cover authorization, validation, time boundaries, availability conflicts, cache behavior, and financial invariants when relevant.

## Verification

Run the smallest relevant check while iterating, then run the applicable final checks:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Database-level changes additionally need the local Supabase test suite after a reset:

```bash
npx supabase db reset
npx supabase test db
```

Do not overwrite unrelated work already present in the worktree.
