# PiercingSys Master UAT and Quality Plan

## Document control

| Field | Value |
|---|---|
| Purpose | End-to-end user acceptance, regression, reliability, security, and release-quality validation |
| Baseline date | 2026-08-31 (Asia/Manila) |
| Source baseline | Local working tree based on commit `570c46a`; the tree contains uncommitted product work, so record a new commit SHA for every formal cycle |
| Application | Piercing Corner / PiercingSys |
| Stack | Next.js 16.3.3, React 19.2.8, TypeScript, Supabase/Postgres, Prisma, Resend |
| UAT owner | Assign before Cycle 1 |
| Business approver | Assign before release |
| Current state | Baseline analysis complete; full formal UAT execution not yet complete |

This is the single working checklist for testing the current program. Update the **Result**, **Evidence**, and **Defect** columns during every run. A baseline `PASS` below means that the stated check passed in the local environment on 2026-08-31; it does not certify the whole feature for production.

## 1. Current quality assessment

### What is already working

- The repository installs and the application compiles into a production build.
- All 23 application unit/API tests and all 47 pgTAP database tests pass.
- ESLint and TypeScript checks pass.
- The public site correctly stays in a setup state until the minimum catalog/staff assignment exists.
- A public customer can choose a qualified service, find a valid slot, upload a photo, and receive a confirmed reference.
- The same booking appears in the staff calendar and client history.
- A completed appointment creates a draft sale; payment, completion, refund, reporting, and CSV export work in the tested happy path.
- Missing Resend configuration is handled as a visible `skipped` notification instead of failing the booking.
- The booking photo metadata and private storage object were created in the tested flow.
- Unauthenticated `/app` access redirects to login, invalid login displays an error, and protected API probes reject unauthenticated callers.
- The tested public and staff pages rendered at desktop and 390×844 mobile sizes without browser console warnings or errors.

### What is not yet release-ready

- A future appointment can be marked completed or no-show. The tested future completion immediately created a sale and counted a procedure in reports.
- Consent storage exists, but there is no customer consent capture, guardian workflow, staff consent view, or consent management UI/API.
- Services can be created and assigned, but existing service details, price, duration, active state, and order cannot be maintained through the product.
- Stations can be added but not renamed, deactivated, or removed through the product.
- The owner can transfer ownership from a select control without a confirmation/re-authentication step.
- Generic settings updates can bypass the stricter business-hours endpoint validation.
- Public booking has idempotency but no application-level abuse throttling or CAPTCHA.
- Refund/void accounting semantics and the unused `voided` sale status require a business decision.
- Lists use fixed limits without pagination, and there is no automated browser/end-to-end suite.
- Database advisors report uncovered foreign-key indexes, duplicated permissive RLS policies, and `btree_gist` in the public schema. These require measured remediation, not blind index/policy deletion.
- Several operational failure paths have no retry workflow, notably photo upload failures and skipped/failed notifications.

## 2. Verified baseline gates

| ID | Check | Command or method | Expected | Baseline result | Evidence / notes |
|---|---|---|---|---|---|
| QG-001 | Application tests | `npm test` | All tests pass | PASS | 23 tests, 2 files |
| QG-002 | Lint | `npm run lint` | No errors | PASS | ESLint completed successfully |
| QG-003 | Type safety | `npm run typecheck` | No errors | PASS | Route types and `tsc --noEmit` passed |
| QG-004 | Production build | `npm run build` | Build and route collection succeed | PASS | Next.js production build passed |
| QG-005 | Database tests | `supabase test db --local` | All pgTAP tests pass | PASS | 47 tests passed |
| QG-006 | Database lint | `supabase db lint --local --schema public --level warning --fail-on none` | No schema errors | PASS | No schema errors reported |
| QG-007 | Database advisors | `supabase db advisors --local --type all --level info --fail-on none` | Findings reviewed and triaged | PASS WITH FINDINGS | See ISSUE-006 to ISSUE-008 |
| QG-008 | Browser console | Public and staff happy paths | No errors/warnings | PASS | No console errors or warnings in tested flows |
| QG-009 | Unauthenticated protection | Browser and direct API probes | Protected routes reject or redirect | PASS | `/app` redirected; sampled APIs returned 401/403 |
| QG-010 | Responsive smoke | 390×844 public booking and settings | Usable without clipping/blocking | PASS | Visual smoke only; full device matrix remains NOT RUN |

Run QG-001 through QG-010 for every release candidate. QG-007 passes only when every advisor item has an accepted disposition and no new unreviewed warning appears.

## 3. Product and coverage map

| Area | User-facing capability | Main routes/APIs | Primary records |
|---|---|---|---|
| Public booking | Catalog, multi-service selection, staff qualification, availability, customer details, photo, confirmation | `/book`, `/api/public/availability`, `/api/public/bookings` | services, service_staff, customers, bookings, booking_services, booking_photos |
| Authentication | Email/password, prepared Google OAuth, callback, sign-out, protected workspace | `/login`, `/auth/callback`, `/app` | auth.users, staff_profiles |
| Operations overview | Daily appointments, revenue, readiness, operational shortcuts | `/app` | bookings, sales, settings |
| Calendar | Browse, create, reschedule, assign staff/station, status changes | `/app?view=calendar`, `/api/appointments*` | bookings, booking_services, customers, notification_deliveries |
| Clients | Search, client profile, booking history | `/app?view=clients`, `/api/customers*` | customers, bookings, booking_services |
| Sales | Walk-ins, draft sales, payments, completion, adjustments | `/app?view=sales`, `/api/sales*` | sales, sale_items, payments, sale_adjustments |
| Reports | Date summaries, services/staff/payment breakdown, CSV | `/app?view=reports`, `/api/reports/export` | reporting RPC over bookings/sales/payments/adjustments |
| Studio settings | Profile, hours, services, assignments, team, schedules, closures, stations, delivery log | `/app?view=settings`, settings/service/staff/schedule APIs | studio_settings, services, staff_profiles, service_staff, availability, closures, stations, notification_deliveries |
| Consent | Database and RLS foundation only | No current product route | consent_forms |
| Audit | Ownership/invitation events currently used | No current audit viewer | audit_events |

## 4. Roles and authorization acceptance matrix

| Capability | Public | Piercer | Manager | Owner |
|---|---:|---:|---:|---:|
| View public booking and create booking | Yes | Yes | Yes | Yes |
| View overview/calendar/clients | No | Yes, scoped by policy | Yes | Yes |
| Create/reschedule/update appointments | No | Yes within permitted scope | Yes | Yes |
| View/create/adjust sales | No | No | Yes | Yes |
| View/export reports | No | No | Yes | Yes |
| Edit studio/settings/schedules | No | No | Yes | Yes |
| Invite/deactivate staff and change piercer/manager roles | No | No | Limited by server policy | Yes |
| Transfer ownership | No | No | No | Yes |

