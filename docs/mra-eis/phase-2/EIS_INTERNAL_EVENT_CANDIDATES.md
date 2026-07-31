# EIS Internal Event Candidates

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

| Candidate | Once? | Final totals? | In DB tx? | Journal? | Exclude drafts/payments? | Score |
|---|---|---|---|---|---|---|
| POS_SALE_COMPLETED (status completed) | Should | Yes | Yes | Yes | Yes | HIGH |
| SALES_INVOICE_ISSUED (non-Draft) | Should | Yes | Yes | Yes | Yes | HIGH |
| SALE_ACCOUNTING_POSTED | Yes if registry | Yes | Yes | Yes | Yes | HIGH |
| PAYMENT_RECEIVED | No | — | — | — | **Exclude** | REJECT |
| RECEIPT_CREATED | No | Late | No | Maybe | Weak | LOW |
| Current post-commit eisService | No durable | After | No | Maybe | — | REJECT |

**Recommended:** emit `SALE_FISCALIZATION_ELIGIBLE` from POS and Invoice adapters **inside** finalize transaction after successful posting claim, carrying sourceType/sourceId/version.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
