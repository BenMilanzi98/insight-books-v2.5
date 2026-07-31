# Equity Integrity Rules

Implemented in `lib/equityManagement/application/reconciliationService.js`:

| Code | Meaning |
|---|---|
| EQT-001 | Posted equity tx without authoritative journal |
| EQT-003 | Possible duplicate capital posting |
| EQT-012 | Ownership % exceeds 100% |
| EQT-026 | Dividend allocation ≠ declaration |
| EQT-027 | Payment exceeds unpaid allocation |
| EQT-035 | MK1,000,000 capital event appears more than once |

Additional rules from the master prompt are enforced in service validation (mappings, SoD, exit/holdings, authorized shares).
