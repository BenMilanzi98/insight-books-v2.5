# Offline EIS Dependency Audit

| Component | Classification | Notes |
|---|---|---|
| Phase 15 Last Offline adapters | EXTEND | Remain BLOCKED until live contract |
| Phase 12 offline numbering policy | EXTEND | Mock allocation via Phase 16 sequence |
| `offlineSigner.js` (infra crypto) | REQUIRES_CERTIFICATION | Remains blocked; Phase 16 mock signer separate |
| `MraEisOfflineQueueEntry` | EXTEND | Server foundation retained |
| `lib/offlineSalesQueue.js` IndexedDB | UNSAFE_BROWSER_ONLY | Not MRA fiscal |
| `public/sw.js` | UNSAFE_BROWSER_ONLY | POS cache only |
| POS `navigator.onLine` | UNSAFE_BROWSER_ONLY | Insufficient |
| Android SharedPreferences queue | UNSAFE_BROWSER_ONLY | Legacy non-fiscal |
| Electron print helper | NOT_APPLICABLE | Printer only |
| Phase 3 blueprint agent | REUSE | Target architecture |

---
*Phase 16 implementation. Offline mode is disabled by default. Production requires CERTIFIED_PRODUCTION + verified contracts. Browser-only authoritative fiscal signing/storage is prohibited. navigator.onLine / localStorage / IndexedDB are not certified offline. One network failure does not enable offline. Sealed envelopes and queue items are immutable. Upload never reposts Journal/Stock. Unknown uploads require Phase 15 reconciliation. Maintenance does not auto-enable offline. No credentials/JWT/private keys/BAC in evidence.*
