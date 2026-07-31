/**
 * Posting engine — versioned posting-template registry (Phase 4).
 *
 * Templates are controlled backend definitions (never user-provided executable
 * code). Each template declares its identity, version, event coverage, account
 * purposes, source/dimension requirements and, when implemented, a `buildDraft`
 * strategy that produces a Journal Draft. Published versions are immutable —
 * changing a template's behaviour requires registering a NEW version; the
 * registry refuses re-registration of an existing (templateId, version).
 *
 * Statuses:
 *   ACTIVE  — fully implemented and enabled for engine posting (pilots).
 *   DEFINED — declared for Phase 9 module integration; the engine refuses to
 *             post them but exposes their definitions for preview/diagnostics.
 */

import { PostingTemplateNotFoundError, PostingTemplateValidationError } from '../domain/errors.js';
import { ArchitectureVersion } from '../domain/enums.js';

export const TemplateStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  DEFINED: 'DEFINED',
  RETIRED: 'RETIRED',
});

/** @type {Map<string, object[]>} eventType → template versions (ascending) */
const BY_EVENT = new Map();
/** @type {Map<string, object>} `${templateId}@${version}` → template */
const BY_ID = new Map();

/**
 * @typedef {object} PostingTemplate
 * @property {string} templateId
 * @property {number} templateVersion
 * @property {string} eventType
 * @property {string} status TemplateStatus
 * @property {string[]} supportedSourceTypes
 * @property {string[]} requiredPurposes system-account purposes the business must map
 * @property {string[]} requiredSourceFields
 * @property {string[]} requiredDimensions
 * @property {string[]} optionalDimensions
 * @property {string[]} prohibitedDimensions
 * @property {string} approvalRule human-readable approval policy
 * @property {string} reversalBehaviour
 * @property {string} description
 * @property {string} architectureVersion
 * @property {(params: {db: object, context: object, command: object, source: object, resolvePurpose: Function}) => Promise<import('../domain/journalDraft.js').JournalDraft>} [buildDraft]
 */

/**
 * Register a template version. Refuses duplicates — published versions are frozen.
 * @param {PostingTemplate} template
 */
export function registerTemplate(template) {
  const issues = [];
  if (!template?.templateId) issues.push({ path: 'templateId', message: 'required' });
  if (!Number.isInteger(template?.templateVersion) || template.templateVersion < 1) {
    issues.push({ path: 'templateVersion', message: 'positive integer required' });
  }
  if (!template?.eventType) issues.push({ path: 'eventType', message: 'required' });
  if (template?.status === TemplateStatus.ACTIVE && typeof template.buildDraft !== 'function') {
    issues.push({ path: 'buildDraft', message: 'ACTIVE templates must implement buildDraft' });
  }
  if (issues.length > 0) throw new PostingTemplateValidationError(issues);

  const key = `${template.templateId}@${template.templateVersion}`;
  if (BY_ID.has(key)) {
    throw new PostingTemplateValidationError([
      { path: 'templateVersion', message: `template version ${key} is already published and immutable` },
    ]);
  }
  const frozen = Object.freeze({
    architectureVersion: ArchitectureVersion.ACCOUNTING_V2,
    supportedSourceTypes: Object.freeze([...(template.supportedSourceTypes ?? [])]),
    requiredPurposes: Object.freeze([...(template.requiredPurposes ?? [])]),
    requiredSourceFields: Object.freeze([...(template.requiredSourceFields ?? [])]),
    requiredDimensions: Object.freeze([...(template.requiredDimensions ?? [])]),
    optionalDimensions: Object.freeze([...(template.optionalDimensions ?? [])]),
    prohibitedDimensions: Object.freeze([...(template.prohibitedDimensions ?? [])]),
    ...template,
  });
  BY_ID.set(key, frozen);
  const list = BY_EVENT.get(template.eventType) ?? [];
  list.push(frozen);
  list.sort((a, b) => a.templateVersion - b.templateVersion);
  BY_EVENT.set(template.eventType, list);
  return frozen;
}

/**
 * Resolve the highest ACTIVE template version for an event type.
 * @param {string} eventType
 * @param {{requestId?: string, correlationId?: string}} [ids]
 * @returns {PostingTemplate}
 */
export function getActiveTemplate(eventType, ids = {}) {
  const versions = BY_EVENT.get(eventType) ?? [];
  const active = [...versions].reverse().find((t) => t.status === TemplateStatus.ACTIVE);
  if (!active) {
    throw new PostingTemplateNotFoundError(eventType, ids);
  }
  return active;
}

/** Latest template definition regardless of status (diagnostics/preview). */
export function getTemplateDefinition(eventType) {
  const versions = BY_EVENT.get(eventType) ?? [];
  return versions[versions.length - 1] ?? null;
}

/** @returns {PostingTemplate[]} full catalogue, all versions */
export function listTemplates() {
  return [...BY_ID.values()].sort((a, b) =>
    a.templateId === b.templateId
      ? a.templateVersion - b.templateVersion
      : a.templateId.localeCompare(b.templateId)
  );
}

/** Test hook — reset is only used by the automated test suite. */
export function __resetTemplateRegistryForTests() {
  BY_EVENT.clear();
  BY_ID.clear();
}
