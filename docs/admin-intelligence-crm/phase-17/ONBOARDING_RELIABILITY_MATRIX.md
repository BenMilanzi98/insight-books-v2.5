# Onboarding Reliability Matrix

| Gate input | Fail behaviour | Current | Class | Wave |
|------------|----------------|---------|-------|------|
| Handoff / project / customer / tenant / subscription | UNAVAILABLE / value null | No onboarding gate | NOT_FOUND | 3–4 |
| Template / task evidence | UNAVAILABLE | Absent | NOT_FOUND | 2–4 |
| Migration / training / MRA sources | UNAVAILABLE; UNKNOWN≠READY | Handoffs emit-only | CORRECT_AND_REUSABLE inputs | 3–4 |
| Go-live / completion / recon / DQ | UNAVAILABLE | Absent | NOT_FOUND | 3–4 |
| Permission / freshness | UNAVAILABLE | Foundations + CS authz only | EXTEND | 1–4 |
| Invent zero on fail | Forbidden | Conversion pattern forbids | CORRECT_AND_REUSABLE pattern | 4 |
| Conversion reliabilityGate | Pattern reuse | `conversions/reliabilityGate.js` | CORRECT_AND_REUSABLE pattern | 4 |
