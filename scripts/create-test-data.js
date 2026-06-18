#!/usr/bin/env node
/**
 * Seed QA-Accounting tenant with accounting test scenarios.
 * Requires dev server at localhost:3000 for tenant bootstrap (admin API).
 *
 * Usage: npm run create-test-data
 */

const { spawnSync } = require('child_process');
const path = require('path');

const TENANT = 'QA-Accounting';
const EMAIL = 'qa@accounting.test';
const USER = 'QA User';
const PASSWORD = 'QaTest2026!';

const script = path.join(__dirname, 'accounting-qa-scenarios.cjs');
const result = spawnSync(process.execPath, [script, TENANT, EMAIL, USER, PASSWORD], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: process.env,
});

process.exit(result.status ?? 1);
