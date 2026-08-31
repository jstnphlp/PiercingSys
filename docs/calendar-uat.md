# Calendar Manual UAT

## Purpose

Validate the staff calendar's weekly grid, list-style Day view, station-aware overlap layout, filters, appointment dialogs, permissions, accessibility, and responsive behavior.

## Execution record

| Field | Value |
| --- | --- |
| Build or commit |  |
| Environment |  |
| Tester |  |
| Test date |  |
| Browser and version |  |
| Desktop resolution |  |
| Mobile device or viewport |  |
| Overall result | Not run / Pass / Pass with issues / Fail |

Record evidence as a screenshot, screen recording, or issue link. Mark each case `Pass`, `Fail`, `Blocked`, or `Not run`.

## Preconditions and test data

- The tester can sign in with one management account (`owner` or `manager`) and one `piercer` account.
- Three active stations exist: `Station 1`, `Station 2`, and `Station 3`.
- At least three active piercers and clients exist, with distinct piercer colors.
- Create the following confirmed appointments on the same date in the week under test. Use different eligible piercers where required by overlap validation.

| Booking | Time | Station | Purpose |
| --- | --- | --- | --- |
| A | 10:00–11:00 | Station 1 | Base appointment |
| B | 10:30–11:30 | Station 2 | Two-way overlap with A |
| C | 10:45–11:15 | Station 3 | Three-way overlap |
| D | 11:30–12:00 | Station 1 | Touching endpoint; separate group |
| E | 14:00–15:00 | No station | Unassigned-station fallback |

- Add at least one completed and one no-show appointment on another date.
- Keep one date without appointments for empty-state testing.
- If cancelled or rejected records are available, include one of each in the selected range to confirm they remain hidden.

> The database intentionally rejects overlapping bookings assigned to the same station or piercer. Overlap-layout cases must use different stations and piercers.

## Test cases

### Weekly calendar

| ID | Priority | Role | Procedure | Expected result | Status | Evidence/notes |
| --- | --- | --- | --- | --- | --- | --- |
| CAL-W01 | Critical | Manager | Open **Calendar** with Week selected. | A seven-day Sunday–Saturday grid appears in the PiercingSys visual style. The selected date, today, hour labels, and Manila current-time line are correct when applicable. |  |  |
| CAL-W02 | High | Manager | Select Previous, Next, then Today. | Navigation moves exactly seven days in Week view. Today restores the current Manila week without changing filters. |  |  |
| CAL-W03 | Critical | Manager | View bookings A and B. | A and B occupy equal-width side-by-side lanes only while their times overlap. Both cards remain visible and clickable. |  |  |
| CAL-W04 | Critical | Manager | View bookings A, B, and C together. | The connected overlap group uses three equal-width lanes. No card completely covers another card. |  |  |
| CAL-W05 | High | Manager | Compare booking D with the group ending at 11:30. | D starts at the prior booking's exact endpoint and renders full width as a separate non-overlapping group. |  |  |
| CAL-W06 | High | Manager | Inspect each weekly card and hover/focus it. | The card shows time/client, piercer/station, and service information when space permits. Truncated content is available in the tooltip and accessible name. |  |  |
| CAL-W07 | High | Manager | Inspect booking E. | The resource line displays `No station`; the card remains correctly positioned and clickable. |  |  |
| CAL-W08 | High | Manager | Click each overlapping card. | Each card opens the detail dialog for the correct client, time, piercer, station, reference, and services. |  |  |
| CAL-W09 | Medium | Manager | Inspect completed, no-show, cancelled, and rejected records. | Completed and no-show bookings use their status treatment. Cancelled and rejected bookings are absent from the operational calendar. |  |  |

### Filters and permissions

| ID | Priority | Role | Procedure | Expected result | Status | Evidence/notes |
| --- | --- | --- | --- | --- | --- | --- |
| CAL-F01 | Critical | Manager | Filter by Station 1. | Only Station 1 appointments remain. Cards recalculate and return to full width when no visible overlap remains. |  |  |
| CAL-F02 | Critical | Manager | Clear the station filter, then filter by one piercer. | Only that piercer's appointments remain and lane widths recalculate from the filtered set. |  |  |
| CAL-F03 | High | Manager | Combine piercer and station filters, navigate dates, and switch Week/Day. | Both filters persist and all views show the same matching appointment set. |  |  |
| CAL-F04 | Critical | Piercer | Sign in as a piercer and open Calendar. | The piercer filter is locked to the signed-in user, other piercers' appointments are absent, and station filtering remains available. |  |  |

### Day view and appointment operations

