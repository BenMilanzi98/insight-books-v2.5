# Leave Management Audit

Routes: `/hr/leave` · APIs: leave / leave-requests / leave-policies / leave-balances · Models: LeavePolicy, LeaveRequest, LeaveBalance

## Findings

### Strengths

- UI with policies + requests tabs.  
- Approve/reject endpoints.  
- `isPaid` on policy; balance counters per year.  
- Day helpers in `lib/hrCalculations.js` (`calculateLeaveDays`) with unit tests.

### Gaps

| Gap | Classification |
|-----|----------------|
| Dual APIs: `/api/leave` and `/api/leave-requests` | `DUPLICATED` / `CONSOLIDATE` |
| Accrual only via on-demand `leave-balances/calculate` (`accrualRate * monthsWorked`) | `INCOMPLETE` / non-idempotent risk |
| No accrual ledger / idempotency key | `DUPLICATE_POSTING_RISK` (balance) |
| No partial-day / hourly leave model beyond day math | `INCOMPLETE` |
| Carry-forward / expiry / encashment incomplete | `INCOMPLETE` |
| Public holiday calendar integration unclear | `INCOMPLETE` |
| Unpaid leave → automatic payroll deduction not first-class | `DISCONNECTED` |
| Leave consumed by posted payroll not locked | `INCOMPLETE` |
| Balance days as Float | Prefer Decimal/minutes | `EXTEND` |

### Disposition

| Surface | Classification |
|---------|----------------|
| Policy/request UI | `EXTEND` |
| API consolidation | `CONSOLIDATE` |
| Accrual engine | `REIMPLEMENT` |
| Payroll effect bridge | `REIMPLEMENT` |
