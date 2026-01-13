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

# Remove the ?schema= parameter for pg_dump (it's Prisma-specific, not needed for pg_dump)
# pg_dump doesn't understand the schema query parameter
DB_URL_FOR_DUMP=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//' | sed 's/&schema=[^&]*//')

# Debug: Show database connection (mask password)
DB_INFO=$(echo "$DB_URL_FOR_DUMP" | sed 's/:[^:@]*@/:***@/' | cut -c1-80)
echo -e "${GREEN}Database connection loaded${NC}"

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/backup_${TIMESTAMP}.dump"

echo -e "${YELLOW}Creating database backup...${NC}"
echo "Backup file: ${BACKUP_FILE}"

# Create backup using pg_dump
# Use --no-password to avoid interactive prompts
echo "Connecting to database..."
DUMP_OUTPUT=$(pg_dump "$DB_URL_FOR_DUMP" -F c -f "$BACKUP_FILE" --no-password 2>&1)
DUMP_EXIT_CODE=$?

# Filter out the libpq version warning (it's harmless)
if echo "$DUMP_OUTPUT" | grep -q "no version information available"; then
    echo "Note: Library version warning (can be ignored)"
fi

# Check for actual errors
if echo "$DUMP_OUTPUT" | grep -q "error\|failed\|invalid"; then
    echo -e "${RED}Backup error:${NC}"
    echo "$DUMP_OUTPUT" | grep -i "error\|failed\|invalid"
    exit 1
fi

if [ $DUMP_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Backup created successfully!${NC}"
    echo "File: ${BACKUP_FILE}"
    echo ""
    echo "To restore this backup:"
    echo "pg_restore -d \"\$DATABASE_URL\" -c ${BACKUP_FILE}"
else
    echo "❌ Backup failed!"
    exit 1
fi

