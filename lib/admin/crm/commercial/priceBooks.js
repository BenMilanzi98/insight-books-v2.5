/**
 * CRM Price Books — Phase 15 Wave 2.
 * ACTIVE versions/entries immutable; approve + activate with SoD on approve.
 */

import { CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import { CRM_PRICE_BOOK_TYPE, CRM_PRICE_BOOK_VERSION_STATUS } from './catalogue.js';
import { allocatePriceBookNumber } from './numbering.js';
import {
  hasCrmPriceBookEntryModel,
  hasCrmPriceBookModel,
  hasCrmPriceBookVersionModel,
  resolveCommercialActor,
  serializePriceBook,
  serializePriceBookEntry,
  serializePriceBookVersion,
} from './model.js';

function canEdit(access) {
  return access.canEditOpportunities || access.canEditLeads || access.canCreateLeads;
}

function canApprove(access) {
  return access.canApproveMerge || access.canEditOpportunities || access.isSuperAdmin;
}

function isActiveOrImmutable(version) {
  return (
    version?.immutable === true ||
    String(version?.status || '').toUpperCase() === CRM_PRICE_BOOK_VERSION_STATUS.ACTIVE
  );
}

export async function createPriceBook(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEdit(access)) {
    return { ok: false, forbidden: true, reason: 'crm_price_book_create_forbidden' };
  }
  if (
    !hasCrmPriceBookModel(prisma) ||
    !hasCrmPriceBookVersionModel(prisma) ||
    !hasCrmPriceBookEntryModel(prisma)
  ) {
    return { ok: false, error: 'crm_price_book_model_unavailable', status: 'UNAVAILABLE' };
  }

  const now = args.now || new Date();
  const allocated = await allocatePriceBookNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'price_book_number_allocation_failed' };
  }

  const bookType = String(args.bookType || CRM_PRICE_BOOK_TYPE.STANDARD)
    .trim()
    .toUpperCase();
  const currency = args.currency ? String(args.currency).trim().toUpperCase() : null;

  const book = await prisma.crmPriceBook.create({
    data: {
      bookNumber: allocated.number,
      name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
      bookType,
      currency,
      status: 'DRAFT',
      latestVersionNumber: 1,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  const version = await prisma.crmPriceBookVersion.create({
    data: {
      priceBookId: book.id,
      versionNumber: 1,
      status: CRM_PRICE_BOOK_VERSION_STATUS.DRAFT,
      immutable: false,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  const entryInputs = Array.isArray(args.entries) ? args.entries : [];
  const entries = [];
  for (const e of entryInputs) {
    const row = await prisma.crmPriceBookEntry.create({
      data: {
        priceBookVersionId: version.id,
        productRef: String(e.productRef || '').trim(),
        unit: e.unit != null ? String(e.unit).trim() : null,
        listPrice: Number(e.listPrice),
        minPrice: e.minPrice != null ? Number(e.minPrice) : Number(e.listPrice),
        currency: e.currency
          ? String(e.currency).trim().toUpperCase()
          : currency,
        billingFrequency: e.billingFrequency
          ? String(e.billingFrequency).trim().toUpperCase()
          : 'MONTHLY',
        taxCategory: e.taxCategory != null ? String(e.taxCategory).trim() : null,
        createdAt: now,
        updatedAt: now,
      },
    });
    entries.push(row);
  }

  await prisma.crmPriceBook.update({
    where: { id: book.id },
    data: { currentVersionId: version.id, updatedAt: now },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: book.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.PRICE_BOOK_CREATED,
    summary: `Price Book ${book.bookNumber} created`,
    payload: { priceBookId: book.id, versionId: version.id },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    priceBook: serializePriceBook({ ...book, currentVersionId: version.id }),
    version: serializePriceBookVersion(version),
    entries: entries.map(serializePriceBookEntry),
  };
}

export async function approvePriceBookVersion(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canApprove(access)) {
    return { ok: false, forbidden: true, reason: 'crm_price_book_approve_forbidden' };
  }
  if (!hasCrmPriceBookVersionModel(prisma)) {
    return { ok: false, error: 'crm_price_book_version_model_unavailable', status: 'UNAVAILABLE' };
  }

  const version = await prisma.crmPriceBookVersion.findUnique({
    where: { id: String(args.priceBookVersionId || '').trim() },
  });
  if (!version) return { ok: false, notFound: true, error: 'price_book_version_not_found' };

  const approverId = admin?.id ? String(admin.id) : '';
  const authorId = version.createdByAdminId ? String(version.createdByAdminId) : '';
  if (authorId && approverId && authorId === approverId) {
    return {
      ok: false,
      error: 'price_book_self_approval_blocked',
      reason: 'sod_author_must_differ_from_approver',
    };
  }

  const status = String(version.status || '').toUpperCase();
  if (status === CRM_PRICE_BOOK_VERSION_STATUS.APPROVED || status === CRM_PRICE_BOOK_VERSION_STATUS.ACTIVE) {
    return { ok: true, alreadyExists: true, version: serializePriceBookVersion(version) };
  }
  if (
    status !== CRM_PRICE_BOOK_VERSION_STATUS.DRAFT &&
    status !== CRM_PRICE_BOOK_VERSION_STATUS.PENDING_APPROVAL
  ) {
    return { ok: false, error: 'price_book_version_not_approvable', status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmPriceBookVersion.update({
    where: { id: version.id },
    data: {
      status: CRM_PRICE_BOOK_VERSION_STATUS.APPROVED,
      approvedByAdminId: approverId || null,
      approvedAt: now,
      updatedAt: now,
    },
  });

  return { ok: true, version: serializePriceBookVersion(updated) };
}

export async function activatePriceBookVersion(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canApprove(access)) {
    return { ok: false, forbidden: true, reason: 'crm_price_book_activate_forbidden' };
  }
  if (!hasCrmPriceBookVersionModel(prisma) || !hasCrmPriceBookEntryModel(prisma)) {
    return { ok: false, error: 'crm_price_book_version_model_unavailable', status: 'UNAVAILABLE' };
  }

  const version = await prisma.crmPriceBookVersion.findUnique({
    where: { id: String(args.priceBookVersionId || '').trim() },
  });
  if (!version) return { ok: false, notFound: true, error: 'price_book_version_not_found' };

  const status = String(version.status || '').toUpperCase();
  if (status === CRM_PRICE_BOOK_VERSION_STATUS.ACTIVE) {
    const entries = await prisma.crmPriceBookEntry.findMany({
      where: { priceBookVersionId: version.id },
    });
    return {
      ok: true,
      alreadyExists: true,
      version: serializePriceBookVersion(version),
      entries: entries.map(serializePriceBookEntry),
    };
  }
  if (status !== CRM_PRICE_BOOK_VERSION_STATUS.APPROVED) {
    return { ok: false, error: 'price_book_version_must_be_approved', status };
  }

  const now = args.now || new Date();
  await prisma.crmPriceBookVersion.updateMany({
    where: {
      priceBookId: version.priceBookId,
      status: CRM_PRICE_BOOK_VERSION_STATUS.ACTIVE,
    },
    data: {
      status: CRM_PRICE_BOOK_VERSION_STATUS.RETIRED,
      immutable: true,
      updatedAt: now,
    },
  });

  const activated = await prisma.crmPriceBookVersion.update({
    where: { id: version.id },
    data: {
      status: CRM_PRICE_BOOK_VERSION_STATUS.ACTIVE,
      immutable: true,
      activatedAt: now,
      activatedByAdminId: admin?.id || null,
      updatedAt: now,
    },
  });

  if (hasCrmPriceBookModel(prisma)) {
    await prisma.crmPriceBook.update({
      where: { id: version.priceBookId },
      data: {
        currentVersionId: activated.id,
        status: CRM_PRICE_BOOK_VERSION_STATUS.ACTIVE,
        updatedAt: now,
      },
    });
  }

  const entries = await prisma.crmPriceBookEntry.findMany({
    where: { priceBookVersionId: activated.id },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: version.priceBookId,
    eventType: CRM_TIMELINE_EVENT_TYPE.PRICE_BOOK_VERSION_ACTIVATED,
    summary: `Price Book version ${activated.versionNumber} activated`,
    payload: { priceBookId: version.priceBookId, versionId: activated.id },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    version: serializePriceBookVersion(activated),
    entries: entries.map(serializePriceBookEntry),
  };
}

/**
 * Mutate a Price Book entry — blocked when parent version is ACTIVE/immutable.
 */
export async function updatePriceBookEntry(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEdit(access)) {
    return { ok: false, forbidden: true, reason: 'crm_price_book_entry_update_forbidden' };
  }
  if (!hasCrmPriceBookEntryModel(prisma) || !hasCrmPriceBookVersionModel(prisma)) {
    return { ok: false, error: 'crm_price_book_entry_model_unavailable', status: 'UNAVAILABLE' };
  }

  const entry = await prisma.crmPriceBookEntry.findUnique({
    where: { id: String(args.priceBookEntryId || '').trim() },
  });
  if (!entry) return { ok: false, notFound: true, error: 'price_book_entry_not_found' };

  const version = await prisma.crmPriceBookVersion.findUnique({
    where: { id: entry.priceBookVersionId },
  });
  if (!version) return { ok: false, notFound: true, error: 'price_book_version_not_found' };

  if (isActiveOrImmutable(version)) {
    return {
      ok: false,
      error: 'price_book_version_immutable',
      reason: 'ACTIVE_price_book_entry_cannot_be_edited',
    };
  }

  const data = { updatedAt: args.now || new Date() };
  if (args.listPrice != null) data.listPrice = Number(args.listPrice);
  if (args.minPrice != null) data.minPrice = Number(args.minPrice);
  if (args.unit != null) data.unit = String(args.unit).trim();
  if (args.billingFrequency != null) {
    data.billingFrequency = String(args.billingFrequency).trim().toUpperCase();
  }

  const updated = await prisma.crmPriceBookEntry.update({
    where: { id: entry.id },
    data,
  });
  return { ok: true, entry: serializePriceBookEntry(updated) };
}

export async function listPriceBooks(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!(access.canViewOpportunities || access.canViewLeads || access.canView || access.isSuperAdmin)) {
    return { ok: false, forbidden: true };
  }
  if (!hasCrmPriceBookModel(prisma)) {
    return { ok: false, error: 'crm_price_book_model_unavailable', status: 'UNAVAILABLE' };
  }
  const rows = await prisma.crmPriceBook.findMany({ where: {} });
  return {
    ok: true,
    priceBooks: rows.map(serializePriceBook),
    domain: { wave: 2 },
  };
}
