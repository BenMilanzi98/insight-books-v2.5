# Funnel Matrix (planned)

| Funnel code | Steps | Population | Live today |
|-------------|-------|------------|------------|
| `commerce.invoice.value` | Entitled → Available → First Invoice Post → Repeat | Invoice-entitled tenants | INSTRUMENTED (Wave 4; incomplete if events missing) |
| `commerce.pos.value` | Entitled → First POS Complete → Repeat | POS-entitled | INSTRUMENTED (Wave 4; incomplete if events missing) |
| `eis.operational` | Entitled → Available → First Accepted → Repeat | EIS commercial | INSTRUMENTED (Wave 4; config/terminal stages deferred) |

Rules: no later step without evidence; retries don’t duplicate; missing events → incomplete — not zero conversion.
Definition version: `product-funnels-2026-07-29`.
