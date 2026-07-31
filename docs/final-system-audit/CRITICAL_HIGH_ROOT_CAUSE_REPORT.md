# Critical & High Root Cause Report

## FSA-CRIT-001 Dual report stacks

**Root cause:** Parallel evolution of legacy report services and Accounting V2 reporting without hard cutover.

**Impact:** Trial Balance / Balance Sheet / P&L / Cash Flow can disagree for the same business/period.

**Fix:** Route all financial UI + exports to V2; feature-flag or remove legacy; add parity tests then delete legacy.

## FSA-HIGH-001 Outbox dispatcher

**Root cause:** Enqueue implemented; consumer not shipped.

**Fix:** Implement leased claim dispatcher with idempotent handlers + metrics.

## FSA-HIGH-002 Forensic pending

**Root cause:** Audit libraries exist; production extracts not authorized/executed in this session.

**Fix:** Run READ-ONLY audits per tenant; open repair cases; no silent rewrite.
