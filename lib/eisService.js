import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { getBaseUrl, EIS_ENDPOINTS, EIS_VALIDATION, validateInvoiceData, generateEISInvoiceNumber } from '@/lib/eisConfig';

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
      baseUrl: getBaseUrl(),
      // Terminal/site info stored in EISConfiguration.settings JSON
      terminalId: config.settings?.terminalId || null,
      siteId: config.settings?.siteId || null,
      globalConfigVersion: config.settings?.globalConfigVersion || 0,
      taxpayerConfigVersion: config.settings?.taxpayerConfigVersion || 0,
      terminalConfigVersion: config.settings?.terminalConfigVersion || 0,
    };
  }

  // ── Generic fetch helper ──────────────────────────────────────

  async _request(url, { method = 'POST', token = null, body = null, headers = {}, signature = null } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    if (signature) reqHeaders['x-signature'] = signature;

    try {
      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({ statusCode: res.status }));
      return { ok: res.ok, status: res.status, data };
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
  }

  // ── Authentication ──────────────────────────────────────────────
  // MRA uses POST /api/v1/configuration/request-new-terminal-token
  // after initial activation. The token comes back in the activation response.

  async authenticate(tenantId) {
    const client = await this.getClient(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.REQUEST_NEW_TERMINAL_TOKEN}`;
    const { ok, data } = await this._request(url, {
      token: client.apiKey, // Use stored token/apiKey for renewal
    });

    if (!ok) {
      throw new Error(`MRA token renewal failed (${data.statusCode}): ${data.remark || 'Unknown error'}`);
    }
    return data.data; // The new token
  }

  // ── Onboarding ────────────────────────────────────────────────

  async activateTerminal(tenantId, activationData) {
    const client = await this.getClient(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.ACTIVATE_TERMINAL}`;

    const { ok, data } = await this._request(url, { body: activationData });

    if (!ok) {
      throw new Error(`Terminal activation failed: ${data.remark || JSON.stringify(data.errors || [])}`);
    }

    // Store terminal info in EISConfiguration.settings
    if (data.data) {
      await this._updateConfigSettings(tenantId, {
        terminalId: data.data.terminalId,
        siteId: data.data.siteId,
        token: data.data.token,
      });
    }

    return data;
  }

  async confirmTerminalActivation(tenantId, terminalId, signature) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.TERMINAL_ACTIVATED_CONFIRMATION}`;

    const { ok, data } = await this._request(url, {
      token,
      body: { terminalId },
      signature,
    });

    if (!ok) {
      throw new Error(`Terminal activation confirmation failed: ${data.remark || 'Unknown error'}`);
    }
    return data;
  }

  // ── Configuration ─────────────────────────────────────────────

  async getLatestConfigs(tenantId) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.GET_LATEST_CONFIGS}`;

    const { ok, data } = await this._request(url, { token });

    if (!ok) {
      throw new Error(`Failed to fetch configs: ${data.remark || 'Unknown error'}`);
    }

    // Persist config versions
    if (data.data) {
      const cfg = data.data;
      await this._updateConfigSettings(tenantId, {
        globalConfigVersion: cfg.globalConfiguration?.version || 0,
        taxpayerConfigVersion: cfg.taxpayerConfiguration?.version || 0,
        terminalConfigVersion: cfg.terminalConfiguration?.version || 0,
        latestConfig: cfg,
      });
    }

    return data;
  }

  // ── Sales Transaction (the core submission) ───────────────────

  /**
   * Build MRA SalesInvoice payload per swagger spec:
   * { invoiceHeader, invoiceLineItems[], invoiceSummary }
   */
  buildSalesInvoicePayload(invoice, tenant, client) {
    const tpin = tenant.tpin || tenant.settings?.tpin || '';
    const invoiceDate = invoice.invoiceDate instanceof Date
      ? invoice.invoiceDate : new Date(invoice.invoiceDate);

    const eisInvoiceNumber = tpin && EIS_VALIDATION.TPIN_REGEX.test(tpin.trim())
      ? generateEISInvoiceNumber(tpin.trim(), invoice.terminalPosition || '01', invoiceDate, invoice.sequenceNumber || 1)
      : invoice.invoiceNumber;

    // Build line items per MRA LineItemDto schema
    const invoiceLineItems = (invoice.items || []).map((item, idx) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice || item.price) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const lineTotal = qty * price;
      const discount = Number(item.discount || item.discountAmount) || 0;
      const netTotal = lineTotal - discount;
      const totalVAT = (netTotal * taxRate) / 100;

      return {
        id: idx + 1,
        productCode: item.productCode || item.productId || '',
        description: item.description || item.name || '',
        taxRateId: item.taxRateId || (taxRate === EIS_VALIDATION.STANDARD_VAT_RATE ? 'A' : taxRate === 0 ? 'B' : 'E'),
        unitPrice: price,
        quantity: qty,
        total: netTotal,
        totalVAT,
        discount,
        isProduct: item.isProduct !== undefined ? item.isProduct : true,
      };
    });

    // Build tax breakdown: group by taxRateId
    const taxGroups = {};
    invoiceLineItems.forEach(item => {
      const key = item.taxRateId || 'A';
      if (!taxGroups[key]) taxGroups[key] = { taxRateId: key, totalAmount: 0, totalVAT: 0 };
      taxGroups[key].totalAmount += item.total;
      taxGroups[key].totalVAT += item.totalVAT;
    });

    const taxBreakDown = Object.values(taxGroups).map(g => ({
      taxRateId: g.taxRateId,
      totalAmount: Number(g.totalAmount.toFixed(2)),
      totalVAT: Number(g.totalVAT.toFixed(2)),
    }));

    // Build levy breakdown if present
    const levyBreakDown = (invoice.levyBreakDown || []).map(l => ({
      levyId: l.levyId || '',
      totalAmount: Number(l.totalAmount) || 0,
      totalLevy: Number(l.totalLevy) || 0,
    }));

    const totalVAT = taxBreakDown.reduce((s, t) => s + t.totalVAT, 0);
    const invoiceTotal = invoiceLineItems.reduce((s, i) => s + i.total, 0) + totalVAT;

    return {
      invoiceHeader: {
        invoiceNumber: eisInvoiceNumber,
        invoiceDateTime: invoiceDate.toISOString(),
        sellerTIN: tpin.trim(),
        siteId: client.siteId || invoice.siteId || '',
        globalConfigVersion: client.globalConfigVersion || 0,
        taxpayerConfigVersion: client.taxpayerConfigVersion || 0,
        terminalConfigVersion: client.terminalConfigVersion || 0,
        buyerTIN: invoice.customerTPIN || invoice.buyerTIN || '',
        buyerName: invoice.customerName || invoice.clientName || '',
        buyerAuthorizationCode: invoice.buyerAuthorizationCode || null,
        paymentMethod: invoice.paymentMethod || 'Cash',
        isExport: invoice.isExport || false,
        isReliefSupply: invoice.isReliefSupply || false,
        ...(invoice.isReliefSupply && invoice.vat5CertificateNumber ? {
          vat5CertificateDetails: {
            certificateNumber: invoice.vat5CertificateNumber,
          },
        } : {}),
      },
      invoiceLineItems,
      invoiceSummary: {
        taxBreakDown,
        ...(levyBreakDown.length > 0 ? { levyBreakDown } : {}),
        totalVAT: Number(totalVAT.toFixed(2)),
        invoiceTotal: Number(invoiceTotal.toFixed(2)),
        offlineSignature: invoice.offlineSignature || null,
        amountTendered: invoice.amountTendered || null,
      },
    };
  }

  /**
   * Legacy transform helpers — kept for internal use / backward compat.
   * These now delegate to buildSalesInvoicePayload.
   */
  transformInvoice(invoice, tenant, client = {}) {
    return this.buildSalesInvoicePayload(invoice, tenant, client);
  }

  transformSale(sale, tenant, client = {}) {
    return this.buildSalesInvoicePayload({
      invoiceNumber: sale.saleNumber || sale.invoiceNumber,
      invoiceDate: sale.date || sale.createdAt,
      customerName: sale.clientName || sale.customerName || 'Walk-in Customer',
      customerTPIN: sale.customerTPIN || '',
      customerAddress: sale.customerAddress || '',
      items: (sale.items || []).map(item => ({
        description: item.description || item.productName || item.name || '',
        productCode: item.productCode || item.productId || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice || item.price,
        taxRate: item.taxRate || 0,
        taxRateId: item.taxRateId || null,
        discount: item.discount || item.discountAmount || 0,
        isProduct: item.isProduct !== undefined ? item.isProduct : !item.isCustom,
      })),
      subtotal: sale.subtotal,
      taxTotal: sale.taxAmount || sale.taxTotal || 0,
      total: sale.total,
      currency: sale.currency,
      paymentMethod: sale.paymentMethod || 'Cash',
      isReliefSupply: sale.isReliefSupply || false,
      vat5CertificateNumber: sale.vat5CertificateNumber || null,
    }, tenant, client);
  }

  // ── Submit sales transaction ──────────────────────────────────

  async submitInvoice(tenantId, invoiceData, sourceType = null, sourceId = null) {
    // Phase 13 — unsafe legacy direct Sales path disabled.
    // New Sales must go through MraEis Phase 12 snapshot → Phase 13 transmission worker.
    if (process.env.MRA_EIS_ALLOW_LEGACY_DIRECT_SALES !== '1') {
      const err = new Error(
        'Legacy EIS submitInvoice is disabled. Use MRA EIS Phase 13 sales transmission (immutable fiscal snapshot).'
      );
      err.code = 'LEGACY_DIRECT_SALES_DISABLED';
      err.httpStatus = 410;
      throw err;
    }

    const startTime = Date.now();
    let token, payload, responseData, success = false;

    try {
      const tenant = await this.getTenant(tenantId);
      const client = await this.getClient(tenantId);
      token = await this.authenticate(tenantId);

      payload = sourceType === 'sale'
        ? this.transformSale(invoiceData, tenant, client)
        : this.transformInvoice(invoiceData, tenant, client);

      const localValidation = validateInvoiceData({
        invoiceNumber: payload.invoiceHeader.invoiceNumber,
        invoiceDate: payload.invoiceHeader.invoiceDateTime,
        seller: { tpin: payload.invoiceHeader.sellerTIN },
        items: payload.invoiceLineItems.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      });
      if (!localValidation.valid) {
        throw new Error(`Local validation failed: ${localValidation.errors.join('; ')}`);
      }

      const url = `${client.baseUrl}${EIS_ENDPOINTS.SUBMIT_SALES_TRANSACTION}`;
      const { ok, status, data } = await this._request(url, {
        token,
        body: payload,
        headers: client.apiKey ? { 'X-API-Key': client.apiKey } : {},
      });

      const duration = Date.now() - startTime;
      responseData = data;

      await this.logSubmission(tenantId, invoiceData.id || invoiceData.invoiceNumber, {
        requestPayload: payload,
        responsePayload: responseData,
        status: ok ? 'success' : 'error',
        errorCode: String(status),
        errorMessage: responseData.remark || null,
        durationMs: duration,
      });

      if (!ok) throw new Error(responseData.remark || `MRA submission failed (${status})`);
      success = true;

      const result = {
        success: true,
        submissionId: responseData.data?.submissionId || null,
        mraInvoiceId: responseData.data?.invoiceId || null,
        status: responseData.data?.status || 'Submitted',
        submittedAt: new Date().toISOString(),
      };

      const subscription = await prisma.accountSubscription.findFirst({
        where: { tenantId, isActive: true, plan: { in: ['eis-monthly', 'eis-yearly'] } }
      });

      await prisma.eISInvoice.create({
        data: {
          tenantId,
          subscriptionId: subscription?.id || null,
          invoiceNumber: payload.invoiceHeader.invoiceNumber,
          mraInvoiceId: result.mraInvoiceId || null,
          invoiceDate: new Date(payload.invoiceHeader.invoiceDateTime),
          totalAmount: payload.invoiceSummary.invoiceTotal,
          taxAmount: payload.invoiceSummary.totalVAT,
          status: result.status,
          submissionId: result.submissionId || null,
          submittedAt: new Date(),
          responseData: responseData,
          sourceType: sourceType || null,
          sourceId: sourceId || null,
        }
      });

      await this.updateUsageStats(tenantId, result.status, payload.invoiceSummary.invoiceTotal);
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
              sourceId: sourceId || null,
            }
          });
        } catch (dbErr) {
          console.error('Failed to save EIS error record:', dbErr.message);
        }
      }

      if (payload) {
        await this.logSubmission(tenantId, invoiceData.id || invoiceData.invoiceNumber || 'unknown', {
          requestPayload: payload,
          responsePayload: { error: error.message },
          status: 'error',
          errorCode: 'EXCEPTION',
          errorMessage: error.message,
          durationMs: duration,
        });
      }

      console.error('EIS submitInvoice error:', error.message);
      throw error;
    }
  }

  // ── Last submitted transactions ───────────────────────────────

  async getLastSubmittedOnline(tenantId) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.LAST_SUBMITTED_ONLINE}`;
    const { ok, data } = await this._request(url, { token });
    if (!ok) throw new Error(`Failed to get last online transaction: ${data.remark || 'Unknown error'}`);
    return data;
  }

  async getLastSubmittedOffline(tenantId) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.LAST_SUBMITTED_OFFLINE}`;
    const { ok, data } = await this._request(url, { token });
    if (!ok) throw new Error(`Failed to get last offline transaction: ${data.remark || 'Unknown error'}`);
    return data;
  }

  // ── Utilities ─────────────────────────────────────────────────

  /** TC-INV-003: Ping server for server time */
  async ping(tenantId) {
    const client = await this.getClient(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.PING}`;
    const { ok, data } = await this._request(url);
    if (!ok) throw new Error(`Ping failed: ${data.remark || 'Unknown error'}`);
    // Response: { data: { serverDate: "..." } }
    return data;
  }

  /** TC-RS-016: Validate VAT 5 certificate with MRA */
  async validateVat5Certificate(tenantId, certificateData) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.VALIDATE_VAT5_CERTIFICATE}`;
    const { ok, data } = await this._request(url, { token, body: certificateData });
    if (!ok) throw new Error(`VAT5 certificate validation failed: ${data.remark || 'Unknown error'}`);
    return data;
  }

  /** TC-INV-014: Get terminal blocking message */
  async getTerminalBlockingMessage(tenantId) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    if (!client.terminalId) throw new Error('Terminal ID not configured');
    const url = `${client.baseUrl}${EIS_ENDPOINTS.GET_TERMINAL_BLOCKING_MESSAGE}`;
    const { ok, data } = await this._request(url, {
      token,
      body: { terminalId: client.terminalId },
    });
    if (!ok) throw new Error(`Terminal block check failed: ${data.remark || 'Unknown error'}`);
    // Response: { data: { isBlocked, blockingReason, blockedAt } }
    return data;
  }

  /** Check if terminal has been unblocked */
  async checkTerminalUnblockStatus(tenantId) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    if (!client.terminalId) throw new Error('Terminal ID not configured');
    const url = `${client.baseUrl}${EIS_ENDPOINTS.CHECK_TERMINAL_UNBLOCK_STATUS}`;
    const { ok, data } = await this._request(url, {
      token,
      body: { terminalId: client.terminalId },
    });
    if (!ok) throw new Error(`Terminal unblock check failed: ${data.remark || 'Unknown error'}`);
    return data;
  }

  /**
   * Combined terminal status check (used by sales flow).
   * Phase 17: fail-closed on MRA errors — never treat query failure as unblocked.
   */
  async checkTerminalStatus(tenantId) {
    try {
      const result = await this.getTerminalBlockingMessage(tenantId);
      const terminalData = result.data || {};
      return {
        blocked: terminalData.isBlocked === true,
        reason: terminalData.blockingReason || null,
        blockedAt: terminalData.blockedAt || null,
        lastChecked: new Date().toISOString(),
        statusKnown: true,
      };
    } catch (error) {
      console.error('EIS checkTerminalStatus error:', error.message);
      return {
        blocked: true,
        reason: 'TERMINAL_STATUS_UNKNOWN_FAIL_CLOSED',
        blockedAt: null,
        lastChecked: new Date().toISOString(),
        statusKnown: false,
        error: error.message,
        phase17: 'UNSAFE_FAIL_OPEN_DISABLED',
      };
    }
  }

  /** Validate buyer authorization code */
  async validateAuthorizationCode(tenantId, codeData) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.VALIDATE_AUTHORIZATION_CODE}`;
    const { ok, data } = await this._request(url, { token, body: codeData });
    if (!ok) throw new Error(`Authorization code validation failed: ${data.remark || 'Unknown error'}`);
    return data;
  }

  /** TC-INV-002: Get terminal site products from MRA */
  async getTerminalSiteProducts(tenantId) {
    const client = await this.getClient(tenantId);
    const tenant = await this.getTenant(tenantId);
    const token = await this.authenticate(tenantId);
    const tpin = tenant.tpin || '';
    if (!tpin || !client.siteId) throw new Error('TPIN and siteId are required for product sync');
    const url = `${client.baseUrl}${EIS_ENDPOINTS.GET_TERMINAL_SITE_PRODUCTS}`;
    const { ok, data } = await this._request(url, {
      token,
      body: { tin: tpin.trim(), siteId: client.siteId },
    });
    if (!ok) throw new Error(`Failed to get site products: ${data.remark || 'Unknown error'}`);
    return data;
  }

  /** Check product status with MRA */
  async getProductStatus(tenantId, productId) {
    const client = await this.getClient(tenantId);
    const tenant = await this.getTenant(tenantId);
    const token = await this.authenticate(tenantId);
    const tpin = tenant.tpin || '';
    const url = `${client.baseUrl}${EIS_ENDPOINTS.PRODUCT_STATUS}`;
    const { ok, data } = await this._request(url, {
      token,
      body: { productId, tin: tpin.trim() },
    });
    if (!ok) throw new Error(`Product status check failed: ${data.remark || 'Unknown error'}`);
    return data;
  }

  /** Upload initial inventory to MRA */
  async uploadInitialInventory(tenantId, products, isLastBatch = true) {
    const client = await this.getClient(tenantId);
    const tenant = await this.getTenant(tenantId);
    const token = await this.authenticate(tenantId);
    const tpin = tenant.tpin || '';
    const url = `${client.baseUrl}${EIS_ENDPOINTS.TAXPAYER_INITIAL_INVENTORY_UPLOAD}`;
    const { ok, data } = await this._request(url, {
      token,
      body: { tin: tpin.trim(), isLastBatch, products },
    });
    if (!ok) throw new Error(`Inventory upload failed: ${data.remark || 'Unknown error'}`);
    return data;
  }

  // ── Stock operations ──────────────────────────────────────────

  async getWarehouseInventory(tenantId, page = 1, pageSize = 50) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.WAREHOUSE_INVENTORY}?page=${page}&pageSize=${pageSize}`;
    const { ok, data } = await this._request(url, { method: 'GET', token });
    if (!ok) throw new Error(`Failed to get warehouse inventory: ${data.remark || 'Unknown error'}`);
    return data;
  }

  async transferInventory(tenantId, transferData) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.TRANSFER_INVENTORY}`;
    const { ok, data } = await this._request(url, { token, body: transferData });
    if (!ok) throw new Error(`Inventory transfer failed: ${data.remark || 'Unknown error'}`);
    return data;
  }

  async submitInformalPurchase(tenantId, purchaseData) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.SUBMIT_INFORMAL_PURCHASE}`;
    const { ok, data } = await this._request(url, { token, body: purchaseData });
    if (!ok) throw new Error(`Informal purchase submission failed: ${data.remark || 'Unknown error'}`);
    return data;
  }

  async submitStockAdjustment(tenantId, adjustmentData) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.SUBMIT_ADJUSTMENT}`;
    const { ok, data } = await this._request(url, { token, body: adjustmentData });
    if (!ok) throw new Error(`Stock adjustment failed: ${data.remark || 'Unknown error'}`);
    return data;
  }

  async getStockAdjustmentReasons(tenantId) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.GET_STOCK_ADJUSTMENT_REASONS}`;
    const { ok, data } = await this._request(url, { token });
    if (!ok) throw new Error(`Failed to get adjustment reasons: ${data.remark || 'Unknown error'}`);
    return data;
  }

  async getSuppliers(tenantId) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.GET_SUPPLIERS}`;
    const { ok, data } = await this._request(url, { token });
    if (!ok) throw new Error(`Failed to get suppliers: ${data.remark || 'Unknown error'}`);
    return data;
  }

  // ── Raw materials ─────────────────────────────────────────────

  async getRawMaterials(tenantId, page = 1, pageSize = 50) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.GET_RAW_MATERIAL}?page=${page}&pageSize=${pageSize}`;
    const { ok, data } = await this._request(url, { method: 'GET', token });
    if (!ok) throw new Error(`Failed to get raw materials: ${data.remark || 'Unknown error'}`);
    return data;
  }

  async submitRawMaterialConversion(tenantId, conversionData) {
    const client = await this.getClient(tenantId);
    const token = await this.authenticate(tenantId);
    const url = `${client.baseUrl}${EIS_ENDPOINTS.SUBMIT_CONVERSION}`;
    const { ok, data } = await this._request(url, { token, body: conversionData });
    if (!ok) throw new Error(`Raw material conversion failed: ${data.remark || 'Unknown error'}`);
    return data;
  }

  // ── Cron: sync pending statuses ─────────────────────────────────
  // MRA doesn't have a dedicated status-check endpoint in swagger;
  // we use last-submitted-online to verify the most recent state.

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
        const lastOnline = await this.getLastSubmittedOnline(inv.tenantId);
        const lastInvoice = lastOnline.data;
        if (lastInvoice && lastInvoice.status && lastInvoice.status !== inv.status) {
          await prisma.eISInvoice.update({
            where: { id: inv.id },
            data: {
              status: lastInvoice.status,
              mraInvoiceId: lastInvoice.mraInvoiceId || inv.mraInvoiceId,
              responseData: lastInvoice,
            }
          });
          if (lastInvoice.status === 'Approved' || lastInvoice.status === 'Rejected') {
            await this.updateUsageStats(inv.tenantId, lastInvoice.status, 0);
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

    const updateData = { submissionCount: { increment: 1 } };
    if (status === 'Approved') updateData.approvedCount = { increment: 1 };
    else if (status === 'Rejected') updateData.rejectedCount = { increment: 1 };
    if (amount > 0) updateData.totalAmount = { increment: amount };

    try {
      await prisma.eISUsage.upsert({
        where: { tenantId_monthYear: { tenantId, monthYear } },
        update: { invoiceCount: { increment: 1 }, ...updateData },
        create: {
          tenantId, monthYear,
          invoiceCount: 1, submissionCount: 1,
          approvedCount: status === 'Approved' ? 1 : 0,
          rejectedCount: status === 'Rejected' ? 1 : 0,
          totalAmount: amount || 0,
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

  // ── Health check (uses ping) ──────────────────────────────────

  async getHealthStatus() {
    const baseUrl = getBaseUrl();
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${baseUrl}${EIS_ENDPOINTS.PING}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      return {
        status: res.ok ? 'healthy' : 'unhealthy',
        mraConnected: res.ok,
        serverDate: data.data?.serverDate || null,
        latency: `${Date.now() - startTime}ms`,
        environment: process.env.EIS_ENVIRONMENT || 'sandbox',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        mraConnected: false,
        error: error.message,
        latency: `${Date.now() - startTime}ms`,
        environment: process.env.EIS_ENVIRONMENT || 'sandbox',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ── Internal helpers ──────────────────────────────────────────

  async _updateConfigSettings(tenantId, newSettings) {
    try {
      const config = await prisma.eISConfiguration.findFirst({
        where: { tenantId, isActive: true }
      });
      if (!config) return;

      const existingSettings = config.settings || {};
      await prisma.eISConfiguration.update({
        where: { id: config.id },
        data: {
          settings: { ...existingSettings, ...newSettings },
          lastSyncAt: new Date(),
        }
      });
    } catch (err) {
      console.error('EIS _updateConfigSettings error:', err.message);
    }
  }
}

const eisService = new EISService();
export default eisService;
