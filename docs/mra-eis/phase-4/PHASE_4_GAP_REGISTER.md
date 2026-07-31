# Phase 4 Gap Register

| ID | Gap | Resolution |
|---|---|---|
| G4-001 | Single Boolean eisEnabled overloaded | Separated into entitlement/participation/business/capability |
| G4-002 | hasEISAccess plan selection bug | Fixed EIS plan filter |
| G4-003 | No platform kill switch | MraEisPlatformSetting |
| G4-004 | Legacy fire-and-forget MRA submit | Gated by canSubmitEISInvoice/capability |
| G4-005 | No EIS permissions | eis.* module + system.eis.* admin checks |
| G4-006 | Terminal/config/mappings absent | Represented as future blockers only |

---
*Phase 4 implementation. No MRA API calls from entitlement actions. No terminals activated. No posted Journals modified.*
