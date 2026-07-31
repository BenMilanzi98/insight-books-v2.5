# Health Definition Matrix (v1)

**Definition id (planned):** `customer-health-2026-07-28`  
**Missing policy:** `EXCLUDE_AND_RENORMALISE`  
**Score range:** 0–100 or null  
**Confidence:** HIGH | MEDIUM | LOW | INSUFFICIENT (independent of score)

## Base weights (before renormalise)

| Dimension code | Base weight | Notes |
|----------------|-------------|-------|
| commercial | 0.35 | Platform billing health |
| engagement | 0.25 | Login proxy only |
| mraEis | 0.20 | N/A if tenant not EIS-eligible / no entitlement concept |
| relationship | 0.20 | Owner present + signal severity pressure |

## Bands (config; not UI-hardcoded)

| Band | Score range (inclusive) |
|------|-------------------------|
| HEALTHY | 80–100 |
| STABLE | 65–79 |
| NEEDS_ATTENTION | 50–64 |
| AT_RISK | 35–49 |
| CRITICAL | 0–34 |
| UNKNOWN | score null |

## Critical overrides (examples)

| Condition | Effect |
|-----------|--------|
| Tenant or primary subscription SUSPENDED / CANCELLED | Force band CRITICAL; keep dim scores visible |
| Severe outstanding (definition threshold, aligned with HIGH_OUTSTANDING signal) | Cap band ≤ AT_RISK or CRITICAL per config |
| MRA EIS entitlement REVOKED when EIS-dependent | Cap band CRITICAL |

## Minimum evidence

At least **2** dimensions with status SCORED, else score null + band UNKNOWN + confidence INSUFFICIENT.

## Explicit non-claims

- Not churn probability  
- Not renewal likelihood  
- Not ML health  
- Engagement is not product adoption