The UI is not the security boundary. Every denied cell must also be tested by direct API call and, where appropriate, by a direct Supabase client call to prove RLS/function enforcement.

## 5. Test environment and data

### Required environments

| Environment | Purpose | Required configuration |
|---|---|---|
| Local | Developer smoke, database tests, rapid defect reproduction | Local Supabase, seeded owner, test-only email/storage |
| UAT/Staging | Formal business acceptance and integrations | Production-like schema, HTTPS, private storage, Resend test domain, Google OAuth test client, non-production data |
| Production smoke | Post-deploy read-only/low-impact checks | Approved smoke accounts and one clearly labeled test transaction |

Never run destructive, concurrency, upload-limit, or abuse tests against production. Never use real government IDs or sensitive customer photos in local/UAT.

### Canonical UAT data pack

Create fresh, uniquely prefixed data for each cycle, for example `UAT-C2-*`:

- Owner, manager, active piercer, inactive piercer, invited-but-not-accepted staff, and auth user with no staff profile.
- Fixed-price service; price-range service; inactive service; 30-, 60-, and 90-minute services; services with zero, one, and multiple qualified piercers.
- Two stations, with one planned inactive station once lifecycle support exists.
- Regular hours, overnight-invalid input, split/closed days, recurring availability, one-off exception, all-day closure, and partial closure.
- New customer, returning customer, duplicate email with different casing, minor/guardian test profile, and customer with 10+ bookings.
- Confirmed, rescheduled, completed, cancelled, and no-show appointments.
- Draft, partially paid, completed, refunded, and voided sales after accounting rules are approved.
- Valid JPG/PNG/WebP, invalid file type, zero-byte file, and files immediately below/above the size limit.

The 2026-08-31 local exploratory run created test data: Dennis was assigned to Lobe, Monday 10:00–11:00 availability was added, customer `uat-20260831@example.test` booked reference `PC-F2322E66`, and sale `SALE-6B45CDE6` was completed then refunded by ₱100. Treat it as disposable UAT data, not business data.

## 6. Execution rules

### Result values

- **PASS** — actual result matches the approved expected result with evidence.
- **FAIL** — behavior differs from an approved requirement; create a defect.
- **BLOCKED** — environment, missing feature, or dependency prevents execution.
- **NEEDS DECISION** — expected business behavior is not yet approved.
- **NOT RUN** — not executed in this cycle.
- **N/A** — approved as not applicable, with approver and reason.

### Priority and severity

| Level | Test priority | Defect severity |
|---|---|---|
| P0 / Critical | Release survival and irreversible loss/security | Outage, unauthorized sensitive access, corrupt/lost data, unrecoverable financial error |
| P1 / High | Core booking/operations/accounting | Core journey blocked or materially incorrect with no safe workaround |
| P2 / Medium | Important management/quality path | Incorrect or inefficient behavior with a workaround |
| P3 / Low | Polish and low-impact edge case | Cosmetic, copy, or minor convenience issue |

For each manual test, record tester, timestamp, environment/build SHA, account/role, input data IDs, screenshots or response body, actual result, result, and defect ID. Do not record secrets or real identification photos.

## 7. Master UAT test suite

### A. Installation, configuration, and readiness

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| ENV-001 | P0 | Start from documented prerequisites and install dependencies | Setup is reproducible with no undocumented manual patch | NOT RUN | |
| ENV-002 | P0 | Copy environment template, configure local Supabase, migrate, seed | App starts; owner can authenticate; no secret reaches client bundle/log | NOT RUN | |
| ENV-003 | P0 | Apply all migrations to an empty database | Schema, functions, RLS, constraints, bucket, and seed state succeed once | NOT RUN | |
| ENV-004 | P1 | Re-run migrations/seed according to docs | Idempotent operations do not duplicate or overwrite a different owner | NOT RUN | |
| ENV-005 | P1 | Compare README claims to an empty migrated database | Default hours/services/prices match approved launch requirements | FAIL | ISSUE-005 |
| ENV-006 | P0 | Remove/invalid Supabase public/server variables one at a time | Safe setup/error state; no secret or stack trace disclosure | NOT RUN | |
| ENV-007 | P1 | Run with Resend absent | Booking succeeds and delivery is visibly `skipped` | PASS | Tested public booking |
| ENV-008 | P1 | Run with Google OAuth disabled, then enabled in staging | Disabled UI is truthful; enabled callback authenticates only allowed staff | NOT RUN | |
| ENV-009 | P1 | Complete minimum launch setup, then remove each prerequisite | Readiness accurately switches between setup and live states | PARTIAL PASS | Catalog/staff assignment checked; no-availability case remains ISSUE-016 |
| ENV-010 | P1 | Deploy production build behind HTTPS | Fonts/assets/routes load; canonical metadata and redirects use correct production URL | NOT RUN | |
| ENV-011 | P1 | Request `/shop/anything/book` | Permanent redirect lands on `/book` without loop | NOT RUN | |
| ENV-012 | P1 | Confirm database backup, restore, rollback, and migration procedure | Timed restore succeeds and documented RPO/RTO are accepted | NOT RUN | |

