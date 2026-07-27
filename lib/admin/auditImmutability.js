/**
 * AdminAuditLog is append-only.
 *
 * Application code must only CREATE audit rows. Updates and deletes are
 * forbidden — correcting history requires a new compensating audit entry.
 *
 * Guard usage (tests / review):
 *   assertAuditNotMutable('update') // throws
 *   assertAuditNotMutable('create') // ok
 */

/**
 * @param {string} operation - create | update | delete | upsert
 * @throws {Error} when operation would mutate existing audit rows
 */
export function assertAuditNotMutable(operation) {
  const op = String(operation || '')
    .trim()
    .toLowerCase();
  if (op === 'update' || op === 'delete' || op === 'upsert') {
    throw new Error(
      'AdminAuditLog is append-only; update/delete/upsert operations are forbidden'
    );
  }
  if (op && op !== 'create' && op !== 'insert') {
    throw new Error(`Unknown audit operation: ${operation}`);
  }
}
