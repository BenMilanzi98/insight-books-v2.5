# Audit Tamper Evidence

## Mechanism

`SecV2AuditEvent` rows store:

- `integrityHash` — SHA-256 over event material + previous hash
- `previousHash` — prior event hash for the business chain

Verification: `verifyAuditChain` / `GET /api/security-governance/audit?integrity=1`.

## Guarantees

- **Tamper-evident** within the application store: altered fields break hash verification.
- **Append-only** at the application service layer (`updateAuditEvent` / `deleteAuditEvent` throw; HTTP PATCH/DELETE return 405).
- **Not** claiming HSM-backed non-repudiation or WORM storage unless infrastructure is separately configured.

## Residual risk

A database superuser could still alter rows and recompute hashes. Mitigate with least-privilege DB roles, backups, and optional external archive (Phase 16+).
