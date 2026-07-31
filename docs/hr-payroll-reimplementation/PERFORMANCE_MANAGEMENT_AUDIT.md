# Performance Management Audit

Routes: `/hr/performance` · APIs: performance-reviews / goals / feedback / statistics · Models: PerformanceReview, PerformanceReviewCriteria, PerformanceGoal, PerformanceFeedback

## Findings

### Strengths

- UI tabs for reviews, goals, feedback.  
- Complete/acknowledge review endpoints.  
- Correctly does **not** auto-post accounting (compliant with master rule 28).

### Gaps

| Gap | Classification |
|-----|----------------|
| `PerformanceFeedback.reviewId` has no Prisma FK | `INCOMPLETE` |
| No bonus recommendation → approved payroll input pipeline | `DISCONNECTED` |
| Ratings can theoretically be used ad-hoc in payroll without source record | Process gap `UNSAFE` if practiced |
| Calibration / PIP workflows incomplete | `INCOMPLETE` |
| No link from review to compensation revision | `INCOMPLETE` (by design until Phase 2) |

### Disposition

| Surface | Classification |
|---------|----------------|
| Review/goal UI | `EXTEND` |
| Bonus recommendation objects | `REIMPLEMENT` |
| Schema FK fix | `EXTEND` |
| Accounting from performance | `NOT_APPLICABLE` (must stay out) |
