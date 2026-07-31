/**
 * Phase 5 migration dry-run checks (does not apply migration).
 * Verifies SQL file presence and secret-hygiene heuristics.
 */
import fs from 'fs';
import path from 'path';

const sqlPath = path.resolve(
  'prisma/migrations/20260722230000_mra_eis_phase5_foundation/migration.sql'
);
const schemaPath = path.resolve('prisma/schema.prisma');

const sql = fs.readFileSync(sqlPath, 'utf8');
const schema = fs.readFileSync(schemaPath, 'utf8');
const phase5 = schema.slice(schema.indexOf('model MraEisTerminal'));

const checks = [
  { name: 'migration SQL exists', ok: fs.existsSync(sqlPath) },
  { name: 'creates MraEisTerminal', ok: /CREATE TABLE IF NOT EXISTS "MraEisTerminal"/i.test(sql) },
  { name: 'creates MraEisOutbox', ok: /CREATE TABLE IF NOT EXISTS "MraEisOutbox"/i.test(sql) },
  { name: 'no jwt plaintext column', ok: !/\bjwt\b\s+TEXT/i.test(sql) },
  { name: 'vaultReference present', ok: /vaultReference/i.test(sql) },
  { name: 'schema has vaultReference', ok: phase5.includes('vaultReference') },
  { name: 'schema has no activationCode String', ok: !/activationCode\s+String/i.test(phase5) },
  { name: 'additive CREATE only (no DROP TABLE)', ok: !/DROP TABLE/i.test(sql) },
];

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2));
process.exit(failed.length ? 1 : 0);
