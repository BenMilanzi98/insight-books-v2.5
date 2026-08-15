import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

let envDb = null;

export function openDesktopDb(filePath) {
  const db = new Database(filePath);
  db.exec(schemaSql);
  return db;
}

export function getDesktopDbFromEnv() {
  if (envDb) return envDb;
  const filePath =
    process.env.DESKTOP_SQLITE_PATH ||
    join(process.env.APPDATA || '', 'InsightBooks', 'desktop.sqlite');
  envDb = openDesktopDb(filePath);
  return envDb;
}

export function resetDesktopDbFromEnvForTests() {
  envDb = null;
}
