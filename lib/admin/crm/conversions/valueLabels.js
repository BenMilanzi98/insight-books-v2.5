/**
 * Closed-Won / accepted value labelling honesty — Phase 20 Wave 4.
 * Never label accepted / Closed-Won value as collected or recognised Revenue.
 */

export const CRM_CONVERSION_VALUE_LABEL = Object.freeze({
  ACCEPTED_NOT_REVENUE: 'accepted_value_not_revenue',
  CLOSED_WON_NOT_COLLECTED_REVENUE: 'closed_won_value_not_collected_recognised_revenue',
});

/**
 * @param {{ acceptedValue?: number|null, closedWonValue?: number|null, currency?: string|null }} [args]
 */
export function getConversionValueLabelHonesty(args = {}) {
  return {
    acceptedValue:
      typeof args.acceptedValue === 'number' && !Number.isNaN(args.acceptedValue)
        ? args.acceptedValue
        : null,
    closedWonValue:
      typeof args.closedWonValue === 'number' && !Number.isNaN(args.closedWonValue)
        ? args.closedWonValue
        : null,
    currency: args.currency || null,
    isRevenue: false,
    isCollectedRevenue: false,
    isRecognisedRevenue: false,
    isRecognizedRevenue: false,
    label: CRM_CONVERSION_VALUE_LABEL.CLOSED_WON_NOT_COLLECTED_REVENUE,
    acceptedLabel: CRM_CONVERSION_VALUE_LABEL.ACCEPTED_NOT_REVENUE,
    closedWonLabel: CRM_CONVERSION_VALUE_LABEL.CLOSED_WON_NOT_COLLECTED_REVENUE,
  };
}
