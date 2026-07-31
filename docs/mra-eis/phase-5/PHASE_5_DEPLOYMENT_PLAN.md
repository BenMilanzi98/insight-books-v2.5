# Deployment Plan

1. Backup DB
2. `npx prisma migrate deploy`
3. Stop Node/Next processes holding Prisma engine lock
4. `npx prisma generate`
5. Restart app
6. Run `node scripts/mra-eis-phase5-legacy-classify.js` (dry-run)
7. Run vitest Phase 5 suites

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
