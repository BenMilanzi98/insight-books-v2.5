# Worker / Background Job Authorisation Audit

| Finding | Class |
|---------|-------|
| Few dedicated admin workers; scripts run as ops CLI with Prisma | EXTEND |
| PayChangu backfill CLI has no actor identity | AUDIT_GAP — document ops-only |
| Export jobs if any inherit caller context poorly | MISSING |

**Target:** Background jobs carry `realActorId` + permission snapshot or service principal; deny privilege expansion inside job.