### B. Public catalog and booking

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| PB-001 | P1 | Open `/book` before minimum setup | Clear coming-soon/setup state; no unusable form | PASS | Browser verified |
| PB-002 | P1 | Open `/book` when live | Active services only, correct category/name/duration/price, studio copy and timezone | PASS | Happy path sampled |
| PB-003 | P2 | Search by service/category using case and whitespace variants | Correct stable filtering; useful no-results state | NOT RUN | |
| PB-004 | P1 | Select/deselect one and multiple services | Totals, duration, price/range, and selected state remain accurate | PARTIAL PASS | Single service verified |
| PB-005 | P1 | Select services with no common qualified piercer | Selection is prevented or explains incompatibility before slot submission | NOT RUN | |
| PB-006 | P1 | Choose Any Piercer and each qualified preferred piercer | Only valid staff/slots are returned; preference is honored | NOT RUN | |
| PB-007 | P1 | Query current/future weeks around booking lead time and horizon | No too-soon/out-of-horizon slots; Manila dates are correct | PASS | Lead-time behavior observed |
| PB-008 | P1 | Test start/end of hours, recurring availability, exceptions, closures | Only slots fully contained in every rule appear | NOT RUN | |
| PB-009 | P1 | Test service duration combinations and non-aligned boundaries | Slot stepping and total duration are correct; no truncated procedure | NOT RUN | |
| PB-010 | P0 | Hold same piercer/slot in two browsers and submit simultaneously | Exactly one booking succeeds; loser gets actionable conflict and no duplicate side effects | NOT RUN | |
| PB-011 | P0 | Compete for same station with different piercers | Constraint prevents overlap and returns a safe conflict response | NOT RUN | |
| PB-012 | P1 | Refresh/back/submit twice with the same idempotency key | One booking/reference/customer-side effect only | DATABASE PASS | Browser/API retry still NOT RUN |
| PB-013 | P1 | Submit all required fields empty or malformed | Per-field 422 feedback; focus/announcement is accessible | PARTIAL PASS | Empty API request returned 422 |
| PB-014 | P1 | Test names at min/max, Unicode, apostrophes, hyphens | Valid names accepted and stored/rendered safely | NOT RUN | |
| PB-015 | P1 | Test email case/spacing and existing email | Normalized customer is reused without losing correct history | NOT RUN | |
| PB-016 | P1 | Test valid and invalid local/international phone strings | Approved phone formats accepted; invalid values clearly rejected | NEEDS DECISION | Current validation is permissive |
| PB-017 | P1 | Do not check minimum-age confirmation | Submission blocked and policy text remains visible | NOT RUN | |
| PB-018 | P1 | Execute approved minor/guardian journey | Guardian identity/consent rules are enforceable and auditable | BLOCKED | ISSUE-002 / ISSUE-025 |
| PB-019 | P2 | Submit notes empty, long, and containing HTML/script text | Length enforced; text stored/rendered escaped, never executed | NOT RUN | |
| PB-020 | P1 | Upload valid JPG, PNG, and WebP below limit | Booking succeeds; private object and metadata are retrievable only by authorized staff | PARTIAL PASS | One valid image verified |
| PB-021 | P1 | Upload invalid MIME/extension, empty, corrupt, and oversized files | Client/server reject safely; booking policy (continue or fail) matches approved rule | NOT RUN | |
| PB-022 | P1 | Force storage upload failure after booking creation | Booking remains consistent; failure is recorded, visible, and retryable | FAIL / GAP | ISSUE-012 |
| PB-023 | P1 | Force notification provider failure and retry request | Booking succeeds once; one delivery record per idempotency key; failure actionable | NOT RUN | ISSUE-013 |
| PB-024 | P1 | Complete happy path | Reference and details match calendar/client/storage/delivery records | PASS | `PC-F2322E66` |
| PB-025 | P1 | Attempt scripted high-volume submissions and slot scraping in UAT | Rate limits/abuse controls protect service without harming normal clients | BLOCKED / GAP | ISSUE-021 |
| PB-026 | P2 | Navigate entire form by keyboard and screen reader | Logical focus, announced errors, labeled controls, no keyboard trap | NOT RUN | |
| PB-027 | P2 | Refresh confirmation and use browser back | No accidental rebooking; state and privacy behavior are predictable | NOT RUN | |
| PB-028 | P2 | Use slow/failed network during slot lookup and submit | Clear busy/retry state; no stuck control or duplicate transaction | NOT RUN | ISSUE-022 |

### C. Authentication and session handling

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| AUTH-001 | P0 | Open `/app` signed out | Redirect to `/login`; no protected payload leaks | PASS | 307 redirect observed |
| AUTH-002 | P1 | Sign in with valid active owner credentials | Secure session established; correct owner workspace | PASS | Browser verified |
| AUTH-003 | P1 | Submit invalid email/password and empty fields | Generic accessible error; no account enumeration | PASS | Invalid credentials sampled |
| AUTH-004 | P1 | Sign in as active manager and piercer | Correct role/name/navigation and data scope | NOT RUN | |
| AUTH-005 | P0 | Sign in as inactive staff, removed staff, or auth user without profile | Access denied and existing session revoked/blocked | NOT RUN | |
| AUTH-006 | P1 | Sign out, then revisit cached/back pages | Session cleared; protected content not recoverable | NOT RUN | |
| AUTH-007 | P1 | Expire/revoke token during navigation and mutation | Redirect/re-auth prompt; mutation is not partially duplicated | NOT RUN | |
| AUTH-008 | P1 | Tamper callback with missing/invalid/replayed `code` | Safe login error; no open redirect or session confusion | NOT RUN | ISSUE-023 |
| AUTH-009 | P1 | Use Google OAuth in staging | Correct allow-list/profile checks and safe redirect | NOT RUN | |
| AUTH-010 | P1 | Test invitation acceptance, expired/reused invite, and email mismatch | Only intended user gains correct role once | NOT RUN | |
| AUTH-011 | P2 | Run repeated failed logins | Platform rate limits work and user receives safe feedback | NOT RUN | |
| AUTH-012 | P1 | Inspect cookies and browser storage on HTTPS | Auth cookies have appropriate Secure/HttpOnly/SameSite behavior | NOT RUN | |

### D. Role-based access control

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| RBAC-001 | P0 | As public/anonymous, call every non-public API method | 401/403; no mutation/data disclosure | PARTIAL PASS | Sampled appointments, reports, settings |
| RBAC-002 | P0 | As piercer, alter URL to sales/reports/settings views | Redirect/default view; no protected data in HTML/RSC payload | NOT RUN | |
| RBAC-003 | P0 | As piercer, directly call sales/report/settings/staff APIs | Consistent denial with no mutation | NOT RUN | |
| RBAC-004 | P0 | As piercer, read/update another piercer's bookings via API/client | Only policy-approved scope is visible/mutable | NOT RUN | |
| RBAC-005 | P1 | As manager, use sales/reports/settings/calendar functions | Approved management operations succeed | NOT RUN | |
| RBAC-006 | P0 | As manager, attempt ownership transfer/owner role changes | Denied at API/function/RLS layer | NOT RUN | |
| RBAC-007 | P0 | As manager, attempt to promote staff to owner | Denied; owner count unchanged | NOT RUN | |
| RBAC-008 | P0 | As owner, run every management operation | Approved operations succeed and are auditable | PARTIAL PASS | Main happy path sampled |
| RBAC-009 | P0 | Attempt to deactivate/demote the last owner | Prevented transactionally | DATABASE PASS | UI/API concurrency still NOT RUN |
| RBAC-010 | P0 | Attempt ownership transfer to inactive/nonexistent/non-staff user | Rejected; original owner retained | NOT RUN | |
| RBAC-011 | P0 | Direct Supabase select/insert/update/delete per role on every table | RLS matches the approved matrix | NOT RUN | pgTAP covers selected rules only |
| RBAC-012 | P0 | Directly call SECURITY DEFINER functions with forged IDs/roles | Function checks prevent privilege escalation and cross-tenant/data access | NOT RUN | |
| RBAC-013 | P1 | Inspect service-role-only tables/bucket from anonymous/authenticated clients | Public booking keys and private photos remain inaccessible | NOT RUN | |
| RBAC-014 | P1 | Compare API denial status and body across all schedule endpoints | Consistent 401 unauthenticated, 403 unauthorized, safe message | FAIL / INCONSISTENT | ISSUE-019 |
| RBAC-015 | P1 | Make two owners transfer/deactivate concurrently | Invariants hold; exactly one approved ownership result | NOT RUN | |

