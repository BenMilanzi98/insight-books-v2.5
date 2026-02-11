#!/bin/bash

# Database Backup Script
# This script creates a backup of the PostgreSQL database before schema changes

# Get the database connection string from environment or use defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-insightbooks}"
DB_USER="${DB_USER:-postgres}"

# Create backup directory if it doesn't exist
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/insightbooks_backup_$TIMESTAMP.dump"
SQL_BACKUP_FILE="$BACKUP_DIR/insightbooks_backup_$TIMESTAMP.sql"

echo "Creating database backup..."
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USER"
echo ""

# Try to create a custom format backup first (more efficient)
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_FILE" 2>/dev/null; then
    echo "✅ Backup created successfully: $BACKUP_FILE"
    echo "To restore this backup, use:"
    echo "  pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $BACKUP_FILE"
elif pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_BACKUP_FILE" 2>/dev/null; then
    echo "✅ SQL backup created successfully: $SQL_BACKUP_FILE"
    echo "To restore this backup, use:"
    echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < $SQL_BACKUP_FILE"
else
    echo "❌ Backup failed. Please run manually with:"
    echo ""
    echo "  # For custom format (recommended):"
    echo "  pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F c -f $BACKUP_FILE"
    echo ""
    echo "  # For SQL format:"
    echo "  pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $SQL_BACKUP_FILE"
    echo ""
    echo "You will be prompted for the database password."
    exit 1
fi

echo ""
echo "Backup completed. File size:"
ls -lh "$BACKUP_FILE" 2>/dev/null || ls -lh "$SQL_BACKUP_FILE" 2>/dev/null
