# Setup Entry and Resume (Slice 1)

## Routes

| Route | Behaviour |
|---|---|
| `/setup` | Full-page Business Setup Wizard |
| `/setup?runId=` | Load specific run |
| Dashboard `SetupWizardHost` | Soft banner + navigates to `/setup` (A3) |

Login does **not** force completed businesses into the wizard.

## APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/setup/runs?classify=1` | Active run + D2 classification |
| POST | `/api/setup/runs` | Start (or return active) run |
| GET | `/api/setup/runs/[id]` | Load run |
| PATCH | `/api/setup/runs/[id]` | Save step (`expectedDraftVersion` required for conflict detection) |

## Permissions (temporary)

`setup.*` aliases map to `settings.view` via `SETUP_PERMISSION_ALIASES` until granular seeds land.

## Concurrency

`draftVersion` increments on each save. Stale `expectedDraftVersion` → `BUSINESS_SETUP_VERSION_CONFLICT` (409).

## D2 gate

`classifyBusinessActivity` + `assertSetupStartAllowed` block NEW_BUSINESS start when financial activity or prior posted openings exist unless `EXISTING_BUSINESS_CONVERSION` + `conversionApproved`.
