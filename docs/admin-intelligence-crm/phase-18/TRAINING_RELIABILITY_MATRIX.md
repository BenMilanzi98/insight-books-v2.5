# Training Reliability Matrix

| Gate check | Required | Current | Class | Wave |
|------------|----------|---------|-------|------|
| Handoff → Request lineage present | Yes | Emit only | UNRECONCILED | 1 |
| Program curriculum pin present | Yes | Absent | NOT_FOUND | 1 |
| Participant / trainer / session integrity | Yes | Absent | NOT_FOUND | 2 |
| Attendance source honesty | Yes | Absent | ATTENDANCE_TRUTH_RISK | 2 |
| Assessment / completion / certificate integrity | Yes | Absent | NOT_FOUND | 3 |
| DQ / recon / permission / freshness | Yes | Absent | NOT_FOUND | 4 |
| Gate fail → UNAVAILABLE / `value: null` | Yes | Pattern elsewhere | CORRECT_AND_REUSABLE | 4 |
| Gate fail → fabricated zero KPI | No | — | FORBIDDEN | All |
| Foundations empty → invent progress | No | `progressPercent: null` | CORRECT_AND_REUSABLE | — |
