# Call State Matrix

| State / transition | Today | Wave 2 target | Class |
|--------------------|-------|---------------|-------|
| PLANNED | NOT_FOUND | YES | Greenfield |
| LOGGED / COMPLETED (manual) | NOT_FOUND | YES | Manual outcomes |
| CONNECTED (telephony) | NOT_AVAILABLE | Boundary only | Do not fabricate |
| RECORDING_AVAILABLE | NOT_AVAILABLE | OFF | Legal stack absent |
| Future timestamp as COMPLETED | N/A | BLOCK | Fail-closed |
| Eligibility BLOCKED | Gate exists | Persist decision | CORRECT_AND_REUSABLE gate |

**Rule:** Manual + planned only until telephony leaves NOT_AVAILABLE.