### E. Overview and navigation

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| OV-001 | P1 | Open overview with empty day | Zero states and setup guidance are accurate and useful | PASS | Browser observed |
| OV-002 | P1 | Create today's bookings and sales in each status | Counts/revenue include only approved records and Manila day | NOT RUN | |
| OV-003 | P1 | Compare piercer vs manager/owner overview | Piercer sees only allowed metrics/data | NOT RUN | |
| OV-004 | P2 | Use all sidebar/topbar links and direct query strings | Correct view active; invalid/forbidden view safely falls back | PARTIAL PASS | Core navigation sampled |
| OV-005 | P1 | Cross midnight/DST-neutral Manila boundary and server UTC boundary | Today calculations remain Asia/Manila consistent | NOT RUN | |
| OV-006 | P2 | Load page with one backend query failing | Clear state without exposing raw database internals | NOT RUN | |

### F. Calendar and appointment operations

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| CAL-001 | P1 | Navigate weeks/days and return to Today | Dates, ordering, time labels, and Manila timezone correct | PARTIAL PASS | Week with created booking verified |
| CAL-002 | P1 | Filter by staff/status and clear filters | Correct appointments only; empty state useful | NOT RUN | |
| CAL-003 | P1 | Create appointment for new client | Customer and booking created once with qualified staff/valid station | NOT RUN | |
| CAL-004 | P1 | Create appointment for existing client | Existing customer reused; history preserved | NOT RUN | |
| CAL-005 | P1 | Create multi-service appointment | Order, total duration, price snapshot/range, and staff qualification correct | NOT RUN | |
| CAL-006 | P1 | Attempt booking outside hours/availability or inside closure | Rejected with actionable message | NOT RUN | |
| CAL-007 | P0 | Create concurrent overlapping piercer/station bookings | Exclusion constraints prevent both overlaps atomically | DATABASE PASS | Browser/API concurrency NOT RUN |
| CAL-008 | P1 | Reschedule to valid date/time/staff/station | One updated booking; snapshots/history/notifications match rule | NOT RUN | |
| CAL-009 | P1 | Reschedule to conflicting/closed/too-past slot | Rejected without changing original booking | NOT RUN | |
| CAL-010 | P1 | Cancel confirmed booking with reason | Status/reason/timestamp/reporting/notification behavior correct | NOT RUN | |
| CAL-011 | P1 | Mark today's/past booking no-show | Status and reports follow approved definition | NOT RUN | |
| CAL-012 | P1 | Complete eligible appointment | One draft sale created with exact service snapshot and booking link | PARTIAL PASS | Sale creation verified on a future booking |
| CAL-013 | P0 | Attempt to complete or no-show a future appointment | Action blocked unless an explicit privileged override rule exists | FAIL | ISSUE-001 |
| CAL-014 | P0 | Double-click/retry completion concurrently | Exactly one linked sale; no duplicate line/payment/delivery | NOT RUN | |
| CAL-015 | P1 | Attempt invalid status transitions (completed→confirmed, cancelled→completed) | State machine rejects invalid transition | NOT RUN | |
| CAL-016 | P1 | Change staff after selecting services | Only staff qualified for all services accepted | NOT RUN | |
| CAL-017 | P1 | Use no station and each active station | Optional/required business rule applied consistently | NEEDS DECISION | |
| CAL-018 | P2 | Inspect long names/notes/many services in dialog and grid | Readable, escaped, no layout break | NOT RUN | |
| CAL-019 | P1 | Piercer changes appointments inside/outside own scope | Approved scope enforced in UI/API/RLS | NOT RUN | |
| CAL-020 | P1 | Verify requested/rejected statuses | Every status has an approved creator, transition, and UI meaning or is removed | NEEDS DECISION | ISSUE-024 |

### G. Client records

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| CLI-001 | P1 | Search clients by name/email/phone, case and whitespace variants | Correct, fast, stable results | PARTIAL PASS | Exact test customer found |
| CLI-002 | P1 | Open client profile/history | Contact and all allowed bookings/services/statuses shown correctly | PASS | Public booking history verified |
| CLI-003 | P1 | Create manual client with valid and invalid fields | Normalization, uniqueness/reuse, and 422 feedback match public behavior | API PARTIAL | Unit coverage; UI creation absent |
| CLI-004 | P1 | Edit name/email/phone/notes | Authorized update is validated/audited; history preserved | BLOCKED / GAP | ISSUE-017 |
| CLI-005 | P1 | Resolve duplicate customers safely | Approved merge/dedup workflow preserves bookings/sales/consents | BLOCKED / GAP | ISSUE-017 |
| CLI-006 | P1 | View photo and consent as each role | Private data follows least privilege and access is auditable | BLOCKED / PARTIAL | Consent UI absent |
| CLI-007 | P2 | Load/search beyond 500 customers and a client with 200+ bookings | Pagination returns complete stable data without silent truncation | FAIL / GAP | ISSUE-015 |
| CLI-008 | P1 | Render malicious strings in names/notes | Escaped as text; no XSS in list, dialog, CSV, or email | NOT RUN | |
| CLI-009 | P1 | Test customer data export/correction/deletion requirements | Approved privacy policy can be fulfilled without orphan/corruption | NEEDS DECISION | |

