# Financial Calendar UI

Route: `/financial-calendar-v2` (`app/financial-calendar-v2/page.js`),
linked from the Accounting section of the sidebar as "Financial Calendar
(V2)". The legacy `/accounting-periods` page remains during rollout.

## Sections

1. **Header summary** — current financial year, current period, days
   remaining, open/closing period counts (from `GET /periods` summary).
2. **Financial year setup** — preview → create → open when no calendar
   exists; compact "create next year" control afterwards. The server
   generates all periods; the UI never invents dates.
3. **Year timeline** — year cards with status badges and current-year
   marker; click to filter periods.
4. **Period cards** — per-period status (OPEN/CLOSING/CLOSED/REOPENED),
   dates, lock-date indicator, current-period highlight.
5. **Period detail** — status-driven actions only:
   - OPEN: Begin close, set lock date, view history.
   - CLOSING: full close dashboard (below).
   - CLOSED: view reopening impact, request reopening.
   - REOPENED: begin re-close.
   Pending reopen requests render an approve/reject card for a second
   person. Status history, close-run history and exceptions are always
   visible.
6. **Close dashboard** — completion percentage bar, task table (automatic
   results + manual completion with mandatory evidence text), TB/report/
   integrity statuses, blocking warnings, and the workflow buttons: run
   automated checks → submit for review → approve (second person) → close
   period → (or cancel with reason).
7. **Integrity panel** — run the PER-101…110 audit, readiness status,
   monitoring findings, and legacy migration preview/execute.

No browser calendar events are used; every figure and status comes from
`/api/accounting-v2/periods/*`, and no button performs a client-side status
write.
