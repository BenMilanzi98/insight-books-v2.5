# EIS Ecosystem and Actors

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

| Actor | Responsibilities | Data owned | Approvals | Security boundary | Evidence |
|---|---|---|---|---|---|
| Malawi Revenue Authority | Operate EIS, certify vendors, enforce tax rules | Fiscal registry, configs | Certification, stock approvals | MRA systems | Notice, FAQ, Guide |
| EIS Taxpayer Portal | Onboarding, inventory, services, reporting | Taxpayer master, stock | Portal workflows | Taxpayer auth | Portal FAQ |
| EIS Back Office | Approvals, validation of receipts | Officer workflows | Informal purchase, mappings | MRA staff | FAQ |
| Taxpayer / Business | Register, upload stock, issue invoices | Business ops data | Internal | Tenant boundary | Notice |
| Branch / Site | Trading location | siteId, stock at site | — | Mapped to terminal site | Config / FAQ |
| Virtual Warehouse | Central stock before site transfer | Warehouse inventory | Transfers | Portal/API | FAQ + stock API |
| Product / Service | Sellable items | Codes, tax, qty | Mapping approval | MRA catalogue | Pre-integration guide |
| Terminal | Fiscal device/software instance | terminalId, JWT, secretKey | Activation | Highest secret boundary | Activation API |
| Third-party vendor | Certified POS/accounting software | productID/version | Certification | Vendor org | Certification guide |
| Cashier / Admin | Operate POS | Operational | Role-based | Tenant RBAC | FAQ POS |
| Buyer / TIN holder | Receive invoice; may need auth code | Buyer TIN | Auth codes | Sensitive | B2B guide/utilities |
| Software certification team | Inspect & certify | Product registry | Issue productID | MRA | Certification process |
| Support | 672 / callcentre@mra.mw | Tickets | — | — | FAQ |

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
