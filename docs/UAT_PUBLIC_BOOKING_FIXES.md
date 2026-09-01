# Public Booking Fixes — Simple UAT

Use this checklist to manually accept the five recent public-booking fixes.

## Test record

| Field | Value |
|---|---|
| Tester | |
| Date/time (Asia/Manila) | |
| Environment / URL | `http://localhost:3000/book` or UAT URL: |
| Branch / build SHA | |
| Browser and version | |
| Overall result | PASS / FAIL / BLOCKED |

## Preconditions

- The application and Supabase are running with the latest migrations.
- Online booking is configured with business hours and at least one available future slot.
- At least 13 active services are visible to customers.
- Prepare these service assignments:
  - **Compatible A** and **Compatible B** share at least one qualified piercer.
  - **Incompatible A** is assigned only to Piercer A.
  - **Incompatible B** is assigned only to Piercer B.
- Record the configured `bookingHorizonDays`: ______ days.
- Use test-only customer details, email, and reference photos.
- Open browser developer tools and select the **Network** tab when testing retries.

## Acceptance tests

### UAT-PB-01 — Incompatible services stop before the schedule

1. Open `/book`.
2. Select **Incompatible A** and **Incompatible B**.
3. Observe the page without clicking another control.

Expected:

- A clear message says no piercer is qualified for all selected services.
- The message tells the customer to remove a service or book separately.
- **Find an opening** is disabled.
- No public availability request is sent in the Network tab.
- Both selected services remain selected.

4. Remove either incompatible service.

Expected:

- The incompatibility message disappears.
- **Find an opening** becomes available for the remaining valid service.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-PB-02 — Valid multi-service booking still works

1. Reset the form or reload `/book`.
2. Select **Compatible A** and **Compatible B**.
3. Click **Find an opening**.

Expected:

- The schedule loads normally.
- Only piercers qualified for both services appear in the Piercer list.
- Available slots use the combined service duration.
- No incompatibility message appears.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-PB-03 — Maximum of 12 selected services

1. Reset the form or reload `/book`.
2. Select 12 different services.
3. Confirm the selected counter says **12 selected**.
4. Attempt to select a 13th service.

Expected:

- The counter remains **12 selected**.
- The original 12 services remain selected.
- The 13th service remains unselected.
- A message says: **You can select up to 12 services. Remove one to choose another.**

5. Remove one of the original services.

Expected:

- The counter changes to **11 selected**.
- The limit message disappears.
- Another service can now be selected.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-PB-04 — Calendar stops at the booking horizon

1. Reset the form and select one valid service.
2. Click **Find an opening**.
3. Confirm the displayed dates use the current Manila business date.
4. Click **Next week** until the final week containing a date within the configured booking horizon is displayed.

Expected:

- The final week that overlaps the allowed horizon can be opened.
- **Next week** is disabled on that final week.
- The user cannot navigate to the first week entirely beyond the horizon.
- Previous Week and Today continue to work normally.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-PB-05 — Availability copy is accurate

1. From the schedule, choose an available slot.
2. Click **Your details**.

Expected:

- The page says: **We’ll check that your selected opening is still available when you confirm your appointment.**
- The page does not claim that the opening is held or reserved before submission.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-PB-06 — Retry creates one booking and one set of side effects

> Run this only in local/UAT. Do not use a real customer email or sensitive photo.

1. Select one valid service and an available slot.
2. Fill in unique test customer details and attach a small JPG or PNG.
3. Submit the booking once and record the booking reference: ______________.
4. In browser developer tools, find the successful `POST /api/public/bookings` request.
5. Use **Copy as cURL**, then run that exact command one additional time. Do not edit its multipart body or idempotency key.
6. Confirm the retry returns the same booking ID/reference as the first request.
7. In Supabase Studio, filter each location by that booking ID/reference:
   - `bookings`
   - `booking_photos`
   - `notification_deliveries` with kind `confirmation`
   - Storage → `booking-photos`
8. If email delivery is enabled, check the test inbox.

Expected:

- Both HTTP responses identify the same booking.
- Exactly **1** booking row exists.
- Exactly **1** booking photo row exists.
- Exactly **1** photo object exists in storage.
- Exactly **1** confirmation delivery exists.
- At most **1** confirmation email reaches the test inbox.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

## Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| UAT tester | | Accept / Reject | |
| Business approver | | Accept / Reject | |

Open a defect for every failed result and include the test ID, build SHA, exact data used, screenshot or response, expected result, and actual result. Do not include credentials, service keys, or real customer photos.
