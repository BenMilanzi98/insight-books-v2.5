/**
 * Malawi bank & mobile money GL channels shown on payment pages.
 * Parent codes (1131–1138, 1140, 1141) are rollup-only; user accounts post to child codes (e.g. 1131-01).
 */

export const PAYMENT_CASH_GL_CODE = '1110';
export const PAYMENT_CASH_GL_NAME = 'Cash - Main Account';

/** @type {{ code: string; name: string; accountType: 'Bank' | 'Mobile Money' }[]} */
export const PAYMENT_BANK_GL_CHANNELS = [
  { code: '1131', name: 'National Bank of Malawi', accountType: 'Bank' },
  { code: '1132', name: 'Standard Bank Malawi', accountType: 'Bank' },
  { code: '1133', name: 'FDH Bank', accountType: 'Bank' },
  { code: '1134', name: 'NBS Bank', accountType: 'Bank' },
  { code: '1135', name: 'First Capital Bank', accountType: 'Bank' },
  { code: '1136', name: 'Ecobank Malawi', accountType: 'Bank' },
  { code: '1137', name: 'Centenary Bank Malawi', accountType: 'Bank' },
  { code: '1138', name: 'CDH Investment Bank', accountType: 'Bank' },
];

/** @type {{ code: string; name: string; accountType: 'Mobile Money' }[]} */
export const PAYMENT_MOBILE_GL_CHANNELS = [
  { code: '1140', name: 'Mobile Money - Airtel Money', accountType: 'Mobile Money' },
  { code: '1141', name: 'Mobile Money - TNM Mpamba', accountType: 'Mobile Money' },
];

export const PAYMENT_GL_CHANNELS = [...PAYMENT_BANK_GL_CHANNELS, ...PAYMENT_MOBILE_GL_CHANNELS];

export const PAYMENT_GL_PARENT_CODES = new Set(PAYMENT_GL_CHANNELS.map((c) => c.code));

const BANK_NAME_MATCHERS = [
  ['1138', ['cdh']],
  ['1136', ['ecobank', 'eco bank']],
  ['1133', ['fdh bank', 'fdh']],
  ['1135', ['first capital']],
  ['1137', ['centenary']],
  ['1131', ['national bank', 'nbm', 'national']],
  ['1134', ['nbs']],
  ['1132', ['standard bank', 'standard']],
];

/**
 * @param {string|null|undefined} code
 */
export function isPaymentGlParentCode(code) {
  return PAYMENT_GL_PARENT_CODES.has(String(code ?? '').trim());
}

/**
 * Child ledger under a bank/mobile parent, e.g. 1131-01 or 1140-02.
 * @param {string|null|undefined} code
 */
export function isPaymentGlChildCode(code) {
  const c = String(code ?? '').trim();
  return /^(113[1-8]|114[01])-\d{2}$/.test(c);
}

/**
 * @param {string} parentCode
 * @param {string|null|undefined} code
 */
export function paymentChildBelongsToParent(parentCode, code) {
  const c = String(code ?? '').trim();
  const p = String(parentCode ?? '').trim();
  if (!p || !c) return false;
  return c.startsWith(`${p}-`);
}

/**
 * Resolve parent GL code from explicit selection or payment account metadata.
 * @param {{ accountType?: string; name?: string; parentGlCode?: string|null }} input
 * @returns {string|null}
 */
export function resolvePaymentParentGlCode(input) {
  const explicit = String(input?.parentGlCode ?? '').trim();
  if (explicit && PAYMENT_GL_PARENT_CODES.has(explicit)) return explicit;

  const type = String(input?.accountType ?? '').trim();
  const name = String(input?.name ?? '').toLowerCase();

  if (type === 'Mobile Money') {
    if (name.includes('mpamba') || name.includes('tnm')) return '1141';
    return '1140';
  }

  if (type === 'Bank' || type === 'Wallet' || type === 'POS Terminal') {
    for (const [code, keywords] of BANK_NAME_MATCHERS) {
      if (keywords.some((k) => name.includes(k))) return code;
    }
    return '1131';
  }

  return null;
}

/**
 * @param {string} parentCode
 */
export function channelMetaForParentCode(parentCode) {
  return PAYMENT_GL_CHANNELS.find((c) => c.code === parentCode) ?? null;
}
