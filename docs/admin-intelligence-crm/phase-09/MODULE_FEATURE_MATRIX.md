# Module / Feature Matrix (repo-backed seed)

**Policy:** Repo-backed only. PRD extras → NOT_APPLICABLE.

| Module code | Product area (proposed) | Evidence | Wave 1 feature seeds (planned codes) | Instrumentation |
|-------------|-------------------------|----------|--------------------------------------|-----------------|
| invoices | CUSTOMER_AND_SALES | permissionsMap, `/invoice` | `invoices.post` | Wave 1 producer |
| sales | CUSTOMER_AND_SALES | permissionsMap, `/pos` | `sales.pos.complete` | Wave 1 producer |
| eis | MRA_EIS / TAX_AND_COMPLIANCE | permissionsMap, `/eis` | `eis.fiscal.accept` | Wave 1 producer |
| quotations | CUSTOMER_AND_SALES | routes | TBD | NOT_INSTRUMENTED |
| clients | CUSTOMER_AND_SALES | routes | TBD | NOT_INSTRUMENTED |
| inventory | INVENTORY_AND_COMMERCE | `/stock` | TBD | NOT_INSTRUMENTED |
| purchases | PURCHASING_AND_EXPENSES | routes | TBD | NOT_INSTRUMENTED |
| expenses | PURCHASING_AND_EXPENSES | routes | TBD | NOT_INSTRUMENTED |
| accounting | ACCOUNTING_AND_FINANCE | routes | TBD | NOT_INSTRUMENTED |
| generalLedger | ACCOUNTING_AND_FINANCE | routes | TBD | NOT_INSTRUMENTED |
| journalEntries | ACCOUNTING_AND_FINANCE | routes | TBD | NOT_INSTRUMENTED |
| reports | REPORTING_AND_INTELLIGENCE | `/reports-v2` | TBD | NOT_INSTRUMENTED |
| payroll | WORKFORCE_AND_PAYROLL | `/hr` | TBD | NOT_INSTRUMENTED |
| hr | WORKFORCE_AND_PAYROLL | routes | TBD | NOT_INSTRUMENTED |
| budgets | ACCOUNTING_AND_FINANCE | budget-forecast | TBD | NOT_INSTRUMENTED |
| assets | ASSETS_AND_LIABILITIES | asset-management | TBD | NOT_INSTRUMENTED |
| rentals | RENTAL_AND_HIRING | routes | TBD | NOT_INSTRUMENTED |
| tax / taxManagement | TAX_AND_COMPLIANCE | routes | TBD | NOT_INSTRUMENTED |
| bankReconciliation | BANKING_AND_CASH | permissionsMap | TBD | NOT_INSTRUMENTED |
| dashboard | CORE_PLATFORM | routes | discovery-only | NOT value |
| users / roles / settings / branches | ADMINISTRATION_AND_SECURITY | routes | TBD | NOT_INSTRUMENTED |

Cadence defaults (Wave 1 catalogue): POS=`DAILY`, Invoices=`DAILY`/`EVENT_DRIVEN`, Payroll=`MONTHLY`, Reports=`MONTHLY`/`QUARTERLY`, EIS fiscal=`EVENT_DRIVEN`.
