export const POS_TILL_SOURCE = Object.freeze({
  OPEN: 'PosCashDayOpen',
  CLOSE: 'PosCashDayClose',
});

export function splitTillFunding(amountInput, cashAvailableInput) {
  const amount = Math.max(0, Number(amountInput) || 0);
  const cashAvailable = Math.max(0, Number(cashAvailableInput) || 0);
  if (amount <= 0) return { cashPart: 0, capitalPart: 0 };
  const cashPart = Math.min(amount, cashAvailable);
  const capitalPart = Math.max(0, amount - cashPart);
  return { cashPart, capitalPart };
}

export function posTillOpenSourceId(dayId, openCount) {
  // Accounting V2 idempotency keys forbid ":" inside identity segments.
  return `${dayId}_open_${Number(openCount) || 1}`;
}

export function posTillCloseSourceId(dayId, openCount) {
  return `${dayId}_close_${Number(openCount) || 1}`;
}

export function assertFundingSourcesAvailable({ capitalPart, capitalCoaId }) {
  if ((Number(capitalPart) || 0) > 0 && !capitalCoaId) {
    const err = new Error(
      'Owner Capital account is not mapped. Map OWNER_CAPITAL (e.g. 3100) before funding the till from Capital.'
    );
    err.code = 'CAPITAL_UNMAPPED';
    throw err;
  }
}

export function buildOpenFundingLines({
  tillCoaId,
  cashCoaId,
  capitalCoaId,
  cashPart,
  capitalPart,
}) {
  const cash = Math.max(0, Number(cashPart) || 0);
  const capital = Math.max(0, Number(capitalPart) || 0);
  const amount = cash + capital;
  if (amount <= 0) return { amount: 0, lines: [] };

  const lines = [];
  let n = 1;
  lines.push({
    lineNumber: n++,
    accountId: tillCoaId,
    debitAmount: amount,
    creditAmount: 0,
    description: 'POS till float funding in',
  });
  if (cash > 0) {
    lines.push({
      lineNumber: n++,
      accountId: cashCoaId,
      debitAmount: 0,
      creditAmount: cash,
      description: 'POS till float from Cash',
    });
  }
  if (capital > 0) {
    lines.push({
      lineNumber: n++,
      accountId: capitalCoaId,
      debitAmount: 0,
      creditAmount: capital,
      description: 'POS till float from Capital',
    });
  }
  return { amount, lines };
}

export function buildCloseSweepLines({ tillCoaId, cashCoaId, amount: amountInput }) {
  const amount = Math.max(0, Number(amountInput) || 0);
  if (amount <= 0) return { amount: 0, lines: [] };
  return {
    amount,
    lines: [
      {
        lineNumber: 1,
        accountId: cashCoaId,
        debitAmount: amount,
        creditAmount: 0,
        description: 'POS till close sweep in',
      },
      {
        lineNumber: 2,
        accountId: tillCoaId,
        debitAmount: 0,
        creditAmount: amount,
        description: 'POS till close sweep out',
      },
    ],
  };
}
