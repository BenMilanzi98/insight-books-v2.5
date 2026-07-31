# Supplier Data Audit

## Classification: `EXTEND` + `INCOMPLETE`

### Current fields (Prisma `Supplier`)

Identity/contact/commercial/banking are flat single-record fields. Adequate for MVP supplier CRUD; inadequate for compliance, multi-bank, performance, and duplicate governance.

### Uniqueness

- `supplierCode` is **globally** unique — two tenants cannot share the same code string.
- Target: `@@unique([tenantId, supplierCode])`.
- Name is not unique (correct — names alone must not be identity).

### Duplicate detection

**Missing.** No service scoring taxId/VAT/email/phone/bank. Classification: `INCOMPLETE`.

### Merge workflow

**Missing.** Hard delete possible via API if not blocked by FKs — historical docs should archive, not hard-delete. Classification: `UNSAFE` if delete allowed with history.

### Performance metrics

UI may show `currentBalance` (maintained by increments on auto-bill). Ordered/received/billed/paid/on-time rates not computed from source docs. Classification: `INCOMPLETE` / risk of **false balance** if increments and payment allocations diverge from journals.

### Bank-detail audit / approval

Bank fields updated like any PUT — no before/after audit event, no high-risk approval. Classification: `INCOMPLETE` / `UNSAFE` for production AP.

### Permissions

- Nav: `suppliers.view`
- API: `suppliers.*` and purchases gates
- Prompt matrix (`purchases.suppliers.*`) not implemented — see `PERMISSION_AUDIT.md`

### Parallel UIs

`/purchases/suppliers` and `/suppliers` — `CONSOLIDATE`.
