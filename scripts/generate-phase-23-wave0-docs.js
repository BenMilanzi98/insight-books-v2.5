/**
 * Wave 0 forensic pack generator for Phase 23.
 * Run: node scripts/generate-phase-23-wave0-docs.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join('docs', 'admin-intelligence-crm', 'phase-23');
fs.mkdirSync(dir, { recursive: true });

const DATE = '2026-08-01';

function w(name, body) {
  fs.writeFileSync(path.join(dir, name), `${body.trim()}\n`, 'utf8');
}

w(
  'README.md',
  `# Phase 23 — Marketing Attribution and Acquisition Analytics

**Date:** ${DATE}  
**Authoritative PRD phase:** 23  
**Current readiness:** **BLOCKED** (forensic Wave 0 complete; domain not implemented)

## Purpose

Establish one canonical Marketing Attribution domain under \`/insightbooks/marketing/*\` without duplicating CRM Lead Source, Affiliate referral, Product Analytics, Training, or Demo systems.

## Wave 0 status (this pack)

| Domain | Status |
|--------|--------|
| \`/insightbooks/marketing/*\` routes | **MISSING** (0 routes) |
| Marketing Campaign model | **MISSING** |
| Channel / Source / Medium catalogues | **MISSING** (CRM free-text \`source\`+\`channel\` on Lead) |
| UTM / visitor / marketing session / touchpoint | **MISSING** |
| Attribution models / runs / credits | **MISSING** |
| Marketing spend facts | **MISSING** |
| CRM Lead source + capture + consent | **REUSE** (Phases 14–15) |
| Affiliate referral program | **DISTINCT** — not Marketing Campaign SoT |
| Product Analytics funnels | **DISTINCT** — Product Events ≠ Marketing touchpoints |
| Training | **BOUNDARY** — attendance ≠ acquisition (Phase 22) |

## Start here

1. \`CURRENT_MARKETING_ARCHITECTURE_AUDIT.md\`
2. \`PHASE_23_GAP_REGISTER.md\`
3. \`IMPLEMENTATION_PLAN.md\`
4. \`FINAL_READINESS_DECISION.md\`

## Non-goals (Wave 0)

No Campaign schema, attribution engine, or fabricated metrics in Wave 0.
`
);

w(
  'PHASE_23_SCOPE.md',
  `# Phase 23 Scope

**In scope:** Campaigns, taxonomy (channel/source/medium), landing pages, forms, marketing referrals/partners, visitors/sessions/touchpoints, consent-aware identity, lead/opportunity/customer/subscription acquisition linkage, spend facts, deterministic attribution models, funnels/cohorts, CPL/CAC/ROAS, reports/exports, DQ/recon/lineage, permissions, EN+NY.

**Out of scope:** ML attribution, auto bid/budget, Phase 24 forecasting, AI BI/assistant, full comms platform, historical backfill programme, third-party cookies / fingerprinting, accounting journals from marketing spend, Training→Lead automation, Product usage as marketing touch without evidence.

**Consume:** Phases 4, 6, 7, 9, 13–22 contracts (PRD §3).

**Prepare for Phase 24:** Stable acquisition identities, campaign dimensions, versioned models/windows, credits, sourced vs influenced, spend/currency contracts, DQ/recon — no fabricated forecast probabilities.
`
);

w(
  'AUTHORITATIVE_ROADMAP_MAP.md',
  `# Authoritative Roadmap Map — Phase 23

| PRD Phase | Repo location | Behaviour found | Correction |
|-----------|---------------|-----------------|------------|
| 14 Lead Capture | \`CrmLead\`, \`CrmCaptureRecord\`, \`app/insightbooks/crm/leads\` | \`source\`+\`channel\`, capture idempotency, consent snapshot | CRM source evidence — not Campaign SoT |
| 15 Qualification | CRM qualification models | Qualification ≠ fabricated MQL | Keep distinct |
| 16 Pipeline | \`CrmOpportunity\` | No attribution credits | EXTEND later for sourced/influenced |
| 18 Demo | \`lib/admin/crm/demos\` | Demo source lineage | Demo ≠ acquisition without campaign evidence |
| 22 Training | tree phase-18 ≡ PRD 22 | Forbids marketing attribution | Honour boundary |
| Affiliate | \`Affiliate*\`, \`/insightbooks/affiliate*\` | Commission referrals | DISTINCT from Marketing Campaign |
| Product Analytics | \`/insightbooks/intelligence/product-analytics\` | Product funnels | DISTINCT from Marketing touchpoints |
| GL "marketing" expense | CoA 5330 remaps | Accounting | WRONG_DOMAIN for attribution spend |
| Phase 23 Marketing | \`/insightbooks/marketing\` | **Does not exist** | Create as sole canonical family |

Do not trust folder names alone; behaviour above governs classification.
`
);

w(
  'MISLABELLED_MARKETING_ARTIFACT_AUDIT.md',
  `# Mislabelled Marketing Artifact Audit

| Artifact | Implied meaning | Actual behaviour | Classification |
|----------|-----------------|------------------|----------------|
| CoA / expense "marketing" | Marketing analytics | Tenant GL expense mapping | WRONG_DOMAIN |
| Product Analytics funnels | Acquisition funnel | Product usage funnel | WRONG_DOMAIN |
| Affiliate referral | Marketing referral program | Commission affiliate system | DISCONNECTED |
| Training \`marketingAttribution\` forbid flags | Attribution feature | Hard-forbid path | CORRECT boundary |
| CRM Lead \`source\`/\`channel\` | Campaign attribution | CRM capture evidence strings | EXTEND via mapping — not Campaign SoT |
| Dashboard subscription analytics | Acquisition analytics | Billing charts | WRONG_SCOPE |
| Tree \`phase-18\` Training | Phase 18 | PRD Phase 22 Training | MISLABELLED_PHASE (known) |

No competing \`/insightbooks/marketing\` implementations found.
`
);

w(
  'MARKETING_COMPATIBILITY_MAP.md',
  `# Marketing Compatibility Map

| Existing system | Relationship to Phase 23 | Decision |
|-----------------|--------------------------|----------|
| \`CrmLead.source\` / \`channel\` | Evidence for Lead acquisition | Preserve original; map via versioned rules |
| \`CrmCaptureRecord\` | Capture + consent + payload | REUSE_WITH_RECONCILIATION |
| \`CrmConsentRecord\` | Contact consent | REUSE for comms eligibility; visitor consent is new |
| \`CrmOpportunity\` | Conversion target | EXTEND sourced/influenced links |
| Conversion / Closed-Won (P20) | Customer/subscription outcome | Consume identities |
| AffiliateReferral | Partner channel candidate | Explicit Partner mapping later; keep commission SoT |
| AnalyticsEvent (P4) | Event envelope | Marketing producers use outbox/idempotency |
| Product Analytics Events | Product usage | Never auto-create Marketing touchpoints |
| Training Participants | Enablement | Never auto-create Leads or acquisition credit |
| Demo records | Demo lineage | Influence only with campaign evidence |
| Revenue Intelligence (P6) | Collected/recognised revenue | Sole ROAS revenue source |
`
);

w(
  'PHASE_INPUT_VALIDATION.md',
  `# Phase Input Validation (Phases 1–22 → 23)

| Input | Status | Notes |
|-------|--------|-------|
| Lead identity (\`CrmLead\`) | PASS | Stable leadNumber, source, channel |
| CRM Account / Contact | PASS | Present |
| Opportunity identity | PASS | \`CrmOpportunity\` |
| Customer / Tenant identity | PASS | Phases 7/20/21 |
| Subscription identity | PASS | Billing |
| Campaign identity | **FAIL** | No Marketing Campaign model |
| Source taxonomy (governed) | **FAIL** | Free-text only on Lead |
| Visitor identity policy | **FAIL** | Not implemented |
| Consent treatment (visitor analytics) | **PARTIAL** | Capture consent exists; no visitor plane |
| Attribution window policy | **FAIL** | Not implemented |
| Currency treatment (spend) | **FAIL** | No marketing spend |
| Revenue definition (P6) | PASS | Consume for ROAS |
| Multi-tenant isolation | PASS | Admin CRM patterns |
| Marketing-spend source | **FAIL** | Missing |
| Idempotency (capture) | PASS | \`sourceIdempotencyKey\` |

**Gate:** Full implementation must not claim READY until Campaign identity, taxonomy, visitor policy, attribution windows, and spend source contracts exist (Wave 1+).
`
);

w(
  'CURRENT_MARKETING_ARCHITECTURE_AUDIT.md',
  `# Current Marketing Architecture Audit

**Date:** ${DATE}

## Finding

There is **no** Marketing Attribution platform in the application today.

- Routes: \`app/insightbooks/marketing/**\` → **0 files**
- Prisma: no \`MarketingCampaign\`, \`MarketingTouchpoint\`, \`MarketingVisitor\`, \`MarketingSession\`, \`Attribution*\`, \`MarketingSpend*\` models
- Permissions: no \`systemAdmin.marketing.*\` keys found in \`lib/permissionsMap.js\`

## Adjacent planes (do not merge blindly)

1. **CRM Lead Capture** — \`CrmLead.source\`, \`channel\`, \`CrmCaptureRecord\`
2. **Affiliate** — \`Affiliate\`, \`AffiliateReferral\`
3. **Product Analytics** — \`/insightbooks/intelligence/product-analytics\`
4. **Training** — forbids marketing attribution
5. **GL marketing expense** — accounting only

## Classification

| Component | Class |
|-----------|-------|
| Missing marketing hub | CREATE as sole canonical |
| CRM lead source | EXTEND / REUSE_WITH_RECONCILIATION |
| Affiliate | DISCONNECTED (keep SoT) |
| Product funnels | WRONG_DOMAIN |
`
);

const audits = {
  CURRENT_CAMPAIGN_AUDIT:
    'No Marketing Campaign entity, numbering (MKT-*), hierarchy, or `/insightbooks/marketing/campaigns` routes. Affiliate ≠ Marketing Campaign. Classification: NOT_APPLICABLE (to create).',
  CURRENT_CHANNEL_SOURCE_MEDIUM_AUDIT:
    'CRM Lead uses free-text `source` + `channel` (default `ADMIN_MANUAL`). No governed catalogues or normalisation rule versions. Classification: STANDARDISE via new taxonomy; preserve raw CRM values.',
  CURRENT_UTM_CAPTURE_AUDIT:
    'No `utm_source` / `utmSource` fields in Prisma; no marketing UTM capture service. Classification: NOT_APPLICABLE (to create); ad hoc payload Json may hold raw values.',
  CURRENT_REFERRER_CAPTURE_AUDIT:
    'No first-party marketing referrer model. `Affiliate.referralCode` is commission affiliate — distinct. Classification: Affiliate DISCONNECTED; marketing referrer NOT_APPLICABLE.',
  CURRENT_LANDING_PAGE_AUDIT:
    'No Marketing Landing Page model or safe URL allowlist under marketing. Classification: NOT_APPLICABLE.',
  CURRENT_FORM_CAPTURE_AUDIT:
    'CRM `CrmCaptureRecord` (idempotent, consent snapshot, payload). Demo forms under CRM demos. No Marketing Form catalogue. Classification: Capture REUSEABLE; Marketing Form SoT CREATE.',
  CURRENT_REFERRAL_PARTNER_AUDIT:
    'Affiliate provides referral codes/commissions/payouts — not PRD Marketing Partner program. Classification: DISCONNECTED.',
  CURRENT_VISITOR_IDENTITY_AUDIT:
    'No anonymous marketing visitor identity store; no fingerprinting found (good). Classification: NOT_APPLICABLE (create privacy-safe).',
  CURRENT_MARKETING_SESSION_AUDIT:
    'Auth app sessions exist; no Marketing Session distinct from auth. Classification: NOT_APPLICABLE.',
  CURRENT_CONSENT_TRACKING_AUDIT:
    '`CrmCaptureRecord.consentStatus` / `CrmConsentRecord` exist. No visitor analytics consent / DNT plane. Classification: PARTIAL.',
  CURRENT_TOUCHPOINT_AUDIT:
    'No Marketing Touchpoint model. `AnalyticsEvent` (P4) is envelope transport — not marketing touch SoT. Classification: CREATE Touchpoint SoT; EXTEND AnalyticsEvent as producer.',
  CURRENT_LEAD_SOURCE_AUDIT:
    '`CrmLead.source`, `channel`, `sourceIdempotencyKey` + capture records. Classification: CORRECT_AND_REUSABLE evidence; attribution credits remain separate.',
  CURRENT_OPPORTUNITY_ATTRIBUTION_AUDIT:
    '`CrmOpportunity` has no attribution credit / influence / sourced campaign fields. Classification: EXTEND without fabricating influence.',
  CURRENT_CUSTOMER_ACQUISITION_AUDIT:
    'Customer/Tenant via conversion (P20) and onboarding (P21). No marketing acquisition fact table. Classification: CONSUME identities; CREATE linkage facts.',
  CURRENT_SUBSCRIPTION_ATTRIBUTION_AUDIT:
    'Billing subscriptions exist; no marketing subscription attribution. Classification: CONSUME; CREATE linkage; expansions ≠ new CAC.',
  CURRENT_AD_PLATFORM_AUDIT:
    'No ad-platform connection, token vault for ads, or provider campaign sync. Classification: NOT_APPLICABLE.',
  CURRENT_MARKETING_SPEND_AUDIT:
    'No Marketing Spend Fact. GL marketing expenses must not auto-post from analytics. Classification: CREATE analytics spend; GL is WRONG_DOMAIN.',
  CURRENT_ATTRIBUTION_MODEL_AUDIT:
    'No FIRST_TOUCH/LAST_TOUCH/etc. models, versions, windows, runs, or credits. Classification: NOT_APPLICABLE (create deterministic only).',
  CURRENT_FUNNEL_AUDIT:
    'Product Analytics funnels ≠ marketing acquisition funnel. Classification: WRONG_DOMAIN; CREATE marketing funnels separately.',
  CURRENT_COHORT_AUDIT: 'No marketing acquisition cohorts. Classification: NOT_APPLICABLE.',
  CURRENT_MARKETING_REPORT_AUDIT: 'No marketing report catalogue. Classification: NOT_APPLICABLE.',
  CURRENT_MARKETING_EXPORT_AUDIT: 'No marketing exports. Classification: NOT_APPLICABLE.',
  MARKETING_DATA_QUALITY_AUDIT:
    'No marketing DQ engine. Mirror CRM/Training DQ patterns. Classification: CREATE using existing patterns.',
  MARKETING_RECONCILIATION_AUDIT: 'No marketing reconciliation engine. Classification: NOT_APPLICABLE.',
  MARKETING_PRIVACY_AUDIT:
    'No visitor PII plane yet. Training omits marketingConsent from projections — good boundary. Design safe URL policy before capture. Classification: CREATE privacy-first.',
  MARKETING_SECURITY_AUDIT:
    'No marketing routes yet. Reuse Admin CRM Team/Territory/Tenant isolation patterns. Classification: FUTURE — apply P3 RBAC.',
  MARKETING_PERFORMANCE_AUDIT:
    'N/A until high-volume touchpoints. Design server-side pagination/indexes now. Classification: FUTURE_PHASE_SCOPE for scale programme.',
};

for (const [file, finding] of Object.entries(audits)) {
  w(
    `${file}.md`,
    `# ${file.replace(/_/g, ' ')}

**Date:** ${DATE}  
**Audit method:** Codebase search (Prisma, \`app/insightbooks/**\`, \`lib/admin/**\`, permissions)

## Finding

${finding}

## Evidence paths (representative)

- \`prisma/schema.prisma\` — \`CrmLead\`, \`CrmCaptureRecord\`, \`CrmOpportunity\`, \`Affiliate*\`, \`AnalyticsEvent\`
- \`app/insightbooks/crm/**\` — CRM hub (no marketing)
- \`app/insightbooks/affiliate*/**\` — affiliate
- \`app/insightbooks/intelligence/product-analytics/**\` — product funnels
- \`lib/admin/customerSuccess/training/paOutcomeHandoff.js\` — forbids marketing attribution
- \`docs/admin-intelligence-crm/phase-22/PHASE_23_INPUTS.md\` — consume contract

## Classification

See finding. No fabricated Campaign/Touchpoint/Spend/Attribution data exists to migrate.
`
  );
}

