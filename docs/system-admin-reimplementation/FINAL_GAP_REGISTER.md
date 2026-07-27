# Final Gap Register — Prioritized for Phases 1–6

Gaps are ordered within each phase by severity.

## Phase 1 — Foundation & safety

| Gap ID | Gap | Classification | Exit criteria |
|--------|-----|----------------|---------------|
| G1-01 | Unauthenticated `/api/admin/test-*` / debug routes | SECURITY_RISK | Removed or 404 outside local |
| G1-02 | No JWT validation in middleware | SECURITY_RISK | Invalid/expired token redirected |
| G1-03 | Missing `systemAdmin.*` catalog | INCOMPLETE | Catalog module + Super Admin still works |
| G1-04 | CoA UI still in nav + live editor | REMOVE pending | Redirect `?notice=coa-removed`; APIs live |
| G1-05 | Duplicate stub routes live | STUB / REMOVE | affiliate-system & audit-logs redirect |
| G1-06 | Invoices API unlabeled tenant AR | DUPLICATE_BILLING_RISK | Warning domain tag or route disabled from UI |
| G1-07 | Mock users/roles API | STUB | Marked deprecated or returns real Admin roles |

## Phase 2 — Shell & navigation

| Gap ID | Gap | Classification | Exit criteria |
|--------|-----|----------------|---------------|
| G2-01 | Emoji sidebar + inline styles vs tokenized shell | STANDARDISE | Design tokens + Lucide nav |
| G2-02 | Collapsed sidebar drops nav | NON_RESPONSIVE | Icon rail works |
| G2-03 | No permission-filtered nav | INCOMPLETE | Items gated by catalog |
| G2-04 | AppBar/Footer tenant leftovers | STANDARDISE | Admin-specific chrome |
| G2-05 | PrismaClient antipattern on legacy APIs | REFACTOR | Shared prisma singleton |

## Phase 3 — Core ops

| Gap ID | Gap | Classification | Exit criteria |
|--------|-----|----------------|---------------|
| G3-01 | Tenant delete / manage without fine perms | SECURITY_RISK | `systemAdmin.tenants.*` enforced |
| G3-02 | AdminTenantAccess unused | INCOMPLETE | Scoped admins respected or deferred explicitly |
| G3-03 | Subscription dual status fields UX | INCOMPLETE | Clear active/trial/expired model in UI |
| G3-04 | Affiliate densormalized totals drift | DATA | Recompute or reconcile job |
| G3-05 | Mobile retention policy | EXTEND | Documented + optional purge |
| G3-06 | Bulk email permission + audit | SECURITY_RISK | Permission + AdminAuditLog |

## Phase 4 — MRA EIS admin

| Gap ID | Gap | Classification | Exit criteria |
|--------|-----|----------------|---------------|
| G4-01 | EIS pages STANDARDISE to new shell/nav | STANDARDISE | Nested IA under mra-eis |
| G4-02 | Mapping/catalogue pagination | PERF | Paged APIs/UI |
| G4-03 | Clarify EISInvoice vs platform billing in UI copy | DUPLICATE_BILLING_RISK | No SaaS invoice confusion |

## Phase 5 — Platform billing

| Gap ID | Gap | Classification | Exit criteria |
|--------|-----|----------------|---------------|
| G5-01 | Missing `PlatformInvoice` (+ payments) | MISSING / REIMPLEMENT | Schema + migrations |
| G5-02 | Stub invoices/payments pages | STUB | Real UI or hidden |
| G5-03 | `/api/admin/invoices` wrong domain | DUPLICATE_BILLING_RISK | Split/rename APIs |
| G5-04 | Billing overview disconnected | DISCONNECTED | Driven by subscriptions + platform ledger |
| G5-05 | subscription-payment role unclear | REFACTOR | Documented admin vs tenant path |

## Phase 6 — Observability & settings

| Gap ID | Gap | Classification | Exit criteria |
|--------|-----|----------------|---------------|
| G6-01 | Global settings stub | STUB / REIMPLEMENT | Persisted settings store |
| G6-02 | Dashboard analytics incomplete | INCOMPLETE | Real aggregates, labeled SaaS-only |
| G6-03 | Audit store fragmentation | CONSOLIDATE | Unified admin audit reader |
| G6-04 | SecV2 admin surfaces thin | INCOMPLETE | Monitoring/compliance MVP |
| G6-05 | Test coverage near-zero outside EIS | INCOMPLETE | Phase test bars met |
| G6-06 | AdminActivityLog schema smell | REFACTOR | Fixed or migrated |

## Cross-phase non-goals

- Redesigning tenant `/chart-of-accounts`
- Replacing MRA EIS domain model
- Inventing new path names that duplicate `tenant-management`, `user-management`, etc.
