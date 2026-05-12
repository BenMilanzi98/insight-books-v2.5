// app/api/payroll/enhanced/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { calculateMalawiPayroll } from '@/lib/malawiTaxUtils';
import { deductionMatchesNps, deductionMatchesPaye } from '@/lib/payrollDeductionMatching';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { generateReferenceNumber } from '@/lib/journalService';
import { getTaxType, autoPostTaxEntry } from '@/lib/taxCalculationService';
import { normalizePayrollMonthPeriod } from '@/lib/dateUtils';
import { getAccountForPaymentMethod } from '@/lib/paymentMethodAccountMapping';
import { assertAccountsAllowDirectPosting } from '@/lib/coaDirectPostingEligibility';
import { resolveSalaryAdvanceReceivableAccount } from '@/lib/salaryAdvanceGlAccount';

/**
 * POST - Create enhanced payroll run with Malawi tax compliance
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const paymentAccountId = body.paymentAccountId || null;
    const expenseAccountId = body.expenseAccountId || null;

    // Validate request body
    if (!body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: 'Period start and end dates are required' },
        { status: 400 }
      );
    }

    // Normalize to 1st and last day of the selected calendar month (date-only YYYY-MM-DD parsed safely for any server TZ)
    const { periodStart, periodEnd } = normalizePayrollMonthPeriod(body.periodStart, body.periodEnd);
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();

    // Validate date range (after normalization)
    if (periodEnd < periodStart) {
      return NextResponse.json(
        { error: 'Period end date cannot be before start date' },
        { status: 400 }
      );
    }

    // Check if a payroll run already exists for this period
    const existingPayroll = await prisma.payroll.findFirst({
      where: {
        periodStart,
        periodEnd,
        tenantId: user.tenantId,
        status: { not: 'Reversed' },
      }
    });

    if (existingPayroll) {
      return NextResponse.json(
        { error: 'A payroll run already exists for this period' },
        { status: 400 }
      );
    }

    // Get all active employees with attendance records and benefits (allowances/perks)
    const employees = await prisma.employee.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      },
      include: {
        attendanceRecords: {
          where: {
            date: {
              gte: periodStart,
              lte: periodEnd
            }
          }
        },
        gratuityAccount: {
          select: {
            id: true,
            accrualRate: true,
            totalAccrued: true,
            totalPaid: true,
            outstandingAmount: true
          }
        },
        employeeBenefits: {
          where: { benefit: { isActive: true } },
          include: {
            benefit: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    // Tenant-level NPS rates (percentage points). Null means "not configured" (treat as 0%).
    // Use raw SQL so payroll processing still works even if Prisma Client is stale.
    // Prisma/PostgreSQL may return column names in lowercase, so read both.
    let npsRates = { employeeRatePercent: null, employerRatePercent: null };
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && typeof row === 'object') {
        const empRaw = row.npsEmployeeRatePercent ?? row.npsemployeeratepercent ?? null;
        const empErRaw = row.npsEmployerRatePercent ?? row.npsemployerratepercent ?? null;
        const emp = empRaw === null || empRaw === undefined ? null : Number(empRaw);
        const empEr = empErRaw === null || empErRaw === undefined ? null : Number(empErRaw);
        npsRates = {
          employeeRatePercent: Number.isFinite(emp) ? emp : null,
          employerRatePercent: Number.isFinite(empEr) ? empEr : null,
        };
      }
    } catch (e) {
      console.warn('Payroll raw NPS rate read failed, falling back to nulls:', e?.message || e);
    }

    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees found' },
        { status: 400 }
      );
    }

    // Get or create required accounts/liabilities (including 5230 - Salaries Expense)
    let payrollAccounts;
    try {
      payrollAccounts = await getOrCreatePayrollAccounts(user.tenantId);
    } catch (accountError) {
      console.error('Payroll accounts setup failed:', accountError);
      return NextResponse.json(
        {
          error: accountError.message || 'Failed to load or create payroll accounts.',
          hint: 'Ensure Chart of Accounts includes "Salaries Expense" (code 5230), Cash, PAYE and NPS liability accounts.'
        },
        { status: 400 }
      );
    }

    const [
      selectedExpenseAccount,
      selectedCoAPaymentAccount,
      selectedPaymentAccountRecord
    ] = await Promise.all([
      expenseAccountId
        ? prisma.account.findFirst({ where: { id: expenseAccountId, tenantId: user.tenantId } })
        : null,
      paymentAccountId
        ? prisma.account.findFirst({ where: { id: paymentAccountId, tenantId: user.tenantId } })
        : null,
      paymentAccountId
        ? prisma.paymentAccount.findFirst({
            where: { id: paymentAccountId, tenantId: user.tenantId, isActive: true }
          })
        : null
    ]);

    if (expenseAccountId && !selectedExpenseAccount) {
      return NextResponse.json(
        { error: 'Selected salary expense account was not found' },
        { status: 400 }
      );
    }

    if (selectedExpenseAccount && !isExpenseAccount(selectedExpenseAccount)) {
      return NextResponse.json(
        { error: 'Selected salary account must be an Expense account' },
        { status: 400 }
      );
    }

    if (paymentAccountId && !selectedCoAPaymentAccount && !selectedPaymentAccountRecord) {
      return NextResponse.json(
        { error: 'Selected payment account was not found' },
        { status: 400 }
      );
    }

    const findAccountByName = (name) => {
      const found = payrollAccounts.find(
        (acc) => {
          const accName = (acc.accountName || acc.name || '').trim();
          return accName.toLowerCase() === name.toLowerCase();
        }
      );
      
      if (!found && name === 'Salaries Expense') {
        // If Salaries Expense not found, try to find any expense account with "Salary" or "Salaries" in the name
        const salaryExpense = payrollAccounts.find(
          (acc) => {
            const accName = (acc.accountName || acc.name || '').trim().toLowerCase();
            const accType = (acc.accountType || acc.type || '').toLowerCase();
            return (accName.includes('salary') || accName.includes('salaries')) && 
                   (accType.includes('expense') || accType === 'expense');
          }
        );
        return salaryExpense;
      }
      
      return found;
    };

    const expenseAccount =
      selectedExpenseAccount || findAccountByName('Salaries Expense');
    // Resolve payment account selection through the central mapper so structural headers
    // such as 1000 are never used as payroll cash/bank posting accounts.
    let paymentAccount = null;
    if (paymentAccountId && (selectedCoAPaymentAccount || selectedPaymentAccountRecord)) {
      try {
        paymentAccount = await getAccountForPaymentMethod(user.tenantId, paymentAccountId, prisma);
      } catch (e) {
        console.warn('Payroll payment account mapping failed, falling back to standard Cash:', e?.message || e);
      }
    }

    if (!paymentAccount) {
      try {
        paymentAccount = await getAccountForPaymentMethod(user.tenantId, 'cash', prisma);
      } catch (e) {
        console.warn('Payroll standard Cash mapping failed:', e?.message || e);
      }
    }

    paymentAccount = paymentAccount || findAccountByName('Cash');

    if (paymentAccount && !isAssetAccount(paymentAccount)) {
      return NextResponse.json(
        { error: 'Resolved payment account must be an Asset (cash/bank) account' },
        { status: 400 }
      );
    }
    
    // REQUIRE PAYE tax type - it must exist with a linked account for accurate tracking
    let payeTaxType = null;
    try {
      payeTaxType = await getTaxType(user.tenantId, 'PAYE');
      
      if (!payeTaxType) {
        // PAYE tax type doesn't exist - create it immediately
        console.log('⚠️ PAYE tax type not found - creating it now');
        
        // Check if PAYE deduction exists
        const payeDeduction = await prisma.deduction.findFirst({
          where: {
            tenantId: user.tenantId,
            name: { contains: 'PAYE', mode: 'insensitive' },
            isStatutory: true
          }
        });

        if (!payeDeduction) {
          return NextResponse.json(
            { 
              error: 'PAYE deduction not found. Please ensure PAYE deduction exists before processing payroll.',
              details: 'PAYE tax type requires a PAYE deduction to be created first.'
            },
            { status: 400 }
          );
        }

        // Find or create PAYE Liability account (MUST be Liability type)
        let payeAccount = await prisma.account.findFirst({
          where: {
            tenantId: user.tenantId,
            OR: [
              { name: { contains: 'PAYE', mode: 'insensitive' } },
              { accountName: { contains: 'PAYE', mode: 'insensitive' } }
            ],
            accountType: 'Liability'
          }
        });

        if (!payeAccount) {
          const { findCurrentLiabilitiesGroupId } = await import('@/lib/coaPostingCodes');
          const parentId = await findCurrentLiabilitiesGroupId(user.tenantId, prisma);
          payeAccount = await prisma.account.create({
            data: {
              code: '2130',
              name: 'PAYE Payable',
              type: 'LIABILITY',
              accountCode: '2130',
              accountName: 'PAYE Payable',
              accountType: 'Liability',
              accountSubtype: 'Current Liability',
              normalBalance: 'Credit',
              balance: 0,
              tenantId: user.tenantId,
              ...(parentId ? { parentAccountId: parentId } : {}),
            }
          });
          console.log('✅ Created PAYE Payable account:', payeAccount.id);
        }

        // Create PAYE tax type with account linked
        payeTaxType = await prisma.taxType.create({
          data: {
            taxId: 'PAYE',
            taxName: 'PAYE (Malawi Income Tax 2025/26)',
            taxCode: 'PAYE-2025-26',
            taxRate: 0, // PAYE is calculated dynamically based on brackets
            calculationType: 'Percentage',
            accountId: payeAccount.id, // REQUIRED: Always link to account
            status: 'Active',
            tenantId: user.tenantId
          },
          include: {
            account: true
          }
        });
        console.log('✅ PAYE tax type created with account:', {
          taxTypeId: payeTaxType.id,
          accountId: payeTaxType.account?.id,
          accountName: payeTaxType.account?.accountName
        });
      } else {
        // Verify tax type has account linked
        if (!payeTaxType.account || !payeTaxType.accountId) {
          console.error('❌ PAYE tax type exists but has no account linked');
          return NextResponse.json(
            { 
              error: 'PAYE tax type is missing a linked account. Please update the PAYE tax type in Tax Types to link it to a Liability account.',
              details: 'PAYE tax type must have a default tax liability account for accurate tracking.'
            },
            { status: 400 }
          );
        }

        // Verify account is a Liability account
        if (payeTaxType.account.accountType !== 'Liability') {
          console.error('❌ PAYE tax type account is not a Liability account');
          return NextResponse.json(
            { 
              error: 'PAYE tax type is linked to a non-Liability account. PAYE must be linked to a Liability account.',
              details: `Current account type: ${payeTaxType.account.accountType}`
            },
            { status: 400 }
          );
        }

        console.log('✅ PAYE tax type found with valid account:', {
          id: payeTaxType.id,
          taxId: payeTaxType.taxId,
          taxName: payeTaxType.taxName,
          accountId: payeTaxType.account.id,
          accountName: payeTaxType.account.accountName,
          accountType: payeTaxType.account.accountType
        });
      }
    } catch (err) {
      console.error('❌ Error fetching/creating PAYE tax type:', err);
      return NextResponse.json(
        { 
          error: 'Failed to initialize PAYE tax tracking. Please ensure PAYE tax type exists in Tax Types.',
          details: err.message
        },
        { status: 500 }
      );
    }

    // PAYE tax type is REQUIRED - use its account
    if (!payeTaxType || !payeTaxType.account) {
      return NextResponse.json(
        { 
          error: 'PAYE tax type is required but not properly configured. Please ensure PAYE tax type exists with a linked Liability account in Tax Types.',
          details: 'PAYE must have a default tax liability account for accurate tracking and reconciliation.'
        },
        { status: 400 }
      );
    }

    const payeAccount = payeTaxType.account;
    const npsEmployeeAccount = findAccountByName('NPS Employee Contribution Liability');
    const npsEmployerAccount = findAccountByName('NPS Employer Contribution Liability');
    const otherDeductionsAccount = findAccountByName('Payroll Deductions Liability');
    
    const advanceReceivableAccount = await resolveSalaryAdvanceReceivableAccount(user.tenantId, prisma);

    // Validate expense account is actually an expense account and not COGS
    if (expenseAccount) {
      const expenseAccountName = (expenseAccount.accountName || expenseAccount.name || '').toLowerCase();
      const expenseAccountType = (expenseAccount.accountType || expenseAccount.type || '').toLowerCase();
      
      // Check if it's COGS or wrong account type
      if (expenseAccountName.includes('cost of goods') || expenseAccountName.includes('cogs')) {
        return NextResponse.json(
          { 
            error: 'Invalid expense account selected. Payroll must use a Salaries/Salary Expense account, not Cost of Goods Sold. Please select the correct account or ensure "Salaries Expense" account exists.',
            details: `Found account: ${expenseAccount.accountName || expenseAccount.name}`
          },
          { status: 400 }
        );
      }
      
      // Ensure it's an expense account
      if (!expenseAccountType.includes('expense') && expenseAccountType !== 'expense') {
        return NextResponse.json(
          { 
            error: 'Selected expense account must be an Expense account type.',
            details: `Account type: ${expenseAccountType}`
          },
          { status: 400 }
        );
      }
    }

    if (!expenseAccount || !paymentAccount || !payeAccount || !npsEmployeeAccount || !npsEmployerAccount || !otherDeductionsAccount) {
      const missingAccounts = [];
      if (!expenseAccount) missingAccounts.push('Salaries Expense');
      if (!paymentAccount) missingAccounts.push('Cash');
      if (!payeAccount) missingAccounts.push('PAYE Liability');
      if (!npsEmployeeAccount) missingAccounts.push('NPS Employee Contribution Liability');
      if (!npsEmployerAccount) missingAccounts.push('NPS Employer Contribution Liability');
      if (!otherDeductionsAccount) missingAccounts.push('Payroll Deductions Liability');
      
      return NextResponse.json(
        { 
          error: 'Required payroll accounts are missing. Please ensure all payroll accounts exist.',
          missingAccounts: missingAccounts
        },
        { status: 400 }
      );
    }

    try {
      await assertAccountsAllowDirectPosting(
        [
          expenseAccount.id,
          paymentAccount.id,
          payeAccount.id,
          npsEmployeeAccount.id,
          npsEmployerAccount.id,
          otherDeductionsAccount.id,
          advanceReceivableAccount.id,
        ],
        prisma
      );
    } catch (postingAccountError) {
      return NextResponse.json(
        {
          error: 'One or more payroll accounts cannot receive direct postings.',
          details: postingAccountError.message,
          hint: 'Use detail payroll, PAYE, NPS, deduction, salary advance, and cash/bank accounts instead of chart section headers like 1000.',
        },
        { status: 400 }
      );
    }

    const payrollEntries = [];

    for (const employee of employees) {
      const baseSalary = Number(employee.grossSalary || employee.salary || 0);
      if (!baseSalary || Number.isNaN(baseSalary)) {
        console.warn(`No valid base salary for employee ${employee.name}`);
      }

      const totalHoursWorked = employee.attendanceRecords.reduce((sum, record) => {
        return sum + (record.hoursWorked || 0);
      }, 0);

      const totalOvertimeHours = employee.attendanceRecords.reduce((sum, record) => {
        return sum + (record.overtimeHours || 0);
      }, 0);

      const overtimeRate = (baseSalary / 160) * 1.5;
      const overtimePay = totalOvertimeHours * overtimeRate;

      let otherDeductions = {};
      let deductionNames = {}; // Store deduction names for payslip display
      let applyPAYE = false;
      let applyNPS = false; // NPS is optional (only apply when selected for the employee)
      
      if (employee.selectedDeductions) {
        // Normalize legacy/new shapes:
        // - Array of IDs: ["ded1","ded2"]
        // - Array of objects: [{id:"ded1"}, ...]
        // - Map of ids to true/false: { "ded1": true }
        // - Map of names/ids to numeric amounts: { "Loan": 5000 } (treated as otherDeductions)
        // - Mixed maps: values that look like string IDs are treated as ids
        const raw = employee.selectedDeductions;
        let deductionIds = [];

        const pushId = (v) => {
          const s = typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : null);
          if (s && s.trim()) deductionIds.push(s.trim());
        };

        if (Array.isArray(raw)) {
          for (const item of raw) {
            if (typeof item === 'string' || typeof item === 'number') {
              pushId(item);
            } else if (item && typeof item === 'object' && (item.id || item.deductionId)) {
              pushId(item.id || item.deductionId);
            }
          }
        } else if (raw && typeof raw === 'object') {
          const values = Object.values(raw);
          const keys = Object.keys(raw);

          const allNumeric = values.length > 0 && values.every(v => typeof v === 'number' && Number.isFinite(v));
          const allBool = values.length > 0 && values.every(v => typeof v === 'boolean');

          if (allNumeric) {
            // Treat as otherDeductions map (name/id -> amount)
            otherDeductions = raw;
          } else if (allBool) {
            // Treat keys with true as selected deduction IDs
            keys.forEach((k) => {
              if (raw[k] === true) pushId(k);
            });
          } else {
            // Mixed: capture string-like ids in values, and true-ish keys if present
            values.forEach((v) => {
              if (typeof v === 'string' || typeof v === 'number') pushId(v);
              else if (v && typeof v === 'object' && (v.id || v.deductionId)) pushId(v.id || v.deductionId);
            });
            keys.forEach((k) => {
              if (raw[k] === true) pushId(k);
            });
          }
        }

        deductionIds = [...new Set(deductionIds)].filter((id) => typeof id === 'string' && id.length > 0);

        if (deductionIds.length > 0) {
          const deductions = await prisma.deduction.findMany({
            where: {
              id: { in: deductionIds },
              tenantId: user.tenantId,
              isActive: true
            }
          });

          deductions.forEach((deduction) => {
            const isPAYE = deductionMatchesPaye(deduction);
            const isNPS = deductionMatchesNps(deduction);
            if (isPAYE) applyPAYE = true;
            if (isNPS) applyNPS = true;
            if (!isPAYE && !isNPS && deduction.amount) {
              otherDeductions[deduction.id] = Number(deduction.amount);
              deductionNames[deduction.id] = deduction.name;
            } else if (!isPAYE && !isNPS && deduction.percentage && baseSalary > 0) {
              otherDeductions[deduction.id] = (baseSalary * Number(deduction.percentage)) / 100;
              deductionNames[deduction.id] = deduction.name;
            }
          });
        }
      }

      // Fetch active salary advances for this employee
      const activeAdvances = await prisma.salaryAdvance.findMany({
        where: {
          employeeId: employee.id,
          tenantId: user.tenantId,
          status: 'Active',
          outstandingAmount: { gt: 0 }
        }
      });

      // Add advance deductions to otherDeductions
      const advanceDeductions = [];
      for (const advance of activeAdvances) {
        // Calculate deduction amount (use monthly deduction, but don't exceed outstanding)
        const deductionAmount = Math.min(advance.monthlyDeduction, advance.outstandingAmount);
        if (deductionAmount > 0) {
          const advanceKey = `advance_${advance.id}`;
          otherDeductions[advanceKey] = deductionAmount;
          deductionNames[advanceKey] = `Salary Advance (${advance.reference || advance.id.substring(0, 8)})`;
          advanceDeductions.push({
            advanceId: advance.id,
            amount: deductionAmount
          });
        }
      }

      // Fetch gratuity account if employee has one
      // Note: Gratuity is added to the account, not deducted from salary
      let gratuityAccount = employee.gratuityAccount;
      let gratuityAccrualAmount = 0;
      
      if (gratuityAccount) {
        // Calculate gratuity accrual based on accrual rate
        // Gratuity accumulates as a percentage of salary each month - NOT deducted from salary
        // Monthly accrual = baseSalary * (accrualRatePercent / 100)
        // accrualRate is stored as percentage points (e.g. 5 = 5%).
        // Backward compatibility: if an old record has 0.05, treat it as 5%.
        const rawRate = gratuityAccount.accrualRate ?? 5;
        const ratePercent = rawRate > 0 && rawRate <= 1 ? rawRate * 100 : rawRate;
        const rateFraction = (Number(ratePercent) || 5) / 100;
        gratuityAccrualAmount = baseSalary * rateFraction;
      }

      // Fetch unpaid leave requests for this employee during the payroll period
      const unpaidLeaveRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          tenantId: user.tenantId,
          status: 'approved',
          leavePolicy: {
            isPaid: false // Only unpaid leave should be deducted
          },
          OR: [
            {
              AND: [
                { startDate: { lte: periodEnd } },
                { endDate: { gte: periodStart } }
              ]
            }
          ]
        },
        include: {
          leavePolicy: {
            select: {
              id: true,
              name: true,
              leaveType: true,
              isPaid: true
            }
          }
        }
      });

      // Calculate leave deduction for unpaid leave days within the payroll period
      let leaveDeductions = [];
      let totalLeaveDeduction = 0;
      
      for (const leaveRequest of unpaidLeaveRequests) {
        // Calculate overlapping days between leave period and payroll period
        const leaveStart = new Date(leaveRequest.startDate);
        const leaveEnd = new Date(leaveRequest.endDate);
        const payrollStart = new Date(periodStart);
        const payrollEnd = new Date(periodEnd);

        // Find the overlap
        const overlapStart = leaveStart > payrollStart ? leaveStart : payrollStart;
        const overlapEnd = leaveEnd < payrollEnd ? leaveEnd : payrollEnd;

        if (overlapStart <= overlapEnd) {
          // Calculate days in overlap (inclusive of both start and end)
          const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
          
          // Calculate daily rate (assuming monthly salary / working days per month)
          const workingDaysPerMonth = 22; // Standard working days
          const dailyRate = baseSalary / workingDaysPerMonth;
          const deductionAmount = dailyRate * overlapDays;

          if (deductionAmount > 0) {
            otherDeductions[`leave_${leaveRequest.id}`] = deductionAmount;
            totalLeaveDeduction += deductionAmount;
            leaveDeductions.push({
              leaveRequestId: leaveRequest.id,
              leaveType: leaveRequest.leavePolicy.leaveType,
              days: overlapDays,
              amount: deductionAmount
            });
          }
        }
      }

      // Build allowances from employee benefits (house allowance, airtime, other perks)
      const allowances = {};
      if (employee.employeeBenefits && employee.employeeBenefits.length > 0) {
        for (const eb of employee.employeeBenefits) {
          if (eb.benefit?.name && (eb.amount == null || Number(eb.amount) > 0)) {
            allowances[eb.benefit.name] = Number(eb.amount) || 0;
          }
        }
      }

      const payrollData = {
        basicSalary: baseSalary,
        allowances,
        otherDeductions: otherDeductions,
        hoursWorked: totalHoursWorked,
        hourlyRate: employee.hourlyRate || 0,
        overtimeHours: totalOvertimeHours,
        overtimeRate: overtimeRate
      };

      // Calculate payroll with optional PAYE and NPS (NPS rates are configurable)
      const payrollCalculation = calculateMalawiPayroll(payrollData, applyPAYE, applyNPS, npsRates);

      // Ensure all values are properly calculated
      const payeAmount = Number(payrollCalculation.payeAmount) || 0;
      const npsEmployeeAmount = Number(payrollCalculation.npsEmployeeAmount) || 0;
      const npsEmployerAmount = Number(payrollCalculation.npsEmployerAmount) || 0;
      const otherDeductionsTotal = Object.values(payrollCalculation.otherDeductions || {}).reduce(
        (sum, value) => sum + (Number(value) || 0),
        0
      );
      
      // Separate advance deductions from other deductions for proper accounting
      const totalAdvanceDeductions = advanceDeductions.reduce((sum, ad) => sum + ad.amount, 0);
      const otherDeductionsExcludingAdvances = otherDeductionsTotal - totalAdvanceDeductions;
      
      // Calculate total deductions by adding all deduction components
      // This ensures deductions are properly accumulated before subtracting
      const totalDeductions = payeAmount + npsEmployeeAmount + otherDeductionsTotal;
      
      const grossPay = Number(payrollCalculation.totalGrossPay) || 0;
      const additions = Number(payrollCalculation.totalAllowances) || 0;
      const netPay = Math.max(0, Number(payrollCalculation.netPay) || 0);
      
      // Debug logging to verify calculation
      console.log(`Payroll Calculation for ${employee.name}:`, {
        basicSalary: baseSalary,
        allowancesTotal: additions,
        taxableGrossPay: grossPay,
        payeAmount: payeAmount,
        npsEmployeeAmount: npsEmployeeAmount,
        otherDeductionsTotal: otherDeductionsTotal,
        totalDeductions: totalDeductions,
        netPay: netPay,
        calculation: `Net = taxable gross − deductions + allowances → ${netPay}`
      });

      // Total advance deductions already calculated above for transaction lines

      const additionalInfo = {
        allowances: payrollCalculation.allowances || {},
        otherDeductions: payrollCalculation.otherDeductions || {},
        // Malawi PAYE: gross payroll base before separate employee NPS deduction
        payeTaxableIncome: payrollCalculation.payeTaxableIncome ?? null,
        deductionNames: deductionNames, // Store deduction names for payslip
        advanceDeductions: advanceDeductions.map(ad => ({
          advanceId: ad.advanceId,
          amount: ad.amount
        })),
        totalAdvanceDeductions,
        leaveDeductions: leaveDeductions.map(ld => ({
          leaveRequestId: ld.leaveRequestId,
          leaveType: ld.leaveType,
          days: ld.days,
          amount: ld.amount
        })),
        totalLeaveDeductions: totalLeaveDeduction,
        gratuityAccrualAmount: gratuityAccrualAmount,
        npsEmployeeAmount,
        npsEmployerAmount,
        // Store the NPS rates actually used for this payroll run (matches calculation, not raw tenant nulls)
        npsEmployeeRatePercent: payrollCalculation.npsRatesApplied?.employeeRatePercent ?? null,
        npsEmployerRatePercent: payrollCalculation.npsRatesApplied?.employerRatePercent ?? null,
        hoursWorked: totalHoursWorked,
        overtimeHours: totalOvertimeHours,
        overtimePay: Number(payrollCalculation.overtimePay) || 0,
        attendanceAdjustment: 0,
        expenseAccount: {
          id: expenseAccount.id,
          name: getAccountDisplayName(expenseAccount)
        },
        paymentAccount: {
          id: paymentAccount.id,
          name: getAccountDisplayName(paymentAccount)
        }
      };

      const payrollEntry = await prisma.payroll.create({
        data: {
          employeeId: employee.id,
          periodStart,
          periodEnd,
          basicSalary: Number(payrollCalculation.basicSalary) || 0,
          grossPay: grossPay,
          deductions: totalDeductions,
          additions: additions,
          netPay: netPay,
          payeAmount,
          totalNpsAmount: Number(payrollCalculation.totalNpsAmount) || 0,
          gratuityAccruedAmount: gratuityAccrualAmount || 0,
          status: 'Posted', // Changed from 'Draft' to 'Posted'
          paymentDate,
          tenantId: user.tenantId,
          notes: JSON.stringify(additionalInfo)
        }
      });

      payrollEntries.push(payrollEntry);

      // Record advance deductions
      for (const advanceDeduction of advanceDeductions) {
        try {
          await prisma.advanceDeduction.create({
            data: {
              salaryAdvanceId: advanceDeduction.advanceId,
              payrollId: payrollEntry.id,
              amount: advanceDeduction.amount,
              deductionDate: paymentDate || periodEnd,
              notes: `Deducted from payroll for period ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`
            }
          });

          // Update advance totals
          const advance = await prisma.salaryAdvance.findUnique({
            where: { id: advanceDeduction.advanceId }
          });

          if (advance) {
            const newTotalDeducted = advance.totalDeducted + advanceDeduction.amount;
            const newOutstanding = Math.max(0, advance.amount - newTotalDeducted);
            const newStatus = newOutstanding <= 0 ? 'Completed' : advance.status;

            await prisma.salaryAdvance.update({
              where: { id: advanceDeduction.advanceId },
              data: {
                totalDeducted: newTotalDeducted,
                outstandingAmount: newOutstanding,
                status: newStatus
              }
            });
          }
        } catch (error) {
          console.error(`Error recording advance deduction for advance ${advanceDeduction.advanceId}:`, error);
          // Continue processing other advances even if one fails
        }
      }

      // Update gratuity account - add accrual amount to the account
      if (gratuityAccount && gratuityAccrualAmount > 0) {
        try {
          const newTotalAccrued = gratuityAccount.totalAccrued + gratuityAccrualAmount;
          const newOutstandingAmount = Math.max(0, newTotalAccrued - gratuityAccount.totalPaid);

          await prisma.gratuityAccount.update({
            where: { id: gratuityAccount.id },
            data: {
              totalAccrued: newTotalAccrued,
              outstandingAmount: newOutstandingAmount,
              lastCalculatedAt: new Date()
            }
          });

          console.log(`Updated gratuity account for ${employee.name}: Added ${gratuityAccrualAmount.toFixed(2)} MWK. New total accrued: ${newTotalAccrued.toFixed(2)} MWK`);
        } catch (error) {
          console.error(`Error updating gratuity account for employee ${employee.id}:`, error);
          // Continue processing even if gratuity update fails
        }
      }

      // Create separate expense records for each payroll component
      // This provides better breakdown for dashboard expenses
      
      // Align expense dates with payment / GL (so MTD dashboard includes payroll immediately; periodEnd can be future)
      const expenseDate = paymentDate || periodEnd;
      const PAYROLL_DASHBOARD_EXPENSE_PREFIX = 'payrollDashboardExpense:';
      const payrollExpenseMarker = `${PAYROLL_DASHBOARD_EXPENSE_PREFIX}${payrollEntry.id}`;
      
      // 1. Net Pay expense (actual payment to employee)
      if (netPay > 0) {
        const netPayExpense = await prisma.expense.create({
          data: {
            description: `Net Pay - ${employee.name}`,
            amount: netPay,
            date: expenseDate,
            category: 'Salary',
            employeeId: employee.id,
            paymentMethod: getAccountDisplayName(paymentAccount),
            sourceAccountId: paymentAccount.id,
            status: 'Approved',
            paymentStatus: 'Fully paid',
            paidAmount: netPay,
            submittedById: user.id,
            tenantId: user.tenantId,
            originalReference: payrollEntry.id,
            notes: `Net Pay for ${employee.name} after all deductions | ${payrollExpenseMarker}`
          }
        });

        await prisma.payment.create({
          data: {
            tenantId: user.tenantId,
            amount: netPay,
            paymentDate: paymentDate,
            paymentMethod: getAccountDisplayName(paymentAccount),
            type: 'expense',
            status: 'Completed',
            expenseId: netPayExpense.id,
            notes: `Net Pay for ${employee.name}`
          }
        });
      }

      // 2. PAYE expense (employer's tax expense - different from withholding)
      if (payeAmount > 0) {
        // Link to PAYE tax type for reporting and reconciliation (liability postings are in GL).
        const payeTaxTypeRow = await prisma.taxType.findFirst({
          where: {
            tenantId: user.tenantId,
            OR: [
              { taxId: 'PAYE' },
              { taxName: { contains: 'PAYE', mode: 'insensitive' } }
            ]
          },
          select: { id: true }
        });
        const payeExpense = await prisma.expense.create({
          data: {
            description: `PAYE Tax - ${employee.name}`,
            amount: payeAmount,
            date: expenseDate,
            category: 'Tax',
            employeeId: employee.id,
            paymentMethod: 'N/A - Tax Liability',
            status: 'Approved',
            paymentStatus: 'Pending',
            paidAmount: 0,
            submittedById: user.id,
            tenantId: user.tenantId,
            taxTypeId: payeTaxTypeRow?.id || null,
            originalReference: payrollEntry.id,
            notes: `PAYE for ${employee.name} | Gross: ${grossPay.toFixed(2)} | PAYE: ${payeAmount.toFixed(2)} | Period: ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()} | For MRA Settlement | ${payrollExpenseMarker}`
          }
        });

        // Note: PAYE payment will be recorded when the tax is actually paid
      }

      // 3. Employer NPS expense (employer's pension contribution)
      if (npsEmployerAmount > 0) {
        const npsExpense = await prisma.expense.create({
          data: {
            description: `Employer NPS - ${employee.name}`,
            amount: npsEmployerAmount,
            date: expenseDate,
            category: 'Pension',
            employeeId: employee.id,
            paymentMethod: 'N/A - Pension Liability',
            status: 'Approved',
            paymentStatus: 'Pending',
            paidAmount: 0,
            submittedById: user.id,
            tenantId: user.tenantId,
            originalReference: payrollEntry.id,
            notes: `Employer pension contribution (${npsRates.employerRatePercent}%) for ${employee.name} - This amount is owed to NPS | ${payrollExpenseMarker}`
          }
        });
      }

      const transactionLines = [];
      
      // ============================================
      // CORRECT PAYROLL ACCOUNTING (Double-Entry)
      // ============================================
      // Total expense = grossPay + additions + employer NPS
      // This represents the total cost to the company for this employee's payroll
      // grossPay on Payroll = taxable gross (basic + overtime); additions = benefits/allowances after tax
      // npsEmployerAmount = employer's pension contribution (additional cost)
      // 
      // Accounting Equation:
      // Debit (Salary Expense) = grossPay + additions + npsEmployerAmount
      // Credits = payeAmount + npsEmployeeAmount + npsEmployerAmount + otherDeductionsExcludingAdvances + totalAdvanceDeductions + netPay
      // 
      // Since netPay = grossPay - payeAmount - npsEmployeeAmount - otherDeductionsTotal + additions
      // And otherDeductionsTotal = otherDeductionsExcludingAdvances + totalAdvanceDeductions
      // Therefore: Credits = grossPay + additions + npsEmployerAmount ✓ (BALANCED)
      // ============================================
      
      const totalExpenseAmount = grossPay + additions + npsEmployerAmount;
      
      // Build transaction lines for proper double-entry accounting
      // Debit: Salary Expense Account (total cost to company)
      if (totalExpenseAmount > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: expenseAccount.id,
          debitAmount: totalExpenseAmount,
          creditAmount: 0,
          description: `Payroll expense for ${employee.name} - Gross: ${grossPay.toFixed(2)}, Benefits: ${additions.toFixed(2)}, Employer NPS: ${npsEmployerAmount.toFixed(2)}`
        });
      }

      // Note: PAYE will be added to transaction lines below (before validation)
      // This ensures the transaction balances correctly

      if (npsEmployeeAmount > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: npsEmployeeAccount.id,
          debitAmount: 0,
          creditAmount: npsEmployeeAmount,
          description: 'NPS employee contribution payable'
        });
      }

      if (npsEmployerAmount > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: npsEmployerAccount.id,
          debitAmount: 0,
          creditAmount: npsEmployerAmount,
          description: 'NPS employer contribution payable'
        });
      }

      // Credit Salary Advance Receivable (Asset) for advance deductions
      // This reduces the receivable when advances are deducted from payroll
      if (totalAdvanceDeductions > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: advanceReceivableAccount.id,
          debitAmount: 0,
          creditAmount: totalAdvanceDeductions,
          description: `Salary advance deductions (reduces receivable)`
        });
      }

      // Credit other deductions account only for non-advance deductions
      if (otherDeductionsExcludingAdvances > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: otherDeductionsAccount.id,
          debitAmount: 0,
          creditAmount: otherDeductionsExcludingAdvances,
          description: 'Other payroll deductions payable (excluding advances)'
        });
      }

      // Credit cash/payment account for net pay. Net pay already includes after-tax benefits/allowances.
      const totalCashPaid = netPay;
      if (totalCashPaid > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: paymentAccount.id,
          debitAmount: 0,
          creditAmount: totalCashPaid,
          description: `Net pay to employees (${getAccountDisplayName(paymentAccount)})`
        });
      }

      if (transactionLines.length > 0) {
        // Add PAYE to transaction lines if it exists
        // PAYE is a liability that needs to be credited in the main transaction
        // The tax service will also create a separate transaction for tracking, but we need it here for balance
        if (payeAmount > 0 && payeTaxType && payeTaxType.account) {
          transactionLines.push({
            lineNumber: transactionLines.length + 1,
            accountId: payeTaxType.account.id,
            debitAmount: 0,
            creditAmount: payeAmount,
            description: `PAYE tax liability for ${employee.name}`
          });
        }

        // Validate transaction balance before creating
        const { validateTransactionBalance } = await import('@/lib/accountingValidation');
        const balanceValidation = validateTransactionBalance(transactionLines);
        
        if (!balanceValidation.isValid) {
          console.error('❌ Payroll transaction does not balance:', balanceValidation.error);
          console.error('Transaction lines:', JSON.stringify(transactionLines, null, 2));
          console.error('Balance details:', {
            totalDebits: balanceValidation.totalDebits,
            totalCredits: balanceValidation.totalCredits,
            difference: balanceValidation.difference,
            employee: employee.name,
            grossPay,
            netPay,
            additions,
            payeAmount,
            npsEmployeeAmount,
            npsEmployerAmount,
            otherDeductionsExcludingAdvances,
            totalAdvanceDeductions
          });
          throw new Error(`Payroll transaction does not balance for ${employee.name}: ${balanceValidation.error}`);
        }

        await prisma.$transaction(async (tx) => {
          await assertPeriodOpen(user.tenantId, paymentDate, tx);
          const referenceNumber = await generateReferenceNumber(tx, user.tenantId, paymentDate);

          // Salaries are recorded on the date they are processed (paymentDate)
          const createdTransaction = await tx.transaction.create({
            data: {
              tenantId: user.tenantId,
              date: paymentDate,
              reference: referenceNumber,
              description: `Payroll for ${employee.name} - ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}`,
              entryType: 'Regular',
              status: 'posted',
              sourceType: 'Payroll',
              sourceId: payrollEntry.id,
              createdById: user.id,
              postedById: user.id,
              postedDate: new Date(),
              notes: `Enhanced payroll run with Malawi tax compliance`,
              lines: {
                create: transactionLines
              }
            },
            include: {
              lines: true
            }
          });

          for (const line of createdTransaction.lines) {
            await updateAccountBalanceOnTransaction(
              line.accountId,
              line.debitAmount,
              line.creditAmount,
              tx
            );
          }

          // PAYE is already included in the main transaction lines above for proper balance
          // We still track it via tax service for reconciliation, but it's part of the main balanced transaction
          // Note: The tax service creates a separate transaction, but for payroll we include PAYE in the main transaction
          // to ensure the balance sheet balances correctly
          if (payeAmount > 0) {
            if (!payeTaxType || !payeTaxType.account) {
              throw new Error(`PAYE tax type is required but not available for employee ${employee.name}. Cannot proceed with payroll processing.`);
            }

            // Log PAYE posting for audit purposes
            console.log(`✅ PAYE included in payroll transaction: ${payeAmount} for ${employee.name}, Account: ${payeTaxType.account.accountName}`);
            
            // Optional: Also create a tax tracking entry (but this should be balanced)
            // For now, we skip the separate tax transaction to avoid double-posting
            // The PAYE liability is already credited in the main transaction above
          }
        });
      }
    }

    // Create audit log entry
    const totalGrossPay = payrollEntries.reduce((sum, p) => sum + p.grossPay, 0);
    const totalPAYE = payrollEntries.reduce((sum, p) => sum + p.payeAmount, 0);
    const totalNPS = payrollEntries.reduce((sum, p) => sum + p.totalNpsAmount, 0);
    const totalNetPay = payrollEntries.reduce((sum, p) => sum + p.netPay, 0);

    await prisma.auditLog.create({
      data: {
        action: 'ENHANCED_PAYROLL_RUN_CREATED',
        entityType: 'PAYROLL',
        entityId: `PAY-${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          period: `${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`,
          employeeCount: employees.length,
          totalGrossPay,
          totalPAYE,
          totalNPS,
          totalNetPay
        })
      }
    });

    return NextResponse.json({
      message: 'Enhanced payroll run created successfully',
      payroll: {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        employeeCount: employees.length,
        totalGrossPay,
        totalPAYE,
        totalNPS,
        totalNetPay,
        entries: payrollEntries.length
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating enhanced payroll run:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // Provide more detailed error information in development
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
          meta: error.meta
        }
      : { message: error.message };
    
    return NextResponse.json(
      { 
        error: 'Failed to create enhanced payroll run', 
        details: error.message,
        ...errorDetails
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get or create required payroll accounts
 */
