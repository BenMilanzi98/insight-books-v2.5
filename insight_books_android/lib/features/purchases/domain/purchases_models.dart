double _numOf(dynamic v) {
  if (v is num) return v.toDouble();
  return double.tryParse('$v') ?? 0;
}

int _intOf(dynamic v) => _numOf(v).round();

DateTime? _dateOf(dynamic v) {
  if (v == null) return null;
  if (v is DateTime) return v;
  return DateTime.tryParse('$v');
}

List<T> _parseList<T>(
  dynamic raw,
  T Function(Map<String, dynamic>) fromJson,
) {
  if (raw is! List) return const [];
  final List<T> items = [];
  for (final e in raw) {
    try {
      if (e is! Map) continue;
      items.add(fromJson(Map<String, dynamic>.from(e)));
    } catch (_) {
      continue;
    }
  }
  return items;
}

Map<String, dynamic>? _paginationOf(Map<String, dynamic> json) {
  final pagination = json['pagination'];
  if (pagination is Map) {
    return Map<String, dynamic>.from(pagination);
  }
  return null;
}

class PurchaseSupplier {
  const PurchaseSupplier({
    required this.id,
    required this.supplierName,
    this.supplierCode,
    this.contactPerson,
    this.email,
    this.phone,
    this.address,
    this.paymentTerms,
    this.paymentPreference,
    this.currency,
    this.notes,
    this.isActive = true,
    this.currentBalance = 0,
  });

  final String id;
  final String supplierName;
  final String? supplierCode;
  final String? contactPerson;
  final String? email;
  final String? phone;
  final String? address;
  final int? paymentTerms;
  final String? paymentPreference;
  final String? currency;
  final String? notes;
  final bool isActive;
  final double currentBalance;

  factory PurchaseSupplier.fromJson(Map<String, dynamic> json) {
    return PurchaseSupplier(
      id: '${json['id'] ?? ''}',
      supplierName: '${json['supplierName'] ?? ''}',
      supplierCode: json['supplierCode']?.toString(),
      contactPerson: json['contactPerson']?.toString(),
      email: json['email']?.toString(),
      phone: json['phone']?.toString() ?? json['mobile']?.toString(),
      address: json['address']?.toString(),
      paymentTerms: json['paymentTerms'] != null
          ? _intOf(json['paymentTerms'])
          : null,
      paymentPreference: json['paymentPreference']?.toString(),
      currency: json['currency']?.toString(),
      notes: json['notes']?.toString(),
      isActive: json['isActive'] != false,
      currentBalance: _numOf(json['currentBalance']),
    );
  }
}

class PurchaseOrderItem {
  const PurchaseOrderItem({
    required this.id,
    this.lineType = 'goods',
    this.productId,
    this.productUnitId,
    this.expenseCategoryId,
    this.description,
    this.quantityOrdered = 0,
    this.quantityReceived = 0,
    this.unitCost = 0,
    this.taxTypeId,
    this.taxRate = 0,
    this.taxAmount = 0,
    this.productName,
    this.productSku,
  });

  final String id;
  final String lineType;
  final String? productId;
  final String? productUnitId;
  final String? expenseCategoryId;
  final String? description;
  final double quantityOrdered;
  final double quantityReceived;
  final double unitCost;
  final String? taxTypeId;
  final double taxRate;
  final double taxAmount;
  final String? productName;
  final String? productSku;

  factory PurchaseOrderItem.fromJson(Map<String, dynamic> json) {
    String? productName;
    String? productSku;
    final product = json['product'];
    if (product is Map) {
      productName = product['name']?.toString();
      productSku = product['sku']?.toString();
    }

    return PurchaseOrderItem(
      id: '${json['id'] ?? ''}',
      lineType: '${json['lineType'] ?? 'goods'}',
      productId: json['productId']?.toString(),
      productUnitId: json['productUnitId']?.toString(),
      expenseCategoryId: json['expenseCategoryId']?.toString(),
      description: json['description']?.toString(),
      quantityOrdered: _numOf(
        json['quantityOrdered'] ?? json['quantityReceivedEffective'],
      ),
      quantityReceived: _numOf(
        json['quantityReceived'] ?? json['quantityReceivedEffective'],
      ),
      unitCost: _numOf(json['unitCost']),
      taxTypeId: json['taxTypeId']?.toString(),
      taxRate: _numOf(json['taxRate']),
      taxAmount: _numOf(json['taxAmount']),
      productName: productName,
      productSku: productSku,
    );
  }
}

