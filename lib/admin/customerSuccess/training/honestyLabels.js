/**
 * Training status labelling honesty — Phase 22 Wave 4.
 * Progress ≠ quality ≠ completion; completion ≠ adoption;
 * Training ≠ marketing attribution / acquisition.
 */

export const TRAINING_STATUS_LABEL = Object.freeze({
  PROGRESS_NOT_QUALITY_NOT_COMPLETION_NOT_ADOPTION:
    'progress_not_quality_not_completion_not_adoption',
});

/**
 * @param {{
 *   progressPercent?: number|null,
 *   qualityScore?: number|null,
 *   completionStatus?: string|null,
 * }} [args]
 */
export function getTrainingStatusLabelHonesty(args = {}) {
  return {
    progressPercent:
      typeof args.progressPercent === 'number' && !Number.isNaN(args.progressPercent)
        ? args.progressPercent
        : null,
    qualityScore:
      typeof args.qualityScore === 'number' && !Number.isNaN(args.qualityScore)
        ? args.qualityScore
        : null,
    completionStatus: args.completionStatus || null,
    progressEqualsQuality: false,
    progressEqualsCompletion: false,
    qualityEqualsCompletion: false,
    completionEqualsAdoption: false,
    isAdoption: false,
    isQuality: false,
    isCompletion: false,
    trainingEqualsMarketingAttribution: false,
    label: TRAINING_STATUS_LABEL.PROGRESS_NOT_QUALITY_NOT_COMPLETION_NOT_ADOPTION,
  };
}
