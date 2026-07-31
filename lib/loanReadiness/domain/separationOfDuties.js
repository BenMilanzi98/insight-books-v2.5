import { SeparationOfDutiesError } from './errors.js';

/**
 * Hard SoD for assessment approval:
 * - preparer cannot approve
 * - a different reviewer must have signed off first
 */
export function assertAssessmentApprovalSod({ preparedBy, reviewedBy, approverUserId }) {
  if (preparedBy && preparedBy === approverUserId) {
    throw new SeparationOfDutiesError(
      'Separation of duties: the preparer cannot approve this assessment.'
    );
  }
  if (!reviewedBy || reviewedBy === preparedBy) {
    throw new SeparationOfDutiesError(
      'Separation of duties: a different reviewer must mark the assessment reviewed before approval.'
    );
  }
}

export function assertAssessmentReviewSod({ preparedBy, reviewerUserId }) {
  if (preparedBy && preparedBy === reviewerUserId) {
    throw new SeparationOfDutiesError(
      'Separation of duties: the preparer cannot review their own assessment.'
    );
  }
}
