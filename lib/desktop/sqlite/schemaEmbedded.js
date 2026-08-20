/**
 * Desktop SQLite DDL embedded as a string so webpack never resolves
 * schema.sql via import.meta.url (which bakes the build-machine absolute path
 * into .next and breaks Linux VPS deploys of Windows builds).
 */
export const DESKTOP_SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshot_json (
  entity TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  quantity REAL NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS doc_counters (
  type TEXT PRIMARY KEY,
  lastIssued INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  kind TEXT NOT NULL,
  payloadJson TEXT NOT NULL,
  status TEXT NOT NULL,
  errorMessage TEXT,
  serverId TEXT
);
`.trim();
