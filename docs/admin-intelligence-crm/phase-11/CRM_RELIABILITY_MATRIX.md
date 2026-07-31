# CRM Reliability Gate Matrix

| Fail condition | Gate state |
|----------------|------------|
| No CrmLead / capture source instrumented | NOT_INSTRUMENTED |
| Email / WhatsApp channel requested but deferred | NOT_AVAILABLE |
| Missing status / assignment / consent history | PARTIAL_HISTORY |
| Recon fail (capture vs Lead, handoff vs Lead) | RECONCILIATION_FAILED |
| Critical DQ (PII missing, invalid source) | DATA_QUALITY_BLOCKED |
| Stale watermark / delayed scoring | STALE / DELAYED |
| Permission / territory scope deny | PERMISSION_RESTRICTED |
| Score / qualification definition missing | DEFINITION_MISSING |

**Never return numeric zero on gate failure.** Never invent Lead volume for NOT_AVAILABLE channels.
