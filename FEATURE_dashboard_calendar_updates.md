# Feature Spec — Dashboard, Calendar & Report Updates
**App:** BookMySeat · **Version:** v6 feature additions · **Extends:** Requirements v4 + FEATURE_seat_capacity.md (v5)
**Purpose:** Drop this file into the project repo. In Cursor (Claude Code, Pro plan), implement with the prompt plan in Section 8.

---

## 1. Summary of Changes

| # | Feature | Description |
|---|---|---|
| 1 | Role-scoped dashboard | Employee sees **only their own** data; Manager sees the **whole team counts** (existing split view) |
| 2 | Excel axis swap | Report transposed: **dates on rows (Y), employees on columns (X)** — swap of the current layout |
| 3 | Dashboard date filter | Free date picker on the dashboard instead of the fixed Today/+1/+2 buttons |
| 4 | Multi-date booking calendar | My Status becomes a **calendar view with multi-date selection** and 3 tabs: WFO · WFH · Leave |
| 5 | Period views | Employee dashboard: **Weekly / Monthly**; Manager dashboard: **Daily / Weekly / Monthly** |

---

## 2. Feature 1 — Role-Scoped Dashboard

**Rule:** the dashboard content depends on the logged-in role.

**Employee dashboard (specific user only):**
- Shows only the logged-in employee's own numbers — their WFO days, WFH days, Leave (A) days, and absent days for the selected period.
- Personal timeline/mini-calendar of their own entries.
- No team-wise counts, no other employees' data, no overall office split.
- May still show the read-only capacity signal for a date ("WFO slots: 58/63 filled") since booking needs it — but never who booked.

**Manager dashboard (whole team counts):**
- The existing split view: team-wise WFO / WFH / Leave / Absent counts (PFG, Gear_Box, e_Motor), totals row, capacity ring, trend — unchanged, now manager-only.
- Optional team filter (single team drill-down).

**Backend:**
```
GET /dashboard/me?from=&to=          → own counts + per-day list        (any role)
GET /dashboard/team?date=|from=&to=  → split by team                    (manager/admin only, 403 otherwise)
```
UI hiding is not enough — `/dashboard/team` must be guarded with `require_role("manager", "admin")`.

## 3. Feature 2 — Excel Report: X/Y Axis Swap

Current layout: rows = employees, columns = dates. **Swap it:**

| BookingDate (rows ↓) | Aarav Sharma | Ishita Patel | … (one column per employee) | WFO total | WFH total | L total | A total |
|---|---|---|---|---|---|---|---|
| 2026-07-13 | WFO | WFH | … | 51 | 12 | 4 | 3 |
| 2026-07-14 | WFO | L | … | 55 | 8 | 5 | 2 |

- One row per working day of the reporting period (Y axis = dates).
- One column per employee, grouped by team with a team header row (X axis = employees).
- Row-end totals: per-day WFO / WFH / L / A counts (this replaces the old per-employee totals columns; per-employee totals move to a footer block under each column).
- Manager/Admin only (unchanged). Implementation: build the same matrix then transpose (`openpyxl` — write cells [date][employee]), freeze the first row + first column.

## 4. Feature 3 — Dashboard Date Filter

- Replace the fixed Today / +1 / +2 buttons with a **date picker** (single date in Daily view; auto-derived range in Weekly/Monthly — see Feature 5).
- Any working date, past or future, can be selected; weekends/holidays show the "office closed" empty state.
- Past dates show historical data using the capacity effective on that date (v5 rule).
- Manager sees team split for the filtered date; employee sees their own entry/summary for it.

## 5. Feature 4 — My Status: Multi-Date Calendar with 3 Tabs

Replace the single-date strip with a **month calendar view** supporting **multiple date selection at a time**:

**UI:**
1. Three tabs at the top: **WFO** · **WFH** · **Leave (A)** — the active tab is the category to apply.
2. Month calendar (prev/next month nav). The user taps multiple dates — selected dates get highlighted in the active tab's color. Tap again to deselect.
3. Each day cell shows its current entry badge (WFO/WFH/L), "FULL" marker when WFO capacity is reached, and lock icon 🔒 on closed past dates.
4. One button: "Apply {category} to {n} selected dates" → single bulk request.
5. Non-selectable cells: weekends, holidays, dates beyond the booking window, closed past dates without an approved edit.

