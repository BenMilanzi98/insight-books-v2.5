# Secret Management

## Rules

- Never commit production secrets (`.env` with live credentials must stay local / secret store).
- Never log passwords, session tokens, API keys, MFA secrets, or encryption keys.
- API keys are stored as SHA-256 hashes (`SecV2ApiKey.keyHash`); raw secret shown once at creation.
- Session signing uses `SESSION_SIGNING_SECRET` (or fallback `NEXTAUTH_SECRET` / `JWT_SECRET`).
- Webhook secrets verified via HMAC; rotate by updating integration secret and dual-verify during cutover.
- CRON / job secrets (`CRON_SECRET`) remain environment-only.

## Inventory (application)

| Secret | Purpose | Storage | Rotation |
|---|---|---|---|
| `DATABASE_URL` | DB connection | env | coordinated |
| `SESSION_SIGNING_SECRET` | HMAC session tokens | env | revoke sessions after rotate |
| Admin JWT secret | Platform admin | env (`adminAuth`) | revoke admin cookies |
| `CRON_SECRET` | Scheduled jobs | env | update callers |
| EIS / integration keys | Tax integrations | DB encrypted fields where present | per vendor |
| API keys (tenant) | Machine access | hashed in `SecV2ApiKey` | revoke + recreate |

## Production checklist

1. Set `SESSION_SIGNING_SECRET` to a long random value.
2. After all clients upgraded, set `ALLOW_LEGACY_UNSIGNED_SESSION=false`.
3. Rotate any secrets that appeared in logs or tickets.
4. Do not embed secrets in frontend bundles or documentation examples.
