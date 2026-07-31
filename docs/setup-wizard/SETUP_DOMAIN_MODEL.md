# Setup Domain Model (Slice 1)

**Date:** 2026-07-22  
**Forks:** A3 · B1 · C2 · D2

## Aggregates

### `BusinessSetupRun`

Authoritative setup session per business version.

| Field | Purpose |
|---|---|
| `tenantId` + `setupVersion` | Unique business setup version |
| `setupType` | NEW_BUSINESS, EXISTING_BUSINESS_CONVERSION, … |
| `status` | Run state machine |
| `currentStepId` | Active wizard step |
| `openingBalanceDate` / `cutoverDate` | Opening position dates |
| `draftVersion` | Optimistic concurrency |
| `openingBalanceBatchId` / `journalEntryId` | Link to V2 OB batch + single journal (B1) after posting slice |
| `activityClassification` | D2 classifier result at start |

### `BusinessSetupStep`

One row per catalogue step (23). Holds `payload` JSON draft, status, optional flag.

## Posting authority (later slice)

Compiler → one `AcctV2OpeningBalanceBatch` → one Opening Journal via Posting Engine.

## Soft mirror

`TenantSettings.setupWizardState` remains for legacy checklist; Setup Run is authoritative once created.
