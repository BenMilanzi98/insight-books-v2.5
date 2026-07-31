# Default Chart of Accounts Templates (Phase 3 §15)

Implementation: `lib/coaV2/templates/coaTemplates.js` + `blueprintClassification.js`
· Tables: `CoaV2Template`, `CoaV2TemplateAccount` · CLI: `npm run coa:seed-templates`
· API: `GET /api/coa-v2/templates[?compare=KEY&version=N]`, `POST /api/coa-v2/templates/apply`

## 1. Design

- Templates are **versioned** (`@@unique(templateKey, version)`) and **immutable after
  publication** — `ensureBuiltInTemplates` never modifies an existing published version;
  changes ship as a new version.
- Template accounts are fully classified V2 definitions: code, name, parent code, category,
  subtype, behaviour, normal balance, system purpose, control purpose, FS section, cash-flow
  class, currency policy, required flag, display order.
- All three built-in templates derive from the approved canonical blueprint
  (`lib/chartOfAccountsBlueprint.js`), so template application and onboarding stay consistent.

## 2. Registered templates (v1, PUBLISHED, seeded 2026-07-20)

| Key | Name | Differences |
|---|---|---|
| GENERAL_SME | General SME | Full blueprint; baseline required core |
| RETAIL | Retail & Trading | Requires inventory/COGS accounts; retail-oriented optional set |
| SERVICE | Service Business | Requires 4150 service revenue; inventory accounts optional |

## 3. Applying a template to a business

`compareTemplateToBusiness` (read-only preview) buckets accounts as:
present / missing required / missing optional / business-custom.

`applyTemplateAdditions` (transactional) then:

- creates **only** the selected missing codes (parent-first; parents must exist or be
  included);
- **never updates or deletes** existing accounts — business customizations survive;
- skips assigning a `systemPurpose` if the business already has an active account holding
  it (prevents COA-002 conflicts);
- stamps rows `coaArchitectureVersion=TRANSITION_V2` and audits via `coa.template.apply`.

Permissions: `coa.manageTemplates` (or `coa.manage`).

## 4. Business-type recommendation

Onboarding selects a template by declared business type (retail → RETAIL, service →
SERVICE, otherwise GENERAL_SME). Existing businesses use the compare/apply flow from the
governance console (`/chart-of-accounts/governance`, Templates tab).
