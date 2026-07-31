# EIS Database Schema Blueprint

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Additive entities (conceptual)

MraEisTenantEntitlement · MraEisBusinessSetting · MraEisCertification · MraEisTerminal · MraEisTerminalCredential · MraEisConfigurationSnapshot · MraEisSiteMapping · MraEisExternalProduct · MraEisProductMapping · MraEisTaxMapping · MraEisLevyMapping · MraEisPaymentMethodMapping · MraEisFiscalSequence · MraEisFiscalNumberAllocation · MraEisSnapshot (+Line +Payment) · MraEisTransmission · MraEisTransmissionAttempt · MraEisResponse · MraEisReceiptProjection · MraEisVat5Validation · MraEisOfflineQueueEntry · MraEisOutbox · MraEisReconciliationRun · MraEisReconciliationDifference · MraEisSyncRun · MraEisManualReviewCase

## Legacy

EISInvoice / EISConfiguration / EISSubmissionLog / EISUsage → migrate read-only then supersede; do not dual-write forever.

Do not duplicate Sale/Customer/Product/Journal tables. **Entity count (new conceptual):** ~26.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