| ID | Priority | Role | Procedure | Expected result | Status | Evidence/notes |
| --- | --- | --- | --- | --- | --- | --- |
| CAL-D01 | Critical | Manager | Click a weekly date header containing A–D. | Day view opens for that exact date and displays a chronological list, not a time grid. |  |  |
| CAL-D02 | High | Manager | Return to Week, select a date, then use the Day toggle. | Day opens for the currently anchored date. Returning to Week opens the seven-day range containing that date. |  |  |
| CAL-D03 | Critical | Manager | Review A–D in Day view. | Rows are ordered by start time and show time range, client, services/reference, piercer/station, and status. Overlap lanes are not used in the list. |  |  |
| CAL-D04 | High | Manager | Navigate Previous, Next, and Today in Day view. | Navigation moves exactly one Manila calendar day and loads the matching appointment list. |  |  |
| CAL-D05 | High | Manager | Open the known empty date. | The Day view shows a clear no-appointments state and does not retain rows from the previous date. |  |  |
| CAL-D06 | Critical | Manager | Create an appointment from the calendar toolbar. | The appointment is saved, the dialog closes, and the active calendar view refreshes with the new booking. |  |  |
| CAL-D07 | Critical | Manager | Open a booking and reschedule it. | Validation is enforced and the refreshed Week/Day view shows the booking at its new time and recalculated lane. |  |  |
| CAL-D08 | Critical | Manager | Mark eligible bookings complete, no-show, and cancelled. | The dialog action succeeds and refreshes the view. Status styling updates; a cancelled booking disappears. |  |  |

### Schedule Settings overlap layout

| ID | Priority | Role | Procedure | Expected result | Status | Evidence/notes |
| --- | --- | --- | --- | --- | --- | --- |
| CAL-S01 | Critical | Manager | In Settings, create availability for two staff members on the same weekday. | The day divides into two stable staff lanes. Each person's availability consistently tints their lane and remains selectable. |  |  |
| CAL-S02 | Critical | Manager | Add availability for a third staff member on that weekday. | The day recalculates into three equal staff lanes without any region covering another. |  |  |
| CAL-S03 | High | Manager | Give one staff member multiple separated availability periods. | Every period remains in that staff member's lane, including when it does not overlap another person's time. |  |  |
| CAL-S04 | High | Manager | Select each narrow staff block. | The correct staff member and recurring start/end values open in the editor. Truncated text remains available through the tooltip and accessible name. |  |  |
| CAL-S05 | Critical | Manager | Review each compact day header. | The header shows weekday/date, Open or Closed status, and configured opening and closing times without adding a studio-hours block to the calendar body. |  |  |
| CAL-S06 | Critical | Manager | Add a partial closure and a closure covering the complete operating window on different dates. | The partial closure softly tints its exact time range. The full closure softly tints the day column. Neither uses high-contrast hazard stripes. |  |  |
| CAL-S07 | High | Manager | Edit or delete one overlapping staff block and reload Settings. | The remaining blocks persist and recalculate their lane widths correctly. |  |  |
| CAL-S08 | High | Manager | Compare each day header with its configured business hours. | Open days show the correct compact time range. Closed or unconfigured days show Closed and a Set hours affordance. |  |  |
| CAL-S09 | Critical | Manager | Click the studio-hours summary in an open header and a closed header. | Each opens the recurring hours editor for the correct weekday with existing or sensible default times. |  |  |
| CAL-S10 | High | Manager | Focus a studio-hours header control using the keyboard and activate it. | Focus is visible, its accessible name identifies the weekday, and Enter/Space opens the hours editor. |  |  |
| CAL-S11 | High | Manager | Scan the calendar at desktop and mobile widths. | Day separators and hourly rules remain dominant; availability stays low contrast, text is legible, and the schedule scrolls without page-level overflow. |  |  |
| CAL-S12 | Medium | Manager | Review the Studio hours, staff, and Closure legend followed by Previous, Today, Next, and Add schedule block. | All existing legend items and controls remain present and functional. |  |  |

### Responsive, accessibility, and failure states

| ID | Priority | Role | Procedure | Expected result | Status | Evidence/notes |
| --- | --- | --- | --- | --- | --- | --- |
| CAL-X01 | High | Manager | Test Week view at desktop width and at approximately 768 px and 390 px. | The weekly grid scrolls horizontally without shrinking cards into unusable controls. Overlapping cards remain independently clickable. |  |  |
| CAL-X02 | High | Manager | Test Day view at the same widths. | The date block and list remain legible. Mobile rows retain time, client, and the row-opening affordance without horizontal page overflow. |  |  |
| CAL-X03 | High | Manager | Navigate controls, date headers, cards, list rows, and dialogs using only the keyboard. | Focus is visible, Enter/Space activates buttons, Week/Day exposes its pressed state, and dialog focus remains trapped and returns on close. |  |  |
| CAL-X04 | Medium | Manager | Use browser developer tools to simulate a failed `/api/appointments` request, then retry after restoring network access. | An accessible error message appears. After recovery and navigation/filtering, the calendar reloads successfully. |  |  |
| CAL-X05 | Medium | Manager | Throttle the appointments request. | A loading state covers stale content, communicates busy status, and clears after success or failure. |  |  |

## Exit criteria

- All Critical cases pass.
- No unresolved defect causes an appointment to appear under the wrong date, time, station, piercer, or dialog.
- No valid overlapping appointment becomes completely hidden or unreachable.
- High-priority failures have an approved disposition before release.
- Lint, typecheck, unit tests, and the production build pass for the accepted build.

## Defect and sign-off log

| Defect ID | UAT case | Severity | Summary | Owner | Resolution/status |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

| Sign-off role | Name | Decision | Date | Notes |
| --- | --- | --- | --- | --- |
| Product owner |  | Approve / Reject |  |  |
| Studio operations |  | Approve / Reject |  |  |
| Technical reviewer |  | Approve / Reject |  |  |
