# 🔧 Fix Database Connection Issues

## Problem

You're getting this error:
```
Error: P1001: Can't reach database server at `localhost:5432`
```

This means Prisma cannot connect to your PostgreSQL database.

---

## 🔍 Step 1: Diagnose the Issue

Run the diagnostic script:

```bash
./scripts/diagnose-db-connection.sh
```

This will:
- ✅ Check if PostgreSQL client tools are installed
- ✅ Test network connectivity
- ✅ Test database connection
- ✅ Show detailed error messages
- ✅ Provide specific recommendations

---

## 🎯 Step 2: Identify Your Database Location

Your database could be in one of these places:

### Option A: Database on the Same Server (Localhost)

If PostgreSQL is installed on the same server:

```bash
# Check if PostgreSQL is running
systemctl status postgresql

# If not running, start it
systemctl start postgresql
systemctl enable postgresql  # Enable on boot

# Check if it's listening
netstat -tlnp | grep 5432
# or
ss -tlnp | grep 5432
```

**DATABASE_URL format:**
```env
DATABASE_URL="postgresql://username:password@localhost:5432/insightbooks?schema=public"
```

### Option B: Database on Remote Server

If your database is on a different server:

```bash
# Test if you can reach the remote server
ping your-database-server.com

# Test if port 5432 is open
telnet your-database-server.com 5432
# or
nc -zv your-database-server.com 5432
```

**DATABASE_URL format:**
```env
DATABASE_URL="postgresql://username:password@your-database-server.com:5432/insightbooks?schema=public"
```

### Option C: Database in Docker

If you're using Docker:

```bash
# Check if database container is running
docker ps | grep postgres

# If not running, start it
docker-compose up -d db
# or
docker start your-postgres-container
```

**DATABASE_URL format:**
- From inside Docker network: `postgresql://user:pass@db:5432/database`
- From host machine: `postgresql://user:pass@localhost:5432/database` (if port is mapped)

### Option D: Managed Database (AWS RDS, DigitalOcean, etc.)

If using a managed database service:

1. **Get connection details from your provider's dashboard**
2. **Use the connection string they provide**

**Example (DigitalOcean):**
```env
DATABASE_URL="postgresql://doadmin:password@db-postgresql-fra1-12345.db.ondigitalocean.com:25060/defaultdb?sslmode=require"
```

**Example (AWS RDS):**
```env
DATABASE_URL="postgresql://username:password@your-db-instance.region.rds.amazonaws.com:5432/insightbooks"
```

---

## 🛠️ Step 3: Fix Your .env File

1. **Edit your .env file:**
   ```bash
   nano .env
   ```

2. **Update DATABASE_URL with correct values:**
   ```env
   # Format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public
   
   # Example for local database:
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/insightbooks?schema=public"
   
   # Example for remote database:
   DATABASE_URL="postgresql://postgres:yourpassword@192.168.1.100:5432/insightbooks?schema=public"
   
   # Example for managed database:
   DATABASE_URL="postgresql://user:pass@db.example.com:5432/insightbooks?sslmode=require"
   ```

3. **Save and exit** (Ctrl+X, then Y, then Enter in nano)

---

## ✅ Step 4: Test the Connection

After updating `.env`, test the connection:

```bash
# Run diagnostic again
./scripts/diagnose-db-connection.sh

# Or test with Prisma directly
npx prisma db execute --stdin <<< "SELECT version();"
```

If you see the PostgreSQL version, **connection is working!** ✅

---

## 🚀 Step 5: Proceed with Migration

Once the connection works:

```bash
# Check migration status
npx prisma migrate status

# Deploy migrations safely
./scripts/safe-deploy-production.sh
```

---

## 🔥 Common Issues & Solutions

### Issue 1: "Can't reach database server at localhost:5432"

**Solution:**
- If database is on same server: Start PostgreSQL service
- If database is remote: Update DATABASE_URL with correct host
- If using Docker: Use service name instead of localhost

### Issue 2: "Authentication failed"

**Solution:**
- Verify username and password in DATABASE_URL
- Check if user exists: `psql -U postgres -c "\du"`
- Reset password if needed: `ALTER USER username WITH PASSWORD 'newpassword';`

### Issue 3: "Database does not exist"

**Solution:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE insightbooks;

# Exit
\q
```

### Issue 4: "Connection refused" or "Connection timeout"

**Solutions:**
1. **Check firewall:**
   ```bash
   # CentOS/RHEL
   firewall-cmd --list-all
   firewall-cmd --add-port=5432/tcp --permanent
   firewall-cmd --reload
   
   # Ubuntu/Debian
   ufw allow 5432/tcp
   ```

2. **Check PostgreSQL is listening:**
   ```bash
   # Edit postgresql.conf
   nano /etc/postgresql/*/main/postgresql.conf
   # Set: listen_addresses = '*'
   
   # Edit pg_hba.conf
   nano /etc/postgresql/*/main/pg_hba.conf
   # Add: host all all 0.0.0.0/0 md5
   
   # Restart PostgreSQL
   systemctl restart postgresql
   ```

3. **Check if port is correct:**
   ```bash
   # Find what port PostgreSQL is using
   sudo netstat -tlnp | grep postgres
   ```

### Issue 5: "SSL connection required"

**Solution:**
Add `?sslmode=require` to your DATABASE_URL:
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

---

## 📋 Quick Checklist

- [ ] Ran diagnostic script: `./scripts/diagnose-db-connection.sh`
- [ ] Identified where database is located
- [ ] Updated DATABASE_URL in `.env` with correct values
- [ ] Tested connection: `npx prisma db execute --stdin <<< "SELECT 1;"`
- [ ] Connection works ✅
- [ ] Proceeded with migration: `./scripts/safe-deploy-production.sh`

---

## 🆘 Still Having Issues?

1. **Check PostgreSQL logs:**
   ```bash
   # Find log location
   sudo -u postgres psql -c "SHOW log_directory;"
   
   # View recent logs
   tail -f /var/log/postgresql/postgresql-*.log
   ```

2. **Test with psql directly:**
   ```bash
   # Extract connection details from DATABASE_URL
   psql "postgresql://user:pass@host:5432/database"
   ```

3. **Verify network connectivity:**
   ```bash
   ping your-database-host
   telnet your-database-host 5432
   ```

4. **Check if database service is running:**
   ```bash
   systemctl status postgresql
   # or
   docker ps | grep postgres
   ```

---

**Once your connection works, you can safely deploy migrations!** 🚀
