# CS Security Matrix

| Action | Permission (planned) | Portfolio rule |
|--------|----------------------|----------------|
| View Command Centre / lists | `customerSuccess.read` | Scoped tenants only |
| Create/update case | `customerSuccess.manageCases` | Tenant in portfolio |
| Assign task | `customerSuccess.manageCases` | Assignee is admin; tenant in portfolio |
| Log intervention | `customerSuccess.manageCases` | Same |
| Run playbook | `customerSuccess.managePlaybooks` | Same |
| Set renewal outcome | `customerSuccess.manageRenewals` | Requires subscription evidence check |
| Create expansion handoff | `customerSuccess.manageHandoffs` | No billing mutation |
| View health from CS | `customerHealth.read` OR linked embed with same | Same portfolio |
| Super Admin | Bypass portfolio? | Prefer still audit; follow Phase 7 convention (super allowed) |

**Forbidden:** Cross-portfolio case search returning foreign tenant ids; CS APIs that update `AccountSubscription`, `PlatformInvoice`, or EIS entitlement.
