# 📦 Install PostgreSQL 12 Client for Backup Restore

## Problem

Your backup was created with PostgreSQL 12/13 (format 1.14), but PostgreSQL 18's `pg_restore` can't read it.

**Error:**
```
pg_restore: [archiver] unsupported version (1.14) in file header
```

---

## ✅ Solution: Install PostgreSQL 12 Client

### Option 1: Use the Installation Script (Recommended)

```bash
./scripts/install-postgresql12-client.sh
```

This script will:
- ✅ Detect your OS (CentOS/RHEL/Ubuntu/Debian)
- ✅ Add PostgreSQL official repository
- ✅ Install PostgreSQL 12 client
- ✅ Verify installation

---

### Option 2: Manual Installation for CentOS/RHEL

```bash
# Step 1: Add PostgreSQL official repository
sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Step 2: Install PostgreSQL 12 client
sudo yum install -y postgresql12

# Step 3: Verify installation
/usr/pgsql-12/bin/pg_restore --version
```

**Note:** Replace `$(rpm -E %{rhel})` with your RHEL version if needed:
- RHEL 7: `EL-7`
- RHEL 8: `EL-8`
- RHEL 9: `EL-9`

---

### Option 3: Manual Installation for Ubuntu/Debian

```bash
# Step 1: Add PostgreSQL APT repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Step 2: Update package list
sudo apt-get update

# Step 3: Install PostgreSQL 12 client
sudo apt-get install -y postgresql-client-12

# Step 4: Verify installation
pg_restore-12 --version
```

---

## 🚀 After Installation: Restore Backup

Once PostgreSQL 12 client is installed, use the restore script:

```bash
./scripts/restore-with-postgresql12.sh backups/insightbooks_backup_Feb122026.dump
```

Or manually:

```bash
# Using PostgreSQL 12 pg_restore
/usr/pgsql-12/bin/pg_restore \
    -h localhost \
    -U henmik \
    -d insightbooks \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    backups/insightbooks_backup_Feb122026.dump
```

---

## 🔍 Verify Installation

Check if PostgreSQL 12 client is installed:

```bash
# Check for pg_restore
which pg_restore-12
# or
ls -la /usr/pgsql-12/bin/pg_restore

# Check version
/usr/pgsql-12/bin/pg_restore --version
# Should show: pg_restore (PostgreSQL) 12.x
```

---

## 🆘 Troubleshooting

### Issue: "No match for argument: postgresql12"

**Solution:** Add PostgreSQL official repository first:
```bash
sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo yum install -y postgresql12
```

### Issue: Repository not found

**Solution:** Check your RHEL version and use correct repository:
```bash
# Check RHEL version
rpm -E %{rhel}

# For RHEL 7
sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# For RHEL 8
sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm
```

### Issue: Package conflicts

**Solution:** Install only the client (not the server):
```bash
sudo yum install -y postgresql12 --exclude=postgresql12-server
```

---

## 🐳 Alternative: Use Docker (If Installation Fails)

If you can't install PostgreSQL 12 client, use Docker:

```bash
# Restore using Docker PostgreSQL 12
docker run --rm \
  -v $(pwd)/backups:/backup \
  -e PGPASSWORD=yourpassword \
  postgres:12 \
  pg_restore \
    -h host.docker.internal \
    -U henmik \
    -d insightbooks \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    /backup/insightbooks_backup_Feb122026.dump
```

**Note:** Replace `host.docker.internal` with your database host IP if needed.

---

## 📋 Quick Reference

| Method | Command | When to Use |
|--------|---------|-------------|
| **Install Script** | `./scripts/install-postgresql12-client.sh` | ✅ **Recommended** - Automated |
| **Manual CentOS** | Add repo + `yum install postgresql12` | If script fails |
| **Manual Ubuntu** | Add repo + `apt-get install postgresql-client-12` | Ubuntu/Debian systems |
| **Docker** | Use `postgres:12` container | If installation not possible |

---

## ✅ After Successful Restore

```bash
# 1. Verify migrations
npx prisma migrate status

# 2. Generate Prisma client
npx prisma generate

# 3. Verify data
npx prisma studio

# 4. Restart application
pm2 restart your-app-name
```

---

**Start with the installation script, then use the restore script!** 🚀