w(
  'PHASE_23_GAP_REGISTER.md',
  `# Phase 23 Gap Register

**Date:** ${DATE}

| ID | Gap | Severity | Notes |
|----|-----|----------|-------|
| G-MKT-001 | No \`/insightbooks/marketing\` route family | BLOCKER | Sole canonical hub required |
| G-MKT-002 | No Marketing Campaign model / numbering | BLOCKER | |
| G-MKT-003 | No Channel/Source/Medium catalogues + rule versions | BLOCKER | CRM free-text only |
| G-MKT-004 | No visitor / session / touchpoint plane | BLOCKER | |
| G-MKT-005 | No visitor analytics consent / DNT implementation | BLOCKER | |
| G-MKT-006 | No attribution models/windows/runs/credits | BLOCKER | |
| G-MKT-007 | No marketing spend facts | BLOCKER | |
| G-MKT-008 | No landing page / marketing form SoT | HIGH | CRM capture exists |
| G-MKT-009 | No ad-platform adapters / secret refs | HIGH | Optional later |
| G-MKT-010 | Opportunity sourced/influenced links missing | HIGH | |
| G-MKT-011 | Customer/subscription acquisition facts missing | HIGH | |
| G-MKT-012 | Marketing permissions missing | HIGH | |
| G-MKT-013 | Affiliate not mapped into Partner taxonomy | MEDIUM | Keep SoT separate |
| G-MKT-014 | Product funnels risk confusion | MEDIUM | Docs + UI labels |
| G-MKT-015 | EN/NY marketing strings absent | MEDIUM | |
| G-MKT-016 | Reports/exports/schedules absent | HIGH | After metrics |

**Open blockers for READY_FOR_PHASE_24:** G-MKT-001…007.
`
);

