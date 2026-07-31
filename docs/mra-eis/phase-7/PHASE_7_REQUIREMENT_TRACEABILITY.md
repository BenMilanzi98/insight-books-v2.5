# Phase 7 Requirement Traceability

| Requirement | Implementation |
|---|---|
| Entitlement/participation gates | `readinessService.js` + Phase 4 capability |
| Server-authoritative readiness | `evaluateTerminalActivationReadiness` |
| Stable identity non-ephemeral | `platformIdentity.js` (`ibeis:{env}:…`) |
| Product ID controlled | `MraEisCertifiedProduct` + env fallback (MOCK) |
| TAC ephemeral | `storeEphemeralSecret` / `withEphemeralSecret` |
| Activation attempts append-only | `MraEisActivationAttempt` |
| HTTP 200 ≠ accept | `parseActivationResponse` |
| JWT/secret encrypt | `storeSecret` in orchestrator tx B |
| Config snapshots immutable | Phase 5 `storeConfigurationSnapshot` |
| Confirmation verified crypto | HMAC-SHA512 KAT; `assertCryptoAllowed` |
| ACTIVE after confirm only | `runTerminalConfirmation` |
| Unknown outcome no blind retry | orchestrator + MANUAL_REVIEW |
| Cross-tenant reject | `assertTenantBusinessMatch` + scoped finds |
| No Sale/Journal/Stock | Activation path has no accounting calls |

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
