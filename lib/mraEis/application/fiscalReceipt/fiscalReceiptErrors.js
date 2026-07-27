import { MraEisControlError } from '../../domain/errors.js';

function make(code, defaults = {}) {
  return (opts = {}) =>
    new MraEisControlError({
      code,
      message: opts.message || defaults.message || code,
      httpStatus: opts.httpStatus ?? defaults.httpStatus ?? 400,
      requiredAction: opts.requiredAction || defaults.requiredAction || null,
      retryable: opts.retryable ?? defaults.retryable ?? false,
      ...opts,
    });
}

export const FiscalReceiptErrors = {
  readiness: make('MRA_EIS_FISCAL_RECEIPT_READINESS', {
    message: 'Fiscal receipt generation readiness failed.',
    httpStatus: 422,
  }),
  transmissionNotAccepted: make('MRA_EIS_TRANSMISSION_NOT_ACCEPTED_FOR_RECEIPT', {
    message: 'Only conclusively accepted transmissions may create fiscal receipts.',
    httpStatus: 422,
  }),
  attemptMismatch: make('MRA_EIS_ACCEPTED_ATTEMPT_MISMATCH', {
    message: 'Accepted attempt does not match the transmission.',
    httpStatus: 422,
  }),
  responseEvidence: make('MRA_EIS_RECEIPT_RESPONSE_EVIDENCE', {
    message: 'Accepted response evidence is missing or invalid.',
    httpStatus: 422,
  }),
  responseChecksum: make('MRA_EIS_RECEIPT_RESPONSE_CHECKSUM', {
    message: 'Response evidence checksum mismatch.',
    httpStatus: 422,
  }),
  snapshotIntegrity: make('MRA_EIS_RECEIPT_SNAPSHOT_INTEGRITY', {
    message: 'Fiscal snapshot integrity verification failed.',
    httpStatus: 422,
  }),
  fiscalNumberMismatch: make('MRA_EIS_RECEIPT_FISCAL_NUMBER_MISMATCH', {
    message: 'Fiscal number does not match snapshot assignment.',
    httpStatus: 422,
  }),
  contractUnavailable: make('MRA_EIS_RECEIPT_CONTRACT_UNAVAILABLE', {
    message: 'Receipt contract unavailable or blocked for this environment.',
    httpStatus: 422,
  }),
  templateUnavailable: make('MRA_EIS_RECEIPT_TEMPLATE_UNAVAILABLE', {
    message: 'Receipt template unavailable for this receipt type.',
    httpStatus: 422,
  }),
  qrContractUnverified: make('MRA_EIS_QR_CONTRACT_UNVERIFIED', {
    message: 'QR source contract is unverified for production use.',
    httpStatus: 422,
  }),
  qrSourceMissing: make('MRA_EIS_QR_SOURCE_MISSING', {
    message: 'No verified MRA QR source is available.',
    httpStatus: 422,
  }),
  qrSourceConflict: make('MRA_EIS_QR_SOURCE_CONFLICT', {
    message: 'Conflicting QR source fields require manual review.',
    httpStatus: 422,
  }),
  validationUrlInvalid: make('MRA_EIS_VALIDATION_URL_INVALID', {
    message: 'Validation URL failed structural validation.',
    httpStatus: 422,
  }),
  validationUrlUntrusted: make('MRA_EIS_VALIDATION_URL_UNTRUSTED', {
    message: 'Validation URL host is not an approved MRA domain.',
    httpStatus: 422,
  }),
  qrPayloadInvalid: make('MRA_EIS_QR_PAYLOAD_INVALID', {
    message: 'QR payload failed contract validation.',
    httpStatus: 422,
  }),
  qrGeneration: make('MRA_EIS_QR_GENERATION', {
    message: 'QR generation failed.',
    httpStatus: 500,
    retryable: true,
  }),
  qrDecode: make('MRA_EIS_QR_DECODE_VERIFICATION', {
    message: 'Generated QR does not decode to the verified source value.',
    httpStatus: 422,
  }),
  receiptData: make('MRA_EIS_RECEIPT_DATA_VALIDATION', {
    message: 'Receipt data validation failed.',
    httpStatus: 422,
  }),
  totalsMismatch: make('MRA_EIS_RECEIPT_TOTALS_MISMATCH', {
    message: 'Receipt totals do not reconcile with the fiscal snapshot.',
    httpStatus: 422,
  }),
  render: make('MRA_EIS_RECEIPT_RENDER', {
    message: 'Receipt rendering failed.',
    httpStatus: 500,
    retryable: true,
  }),
  storage: make('MRA_EIS_RECEIPT_STORAGE', {
    message: 'Receipt artifact storage failed.',
    httpStatus: 500,
    retryable: true,
  }),
  artifactChecksum: make('MRA_EIS_RECEIPT_ARTIFACT_CHECKSUM', {
    message: 'Receipt artifact checksum mismatch.',
    httpStatus: 500,
  }),
  alreadyExists: make('MRA_EIS_FISCAL_RECEIPT_ALREADY_EXISTS', {
    message: 'An original fiscal receipt already exists for this transmission.',
    httpStatus: 409,
  }),
  idempotencyConflict: make('MRA_EIS_FISCAL_RECEIPT_IDEMPOTENCY_CONFLICT', {
    message: 'Fiscal receipt identity conflict with different evidence checksums.',
    httpStatus: 409,
  }),
  state: make('MRA_EIS_FISCAL_RECEIPT_STATE', {
    message: 'Invalid fiscal receipt state transition.',
    httpStatus: 409,
  }),
  immutable: make('MRA_EIS_FISCAL_RECEIPT_IMMUTABLE', {
    message: 'Completed fiscal receipt data and original artifacts are immutable.',
    httpStatus: 409,
  }),
  reprint: make('MRA_EIS_FISCAL_RECEIPT_REPRINT', {
    message: 'Fiscal receipt reprint failed.',
    httpStatus: 422,
  }),
  reprintSequence: make('MRA_EIS_FISCAL_RECEIPT_REPRINT_SEQUENCE_CONFLICT', {
    message: 'Reprint sequence allocation conflict.',
    httpStatus: 409,
    retryable: true,
  }),
  email: make('MRA_EIS_FISCAL_RECEIPT_EMAIL', {
    message: 'Fiscal receipt email delivery failed.',
    httpStatus: 422,
  }),
  downloadAuth: make('MRA_EIS_FISCAL_RECEIPT_DOWNLOAD_AUTHORIZATION', {
    message: 'Not authorized to download this fiscal receipt artifact.',
    httpStatus: 403,
  }),
  integrity: make('MRA_EIS_FISCAL_RECEIPT_INTEGRITY', {
    message: 'Fiscal receipt integrity verification failed.',
    httpStatus: 422,
  }),
  crossTenant: make('MRA_EIS_CROSS_TENANT_FISCAL_RECEIPT', {
    message: 'Cross-tenant fiscal receipt access denied.',
    httpStatus: 403,
  }),
  businessMismatch: make('MRA_EIS_FISCAL_RECEIPT_BUSINESS_CONTEXT_MISMATCH', {
    message: 'Fiscal receipt business context mismatch.',
    httpStatus: 403,
  }),
  environmentMismatch: make('MRA_EIS_FISCAL_RECEIPT_ENVIRONMENT_MISMATCH', {
    message: 'Fiscal receipt environment mismatch.',
    httpStatus: 422,
  }),
  manualReview: make('MRA_EIS_FISCAL_RECEIPT_MANUAL_REVIEW_REQUIRED', {
    message: 'Fiscal receipt requires manual review.',
    httpStatus: 422,
  }),
};
