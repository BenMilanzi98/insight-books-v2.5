# Mapping APIs

| Endpoint | Purpose |
|---|---|
| GET `/api/mra-eis/mappings/readiness` | Readiness |
| GET `/api/mra-eis/mappings/completeness` | Completeness |
| GET `/api/mra-eis/mappings/sites` | Site catalogue |
| GET/POST `/api/mra-eis/mappings` | List/create |
| POST `/api/mra-eis/mappings/suggest` | Suggestions |
| POST `/api/mra-eis/mappings/resolve` | Resolution |
| POST `/api/mra-eis/mappings/revalidate` | Revalidation |
| POST `/api/mra-eis/mappings/{kind}/{id}/{action}` | verify/approve/activate/supersede |
| GET `/api/admin/mra-eis/mappings` | Admin health |

Browser cannot force ACTIVE or environment bypass.

---
*Phase 9 implementation. Suggestions never auto-activate. No Product/Service sync. No Sale submission. No fiscal numbers. No Journal/Stock mutations. Zero-rated ≠ exempt. VAT5 separate. Split payments fail-closed. Virtual Warehouse blocked pending MRA clarification.*
