import { Prisma } from '@prisma/client';

/** PosCashDay columns added in 20260812010000_pos_till_float_funding */
export const POS_CASH_DAY_TILL_FLOAT_FIELDS = [
  'tillFloatAccountId',
  'openFundingJournalId',
  'closeSweepJournalId',
  'fundingCashAmount',
  'fundingCapitalAmount',
  'openCount',
  'reopenedAt',
];

let posCashDayFieldNames = null;

function posCashDayFieldSet() {
  if (posCashDayFieldNames) return posCashDayFieldNames;
  const model = Prisma.dmmf?.datamodel?.models?.find((m) => m.name === 'PosCashDay');
  posCashDayFieldNames = new Set((model?.fields ?? []).map((f) => f.name));
  return posCashDayFieldNames;
}

export function posCashDaySupports(fieldName) {
  return posCashDayFieldSet().has(fieldName);
}

export function posCashDaySupportsTillFloat() {
  return (
    posCashDaySupports('tillFloatAccountId') && posCashDaySupports('closeSweepJournalId')
  );
}

function isUnknownPosCashDayFieldError(error) {
  const msg = String(error?.message || '');
  if (!msg.includes('Unknown argument')) return false;
  if (msg.includes('`tillFloatAccount`')) return true;
  return POS_CASH_DAY_TILL_FLOAT_FIELDS.some((field) => msg.includes(`\`${field}\``));
}

export function stripTillFloatPosCashDayData(data = {}) {
  const next = { ...data };
  for (const field of POS_CASH_DAY_TILL_FLOAT_FIELDS) {
    delete next[field];
  }
  delete next.tillFloatAccount;
  return next;
}

/**
 * Retry PosCashDay writes without till-float columns when an older Prisma client
 * or pending migration rejects those fields.
 */
export async function posCashDayWrite(client, operation, args) {
  try {
    return await client.posCashDay[operation](args);
  } catch (error) {
    if (!isUnknownPosCashDayFieldError(error)) throw error;
    return client.posCashDay[operation]({
      ...args,
      data: stripTillFloatPosCashDayData(args.data),
    });
  }
}
