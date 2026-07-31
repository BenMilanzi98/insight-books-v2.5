/**
 * Onboarding status labelling honesty — Phase 21 Wave 4.
 * Progress ≠ readiness ≠ completion; completion ≠ adoption.
 */

export const ONBOARDING_STATUS_LABEL = Object.freeze({
  PROGRESS_NOT_READINESS_NOT_COMPLETION_NOT_ADOPTION:
    'progress_not_readiness_not_completion_not_adoption',
});

/**
 * @param {{
 *   progressPercent?: number|null,
 *   readinessStatus?: string|null,
 *   completionStatus?: string|null,
 * }} [args]
 */
export function getOnboardingStatusLabelHonesty(args = {}) {
  return {
    progressPercent:
      typeof args.progressPercent === 'number' && !Number.isNaN(args.progressPercent)
        ? args.progressPercent
        : null,
    readinessStatus: args.readinessStatus || null,
    completionStatus: args.completionStatus || null,
    progressEqualsReadiness: false,
    progressEqualsCompletion: false,
    readinessEqualsCompletion: false,
    completionEqualsAdoption: false,
    isAdoption: false,
    isReadiness: false,
    isCompletion: false,
    label: ONBOARDING_STATUS_LABEL.PROGRESS_NOT_READINESS_NOT_COMPLETION_NOT_ADOPTION,
  };
}