### H. Sales and payment operations

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| SALE-001 | P1 | Create fixed-price walk-in sale | Draft/completed totals and line snapshot correct | NOT RUN | |
| SALE-002 | P1 | Create range-price service sale and resolve price at min/mid/max | Valid resolved price required and constrained to approved rule | NOT RUN | |
| SALE-003 | P1 | Create multiple service/jewelry/other lines | Subtotal/order/descriptions correct in UI/API/report | PARTIAL / UI GAP | ISSUE-014 |
| SALE-004 | P1 | Add cash/card/GCash/other split payments | Method totals, paid, balance, and completion eligibility correct | NOT RUN | |
| SALE-005 | P1 | Create unpaid/partial draft | Remains draft; outstanding balance visible and actionable | NOT RUN | |
| SALE-006 | P0 | Attempt completion while underpaid | Atomically rejected; sale remains draft | DATABASE PASS | UI/API boundary NOT RUN |
| SALE-007 | P1 | Complete exactly paid sale | Status/timestamp/completed-by and report totals correct | PASS | `SALE-6B45CDE6` |
| SALE-008 | P1 | Test approved overpayment/change policy | Either blocked or change recorded; accounting remains balanced | NEEDS DECISION | |
| SALE-009 | P0 | Retry/double-click payment and completion concurrently | No duplicate payment or completion | NOT RUN | |
| SALE-010 | P0 | Edit completed sale lines/payments directly/API/DB client | Immutable; only append-only adjustment path allowed | DATABASE PASS | API/RLS adversarial test NOT RUN |
| SALE-011 | P1 | Add refund with reason/actor | Net decreases once; audit data and reports reconcile | PASS | ₱100 refund verified |
| SALE-012 | P1 | Add void adjustment | Approved full/partial rule and sale status are consistent | NEEDS DECISION | ISSUE-018 |
| SALE-013 | P0 | Refund/void zero, negative, above net, and concurrently above net | Invalid amounts rejected atomically | NOT RUN | |
| SALE-014 | P1 | Create adjustment without meaningful reason | Validation enforces approved reason policy | NOT RUN | |
| SALE-015 | P1 | Complete appointment-linked sale | Booking/service link retained; no double counting | PARTIAL PASS | One flow verified |
| SALE-016 | P1 | Cancel/no-show appointment after sale link or adjust sale after booking change | Approved cross-record rule prevents inconsistent state | NEEDS DECISION | |
| SALE-017 | P2 | Load more than 300 sales and long adjustment history | Paginated, searchable, complete data | FAIL / GAP | ISSUE-015 |
| SALE-018 | P1 | Compare currency rounding/large values/decimals | PHP integer/rounding policy consistently enforced | NOT RUN | |

### I. Reports and CSV export

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| REP-001 | P1 | Run empty date range | Zero state and zero totals, no error | NOT RUN | |
| REP-002 | P1 | Run range containing completed sale and refund | Gross, adjustments, net, paid, transaction/procedure counts reconcile | PASS | Gross 500, adjustment 100, net 400, paid 500 |
| REP-003 | P1 | Compare service, staff, and payment-method breakdowns to source records | Every dimension follows documented recognition rules | PARTIAL PASS | One cash/service/staff path sampled |
| REP-004 | P1 | Compare Manila boundary dates with UTC timestamps | Records appear on correct business date | NOT RUN | |
| REP-005 | P1 | Export CSV and open in spreadsheet/text parser | Correct headers/encoding/escaping/order/totals, no formula injection | PARTIAL PASS | Happy-path CSV content verified; injection NOT RUN |
| REP-006 | P0 | Export as public/piercer | Denied; no financial disclosure | PARTIAL PASS | Anonymous denied; piercer NOT RUN |
| REP-007 | P1 | Use malformed, inverted, missing, huge, and future ranges | 422/actionable cap; server cost bounded | FAIL / GAP | ISSUE-009 |
| REP-008 | P1 | Verify cancelled/no-show/draft/partial/completed/refunded/voided inclusion | Counts and money match approved definitions | NEEDS DECISION | ISSUE-018 and ISSUE-024 |
| REP-009 | P1 | Complete a future appointment | Future procedure must not distort today's report | FAIL | ISSUE-001 |
| REP-010 | P1 | Reconcile report to SQL ledger for a seeded month | Gross − adjustments = net; payments and balances explain differences | NOT RUN | |
| REP-011 | P2 | Run range over production-like volume | Response/export meets agreed threshold without timeout/memory spike | NOT RUN | |

### J. Studio profile, hours, and services

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| SET-001 | P1 | Edit studio name/address/contact/min age/lead/horizon | Valid values persist, revalidate public catalog, and use Manila semantics | NOT RUN | |
| SET-002 | P1 | Submit boundary/invalid settings values | 422 field errors; previous valid settings retained | NOT RUN | |
| SET-003 | P0 | Send invalid `businessHours` through generic settings PATCH | Same strict open/close/day validation as dedicated endpoint | FAIL / GAP | ISSUE-010 |
| SET-004 | P1 | Add/edit/delete weekday hours with valid/invalid ranges | Correct schedule persists; close must be after open; duplicate day rule approved | NOT RUN | |
| SET-005 | P1 | Change hours with existing bookings outside new hours | Warning/approved grandfathering rule prevents unnoticed conflict | NEEDS DECISION | |
| SET-006 | P1 | Create fixed-price service | Valid category/name/duration/price/order/active state displayed publicly | API PASS | Unit/API covered; manual NOT RUN |
| SET-007 | P1 | Create price-range service with valid/invalid bounds | Validation and public/staff formatting correct | NOT RUN | |
| SET-008 | P1 | Edit existing service name/category/duration/price/order | Safely updates future catalog without rewriting historical snapshots | BLOCKED / GAP | ISSUE-003 |
| SET-009 | P1 | Deactivate/reactivate service | Removed from new booking; history remains readable | BLOCKED / GAP | ISSUE-003 |
| SET-010 | P1 | Assign/unassign one/multiple piercers | Public staff/slot qualification updates after cache invalidation | PARTIAL PASS | One assignment activated booking |
| SET-011 | P1 | Unassign/deactivate piercer with future bookings | Warning/approved reassignment rule prevents orphaned operations | NEEDS DECISION | |
| SET-012 | P2 | Manage 100+ services | Search/filter/pagination/edit remain usable | FAIL / GAP | ISSUE-003 / ISSUE-015 |

