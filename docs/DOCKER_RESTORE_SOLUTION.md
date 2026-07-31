# 🐳 Docker Restore Solution

## Problem

PostgreSQL 12 client is not available in your repository, but you need to restore a backup created with PostgreSQL 12.

**Error:**
```
No match for argument: postgresql12
```

---

## ✅ Solution: Use Docker

Since PostgreSQL 12 client isn't available, use **Docker** to run PostgreSQL 12's `pg_restore`:

### Step 1: Install Docker (If Not Installed)

```bash
# Install Docker
sudo yum install -y docker

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (optional, to avoid sudo)
sudo usermod -aG docker $USER
# Then logout and login again, or:
newgrp docker
```

### Step 2: Restore Using Docker

**Option A: Use the automated script (Recommended)**

```bash
./scripts/restore-with-docker.sh backups/insightbooks_backup_Feb122026.dump
```

**Option B: Manual Docker command**

```bash
# Set your database connection details
DB_HOST="localhost"  # or your database host
DB_PORT="5432"
DB_NAME="insightbooks"
DB_USER="henmik"
DB_PASS="yourpassword"  # Replace with actual password
BACKUP_FILE="backups/insightbooks_backup_Feb122026.dump"

# Restore using Docker
docker run --rm \
  -v $(pwd)/backups:/backup \
  -e PGPASSWORD="$DB_PASS" \
  --network host \
  postgres:12 \
  pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --verbose \
    "/backup/insightbooks_backup_Feb122026.dump"
```

---

## 🔍 How It Works

1. **Docker pulls PostgreSQL 12 image** (first time only)
2. **Mounts your backup directory** into the container
3. **Uses `--network host`** to connect to your database (same as localhost)
4. **Runs `pg_restore`** from inside the container
5. **Restores directly** to your database

---

## ✅ Advantages

- ✅ **No installation needed** - Docker handles everything
- ✅ **Works immediately** - No repository configuration
- ✅ **Isolated** - Doesn't affect your system PostgreSQL
- ✅ **Reliable** - Uses exact PostgreSQL 12 version

---

## 🆘 Troubleshooting

### Issue: "Docker is not installed"

**Solution:**
```bash
sudo yum install -y docker
sudo systemctl start docker
```

### Issue: "Permission denied" when running Docker

**Solution:**
```bash
# Option 1: Use sudo
sudo docker run ...

# Option 2: Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Issue: "Cannot connect to database"

**Solution:**
- Check if database is accessible from host:
  ```bash
  psql -h localhost -U henmik -d insightbooks -c "SELECT 1;"
  ```
- If database is on remote host, replace `localhost` with actual IP
- If using `--network host`, the container uses your host's network

### Issue: "Connection refused"

**Solution:**
- Make sure PostgreSQL is running: `systemctl status postgresql`
- Check firewall: `firewall-cmd --list-all`
- Verify DATABASE_URL in .env matches your actual database

---

## 📋 Quick Reference

```bash
# 1. Install Docker (if needed)
sudo yum install -y docker && sudo systemctl start docker

# 2. Restore backup
./scripts/restore-with-docker.sh backups/insightbooks_backup_Feb122026.dump

# 3. Verify
npx prisma migrate status
npx prisma studio
```

---

## 🎯 Alternative: Convert to SQL First

If Docker doesn't work, you can convert the backup to SQL format using Docker, then restore with your local psql:

```bash
# Step 1: Convert backup to SQL using Docker
docker run --rm \
  -v $(pwd)/backups:/backup \
  postgres:12 \
  pg_restore /backup/insightbooks_backup_Feb122026.dump > /tmp/backup.sql

# Step 2: Restore SQL file
psql -h localhost -U henmik -d insightbooks -f /tmp/backup.sql
```

---

**Docker is the easiest solution when PostgreSQL 12 client isn't available!** 🚀
