# Payment Method Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

Local keys (`lib/paymentMethods.js`): bank_transfer, airtel_money, mpamba, cash, paychangu (+ credit aliases in GL map).

Free-string `Sale.paymentMethod`. Split via PaymentAllocation.

MRA enum unknown (Phase 1) — mapping table required; invoice EIS path hardcodes Bank Transfer (**defect**).

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
