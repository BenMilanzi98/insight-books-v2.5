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
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Working directory: $PROJECT_ROOT"
echo ""

# Load .env file if it exists
if [ -f .env ]; then
    echo -e "${GREEN}Loading database configuration from .env file...${NC}"
    # Use a safer method to load .env (handles values with spaces)
    set -a
    source .env
    set +a
else
    echo -e "${YELLOW}Warning: .env file not found. Using environment variables.${NC}"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not found in .env or environment variables"
    echo "Please ensure DATABASE_URL is set in your .env file or as an environment variable"
    exit 1
fi

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/backup_${TIMESTAMP}.dump"

echo -e "${YELLOW}Creating database backup...${NC}"
echo "Backup file: ${BACKUP_FILE}"

# Create backup using pg_dump
pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup created successfully!${NC}"
    echo "File: ${BACKUP_FILE}"
    echo ""
    echo "To restore this backup:"
    echo "pg_restore -d \"\$DATABASE_URL\" -c ${BACKUP_FILE}"
else
    echo "❌ Backup failed!"
    exit 1
fi

