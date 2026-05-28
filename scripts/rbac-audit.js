#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const apiRoot = path.join(root, 'app', 'api');
const pageRoot = path.join(root, 'app');
const routeAccessPath = path.join(root, 'lib', 'tenantPageAccess.js');
const apiAccessPath = path.join(root, 'lib', 'tenantApiAccess.js');

const API_ALLOWLIST = [
  '/api/auth/',
  '/api/admin/',
  '/api/cron/',
  '/api/subscription/',
  '/api/affiliate/',
  '/api/contact/',
  '/api/mobile-app/',
  '/api/placeholder/',
  '/api/test',
  '/api/debug',
];

const PAGE_ALLOWLIST_PREFIXES = [
  '/auth/',
  '/insightbooks/',
  '/affiliate/',
  '/affiliate',
  '/subscription/',
  '/subscription',
  '/switch-tenant',
  '/profile',
  '/account',
  '/contact',
  '/terms',
  '/privacy',
  '/download-app',
  '/help',
  '/support',
  '/verify/',
  '/ref/',
  '/register',
  '/insightbooks',
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

function normalizeToRoute(filePath) {
  const relative = filePath
    .replaceAll('\\', '/')
    .replace(root.replaceAll('\\', '/'), '')
    .replace(/^\/?app/, '')
    .replace(/\/route\.js$/, '');
  return relative.startsWith('/') ? relative : `/${relative}`;
}

function normalizeToPage(filePath) {
  const relative = filePath
    .replaceAll('\\', '/')
    .replace(root.replaceAll('\\', '/'), '')
    .replace(/^\/?app/, '')
    .replace(/\/page\.js$/, '');
  let p = relative.startsWith('/') ? relative : `/${relative}`;
  if (p === '/index') p = '/';
  if (p.endsWith('/index')) p = p.replace(/\/index$/, '');
  return p || '/';
}

function isAllowedByPrefix(value, prefixes) {
  return prefixes.some((prefix) => value === prefix || value.startsWith(prefix));
}

function run() {
  const apiAccessText = fs.existsSync(apiAccessPath) ? fs.readFileSync(apiAccessPath, 'utf8') : '';
  const apiGuardPrefixes = [...apiAccessText.matchAll(/prefix:\s*'([^']+)'/g)].map((m) => m[1]);
  const apiFiles = walk(apiRoot).filter((f) => f.endsWith('route.js'));
  const apiIssues = [];
  for (const file of apiFiles) {
    const route = normalizeToRoute(file);
    if (isAllowedByPrefix(route, API_ALLOWLIST)) continue;
    const coveredByMiddlewareApiGuard = apiGuardPrefixes.some(
      (prefix) => route === prefix || route.startsWith(`${prefix}/`)
    );
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('requirePermission(') && !coveredByMiddlewareApiGuard) {
      apiIssues.push(route);
    }
  }

  const pageFiles = walk(pageRoot).filter((f) => f.endsWith('page.js'));
  const rulesText = fs.readFileSync(routeAccessPath, 'utf8');
  const pageIssues = [];
  for (const file of pageFiles) {
    const pageRoute = normalizeToPage(file);
    if (pageRoute === '/' || isAllowedByPrefix(pageRoute, PAGE_ALLOWLIST_PREFIXES)) continue;
    if (!rulesText.includes(`prefix: '${pageRoute}'`) && !rulesText.includes(`prefix: '${pageRoute.split('/')[1] ? '/' + pageRoute.split('/')[1] : pageRoute}'`)) {
      pageIssues.push(pageRoute);
    }
  }

  console.log('RBAC Audit');
  console.log(`API routes without requirePermission: ${apiIssues.length}`);
  for (const issue of apiIssues.slice(0, 50)) console.log(` - ${issue}`);
  if (apiIssues.length > 50) console.log(` ...and ${apiIssues.length - 50} more`);

  console.log(`Tenant pages without explicit page rule: ${pageIssues.length}`);
  for (const issue of pageIssues.slice(0, 50)) console.log(` - ${issue}`);
  if (pageIssues.length > 50) console.log(` ...and ${pageIssues.length - 50} more`);

  process.exit(apiIssues.length === 0 && pageIssues.length === 0 ? 0 : 1);
}

run();

