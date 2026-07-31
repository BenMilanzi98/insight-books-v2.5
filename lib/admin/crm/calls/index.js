/**
 * CRM Calls — Phase 13 Wave 2 public surface.
 */

export {
  CRM_CALL_STATUS,
  CRM_CALL_STATUSES,
  CRM_CALL_OUTCOME,
  CRM_CALL_OUTCOMES,
  CRM_CALL_NUMBER_RE,
  CRM_TELEPHONY_PROVIDER_STATUS,
  CRM_CALL_RECORDING_STATUS,
  isValidCallOutcome,
  isValidCallDirection,
  getTelephonyProviderContract,
  getCallRecordingStatus,
} from './catalogue.js';

export { allocateCallNumber } from './numbering.js';
export { hasCrmCallModel, serializeCall } from './model.js';
export {
  planCall,
  logManualCall,
  completeCall,
  listCalls,
} from './service.js';
