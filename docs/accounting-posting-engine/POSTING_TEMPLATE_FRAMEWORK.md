# Posting Template Framework

Implementation: `lib/accountingV2/templates/templateRegistry.js` (registry),
`pilotTemplates.js` (ACTIVE implementations), `definitions.js` (DEFINED
declarations), `index.js` (registration entry point).

## Template shape

Each template declares: `templateId`, `templateVersion`, `eventType`,
`supportedSourceTypes`, `requiredPurposes`, `requiredSourceFields`,
`requiredDimensions`, `optionalDimensions`, `prohibitedDimensions`, debit and
credit generation rules (`buildDraft` for ACTIVE templates), tax rules,
currency rules, rounding rules, approval rules, description generation,
validation rules, reversal behaviour, effective dates, `status`
(`ACTIVE` | `DEFINED`) and `architectureVersion`.

## Versioning and immutability

- `registerTemplate` freezes the template object; re-registering an existing
  `templateId@version` throws. Published versions cannot be silently changed —
  a change requires a new `templateVersion`.
- `getActiveTemplate(eventType)` resolves the highest ACTIVE version effective
  for the posting date; missing templates raise
  `PostingTemplateNotFoundError`.
- Every posted journal stores `templateId`, `templateVersion`, `eventType`
  and `architectureVersion` (columns on `JournalEntry`), so any journal can be
  traced to the exact rule set that produced it.

## No executable configuration

Templates are controlled backend modules. No user-provided code or executable
configuration is stored or evaluated. Tenant-level variation happens through
account mappings and approval configuration, not through template mutation.

## Draft generation

An ACTIVE template's `buildDraft(source, command, resolvedAccounts)` returns a
Journal Draft (see `JOURNAL_DRAFT_GENERATION.md`). Templates never persist
anything; persistence happens only after the full validation pipeline passes.

See `POSTING_TEMPLATE_CATALOGUE.md` for the complete 23-template catalogue and
each template's status.
