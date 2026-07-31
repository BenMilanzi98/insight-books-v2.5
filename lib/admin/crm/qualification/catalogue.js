/**
 * Qualification catalogue — Phase 11 Wave 3.
 * Qualification ≠ scoring. UNKNOWN ≠ NO.
 */

export {
  CRM_QUALIFICATION_RESPONSE,
  CRM_QUALIFICATION_RESPONSES,
  CRM_QUALIFICATION_DEFINITION_STATUS,
  CRM_DEFAULT_QUALIFICATION_VERSION_ID,
} from '../catalogue.js';

/**
 * Default ACTIVE definition (SMALL_BUSINESS_STANDARD / BANT-lite).
 * Active definitions are not edited in place — publish a new versionId.
 */
export function getDefaultQualificationDefinition() {
  return Object.freeze({
    key: 'SMALL_BUSINESS_STANDARD',
    name: 'Small Business Standard (BANT-lite)',
    versionId: 'qual-small-business-standard-v1',
    status: 'ACTIVE',
    criteria: Object.freeze([
      Object.freeze({
        key: 'BUDGET',
        label: 'Budget identified',
        required: true,
        blockingNo: true,
      }),
      Object.freeze({
        key: 'AUTHORITY',
        label: 'Decision authority engaged',
        required: true,
        blockingNo: true,
      }),
      Object.freeze({
        key: 'NEED',
        label: 'Business need confirmed',
        required: true,
        blockingNo: true,
      }),
      Object.freeze({
        key: 'TIMELINE',
        label: 'Purchase timeline',
        required: true,
        blockingNo: false,
      }),
      Object.freeze({
        key: 'FIT',
        label: 'Product fit',
        required: false,
        blockingNo: false,
      }),
    ]),
  });
}
