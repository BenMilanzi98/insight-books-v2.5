import { SPLIT_PAYMENT_POLICY } from '../../domain/operationalEnums.js';
import { getSplitPaymentPolicy } from './mappingTypeRegistry.js';

/**
 * Split-payment representation — fail closed until MRA clarifies.
 * Never silently flatten to a single payment method.
 */
export function evaluateSplitPaymentSupport(paymentComponents = []) {
  const policy = getSplitPaymentPolicy();
  const components = Array.isArray(paymentComponents) ? paymentComponents : [];
  const isSplit = components.length > 1;

  if (!isSplit) {
    return {
      isSplit: false,
      policy,
      supported: true,
      blocked: false,
      representationType: 'SINGLE_PAYMENT',
      message: null,
    };
  }

  if (
    policy === SPLIT_PAYMENT_POLICY.REQUIRES_MRA_CLARIFICATION ||
    policy === SPLIT_PAYMENT_POLICY.UNSUPPORTED
  ) {
    return {
      isSplit: true,
      policy,
      supported: false,
      blocked: true,
      representationType: null,
      message:
        'Split-payment fiscalization is blocked until MRA split-payment representation is verified. Components are not silently flattened.',
      components: components.map((c) => ({
        localPaymentMethodId: c.localPaymentMethodId,
        amount: c.amount,
      })),
    };
  }

  return {
    isSplit: true,
    policy,
    supported: true,
    blocked: false,
    representationType: policy,
    message: null,
  };
}
