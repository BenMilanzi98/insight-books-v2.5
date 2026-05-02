/**
 * Column order and labels shared by import template, bulk import, and export
 * so Excel/CSV round-trips are importable.
 */
export const EMPLOYEE_IMPORT_EXPORT_HEADERS = [
  'Employee ID',
  'Full Name',
  'Email',
  'Phone',
  'ID Number',
  'Job Title',
  'Department',
  'Employment Type',
  'Gross Salary',
  'Hourly Rate',
  'Start Date',
  'Date of Birth',
  'Gender',
  'Marital Status',
  'Nationality',
  'Address',
  'Work Location',
  'Is Active',
  'Next of Kin Name',
  'Next of Kin Relationship',
  'Next of Kin Phone',
  'Next of Kin Address',
  'Selected Deductions',
];

export const EMPLOYEE_IMPORT_REQUIRED_HEADER_LABELS = ['Full Name', 'Job Title', 'Start Date'];

/**
 * Full HR export: same columns as import (round-trip), plus extended columns for
 * deductions detail, benefits, HR lifecycle, and JSON snapshots. Import ignores unknown headers.
 */
export const EMPLOYEE_FULL_EXPORT_HEADERS = [
  ...EMPLOYEE_IMPORT_EXPORT_HEADERS,
  'Employee Record Status',
  'Deductions Detail',
  'Benefits Detail',
  'Reporting Manager',
  'Suspension Start',
  'Suspension End',
  'Suspension Reason',
  'Termination Date',
  'Termination Reason',
  'Bank Details (JSON)',
  'Contact Details (JSON)',
];

/**
 * @param {Date|string|null|undefined} d
 * @returns {string} YYYY-MM-DD or empty
 */
export function formatDateYmdForExport(d) {
  if (d == null) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
}

/**
 * @param {object} employee - Prisma Employee with optional departmentRef
 * @param {Map<string, string>} deductionIdToName
 * @returns {string[]}
 */
export function employeeToImportExportRow(employee, deductionIdToName = new Map()) {
  const ec =
    employee.emergencyContact && typeof employee.emergencyContact === 'object'
      ? employee.emergencyContact
      : {};
  const deptName =
    employee.departmentRef?.name ||
    employee.department ||
    '';
  const gross = employee.grossSalary != null ? employee.grossSalary : employee.salary;
  let deductionsStr = '';
  const sd = employee.selectedDeductions;
  if (Array.isArray(sd) && sd.length) {
    deductionsStr = sd
      .map((id) => deductionIdToName.get(String(id)) || String(id))
      .filter(Boolean)
      .join(',');
  }
  const hrActive =
    employee.isActive !== false &&
    (!employee.status || String(employee.status).trim().toLowerCase() === 'active');
  const isActive = hrActive ? 'TRUE' : 'FALSE';
  return [
    employee.employeeId != null ? String(employee.employeeId) : '',
    employee.name != null ? String(employee.name) : '',
    employee.email != null ? String(employee.email) : '',
    employee.phone != null ? String(employee.phone) : '',
    employee.idNumber != null ? String(employee.idNumber) : '',
    employee.jobTitle != null ? String(employee.jobTitle) : employee.position != null ? String(employee.position) : '',
    String(deptName),
    employee.employmentType != null ? String(employee.employmentType) : 'Permanent',
    gross != null && gross !== '' ? String(gross) : '',
    employee.hourlyRate != null && employee.hourlyRate !== '' ? String(employee.hourlyRate) : '',
    formatDateYmdForExport(employee.startDate),
    formatDateYmdForExport(employee.dateOfBirth),
    employee.gender != null ? String(employee.gender) : '',
    employee.maritalStatus != null ? String(employee.maritalStatus) : '',
    employee.nationality != null ? String(employee.nationality) : 'Malawian',
    employee.address != null ? String(employee.address) : '',
    employee.workLocation != null ? String(employee.workLocation) : '',
    isActive,
    ec.name != null ? String(ec.name) : ec.fullName != null ? String(ec.fullName) : '',
    ec.relationship != null ? String(ec.relationship) : '',
    ec.phone != null ? String(ec.phone) : '',
    ec.address != null ? String(ec.address) : '',
    deductionsStr,
  ];
}

/**
 * @param {string[]} selectedIds
 * @param {Map<string, { id: string, name: string, amount: number|null, percentage: number|null, isStatutory: boolean, description?: string|null }>} deductionById
 */
export function formatDeductionsDetail(selectedIds, deductionById) {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return '';
  const parts = [];
  for (const rawId of selectedIds) {
    const id = String(rawId);
    const d = deductionById.get(id);
    if (!d) {
      parts.push(`[${id}]`);
      continue;
    }
    const bits = [d.name || id];
    if (d.amount != null && d.amount !== '') bits.push(`fixed ${Number(d.amount)}`);
    if (d.percentage != null && d.percentage !== '') bits.push(`${Number(d.percentage)}%`);
    if (d.isStatutory) bits.push('statutory');
    parts.push(bits.join(' · '));
  }
  return parts.join('; ');
}

/**
 * @param {Array<{ amount?: number, benefit?: { name?: string|null } }>} employeeBenefits
 */
export function formatBenefitsDetail(employeeBenefits) {
  if (!Array.isArray(employeeBenefits) || employeeBenefits.length === 0) return '';
  const rows = [...employeeBenefits]
    .filter((eb) => eb && eb.benefit)
    .map((eb) => ({
      name: eb.benefit?.name || 'Benefit',
      amount: Number(eb.amount ?? 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return rows.map((r) => `${r.name}: ${r.amount}`).join('; ');
}

function reportingManagerString(rm) {
  if (rm == null) return '';
  if (typeof rm !== 'object') return String(rm);
  if (rm.name) return String(rm.name);
  if (rm.fullName) return String(rm.fullName);
  try {
    return JSON.stringify(rm);
  } catch {
    return '';
  }
}

function jsonCell(obj) {
  if (obj == null || (typeof obj === 'object' && Object.keys(obj).length === 0)) return '';
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
}

/**
 * @param {object} employee - Employee with departmentRef, employeeBenefits[].benefit
 * @param {Map<string, string>} deductionIdToName - id → display name (import-compatible Selected Deductions column)
 * @param {Map<string, object>} deductionById - full deduction rows for Detail column
 */
export function employeeToFullExportRow(
  employee,
  deductionIdToName = new Map(),
  deductionById = new Map()
) {
  const base = employeeToImportExportRow(employee, deductionIdToName);
  const sd = employee.selectedDeductions;
  const selectedIds = Array.isArray(sd) ? sd.map(String) : [];

  const deductionsDetail = formatDeductionsDetail(selectedIds, deductionById);
  const benefitsDetail = formatBenefitsDetail(employee.employeeBenefits || []);

  const extras = [
    employee.status != null ? String(employee.status) : '',
    deductionsDetail,
    benefitsDetail,
    reportingManagerString(employee.reportingManager),
    formatDateYmdForExport(employee.suspendedFrom),
    formatDateYmdForExport(employee.suspendedTo),
    employee.suspensionReason != null ? String(employee.suspensionReason) : '',
    formatDateYmdForExport(employee.terminationDate),
    employee.terminationReason != null ? String(employee.terminationReason) : '',
    jsonCell(employee.bankDetails),
    jsonCell(employee.contactDetails),
  ];

  return [...base, ...extras];
}

export function escapeCsvField(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(headers, rows) {
  const lines = [
    headers.map((h) => escapeCsvField(h)).join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvField(cell)).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}
