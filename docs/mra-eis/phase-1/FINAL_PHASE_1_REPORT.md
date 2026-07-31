# Final Phase 1 Report

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## 1. Executive summary

Phase 1 established an evidence-backed MRA EIS research and verified contract pack. Production OpenAPI is public (EISAPI 1.0, 28 paths). Sandbox adds 3 stock helpers. Developer guide and portal materials document activation HMAC, offline intent, certification, and onboarding. Critical ambiguities remain (message-hash, fiscal Base64 examples, SaaS terminal identity, refunds/returns, offline KATs). Decision: **READY_WITH_OPEN_CLARIFICATIONS**.

## 2. Phase boundary

Research only. No production DB entities, activations, sales, fiscal numbers for use, or POS/invoice behaviour changes.

## 3. Methodology

Source hierarchy applied. Public GETs + archived OpenAPI/guide. Confidence labels on findings. No authenticated fiscal calls.

## 4–6. Sources / freshness / status

See OFFICIAL_SOURCE_INVENTORY.md and CURRENT_EIS_STATUS.md. Transition notice: EIS migration deadline **31 Jan 2026**; Regulations 2025 cited.

## 7–8. Legal

Instruments identified; counsel questions in LEGAL_QUESTIONS_FOR_COUNSEL.md. Not legal advice.

## 9–17. Ecosystem / onboarding / inventory / terminals

Documented from FAQ + pre-integration guide + OpenAPI. SaaS questions blocking.

## 18–22. Swagger / OpenAPI / environments / endpoints

OpenAPI available. Prod endpoints: 28. Sandbox-only: 3. Matrix + sheets complete.

## 23–32. Request/response/auth/crypto/errors

Envelope documented. Auth JWT guide-only. x-signature confirmed for confirmation with KAT. x-eis-message-hash unverified. statusCode conflict documented.

## 33–50. Domain contracts

Activation, config, tax/levy, product status, inventory upload, site products (POST preferred), sales request/response, B2B, VAT5, payments (no enum), fiscal numbering (blocked), receipts/QR, last online/offline covered in dedicated files.

## 51–70. Offline / blocking / ping / corrections / versioning / retention / privacy / security / certification

See respective contracts. Offline blocked pending certification+KAT. Corrections APIs exist but refund/return matrix incomplete. Certification process documented; IB not certified.

## 71–84. Discrepancies / clarifications / dictionaries / plans

Discrepancies registered. Clarifications: 50 (blocking subset listed in readiness). Data dictionary & enums started. Sandbox plan & contract tests specified but not executed.

## 85–90. Assumptions / handover / risks / blockers

See INSIGHTBOOKS_INTEGRATION_ASSUMPTIONS, PHASE_2_HANDOVER, PHASE_1_RISK_REGISTER, PHASE_1_READINESS_DECISION.

## 91–94. Confirmations

- No production credentials used
- No production/sandbox fiscal transactions submitted
- No endpoint invented beyond OpenAPI
- Unresolved discrepancies visible in registers

## 95–97. Decision & next action

**READY_WITH_OPEN_CLARIFICATIONS** → Proceed to Phase 2 internal audit; submit clarification register to MRA; obtain sandbox credentials for verification plan.

## Honest final conclusion

The external API surface is knowable and archived. Several security-critical and fiscal-critical rules are still ambiguous. Implementing sales fiscalization or offline mode now would risk non-compliance. Phase 2 should map IB architecture while clarifications proceed in parallel.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
