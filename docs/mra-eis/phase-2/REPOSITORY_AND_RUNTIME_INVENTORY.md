# Repository and Runtime Inventory

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

## Structure

- Single Next.js application (not a monorepo of multiple deployables).
- `app/` App Router pages + API routes; `lib/` domain services; `prisma/` schema/migrations; `components/`; `test/` vitest.

## Versions (from package.json)

| Component | Version |
|---|---|
| next | ^16.2.9 |
| react / react-dom | ^19.0.0 |
| @prisma/client | ^6.5.0 |
| next-auth | ^4.24.14 |
| pg | ^8.14.1 |
| vitest | (dev) |
| typescript | (dev) |
| zod | present |
| qrcode.react | ^4.2.0 |
| jspdf / puppeteer / nodemailer | present |
| decimal library | **not present** (money often Float/number) |

## Runtime constraints for EIS

| Constraint | Evidence | EIS consequence |
|---|---|---|
| Next.js API routes + Vercel cron | vercel.json | Long-running workers not native; need durable job runner |
| Docker/PM2 also documented | Dockerfile, docs | Multi-replica fiscal sequencing risk |
| Browser offline queue | lib/offlineSalesQueue.js | Cannot hold MRA secretKey |
| No Bull/Redis product queue | inventory | Need durable EIS worker |
| Drizzle also in deps | package.json | Prisma is primary ORM |

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
