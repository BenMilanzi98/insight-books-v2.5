# Setup State Machine (Slice 1)

Implementation: `lib/setupWizard/stateMachine.js`

## Run statuses

Key paths:

- `NOT_STARTED` → `IN_PROGRESS` → `READY_FOR_REVIEW` → `UNDER_REVIEW` → `APPROVED` → `POSTING` → `COMPLETED`
- `COMPLETED` → `REOPEN_REQUESTED` → `REOPENED` (new version / correction — later slice)
- Direct `COMPLETED` → `IN_PROGRESS` is **rejected**

## Step statuses

`NOT_STARTED` → `IN_PROGRESS` → `COMPLETED` | `SKIPPED_OPTIONAL` | `BLOCKED`  
`POSTED` is terminal for a step.

## Completion percent

Count of steps in COMPLETED / COMPLETED_WITH_WARNINGS / SKIPPED_OPTIONAL / APPROVED / POSTED ÷ 23.
