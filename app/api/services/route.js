import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { clampResolvedBranchToUserAccess } from '@/lib/branchAccess';
import { resolveDefaultRevenueAccountId } from '@/lib/defaultRevenueAccount';

const BILLING_TYPES = new Set(['fixed', 'hourly', 'daily']);

function isPrismaClientSchemaMismatch(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('unknown arg') ||
    msg.includes('unknown field') ||
    msg.includes('does not exist') ||
    (msg.includes('column') && msg.includes('product'))
  );
}

/**
 * Create service row; retries with slimmer payloads if Prisma client / DB mismatch on new columns.
 */
async function createServiceProduct(dataFull, dataWithoutBilling, dataBare) {
  try {
    return await prisma.product.create({ data: dataFull });
  } catch (err) {
    if (!isPrismaClientSchemaMismatch(err)) throw err;
    console.warn('[api/services] Retrying without billing/income fields:', err?.message);
    try {
      return await prisma.product.create({ data: dataWithoutBilling });
    } catch (err2) {
      if (!isPrismaClientSchemaMismatch(err2)) throw err2;
      console.warn('[api/services] Retrying bare service (isService + pricing only):', err2?.message);
      return prisma.product.create({ data: dataBare });
    }
  }
}

/**
 * POST /api/services — create a billable service stored as Product (isService=true).
 * Revenue account: always standard account **4000** when present (else 4100 / first income account).
 * No inventory / FIFO; stock level stays zero.
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!user.tenantId) {
      return NextResponse.json({ error: 'User must be associated with a tenant' }, { status: 400 });
    }

    const body = await request.json();
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    if (!name) {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }

    const billingType = String(body.serviceBillingType || body.billingType || 'fixed').toLowerCase();
    if (!BILLING_TYPES.has(billingType)) {
      return NextResponse.json(
        { error: 'Billing type must be fixed, hourly, or daily' },
        { status: 400 }
      );
    }

    const rate = parseFloat(body.rate ?? body.unitPrice ?? body.price);
    if (Number.isNaN(rate) || rate < 0) {
      return NextResponse.json({ error: 'Rate must be a non-negative number' }, { status: 400 });
    }

    const revenueAccountId = await resolveDefaultRevenueAccountId(prisma, user.tenantId);
    if (!revenueAccountId) {
      return NextResponse.json(
        {
          error:
            'Could not find a revenue account. Add account code 4000 (Revenue) in Chart of Accounts, then try again.',
        },
        { status: 400 }
      );
    }

    let desiredBranchId = body.branchId ?? null;
    if (desiredBranchId === '') desiredBranchId = null;
    if (desiredBranchId && typeof desiredBranchId !== 'string') {
      desiredBranchId = desiredBranchId?.id && typeof desiredBranchId.id === 'string' ? desiredBranchId.id : null;
    }
    let branchIdToSet = null;
    if (desiredBranchId && typeof desiredBranchId === 'string') {
      const branch = await prisma.branch.findFirst({
        where: { id: desiredBranchId, tenantId: user.tenantId, isActive: true },
        select: { id: true },
      });
      if (branch) branchIdToSet = desiredBranchId;
    }
    try {
      branchIdToSet = clampResolvedBranchToUserAccess(user, branchIdToSet);
    } catch (branchAccessErr) {
      return NextResponse.json(
        { error: branchAccessErr.message || 'Branch not allowed' },
        { status: 403 }
      );
    }

    const duplicateName = await prisma.product.findFirst({
      where: {
        tenantId: user.tenantId,
        isDeleted: false,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true, name: true, sku: true, isService: true },
    });
    if (duplicateName) {
      return NextResponse.json(
        {
          error: `An item with this name already exists${duplicateName.isService ? ' (service)' : ' (product)'}${duplicateName.sku ? ` — code: ${duplicateName.sku}` : ''}.`,
        },
        { status: 400 }
      );
    }

    let finalSku = body.sku != null ? String(body.sku).trim() : undefined;
    if (finalSku === '') finalSku = undefined;
    if (finalSku) {
      const existingActiveSku = await prisma.product.findFirst({
        where: { sku: finalSku, tenantId: user.tenantId, isDeleted: false },
        select: { id: true, name: true },
      });
      if (existingActiveSku) {
        return NextResponse.json(
          { error: `This service code is already used by "${existingActiveSku.name}".` },
          { status: 400 }
        );
      }
    }

    if (!finalSku) {
      const cleanBase = name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 12) || 'SRV';
      const last = await prisma.product.findFirst({
        where: { tenantId: user.tenantId, sku: { startsWith: `SVC-${cleanBase}` } },
        orderBy: { createdAt: 'desc' },
        select: { sku: true },
      });
      let n = 1;
      if (last?.sku) {
        const m = last.sku.match(/(\d+)$/);
        if (m) n = parseInt(m[1], 10) + 1;
      }
      finalSku = `SVC-${cleanBase}-${String(n).padStart(3, '0')}`;
      let clash = await prisma.product.findFirst({
        where: { sku: finalSku, tenantId: user.tenantId, isDeleted: false },
        select: { id: true },
      });
      while (clash && n < 9999) {
        n++;
        finalSku = `SVC-${cleanBase}-${String(n).padStart(3, '0')}`;
        clash = await prisma.product.findFirst({
          where: { sku: finalSku, tenantId: user.tenantId, isDeleted: false },
          select: { id: true },
        });
      }
    }

    let computedTaxRate = parseFloat(body.taxRate || 0);
    if (body.selectedTaxIds && Array.isArray(body.selectedTaxIds) && body.selectedTaxIds.length > 0) {
      const taxTypes = await prisma.taxType.findMany({
        where: { id: { in: body.selectedTaxIds }, tenantId: user.tenantId, status: 'Active' },
        select: { taxRate: true },
      });
      computedTaxRate = taxTypes.reduce((sum, tax) => sum + (parseFloat(tax.taxRate) || 0), 0);
    }

    let serviceDefaultQty = null;
    if (body.serviceDefaultQty !== undefined && body.serviceDefaultQty !== null && body.serviceDefaultQty !== '') {
      const q = parseFloat(body.serviceDefaultQty);
      if (!Number.isNaN(q) && q >= 0) {
        serviceDefaultQty = q;
      }
    }

    const baseMinimal = {
      name,
      sku: finalSku,
      description: body.description?.trim?.() ? String(body.description).trim() : null,
      category: body.category?.trim?.() ? String(body.category).trim() : 'Services',
      stockLevel: 0,
      reorderPoint: null,
      location: body.location?.trim?.() ? String(body.location).trim() : null,
      price: rate,
      cost: 0,
      taxRate: computedTaxRate,
      image: typeof body.image === 'string' ? body.image : null,
      isService: true,
      barcode: null,
      tenant: { connect: { id: user.tenantId } },
    };

    const dataFull = {
      ...baseMinimal,
      serviceBillingType: billingType,
      serviceDefaultQty,
      incomeAccountId: revenueAccountId,
    };

    const dataWithoutBilling = {
      ...baseMinimal,
      incomeAccountId: revenueAccountId,
    };

    const dataBare = { ...baseMinimal };

    if (branchIdToSet) {
      dataFull.branch = { connect: { id: branchIdToSet } };
      dataWithoutBilling.branch = { connect: { id: branchIdToSet } };
      dataBare.branch = { connect: { id: branchIdToSet } };
    }

    const product = await createServiceProduct(dataFull, dataWithoutBilling, dataBare);

    await prisma.auditLog.create({
      data: {
        action: 'SERVICE_CREATED',
        entityType: 'PRODUCT',
        entityId: product.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: product.name,
          sku: product.sku,
          serviceBillingType: billingType,
          revenueAccountId,
        }),
      },
    });

    return NextResponse.json(
      {
        message: 'Service created successfully',
        product: {
          ...product,
          quantityInStock: 0,
          unitPrice: product.price,
          costPrice: 0,
          status: 'Service',
          imageUrl: product.image || `/api/placeholder/80/80`,
          lastUpdated: product.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating service:', error);
    const msg = error?.message || 'Failed to create service';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
