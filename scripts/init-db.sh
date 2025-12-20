#!/bin/bash
set -e

# Script to restore the database backup during PostgreSQL initialization
echo "Restoring database from backup..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -U henmik -d insightbooks; do
  sleep 2
  echo "PostgreSQL is not ready yet, waiting..."
done

# Restore the database backup using pg_restore
echo "Restoring database backup..."
pg_restore -U henmik -d insightbooks --verbose --clean --no-acl --no-owner /docker-entrypoint-initdb.d/01_insightbooks_backup.dump

echo "Database restoration completed!"