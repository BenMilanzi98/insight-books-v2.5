#!/usr/bin/env node
/**
 * Fresh-books V2 + CoA SoT — forbid residual legacy GL writers in production code.
 *
 * Scans app/api/** and lib/** (with allowlists) for:
 *   - await postGlEntry( / return postGlEntry(
 *   - transaction.create(
 *   - updateAccountBalanceOnTransaction(
 *
 * Exit 1 on any violation. Used by CI and test/accountingV2.freshBooksCutover.test.js.
 *
 * Usage: node scripts/forbid-legacy-gl-writers.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SCAN_ROOTS = [path.join(ROOT, 'app', 'api'), path.join(ROOT, 'lib')];

/** Path prefixes (posix) always skipped. */
const ALWAYS_SKIP_PREFIXES = [
  'scripts/',
  'test/',
  'docs/',
  'lib/accountingV2/infrastructure/legacy/',
];

/**
 * await|return postGlEntry( — allow accountingEngine (including throw-stub body
 * callers like reverse/batch) and the definition file itself.
 */
const POST_GL_ENTRY_ALLOW = new Set([
  'lib/accountingEngine/postGlEntry.js',
  'lib/accountingEngine/postGlEntryBatch.js',
  'lib/accountingEngine/reverseGlEntry.js',
]);

/**
 * transaction.create( — only the retired postGlEntry body + purchaseAccounting
 * dead code after LEGACY_POSTING_REMOVED throws (temporary).
 */
const TRANSACTION_CREATE_ALLOW = new Set([
  'lib/accountingEngine/postGlEntry.js',
  'lib/purchaseAccounting.js',
]);

/**
 * updateAccountBalanceOnTransaction( — definition (throws) + temporary dead-code
 * allowlist in purchaseAccounting / postGlEntry after early throws.
 */
const BALANCE_MUTATION_ALLOW = new Set([
  'lib/accountBalanceService.js',
  'lib/accountingEngine/postGlEntry.js',
  'lib/purchaseAccounting.js',
]);

const POST_GL_PATTERNS = [/\bawait\s+postGlEntry\s*\(/g, /\breturn\s+postGlEntry\s*\(/g];
const TRANSACTION_CREATE_PATTERN = /\.transaction\.create\s*\(/g;
const BALANCE_MUTATION_PATTERN = /\bupdateAccountBalanceOnTransaction\s*\(/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', 'artifacts'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(js|jsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function toPosix(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function shouldSkip(rel) {
  return ALWAYS_SKIP_PREFIXES.some((p) => rel.startsWith(p));
}

function lineNumbers(source, matchIndex) {
  return source.slice(0, matchIndex).split(/\r?\n/).length;
}

function collectMatches(source, regex) {
  const hits = [];
  const re = new RegExp(regex.source, regex.flags);
  let m;
  while ((m = re.exec(source)) !== null) {
    hits.push({ index: m.index, text: m[0], line: lineNumbers(source, m.index) });
  }
  return hits;
}

function scan() {
  const violations = [];
  const files = SCAN_ROOTS.flatMap((root) => walk(root));

  for (const file of files) {
    const rel = toPosix(file);
    if (shouldSkip(rel)) continue;
    const source = fs.readFileSync(file, 'utf8');

    if (!POST_GL_ENTRY_ALLOW.has(rel)) {
      for (const pattern of POST_GL_PATTERNS) {
        for (const hit of collectMatches(source, pattern)) {
          violations.push({
            rule: 'no-active-postGlEntry',
            file: rel,
            line: hit.line,
            match: hit.text.trim(),
          });
        }
      }
    }

    if (!TRANSACTION_CREATE_ALLOW.has(rel)) {
      for (const hit of collectMatches(source, TRANSACTION_CREATE_PATTERN)) {
        violations.push({
          rule: 'no-transaction-create',
          file: rel,
          line: hit.line,
          match: hit.text.trim(),
        });
      }
    }

    if (!BALANCE_MUTATION_ALLOW.has(rel)) {
      for (const hit of collectMatches(source, BALANCE_MUTATION_PATTERN)) {
        // Allow the export declaration in accountBalanceService (already allowlisted).
        violations.push({
          rule: 'no-updateAccountBalanceOnTransaction',
          file: rel,
          line: hit.line,
          match: hit.text.trim(),
        });
      }
    }
  }

  return violations;
}

function main() {
  const violations = scan();
  if (violations.length === 0) {
    console.log('forbid-legacy-gl-writers: OK (0 violations)');
    return;
  }

  console.error(`forbid-legacy-gl-writers: ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}:${v.line}  ${v.match}`);
  }
  console.error(
    '\nFresh-books V2: use executePosting / V2 adapters. Legacy Transaction writers are retired.'
  );
  process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  scan,
  POST_GL_ENTRY_ALLOW,
  TRANSACTION_CREATE_ALLOW,
  BALANCE_MUTATION_ALLOW,
  ALWAYS_SKIP_PREFIXES,
};
