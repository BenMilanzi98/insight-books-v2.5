# Configuration Contract

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Retrieval

`POST /api/v1/configuration/get-latest-configs` (OpenAPI). Guide sample incorrectly shows GET.

Also embedded in activation response.

## Global

id, versionNo, taxrates[] (id, name, chargeMode, ordinal, rate)

## Terminal

versionNo, terminalLabel, contacts, tradingName, addressLines, offlineLimit{maxTransactionAgeInHours,maxCummulativeAmount}, terminalSite…

## Taxpayer

versionNo, tin, isVATRegistered, taxOffice, activatedTaxRateIds / activatedTaxrates, activated levies

## Refresh triggers

Startup/BOD (engineering): recommended. Sales response `shouldDownloadLatestConfig`. Stale version rejection: RC.

Do not hardcode sample rates as permanent rules.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
