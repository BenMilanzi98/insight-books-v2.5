import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { getBaseUrl, EIS_ENDPOINTS, EIS_VALIDATION, validateInvoiceData } from '@/lib/eisConfig';

class EISService {
  constructor() {
    this.timeout = EIS_VALIDATION.REQUEST_TIMEOUT_MS;
  }

  // ── Tenant helpers ──────────────────────────────────────────────

  async getTenant(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true }
    });
    if (!tenant) throw new Error('Tenant not found');
    return tenant;
  }

  async getClient(tenantId) {
    const config = await prisma.eISConfiguration.findFirst({
      where: { tenantId, isActive: true }
    });
    if (!config) throw new Error('EIS configuration not found for tenant. Configure MRA credentials in /eis/config.');
    return {
      clientId: config.clientId,
      clientSecret: decrypt(config.clientSecret),
      apiKey: config.apiKey ? decrypt(config.apiKey) : null,
      environment: config.environment,
      baseUrl: getBaseUrl()
    };
  }

  // ── Authentication ──────────────────────────────────────────────

  async authenticate(tenantId) {
    const client = await this.getClient(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.AUTH_TOKEN}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.clientId,
          client_secret: client.clientSecret,
          grant_type: 'client_credentials'
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`MRA auth failed (${res.status}): ${err.message || res.statusText}`);
      }
      const data = await res.json();
      return data.access_token;
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
  }

  // ── Invoice transformation ──────────────────────────────────────

  transformInvoice(invoice, tenant) {
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: (invoice.invoiceDate instanceof Date
        ? invoice.invoiceDate : new Date(invoice.invoiceDate)
      ).toISOString().split('T')[0],
      seller: {
        name: tenant.name,
        tpin: tenant.tpin || tenant.settings?.tpin || '',
        address: tenant.settings?.businessAddress || '',
        email: tenant.settings?.businessEmail || tenant.email || '',
        phone: tenant.settings?.businessPhone || ''
      },
      buyer: {
        name: invoice.customerName || invoice.clientName || '',
        tpin: invoice.customerTPIN || '',
        address: invoice.customerAddress || ''
      },
      items: (invoice.items || []).map(item => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice || item.price) || 0;
        const taxRate = Number(item.taxRate) || 0;
        const lineTotal = qty * price;
        const taxAmount = (lineTotal * taxRate) / 100;
        return {
          description: item.description || item.name || '',
          quantity: qty,
          unitPrice: price,
          totalAmount: lineTotal,
          taxRate,
          taxAmount
        };
      }),
      totals: {
        subtotal: Number(invoice.subtotal) || 0,
        taxTotal: Number(invoice.taxTotal || invoice.taxAmount) || 0,
        total: Number(invoice.total) || 0
      },
      currency: invoice.currency || EIS_VALIDATION.CURRENCY,
      paymentMethod: invoice.paymentMethod || 'Cash'
    };
  }

  transformSale(sale, tenant) {
    return this.transformInvoice({
      invoiceNumber: sale.saleNumber || sale.invoiceNumber,
      invoiceDate: sale.date || sale.createdAt,
      customerName: sale.clientName || sale.customerName || 'Walk-in Customer',
      customerTPIN: sale.customerTPIN || '',
      customerAddress: sale.customerAddress || '',
      items: (sale.items || []).map(item => ({
        description: item.description || item.productName || item.name || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice || item.price,
        taxRate: item.taxRate || 0
      })),
      subtotal: sale.subtotal,
      taxTotal: sale.taxAmount || sale.taxTotal || 0,
      total: sale.total,
      currency: sale.currency,
      paymentMethod: sale.paymentMethod || 'Cash'
    }, tenant);
  }

  // ── Submission ──────────────────────────────────────────────────

  async submitInvoice(tenantId, invoiceData, sourceType = null, sourceId = null) {
    const startTime = Date.now();
    let token, transformed, responseData, success = false;

    try {
      const tenant = await this.getTenant(tenantId);
      const client = await this.getClient(tenantId);
      token = await this.authenticate(tenantId);

      transformed = sourceType === 'sale'
        ? this.transformSale(invoiceData, tenant)
        : this.transformInvoice(invoiceData, tenant);

      const localValidation = validateInvoiceData(transformed);
      if (!localValidation.valid) {
        throw new Error(`Local validation failed: ${localValidation.errors.join('; ')}`);
      }

      const url = `${client.baseUrl}${EIS_ENDPOINTS.INVOICES_SUBMIT}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(client.apiKey ? { 'X-API-Key': client.apiKey } : {})
        },
        body: JSON.stringify(transformed),
        signal: controller.signal
      });
      clearTimeout(timer);

      const duration = Date.now() - startTime;
      responseData = await res.json().catch(() => ({ status: res.status }));

      await this.logSubmission(tenantId, invoiceData.id || invoiceData.invoiceNumber, {
        requestPayload: transformed,
        responsePayload: responseData,
        status: res.ok ? 'success' : 'error',
        errorCode: String(res.status),
        errorMessage: responseData.message || null,
        durationMs: duration
      });

      if (!res.ok) throw new Error(responseData.message || `MRA submission failed (${res.status})`);
      success = true;

      const result = {
        success: true,
        submissionId: responseData.submissionId,
        mraInvoiceId: responseData.invoiceId,
        status: responseData.status || 'Submitted',
        submittedAt: new Date().toISOString()
      };

      const subscription = await prisma.accountSubscription.findFirst({
        where: { tenantId, isActive: true, plan: { in: ['eis-monthly', 'eis-yearly'] } }
      });

      await prisma.eISInvoice.create({
        data: {
          tenantId,
          subscriptionId: subscription?.id || null,
          invoiceNumber: transformed.invoiceNumber,
          mraInvoiceId: result.mraInvoiceId || null,
          invoiceDate: new Date(transformed.invoiceDate),
          totalAmount: transformed.totals.total,
          taxAmount: transformed.totals.taxTotal,
          status: result.status,
          submissionId: result.submissionId || null,
          submittedAt: new Date(),
          responseData: responseData,
          sourceType: sourceType || null,
          sourceId: sourceId || null
        }
      });

      await this.updateUsageStats(tenantId, result.status, transformed.totals.total);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (!success) {
        try {
          await prisma.eISInvoice.create({
            data: {
              tenantId,
              invoiceNumber: invoiceData.invoiceNumber || invoiceData.saleNumber || `ERR-${Date.now()}`,
              invoiceDate: new Date(invoiceData.invoiceDate || invoiceData.date || new Date()),
              totalAmount: Number(invoiceData.total) || 0,
              taxAmount: Number(invoiceData.taxTotal || invoiceData.taxAmount) || 0,
              status: 'Error',
              errorMessage: error.message,
              retryCount: 0,
              sourceType: sourceType || null,
              sourceId: sourceId || null
            }
          });
        } catch (dbErr) {
          console.error('Failed to save EIS error record:', dbErr.message);
        }
      }

      if (transformed) {
        await this.logSubmission(tenantId, invoiceData.id || invoiceData.invoiceNumber || 'unknown', {
          requestPayload: transformed,
          responsePayload: { error: error.message },
          status: 'error',
          errorCode: 'EXCEPTION',
          errorMessage: error.message,
          durationMs: duration
        });
      }

      console.error('EIS submitInvoice error:', error.message);
      throw error;
    }
  }

  // ── Validation ──────────────────────────────────────────────────

  async validateInvoice(tenantId, invoiceData) {
    try {
      const tenant = await this.getTenant(tenantId);
      const client = await this.getClient(tenantId);
      const token = await this.authenticate(tenantId);
      const transformed = this.transformInvoice(invoiceData, tenant);

      const url = `${client.baseUrl}${EIS_ENDPOINTS.INVOICES_VALIDATE}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(client.apiKey ? { 'X-API-Key': client.apiKey } : {})
        },
        body: JSON.stringify(transformed),
        signal: controller.signal
      });
      clearTimeout(timer);
      return await res.json();
    } catch (error) {
      console.error('EIS validateInvoice error:', error.message);
      return { valid: false, errors: [error.message] };
    }
  }

  // ── Status check ────────────────────────────────────────────────

  async checkStatus(tenantId, submissionId) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.INVOICES_STATUS}/${submissionId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(client.apiKey ? { 'X-API-Key': client.apiKey } : {})
        },
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Status check failed (${res.status})`);
      return await res.json();
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
  }

  // ── Cron: sync pending statuses ─────────────────────────────────

  async syncInvoiceStatuses() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const pending = await prisma.eISInvoice.findMany({
      where: {
        status: { in: ['Pending', 'Submitted'] },
        submissionId: { not: null },
        submittedAt: { lt: oneHourAgo }
      },
      take: 100
    });

    let synced = 0;
    for (const inv of pending) {
      try {
        const status = await this.checkStatus(inv.tenantId, inv.submissionId);
        if (status.status && status.status !== inv.status) {
          await prisma.eISInvoice.update({
            where: { id: inv.id },
            data: {
              status: status.status,
              mraInvoiceId: status.mraInvoiceId || inv.mraInvoiceId,
              responseData: status
            }
          });
          if (status.status === 'Approved' || status.status === 'Rejected') {
            await this.updateUsageStats(inv.tenantId, status.status, 0);
          }
          synced++;
        }
      } catch (err) {
        console.error(`EIS sync failed for invoice ${inv.id}:`, err.message);
      }
    }
    return { synced, total: pending.length };
  }

  // ── Usage stats ─────────────────────────────────────────────────

  async updateUsageStats(tenantId, status, amount = 0) {
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const updateData = {
      submissionCount: { increment: 1 }
    };
    if (status === 'Approved') updateData.approvedCount = { increment: 1 };
    else if (status === 'Rejected') updateData.rejectedCount = { increment: 1 };
    if (amount > 0) updateData.totalAmount = { increment: amount };

    try {
      await prisma.eISUsage.upsert({
        where: { tenantId_monthYear: { tenantId, monthYear } },
        update: {
          invoiceCount: { increment: 1 },
          ...updateData
        },
        create: {
          tenantId,
          monthYear,
          invoiceCount: 1,
          submissionCount: 1,
          approvedCount: status === 'Approved' ? 1 : 0,
          rejectedCount: status === 'Rejected' ? 1 : 0,
          totalAmount: amount || 0
        }
      });
    } catch (err) {
      console.error('EIS updateUsageStats error:', err.message);
    }
  }

  async getMonthlyUsage(tenantId) {
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const usage = await prisma.eISUsage.findUnique({
      where: { tenantId_monthYear: { tenantId, monthYear } }
    });
    return usage || { invoiceCount: 0, submissionCount: 0, approvedCount: 0, rejectedCount: 0, totalAmount: 0 };
  }

  // ── Logging ─────────────────────────────────────────────────────

  async logSubmission(tenantId, invoiceId, data) {
    try {
      await prisma.eISSubmissionLog.create({
        data: { tenantId, invoiceId: String(invoiceId), ...data }
      });
    } catch (err) {
      console.error('EIS logSubmission error:', err.message);
    }
  }

  // ── Health check ────────────────────────────────────────────────

  async getHealthStatus() {
    const baseUrl = getBaseUrl();
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${baseUrl}${EIS_ENDPOINTS.SYSTEM_HEALTH}`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timer);
      return {
        status: res.ok ? 'healthy' : 'unhealthy',
        mraConnected: res.ok,
        latency: `${Date.now() - startTime}ms`,
        environment: process.env.EIS_ENVIRONMENT || 'sandbox',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        mraConnected: false,
        error: error.message,
        latency: `${Date.now() - startTime}ms`,
        environment: process.env.EIS_ENVIRONMENT || 'sandbox',
        timestamp: new Date().toISOString()
      };
    }
  }
}

const eisService = new EISService();
export default eisService;
