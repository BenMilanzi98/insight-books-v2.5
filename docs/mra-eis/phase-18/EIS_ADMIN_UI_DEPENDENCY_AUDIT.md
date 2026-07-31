# EIS Admin UI Dependency Audit

| Component | Classification |
|---|---|
| `/settings/integrations/mra-eis/*` phase pages | WRAP / EXTEND |
| `/insightbooks/mra-eis/*` platform pages | EXTEND |
| `/api/mra-eis/*` domain APIs | REUSE |
| Sidebar (no EIS before) | EXTEND |
| Inline tables / filters | REUSE |
| Export centre (missing) | NEW via exportSecurity |
| Set Active / Clear MRA / blind retry UI | UNSAFE — remain blocked |
| Phase 15–17 seed pages | WRAP as workspaces |

---
*Phase 18 implementation. Operational window over Phases 1–17. No fiscal engine duplication. Server-authoritative Tenant/Business/Environment context. Failed queries ≠ zero. Stale data labelled. Commands are intent-only (no arbitrary final states). No Set Terminal Active / Mark Accepted / Clear MRA without evidence. No credentials/JWT/private keys/BAC in UI or exports. Saved views do not grant permissions. Scheduled/export permission rechecked. No Journal/Stock from Phase 18. No historical Sale submission.*
