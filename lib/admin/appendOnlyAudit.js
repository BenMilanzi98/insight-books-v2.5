import { assertAuditNotMutable } from './auditImmutability';
import prisma from '@/lib/prisma';

export async function appendAdminAuditLog(data) {
  assertAuditNotMutable('create');
  return prisma.adminAuditLog.create({ data });
}

// Throw if code tries to update/delete via this module
export async function forbidAuditMutation(operation) {
  assertAuditNotMutable(operation);
}
