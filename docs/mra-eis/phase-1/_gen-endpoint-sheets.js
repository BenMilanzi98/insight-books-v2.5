/**
 * Phase 1 helper: generate endpoint contract sheets from OpenAPI snapshots.
 * Research-only — does not call MRA APIs.
 */
const fs = require('fs');
const path = require('path');

const prod = JSON.parse(fs.readFileSync('docs/mra-eis/swagger-production.v1.json', 'utf8'));
const sand = JSON.parse(fs.readFileSync('docs/mra-eis/swagger-sandbox.v1.json', 'utf8'));
const outDir = 'docs/mra-eis/phase-1/endpoints';
fs.mkdirSync(outDir, { recursive: true });

const groups = {
  onboarding: 'ONB',
  configuration: 'CFG',
  sales: 'SAL',
  utilities: 'UTL',
  stock: 'STK',
  'raw-material': 'RAW',
};

function slug(p) {
  return p
    .replace(/^\/api\/v1\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function schemaRefOf(op) {
  try {
    return op.requestBody.content['application/json'].schema.$ref || '(inline)';
  } catch {
    return '-';
  }
}

function makeMd(o) {
  const isActivate =
    o.route.includes('activate-terminal') && !o.route.includes('confirmation');
  const hasSig = String(o.headers).includes('x-signature');
  return `# ${o.id}: ${o.summary || o.route}

**Access date:** 2026-07-22  
**Environment scope:** ${
    o.sandboxOnly
      ? 'SANDBOX_ONLY (not in production OpenAPI)'
      : 'Production + Sandbox OpenAPI'
  }  
**Confidence:** VERIFIED_OFFICIAL (OpenAPI path/method/schema names); auth/hash/retry behavioural details OFFICIAL_BUT_AMBIGUOUS pending sandbox

## Purpose
${o.summary || '(see OpenAPI summary)'}

## Preconditions
- Terminal activated and confirmed (except activate-terminal)
- Valid JWT for authenticated endpoints (guide samples; OpenAPI declares no securitySchemes)
- Authorized sandbox credentials required before any live call (Phase 1: **not executed**)

## Business process
See Phase 1 domain contracts. This sheet is the OpenAPI-derived technical contract.

## Method
\`${o.method.toUpperCase()}\`

## Route
\`${o.route}\`

## Headers
| Header | OpenAPI |
|---|---|
| Content-Type | application/json (where body present) |
| Authorization | Guide-only JWT; not declared in OpenAPI securitySchemes |
| Custom | ${o.headers}

## Request schema
- Content types: ${o.body}
- Schema: \`${o.schemaRef}\`

## Response schema
- Declared HTTP responses: ${o.responses}
- Typical envelope: statusCode, remark, data, errors[] (APIError)

## Success examples
Sanitized placeholders only — see CONTRACT_FIXTURE_PLAN.md. Do not commit sample JWT/secretKey.

## Validation / Business / HTTP errors
OpenAPI HTTP codes: ${o.responses}. Application error catalogue: ERROR_CODE_CATALOGUE.md + guide error_codes.

## Authentication
${isActivate ? 'None (pre-credential)' : 'JWT in Authorization (guide; Bearer vs raw CONFLICT)'}

## Hashing
\`x-eis-message-hash\`: **NOT in OpenAPI** — Unverified. Do not send until proven.

## Signing
${
  hasSig
    ? '`x-signature` required: HMAC-SHA512(TAC, secretKey)→standard Base64 (guide + known-answer)'
    : 'No OpenAPI signature header'
}

## Retry policy / Idempotency / Timeout
UNKNOWN pending sandbox — see IDEMPOTENCY_AND_DUPLICATE_RESEARCH.md and TIMEOUT_AND_UNKNOWN_OUTCOME_RESEARCH.md. Mutating POSTs unsafe until proven.

## Security considerations / Sensitive fields
May involve JWT, secretKey, TIN, buyer auth codes, VAT5 — see PRIVACY_AND_DATA_CLASSIFICATION.md

## Audit requirements
Log metadata without secrets; retain fiscal evidence per DATA_RETENTION_AND_AUDIT_RESEARCH.md

## Sandbox test cases
Planned only — SANDBOX_VERIFICATION_PLAN.md. **Not executed in Phase 1.**

## Known discrepancies
DOCUMENTATION_DISCREPANCY_REGISTER.md; parent pack docs/mra-eis/05-DISCREPANCIES-AND-OPEN-QUESTIONS.md

## Open questions
MRA_CLARIFICATION_REGISTER.md

## Implementation recommendation
Contract only in Phase 1. No client implementation.

## Sources
- OpenAPI: docs/mra-eis/swagger-${o.sandboxOnly ? 'sandbox' : 'production'}.v1.json
- Guide: https://eis-api.mra.mw/docs/
`;
}

const index = [];
const counters = {};

for (const [route, ops] of Object.entries(prod.paths || {})) {
  for (const [method, op] of Object.entries(ops)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    const seg = route.split('/')[3] || 'other';
    const g = groups[seg] || 'OTH';
    counters[g] = (counters[g] || 0) + 1;
    const id = `EP-${g}-${String(counters[g]).padStart(2, '0')}`;
    const file = `${id}-${method}-${slug(route)}.md`;
    const headers =
      (op.parameters || [])
        .filter((p) => p.in === 'header')
        .map((p) => `${p.name}${p.required ? '*' : ''}`)
        .join(', ') || '-';
    const body = op.requestBody
      ? Object.keys(op.requestBody.content || {}).join('|')
      : '-';
    const schemaRef = schemaRefOf(op);
    const responses = Object.keys(op.responses || {}).join(', ');
    const summary = op.summary || '';
    fs.writeFileSync(
      path.join(outDir, file),
      makeMd({
        id,
        summary,
        route,
        method,
        headers,
        body,
        schemaRef,
        responses,
        sandboxOnly: false,
      })
    );
    index.push({
      id,
      method: method.toUpperCase(),
      route,
      file,
      env: 'production',
      summary,
      tag: (op.tags && op.tags[0]) || '',
    });
  }
}

const prodKeys = new Set(Object.keys(prod.paths || {}));
let sandExtra = 0;
for (const [route, ops] of Object.entries(sand.paths || {})) {
  if (prodKeys.has(route)) continue;
  for (const [method, op] of Object.entries(ops)) {
    if (!['get', 'post'].includes(method)) continue;
    sandExtra += 1;
    const id = `EP-STK-S${sandExtra}`;
    const file = `${id}-${method}-${slug(route)}.md`;
    const headers =
      (op.parameters || [])
        .filter((p) => p.in === 'header')
        .map((p) => `${p.name}${p.required ? '*' : ''}`)
        .join(', ') || '-';
    const body = op.requestBody
      ? Object.keys(op.requestBody.content || {}).join('|')
      : '-';
    fs.writeFileSync(
      path.join(outDir, file),
      makeMd({
        id,
        summary: op.summary || '',
        route,
        method,
        headers,
        body,
        schemaRef: schemaRefOf(op),
        responses: Object.keys(op.responses || {}).join(', '),
        sandboxOnly: true,
      })
    );
    index.push({
      id,
      method: method.toUpperCase(),
      route,
      file,
      env: 'sandbox-only',
      summary: op.summary || '',
      tag: (op.tags && op.tags[0]) || '',
    });
  }
}

fs.writeFileSync(path.join(outDir, '_index.json'), JSON.stringify(index, null, 2));
console.log('wrote', index.length, 'endpoint sheets');
index.forEach((r) => console.log(r.id, r.method, r.route));
