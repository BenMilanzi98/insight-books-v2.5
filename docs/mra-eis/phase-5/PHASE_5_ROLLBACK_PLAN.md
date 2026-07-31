# Rollback Plan

- Prefer keep tables (additive) and disable feature flags / platform EIS
- Destructive DROP only with explicit approval after backup
- Do not delete accepted evidence to "roll back"

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
