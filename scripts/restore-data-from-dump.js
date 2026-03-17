#!/usr/bin/env node
/**
 * Clear local DB data and restore only DATA from a PostgreSQL custom-format dump.
 * Does not alter tables or schema – only truncates and loads data.
 *
 * Usage (from project root):
 *   node scripts/restore-data-from-dump.js [path-to-dump]
 *
 * Default dump path: insightbooks_backup_March_17.dump
 * Requires: DATABASE_URL in .env
 */

const path = require('path');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');

// Load .env
require('dotenv').config({ path: path.join(projectRoot, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const dumpPath = path.resolve(projectRoot, process.argv[2] || 'insightbooks_backup_March_17.dump');

function main() {
  if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL in .env');
    process.exit(1);
  }
  if (!fs.existsSync(dumpPath)) {
    console.error('Dump file not found:', dumpPath);
    process.exit(1);
  }

  console.log('Using DATABASE_URL from .env (host/DB from there).');
  console.log('Dump file:', dumpPath);
  console.log('');

  const { Client } = require('pg');

  async function withClient(fn) {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  async function truncateAll() {
    await withClient(async (client) => {
      const r = await client.query(`
        SELECT string_agg(quote_ident(tablename), ', ') AS tblist
        FROM pg_tables
        WHERE schemaname = 'public'
      `);
      const list = r.rows[0]?.tblist;
      if (!list) {
        console.log('No tables in public schema – skipping truncate.');
        return;
      }
      console.log('Truncating all tables in public schema (CASCADE)...');
      await client.query(`TRUNCATE TABLE ${list} CASCADE`);
      console.log('Truncate done.');
    });
  }

  // Use a SQL script so we can run it with session_replication_role = replica (bypasses FK triggers during COPY)
  function restoreViaScript() {
    const os = require('os');
    const scriptPath = path.join(os.tmpdir(), `restore-data-${Date.now()}.sql`);
    const dbUrlForRestore = DATABASE_URL.replace(/\?.*$/, '');
    console.log('Writing data-only restore script...');
    const writeResult = spawnSync('pg_restore', ['--data-only', '-f', scriptPath, dumpPath], {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (writeResult.status !== 0) {
      console.error(writeResult.stderr || writeResult.stdout);
      throw new Error('pg_restore script generation failed');
    }
    try {
      const { execSync } = require('child_process');
      execSync(
        `psql "${dbUrlForRestore}" -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f "${scriptPath}" -c "SET session_replication_role = DEFAULT;"`,
        { stdio: 'inherit', cwd: projectRoot }
      );
    } finally {
      try {
        fs.unlinkSync(scriptPath);
      } catch (_) {}
    }
  }

  (async () => {
    try {
      await truncateAll();
    } catch (e) {
      console.error('Truncate failed:', e.message);
      process.exit(1);
    }

    console.log('Restoring data only from dump (no schema changes)...');
    try {
      restoreViaScript();
    } catch (e) {
      console.error('Restore failed:', e.message);
      process.exit(1);
    }
    console.log('Restore finished.');
  })();
}

main();
