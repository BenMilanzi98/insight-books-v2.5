/**
 * Accounting V2 — API request/response schemas (Zod).
 *
 * Server-side validation for every V2 accounting endpoint. Monetary amounts are
 * decimal STRINGS at the API boundary — floating-point JSON numbers are rejected
 * for authoritative commands. Database models are never exposed directly; responses
 * are shaped by these schemas.
 */

import { z } from 'zod';
import {
  AccountingSourceModule,
  AccountingEventType,
  PostingMode,
  AuditSeverity,
  ShadowComparisonStatus,
} from '../domain/enums.js';

const enumValues = (obj) => Object.values(obj);

export const decimalString = z
  .string()
  .regex(/^-?\d{1,15}(\.\d{1,2})?$/, 'Expected a decimal string with up to 2 decimal places');

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)');

export const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Expected an alpha-3 currency code');

export const idString = z.string().min(1).max(64);

export const paginationSchema = z.object({
  take: z.coerce.number().int().min(1).max(500).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const sourceReferenceSchema = z.object({
  sourceModule: z.enum(enumValues(AccountingSourceModule)),
  sourceType: z.string().min(1).max(64).refine((s) => !s.includes(':'), 'must not contain ":"'),
  sourceId: idString.refine((s) => !s.includes(':'), 'must not contain ":"'),
  sourceNumber: z.string().max(64).nullish(),
  eventType: z.enum(enumValues(AccountingEventType)),
  eventVersion: z.number().int().min(1).default(1),
  externalReference: z.string().max(128).nullish(),
  importBatchId: idString.nullish(),
  webhookEventId: idString.nullish(),
  description: z.string().max(500).nullish(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const journalLineSchema = z.object({
  accountId: idString,
  debit: decimalString.nullish(),
  credit: decimalString.nullish(),
  description: z.string().max(500).nullish(),
  dimensions: z.record(z.string(), z.string()).default({}),
});

export const postingCommandSchema = z.object({
  sourceReference: sourceReferenceSchema,
  transactionDate: isoDate,
  requestedPostingDate: isoDate.nullish(),
  currency: currencyCode.default('MWK'),
  exchangeRate: decimalString.default('1'),
  description: z.string().min(1).max(500),
  dimensions: z.record(z.string(), z.string()).default({}),
  lines: z.array(journalLineSchema).min(2).max(200).optional(),
});

export const postingResultSchema = z.object({
  accountingEventId: idString,
  postingMode: z.enum(enumValues(PostingMode)),
  status: z.string(),
  journalId: idString.nullable(),
  shadowJournalId: idString.nullable(),
  comparisonStatus: z.enum(enumValues(ShadowComparisonStatus)).nullable(),
  existingPosting: z.boolean(),
  requestId: z.string(),
  correlationId: z.string(),
  warnings: z.array(z.string()),
});

export const ledgerQuerySchema = z.object({
  startDate: isoDate,
  endDate: isoDate,
  branchId: idString.nullish(),
  accountId: idString.nullish(),
}).merge(paginationSchema.partial());

export const trialBalanceQuerySchema = z.object({
  startDate: isoDate,
  endDate: isoDate,
  branchId: idString.nullish(),
  includeZero: z.coerce.boolean().default(false),
});

export const shadowComparisonQuerySchema = z.object({
  status: z.enum(enumValues(ShadowComparisonStatus)).nullish(),
  severity: z.enum(enumValues(AuditSeverity)).nullish(),
  from: isoDate.nullish(),
  to: isoDate.nullish(),
}).merge(paginationSchema.partial());

export const flagChangeSchema = z.object({
  flagKey: z.string().min(1).max(64),
  tenantId: idString.or(z.literal('*')).default('*'),
  moduleKey: z.enum(enumValues(AccountingSourceModule)).or(z.literal('*')).default('*'),
  eventType: z.enum(enumValues(AccountingEventType)).or(z.literal('*')).default('*'),
  enabled: z.boolean(),
  reason: z.string().min(3).max(500),
});

export const configurationChangeSchema = z.object({
  tenantId: idString,
  defaultPostingMode: z.enum(enumValues(PostingMode)).optional(),
  strictPeriodControl: z.boolean().optional(),
  requireJournalApproval: z.boolean().optional(),
  requireReversalApproval: z.boolean().optional(),
  useNewLedgerQueries: z.boolean().optional(),
  enableShadowAccounting: z.boolean().optional(),
  enableIntegrityMonitoring: z.boolean().optional(),
  reason: z.string().min(3).max(500),
});
