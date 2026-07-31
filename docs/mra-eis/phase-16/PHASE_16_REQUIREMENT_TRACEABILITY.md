# Phase 16 Requirement Traceability

| Requirement | Trace |
|---|---|
| Fail-closed offline | `effectiveOfflineCapability.js` |
| Certification gate | `offlineCertificationPolicy.js` |
| Contracts | `offlineContractRegistry.js` |
| Connectivity debounce | `connectivityStateMachine.js` |
| Clock integrity | `clockIntegrity.js` |
| Signer (no browser keys) | `offlineSigner.js` |
| Sequence atomic | `offlineSequence.js` |
| Envelope seal | `offlineEnvelope.js` |
| Queue integrity | `queueIntegrity.js` |
| Ordered upload | `offlineUploadWorker.js` |
| Browser quarantine | `browserOfflineQuarantine.js` |
| Trusted agent | `trustedAgentService.js` + Prisma |
| Legacy IndexedDB POS | `lib/offlineSalesQueue.js` classified UNSAFE_BROWSER_ONLY |

---
*Phase 16 implementation. Offline mode is disabled by default. Production requires CERTIFIED_PRODUCTION + verified contracts. Browser-only authoritative fiscal signing/storage is prohibited. navigator.onLine / localStorage / IndexedDB are not certified offline. One network failure does not enable offline. Sealed envelopes and queue items are immutable. Upload never reposts Journal/Stock. Unknown uploads require Phase 15 reconciliation. Maintenance does not auto-enable offline. No credentials/JWT/private keys/BAC in evidence.*
