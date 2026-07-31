# Subscription Action Matrix

| Action | Source of truth | Present today | Class |
|--------|-----------------|---------------|-------|
| Create trial on Tenant create | Admin path | Yes — pending trial | FOUNDATION / SUBSCRIPTION_DUPLICATION_RISK |
| Upgrade plan | `upgradeTenantSubscription` | Yes | FOUNDATION |
| Create from accepted commercial snapshot | Conversion | No | NOT_FOUND |
| Amend for expansion | New Subscription version | Partial | FOUNDATION / EXTEND |
| Duplicate active guard | `assertNoDuplicateActiveSubscription` | Helper yes | CORRECT_AND_REUSABLE |
| Force ACTIVE on Closed Won | — | No (forbidden) | FORBIDDEN |
| BranchSubscription as platform sub | Branch add-on | Exists | WRONG_DOMAIN if aliased |