class PurchaseOrder {
  const PurchaseOrder({
    required this.id,
    required this.poNumber,
    required this.supplierId,
    this.supplierName,
    this.supplierCode,
    this.status = 'Draft',
    this.orderType = 'goods',
    this.poDate,
    this.expectedDeliveryDate,
    this.subtotal = 0,
    this.taxAmount = 0,
    this.totalAmount = 0,
    this.pricesIncludeTax = false,
    this.notes,
    this.currency,
    this.supplierInvoiceUrl,
    this.items = const [],
  });

  final String id;
  final String poNumber;
  final String supplierId;
  final String? supplierName;
  final String? supplierCode;
  final String status;
  final String orderType;
  final DateTime? poDate;
  final DateTime? expectedDeliveryDate;
  final double subtotal;
  final double taxAmount;
  final double totalAmount;
  final bool pricesIncludeTax;
  final String? notes;
  final String? currency;
  final String? supplierInvoiceUrl;
  final List<PurchaseOrderItem> items;

  bool get isLocked =>
      items.any((line) => line.quantityReceived > 0);

  factory PurchaseOrder.fromJson(Map<String, dynamic> json) {
    String? supplierName = json['supplierName']?.toString();
    String? supplierCode;
    final supplier = json['supplier'];
    if (supplier is Map) {
      supplierName ??= supplier['supplierName']?.toString();
      supplierCode = supplier['supplierCode']?.toString();
    }

    return PurchaseOrder(
      id: '${json['id'] ?? ''}',
      poNumber: '${json['poNumber'] ?? ''}',
      supplierId: '${json['supplierId'] ?? ''}',
      supplierName: supplierName,
      supplierCode: supplierCode,
      status: '${json['status'] ?? 'Draft'}',
      orderType: '${json['orderType'] ?? 'goods'}',
      poDate: _dateOf(json['poDate']),
      expectedDeliveryDate: _dateOf(json['expectedDeliveryDate']),
      subtotal: _numOf(json['subtotal']),
      taxAmount: _numOf(json['taxAmount']),
      totalAmount: _numOf(json['totalAmount']),
      pricesIncludeTax: json['pricesIncludeTax'] == true,
      notes: json['notes']?.toString(),
      currency: json['currency']?.toString(),
      supplierInvoiceUrl: json['supplierInvoiceUrl']?.toString(),
      items: _parseList(json['items'], PurchaseOrderItem.fromJson),
    );
  }
}

class GoodsReceiptItem {
  const GoodsReceiptItem({
    required this.id,
    this.productId,
    this.productName,
    this.sku,
    this.quantityReceived = 0,
    this.unitCost = 0,
    this.purchaseOrderItemId,
  });

  final String id;
  final String? productId;
  final String? productName;
  final String? sku;
  final double quantityReceived;
  final double unitCost;
  final String? purchaseOrderItemId;

  factory GoodsReceiptItem.fromJson(Map<String, dynamic> json) {
    String? productName;
    String? sku;
    String? productId = json['productId']?.toString();
    final product = json['product'];
    if (product is Map) {
      productId ??= product['id']?.toString();
      productName = product['name']?.toString();
      sku = product['sku']?.toString();
    }

    return GoodsReceiptItem(
      id: '${json['id'] ?? ''}',
      productId: productId,
      productName: productName,
      sku: sku,
      quantityReceived: _numOf(json['quantityReceived']),
      unitCost: _numOf(json['unitCost']),
      purchaseOrderItemId: json['purchaseOrderItemId']?.toString(),
    );
  }
}

class GoodsReceipt {
  const GoodsReceipt({
    required this.id,
    required this.receiptNumber,
    required this.supplierId,
    this.purchaseOrderId,
    this.status = 'Draft',
    this.receiptDate,
    this.totalAmount = 0,
    this.inventoryAppliedAt,
    this.supplierName,
    this.poNumber,
    this.receiptType,
    this.stockPostingPending = false,
    this.deferredStockPosting = false,
    this.items = const [],
  });

  final String id;
  final String receiptNumber;
  final String supplierId;
  final String? purchaseOrderId;
  final String status;
  final DateTime? receiptDate;
  final double totalAmount;
  final DateTime? inventoryAppliedAt;
  final String? supplierName;
  final String? poNumber;
  final String? receiptType;
  final bool stockPostingPending;
  final bool deferredStockPosting;
  final List<GoodsReceiptItem> items;

