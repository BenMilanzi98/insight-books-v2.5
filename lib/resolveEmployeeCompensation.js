/**
 * Resolve pay terms for a payroll period from EmploymentContract when present,
 * otherwise fall back to Employee flat fields (legacy).
 */

import prisma from '@/lib/prisma';
import { pickContractForDate, resolvePayBasis, CONTRACT_STATUSES } from '@/lib/employmentContract';
import { parseMoney } from '@/lib/money';

/**
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [params.db]
 * @param {string} params.tenantId
 * @param {string} params.employeeId
 * @param {Date|string} [params.asOf] — typically period end
 */
export async function resolveEmployeeCompensation({
  db = prisma,
  tenantId,
  employeeId,
  asOf = new Date(),
}) {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: {
      id: true,
      salary: true,
      grossSalary: true,
      hourlyRate: true,
      employmentType: true,
      position: true,
      departmentId: true,
    },
  });

  if (!employee) {
    return null;
  }

  const contracts = await db.employmentContract.findMany({
    where: {
      tenantId,
      employeeId,
      status: {
        in: [CONTRACT_STATUSES.ACTIVE, CONTRACT_STATUSES.SUSPENDED],
      },
    },
    orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
  });

  const contract = pickContractForDate(contracts, asOf);

  if (contract) {
    const basicSalary = parseMoney(contract.basicSalary);
    const hourlyRate =
      contract.hourlyRate != null ? parseMoney(contract.hourlyRate) : null;
    const dailyRate =
      contract.dailyRate != null ? parseMoney(contract.dailyRate) : null;

    return {
      source: 'contract',
      contractId: contract.id,
      contractVersion: contract.version,
      payBasis: contract.payBasis || resolvePayBasis(contract),
      payFrequency: contract.payFrequency || 'MONTHLY',
      basicSalary,
      grossSalary: basicSalary,
      hourlyRate,
      dailyRate,
      overtimeEligible: contract.overtimeEligible !== false,
      overtimeMultiplier: parseMoney(contract.overtimeMultiplier ?? 1.5),
      currency: contract.currency || 'MWK',
      pensionEligible: contract.pensionEligible !== false,
      gratuityEligible: contract.gratuityEligible !== false,
      position: contract.position || employee.position,
      departmentId: contract.departmentId || employee.departmentId,
      employmentType: contract.employmentType || employee.employmentType,
      effectiveFrom: contract.effectiveFrom,
      effectiveTo: contract.effectiveTo,
    };
  }

  const basicSalary = parseMoney(employee.grossSalary ?? employee.salary ?? 0);
  const hourlyRate =
    employee.hourlyRate != null ? parseMoney(employee.hourlyRate) : null;

  return {
    source: 'employee',
    contractId: null,
    contractVersion: null,
    payBasis: resolvePayBasis({
      hourlyRate,
      basicSalary,
    }),
    payFrequency: 'MONTHLY',
    basicSalary,
    grossSalary: basicSalary,
    hourlyRate,
    dailyRate: null,
    overtimeEligible: true,
    overtimeMultiplier: 1.5,
    currency: 'MWK',
    pensionEligible: true,
    gratuityEligible: true,
    position: employee.position,
    departmentId: employee.departmentId,
    employmentType: employee.employmentType,
    effectiveFrom: null,
    effectiveTo: null,
  };
}
