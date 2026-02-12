#!/bin/bash

# Restore Backup Using Docker PostgreSQL 12
# This is the most reliable method when PostgreSQL 12 client isn't available

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "🐳 Restore Backup with Docker PostgreSQL 12"
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo ""
    echo "Please install Docker first:"
    echo "  sudo yum install -y docker"
    echo "  sudo systemctl start docker"
    echo "  sudo systemctl enable docker"
    exit 1
fi

echo -e "${GREEN}✅ Docker is installed${NC}"
docker --version
echo ""

# Get backup file path
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <backup_file_path>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 backups/insightbooks_backup_Feb122026.dump"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}ERROR: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

# Get absolute path
BACKUP_FILE=$(realpath "$BACKUP_FILE")
BACKUP_DIR=$(dirname "$BACKUP_FILE")
BACKUP_NAME=$(basename "$BACKUP_FILE")

echo -e "${GREEN}✅ Backup file found: ${BACKUP_FILE}${NC}"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "   Size: ${BACKUP_SIZE}"
echo ""

# Load .env file
DATABASE_URL=""
if [ -f .env ]; then
    echo -e "${BLUE}Loading DATABASE_URL from .env file...${NC}"
    while IFS= read -r line || [ -n "$line" ]; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        if [[ "$line" =~ ^[[:space:]]*DATABASE_URL[[:space:]]*= ]]; then
            DATABASE_URL="${line#*=}"
            DATABASE_URL="${DATABASE_URL#"${DATABASE_URL%%[![:space:]]*}"}"
            DATABASE_URL="${DATABASE_URL%"${DATABASE_URL##*[![:space:]]}"}"
            DATABASE_URL="${DATABASE_URL%\"}"
            DATABASE_URL="${DATABASE_URL#\"}"
            DATABASE_URL="${DATABASE_URL%\'}"
            DATABASE_URL="${DATABASE_URL#\'}"
            break
        fi
    done < .env
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}Warning: DATABASE_URL not found in .env${NC}"
    echo "Please provide database connection details:"
    read -p "Database host [localhost]: " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    read -p "Database port [5432]: " DB_PORT
    DB_PORT=${DB_PORT:-5432}
    read -p "Database name [insightbooks]: " DB_NAME
    DB_NAME=${DB_NAME:-insightbooks}
    read -p "Database user [henmik]: " DB_USER
    DB_USER=${DB_USER:-henmik}
    read -sp "Database password: " DB_PASS
    echo ""
else
    # Parse DATABASE_URL
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Default values if parsing fails
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
fi

echo -e "${BLUE}Database connection:${NC}"
echo "  Host: ${DB_HOST}"
echo "  Port: ${DB_PORT}"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo ""

# Confirm restore
echo -e "${YELLOW}⚠️  This will restore data to the database${NC}"
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${BLUE}Step 1: Pulling PostgreSQL 12 Docker image...${NC}"
docker pull postgres:12 || {
    echo -e "${RED}Failed to pull PostgreSQL 12 image${NC}"
    exit 1
}

echo ""
echo -e "${BLUE}Step 2: Restoring backup using Docker...${NC}"
echo "This may take several minutes..."
echo ""

# Use Docker to restore
# Mount the backup directory and use host network to connect to database
docker run --rm \
    -v "$BACKUP_DIR:/backup" \
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
        "/backup/$BACKUP_NAME" 2>&1 | tee /tmp/restore_docker.log

# Check result
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Restore completed successfully!${NC}"
else
    # Check if it's just warnings
    ERROR_COUNT=$(grep -i "error" /tmp/restore_docker.log | grep -v "already exists" | grep -v "does not exist" | wc -l)
    if [ "$ERROR_COUNT" -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Restore completed with minor warnings (normal)${NC}"
    else
        echo ""
        echo -e "${YELLOW}⚠️  Restore completed but had some errors${NC}"
        echo "Check /tmp/restore_docker.log for details"
    fi
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Restore Process Completed!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. ✅ Verify data: npx prisma studio"
echo "2. ✅ Generate Prisma client: npx prisma generate"
echo "3. ✅ Restart application: pm2 restart your-app-name"
