#!/bin/bash

# Database Connection Diagnostic Script
# Helps identify and fix database connection issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "🔍 Database Connection Diagnostic"
echo "=========================================="
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

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

# Also check environment variable
if [ -z "$DATABASE_URL" ]; then
    DATABASE_URL="$DATABASE_URL_ENV"
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ ERROR: DATABASE_URL not found in .env or environment variables${NC}"
    echo ""
    echo "Please ensure DATABASE_URL is set in your .env file:"
    echo "DATABASE_URL=\"postgresql://user:password@host:port/database?schema=public\""
    exit 1
fi

# Parse DATABASE_URL
echo -e "${GREEN}✅ DATABASE_URL found${NC}"
echo ""

# Extract components (mask password)
DB_INFO=$(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/')
echo -e "${BLUE}Current DATABASE_URL: ${DB_INFO}${NC}"
echo ""

# Extract host, port, database from DATABASE_URL
# Format: postgresql://user:password@host:port/database?schema=public
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

echo -e "${BLUE}Parsed connection details:${NC}"
echo "  Host: ${DB_HOST}"
echo "  Port: ${DB_PORT}"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo ""

# Check if PostgreSQL client tools are available
echo -e "${BLUE}Step 1: Checking PostgreSQL client tools...${NC}"
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✅ psql is installed${NC}"
    PSQL_VERSION=$(psql --version | head -1)
    echo "  Version: $PSQL_VERSION"
else
    echo -e "${YELLOW}⚠️  psql is not installed${NC}"
    echo "  Install with: yum install postgresql (CentOS/RHEL) or apt-get install postgresql-client (Debian/Ubuntu)"
fi
echo ""

# Check if database host is reachable
echo -e "${BLUE}Step 2: Testing network connectivity...${NC}"
if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ]; then
    echo "Testing connection to $DB_HOST:$DB_PORT..."
    if command -v nc &> /dev/null || command -v telnet &> /dev/null; then
        if command -v nc &> /dev/null; then
            if nc -z -w 5 "$DB_HOST" "${DB_PORT:-5432}" 2>/dev/null; then
                echo -e "${GREEN}✅ Host $DB_HOST:$DB_PORT is reachable${NC}"
            else
                echo -e "${RED}❌ Cannot reach $DB_HOST:$DB_PORT${NC}"
                echo "  Check:"
                echo "    - Is the database server running?"
                echo "    - Is the hostname/IP correct?"
                echo "    - Are firewall rules allowing connections?"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  nc or telnet not available, skipping network test${NC}"
    fi
else
    echo "Testing local PostgreSQL service..."
    if systemctl is-active --quiet postgresql 2>/dev/null || systemctl is-active --quiet postgresql-* 2>/dev/null; then
        echo -e "${GREEN}✅ PostgreSQL service is running locally${NC}"
    else
        echo -e "${YELLOW}⚠️  PostgreSQL service status unclear${NC}"
        echo "  Check with: systemctl status postgresql"
    fi
fi
echo ""

# Test database connection
echo -e "${BLUE}Step 3: Testing database connection...${NC}"
if command -v psql &> /dev/null; then
    # Remove ?schema= parameter for psql
    DB_URL_FOR_PSQL=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')
    
    echo "Attempting to connect..."
    if PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql "$DB_URL_FOR_PSQL" -c "SELECT version();" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful!${NC}"
        echo ""
        echo "Database version:"
        PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql "$DB_URL_FOR_PSQL" -c "SELECT version();" | head -3
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        echo ""
        echo "Common issues and solutions:"
        echo ""
        echo "1. Database server not running:"
        echo "   - Check: systemctl status postgresql"
        echo "   - Start: systemctl start postgresql"
        echo ""
        echo "2. Wrong host/port:"
        echo "   - Verify DATABASE_URL in .env"
        echo "   - Check if database is on remote server"
        echo ""
        echo "3. Authentication failed:"
        echo "   - Verify username and password in DATABASE_URL"
        echo "   - Check pg_hba.conf for allowed connections"
        echo ""
        echo "4. Database doesn't exist:"
        echo "   - Create database: createdb -h $DB_HOST -U $DB_USER $DB_NAME"
        echo ""
        echo "5. Network/firewall issues:"
        echo "   - Check firewall: firewall-cmd --list-all (CentOS/RHEL)"
        echo "   - Check if port $DB_PORT is open"
        echo ""
        echo "Trying to get more details..."
        PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') psql "$DB_URL_FOR_PSQL" -c "SELECT 1;" 2>&1 || true
    fi
else
    echo -e "${YELLOW}⚠️  psql not available, cannot test connection${NC}"
fi
echo ""

# Test with Prisma
echo -e "${BLUE}Step 4: Testing with Prisma...${NC}"
export DATABASE_URL
if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Prisma can connect to database${NC}"
else
    echo -e "${RED}❌ Prisma cannot connect to database${NC}"
    echo ""
    echo "Error details:"
    npx prisma db execute --stdin <<< "SELECT 1;" 2>&1 || true
fi
echo ""

# Check for common production database setups
echo -e "${BLUE}Step 5: Checking for common production setups...${NC}"

# Check if using Docker
if [ -f docker-compose.yml ] || [ -f Dockerfile ]; then
    echo -e "${YELLOW}⚠️  Docker detected${NC}"
    echo "  If using Docker, DATABASE_URL might need to use service name"
    echo "  Example: postgresql://user:pass@db:5432/database"
    echo "  Or use host.docker.internal for host machine"
fi

# Check if database is on remote server
if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ] && [ "$DB_HOST" != "db" ]; then
    echo -e "${YELLOW}⚠️  Remote database detected: $DB_HOST${NC}"
    echo "  Make sure:"
    echo "    - Database server allows remote connections"
    echo "    - Firewall allows port $DB_PORT"
    echo "    - pg_hba.conf allows your IP"
fi

echo ""

# Summary and recommendations
echo "=========================================="
echo "📋 Summary & Recommendations"
echo "=========================================="
echo ""

if [ -n "$DB_HOST" ] && [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
    echo -e "${YELLOW}Your DATABASE_URL points to localhost.${NC}"
    echo ""
    echo "If your database is:"
    echo "  ✅ On the same server: Make sure PostgreSQL is running"
    echo "     Check: systemctl status postgresql"
    echo "     Start: systemctl start postgresql"
    echo ""
    echo "  ✅ On a remote server: Update DATABASE_URL with the correct host"
    echo "     Example: postgresql://user:pass@your-db-server.com:5432/database"
    echo ""
    echo "  ✅ In Docker: Use the service name or host.docker.internal"
    echo "     Example: postgresql://user:pass@db:5432/database"
    echo "     Or: postgresql://user:pass@host.docker.internal:5432/database"
fi

echo ""
echo "To fix the connection:"
echo "1. Edit .env file: nano .env"
echo "2. Update DATABASE_URL with correct host, port, user, password, database"
echo "3. Test again: ./scripts/diagnose-db-connection.sh"
echo "4. Once connection works, run: ./scripts/safe-deploy-production.sh"
