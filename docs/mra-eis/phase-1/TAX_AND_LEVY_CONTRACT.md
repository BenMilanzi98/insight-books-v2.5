# Tax and Levy Contract

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## API representation

- Tax rates from globalConfiguration.taxrates; line taxRateId; summary taxBreakDown{rateId,taxableAmount,taxAmount}
- Levies: levyBreakDown; activated levies on taxpayer config
- chargeMode examples in samples: Item, Global

## Separations

| Layer | Role |
|---|---|
| MRA API | Authoritative rates/versions for fiscal payload |
| InsightBooks tax | Local catalog — must map, not invent MRA IDs |
| Legal treatment | Counsel/tax advisor |

Rounding/scale: RC. Sample rates (e.g. 16.5) are examples only.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