  factory GoodsReceipt.fromJson(Map<String, dynamic> json) {
    String? supplierName = json['supplierName']?.toString();
    final supplier = json['supplier'];
    if (supplier is Map) {
      supplierName ??= supplier['supplierName']?.toString();
    }

    String? poNumber = json['poNumber']?.toString();
    final purchaseOrder = json['purchaseOrder'];
    if (purchaseOrder is Map) {
      poNumber ??= purchaseOrder['poNumber']?.toString();
    }

    return GoodsReceipt(
      id: '${json['id'] ?? ''}',
      receiptNumber: '${json['receiptNumber'] ?? ''}',
      supplierId: '${json['supplierId'] ?? ''}',
      purchaseOrderId: json['purchaseOrderId']?.toString(),
      status: '${json['status'] ?? 'Draft'}',
      receiptDate: _dateOf(json['receiptDate']),
      totalAmount: _numOf(json['totalAmount']),
      inventoryAppliedAt: _dateOf(json['inventoryAppliedAt']),
      supplierName: supplierName,
      poNumber: poNumber,
      receiptType: json['receiptType']?.toString(),
      stockPostingPending: json['stockPostingPending'] == true,
      deferredStockPosting: json['deferredStockPosting'] == true,
      items: _parseList(json['items'], GoodsReceiptItem.fromJson),
    );
  }
}

class SupplierBillItem {
  const SupplierBillItem({
    required this.id,
    this.productId,
    this.description = '',
    this.quantity = 0,
    this.unitCost = 0,
    this.lineTotal = 0,
    this.taxRate = 0,
    this.taxAmount = 0,
    this.productName,
  });

  final String id;
  final String? productId;
  final String description;
  final double quantity;
  final double unitCost;
  final double lineTotal;
  final double taxRate;
  final double taxAmount;
  final String? productName;

  factory SupplierBillItem.fromJson(Map<String, dynamic> json) {
    String? productName;
    final product = json['product'];
    if (product is Map) {
      productName = product['name']?.toString();
    }

    return SupplierBillItem(
      id: '${json['id'] ?? ''}',
      productId: json['productId']?.toString(),
      description: '${json['description'] ?? productName ?? ''}',
      quantity: _numOf(json['quantity']),
      unitCost: _numOf(json['unitCost']),
      lineTotal: _numOf(json['lineTotal']),
      taxRate: _numOf(json['taxRate']),
      taxAmount: _numOf(json['taxAmount']),
      productName: productName,
    );
  }
}

class SupplierBill {
  const SupplierBill({
    required this.id,
    required this.billNumber,
    required this.supplierId,
    this.status = 'Draft',
    this.totalAmount = 0,
    this.amountPaid = 0,
    this.balanceDue = 0,
    this.billType,
    this.billDate,
    this.dueDate,
    this.supplierName,
    this.receiptNumber,
    this.matchingStatus,
    this.items = const [],
  });

  final String id;
  final String billNumber;
  final String supplierId;
  final String status;
  final double totalAmount;
  final double amountPaid;
  final double balanceDue;
  final String? billType;
  final DateTime? billDate;
  final DateTime? dueDate;
  final String? supplierName;
  final String? receiptNumber;
  /// v2.5 three-way match status (PO ↔ receipt ↔ bill).
  final String? matchingStatus;
  final List<SupplierBillItem> items;

  factory SupplierBill.fromJson(Map<String, dynamic> json) {
    String? supplierName = json['supplierName']?.toString();
    final supplier = json['supplier'];
    if (supplier is Map) {
      supplierName ??= supplier['supplierName']?.toString();
    }

    String? receiptNumber = json['receiptNumber']?.toString();
    final goodsReceipt = json['goodsReceipt'];
    if (goodsReceipt is Map) {
      receiptNumber ??= goodsReceipt['receiptNumber']?.toString();
    }

    final totalAmount = _numOf(json['totalAmount']);
    final amountPaid = _numOf(json['amountPaid']);
    final balanceDue = json['balanceDue'] != null
        ? _numOf(json['balanceDue'])
        : (totalAmount - amountPaid);

    return SupplierBill(
      id: '${json['id'] ?? ''}',
      billNumber: '${json['billNumber'] ?? ''}',
      supplierId: '${json['supplierId'] ?? ''}',
      status: '${json['status'] ?? 'Draft'}',
      totalAmount: totalAmount,
      amountPaid: amountPaid,
      balanceDue: balanceDue,
      billType: json['billType']?.toString(),
      billDate: _dateOf(json['billDate']),
      dueDate: _dateOf(json['dueDate']),
      supplierName: supplierName,
      receiptNumber: receiptNumber,
      matchingStatus: json['matchingStatus']?.toString(),
      items: _parseList(json['items'], SupplierBillItem.fromJson),
    );
  }
}

