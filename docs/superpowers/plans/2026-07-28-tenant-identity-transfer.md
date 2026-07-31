# Tenant Identity Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin UI + APIs in v2.0 and v2.5 to export/import tenant identity packages (`insightbooks-tenant-identity-v1`) with skip-on-conflict.

**Architecture:** Shared wire format; per-app lib under `lib/admin/tenantIdentity/*`; admin-gated routes under `/api/admin/tenant-identity/*`; page `/insightbooks/tenant-identity-transfer`.

**Tech Stack:** Next.js App Router, Prisma, `getAdminFromRequest`, existing `getSubscriptionStatusFromSubscriptions`.

**Spec:** `docs/superpowers/specs/2026-07-28-tenant-identity-transfer-design.md`

## Global Constraints

- Identity only (tenant, safe settings, roles, users+hashes, memberships, subscriptions)
- Skip conflicts (id or subdomain); never overwrite
- Preserve IDs when free
- Omit EIS secrets from settings
- Export+Import UI in both apps
- No commits unless user asks

## File map (each app)

- Create: `lib/admin/tenantIdentity/settingsFields.js`
- Create: `lib/admin/tenantIdentity/filters.js`
- Create: `lib/admin/tenantIdentity/serialize.js`
- Create: `lib/admin/tenantIdentity/validate.js`
- Create: `lib/admin/tenantIdentity/import.js`
- Create: `lib/admin/tenantIdentity/index.js`
- Create: `app/api/admin/tenant-identity/export/route.js`
- Create: `app/api/admin/tenant-identity/import/dry-run/route.js`
- Create: `app/api/admin/tenant-identity/import/route.js`
- Create: `app/insightbooks/tenant-identity-transfer/page.js`
- Modify: admin nav / sidebar link
- Test: `test/tenantIdentityTransfer.test.js`

---

### Task 1: Core lib + unit tests (v2.0)

**Files:** `lib/admin/tenantIdentity/*`, `test/tenantIdentityTransfer.test.js`

- [ ] Filters: active / paid_inactive / specific
- [ ] Serialize package
- [ ] Validate envelope
- [ ] Import dry-run + commit (mocked prisma)
- [ ] Tests pass

### Task 2: APIs + UI (v2.0)

**Files:** API routes, page, AdminSidebar / nav

- [ ] Export / dry-run / import routes with `getAdminFromRequest`
- [ ] Page with Export + Import tabs
- [ ] Nav link

### Task 3: Mirror to v2.5

**Files:** same paths in `insight-books-v2.5`, `lib/admin/adminNav.js`

- [ ] Copy/adapt lib + APIs + page
- [ ] Nav entry
- [ ] Tests pass in v2.5

### Task 4: Smoke verification

- [ ] Vitest both apps
- [ ] Manual checklist documented in plan footer