**Backend — bulk endpoint:**
```
POST /bookings/bulk   { dates: [d1, d2, ...], status: "WFO"|"WFH"|"L" }
```
- Validates **each date independently** with all existing v4/v5 rules (weekend, holiday, window, closed-day approval, Show Full per date using capacity_for(d), duplicate same-status).
- Partial success is allowed: valid dates are saved, failures are itemized.
- Response: `{ booked: [...], skipped: [{date, reason}, ...] }` → UI toast: "WFO applied to 4 dates · skipped 2 (Jul 21 Show Full, Jul 22 holiday)."
- All-or-nothing is NOT required; per-date atomicity is (each date's WFO count check runs in its own locked transaction).

## 6. Feature 5 — Period Views (Daily / Weekly / Monthly)

| View | Employee | Manager |
|---|---|---|
| Daily | — (not shown) | Yes — the existing per-date split |
| Weekly | Yes — own counts for the week | Yes — team split aggregated over the week |
| Monthly | Yes — own counts for the month | Yes — team split aggregated over the month |

- **Employee** toggle: Weekly / Monthly. Shows their own WFO/WFH/L/A day-counts for the period + a per-day mini list.
- **Manager** toggle: Daily / Weekly / Monthly. Weekly/Monthly aggregate = for each team, the **sum of day-entries** per category across working days (e.g. "PFG — WFO 118 person-days, WFH 41, L 12, A 9 in July"), plus average WFO utilization vs capacity per day.
- The date filter (Feature 3) drives the period: picking any date selects its week (Mon–Fri) or month.
- Weekends/holidays are excluded from working-day denominators.

**Backend:** extend the two dashboard endpoints with `?view=daily|weekly|monthly&date=` — server derives the range and returns per-day rows + period totals so all clients calculate nothing.

## 7. Validations & Test Cases (additions)

**Validations**
1. Employee calling `/dashboard/team` → 403 "Team dashboard is available to managers only."
2. Bulk booking: every date validated independently; skipped dates itemized with reasons — never a silent drop.
3. Bulk booking with 0 selected dates → "Select at least one date."
4. Multi-select cannot include weekends/holidays/out-of-window/locked past dates (blocked at UI *and* server).
5. Daily view hidden for employees; requesting it falls back to weekly.
6. Weekly/monthly totals count only working days; capacity comparisons use capacity_for(each day).

**Pytest cases**
| # | Scenario | Expected |
|---|---|---|
| 1 | Employee token GET /dashboard/team | 403 |
| 2 | Employee GET /dashboard/me monthly | Only own entries, correct WFO/WFH/L/A day-counts |
| 3 | Bulk: 5 dates, 1 is Show Full, 1 is holiday | 3 booked, 2 skipped with reasons |
| 4 | Bulk WFO across dates with different capacities (63 vs 70) | Each date checked against its own capacity |
| 5 | Bulk containing a locked past date without approval | That date skipped: "Day closed…" |
| 6 | Excel export | Rows = dates, columns = employees, per-day totals at row end |
| 7 | Manager weekly view for a week containing a holiday | Holiday excluded from working-day totals |

## 8. Cursor + Claude Code Prompt Plan (Pro plan)

Run one at a time, committing after each:

1. "Read FEATURE_dashboard_calendar_updates.md. Split the dashboard endpoint into /dashboard/me (own data) and /dashboard/team (manager/admin only, 403 for employees) with view=daily|weekly|monthly&date= params per Sections 2 and 6. Add pytest for the 403 and period totals."
2. "Implement POST /bookings/bulk per Section 5 — per-date independent validation, partial success with itemized skipped reasons, per-date capacity locking. Add the pytest cases from Section 7."
3. "Transpose the Excel export per Section 3: dates on rows, employees on columns grouped by team, per-day totals at row end, frozen header row/column."
4. "Frontend: rebuild My Status as a month calendar with multi-date selection and 3 category tabs (WFO/WFH/Leave) calling /bookings/bulk; show skipped-date reasons in the toast."
5. "Frontend: role-scoped dashboards — employee gets Weekly/Monthly personal view, manager gets Daily/Weekly/Monthly team split, both driven by a date-picker filter. Run the full suite and fix regressions."
