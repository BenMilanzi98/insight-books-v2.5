// app/api/payroll/enhanced/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { calculateMalawiPayroll } from '@/lib/malawiTaxUtils';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { generateReferenceNumber } from '@/lib/journalService';

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

    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();

    // Validate date range
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
        tenantId: user.tenantId
      }
    });

    if (existingPayroll) {
      return NextResponse.json(
        { error: 'A payroll run already exists for this period' },
        { status: 400 }
      );
    }

    // Get all active employees with their attendance records
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
        }
      }
    });

    // Tenant-level NPS rates (percentage points). Defaults to 5%/5% if not set.
    // Use raw SQL so payroll processing still works even if Prisma Client is stale.
    let npsRates = { employeeRatePercent: 5, employerRatePercent: 5 };
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        npsRates = {
          employeeRatePercent: Number(row.npsEmployeeRatePercent ?? 5) || 5,
          employerRatePercent: Number(row.npsEmployerRatePercent ?? 5) || 5,
        };
      }
    } catch (e) {
      console.warn('Payroll raw NPS rate read failed, falling back to defaults:', e?.message || e);
    }

    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees found' },
        { status: 400 }
      );
    }

    // Get or create required accounts/liabilities
    const payrollAccounts = await getOrCreatePayrollAccounts(user.tenantId);

    const [
      selectedExpenseAccount,
      selectedPaymentAccount
    ] = await Promise.all([
      expenseAccountId
        ? prisma.account.findFirst({ where: { id: expenseAccountId, tenantId: user.tenantId } })
        : null,
      paymentAccountId
        ? prisma.account.findFirst({ where: { id: paymentAccountId, tenantId: user.tenantId } })
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

    if (paymentAccountId && !selectedPaymentAccount) {
      return NextResponse.json(
        { error: 'Selected payment account was not found' },
        { status: 400 }
      );
    }

    if (selectedPaymentAccount && !isAssetAccount(selectedPaymentAccount)) {
      return NextResponse.json(
        { error: 'Selected payment account must be an Asset (cash/bank) account' },
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
    const paymentAccount =
      selectedPaymentAccount || findAccountByName('Cash');
    const payeAccount = findAccountByName('PAYE Liability');
    const npsEmployeeAccount = findAccountByName('NPS Employee Contribution Liability');
    const npsEmployerAccount = findAccountByName('NPS Employer Contribution Liability');
    const otherDeductionsAccount = findAccountByName('Payroll Deductions Liability');

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
        let deductionIds = [];

        if (Array.isArray(employee.selectedDeductions)) {
          deductionIds = employee.selectedDeductions;
        } else if (typeof employee.selectedDeductions === 'object') {
          if (Object.values(employee.selectedDeductions).every(v => typeof v === 'number')) {
            otherDeductions = employee.selectedDeductions;
          } else {
            deductionIds = Object.values(employee.selectedDeductions).filter(id => typeof id === 'string');
          }
        }

        if (deductionIds.length > 0) {
          const deductions = await prisma.deduction.findMany({
            where: {
              id: { in: deductionIds },
              tenantId: user.tenantId,
              isActive: true
            }
          });

          deductions.forEach(deduction => {
            // Check if this is PAYE deduction (by name or isStatutory flag)
            const isPAYE = deduction.name && (
              deduction.name.toLowerCase().includes('paye') || 
              deduction.name.toLowerCase().includes('income tax') ||
              (deduction.isStatutory && deduction.name.toLowerCase().includes('tax'))
            );
            
            // Check if this is NPS deduction
            const isNPS = deduction.name && (
              deduction.name.toLowerCase().includes('nps') || 
              deduction.name.toLowerCase().includes('pension')
            );
            
            if (isPAYE) {
              // PAYE is selected, will be calculated automatically
              applyPAYE = true;
            } else if (isNPS) {
              // NPS is selected
              applyNPS = true;
            } else if (deduction.amount) {
              otherDeductions[deduction.id] = Number(deduction.amount);
              deductionNames[deduction.id] = deduction.name;
            } else if (deduction.percentage && baseSalary > 0) {
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

      const payrollData = {
        basicSalary: baseSalary,
        allowances: {},
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
      
      // Calculate total deductions by adding all deduction components
      // This ensures deductions are properly accumulated before subtracting
      const totalDeductions = payeAmount + npsEmployeeAmount + otherDeductionsTotal;
      
      const grossPay = Number(payrollCalculation.totalGrossPay) || 0;
      const additions = Number(payrollCalculation.overtimePay) || 0;
      
      // Calculate net pay: Gross Pay - Total Deductions
      // Ensure net pay is never negative
      const netPay = Math.max(0, grossPay - totalDeductions);
      
      // Debug logging to verify calculation
      console.log(`Payroll Calculation for ${employee.name}:`, {
        basicSalary: baseSalary,
        additions: additions,
        grossPay: grossPay,
        payeAmount: payeAmount,
        npsEmployeeAmount: npsEmployeeAmount,
        otherDeductionsTotal: otherDeductionsTotal,
        totalDeductions: totalDeductions,
        netPay: netPay,
        calculation: `Net Pay = ${grossPay} - ${totalDeductions} = ${netPay}`
      });

      // Calculate total advance deductions for display
      const totalAdvanceDeductions = advanceDeductions.reduce((sum, ad) => sum + ad.amount, 0);

      const additionalInfo = {
        allowances: payrollCalculation.allowances || {},
        otherDeductions: payrollCalculation.otherDeductions || {},
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
        // Store the NPS rates actually used for this payroll run (percentage points)
        npsEmployeeRatePercent: npsRates.employeeRatePercent,
        npsEmployerRatePercent: npsRates.employerRatePercent,
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

      // Create expense record for this payroll entry
      // Use periodEnd date so expenses appear in the correct month
      const expenseDate = periodEnd;
      const salaryExpenseAmount = grossPay + additions + npsEmployerAmount;
      
      if (salaryExpenseAmount > 0) {
        // Create expense record with Salary category
        const expense = await prisma.expense.create({
          data: {
            description: `Payroll for ${employee.name} - ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}`,
            amount: salaryExpenseAmount,
            date: expenseDate, // Use periodEnd so it appears in the correct month
            category: 'Salary',
            paymentMethod: getAccountDisplayName(paymentAccount),
            sourceAccountId: paymentAccount.id,
            status: 'Approved', // Payroll expenses are automatically approved when posted
            paymentStatus: 'Fully paid',
            paidAmount: salaryExpenseAmount,
            submittedById: user.id,
            tenantId: user.tenantId,
            notes: `Payroll expense: Gross Pay: ${grossPay.toFixed(2)}, Overtime: ${additions.toFixed(2)}, Employer NPS: ${npsEmployerAmount.toFixed(2)}`
          }
        });

        // Create payment record linked to the expense
        await prisma.payment.create({
          data: {
            tenantId: user.tenantId,
            amount: salaryExpenseAmount,
            paymentDate: paymentDate,
            paymentMethod: getAccountDisplayName(paymentAccount),
            type: 'expense',
            status: 'Completed',
            expenseId: expense.id,
            notes: `Payroll payment for ${employee.name} - Period: ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}`
          }
        });
      }

      const transactionLines = [];
      // Salary expense should include: gross pay (basic + allowances) + overtime + employer NPS contribution
      // This ensures all salary-related costs correctly hit expenses in accounts

      if (salaryExpenseAmount > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: expenseAccount.id,
          debitAmount: salaryExpenseAmount,
          creditAmount: 0,
          description: `Payroll expense for ${employee.name}`
        });
      }

      if (payeAmount > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: payeAccount.id,
          debitAmount: 0,
          creditAmount: payeAmount,
          description: 'PAYE withholding'
        });
      }

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

      if (otherDeductionsTotal > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: otherDeductionsAccount.id,
          debitAmount: 0,
          creditAmount: otherDeductionsTotal,
          description: 'Other payroll deductions payable'
        });
      }

      if (netPay > 0) {
        transactionLines.push({
          lineNumber: transactionLines.length + 1,
          accountId: paymentAccount.id,
          debitAmount: 0,
          creditAmount: netPay,
          description: `Net pay to employees (${getAccountDisplayName(paymentAccount)})`
        });
      }

      if (transactionLines.length > 0) {
        await prisma.$transaction(async (tx) => {
          const referenceNumber = await generateReferenceNumber(tx, user.tenantId, paymentDate);

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
    return NextResponse.json(
      { error: 'Failed to create enhanced payroll run', details: error.message },
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
    // First try exact match on name field
    let account = await prisma.account.findFirst({
      where: {
        name: accountName,
        tenantId: tenantId
      }
    });

    // If not found, try accountName field
    if (!account) {
      account = await prisma.account.findFirst({
        where: {
          accountName: accountName,
          tenantId: tenantId
        }
      });
    }

    // For Salaries Expense specifically, also check for variations
    if (!account && accountName === 'Salaries Expense') {
      account = await prisma.account.findFirst({
        where: {
          tenantId: tenantId,
          OR: [
            { name: { contains: 'Salary', mode: 'insensitive' } },
            { accountName: { contains: 'Salary', mode: 'insensitive' } }
          ],
          AND: [
            {
              OR: [
                { accountType: 'Expense' },
                { type: 'EXPENSE' },
                { type: 'Expense' }
              ]
            }
          ]
        }
      });
      
      // If found a salary account but it's not the exact name, verify it's not COGS
      if (account) {
        const accName = (account.accountName || account.name || '').toLowerCase();
        if (accName.includes('cost of goods') || accName.includes('cogs')) {
          // Skip this account, it's COGS, not salaries
          account = null;
        }
      }
    }

    if (!account) {
      const accountCode = generateAccountCode(accountName);
      const accountType = getAccountType(accountName);
      
      const accountSubtype = getAccountSubtype(accountName);
      const properAccountType = convertAccountType(accountType);
      const normalBalance = (properAccountType === 'Asset' || properAccountType === 'Expense') ? 'Debit' : 'Credit';

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
          tenantId: tenantId
        }
      });
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
    'Salaries Expense': '6000',
    'PAYE Liability': '2100',
    'NPS Employee Contribution Liability': '2101',
    'NPS Employer Contribution Liability': '2102',
    'Payroll Deductions Liability': '2103',
    'Cash': '1000'
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

