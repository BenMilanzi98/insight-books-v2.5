# Database Model Audit — Admin Intelligence & CRM

**Audited:** 2026-07-28  
**ORM:** Prisma (`prisma/schema.prisma`)  
**DB:** PostgreSQL (local evidence: `insightbooksmw`)

## Stack evidence

| Layer | Technology | Evidence |
|-------|------------|----------|
| App | Next.js `^16.2.9` App Router | `package.json` |
| UI | React 19, Tailwind 4, Recharts | `package.json` |
| ORM | Prisma `^6.8.1` | `package.json` |
| Auth (admin) | JWT cookie `admin_token` | `lib/adminAuth.js` |
| Auth (tenant) | Session cookie + `lib/auth.js` | |
| Tests | Vitest | `package.json` |
| i18n | `locales/en/*`, `locales/ny/*` JSON | 52 locale files |

## Platform control-plane models (`KEEP` / `EXTEND`)

| Model | Role | Scope | Classification |
|-------|------|-------|----------------|
| `Admin` | System administrators | PLATFORM_GLOBAL | `KEEP` |
| `AdminAuditLog` | Admin action audit | PLATFORM_GLOBAL | `KEEP` / `EXTEND` |
| `PlatformGlobalSettings` | Platform settings | PLATFORM_GLOBAL | `KEEP` |
| `PlatformSupportAccess` | Support access grants | TENANT_SCOPED + audit | `KEEP` / `EXTEND` |
| `PlatformFeatureEntitlement` | Feature flags | PLATFORM / TENANT | `KEEP` |
| `PlatformPlanVersion` | Versioned SaaS + MRA EIS plans | PLATFORM_GLOBAL | `EXTEND` |
| `PlatformInvoice` | Platform invoices | TENANT_SCOPED | `KEEP` — **SaaS revenue truth** |
| `PlatformPayment` | Platform payments | TENANT_SCOPED | `KEEP` — **SaaS revenue truth** |
| `PlatformCredit` | Credits | TENANT_SCOPED | `KEEP` |
| `PlatformRefund` | Refunds | TENANT_SCOPED | `KEEP` |
| `PlatformEmailTemplate` | Email templates | PLATFORM_GLOBAL | `KEEP` |
| `PlatformEmailSuppression` | Suppression list | PLATFORM_GLOBAL | `KEEP` |
| `AccountSubscription` | Tenant commercial subscriptions (incl. EIS SKUs) | TENANT_SCOPED | `KEEP` / coexistence-sensitive |
| `Affiliate` / `AffiliateReferral` / `AffiliatePayout` | Partner channel | PLATFORM_GLOBAL | `KEEP` |
| `Tenant` / `User` / `Role` | Customer & user graph | TENANT_SCOPED | `KEEP` |

## MRA EIS control plane (compliance ≠ commercial)

| Model family | Role | Classification |
|--------------|------|----------------|
| `MraEisTenantEntitlement` (+ participation, business settings, terminals, mappings, …) | Compliance entitlement & ops | `KEEP` — **DISCONNECTED** from commercial payment until subscription-first bridge |
| PayChangu → `AccountSubscription` + pending entitlement | Commercial path | `EXTEND` (Phase 1 payment plans already started) |

## CRM / Sales / Support / Marketing models

Prisma search for `Lead|CrmLead|Opportunity|Pipeline|SupportTicket|Demo|Proposal|Onboarding|MarketingCampaign|AnalyticsEvent` on model names:

| Concept | Result | Classification |
|---------|--------|----------------|
| Lead | **NONE FOUND** | `NOT_FOUND` — `INSTRUMENTATION_REQUIRED` + new models |
| CRM Pipeline / Opportunity | **NONE FOUND** | `NOT_FOUND` |
| Demo / Proposal | **NONE FOUND** | `NOT_FOUND` |
| Onboarding / Training project | **NONE FOUND** | `NOT_FOUND` |
| Support ticket / complaint / bug | **NONE FOUND** as CRM tickets | `NOT_FOUND` (ops security events ≠ support desk) |
| Marketing campaign / attribution | **NONE FOUND** | `NOT_FOUND` |
| AnalyticsEvent / product telemetry | **NONE FOUND** as first-class event store | `NOT_FOUND` / verify ad-hoc logs only |
| Customer health score | **NONE FOUND** | `NOT_FOUND` |

## What must NOT be used as SaaS revenue

| Source | Why |
|--------|-----|
| Tenant `Invoice` / `Sale` / POS | Customer’s business revenue — not InsightBooks MRR |
| Tenant GL / journals | Tenant accounting truth — not platform billing |

## Genuine new model families (future — not Phase 1)

Proposed only after architecture approval (Phase 14+ in PRD):

- Lead / LeadActivity / LeadStage  
- SalesTask / SalesCall / Demo / Proposal  
- OnboardingProject / TrainingProject  
- SupportTicket (platform)  
- MarketingSource / CampaignAttribution  
- AnalyticsEvent (append-only) + daily snapshot read models  

Do **not** invent these in Phase 1 schema.

## Relationship risks

| Risk | Detail | Class |
|------|--------|-------|
| Dual subscription planes | `AccountSubscription` + `PlatformInvoice`/`PlatformPayment` | `DISCONNECTED` until reconciled |
| EIS commercial vs entitlement | Paying EIS ≠ operational ready | `DISCONNECTED` by design (subscription-first) |
| Admin vs tenant auth | Some `/api/mra-eis/*` vs `/api/admin/*` mismatches historically caused 403s | `UNSAFE` if mixed |
