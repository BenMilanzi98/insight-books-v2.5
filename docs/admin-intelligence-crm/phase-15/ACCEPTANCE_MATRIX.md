# Acceptance Matrix

| Capability | Exists? | Path | Class |
|------------|---------|------|-------|
| Portal acknowledgement accept | No | — | NOT_FOUND → Wave 3 |
| Email confirmation accept | No | — | NOT_FOUND → Wave 3 |
| Manual evidence accept | No | — | NOT_FOUND → Wave 3 |
| PO reference accept | No | — | NOT_FOUND → Wave 3 |
| E-sign accept | No | — | NOT_CONFIGURED / SIGNATURE_RISK |
| Version+checksum+authority bind | No | — | NOT_FOUND |
| Reject + canonical reasons | No | — | NOT_FOUND |
| Acceptance → auto Closed Won | Must not | Design + conversionReadiness | FORBIDDEN |
| Tenant Approved→Invoice convert | Yes | quotations/convert | WRONG_DOMAIN / ACCEPTANCE_IDENTITY_RISK |
| Closed-Won readiness eval | Partial | conversionReadiness.js | CORRECT_AND_REUSABLE / EXTEND Wave 4 |
