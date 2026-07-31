# Duplicate Billing Risk Register

**Date:** 2026-07-28

| ID | Risk | Severity | Status |
|----|------|----------|--------|
| BILL-01 | PayChangu success without PlatformPayment → dual ledger drift | Critical | Open |
| BILL-02 | Manual payment idempotency uses Date.now() | High | Open |
| BILL-03 | Renewal Job / admin retry without period uniqueness enforcement in all paths | High | Open |
| BILL-04 | Client amount accepted on create-session | Critical | Open |
| BILL-05 | Fiscal EISInvoice.subscriptionId mistaken for SaaS invoice proof | Medium | Open |
| BILL-06 | Overpayment not auto-credited | Medium | Open |
| BILL-07 | Overage retries could double-invoice (future) | High | Design required |
