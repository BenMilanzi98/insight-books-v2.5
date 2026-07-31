# Permission Audit

## Current permissions (implemented)

From `lib/defaultRoleTemplates.js` / sidebar / API:

| Permission | Usage |
|------------|--------|
| `suppliers.view\|create\|update\|export` | Suppliers nav/API |
| `purchases.view\|create\|update\|export\|delete` | Orders/receipts/bills/payments |

API gate: `/api/purchases` anyOf view/create/update/delete.  
**Gap:** create permission alone may allow posting-sensitive routes if not further checked inside handlers.

## Prompt matrix (not implemented)

Fine-grained:

- `purchases.orders.approve`, `purchases.receipts.post`, `purchases.bills.match`, `purchases.payments.approve`, reconciliation, auditor read-only, etc.

Classification: **`INCOMPLETE`** — coarse CRUD cannot enforce segregation of duties.

## Segregation of duties

| Control | Current |
|---------|---------|
| Creator ≠ approver | Not enforced |
| Receiver ≠ price editor | Not enforced |
| Payment creator ≠ approver | Not enforced |
| Auditor read-only | No dedicated auditor role pack for purchases |

## Approval

Status fields / UI dropdowns — not approval workflow service. Classification: **`REIMPLEMENT`**.

## Disposition

1. Keep existing keys for backward compatibility.  
2. Add granular keys; map old `purchases.update` → subset during migration.  
3. Enforce at route **and** service command layer.
