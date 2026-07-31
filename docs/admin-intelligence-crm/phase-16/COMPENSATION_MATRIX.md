# Compensation Matrix

| Failed / partial outcome | Allowed compensation | Forbidden | Present today | Class |
|--------------------------|----------------------|-----------|---------------|-------|
| Unused invitation | Revoke | Delete User with activity | NOT_FOUND | NOT_FOUND |
| Unissued/unpaid Platform Invoice | Cancel/void eligible | Delete paid Invoice | Partial APIs | FOUNDATION |
| Unactivated Subscription | Suspend / mark failed | Blind delete active paid | NOT_FOUND saga | NOT_FOUND |
| Pending entitlements | Revoke pending | Hidden revoke of used | NOT_FOUND | NOT_FOUND |
| Reserved slug | Release | Reassign other Tenant | NOT_FOUND | NOT_FOUND |
| Acceptance evidence | Never delete | — | Preserved | CORRECT_AND_REUSABLE |
| Opportunity Closed Won | Retain; no silent reopen | Auto reopen | Phase 12 terminal | CORRECT_AND_REUSABLE |
| Tenant journals from init | N/A — must not create | Delete journals as "undo" | Init creates CoA/period only | FORBIDDEN journals |
