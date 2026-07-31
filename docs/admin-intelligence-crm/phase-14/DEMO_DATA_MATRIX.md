# Demo Data Matrix

| Pack / data class | Today | Allowed in Demo env | Class |
|-------------------|-------|---------------------|-------|
| Safe synthetic data pack | NOT_FOUND | Yes | NOT_FOUND → Wave 3 |
| Anonymised synthetic catalogue | NOT_FOUND | Yes if non-Production | NOT_FOUND |
| Production Tenant DB clone | Absent | Never | FORBIDDEN |
| Live Customer PII pack | Absent | Never | FORBIDDEN |
| Production payment credentials | Absent | Never | FORBIDDEN |
| MRA EIS production secrets | MRA plane | Never on Demo env | WRONG_DOMAIN / FORBIDDEN |
| CRM Lead/Opportunity rows as env pack | CRM plane | Never as env data | FORBIDDEN |
| FP historical "demo" defaults | FP plane | Never alias | WRONG_DOMAIN |
| Vitest fixtures | Test plane | Not runtime packs | WRONG_DOMAIN |

**Rule:** Production-data detection must fail closed on provision/reset.
