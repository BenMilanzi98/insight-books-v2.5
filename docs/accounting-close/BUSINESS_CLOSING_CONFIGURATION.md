# Business Closing Configuration

Entity: `CloseV2Configuration` (one per tenant).

Services: `lib/accountingClose/application/configService.js`  
API: `PUT/GET /api/accounting-close/config`

Must be `APPROVED` before creating a Year-End Close Run. Stores close method, Income Summary / RE / Owner Capital account ids, drawings/dividend methods, next-year automation, CYE model metadata (`MODEL_A_CALCULATED_REPORTING_LINE`).