### K. Staff, ownership, availability, closures, and stations

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| STF-001 | P1 | Invite valid new piercer/manager | One auth invitation/profile with correct role and audit event | NOT RUN | |
| STF-002 | P1 | Invite invalid/duplicate/existing email and provider-rate-limited email | Safe actionable response; no partial duplicate | UNIT PASS | Manual integration NOT RUN |
| STF-003 | P1 | Change display name, piercer/manager role, and active state | Approved fields available, validated, persisted, and audited | PARTIAL / UI GAP | Display-name edit not exposed; ISSUE-017 |
| STF-004 | P0 | Deactivate staff with active session and future bookings | Access revoked; bookings handled by approved warning/reassignment rule | NOT RUN | |
| STF-005 | P0 | Transfer ownership | Explicit summary, confirmation/re-auth, atomic role swap, audit event | FAIL / RISK | ISSUE-004 |
| STF-006 | P0 | Cancel ownership UI action/change selection accidentally | No ownership change without explicit final confirmation | FAIL / RISK | ISSUE-004 |
| STF-007 | P1 | Add recurring availability with valid day/time | Slots appear only for assigned services and allowed hours | PASS | Monday 10:00–11:00 sampled |
| STF-008 | P1 | Add overlapping/duplicate/invalid availability | Constraint/validation rejects safely | NOT RUN | |
| STF-009 | P1 | Partially edit start/end causing invalid range | Validated consistently before DB; safe 422 | NOT RUN | ISSUE-019 |
| STF-010 | P1 | Add/edit/delete one-off availability exception | Slot generation updates correctly | NOT RUN | |
| STF-011 | P1 | Add/edit/delete all-day and timed closure | Slots/appointment creation honor closure | NOT RUN | |
| STF-012 | P1 | Add studio-wide vs staff-specific closure | Only intended resources blocked | NOT RUN | |
| STF-013 | P1 | Add station with valid/duplicate/blank name | Correct validation/uniqueness and active display | NOT RUN | |
| STF-014 | P1 | Rename/deactivate/reactivate/delete station | Future choices update while history remains | BLOCKED / GAP | ISSUE-011 |
| STF-015 | P0 | Deactivate/delete station with future bookings | Approved warning/reassignment prevents orphan/conflict | BLOCKED | ISSUE-011 |
| STF-016 | P1 | Mutate schedules as piercer/public | Denied consistently | NOT RUN | |
| STF-017 | P2 | Inspect notification-delivery list beyond 25 rows | Pagination/filter/retry gives complete operational visibility | FAIL / GAP | ISSUE-013 / ISSUE-015 |

### L. Consent, photos, notifications, and audit

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| OPS-001 | P0 | Customer reads/accepts current consent text before procedure | Versioned consent, timestamp, signer, booking, answers, and signature stored | BLOCKED / GAP | ISSUE-002 |
| OPS-002 | P0 | Minor uses approved guardian flow | Guardian identity/relationship/signature and age policy recorded | BLOCKED / GAP | ISSUE-002 / ISSUE-025 |
| OPS-003 | P1 | Staff views/prints consent for allowed booking | Least-privilege access and immutable historical text | BLOCKED / GAP | ISSUE-002 |
| OPS-004 | P0 | Attempt to alter finalized consent or access another customer's photo | Denied and auditable | BLOCKED / PARTIAL | Database foundation only |
| OPS-005 | P1 | View valid booking photo as owner/manager/piercer/public | Only authorized roles get short-lived private access | NOT RUN | Storage object creation verified only |
| OPS-006 | P1 | Delete/cancel customer/booking with photo | Approved retention and orphan cleanup policy executes | NEEDS DECISION | |
| OPS-007 | P1 | Send booking confirmation/reschedule/cancel messages | Correct recipient/template/data, escaped content, one delivery per event | NOT RUN | Initial missing-provider skip only |
| OPS-008 | P1 | Retry skipped/failed notification | Operator can retry safely; delivery attempts/status visible | BLOCKED / GAP | ISSUE-013 |
| OPS-009 | P1 | Audit settings, bookings, sales, staff, consent, and ownership mutations | Required who/what/when/before-after events exist and are viewable/exportable | FAIL / GAP | ISSUE-020 |
| OPS-010 | P1 | Redact logs/errors while retaining correlation IDs | No secrets/PII/raw SQL details; failures traceable | NOT RUN | |

### M. API contract and database integrity

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| API-001 | P1 | Exercise every method with valid payload | Stable JSON/CSV schema and documented success status | NOT RUN | Unit coverage is partial |
| API-002 | P1 | Exercise malformed JSON/form-data, missing fields, wrong types, extra fields | Consistent 400/422 safe structured errors | PARTIAL PASS | Public validation sampled |
| API-003 | P1 | Exercise unauthenticated vs unauthorized caller on every protected method | Consistent 401 vs 403 policy | FAIL / INCONSISTENT | ISSUE-019 |
| API-004 | P1 | Force database/provider internal error | Stable 5xx response; no raw schema/SQL/provider secret | NOT RUN | ISSUE-019 |
| API-005 | P1 | Use nonexistent/malformed IDs and records outside caller scope | Safe 404/403 without enumeration | NOT RUN | |
| API-006 | P0 | Race create/reschedule/complete/refund/ownership operations | Transactional invariants hold under concurrency/retry | NOT RUN | |
| API-007 | P1 | Validate cache immediately after service/staff/settings changes | Public catalog becomes correct within approved bound | PARTIAL PASS | Assignment revalidation observed |
| API-008 | P1 | Run `EXPLAIN (ANALYZE, BUFFERS)` on representative large-data queries | No unbounded scans/hot-path regressions; indexes justified by workload | NOT RUN | Advisor findings ISSUE-006/007 |
| API-009 | P0 | Test all FK deletes/updates and orphan possibilities | Referential actions match retention rules; no orphaned finance/consent/photo data | NOT RUN | |
| API-010 | P0 | Verify booking overlap exclusions around inclusive/exclusive boundaries | Back-to-back allowed; true overlaps rejected for staff/station | DATABASE PASS | pgTAP covered core behavior |
| API-011 | P0 | Verify completed-sale immutability and append-only adjustments | Direct modification denied; net cannot become invalid | DATABASE PASS | Add concurrency cases |
| API-012 | P1 | Check migration down/forward-fix strategy with production-size copy | Deploy/rollback plan preserves data and lock time is acceptable | NOT RUN | |

### N. Non-functional and production-readiness tests

