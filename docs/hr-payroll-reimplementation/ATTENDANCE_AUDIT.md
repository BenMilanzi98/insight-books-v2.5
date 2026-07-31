# Attendance Audit

Routes: `/hr/attendance` · APIs: `app/api/attendance/**`, attendance-policies · Models: AttendanceRecord, AttendanceRegister

## Findings

### Strengths

- Clock-in/out, daily records, finalize register, absence bulk, report list.  
- UI overtime fields and export (PDF/Excel).  
- `calculateAttendanceHours` in `lib/hrCalculations.js`.

### Gaps

| Gap | Classification |
|-----|----------------|
| No Shift / WorkSchedule / Timesheet models | `INCOMPLETE` |
| Hours/OT stored as Float | `INCORRECT_CALCULATION` risk |
| No approval state machine (DRAFT→APPROVED→LOCKED→EXPORTED) | `INCOMPLETE` |
| Overlapping clock events not constrained in schema | `INCOMPLETE` |
| Payroll enhanced path accepts overtimeHours/Rate as inputs — not forced from approved attendance | `DISCONNECTED` / `UNSAFE` |
| Finalize register ≠ payroll export lock | `INCOMPLETE` |
| Night/weekend/holiday premium engines absent | `INCOMPLETE` |
| Late/early penalty policies not first-class payroll sources | `INCOMPLETE` |
| No branch on attendance | `INCOMPLETE` |

### Disposition

| Surface | Classification |
|---------|----------------|
| Capture UI/API | `EXTEND` |
| Attendance engine for pay | `REIMPLEMENT` |
| OT approval records | `REIMPLEMENT` |
| hrCalculations helpers | `REUSE` then migrate to minute arithmetic |
