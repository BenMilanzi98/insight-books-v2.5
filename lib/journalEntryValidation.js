import { z } from 'zod';

const FLOAT_TOLERANCE = 0.0001;

const coerceDate = z.preprocess((value) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}, z.date({ required_error: 'entryDate is required.' }));

const journalEntryLineSchema = z
  .object({
    accountId: z.string().min(1, 'accountId is required.'),
    debitAmount: z.number().min(0, 'debitAmount cannot be negative.').default(0),
    creditAmount: z.number().min(0, 'creditAmount cannot be negative.').default(0),
    description: z.string().max(512).optional(),
  })
  .superRefine((data, ctx) => {
    const debit = data.debitAmount ?? 0;
    const credit = data.creditAmount ?? 0;

    if (debit > 0 && credit > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A journal line cannot have both debit and credit amounts.',
        path: ['debitAmount'],
      });
    }

    if (Math.abs(debit) < FLOAT_TOLERANCE && Math.abs(credit) < FLOAT_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each journal line must have either a debit or credit amount.',
        path: ['debitAmount'],
      });
    }
  });

const journalEntrySchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required.'),
  entryDate: coerceDate,
  description: z.string().max(512).optional(),
  entryType: z
    .string()
    .min(1)
    .default('Regular'),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(journalEntryLineSchema).min(2, 'At least two lines are required.'),
});

export function validateJournalEntryPayload(payload) {
  const parsed = journalEntrySchema.parse(payload);

  const totals = parsed.lines.reduce(
    (acc, line) => {
      acc.debits += line.debitAmount ?? 0;
      acc.credits += line.creditAmount ?? 0;
      return acc;
    },
    { debits: 0, credits: 0 }
  );

  if (Math.abs(totals.debits - totals.credits) > FLOAT_TOLERANCE) {
    throw new Error('Total debits must equal total credits.');
  }

  return {
    ...parsed,
    totals,
  };
}

export { journalEntrySchema, journalEntryLineSchema, FLOAT_TOLERANCE };