/// Result of POST /api/purchases/bills/match (v2.5 three-way match).
class BillMatchResult {
  const BillMatchResult({
    required this.matchingStatus,
    this.blocked = false,
    this.issueMessages = const [],
  });

  final String matchingStatus;
  final bool blocked;
  final List<String> issueMessages;

  factory BillMatchResult.fromJson(Map<String, dynamic> json) {
    final issuesRaw = json['issues'];
    final messages = <String>[];
    if (issuesRaw is List) {
      for (final issue in issuesRaw) {
        if (issue is Map) {
          final msg = issue['message']?.toString();
          if (msg != null && msg.isNotEmpty) messages.add(msg);
        }
      }
    }

    return BillMatchResult(
      matchingStatus: '${json['matchingStatus'] ?? 'NOT_STARTED'}',
      blocked: json['blocked'] == true,
      issueMessages: messages,
    );
  }
}

class SupplierPaymentAllocation {
  const SupplierPaymentAllocation({
    required this.id,
    required this.billId,
    this.amount = 0,
    this.billNumber,
    this.receiptNumber,
  });

  final String id;
  final String billId;
  final double amount;
  final String? billNumber;
  final String? receiptNumber;

  factory SupplierPaymentAllocation.fromJson(Map<String, dynamic> json) {
    String? billNumber;
    String? receiptNumber;
    final bill = json['bill'];
    if (bill is Map) {
      billNumber = bill['billNumber']?.toString();
      final goodsReceipt = bill['goodsReceipt'];
      if (goodsReceipt is Map) {
        receiptNumber = goodsReceipt['receiptNumber']?.toString();
      }
    }

    return SupplierPaymentAllocation(
      id: '${json['id'] ?? ''}',
      billId: '${json['billId'] ?? ''}',
      amount: _numOf(json['amountAllocated'] ?? json['amount']),
      billNumber: billNumber,
      receiptNumber: receiptNumber,
    );
  }
}

class SupplierPayment {
  const SupplierPayment({
    required this.id,
    this.paymentNumber,
    required this.supplierId,
    this.amount = 0,
    this.paymentDate,
    this.paymentAccountId,
    this.reference,
    this.paymentMethodName,
    this.notes,
    this.supplierName,
    this.allocations = const [],
  });

  final String id;
  final String? paymentNumber;
  final String supplierId;
  final double amount;
  final DateTime? paymentDate;
  final String? paymentAccountId;
  final String? reference;
  final String? paymentMethodName;
  final String? notes;
  final String? supplierName;
  final List<SupplierPaymentAllocation> allocations;

  factory SupplierPayment.fromJson(Map<String, dynamic> json) {
    String? supplierName = json['supplierName']?.toString();
    final supplier = json['supplier'];
    if (supplier is Map) {
      supplierName ??= supplier['supplierName']?.toString();
    }

    return SupplierPayment(
      id: '${json['id'] ?? ''}',
      paymentNumber: json['paymentNumber']?.toString(),
      supplierId: '${json['supplierId'] ?? ''}',
      amount: _numOf(json['totalAmount'] ?? json['amount']),
      paymentDate: _dateOf(json['paymentDate']),
      paymentAccountId: json['paymentAccountId']?.toString() ??
          json['paymentMethod']?.toString() ??
          json['bankAccountId']?.toString(),
      reference: json['reference']?.toString() ??
          json['referenceNumber']?.toString(),
      paymentMethodName: json['paymentMethodName']?.toString(),
      notes: json['notes']?.toString(),
      supplierName: supplierName,
      allocations: _parseList(
        json['allocations'],
        SupplierPaymentAllocation.fromJson,
      ),
    );
  }
}

class PurchaseSupplierListResponse {
  const PurchaseSupplierListResponse({
    this.items = const [],
    this.page = 1,
    this.limit = 20,
    this.totalCount = 0,
    this.totalPages = 1,
  });

  final List<PurchaseSupplier> items;
  final int page;
  final int limit;
  final int totalCount;
  final int totalPages;

