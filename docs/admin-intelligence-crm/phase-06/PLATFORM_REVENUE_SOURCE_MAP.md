# Platform Revenue Source Map

```text
Plan / PlatformPlanVersion (CORE | MRA_EIS)
        ↓
AccountSubscription (commercial commitment)
        ↓
Billing period / renewal (expiresAt, paymentDate)
        ↓
PlatformInvoice (+ lines when present)
        ↓
PlatformPayment (allocation to invoice when present)
        ↓
PlatformCredit / PlatformRefund
        ↓
Analytics events/facts/snapshots (derived)
        ↓
Revenue Intelligence packs (read models)
```

| Economic meaning | Authoritative store |
|------------------|---------------------|
| Contracted recurring (estimated MRR) | Active paid `AccountSubscription` amounts normalised by plan period |
| Billed | `PlatformInvoice` totals |
| Collected | `PlatformPayment` with successful status |
| Outstanding | `PlatformInvoice.outstanding` / unpaid status |
| Credits | `PlatformCredit` |
| Refunds | `PlatformRefund` |

**Never:** Tenant `Sale`, tenant `Invoice` (AR), `EISInvoice` (fiscal), tenant journals.
