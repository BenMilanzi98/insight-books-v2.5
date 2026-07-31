# Financial Risk Register

| ID | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| FR-001 | Dual report stacks show different numbers | CRITICAL | High | Quarantine legacy; V2-only UI |
| FR-002 | Parent+child capital double display | HIGH | Medium | CoA fold guards + REG-CAP-005; forensic per tenant |
| FR-003 | Stored Account.balance treated as truth | HIGH | Medium | Derive from posted lines only |
| FR-004 | Unbalanced / header-only legacy journals | HIGH | Tenant-dependent | Repair workflow; never silent rewrite |
| FR-005 | Retry/worker double post | HIGH | Low if V2 path | Event registry uniqueness |
| FR-006 | MRA acceptance creating GL/stock | CRITICAL if present | Controlled absent in EIS design | Invariant tests |
| FR-007 | TB plugged with suspense | CRITICAL if present | Guarded in V2 (UNBALANCED status) | Keep no-plug policy |
