/**
 * Shared invoice/quotation layout registry (10 professional layouts).
 */

export const LOGO_POSITIONS = ['left', 'center', 'right'];

export const LEGACY_STYLE_TO_LAYOUT = Object.freeze({
  standard: 'classic',
  classic: 'classic',
  professional: 'modern',
  modern: 'modern',
  bold: 'bold-bar',
  minimal: 'minimal',
  compact: 'compact',
});

export const DOCUMENT_LAYOUTS = Object.freeze([
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean white with thin rules and traditional hierarchy',
    previewAccent: '#1e3a5f',
    compatStyles: ['standard', 'classic'],
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Strong primary colour header band',
    previewAccent: '#1d4ed8',
    compatStyles: ['professional', 'modern'],
  },
  {
    id: 'bold-bar',
    name: 'Bold Bar',
    description: 'Full-width accent top bar with large title',
    previewAccent: '#0f172a',
    compatStyles: ['bold'],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Whitespace-heavy with subtle lines',
    previewAccent: '#64748b',
    compatStyles: ['minimal'],
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Dense table and tighter margins',
    previewAccent: '#334155',
    compatStyles: ['compact'],
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Strong title hierarchy and asymmetric header',
    previewAccent: '#9a3412',
    compatStyles: [],
  },
  {
    id: 'band-header',
    name: 'Band Header',
    description: 'Two-tone brand and slate header',
    previewAccent: '#0e7490',
    compatStyles: [],
  },
  {
    id: 'split-brand',
    name: 'Split Brand',
    description: 'Company left; document meta panel on the right',
    previewAccent: '#4338ca',
    compatStyles: [],
  },
  {
    id: 'soft-card',
    name: 'Soft Card',
    description: 'Rounded cards for parties and totals',
    previewAccent: '#047857',
    compatStyles: [],
  },
  {
    id: 'ledger',
    name: 'Ledger',
    description: 'Grid-forward tabular amounts',
    previewAccent: '#44403c',
    compatStyles: [],
  },
]);

const BY_ID = Object.freeze(
  Object.fromEntries(DOCUMENT_LAYOUTS.map((layout) => [layout.id, layout]))
);

export function getLayout(layoutId) {
  return BY_ID[layoutId] || null;
}

export function normalizeLayoutId(styleOrLayoutId) {
  if (!styleOrLayoutId) return 'classic';
  const key = String(styleOrLayoutId).trim().toLowerCase();
  if (BY_ID[key]) return key;
  if (LEGACY_STYLE_TO_LAYOUT[key]) return LEGACY_STYLE_TO_LAYOUT[key];
  return 'classic';
}

export function normalizeLogoPosition(position) {
  const key = String(position || 'left').trim().toLowerCase();
  return LOGO_POSITIONS.includes(key) ? key : 'left';
}

/** Map layout back to a legacy style string for older PDF paths still keyed on style. */
export function layoutIdToLegacyStyle(layoutId) {
  const id = normalizeLayoutId(layoutId);
  const map = {
    classic: 'standard',
    modern: 'professional',
    'bold-bar': 'bold',
    minimal: 'minimal',
    compact: 'minimal',
    editorial: 'standard',
    'band-header': 'professional',
    'split-brand': 'professional',
    'soft-card': 'standard',
    ledger: 'minimal',
  };
  return map[id] || 'standard';
}
