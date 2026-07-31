import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && v.one == null && v.other == null) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

describe('locale JSON parity', () => {
  const enDir = join(process.cwd(), 'locales/en');
  const nyDir = join(process.cwd(), 'locales/ny');
  const enFiles = readdirSync(enDir).filter((f) => f.endsWith('.json')).sort();
  const nyFiles = readdirSync(nyDir).filter((f) => f.endsWith('.json')).sort();

  it('same namespace files in en and ny', () => {
    expect(nyFiles).toEqual(enFiles);
  });

  it('each namespace has identical key sets', () => {
    for (const file of enFiles) {
      const en = flatten(JSON.parse(readFileSync(join(enDir, file), 'utf8')));
      const ny = flatten(JSON.parse(readFileSync(join(nyDir, file), 'utf8')));
      expect(Object.keys(ny).sort(), file).toEqual(Object.keys(en).sort());
    }
  });
});
