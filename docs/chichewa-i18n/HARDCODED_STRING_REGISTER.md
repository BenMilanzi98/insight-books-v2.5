# Hardcoded String Register

**Scope:** High-traffic surfaces (Wave 0). Full file lint expands in Wave 1+ CI.

| ID | Location | Sample | Class | Action |
|----|----------|--------|-------|--------|
| HS-001 | Sidebar.js | "Dashboard", "Accounting", "POS" | SYSTEM_LABEL | TRANSLATE → navigation.* |
| HS-002 | AppBar.js | Search placeholders, profile menu | SYSTEM_LABEL | TRANSLATE → common/navigation |
| HS-003 | auth/login | "Email", "Password", errors | SYSTEM_LABEL / VALIDATION | TRANSLATE → authentication/validation |
| HS-004 | TaxManagementNav | "Tax codes", "Periods" | SYSTEM_LABEL | TRANSLATE → tax-management |
| HS-005 | emailService.js | Welcome / reset subjects | EMAIL_CONTENT | TRANSLATE → emails (Wave 9) |
| HS-006 | invoice-pdf-generator.js | Column headers | PRINT_LABEL | TRANSLATE → documents (Wave 9) |
| HS-007 | API error strings | "Unauthorized", "Permission denied" | API_ERROR | STANDARDISE codes + messageKey |
| HS-008 | Status chips | DRAFT/POSTED/PAID raw or English | ENUM_LABEL | TRANSLATE via statusLabels |
| HS-009 | Empty states | "No records found" | SYSTEM_MESSAGE | TRANSLATE → common.empty |
| HS-010 | aria-labels | "Main navigation" in AppShell | ACCESSIBILITY_LABEL | TRANSLATE → accessibility |

**Components scanned:** 165  
**Pages scanned:** 203
