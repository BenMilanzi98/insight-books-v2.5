# Secure Logging Policy

## Required fields (structured)

- level, message, ts
- requestId / correlationId when available
- businessId when business-scoped
- actorType / safe actorId
- outcome / error code
- securityClassification when relevant

## Must redact

Passwords, tokens, API keys, secrets, encryption keys, full session cookies, full identity documents, full bank account numbers, sensitive file contents, unnecessary AI prompts with restricted data.

## Implementation

- `lib/securityGovernance/domain/secureLog.js`
- `redactForAudit` in audit event builder
- Prefer typed security errors over stack traces to clients

## Ban

Unrestricted `console.log` of request bodies on auth, payment, payroll, or document paths in production.
