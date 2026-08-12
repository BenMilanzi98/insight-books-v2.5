/**
 * GL codes that must never appear as active system accounts.
 * Existing rows are soft-merged into the survivor code on CoA ensure / sync.
 */

export const RETIRED_GL_CODES = Object.freeze({
  /** Only Cash - Main Account (1110) is allowed; Petty Cash is retired. */
  '1120': {
    mergeIntoCode: '1110',
    displayName: 'Cash - Petty Cash',
  },
});

/** @param {string|null|undefined} code */
export function isRetiredGlCode(code) {
  return Boolean(RETIRED_GL_CODES[String(code ?? '').trim()]);
}

/** @param {string|null|undefined} code */
export function retiredMergeTargetCode(code) {
  return RETIRED_GL_CODES[String(code ?? '').trim()]?.mergeIntoCode ?? null;
}
