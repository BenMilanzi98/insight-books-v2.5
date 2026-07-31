# 🚀 Quick Deployment Reference

## ⚡ One-Command Safe Deployment

```bash
./scripts/safe-deploy-production.sh
```

This script automatically:
1. ✅ Creates a backup (mandatory)
2. ✅ Checks migration safety
3. ✅ Applies migrations
4. ✅ Regenerates Prisma client
5. ✅ Verifies success

---

## 📋 Manual Step-by-Step (If You Need More Control)

### 1. Check What Needs Migrating
```bash
npx prisma migrate status
```

### 2. Review Migration SQL (IMPORTANT!)
```bash
# View latest migration
cat prisma/migrations/[LATEST_MIGRATION]/migration.sql
```

### 3. Create Backup (MANDATORY!)
```bash
./scripts/backup-database.sh
```

### 4. Apply Migrations
```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Restart Application
```bash
pm2 restart your-app-name
# or
systemctl restart your-service
```

---

## ⚠️ Critical Rules

### ✅ DO:
- ✅ Always backup first
- ✅ Use `prisma migrate deploy` in production
- ✅ Review migration SQL before applying
- ✅ Test on staging first (if available)

### ❌ DON'T:
- ❌ Never use `prisma migrate dev` in production
- ❌ Never use `prisma db push` in production
- ❌ Never skip backups
- ❌ Never apply untested migrations

---

## 🔄 Rollback (If Something Goes Wrong)

```bash
# 1. Stop application
pm2 stop your-app-name

# 2. Restore from backup
pg_restore -d "$DATABASE_URL" --clean --if-exists backups/backup_YYYYMMDD_HHMMSS.dump

# 3. Restart application
pm2 start your-app-name
```

---

## 📊 Quick Status Check

```bash
# Check migration status
npx prisma migrate status

# View database
npx prisma studio

# List backups
ls -lh backups/
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Migration failed" | Check error, restore from backup, fix issue |
| "Client out of sync" | Run `npx prisma generate` |
| "Connection failed" | Check DATABASE_URL in .env |
| "Migration not found" | Use `npx prisma migrate resolve --applied [NAME]` |

---

**For detailed guide, see: `PRODUCTION_DEPLOYMENT_GUIDE.md`**
