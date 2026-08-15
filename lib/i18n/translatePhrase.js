function interpolate(template, params = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) =>
    params[name] == null ? '' : String(params[name])
  );
}

function preserveOuterWhitespace(original, translated) {
  const lead = original.match(/^\s*/)?.[0] || '';
  const trail = original.match(/\s*$/)?.[0] || '';
  return `${lead}${translated}${trail}`;
}

function lookup(map, text) {
  if (!map || text == null) return undefined;
  if (Object.prototype.hasOwnProperty.call(map, text)) return map[text];
  const trimmed = String(text).trim();
  if (Object.prototype.hasOwnProperty.call(map, trimmed)) return map[trimmed];
  const lower = trimmed.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(map, lower)) return map[lower];
  const collapsed = trimmed.replace(/\s+/g, ' ');
  if (Object.prototype.hasOwnProperty.call(map, collapsed)) return map[collapsed];
  return undefined;
}

/**
 * Translate a literal English UI string when locale is Chichewa.
 * English (and unknown phrases) are returned unchanged.
 */
export function translatePhrase(text, locale, nyMap, params = {}) {
  if (text == null) return '';
  if (typeof text !== 'string') return text;
  if (!text.trim()) return text;
  if (locale !== 'ny') return interpolate(text, params);

  const hit = lookup(nyMap, text);
  if (hit != null && hit !== '') {
    return preserveOuterWhitespace(text, interpolate(String(hit), params));
  }
  return interpolate(text, params);
}

export { interpolate, lookup };
