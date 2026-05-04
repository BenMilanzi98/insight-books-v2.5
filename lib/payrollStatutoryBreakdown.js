function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round(safeNumber(value) * 100) / 100;
}

export function parsePayrollNotes(notes) {
  if (!notes || typeof notes !== 'string') return {};
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRate(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return n;
  return Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
}

function splitStoredNpsTotal(total, employeeRatePercent, employerRatePercent) {
  const amount = safeNumber(total);
  if (amount <= 0) {
    return { employeeAmount: 0, employerAmount: 0 };
  }

  const employeeRate = safeNumber(employeeRatePercent);
  const employerRate = safeNumber(employerRatePercent);
  const rateTotal = employeeRate + employerRate;

  if (rateTotal <= 0) {
    return {
      employeeAmount: roundMoney(amount / 2),
      employerAmount: roundMoney(amount / 2),
    };
  }

  const employeeAmount = roundMoney((amount * employeeRate) / rateTotal);
  return {
    employeeAmount,
    employerAmount: roundMoney(amount - employeeAmount),
  };
}

export function getPayrollStatutoryBreakdown(payroll, options = {}) {
  const info = parsePayrollNotes(payroll?.notes);
  const fallbackEmployeeRate = normalizeRate(
    options.npsEmployeeRatePercent ?? options.employeeRatePercent,
    5,
  );
  const fallbackEmployerRate = normalizeRate(
    options.npsEmployerRatePercent ?? options.employerRatePercent,
    5,
  );

  const employeeRatePercent = normalizeRate(
    info.npsEmployeeRatePercent,
    fallbackEmployeeRate,
  );
  const employerRatePercent = normalizeRate(
    info.npsEmployerRatePercent,
    fallbackEmployerRate,
  );

  const storedTotalNps = safeNumber(payroll?.totalNpsAmount);
  const hasStoredSplit =
    info.npsEmployeeAmount !== undefined || info.npsEmployerAmount !== undefined;

  let npsEmployeeAmount = hasStoredSplit ? safeNumber(info.npsEmployeeAmount) : 0;
  let npsEmployerAmount = hasStoredSplit ? safeNumber(info.npsEmployerAmount) : 0;

  if (!hasStoredSplit && storedTotalNps > 0) {
    const split = splitStoredNpsTotal(storedTotalNps, employeeRatePercent, employerRatePercent);
    npsEmployeeAmount = split.employeeAmount;
    npsEmployerAmount = split.employerAmount;
  }

  if (options.excludeClearedEmployer && info.pensionClearedEmployer) {
    npsEmployerAmount = 0;
  }

  const totalNpsAmount =
    npsEmployeeAmount || npsEmployerAmount
      ? roundMoney(npsEmployeeAmount + npsEmployerAmount)
      : roundMoney(storedTotalNps);

  const sign = options.signed && payroll?.status === 'Reversed' ? -1 : 1;

  return {
    payeAmount: roundMoney(sign * safeNumber(payroll?.payeAmount)),
    npsEmployeeAmount: roundMoney(sign * npsEmployeeAmount),
    npsEmployerAmount: roundMoney(sign * npsEmployerAmount),
    totalNpsAmount: roundMoney(sign * totalNpsAmount),
    npsEmployeeRatePercent: employeeRatePercent,
    npsEmployerRatePercent: employerRatePercent,
    payeTaxableIncome: info.payeTaxableIncome ?? null,
    notes: info,
  };
}

export function sumPayrollStatutoryBreakdowns(payrolls = [], options = {}) {
  return payrolls.reduce(
    (acc, payroll) => {
      const statutory = getPayrollStatutoryBreakdown(payroll, options);
      acc.payeAmount += statutory.payeAmount;
      acc.npsEmployeeAmount += statutory.npsEmployeeAmount;
      acc.npsEmployerAmount += statutory.npsEmployerAmount;
      acc.totalNpsAmount += statutory.totalNpsAmount;
      return acc;
    },
    {
      payeAmount: 0,
      npsEmployeeAmount: 0,
      npsEmployerAmount: 0,
      totalNpsAmount: 0,
    },
  );
}
