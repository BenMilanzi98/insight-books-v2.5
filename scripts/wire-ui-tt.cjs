/**
 * Wrap JSX text and placeholders with tt("...").
 * Idempotent. Does not match `=>` arrow functions.
 * Run: node scripts/wire-ui-tt.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.next', 'insight', 'api', 'i18n']);
const SKIP_FILES = new Set([
  'I18nProvider.js',
  'runtime.js',
  'translatePhrase.js',
  'LanguageSwitcher.js',
  'AdminLanguageSwitcher.jsx',
  'PageHeader.jsx',
]);
const ATTRS = ['placeholder', 'aria-label', 'alt'];
const IMPORT_LINE = "import { tt } from '@/lib/i18n/runtime';";

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(name) && !SKIP_FILES.has(name)) out.push(full);
  }
  return out;
}

function shouldWrap(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 140) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (/^\/[a-z0-9\-_/]*$/i.test(t)) return false;
  if (/^(bg-|text-|border-|flex|grid|w-|h-|p-|m-|sm:|md:|lg:)/.test(t)) return false;
  if (/[<>{}?=]|&&|\|\||=>/.test(t)) return false;
  if (/;|return\s*\(|case\s+['"]|^\s*!/.test(t)) return false;
  if (t.includes(');') || t.includes('(') || t.includes(')')) return false;
  if (/^[\d\s.,:%$#+\-_/\\]+$/.test(t)) return false;
  if (/^(MWK|MK|USD|VAT|PAYE|PDF|CSV|JSON|ID|OK|POS|MRA|EIS|NPS|TIN)$/.test(t)) return false;
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(t) && t.length <= 16) return false;
  if (/^[\s.·•|—–-]+$/.test(t)) return false;
  if (t.includes('tt(')) return false;
  // Must look like a user-facing label (letter, space, or punctuation), not code
  if (!/^[A-Za-zÀ-ž0-9]/.test(t)) return false;
  return true;
}

function quote(s) {
  if (s.includes("'") && !s.includes('"')) return `"${s}"`;
  if (s.includes('"') && !s.includes("'")) return `'${s}'`;
  return `'${s.replace(/'/g, "\\'")}'`;
}

function addImport(src) {
  if (src.includes('@/lib/i18n/runtime')) return src;
  const m = src.match(/(['"])use client\1\s*;?[ \t]*\r?\n/);
  if (m) {
    const idx = m.index + m[0].length;
    return `${src.slice(0, idx)}${IMPORT_LINE}\n${src.slice(idx)}`;
  }
  return `${IMPORT_LINE}\n${src}`;
}

function transform(src) {
  let changed = false;
  // `(?<![=])>` avoids matching the `>` in arrow functions `=>`
  let out = src.replace(/(?<![=])>(\s*)([^<>{]+?)(\s*)</g, (all, pre, text, post) => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!shouldWrap(trimmed)) return all;
    changed = true;
    return `>${pre}{tt(${quote(trimmed)})}${post}<`;
  });

  for (const attr of ATTRS) {
    const re = new RegExp(`(${attr}\\s*=\\s*)(["'])([^"'\\n]+)\\2`, 'g');
    out = out.replace(re, (all, prefix, _q, text) => {
      if (!shouldWrap(text)) return all;
      changed = true;
      return `${prefix}{tt(${quote(text)})}`;
    });
  }

  if (!changed) return { src, changed: false };
  return { src: addImport(out), changed: true };
}

const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components'))];
let n = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('from "next/server"') || src.includes("from 'next/server'")) continue;
  const { src: next, changed } = transform(src);
  if (changed) {
    fs.writeFileSync(file, next);
    n += 1;
  }
}
console.log(`wired ${n} / ${files.length} files`);
