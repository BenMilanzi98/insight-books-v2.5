# CS Workflow Matrix

| Workflow | Trigger | Artifact | Idempotency | Mutates source facts? |
|----------|---------|----------|-------------|------------------------|
| Case from signal | Open Phase 7 signal (verified codes) | CsCase | `tenantId+SIGNAL+code+ruleVersion` | No |
| Case from health | Snapshot band AT_RISK / CRITICAL | CsCase | `tenantId+HEALTH+band+definitionVersion+day` | No |
| Manual case | Agent create | CsCase | Manual key / none | No |
| Task | Case or playbook step | CsTask | stepId + executionId | No |
| Intervention | Agent logs action | CsIntervention | Per create | No |
| Playbook run | Manual or case rule | CsPlaybookExecution | playbookVersion + tenant + case | No |
| Renewal workspace | Renewal due / agent open | CsRenewalWorkspace | tenant + period | Outcome only with sub evidence |
| Success plan | Agent create | CsSuccessPlan / Goals | — | No |
| Expansion handoff | Agent create | CsExpansionHandoff | — | No (no auto upgrade) |
| Onboarding progress | Source rows only | Foundation | — | No invent from login |
| Signal ACK only | Phase 7 | CustomerSignal | Existing | No case substitute |

**Allowed signal→case codes (v1):**  
`NO_MEANINGFUL_ACTIVITY`, `RENEWAL_DUE_SOON`, `HIGH_OUTSTANDING_BALANCE`, `SUBSCRIPTION_SUSPENDED`, `MRA_EIS_ENTITLEMENT_PENDING`, `CUSTOMER_OWNER_MISSING`.

**Never auto-case from:** FEATURE_USED, CHURN_PROBABILITY, SUPPORT_*, ONBOARDING_*, TRAINING_*.
