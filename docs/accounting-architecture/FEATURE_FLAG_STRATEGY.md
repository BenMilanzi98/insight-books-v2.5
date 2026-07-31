# Feature Flag Strategy

Implementation: `lib/accountingV2/infrastructure/featureFlags.js` + `AcctV2FeatureFlag` /
`AcctV2Configuration` tables. All evaluation is server-side; browsers cannot influence
posting behaviour (boundary tests forbid V2 infrastructure imports in client code).

## Flags

| Flag | Effect |
|---|---|
| `accountingV2Enabled` | Master gate for NEW_ENGINE/DUAL_COMPARE. **Cannot be enabled via the admin API in Phase 2** (hard 409). |
| `accountingV2ShadowMode` | Upgrades LEGACY baseline to SHADOW (requires config consent `enableShadowAccounting`). |
| `accountingV2NewJournalSchema` | Reserved: switch to V2 journal persistence (Phase 5). |
| `accountingV2NewLedgerQuery` | Reserved: ledger reads from V2 read model (Phase 5). |
| `accountingV2NewTrialBalance` | Reserved: TB from V2 (Phase 7). |
| `accountingV2StrictIdempotency` | Reserved: escalate registry conflicts from warning to rejection on legacy-path duplicates (Phase 4). |
| `accountingV2StrictTenantValidation` | Reserved: enforce tenancy pre-checks on legacy delegation paths (Phase 4). |
| `accountingV2AuditOnly` | Containment: forces non-legacy activity to DISABLED. |

Unknown flag keys evaluate to `false` and cannot be stored (`setFlag` throws).

## Scoping and precedence

Rows are scoped `(tenantId, flagKey, moduleKey, eventType)` with `*` sentinels. Most-specific
row wins: tenant+module+event > tenant+module > tenant > global-scoped > global. Default when
nothing matches: **false** (deny). Percentage rollout is intentionally not implemented —
deterministic per-business activation is the only safe granularity for financial behaviour.

## Posting-mode resolution (`resolvePostingMode`)

1. No `AcctV2Configuration` row → `LEGACY` (system default; true for every tenant today).
2. `defaultPostingMode` is the baseline; `DISABLED` short-circuits.
3. `accountingV2AuditOnly` forces non-legacy baselines to `DISABLED`.
4. `NEW_ENGINE`/`DUAL_COMPARE` baselines additionally require `accountingV2Enabled` for the
   scope — configuration alone can never activate the engine (degrades to SHADOW/LEGACY).
5. `SHADOW` requires `enableShadowAccounting` consent; otherwise LEGACY.

## Administration

Changes go through `POST /api/system/accounting-architecture` only: authenticated session,
`accountingArchitecture.configure` / `accountingFeatureFlags.manage` permission, Zod-validated
payload, mandatory reason, tenant-scope enforcement (tenant admins cannot touch other tenants
or global rows), and an `AuditLog` record with previous/new values. Flag tests cover legacy /
shadow / degraded-new-engine / disabled modes, business scoping, and unknown-key rejection.
