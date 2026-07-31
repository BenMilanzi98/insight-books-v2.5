# Attachment Security Matrix

| State | Downloadable? | Notes |
|-------|---------------|-------|
| UPLOADED / PENDING_SCAN | No | |
| CLEAN | Yes if ACL allows | Expiring link + reauth |
| QUARANTINED / INFECTED | No | Security notify |
| SCAN_FAILED | No | Fail closed |
| REJECTED / DELETED | No | |

Storage: private object keys — **not** `public/uploads`. MIME validated server-side.
