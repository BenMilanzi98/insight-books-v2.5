/**
 * Canonical calculation order for Payroll V2.
 * Documented + enforced by calculateEmployeePayrollV2.
 */
export const CALCULATION_ORDER = Object.freeze([
  'resolve_contract',
  'resolve_approved_attendance_ot',
  'resolve_paid_leave',
  'compute_basic_earnings',
  'add_taxable_benefits',
  'compute_gross_and_taxable',
  'compute_employee_nps',
  'compute_paye',
  'apply_other_deductions_by_priority',
  'apply_advance_recovery',
  'apply_approved_penalties',
  'enforce_min_net_pay',
  'compute_employer_nps',
  'compute_gratuity_accrual',
  'build_components_and_explanation',
]);

export const DEFAULT_MIN_NET_PAY = 0;
