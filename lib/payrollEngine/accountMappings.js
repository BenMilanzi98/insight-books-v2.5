/**
 * Payroll GL account mappings — required before posting payroll to accounting.
 */
import prisma from '@/lib/prisma';
import { resolveCanonicalSalaryExpenseAccount } from '@/lib/accountingMappingRules';

/** @typedef {{
 *   salariesExpenseAccountId?: string|null,
 *   payePayableAccountId?: string|null,
 *   pensionEmployeePayableAccountId?: string|null,
 *   pensionEmployerExpenseAccountId?: string|null,
 *   netSalariesPayableAccountId?: string|null,
 *   salaryAdvanceReceivableAccountId?: string|null,
 *   benefitsExpenseAccountId?: string|null,
 *   gratuityLiabilityAccountId?: string|null,
 *   gratuityExpenseAccountId?: string|null,
 * }} PayrollAccountMappings
 */

export const PAYROLL_MAPPING_KEYS = [
  { key: 'salariesExpenseAccountId', label: 'Salaries & Wages Expense', required: true, defaultCode: '5200' },
  { key: 'payePayableAccountId', label: 'PAYE Payable', required: true, defaultCode: '2130' },
  { key: 'pensionEmployeePayableAccountId', label: 'Pension/NPS Employee Payable', required: false },
  { key: 'pensionEmployerExpenseAccountId', label: 'Employer Pension Expense', required: false },
  { key: 'netSalariesPayableAccountId', label: 'Net Salaries Payable', required: true },
  { key: 'salaryAdvanceReceivableAccountId', label: 'Salary Advance Receivable', required: false },
  { key: 'benefitsExpenseAccountId', label: 'Benefits / Allowances Expense', required: false },
  { key: 'gratuityLiabilityAccountId', label: 'Gratuity Liability', required: false },
  { key: 'gratuityExpenseAccountId', label: 'Gratuity Expense', required: false },
];

/**
 * @param {unknown} raw
 * @returns {PayrollAccountMappings}
 */
export function parsePayrollAccountMappings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return /** @type {PayrollAccountMappings} */ (raw);
}

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function loadPayrollAccountMappings(tenantId, db = prisma) {
  const settings = await db.tenantSettings.findUnique({
    where: { tenantId },
    select: { payrollAccountMappings: true },
  });
  return parsePayrollAccountMappings(settings?.payrollAccountMappings);
}

/**
 * Resolve missing mappings from chart of accounts by default codes where possible.
 * @param {string} tenantId
 * @param {PayrollAccountMappings} mappings
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function resolvePayrollAccountMappings(tenantId, mappings = {}, db = prisma) {
  const out = { ...mappings };

  if (!out.salariesExpenseAccountId) {
    try {
      const acct = await resolveCanonicalSalaryExpenseAccount(tenantId, db);
      if (acct?.id) out.salariesExpenseAccountId = acct.id;
    } catch {
      /* optional */
    }
  }

  const codesToResolve = [
    ['payePayableAccountId', '2130'],
    ['netSalariesPayableAccountId', '2140'],
    ['salaryAdvanceReceivableAccountId', '1216'],
  ];

  for (const [key, code] of codesToResolve) {
    if (out[key]) continue;
    const acct = await db.account.findFirst({
      where: { tenantId, isActive: true, accountCode: code },
      select: { id: true },
    });
    if (acct?.id) out[key] = acct.id;
  }

  return out;
}

/**
 * @param {PayrollAccountMappings} mappings
 */
export function validatePayrollAccountMappings(mappings) {
  const missing = [];
  for (const def of PAYROLL_MAPPING_KEYS) {
    if (def.required && !mappings[def.key]) {
      missing.push(def.label);
    }
  }
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function assertPayrollAccountMappingsReady(tenantId, db = prisma) {
  const raw = await loadPayrollAccountMappings(tenantId, db);
  const resolved = await resolvePayrollAccountMappings(tenantId, raw, db);
  const { valid, missing } = validatePayrollAccountMappings(resolved);
  if (!valid) {
    throw new Error(
      `Payroll account mapping incomplete. Configure: ${missing.join(', ')}. Go to HR → Payroll → Account mappings.`,
    );
  }
  return resolved;
}

/**
 * @param {string} tenantId
 * @param {PayrollAccountMappings} mappings
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function savePayrollAccountMappings(tenantId, mappings, db = prisma) {
  const clean = parsePayrollAccountMappings(mappings);
  await db.tenantSettings.upsert({
    where: { tenantId },
    create: { tenantId, payrollAccountMappings: clean },
    update: { payrollAccountMappings: clean },
  });
  return clean;
}
