# Legal and Regulatory Research

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Disclaimer

This document identifies sources and **does not constitute legal advice**. Classifications mark where counsel/tax professional review is required.

## Instruments identified (via MRA Public Notice)

| Instrument | How identified | Status in pack |
|---|---|---|
| Value Added Tax (Amendment) Act, 2024 — Part II establishing Electronic Tax Invoicing System | Cited in MRA Public Notice | REQUIRES_CONFIRMATION — obtain gazette |
| Value Added Tax (Electronic Invoicing System) Regulations, 2025 — published 9 January 2026 (per notice) | Cited in MRA Public Notice | REQUIRES_CONFIRMATION — obtain gazette |
| Prior Public Notice 31 July 2025 (migration from 2 August 2025) | Cited in transition notice | Locate archive |

## Topics

| Topic | What we can document | Class |
|---|---|---|
| Definition of EIS | FAQ: digital platform for tax invoices + stock records; Notice: software-based electronic tax invoicing & stock | Clear operational guidance from MRA publications |
| Persons required | Notice addresses taxpayers generally for migration; exact legal scope needs Act/Regs | Requires legal counsel |
| Effective / transition dates | Migration from 2 Aug 2025; transition ends 31 Jan 2026 (notice) | Clear in notice; counsel for binding effect |
| Stock-record obligations | Notice + FAQ: maintain stock in EIS | Operational + legal review |
| Tax invoice issuance | Notice: issue tax invoices through EIS | Operational + legal review |
| Third-party software | Guide: non-MRA POS must be certified; productID/version | Technical + legal |
| Penalties / fraud / tampering | Not extracted from primary Act text in this pass | Requires counsel + gazette |
| Retention | Not fully specified in API docs | Requires counsel + regs |
| Exemptions / appeals | Not located | Requires counsel |

## Technical implementation implications (engineering conclusions)

1. InsightBooks must support certified API integration path, not claim to replace legal EIS portal duties.
2. Stock fiscalization and local inventory are related but legally distinct — do not conflate Opening Stock accounting with MRA Virtual Warehouse.
3. Certification before production fiscalization is a vendor obligation per guide.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
