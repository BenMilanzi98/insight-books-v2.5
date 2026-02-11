#!/bin/bash

# Database Restore Script
# This script restores a PostgreSQL database from a backup file

if [ -z "$1" ]; then
    echo "Usage: ./restore_database.sh <backup_file>"
    echo ""
    echo "Examples:"
    echo "  ./restore_database.sh ./backups/insightbooks_backup_20260209_110420.dump"
    echo "  ./restore_database.sh ./backups/insightbooks_backup_20260209_110420.sql"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Get the database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-insightbooks}"
DB_USER="${DB_USER:-postgres}"

echo "Restoring database from backup..."
echo "Backup file: $BACKUP_FILE"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USER"
echo ""
echo "⚠️  WARNING: This will overwrite the current database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Determine backup format and restore accordingly
if [[ "$BACKUP_FILE" == *.dump ]]; then
    echo "Restoring from custom format backup..."
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$BACKUP_FILE"
elif [[ "$BACKUP_FILE" == *.sql ]]; then
    echo "Restoring from SQL backup..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
else
    echo "❌ Error: Unknown backup file format. Expected .dump or .sql"
    exit 1
fi

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully!"
else
    echo "❌ Restore failed. Please check the error messages above."
    exit 1
fi