| ID | Pri | Scenario and key steps | Expected result | Baseline | Evidence / Defect |
|---|---:|---|---|---|---|
| NF-001 | P1 | Test latest Chrome, Safari, Firefox, Edge | Core journeys and layout work consistently | NOT RUN | Chrome-compatible local smoke only |
| NF-002 | P1 | Test 320, 390, 768, 1024, 1440 px and zoom 200% | No blocked action, overlap, hidden focus, or horizontal page overflow | PARTIAL PASS | 390×844 sampled |
| NF-003 | P1 | Run keyboard-only and screen-reader checks | WCAG 2.2 AA core paths; labels/errors/status/focus correct | NOT RUN | |
| NF-004 | P2 | Run automated accessibility scan on every route/dialog/state | No critical/serious violations; false positives dispositioned | NOT RUN | |
| NF-005 | P1 | Measure public page and slot API under agreed normal/p95 load | Agreed LCP/INP/API p95 and error rate met | NOT RUN | |
| NF-006 | P1 | Load test simultaneous slot search and booking race | Stable service and transactional uniqueness under agreed concurrency | NOT RUN | |
| NF-007 | P1 | Seed >500 customers, >1,000 bookings, >300 sales | No silent truncation; paging/search/report performance acceptable | FAIL BY DESIGN GAP | ISSUE-015 |
| NF-008 | P0 | Run dependency/code/secret/security scan | No unaccepted critical/high vulnerability or committed secret | NOT RUN | |
| NF-009 | P1 | Verify HTTPS, CSP, HSTS, frame, MIME, referrer, and permissions policy | Approved security headers present and compatible | NOT RUN / GAP | ISSUE-026 |
| NF-010 | P0 | Test SQL injection, stored/reflected XSS, IDOR, CSRF, upload abuse | No exploit; server validation/RLS enforce boundary | NOT RUN | |
| NF-011 | P1 | Test service outages: DB, Auth, Storage, Resend, slow network | Graceful, non-duplicating recovery with operator-visible state | NOT RUN | |
| NF-012 | P1 | Review observability for failed booking/payment/email/photo and DB errors | Alert/correlation/runbook exists; PII is redacted | NOT RUN | ISSUE-012/013/020 |
| NF-013 | P0 | Restore latest backup into isolated environment and reconcile records | Restore meets approved RPO/RTO and integrity checks | NOT RUN | |
| NF-014 | P1 | Verify retention, access, export, correction, deletion policy | Philippine privacy/business requirements approved and executable | NEEDS DECISION | |
| NF-015 | P1 | Test Manila midnight, leap day, month/year boundaries | Calendar, reports, lead/horizon, CSV consistent | NOT RUN | |
| NF-016 | P2 | Test offline/slow 3G/rapid navigation/browser refresh | Loading/error/retry states remain understandable and safe | NOT RUN | ISSUE-022 |
| NF-017 | P1 | Check production logs/client source maps/server responses | No service key, auth token, full sensitive notes, or photo URL leaked | NOT RUN | |
| NF-018 | P1 | Test deployment during active reads/bookings | No incompatible schema window or dropped transaction | NOT RUN | |

## 8. Initial defect and change register

These are findings from code/database review and exploratory execution. Confirm the business requirement, reproduce in a clean UAT build, then convert each accepted finding into the team's issue tracker.

| ID | Sev | Finding and evidence | Recommended acceptance/change |
|---|---:|---|---|
| ISSUE-001 | P1 | A Sep 7 future appointment was completed on Aug 31. It created a draft sale and immediately counted a procedure in the report. Future no-show is exposed by the same action group. | Block completion/no-show before the appointment start in UI and transactional server function, or require a logged privileged override. Add boundary/concurrency tests. |
| ISSUE-002 | P1 | `consent_forms` and RLS exist, but no public/staff route captures, signs, versions, or displays consent. Current UI text is informational only. | Define legal/business consent requirements; implement versioned adult/guardian capture, staff access, immutable signed record, retention, and tests before launch if consent is mandatory. |
| ISSUE-003 | P1 | Existing service details, duration, pricing, order, and active state cannot be edited through UI/API; only staff assignments can be patched. | Add validated service lifecycle controls and API. Preserve booking/sale snapshots and warn on future-booking impact. |
| ISSUE-004 | P1 | Ownership transfers immediately when the owner changes a select value; there is no explicit confirmation/re-authentication. | Add review dialog with target, consequences, explicit confirmation (prefer re-auth), pending/error state, and audit evidence. |
| ISSUE-005 | P1 | README says exact services/prices/hours remain empty until configured, while migrations seed 32 services and 10:00–20:00 hours. | Approve one source of truth. Remove placeholder business facts from production migrations or document and visibly require their confirmation before launch. |
| ISSUE-006 | P2 | Supabase advisor found seven uncovered FKs: `audit_events.actor_id`, `booking_photos.booking_id`, `payments.received_by`, `public_booking_keys.booking_id`, `sale_adjustments.actor_id`, `sale_items.booking_service_id`, `sales.completed_by`. | Measure delete/join workloads, add justified indexes (possibly partial/composite), re-run advisor and query plans. Do not add blindly. |
| ISSUE-007 | P2 | Advisor reports multiple permissive SELECT/UPDATE policies on several staff-visible tables. Every policy is evaluated and may add overhead/ambiguity. | Consolidate equivalent role policies where behavior stays identical; use `(select auth.uid())`/helper patterns; prove with RLS regression and EXPLAIN. |
| ISSUE-008 | P2 | Advisor reports `btree_gist` installed in the public schema. | Evaluate moving extension to a dedicated schema without breaking exclusion operators/migrations; test a clean install and upgrade. |
| ISSUE-009 | P2 | Report export validates date syntax but not `to >= from` and has no maximum range. Inverted ranges can silently return empty data; huge ranges are unbounded. | Return 422 for inverted ranges and enforce an approved maximum or asynchronous export strategy. |
| ISSUE-010 | P1 | Generic `/api/settings` can accept `businessHours` JSON without the dedicated endpoint's `close > open` shape validation; the DB has no equivalent JSON constraint. | Remove this field from generic PATCH or reuse one canonical strict schema and add DB/function validation where feasible. |
| ISSUE-011 | P2 | Stations can only be created; rename/deactivate/delete and future-booking impact handling are absent. | Implement safe lifecycle management, favor inactive over destructive delete, and preserve historical references. |
| ISSUE-012 | P2 | Booking photo upload occurs after booking commit. Failure does not fail booking, but no durable failure/retry event is visible. | Approve the decoupling rule; persist upload attempt/failure, expose an operations retry/re-upload path, alert on repeated failure, and clean orphan objects. |
| ISSUE-013 | P2 | Failed/skipped notification rows are visible but there is no retry/detail workflow; the list is capped at 25. | Add delivery detail, pagination/filtering, safe idempotent retry, and operational alert/runbook. |
| ISSUE-014 | P2 | Sales API/data model supports richer items, but the UI exposes a narrow single-service flow and cannot edit/remove draft items/payments. | Approve POS scope; either complete multi-item/split-payment draft editing or intentionally constrain and document the API/model. |
| ISSUE-015 | P2 | Fixed fetch caps (approximately customers 500, bookings 200, sales 300, deliveries 25) have no paging contract and can silently hide records. | Add cursor pagination/server filters and visible totals; load-test realistic growth. |
| ISSUE-016 | P2 | Public readiness can be “live” with a service/staff assignment but zero staff availability, producing a live form with no openings. | Include a future-availability readiness signal or display an explicit no-schedule configuration warning to management/public. |
| ISSUE-017 | P2 | Customer edit/merge/archive/notes and full staff profile maintenance are absent from UI despite partial API/model support. | Define operational scope, then add validated/audited maintenance workflows and duplicate-resolution rules. |
| ISSUE-018 | P1 decision | Refund and void are both append-only negative adjustments, while `sales.status = voided` is unused. Partial void/mixed adjustments and payment-method net reporting are not defined. | Finance owner must approve ledger/status/receipt/report semantics. Encode them in functions/constraints and reconciliation tests before real transactions. |
| ISSUE-019 | P2 | Error/auth responses differ across APIs (some schedule mutations collapse unauthenticated into 403), partial availability range validation relies on DB errors, and some paths can surface raw provider/DB messages. | Add shared error contract, 401/403 rules, stable safe messages/codes, correlation IDs, and endpoint contract tests. |
| ISSUE-020 | P1 | `audit_events` is used for limited staff actions, but booking/settings/sales/consent changes lack a comprehensive operator audit trail/view. | Define auditable events and retention; capture actor, before/after, reason, request correlation; add restricted audit viewer/export. |
| ISSUE-021 | P1 | Public booking has an idempotency key but no application-level rate limit or CAPTCHA; auth CAPTCHA is disabled in local configuration. | Add layered per-IP/fingerprint/account/slot throttling and optional challenge, with privacy-safe logging and a tested failure response. |
| ISSUE-022 | P2 | Shared mutation client assumes JSON and does not robustly handle fetch/network/non-JSON failures, risking thrown errors or stuck/unclear UI state. | Use `try/catch/finally`, content-type-safe parsing, timeout/cancellation, retry guidance, and duplicate-safe request IDs. |
| ISSUE-023 | P3 | Auth callback redirects to `/app` even when the code is missing/invalid, leaving downstream redirect behavior to the auth guard with no specific user feedback. | Return to login with a safe callback error state and log a correlation ID. |
| ISSUE-024 | P2 decision | `requested` and `rejected` booking statuses are supported, but current creation flows produce confirmed bookings; ownership of these states is unclear. | Document complete state machine and actors or remove dead states and branches. |
| ISSUE-025 | P1 decision | Minimum age is only a checkbox; DOB, calculated age, guardian information, and proof rules are not implemented although consent schema anticipates guardian data. | Business/legal owner must approve adult/minor policy and required evidence, then integrate it with booking and consent. |
| ISSUE-026 | P2 | `next.config.ts` defines redirects/Turbopack only; no application security-header policy is defined. Hosting may add some headers, but CSP/frame/referrer/permissions policy is unverified. | Define/test production headers at the correct platform layer, deploy CSP in report-only mode first, and verify OAuth/storage/image compatibility. |
| ISSUE-027 | P1 | There is no automated real-browser suite; current automated coverage is unit/API mocks plus database tests. | Add deterministic Playwright E2E for public booking, each role, appointment lifecycle, sales/refunds, reports, settings, and core accessibility; run in CI. |

