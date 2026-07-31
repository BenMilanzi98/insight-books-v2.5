# Offline Deployment Architecture

## Selected default
`BROWSER_ONLY_PROHIBITED`

## Approved future deployment shapes (when certified)
- `CENTRAL_SERVER_WITH_DEVICE_AGENT`
- `CENTRAL_SERVER_WITH_BRANCH_AGENT`
- `MANAGED_DESKTOP_POS_AGENT`

## Trust boundary
- Signing + sequence + encrypted queue live in non-browser agent
- Central server owns registration, certification, upload coordination, reconciliation
- Browser POS may display status only; cannot seal/sign/clear queues

---
*Phase 16 implementation. Offline mode is disabled by default. Production requires CERTIFIED_PRODUCTION + verified contracts. Browser-only authoritative fiscal signing/storage is prohibited. navigator.onLine / localStorage / IndexedDB are not certified offline. One network failure does not enable offline. Sealed envelopes and queue items are immutable. Upload never reposts Journal/Stock. Unknown uploads require Phase 15 reconciliation. Maintenance does not auto-enable offline. No credentials/JWT/private keys/BAC in evidence.*
