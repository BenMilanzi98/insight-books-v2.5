/**
 * Build locales/phrases/ny.json from catalogues, glossary, and extracted UI strings.
 * Run: node scripts/build-chichewa-phrases.cjs
 */
const fs = require('fs');
const path = require('path');
const glossary = require('./chichewa-ui-glossary.cjs');

const root = path.join(__dirname, '..');

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && v.one == null && v.other == null) {
      flatten(v, key, out);
    } else if (typeof v === 'string') {
      out[key] = v;
    }
  }
  return out;
}

function harvestCatalogues(phrases) {
  const enDir = path.join(root, 'locales', 'en');
  const nyDir = path.join(root, 'locales', 'ny');
  if (!fs.existsSync(enDir) || !fs.existsSync(nyDir)) return;
  for (const file of fs.readdirSync(enDir).filter((f) => f.endsWith('.json'))) {
    const en = flatten(JSON.parse(fs.readFileSync(path.join(enDir, file), 'utf8')));
    const nyPath = path.join(nyDir, file);
    if (!fs.existsSync(nyPath)) continue;
    const ny = flatten(JSON.parse(fs.readFileSync(nyPath, 'utf8')));
    for (const [key, enVal] of Object.entries(en)) {
      const nyVal = ny[key];
      if (typeof enVal === 'string' && typeof nyVal === 'string' && enVal.trim() && nyVal.trim()) {
        if (enVal !== nyVal) phrases[enVal] = nyVal;
      }
    }
  }
}

function applyExact(phrases) {
  for (const [en, ny] of Object.entries(glossary.exact)) {
    if (en && ny) phrases[en] = ny;
  }
}

function matchCase(source, translated) {
  if (!source || !translated) return translated;
  if (source === source.toUpperCase() && source.length > 1) return translated.toUpperCase();
  if (source[0] === source[0].toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()) {
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }
  return translated;
}

function translateWithWords(text) {
  if (!text || typeof text !== 'string') return text;
  const keep = glossary.keep;
  const words = glossary.words;
  const exact = glossary.exact;

  // Longest exact substring replacements first
  const phrases = Object.keys(exact).sort((a, b) => b.length - a.length);
  let out = text;
  const protectedTokens = [];
  out = out.replace(/\{\{[^}]+\}\}/g, (m) => {
    protectedTokens.push(m);
    return `\u0000${protectedTokens.length - 1}\u0000`;
  });

  for (const p of phrases) {
    if (p.length < 4) continue;
    const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, (m) => matchCase(m, exact[p]));
  }

  out = out.replace(/[A-Za-z']+/g, (token) => {
    if (keep.has(token) || keep.has(token.toUpperCase())) return token;
    const lower = token.toLowerCase();
    if (words[lower] === '') return '';
    if (words[lower]) return matchCase(token, words[lower]);
    if (exact[token]) return exact[token];
    return token;
  });

  out = out.replace(/\s+/g, ' ').trim();
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => protectedTokens[Number(i)]);
  return out;
}

function looksTranslatable(s) {
  const t = String(s || '').trim();
  if (t.length < 2 || t.length > 140) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (/[<>{}?=]|&&|\|\||=>|className|use client/.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (/^[A-Z][A-Z0-9_/-]{2,}$/.test(t) && t.length <= 12) return false;
  return true;
}

function loadExtracted() {
  const p = path.join(root, 'docs', 'chichewa-i18n', 'EXTRACTED_UI_STRINGS.json');
  if (!fs.existsSync(p)) return [];
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (data.strings || []).map((r) => r.text).filter(looksTranslatable);
}

const phrases = Object.create(null);
harvestCatalogues(phrases);
applyExact(phrases);

let generated = 0;
for (const text of loadExtracted()) {
  if (phrases[text]) continue;
  const ny = translateWithWords(text);
  if (ny && ny !== text) {
    phrases[text] = ny;
    generated += 1;
  }
}

const outDir = path.join(root, 'locales', 'phrases');
fs.mkdirSync(outDir, { recursive: true });
const sorted = {};
for (const k of Object.keys(phrases).sort((a, b) => a.localeCompare(b))) {
  sorted[k] = phrases[k];
}
fs.writeFileSync(path.join(outDir, 'ny.json'), JSON.stringify(sorted, null, 2) + '\n');
console.log(`phrases=${Object.keys(sorted).length} generated=${generated}`);