## 9. Optimization workstream after correctness

Optimize only after the relevant UAT behavior and measurement baseline are approved.

1. **Correctness first:** resolve ISSUE-001, ISSUE-002, ISSUE-004, ISSUE-005, ISSUE-010, ISSUE-018, ISSUE-020, ISSUE-021, ISSUE-025, and all P0/P1 UAT failures.
2. **Close operational gaps:** service/station/customer lifecycle, notification/photo retry, consistent API errors, and automated E2E.
3. **Scale the data access layer:** pagination/filtering, representative seed volume, query plans, FK index decisions, and RLS consolidation.
4. **Measure user experience:** record public LCP/INP, slot API p50/p95/p99, booking transaction latency/conflict rate, dashboard/report latency, and error rate before changing cache/query behavior.
5. **Harden release operations:** backup restore drill, deploy/migration compatibility, security headers, privacy/retention, monitoring/alerts, and incident runbooks.

Suggested initial service-level targets must be approved against real hosting and volume: public page LCP ≤2.5 s at p75 mobile, interaction INP ≤200 ms at p75, read API p95 ≤750 ms, booking mutation p95 ≤1.5 s excluding email/photo side effects, and zero duplicate confirmed bookings/sales under retry/concurrency tests.

## 10. UAT cycles and release decision

### Recommended order

- **Cycle 0 — baseline and requirements:** freeze SHA, approve age/consent/accounting/status/station policies, create canonical data pack, and assign every issue.
- **Cycle 1 — P0/P1 functional:** public booking, auth/RBAC, calendar constraints, sale/payment/adjustment integrity, reporting reconciliation, consent decision.
- **Cycle 2 — management and failure paths:** settings, staff, service/station lifecycle, email/storage outages, API errors, customer maintenance.
- **Cycle 3 — non-functional:** accessibility, browsers/devices, load/concurrency, security, privacy, backup/restore, deployment.
- **Cycle 4 — full regression and business sign-off:** all fixed defects retested, P0/P1 plus impacted P2 regression, production smoke plan approved.

### Entry criteria

- Release candidate SHA and migration set are frozen and deployable to clean UAT.
- Requirements/expected results marked NEEDS DECISION have named approvers and dates.
- Seed data, test accounts, Resend test domain, OAuth client, storage, logging, and backup access are ready.
- No unresolved environment/setup error prevents a core journey.

### Exit criteria

- QG-001 through QG-010 pass with reviewed findings.
- 100% of P0/P1 cases executed; no open P0/P1 defect.
- At least 95% of applicable P2 cases pass, with every exception risk-accepted by business and engineering owners.
- Every role's positive and negative authorization matrix passes at UI, API, and RLS/function layers.
- Booking, appointment, sale, adjustment, and report reconciliation pass under retry and concurrency.
- Accessibility, privacy, backup/restore, monitoring, incident, and production smoke evidence is attached.
- Business owner, operations representative, engineering owner, and release owner sign off on the exact SHA.

### Cycle summary template

| Cycle | Build SHA | Environment | Dates | Passed | Failed | Blocked | Not run | Open P0 | Open P1 | Decision |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| C1 | | | | | | | | | | |

### Defect template

| Field | Required content |
|---|---|
| ID / title | Stable ID and behavior-focused summary |
| Build / environment | Exact SHA, migration version, browser/device, role |
| Related test | UAT ID(s) from this file |
| Preconditions/data | Safe record IDs and setup; no secrets |
| Steps | Minimal deterministic reproduction |
| Expected / actual | Approved rule versus observed behavior |
| Evidence | Screenshot/video, response/status, sanitized logs, relevant DB record IDs |
| Severity / priority | Impact, likelihood, workaround, customer/financial/privacy scope |
| Owner / target | Named person and release/cycle |
| Retest | Fix SHA, tester, date, result, regression IDs |

## 11. Formal sign-off

| Role | Name | Decision | Date | Notes / accepted risks |
|---|---|---|---|---|
| Business owner | | | | |
| Studio operations | | | | |
| Engineering | | | | |
| Security/privacy | | | | |
| Release owner | | | | |

