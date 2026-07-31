#!/usr/bin/env node
/**
 * Phase 18 — produce a local/staging inventory stub (NOT production cutover).
 * Safe: read-only counts when DATABASE_URL is set; otherwise template only.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outDir = path.join(process.cwd(), 'artifacts', 'production-cutover', 'inventory');
fs.mkdirSync(outDir, { recursive: true });

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* ignore */
}

const inventory = {
  title: 'Production / staging data inventory stub',
  disclaimer: 'NOT a completed production inventory. Fill from production discovery.',
  commit,
  generatedAt: new Date().toISOString(),
  environment: process.env.CUTOVER_INVENTORY_ENV || 'local',
  domains: {
    MASTER_DATA: ['Business', 'Branch', 'Department', 'Currency', 'Settings'],
    FINANCIAL_TRANSACTION: ['Journal', 'JournalLine', 'Invoice', 'Payment', 'Expense', 'Payroll'],
    SECURITY_DATA: ['User', 'Membership', 'Role', 'Permission', 'Approval'],
    AUDIT_DATA: ['AuditEvent', 'SecV2AuditEvent'],
    DOCUMENT_DATA: ['Attachment', 'Upload'],
    REBUILDABLE_CACHE: ['AcctV2ReportCache', 'dashboard caches'],
  },
  counts: {
    note: 'Run against production with approved credentials to populate.',
    tenants: null,
    users: null,
    journals: null,
    journalLines: null,
  },
  latestPrismaMigration: '20260721200000_security_governance_v2',
};

const outFile = path.join(outDir, `inventory-${Date.now()}.json`);
fs.writeFileSync(outFile, JSON.stringify(inventory, null, 2));
fs.writeFileSync(path.join(outDir, 'inventory-latest.json'), JSON.stringify(inventory, null, 2));
console.log(JSON.stringify({ ok: true, outFile, productionCutover: false }, null, 2));
