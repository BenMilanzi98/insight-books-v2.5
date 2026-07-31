# Evidence and Confidence Framework

Levels (`ConfidenceLevel` in the catalogue):

| Level | Meaning | Gate |
|---|---|---|
| `CONFIRMED` | Direct, conclusive evidence (measured from the data itself). | Repair may be approved. |
| `HIGH_CONFIDENCE` | Multiple independent indicators agree. | Repair may be approved after finance review. |
| `MEDIUM_CONFIDENCE` | Likely but unresolved ambiguity. | Investigation required; approval refused. |
| `LOW_CONFIDENCE` | Similarity only. | No automatic repair; approval refused. |
| `UNSUPPORTED` | No reliable evidence. | Approval refused; exception is the only path. |

`REPAIRABLE_CONFIDENCE = [CONFIRMED, HIGH_CONFIDENCE]` is enforced in
`decideRepair`: approving an anomaly below the gate throws, regardless of role.
This is what guarantees "no unsupported balancing entries" — an unsupported
liability structurally cannot reach an approved journal-creating repair.

## Evidence records

`AcctV2RepairEvidence` rows are append-only, business-scoped and audited:
`evidenceType`, `description`, structured `payload`, external `reference`,
`strength` (a confidence level), `recordedBy/At`. Detection attaches its
measured payloads automatically in `metadata`; investigators add documents,
reconciliations and reviewer conclusions via the API/console.

Every proposal (`proposeRepair`) stores the repair type, structured repair data
and a mandatory documented reason; every decision (`decideRepair`) stores the
reviewer, timestamp and approval/rejection reason in the immutable audit trail.

Detection confidence assignment: measured rule findings are `CONFIRMED`;
duplicate postings with identical totals are `HIGH_CONFIDENCE` (a human still
confirms neither is a legitimate repeat); duplicates with differing totals,
orphan journals and opening duplication are `MEDIUM_CONFIDENCE` (classification
or authoritative-batch selection is a review decision, never automatic).
