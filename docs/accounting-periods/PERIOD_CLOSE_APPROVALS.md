# Period Close Approvals

Flow: `OPEN → BEGIN CLOSE → COMPLETE CHECKLIST → SUBMIT FOR REVIEW →
APPROVE → CLOSE → SNAPSHOTS`.

## Steps and permissions

| Step | Function | Permission |
| --- | --- | --- |
| Begin close | `beginPeriodClose` | `accountingPeriods.beginClose` |
| Run checks / complete tasks | `runAutomatedCloseChecks`, `updateManualCloseTask` | `accountingPeriods.completeTasks` |
| Submit for review | `submitCloseForReview` | `accountingPeriods.submitClose` |
| Approve | `approveCloseRun` | `accountingPeriods.approveClose` |
| Execute closure | `closePeriod` | `accountingPeriods.close` |

## Separation of duties

`approveCloseRun` rejects when the approver is the same user who initiated
the run (`initiatedBy === context.userId` → error). The same rule applies to
reopening (`approveReopen` rejects the requester). Enforced server-side and
covered by tests.

`submitCloseForReview` refuses while required tasks are incomplete or
blocking tasks are failing — an unfinished checklist cannot even reach
review, let alone approval.
