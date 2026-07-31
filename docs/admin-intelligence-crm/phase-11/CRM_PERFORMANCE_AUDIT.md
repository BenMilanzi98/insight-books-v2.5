# CRM Performance Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmLead list query indexes | NOT_FOUND | No tables |
| Hot-path capture latency SLO | NOT_FOUND | Email send path only today |
| Scoring evaluation cost controls | NOT_FOUND | — |
| Timeline pagination design | NOT_FOUND | — |
| N+1 risk on Account→Contacts→Leads | N/A | Greenfield — design indexes in Wave 1 |
| Support ticket list perf as CRM baseline | WRONG_DOMAIN | Different volume profile |

**Implication:** Wave 1 schema includes indexes for number, status, owner, source, email/phone uniqueness candidates. Capture path must stay idempotent and fast under retry.
