# Current Feature Control Audit

## Found
- Subscription EIS plans: eis-monthly / eis-yearly (`lib/subscriptionConfig.js`)
- `hasEISAccess` (buggy before Phase 4) + `Tenant.eisEnabled`
- Legacy `EISConfiguration` / `EISInvoice` / `app/api/eis/*` / `lib/eisService.js`
- Admin auth: `lib/adminAuth.js` + Super Admin short-circuit
- Feature flags pattern: `AcctV2FeatureFlag` (not used for EIS before Phase 4)
- Approvals: SecV2 approval engine (not wired to EIS before Phase 4)
- Audit: AdminAuditLog + new MraEisControlAuditEvent
- Tenant = Business (no separate Business model)

## Gaps closed in Phase 4
- Platform status + emergency pause
- Explicit entitlement aggregate
- Participation vs operational settings
- Canonical capability policy
- Admin + tenant UIs

---
*Phase 4 implementation. No MRA API calls from entitlement actions. No terminals activated. No posted Journals modified.*