  factory PurchaseSupplierListResponse.fromJson(Map<String, dynamic> json) {
    final pagination = _paginationOf(json);
    return PurchaseSupplierListResponse(
      items: _parseList(json['suppliers'], PurchaseSupplier.fromJson),
      page: _intOf(pagination?['page'] ?? json['page'] ?? 1),
      limit: _intOf(pagination?['limit'] ?? json['limit'] ?? 20),
      totalCount: _intOf(pagination?['totalCount'] ?? json['totalCount']),
      totalPages: _intOf(pagination?['totalPages'] ?? json['totalPages'] ?? 1),
    );
  }
}

class PurchaseOrderListResponse {
  const PurchaseOrderListResponse({
    this.items = const [],
    this.page = 1,
    this.limit = 20,
    this.totalCount = 0,
    this.totalPages = 1,
  });

  final List<PurchaseOrder> items;
  final int page;
  final int limit;
  final int totalCount;
  final int totalPages;

  factory PurchaseOrderListResponse.fromJson(Map<String, dynamic> json) {
    final pagination = _paginationOf(json);
    return PurchaseOrderListResponse(
      items: _parseList(json['purchaseOrders'], PurchaseOrder.fromJson),
      page: _intOf(pagination?['page'] ?? json['page'] ?? 1),
      limit: _intOf(pagination?['limit'] ?? json['limit'] ?? 20),
      totalCount: _intOf(pagination?['totalCount'] ?? json['totalCount']),
      totalPages: _intOf(pagination?['totalPages'] ?? json['totalPages'] ?? 1),
    );
  }
}

class GoodsReceiptListResponse {
  const GoodsReceiptListResponse({
    this.items = const [],
    this.page = 1,
    this.limit = 20,
    this.totalCount = 0,
    this.totalPages = 1,
  });

  final List<GoodsReceipt> items;
  final int page;
  final int limit;
  final int totalCount;
  final int totalPages;

  factory GoodsReceiptListResponse.fromJson(Map<String, dynamic> json) {
    final pagination = _paginationOf(json);
    return GoodsReceiptListResponse(
      items: _parseList(json['receipts'], GoodsReceipt.fromJson),
      page: _intOf(pagination?['page'] ?? json['page'] ?? 1),
      limit: _intOf(pagination?['limit'] ?? json['limit'] ?? 20),
      totalCount: _intOf(pagination?['totalCount'] ?? json['totalCount']),
      totalPages: _intOf(pagination?['totalPages'] ?? json['totalPages'] ?? 1),
    );
  }
}

class SupplierBillListResponse {
  const SupplierBillListResponse({
    this.items = const [],
    this.page = 1,
    this.limit = 20,
    this.totalCount = 0,
    this.totalPages = 1,
  });

  final List<SupplierBill> items;
  final int page;
  final int limit;
  final int totalCount;
  final int totalPages;

  factory SupplierBillListResponse.fromJson(Map<String, dynamic> json) {
    final pagination = _paginationOf(json);
    return SupplierBillListResponse(
      items: _parseList(json['bills'], SupplierBill.fromJson),
      page: _intOf(pagination?['page'] ?? json['page'] ?? 1),
      limit: _intOf(pagination?['limit'] ?? json['limit'] ?? 20),
      totalCount: _intOf(pagination?['totalCount'] ?? json['totalCount']),
      totalPages: _intOf(pagination?['totalPages'] ?? json['totalPages'] ?? 1),
    );
  }
}

class SupplierPaymentListResponse {
  const SupplierPaymentListResponse({
    this.items = const [],
    this.page = 1,
    this.limit = 20,
    this.totalCount = 0,
    this.totalPages = 1,
  });

  final List<SupplierPayment> items;
  final int page;
  final int limit;
  final int totalCount;
  final int totalPages;

  factory SupplierPaymentListResponse.fromJson(Map<String, dynamic> json) {
    final pagination = _paginationOf(json);
    return SupplierPaymentListResponse(
      items: _parseList(json['payments'], SupplierPayment.fromJson),
      page: _intOf(pagination?['page'] ?? json['page'] ?? 1),
      limit: _intOf(pagination?['limit'] ?? json['limit'] ?? 20),
      totalCount: _intOf(pagination?['totalCount'] ?? json['totalCount']),
      totalPages: _intOf(pagination?['totalPages'] ?? json['totalPages'] ?? 1),
    );
  }
}