async function getOrCreatePayrollAccounts(tenantId) {
  const accounts = [];
  
  const accountNames = [
    'Salaries Expense',
    'PAYE Liability',
    'NPS Employee Contribution Liability',
    'NPS Employer Contribution Liability',
    'Payroll Deductions Liability',
    'Cash'
  ];

  for (const accountName of accountNames) {
    const accountCode = generateAccountCode(accountName);
    
    // First try to find by accountCode (most reliable)
    let account = await prisma.account.findFirst({
      where: {
        accountCode: accountCode,
        tenantId: tenantId
      }
    });

    // If not found by code, try exact match on name field
    if (!account) {
      account = await prisma.account.findFirst({
        where: {
          name: accountName,
          tenantId: tenantId
        }
      });
    }

    // If not found, try accountName field
    if (!account) {
      account = await prisma.account.findFirst({
        where: {
          accountName: accountName,
          tenantId: tenantId
        }
      });
    }

    // For Salaries Expense specifically, also check for variations (code 5230 - used in payroll)
    if (!account && accountName === 'Salaries Expense') {
      const salaryCandidates = await prisma.account.findMany({
        where: {
          tenantId: tenantId,
          isActive: true,
          OR: [
            { name: { contains: 'Salary', mode: 'insensitive' } },
            { accountName: { contains: 'Salary', mode: 'insensitive' } },
            { name: { contains: 'Wages', mode: 'insensitive' } },
            { accountName: { contains: 'Wages', mode: 'insensitive' } }
          ]
        }
      });
      const accType = (a) => ((a.accountType || a.type || '') + '').toLowerCase();
      account = salaryCandidates.find((a) => {
        const name = (a.accountName || a.name || '').toLowerCase();
        if (name.includes('cost of goods') || name.includes('cogs')) return false;
        return accType(a).includes('expense') || accType(a) === 'exp';
      }) || null;
      if (account && account.accountCode !== accountCode) {
        try {
          const code5230Account = await prisma.account.findFirst({
            where: { tenantId: tenantId, accountCode: accountCode, id: { not: account.id } }
          });
          if (code5230Account) {
            account = code5230Account;
          } else {
            account = await prisma.account.update({
              where: { id: account.id },
              data: { accountCode: accountCode, accountName: 'Salaries Expense', name: 'Salaries Expense' }
            });
          }
        } catch (updateErr) {
          const existing = await prisma.account.findFirst({
            where: { tenantId: tenantId, accountCode: accountCode }
          });
          if (existing) account = existing;
        }
      }
    }

    if (!account) {
      const accountType = getAccountType(accountName);
      const accountSubtype = getAccountSubtype(accountName);
      const properAccountType = convertAccountType(accountType);
      const normalBalance = (properAccountType === 'Asset' || properAccountType === 'Expense') ? 'Debit' : 'Credit';

      // Validate account code uniqueness before attempting to create
      const existingWithCode = await prisma.account.findFirst({
        where: {
          accountCode: accountCode,
          tenantId: tenantId
        }
      });

      if (existingWithCode) {
        // Account with this code already exists - use it instead of creating a new one
        console.warn(`⚠️ Account with code ${accountCode} already exists, using existing account`);
        account = existingWithCode;
      } else {
        try {
          account = await prisma.account.create({
            data: {
              code: accountCode,
              name: accountName,
              type: accountType,
              accountCode: accountCode,
              accountName: accountName,
              accountType: properAccountType,
              accountSubtype,
              normalBalance,
              balance: 0,
              tenantId: tenantId,
              isActive: true
            }
          });
          console.log(`✅ Created account: ${accountCode} - ${accountName}`);
        } catch (createError) {
          // If creation fails due to unique constraint, try to find the account again
          if (createError.code === 'P2002') {
            console.warn(`⚠️ Account with code ${accountCode} already exists (unique constraint), attempting to find it...`);
            account = await prisma.account.findFirst({
              where: {
                accountCode: accountCode,
                tenantId: tenantId
              }
            });
            
            if (!account) {
              // If still not found, check if it's a name-based constraint
              account = await prisma.account.findFirst({
                where: {
                  tenantId: tenantId,
                  OR: [
                    { accountName: accountName },
                    { name: accountName }
                  ]
                }
              });
              
              if (!account) {
                // If still not found, throw the original error
                throw new Error(`Failed to create account ${accountName} with code ${accountCode}. Account code may already be in use.`);
              }
            }
          } else {
            throw createError;
          }
        }
      }
    }

    if (!account) {
      throw new Error(`Could not find or create account: ${accountName} (code ${accountCode}). Add "${accountName}" in Chart of Accounts and try again.`);
    }
    accounts.push(account);
  }

  return accounts;
}

