# Duplicate Booking Risk Register

| ID | Risk | Severity | Evidence | Disposition |
|----|------|----------|----------|-------------|
| B-01 | Parallel create overbooks unit/qty | High | `assertCanBook` without lock | `DUPLICATE_BOOKING_RISK` |
| B-02 | Client calendar advisory only | Medium | `buildBlockedYmdSet` | `EXTEND` server authority |
| B-03 | Auto-release deletes slots by end time | Medium | `releaseExpiredRentals` | `UNSAFE` vs inspection |
| B-04 | Asset.status='booked' not time-aware | Medium | Update on create only | `INCORRECT_CALCULATION` of availability flag |
| B-05 | No serialised unit identity | High | Asset-level booking | `REIMPLEMENT` units |
