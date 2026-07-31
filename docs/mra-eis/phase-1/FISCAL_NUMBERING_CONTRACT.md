# Fiscal Numbering Contract

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Algorithm (Developer Guide)

Components: TaxpayerID, TerminalPosition, JulianDate, Count → each Base10→Base64 → join with `-`.

JulianDate: guide provides C# ToJulianDate algorithm (Gregorian JD style).

## Independent verification status

| Check | Result |
|---|---|
| Official worked numeric example reproduced | **NOT COMPLETE** — exact integer byte encoding for Base64 unclear |
| Legacy InsightBooks format TIN-pos-YYYYMMDD-seq | **INCOMPATIBLE** with guide |

**BLOCK implementation** until examples reproduce exactly (clarification Q-021).

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