/**
 * Generate account code based on account name
 */
function generateAccountCode(accountName) {
  const codes = {
    'Salaries Expense': '5201',
    'PAYE Liability': '2130',
    'NPS Employee Contribution Liability': '2101',
    'NPS Employer Contribution Liability': '2102',
    'Payroll Deductions Liability': '2103',
    Cash: '1110',
  };
  
  return codes[accountName] || '9999';
}

/**
 * Get account type based on account name
 */
function getAccountType(accountName) {
  if (accountName.includes('Expense')) return 'EXPENSE';
  if (accountName.includes('Liability')) return 'LIABILITY';
  if (accountName === 'Cash') return 'ASSET';
  return 'LIABILITY';
}

function getAccountSubtype(accountName) {
  if (accountName === 'Cash') return 'Cash & Bank';
  if (accountName.includes('PAYE')) return 'Tax Payable';
  if (accountName.includes('NPS Employer')) return 'Payroll Liability';
  if (accountName.includes('NPS Employee')) return 'Payroll Liability';
  if (accountName.includes('Payroll Deductions')) return 'Payroll Liability';
  if (accountName.includes('Expense')) return 'Payroll Expense';
  return null;
}

function convertAccountType(legacyType) {
  if (!legacyType) return null;
  const upper = legacyType.toUpperCase();
  switch (upper) {
    case 'EXPENSE':
      return 'Expense';
    case 'ASSET':
      return 'Asset';
    case 'LIABILITY':
      return 'Liability';
    case 'EQUITY':
      return 'Equity';
    case 'REVENUE':
    case 'INCOME':
      return 'Revenue';
    default:
      return legacyType;
  }
}

function getAccountDisplayName(account) {
  if (!account) return 'Account';
  return account.accountName || account.name || account.accountCode || account.code || 'Account';
}

function isExpenseAccount(account) {
  if (!account) return false;
  const type = (account.accountType || account.type || '').toUpperCase();
  return type === 'EXPENSE';
}

function isAssetAccount(account) {
  if (!account) return false;
  const type = (account.accountType || account.type || '').toUpperCase();
  return type === 'ASSET';
}

