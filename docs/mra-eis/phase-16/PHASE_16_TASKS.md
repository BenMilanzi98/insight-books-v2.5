# Phase 16 Tasks

| Stream | Status |
|---|---|
| Offline dependency audit | DONE |
| Gap register | DONE |
| Contract re-verification | DONE (mock provisional; prod BLOCKED) |
| Certification + capability policies | DONE |
| Deployment architecture decision | DONE (browser prohibited; agent required) |
| Trusted Agent model | DONE |
| Connectivity / clock / limits | DONE |
| Signer + sequence + envelope | DONE (mock) |
| Queue integrity + ordered upload | DONE (mock) |
| Browser quarantine | DONE |
| API + admin UI | DONE |
| Permissions | DONE |
| Unit tests | DONE |
| Docs + Phase 17 handover | DONE |
| Live/production offline contracts | BLOCKED |
| Full encrypted SQLite agent runtime | BLOCKED / deferred to certified agent build |
| Last Offline live query | BLOCKED (Phase 15 carry-forward) |

---
*Phase 16 implementation. Offline mode is disabled by default. Production requires CERTIFIED_PRODUCTION + verified contracts. Browser-only authoritative fiscal signing/storage is prohibited. navigator.onLine / localStorage / IndexedDB are not certified offline. One network failure does not enable offline. Sealed envelopes and queue items are immutable. Upload never reposts Journal/Stock. Unknown uploads require Phase 15 reconciliation. Maintenance does not auto-enable offline. No credentials/JWT/private keys/BAC in evidence.*
