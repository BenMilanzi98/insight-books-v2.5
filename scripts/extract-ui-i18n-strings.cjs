/**
 * Extract JSX / attribute UI strings from app/ and components/.
 * Run: node scripts/extract-ui-i18n-strings.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'insight',
  'api',
  'i18n',
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

const ATTRS = ['placeholder', 'aria-label', 'aria-title', 'title', 'alt', 'label'];

function looksLikeUi(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 140) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (/^\/[a-z0-9\-_/]*$/i.test(t)) return false;
  if (/^(bg-|text-|border-|flex|grid|w-|h-|p-|m-|sm:|md:|lg:|hover:|focus:)/.test(t)) return false;
  if (/^[A-Z][A-Z0-9_/-]{2,}$/.test(t)) return false; // enums
  if (/^(GET|POST|PUT|PATCH|DELETE|Content-Type|Authorization)$/.test(t)) return false;
  if (/[{}`\\]|\$\{/.test(t)) return false;
  if (/^[a-z0-9._-]+@[a-z0-9.-]+$/i.test(t)) return false;
  if (/^\d/.test(t) && t.length < 6) return false;
  // skip likely identifiers / filenames
  if (!/\s/.test(t) && /[a-z][A-Z]/.test(t)) return false;
  if (!/\s/.test(t) && t.includes('.')) return false;
  if (!/\s/.test(t) && t.includes('/')) return false;
  return true;
}

const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components'))];
const counts = new Map();

function add(text, file) {
  if (!looksLikeUi(text)) return;
  const t = text.replace(/\s+/g, ' ').trim();
  const cur = counts.get(t) || { count: 0, files: new Set() };
  cur.count += 1;
  cur.files.add(path.relative(root, file).replace(/\\/g, '/'));
  counts.set(t, cur);
}

for (const file of files) {
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  // JSX text: >Label<
  const jsxTextRe = />\s*([^<>{]+?)\s*</g;
  let m;
  while ((m = jsxTextRe.exec(src))) {
    add(m[1], file);
  }
  for (const attr of ATTRS) {
    const re = new RegExp(`${attr}\\s*=\\s*(["'])([^"'\\n]+)\\1`, 'g');
    while ((m = re.exec(src))) add(m[2], file);
  }
}

const rows = [...counts.entries()]
  .map(([text, v]) => ({ text, count: v.count, files: [...v.files].slice(0, 5) }))
  .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));

const outPath = path.join(root, 'docs', 'chichewa-i18n', 'EXTRACTED_UI_STRINGS.json');
fs.writeFileSync(outPath, JSON.stringify({ fileCount: files.length, unique: rows.length, strings: rows }, null, 2) + '\n');
console.log(`files=${files.length} unique=${rows.length}`);
console.log(rows.slice(0, 50).map((r) => `${r.count}\t${r.text}`).join('\n'));
