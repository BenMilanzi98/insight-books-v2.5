# Current Contact Model Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| `CrmContact` Prisma model | NOT_FOUND | — |
| Contact numbering (`CON-…`) | NOT_FOUND | — |
| Contact ↔ Account association | NOT_FOUND | — |
| Contact ↔ Platform User verified link | NOT_FOUND | Platform User exists; no CRM Contact bridge |
| Contact ↔ Customer person link | NOT_FOUND | — |
| Demo-request payload person fields | PARTIAL | `clientName`, `email`, `phone` in email body only — not persisted Contact |
| Admin user as Contact | WRONG_DOMAIN | Operator identity ≠ prospect Contact |
| Tenant user as Contact | WRONG_DOMAIN | Product user; link only when verified |

**Implication:** Wave 1 `CrmContact` with optional verified PlatformUser/Customer links. No auto access grant from Contact creation.