w(
  'IMPLEMENTATION_PLAN.md',
  `# Phase 23 Implementation Plan

**Date:** ${DATE}

## Wave 0 — Forensic audit (COMPLETE)

- [x] Inventory routes/models
- [x] Mislabel + compatibility maps
- [x] Gap register
- [x] Readiness = BLOCKED

## Wave 1 — Domain contracts & schema foundation

1. Marketing Campaign + numbering (MKT-YYYY-######)
2. Channel / Source / Medium catalogues + normalisation rule versions
3. Permissions skeleton \`systemAdmin.marketing.*\`
4. Nav shell \`/insightbooks/marketing\` (overview with UNAVAILABLE — never fake zeros)
5. Safe URL + UTM capture contracts + tests
6. Read CRM Lead source evidence without a second Lead Source SoT

## Wave 2 — Capture plane

Landing pages, Forms, submissions→Lead idempotency, Visitor+consent+Session, Touchpoints, identity resolution.

## Wave 3 — Acquisition linkage

Lead acquisition facts, Opportunity sourced/influenced, Customer/subscription new vs expansion.

## Wave 4 — Spend & attribution engine

Spend facts, currency, allocation, immutable model/window versions, runs+credits (100%), all deterministic models, exceptions+recon.

## Wave 5 — Funnels, metrics, UI, reports

Funnels/cohorts, CPL/CAC/ROAS (UNAVAILABLE on missing inputs), campaign UI, reports/exports, EN+NY, a11y/security tests, Phase 24 pack.

## Stop conditions

Never invent impressions/clicks/sessions/spend/revenue/CAC/ROAS; never Training→Lead or Product→Touch without evidence; never accounting journals from spend; never a second Campaign/Lead-Source/visitor system.
`
);

