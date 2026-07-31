# Posting Result Contract

Implementation: `lib/accountingV2/engine/postingResult.js` (`buildPostingResult`).

Every engine operation returns one standardized, client-safe result object.

## Fields

| Field | Meaning |
| --- | --- |
| `accountingEventId` | `AcctV2EventRegistry.id` for the claimed event |
| `businessId` | Tenant scope |
| `sourceReference` | `{ sourceModule, sourceType, sourceId, sourceNumber }` |
| `eventType`, `eventVersion` | Event identity |
| `architectureVersion` | Always `ACCOUNTING_V2` for engine results |
| `postingMode` | Mode resolved server-side (`NEW_ENGINE`, `SHADOW`, …) |
| `postingStatus` | Event registry status after the operation (`POSTED`, `SHADOWED`, `FAILED`, …) |
| `journalEntryId`, `journalNumber` | Production journal linkage (`null` for shadow postings) |
| `financialYearLabel`, `accountingPeriodId` | Resolved period |
| `postingDate`, `transactionDate` | Both preserved |
| `currency`, `totalDebit`, `totalCredit`, `baseTotalDebit`, `baseTotalCredit` | Decimal strings |
| `wasExistingPosting` | `true` when an idempotent replay returned the original result |
| `wasShadowPosting` | `true` for SHADOW / DUAL_COMPARE outcomes |
| `comparisonStatus` | Shadow comparison classification (or `null`) |
| `warnings[]` | Non-blocking validation findings |
| `requestId`, `correlationId` | Tracing |
| `postedAt`, `postedBy` | Completion metadata |

## Idempotent replay semantics

When the same accounting identity is submitted again after a successful
posting, the engine returns the **original** result rebuilt from the stored
event + journal with `wasExistingPosting: true`. No second journal is created;
tests assert exactly one posted journal survives duplicate requests
(`test/accountingV2.postingEngine.test.js`, "duplicate post request replays
the original result").

Preview results (`previewPosting`) are a distinct shape marked `posted: false`
and never carry a journal ID or number.
