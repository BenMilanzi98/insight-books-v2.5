const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_SALES_DAYS = 90;
const RECENT_SALES_LIMIT = 200;

function mapProduct(product) {
  const barcodeSet = new Set();
  if (product.barcode) barcodeSet.add(String(product.barcode).trim());
  for (const row of product.productBarcodes || []) {
    if (row.barcode) barcodeSet.add(String(row.barcode).trim());
  }

  const fields = { ...product };
  delete fields.productBarcodes;
  return {
    ...fields,
    quantity: Number(product.stockLevel ?? 0),
    barcodes: [...barcodeSet].filter(Boolean),
  };
}

function mapSaleForSnapshot(sale) {
  const saleDate = sale.saleDate ? new Date(sale.saleDate) : null;
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    date: saleDate ? saleDate.toISOString().split('T')[0] : null,
    subtotal: Number(sale.subtotal ?? 0),
    taxAmount: Number(sale.taxAmount ?? 0),
    total: Number(sale.total ?? 0),
    status: sale.status,
    paymentMethod: sale.paymentMethod,
    notes: sale.notes ?? null,
    clientId: sale.clientId ?? null,
    clientName: sale.client?.name ?? null,
    createdAt: sale.createdAt?.toISOString?.() ?? sale.createdAt,
    createdById: sale.createdById,
    createdByName: sale.createdBy?.name ?? 'User',
    items: (sale.items || []).map((item) => ({
      id: item.id,
      productId: item.productId ?? null,
      name: item.product?.name ?? item.description,
      productName: item.product?.name ?? item.description,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice ?? 0),
      price: Number(item.unitPrice ?? 0),
      amount: Number(item.amount ?? 0),
      isCustom: item.isCustom ?? false,
    })),
  };
}

export async function buildDesktopSnapshot({ prisma, tenantId, userId }) {
  const now = new Date();
  const recentPaymentCutoff = new Date(now.getTime() - 90 * DAY_MS);
  const recentSaleCutoff = new Date(now.getTime() - RECENT_SALES_DAYS * DAY_MS);
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      tenantId: true,
      isActive: true,
      status: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: true,
        },
      },
    },
  });

  if (!userRecord) {
    throw new Error('Snapshot user not found');
  }
  if (
    !userRecord.isActive ||
    String(userRecord.status || '').toLowerCase() === 'suspended'
  ) {
    throw new Error('Snapshot user is inactive');
  }

  const { isActive: _isActive, status: _status, ...sessionUser } = userRecord;
  sessionUser.tenantId = tenantId;

  const [
    membership,
    tenantSettings,
    customers,
    productRows,
    taxTypes,
    paymentAccounts,
    openInvoices,
    recentPayments,
    recentSales,
    cashDay,
  ] = await Promise.all([
    prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      select: {
        status: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
      },
    }),
    prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: {
        currencyCode: true,
        invoicePrefix: true,
        taxEnabled: true,
        defaultTaxRate: true,
        defaultLanguage: true,
      },
    }),
    prisma.client.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        additionalEmails: true,
        phone: true,
        address: true,
        contactPerson: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.product.findMany({
      where: { tenantId, isDeleted: false },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        sku: true,
        price: true,
        cost: true,
        stockLevel: true,
        isService: true,
        serviceBillingType: true,
        serviceDefaultQty: true,
        incomeAccountId: true,
        category: true,
        location: true,
        reorderPoint: true,
        image: true,
        barcode: true,
        categoryId: true,
        cogsAccountId: true,
        inventoryAccountId: true,
        taxRate: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        productBarcodes: {
          select: {
            barcode: true,
          },
        },
      },
    }),
    prisma.taxType.findMany({
      where: { tenantId, status: 'Active' },
      orderBy: { taxName: 'asc' },
      select: {
        id: true,
        taxId: true,
        taxName: true,
        taxCode: true,
        taxRate: true,
        calculationType: true,
        accountId: true,
        status: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    }),
    prisma.paymentAccount.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        accountType: true,
        reference: true,
        isActive: true,
        isSystem: true,
        coaAccountId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.invoice.findMany({
      where: {
        tenantId,
        isDeleted: false,
        status: {
          notIn: ['paid', 'Paid', 'void', 'Void', 'VOID', 'voided', 'Voided', 'VOIDED'],
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        title: true,
        orderNumber: true,
        clientId: true,
        createdById: true,
        issueDate: true,
        dueDate: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        status: true,
        notes: true,
        discount: true,
        remainingBalance: true,
        totalPaid: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            invoiceId: true,
            accountId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            taxRate: true,
            amount: true,
            productId: true,
            discountAmount: true,
            discountRate: true,
            netAmount: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        paymentDate: { gte: recentPaymentCutoff },
      },
      orderBy: { paymentDate: 'desc' },
      select: {
        id: true,
        invoiceId: true,
        saleId: true,
        amount: true,
        paymentDate: true,
        paymentMethod: true,
        reference: true,
        notes: true,
        status: true,
        destinationAccount: true,
        sourceAccount: true,
        type: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.sale.findMany({
      where: {
        tenantId,
        saleDate: { gte: recentSaleCutoff },
      },
      orderBy: { saleDate: 'desc' },
      take: RECENT_SALES_LIMIT,
      select: {
        id: true,
        saleNumber: true,
        saleDate: true,
        clientId: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        status: true,
        paymentMethod: true,
        notes: true,
        createdAt: true,
        createdById: true,
        client: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: {
          select: {
            id: true,
            productId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            amount: true,
            isCustom: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    prisma.posCashDay.findFirst({
      where: { tenantId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
      select: {
        id: true,
        branchKey: true,
        businessDate: true,
        status: true,
        systemCashAccountId: true,
        tillFloatAccountId: true,
        fundingCashAmount: true,
        fundingCapitalAmount: true,
        openCount: true,
        openingBalance: true,
        openedAt: true,
        openedById: true,
        reopenedAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  if (membership?.status === 'active' && membership.role) {
    sessionUser.role = membership.role;
  }

  return {
    version: 1,
    tenantId,
    sessionUser,
    tenantSettings: tenantSettings || {
      currencyCode: 'MWK',
      invoicePrefix: 'INV',
      taxEnabled: true,
      defaultTaxRate: 17.5,
      defaultLanguage: 'en',
    },
    customers,
    products: productRows.map(mapProduct),
    taxTypes,
    paymentAccounts,
    openInvoices,
    recentPayments,
    sales: recentSales.map(mapSaleForSnapshot),
    posConfig: { cashDay },
    serverNow: now.toISOString(),
  };
}