w(
  'FINAL_READINESS_DECISION.md',
  `# Final Readiness Decision — Phase 23 (Wave 0)

**Date:** ${DATE}  
**Decision:** **BLOCKED**

## Rationale

Wave 0 forensic audit shows Marketing Attribution is **not implemented**. CRM Lead source/capture, Affiliate, Product Analytics, and Training boundaries exist and must be reused/respected — but Campaign identity, governed taxonomy, visitor/session/touchpoint plane, spend facts, and attribution engine are absent.

Per PRD §3 / §76, Phase 23 cannot be \`READY_FOR_PHASE_24\` until a trustworthy Campaign + touchpoint + attribution + spend foundation exists with reconciled credits and privacy gates.

## Complete

- Forensic audit pack
- Non-duplication decisions vs CRM / Affiliate / Product / Training

## Incomplete

- Implementation order items for domain/UI/tests/migrations
- Section 74 completion docs (deferred to implementation waves)

## Next

Execute Wave 1 in \`IMPLEMENTATION_PLAN.md\` after acknowledging this BLOCKED baseline.

**Honest conclusion:** Phase 23 is **not built**. An empty polished dashboard would violate PRD honesty rules. Wave 0 audit (required first action) is done.
`
);

w(
  'FINAL_PHASE_23_REPORT.md',
  `# Final Phase 23 Report (Wave 0)

**Date:** ${DATE}

## Scope completed

Forensic Marketing Audit (PRD §2) only.

## Roadmap

Phase 23 = Marketing Attribution; Training tree-18 ≡ PRD 22; Demo = PRD 18.

## Mislabelled artifacts

See \`MISLABELLED_MARKETING_ARTIFACT_AUDIT.md\`.

## Reusable

CRM Lead/Capture/Consent; AnalyticsEvent/outbox (P4); Revenue (P6); Training forbid-attribution; Admin RBAC (P3).

## Not Marketing SoT

Affiliate commissions; Product Analytics funnels; GL marketing expenses.

## Code / migrations

None in Wave 0.

## Readiness

**BLOCKED** — \`FINAL_READINESS_DECISION.md\`.
`
);

w(
  'PHASE_24_INPUTS.md',
  `# Phase 24 Inputs — status after Wave 0

**Status:** **NOT READY** — Marketing acquisition facts do not exist yet.

Phase 24 must not consume fabricated campaign/source/attribution/spend data.

When Waves 1–5 complete, this pack will list: campaign dimensions, model/window versions, credits, sourced vs influenced, spend/currency contracts, DQ/recon states — with no fabricated forecast probabilities.
`
);

console.log('Wrote', fs.readdirSync(dir).length, 'files to', dir);
