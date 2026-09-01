# Public Booking Edge Cases — Simple UAT

Use this checklist in local or UAT only. Use test customers and remove test bookings afterward.

## Test record

| Field | Value |
|---|---|
| Tester | |
| Date/time (Asia/Manila) | |
| URL / build | |
| Browser(s) | |
| Overall result | PASS / FAIL / BLOCKED |

## Setup

- Apply the latest database migrations and start the app.
- Prepare one 60-minute service qualified for Piercer A and Piercer B.
- Make both piercers available in the same future time range, using 30-minute slot intervals.
- Know the studio's lead time and `bookingHorizonDays` values.
- For the race test, use two private browser windows so they do not share page state.

## Acceptance tests

### UAT-EDGE-01 — A booked time is unavailable

1. In Browser A, book the 60-minute service with Piercer A at 1:00 PM.
2. In a fresh Browser B session, select the same service, piercer, and date.

Expected:

- 1:00 PM is not available.
- 1:30 PM is also not available because it overlaps the 1:00–2:00 PM booking.
- 2:00 PM remains available because it starts exactly when the booking ends.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-EDGE-02 — Two customers race for the same opening

1. Before either customer submits, select the same Piercer A, date, and 1:00 PM opening in both browsers.
2. Complete the booking in Browser A.
3. Submit the still-open form in Browser B.

Expected:

- Browser A creates one confirmed booking.
- Browser B does not create a second booking and returns to the schedule.
- Browser B shows: **That opening was just booked. Please choose another time.**
- Browser B removes 1:00 PM and every overlapping option such as 1:30 PM.
- Browser B still shows the adjacent 2:00 PM option when no other rule blocks it.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-EDGE-03 — Another qualified piercer can keep a time open

1. Keep the 1:00–2:00 PM booking assigned to Piercer A.
2. Confirm Piercer B is qualified and free for the same service and time.
3. View the schedule with **Any qualified piercer** selected.
4. Then select Piercer A explicitly, followed by Piercer B explicitly.

Expected:

- **Any qualified piercer** can still offer 1:00 PM through Piercer B.
- Piercer A does not offer 1:00 PM or 1:30 PM.
- Piercer B can offer 1:00 PM if no other rule blocks it.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-EDGE-04 — Booking status releases or holds the slot correctly

Repeat the availability check after changing the test booking status.

Expected:

- `requested`, `confirmed`, `completed`, and `no_show` keep overlapping times unavailable.
- `cancelled` and `rejected` release the time after the schedule is refreshed.
- Releasing Piercer A's booking does not affect unrelated Piercer B bookings.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-EDGE-05 — Duration, closures, and business hours are respected

1. Select services whose combined duration is longer than one slot interval.
2. Check openings near another booking, a studio/staff closure, and closing time.

Expected:

- No offered appointment overlaps an existing blocking booking or closure.
- The entire combined service duration fits within staff and studio hours.
- A start that would end after closing is not offered.
- A start exactly after a booking or closure ends can remain available.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-EDGE-06 — Lead time and exact booking horizon are enforced

1. Check openings immediately before and at the configured lead-time cutoff.
2. Navigate to the final date allowed by `bookingHorizonDays`.
3. Compare each offered start with the exact current Manila time plus the configured horizon.

Expected:

- Starts earlier than the lead-time cutoff are unavailable.
- The exact lead-time boundary may be available if all other rules pass.
- On the final horizon date, no start later than the exact horizon cutoff is offered.
- **Next week** is disabled when the next visible week is outside the horizon.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-EDGE-07 — Eligibility changes after the page loads

1. Select an opening and continue to the details step.
2. In the admin side, deactivate the selected piercer or remove their qualification for the service.
3. Submit the stale public form.

Expected:

- No invalid booking is created.
- The customer receives an actionable failure and can choose another opening.
- No photo record/object or confirmation delivery is created for the failed attempt.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-EDGE-08 — A retry does not duplicate side effects

1. Make one booking with a test photo and record its request idempotency key and reference.
2. Replay the identical request with the same idempotency key.
3. Inspect the booking, booking photo, storage object, confirmation delivery, and test inbox.

Expected:

- Both responses identify the same booking.
- There is exactly 1 booking, 1 photo row/object, and 1 confirmation delivery.
- No more than 1 confirmation email is delivered.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-EDGE-09 — Simultaneous appointments remain visible in the staff calendar

1. Create two appointments with the same start and end time, assigned to different qualified piercers and different stations or no station.
2. Open the staff **Calendar** tab with **All piercers** selected.
3. Repeat with three simultaneous appointments if three piercers are available.

Expected:

- Every appointment is visible side-by-side in the correct Manila date and time row.
- No appointment completely covers another appointment.
- Each card identifies its customer and piercer; selecting a card opens the matching appointment.
- Filtering by a single piercer restores the appointment to the full available column width.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

### UAT-EDGE-10 — New bookings appear without refreshing the calendar

1. Keep the staff **Calendar** tab open on a week with an available opening.
2. In another browser, complete a public booking for that visible week.
3. Do not reload, navigate, or change a filter in the staff browser.

Expected:

- The new appointment appears automatically in the correct date and Manila time.
- If it overlaps another piercer's appointment, both cards immediately reflow side-by-side.
- Returning focus to the calendar also refreshes it if the live connection was interrupted.

Result: PASS / FAIL / BLOCKED  
Evidence / defect: ________________________________________________

## Cleanup and sign-off

- Delete only the test bookings, customers, photos, storage objects, and deliveries created for this run.
- Restore any piercer qualifications, availability, closures, studio settings, or booking statuses changed during testing.

| Role | Name | Decision | Date |
|---|---|---|---|
| UAT tester | | Accept / Reject | |
| Business approver | | Accept / Reject | |
