# MRA EIS Official Contract Review

**Date:** 2026-07-22  
**Status:** Documentation complete for discovery; sandbox verification pending.

This is the master-prompt index for the verified official contract. Detail lives in the numbered pack:

| Topic | Document |
|---|---|
| Live URLs & snapshots | [01-OFFICIAL-SOURCES.md](./01-OFFICIAL-SOURCES.md) |
| Full OpenAPI catalogue | [02-SWAGGER-API-REFERENCE.md](./02-SWAGGER-API-REFERENCE.md) |
| Guide behavioural rules | [03-DEVELOPER-GUIDE-DIGEST.md](./03-DEVELOPER-GUIDE-DIGEST.md) |
| Per-endpoint matrix (§5 fields) | [04-API-CONTRACT-MATRIX.md](./04-API-CONTRACT-MATRIX.md) |
| Conflicts & open questions | [05-DISCREPANCIES-AND-OPEN-QUESTIONS.md](./05-DISCREPANCIES-AND-OPEN-QUESTIONS.md) |
| Raw OpenAPI | `swagger-production.v1.json`, `swagger-sandbox.v1.json` |
| Core schemas extract | `core-schemas.extracted.json` |

## Verified functional areas (coverage)

| Area | OpenAPI | Guide | Matrix row |
|---|---|---|---|
| Activate Terminal | Yes | Yes | A1 |
| Confirm Terminal Activation | Yes | Yes | A2 |
| Get Latest Configs | Yes | Yes (method conflict) | B1 |
| Request New Terminal Token | Yes | Thin | B2 |
| Submit Sales | Yes | Yes | C1 |
| Last online / offline | Yes | Yes | C2–C3 |
| Get invoice by number | Yes | Thin | C4 |
| Credit / debit note | Yes | Thin | C5 |
| Void / get voids | Yes | Thin | C6–C7 |
| Ping / product status / site products | Yes | Partial | D* |
| VAT5 / auth code / TIN requirement | Yes | Thin | D5–D7 |
| Terminal block / unblock | Yes | Thin | D8–D9 |
| Initial inventory upload | Yes | Thin | D4 |
| Stock ops + raw material | Yes | Thin | E* |
| Sandbox add-product / HS / UoM | Sandbox only | — | F* |

## Hard rules from review

1. Never invent endpoints or headers.
2. Prefer Swagger for method/path/schema; Guide for crypto and field commentary.
3. Record every conflict in the discrepancy register before coding around it.
4. Re-download OpenAPI at the start of each implementation phase.
