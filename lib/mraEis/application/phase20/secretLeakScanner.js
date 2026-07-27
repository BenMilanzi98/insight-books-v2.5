/**
 * Phase 20 — Secret-leak scanner for fixtures, snapshots, and source trees.
 * Detects JWT shapes, private keys, TAC-like fields, BAC, passwords in committed paths.
 */

import fs from 'fs';
import path from 'path';

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
const PRIVATE_KEY_RE = /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const BAC_FIELD_RE = /buyerAuthorizationCode\s*[:=]\s*['"][^'"]+['"]/i;
const TERMINAL_SECRET_RE = /terminalSecret\s*[:=]\s*['"][^'"]+['"]/i;
const TAC_RE = /\btac\s*[:=]\s*['"][A-Za-z0-9_-]{6,}['"]/i;
const PASSWORD_ASSIGN_RE = /password\s*[:=]\s*['"][^'"]{8,}['"]/i;

const DEFAULT_SCAN_ROOTS = [
  'lib/mraEis',
  'test',
  'docs/mra-eis',
  'app/api/mra-eis',
  'app/settings/integrations/mra-eis',
];

const SKIP_DIR = new Set(['node_modules', '.next', '.git', 'coverage', 'dist']);

export function scanTextForSecrets(text, { allowlistedPatterns = [] } = {}) {
  const hits = [];
  const checks = [
    { type: 'JWT', re: JWT_RE },
    { type: 'PRIVATE_KEY', re: PRIVATE_KEY_RE },
    { type: 'BUYER_AUTHORIZATION_CODE', re: BAC_FIELD_RE },
    { type: 'TERMINAL_SECRET', re: TERMINAL_SECRET_RE },
    { type: 'TAC', re: TAC_RE },
    { type: 'PASSWORD_LITERAL', re: PASSWORD_ASSIGN_RE },
  ];
  for (const { type, re } of checks) {
    if (allowlistedPatterns.includes(type)) continue;
    if (re.test(text)) hits.push({ type, severity: type === 'PASSWORD_LITERAL' ? 'HIGH' : 'CRITICAL' });
  }
  return hits;
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, out);
    else if (/\.(js|ts|tsx|jsx|mjs|cjs|md|json|sql|yml|yaml)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

/**
 * Scan repository paths. Ignores intentional negative-test strings when marked.
 * Negative tests should use placeholders like `eyJhbGciOiJ...REDACTED` or set allowTestMarkers.
 */
export function scanPathsForSecrets({
  rootDir = process.cwd(),
  roots = DEFAULT_SCAN_ROOTS,
  allowTestMarkers = true,
} = {}) {
  const findings = [];
  for (const rel of roots) {
    const abs = path.join(rootDir, rel);
    for (const file of walkFiles(abs)) {
      let text;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      // Allow documented placeholders / redacted samples in docs and negative-test fixtures
      if (
        allowTestMarkers &&
        (/REDACTED|PLACEHOLDER|secret-provider:\/\/|\[REDACTED/i.test(text) ||
          /detectCredentialLeak|BLOCKED_SECURITY|eyJhbGciOiJIUzI1NiJ9\.e30\.sig/.test(text))
      ) {
        // Still flag real private key blocks even in tests
        if (PRIVATE_KEY_RE.test(text) && !/BEGIN PRIVATE KEY-----REDACTED/.test(text)) {
          // Allow only if clearly a test asserting detection with truncated key — skip full keys
          if (text.includes('-----BEGIN') && text.includes('PRIVATE KEY-----') && text.length > 200) {
            const hits = scanTextForSecrets(text, { allowlistedPatterns: ['JWT', 'TAC', 'TERMINAL_SECRET', 'BUYER_AUTHORIZATION_CODE', 'PASSWORD_LITERAL'] });
            for (const h of hits) findings.push({ file: path.relative(rootDir, file), ...h });
          }
        }
        continue;
      }
      const hits = scanTextForSecrets(text);
      for (const h of hits) {
        findings.push({ file: path.relative(rootDir, file), ...h });
      }
    }
  }
  return {
    scannedRoots: roots,
    findingCount: findings.length,
    criticalCount: findings.filter((f) => f.severity === 'CRITICAL').length,
    findings,
    ok: findings.filter((f) => f.severity === 'CRITICAL').length === 0,
  };
}

/** Scan an in-memory object (fixtures / API payloads) */
export function scanObjectForSecrets(obj, pathPrefix = '') {
  const findings = [];
  if (obj == null) return findings;
  if (typeof obj === 'string') {
    return scanTextForSecrets(obj).map((h) => ({ path: pathPrefix, ...h }));
  }
  if (typeof obj !== 'object') return findings;
  for (const [k, v] of Object.entries(obj)) {
    const p = pathPrefix ? `${pathPrefix}.${k}` : k;
    // Flag actual secret-bearing fields, not metadata like privateKeysExcluded / tacExcluded
    const sensitiveExact =
      /^(jwt|privateKey|terminalSecret|buyerAuthorizationCode|password|tac|authorizationHeader)$/i.test(
        k
      );
    if (sensitiveExact && v != null && v !== '' && v !== false) {
      findings.push({ path: p, type: 'SENSITIVE_FIELD', severity: 'CRITICAL' });
    }
    findings.push(...scanObjectForSecrets(v, p));
  }
  return findings;
}
