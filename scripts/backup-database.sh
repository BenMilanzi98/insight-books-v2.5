#!/bin/bash

# Database Backup Script
# Creates a timestamped backup of your database

set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root (parent of scripts directory)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Working directory: $PROJECT_ROOT"
echo ""

# Load .env file if it exists
if [ -f .env ]; then
    echo -e "${GREEN}Loading database configuration from .env file...${NC}"
    # Extract DATABASE_URL from .env file, handling quotes and comments
    # This method is more robust and handles special characters
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        
        # Check if line contains DATABASE_URL
        if [[ "$line" =~ ^[[:space:]]*DATABASE_URL[[:space:]]*= ]]; then
            # Remove 'DATABASE_URL=' prefix
            DATABASE_URL="${line#*=}"
            # Remove leading/trailing whitespace
            DATABASE_URL="${DATABASE_URL#"${DATABASE_URL%%[![:space:]]*}"}"
            DATABASE_URL="${DATABASE_URL%"${DATABASE_URL##*[![:space:]]}"}"
            # Remove surrounding quotes if present (both single and double)
            DATABASE_URL="${DATABASE_URL%\"}"
            DATABASE_URL="${DATABASE_URL#\"}"
            DATABASE_URL="${DATABASE_URL%\'}"
            DATABASE_URL="${DATABASE_URL#\'}"
            export DATABASE_URL
            break
        fi
    done < .env
else
    echo -e "${YELLOW}Warning: .env file not found. Using environment variables.${NC}"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not found in .env or environment variables${NC}"
    echo "Please ensure DATABASE_URL is set in your .env file or as an environment variable"
    exit 1
fi

# Remove the ?schema= parameter (Prisma-specific, not used by pg_dump)
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')

# Parse URL for pg_dump (avoids issues with special chars in password and URI handling)
# Format: postgresql://user:password@host:port/dbname (password without : or @)
USE_PARSED=0
if [[ "$DB_URL_CLEAN" =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]*) ]]; then
    PGUSER="${BASH_REMATCH[1]}"
    PGPASSWORD="${BASH_REMATCH[2]}"
    PGHOST="${BASH_REMATCH[3]}"
    PGPORT="${BASH_REMATCH[4]}"
    PGDATABASE="${BASH_REMATCH[5]}"
    USE_PARSED=1
fi

# Debug: Show database connection (mask password)
echo -e "${GREEN}Database connection loaded${NC}"
if [ -n "$USE_PARSED" ] && [ "$USE_PARSED" -eq 1 ]; then
    echo "Host: $PGHOST:$PGPORT Database: $PGDATABASE User: $PGUSER"
fi

# Check pg_dump is available
if ! command -v pg_dump >/dev/null 2>&1; then
    echo -e "${RED}ERROR: pg_dump not found. Install PostgreSQL client (e.g. apt install postgresql-client).${NC}"
    exit 1
fi

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/backup_${TIMESTAMP}.dump"

echo -e "${YELLOW}Creating database backup...${NC}"
echo "Backup file: ${BACKUP_FILE}"
echo "Connecting to database..."

run_pg_dump() {
    if [ "$USE_PARSED" -eq 1 ]; then
        export PGPASSWORD
        pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -F c -f "$BACKUP_FILE" --no-password 2>&1
    else
        pg_dump "$DB_URL_CLEAN" -F c -f "$BACKUP_FILE" --no-password 2>&1
    fi
}

DUMP_OUTPUT=$(run_pg_dump)
DUMP_EXIT_CODE=$?

# Unset PGPASSWORD if we set it
[ "$USE_PARSED" -eq 1 ] && unset PGPASSWORD

# Filter out the libpq version warning (harmless)
if echo "$DUMP_OUTPUT" | grep -q "no version information available"; then
    echo "Note: Library version warning (can be ignored)"
fi

if [ $DUMP_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Backup created successfully!${NC}"
    echo "File: ${BACKUP_FILE}"
    echo ""
    echo "To restore this backup:"
    echo "pg_restore -d \"\$DATABASE_URL\" -c ${BACKUP_FILE}"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    echo ""
    echo "pg_dump output:"
    echo "$DUMP_OUTPUT"
    echo ""
    echo "Common causes: PostgreSQL not running, wrong host/port/user/password in .env, or pg_dump not in PATH."
    exit 1
fi

