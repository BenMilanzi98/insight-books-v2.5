class StockProduct {
  const StockProduct({
    required this.id,
    required this.name,
    this.sku,
    this.quantityInStock = 0,
    this.unitPrice = 0,
    this.costPrice = 0,
    this.reorderPoint = 0,
    this.status = 'In Stock',
    this.category,
    this.location,
    this.isService = false,
    this.isDeleted = false,
    this.totalStockValue = 0,
    this.imageUrl,
    this.barcode,
    this.barcodes = const [],
    this.productUnits = const [],
    this.isPerishable = false,
    this.description,
  });

  final String id;
  final String name;
  final String? sku;
  final double quantityInStock;
  final double unitPrice;
  final double costPrice;
  final double reorderPoint;
  final String status;
  final String? category;
  final String? location;
  final bool isService;
  final bool isDeleted;
  final double totalStockValue;
  final String? imageUrl;
  final String? barcode;
  final List<String> barcodes;
  final List<ProductUnitAssignment> productUnits;
  final bool isPerishable;
  final String? description;

  bool get hasUnitManagement => productUnits.isNotEmpty;

  StockProduct copyWith({
    String? id,
    String? name,
    String? sku,
    double? quantityInStock,
    double? unitPrice,
    double? costPrice,
    double? reorderPoint,
    String? status,
    String? category,
    String? location,
    bool? isService,
    bool? isDeleted,
    double? totalStockValue,
    String? imageUrl,
    String? barcode,
    List<String>? barcodes,
    List<ProductUnitAssignment>? productUnits,
    bool? isPerishable,
    String? description,
  }) {
    return StockProduct(
      id: id ?? this.id,
      name: name ?? this.name,
      sku: sku ?? this.sku,
      quantityInStock: quantityInStock ?? this.quantityInStock,
      unitPrice: unitPrice ?? this.unitPrice,
      costPrice: costPrice ?? this.costPrice,
      reorderPoint: reorderPoint ?? this.reorderPoint,
      status: status ?? this.status,
      category: category ?? this.category,
      location: location ?? this.location,
      isService: isService ?? this.isService,
      isDeleted: isDeleted ?? this.isDeleted,
      totalStockValue: totalStockValue ?? this.totalStockValue,
      imageUrl: imageUrl ?? this.imageUrl,
      barcode: barcode ?? this.barcode,
      barcodes: barcodes ?? this.barcodes,
      productUnits: productUnits ?? this.productUnits,
      isPerishable: isPerishable ?? this.isPerishable,
      description: description ?? this.description,
    );
  }

  factory StockProduct.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    List<String> parseBarcodes() {
      final raw = json['barcodes'];
      if (raw is List) {
        return raw
            .map((e) => e?.toString().trim() ?? '')
            .where((e) => e.isNotEmpty)
            .toList();
      }
      final legacy = json['barcode']?.toString().trim();
      if (legacy != null && legacy.isNotEmpty) return [legacy];
      return const [];
    }

    List<ProductUnitAssignment> parseUnits() {
      final raw = json['units'];
      if (raw is! List) return const [];
      final List<ProductUnitAssignment> units = [];
      for (final e in raw) {
        try {
          if (e is! Map) continue;
          units.add(
            ProductUnitAssignment.fromJson(Map<String, dynamic>.from(e)),
          );
        } catch (_) {
          continue;
        }
      }
      return units;
    }

    final qty = json['quantityInStock'] ?? json['stockLevel'] ?? 0;
    final parsedBarcodes = parseBarcodes();
    return StockProduct(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      sku: json['sku']?.toString(),
      quantityInStock: numOf(qty),
      unitPrice: numOf(json['unitPrice'] ?? json['price']),
      costPrice: numOf(json['costPrice'] ?? json['cost']),
      reorderPoint: numOf(json['reorderPoint']),
      status: '${json['status'] ?? 'In Stock'}',
      category: json['category']?.toString(),
      location: json['location']?.toString(),
      isService: json['isService'] == true,
      isDeleted: json['isDeleted'] == true,
      totalStockValue: numOf(json['totalStockValue']),
      imageUrl: (json['imageUrl'] ?? json['image'])?.toString(),
      barcode: parsedBarcodes.isNotEmpty
          ? parsedBarcodes.first
          : json['barcode']?.toString(),
      barcodes: parsedBarcodes,
      productUnits: parseUnits(),
      isPerishable: json['isPerishable'] == true,
      description: json['description']?.toString(),
    );
  }
}

class ProductUnitAssignment {
  const ProductUnitAssignment({
    required this.id,
    this.name,
    this.symbol,
    this.isBaseUnit = false,
    this.conversionToBase = 1,
    this.unitPrice = 0,
    this.costPrice = 0,
    this.quantityInStock = 0,
    this.reorderPoint = 0,
    this.isDefault = false,
    this.baseUnitId,
  });

  final String id;
  final String? name;
  final String? symbol;
  final bool isBaseUnit;
  final double conversionToBase;
  final double unitPrice;
  final double costPrice;
  final double quantityInStock;
  final double reorderPoint;
  final bool isDefault;
  final String? baseUnitId;

  factory ProductUnitAssignment.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    final nested = json['unit'];
    final unitMap = nested is Map ? Map<String, dynamic>.from(nested) : json;

    return ProductUnitAssignment(
      id: '${unitMap['id'] ?? json['id'] ?? ''}',
      name: unitMap['name']?.toString() ?? json['name']?.toString(),
      symbol: unitMap['symbol']?.toString() ?? json['symbol']?.toString(),
      isBaseUnit: unitMap['isBaseUnit'] == true || json['isBaseUnit'] == true,
      conversionToBase: numOf(
        unitMap['conversionToBase'] ?? json['conversionToBase'] ?? 1,
      ),
      unitPrice: numOf(json['unitPrice']),
      costPrice: numOf(json['costPrice']),
      quantityInStock: numOf(json['quantityInStock']),
      reorderPoint: numOf(json['reorderPoint']),
      isDefault: json['isDefault'] == true,
      baseUnitId: unitMap['baseUnit'] is Map
          ? (unitMap['baseUnit'] as Map)['id']?.toString()
          : unitMap['baseUnitId']?.toString() ?? json['baseUnitId']?.toString(),
    );
  }
}

class StockUnitOption {
  const StockUnitOption({
    required this.id,
    required this.name,
    this.symbol,
    this.conversionToBase = 1,
    this.isBaseUnit = false,
    this.baseUnitId,
  });

  final String id;
  final String name;
  final String? symbol;
  final double conversionToBase;
  final bool isBaseUnit;
  final String? baseUnitId;

  factory StockUnitOption.fromJson(
    Map<String, dynamic> json, {
    String? baseUnitId,
  }) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    return StockUnitOption(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      symbol: json['symbol']?.toString(),
      conversionToBase: numOf(json['conversionToBase'] ?? 1),
      isBaseUnit: json['isBaseUnit'] == true,
      baseUnitId: baseUnitId ?? json['baseUnitId']?.toString(),
    );
  }
}

class StockBaseUnit {
  const StockBaseUnit({
    required this.id,
    required this.displayName,
    this.units = const [],
  });

  final String id;
  final String displayName;
  final List<StockUnitOption> units;

  factory StockBaseUnit.fromJson(Map<String, dynamic> json) {
    final rawUnits = json['units'] as List<dynamic>? ?? [];
    final List<StockUnitOption> units = [];
    final baseId = '${json['id'] ?? ''}';
    for (final e in rawUnits) {
      try {
        if (e is! Map) continue;
        units.add(
          StockUnitOption.fromJson(
            Map<String, dynamic>.from(e),
            baseUnitId: baseId,
          ),
        );
      } catch (_) {
        continue;
      }
    }
    return StockBaseUnit(
      id: baseId,
      displayName: '${json['displayName'] ?? json['name'] ?? ''}',
      units: units,
    );
  }
}

class StockTaxTypeOption {
  const StockTaxTypeOption({
    required this.id,
    required this.taxName,
    this.taxCode,
    this.taxRate = 0,
    this.calculationType = 'Percentage',
  });

  final String id;
  final String taxName;
  final String? taxCode;
  final double taxRate;
  final String calculationType;

  factory StockTaxTypeOption.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    return StockTaxTypeOption(
      id: '${json['id'] ?? ''}',
      taxName: '${json['taxName'] ?? json['name'] ?? ''}',
      taxCode: json['taxCode']?.toString(),
      taxRate: numOf(json['taxRate']),
      calculationType: '${json['calculationType'] ?? 'Percentage'}',
    );
  }
}

class StockListResponse {
  const StockListResponse({
    required this.products,
    this.page = 1,
    this.limit = 20,
    this.totalCount = 0,
    this.totalPages = 1,
  });

  final List<StockProduct> products;
  final int page;
  final int limit;
  final int totalCount;
  final int totalPages;
}

class StockTransaction {
  const StockTransaction({
    required this.id,
    required this.type,
    required this.quantity,
    required this.date,
    this.productId,
    this.productName,
    this.userName,
    this.notes,
    this.delta,
    this.balanceAfter,
  });

  final String id;
  final String type;
  final double quantity;
  final DateTime date;
  final String? productId;
  final String? productName;
  final String? userName;
  final String? notes;
  final double? delta;
  final double? balanceAfter;

  factory StockTransaction.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    DateTime dateOf(dynamic v) {
      if (v is DateTime) return v;
      return DateTime.tryParse('$v') ?? DateTime.now();
    }

    String? productName;
    final product = json['product'];
    if (product is Map) {
      productName = product['name']?.toString();
    } else if (product != null) {
      productName = product.toString();
    }

    String? userName;
    final user = json['user'];
    if (user is Map) {
      userName = user['name']?.toString();
    } else if (user != null) {
      userName = user.toString();
    }

    return StockTransaction(
      id: '${json['id'] ?? ''}',
      type: '${json['type'] ?? ''}',
      quantity: numOf(json['quantity']),
      date: dateOf(json['date'] ?? json['createdAt']),
      productId: json['productId']?.toString(),
      productName: productName,
      userName: userName,
      notes: json['notes']?.toString(),
      delta: json['delta'] != null ? numOf(json['delta']) : null,
      balanceAfter:
          json['balanceAfter'] != null ? numOf(json['balanceAfter']) : null,
    );
  }
}

class StockTransactionListResponse {
  const StockTransactionListResponse({
    this.transactions = const [],
    this.page = 1,
    this.limit = 10,
    this.totalCount = 0,
    this.totalPages = 0,
  });

  final List<StockTransaction> transactions;
  final int page;
  final int limit;
  final int totalCount;
  final int totalPages;
}

class StockTransferBranch {
  const StockTransferBranch({
    required this.id,
    required this.name,
    this.tenantId,
    this.tenantName,
  });

  final String id;
  final String name;
  final String? tenantId;
  final String? tenantName;

  factory StockTransferBranch.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const StockTransferBranch(id: '', name: '');
    }
    String? tenantId;
    String? tenantName;
    final tenant = json['tenant'];
    if (tenant is Map) {
      tenantId = tenant['id']?.toString();
      tenantName = tenant['name']?.toString();
    }
    return StockTransferBranch(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      tenantId: tenantId,
      tenantName: tenantName,
    );
  }
}

class StockTransfer {
  const StockTransfer({
    required this.id,
    required this.status,
    required this.quantity,
    this.productId,
    this.productName,
    this.productSku,
    this.fromBranch,
    this.toBranch,
    this.notes,
    this.createdAt,
    this.approvedAt,
    this.receivedAt,
    this.createdByName,
    this.approvedByName,
  });

  final String id;
  final String status;
  final double quantity;
  final String? productId;
  final String? productName;
  final String? productSku;
  final StockTransferBranch? fromBranch;
  final StockTransferBranch? toBranch;
  final String? notes;
  final DateTime? createdAt;
  final DateTime? approvedAt;
  final DateTime? receivedAt;
  final String? createdByName;
  final String? approvedByName;

  bool get isPending => status.toLowerCase() == 'pending';
  bool get isApproved => status.toLowerCase() == 'approved';
  bool get isReceived => status.toLowerCase() == 'received';
  bool get isRejected => status.toLowerCase() == 'rejected';

  factory StockTransfer.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    DateTime? dateOf(dynamic v) {
      if (v == null) return null;
      return DateTime.tryParse('$v');
    }

    String? productName;
    String? productSku;
    String? productId = json['productId']?.toString();
    final product = json['product'];
    if (product is Map) {
      productId ??= product['id']?.toString();
      productName = product['name']?.toString();
      productSku = product['sku']?.toString();
    }

    String? createdByName;
    final createdBy = json['createdBy'];
    if (createdBy is Map) {
      createdByName = createdBy['name']?.toString();
    }

    String? approvedByName;
    final approvedBy = json['approvedBy'];
    if (approvedBy is Map) {
      approvedByName = approvedBy['name']?.toString();
    }

    StockTransferBranch? fromBranch;
    if (json['fromBranch'] is Map) {
      fromBranch = StockTransferBranch.fromJson(
        Map<String, dynamic>.from(json['fromBranch'] as Map),
      );
    }

    StockTransferBranch? toBranch;
    if (json['toBranch'] is Map) {
      toBranch = StockTransferBranch.fromJson(
        Map<String, dynamic>.from(json['toBranch'] as Map),
      );
    }

    return StockTransfer(
      id: '${json['id'] ?? ''}',
      status: '${json['status'] ?? 'pending'}',
      quantity: numOf(json['quantity']),
      productId: productId,
      productName: productName,
      productSku: productSku,
      fromBranch: fromBranch,
      toBranch: toBranch,
      notes: json['notes']?.toString(),
      createdAt: dateOf(json['createdAt']),
      approvedAt: dateOf(json['approvedAt']),
      receivedAt: dateOf(json['receivedAt']),
      createdByName: createdByName,
      approvedByName: approvedByName,
    );
  }
}

class StockTransferListResponse {
  const StockTransferListResponse({
    this.transfers = const [],
    this.count = 0,
  });

  final List<StockTransfer> transfers;
  final int count;
}

class StockByBranchSummary {
  const StockByBranchSummary({
    required this.id,
    required this.name,
    this.code,
    this.productCount = 0,
    this.totalQuantity = 0,
    this.totalValue = 0,
  });

  final String id;
  final String name;
  final String? code;
  final int productCount;
  final double totalQuantity;
  final double totalValue;

  factory StockByBranchSummary.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    int intOf(dynamic v) => numOf(v).round();

    return StockByBranchSummary(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      code: json['code']?.toString(),
      productCount: intOf(json['productCount']),
      totalQuantity: numOf(json['totalQuantity']),
      totalValue: numOf(json['totalValue'] ?? json['totalStockValue']),
    );
  }
}

class StockStatistics {
  const StockStatistics({
    this.totalItems = 0,
    this.serviceCount = 0,
    this.totalValue = 0,
    this.lowStock = 0,
    this.outOfStock = 0,
  });

  final int totalItems;
  final int serviceCount;
  final double totalValue;
  final int lowStock;
  final int outOfStock;

  factory StockStatistics.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }
    int intOf(dynamic v) => numOf(v).round();
    return StockStatistics(
      totalItems: intOf(json['totalItems']),
      serviceCount: intOf(json['serviceCount']),
      totalValue: numOf(json['totalValue']),
      lowStock: intOf(json['lowStock']),
      outOfStock: intOf(json['outOfStock']),
    );
  }
}

class ExpiryAlertThresholds {
  const ExpiryAlertThresholds({
    this.earlyDays = 60,
    this.urgentDays = 7,
  });

  final int earlyDays;
  final int urgentDays;

  factory ExpiryAlertThresholds.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const ExpiryAlertThresholds();
    int intOf(dynamic v) {
      if (v is num) return v.round();
      return int.tryParse('$v') ?? 0;
    }
    return ExpiryAlertThresholds(
      earlyDays: intOf(json['earlyDays']).clamp(1, 365),
      urgentDays: intOf(json['urgentDays']).clamp(1, 365),
    );
  }
}

class ExpiryAlertSummary {
  const ExpiryAlertSummary({
    this.expired = 0,
    this.urgent = 0,
    this.early = 0,
    this.totalLineValue = 0,
  });

  final int expired;
  final int urgent;
  final int early;
  final double totalLineValue;

  int get total => expired + urgent + early;

  factory ExpiryAlertSummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const ExpiryAlertSummary();
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }
    int intOf(dynamic v) => numOf(v).round();
    return ExpiryAlertSummary(
      expired: intOf(json['expired']),
      urgent: intOf(json['urgent']),
      early: intOf(json['early']),
      totalLineValue: numOf(json['totalLineValue']),
    );
  }
}

class ExpiryAlert {
  const ExpiryAlert({
    required this.batchId,
    required this.productId,
    required this.productName,
    required this.status,
    this.sku,
    this.branchId,
    this.branchName,
    this.expiryDate,
    this.qtyRemaining = 0,
    this.unitCost = 0,
    this.lineValue = 0,
    this.daysRemaining = 0,
  });

  final String batchId;
  final String productId;
  final String productName;
  final String status;
  final String? sku;
  final String? branchId;
  final String? branchName;
  final DateTime? expiryDate;
  final double qtyRemaining;
  final double unitCost;
  final double lineValue;
  final int daysRemaining;

  bool get isExpired => status == 'expired';
  bool get isUrgent => status == 'urgent';
  bool get isEarly => status == 'early';

  factory ExpiryAlert.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    int intOf(dynamic v) => numOf(v).round();

    DateTime? dateOf(dynamic v) {
      if (v == null) return null;
      return DateTime.tryParse('$v');
    }

    return ExpiryAlert(
      batchId: '${json['batchId'] ?? ''}',
      productId: '${json['productId'] ?? ''}',
      productName: '${json['productName'] ?? ''}',
      status: '${json['status'] ?? ''}',
      sku: json['sku']?.toString(),
      branchId: json['branchId']?.toString(),
      branchName: json['branchName']?.toString(),
      expiryDate: dateOf(json['expiryDate']),
      qtyRemaining: numOf(json['qtyRemaining']),
      unitCost: numOf(json['unitCost']),
      lineValue: numOf(json['lineValue']),
      daysRemaining: intOf(json['daysRemaining']),
    );
  }
}

class ExpiryAlertsResponse {
  const ExpiryAlertsResponse({
    this.rows = const [],
    this.summary = const ExpiryAlertSummary(),
    this.thresholds = const ExpiryAlertThresholds(),
    this.migrationPending = false,
  });

  final List<ExpiryAlert> rows;
  final ExpiryAlertSummary summary;
  final ExpiryAlertThresholds thresholds;
  final bool migrationPending;

  factory ExpiryAlertsResponse.fromJson(Map<String, dynamic> json) {
    final raw = json['rows'] as List<dynamic>? ?? [];
    final List<ExpiryAlert> rows = [];
    for (final e in raw) {
      try {
        if (e is! Map) continue;
        rows.add(ExpiryAlert.fromJson(Map<String, dynamic>.from(e)));
      } catch (_) {
        continue;
      }
    }
    return ExpiryAlertsResponse(
      rows: rows,
      summary: ExpiryAlertSummary.fromJson(
        json['summary'] is Map
            ? Map<String, dynamic>.from(json['summary'] as Map)
            : null,
      ),
      thresholds: ExpiryAlertThresholds.fromJson(
        json['thresholds'] is Map
            ? Map<String, dynamic>.from(json['thresholds'] as Map)
            : null,
      ),
      migrationPending: json['migrationPending'] == true,
    );
  }
}

class WriteOffResult {
  const WriteOffResult({
    required this.batchId,
    required this.quantity,
    required this.lossAmount,
    this.productId,
    this.journalEntryId,
  });

  final String batchId;
  final double quantity;
  final double lossAmount;
  final String? productId;
  final String? journalEntryId;

  factory WriteOffResult.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    return WriteOffResult(
      batchId: '${json['batchId'] ?? ''}',
      quantity: numOf(json['quantity']),
      lossAmount: numOf(json['lossAmount']),
      productId: json['productId']?.toString(),
      journalEntryId: json['journalEntryId']?.toString(),
    );
  }
}

class RestockResult {
  const RestockResult({
    required this.productId,
    this.restockBatchId,
    this.quantityOnHand = 0,
  });

  final String productId;
  final String? restockBatchId;
  final double quantityOnHand;

  factory RestockResult.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    return RestockResult(
      productId: '${json['productId'] ?? ''}',
      restockBatchId: json['restockBatchId']?.toString(),
      quantityOnHand: numOf(json['quantityOnHand']),
    );
  }
}

class ReceivingPoLine {
  const ReceivingPoLine({
    required this.lineId,
    required this.productId,
    required this.productName,
    this.sku,
    this.quantityOrdered = 0,
    this.quantityReceived = 0,
    this.quantityRemaining = 0,
    this.unitCost = 0,
  });

  final String lineId;
  final String productId;
  final String productName;
  final String? sku;
  final double quantityOrdered;
  final double quantityReceived;
  final double quantityRemaining;
  final double unitCost;

  factory ReceivingPoLine.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    return ReceivingPoLine(
      lineId: '${json['lineId'] ?? ''}',
      productId: '${json['productId'] ?? ''}',
      productName: '${json['productName'] ?? 'Product'}',
      sku: json['sku']?.toString(),
      quantityOrdered: numOf(json['quantityOrdered']),
      quantityReceived: numOf(json['quantityReceived']),
      quantityRemaining: numOf(json['quantityRemaining']),
      unitCost: numOf(json['unitCost']),
    );
  }
}

class ReceivingPurchaseOrder {
  const ReceivingPurchaseOrder({
    required this.id,
    required this.poNumber,
    this.poDate,
    this.status,
    this.supplierId,
    this.supplierName,
    this.orderType,
    this.lines = const [],
  });

  final String id;
  final String poNumber;
  final DateTime? poDate;
  final String? status;
  final String? supplierId;
  final String? supplierName;
  final String? orderType;
  final List<ReceivingPoLine> lines;

  double get totalRemaining =>
      lines.fold(0, (sum, line) => sum + line.quantityRemaining);

  factory ReceivingPurchaseOrder.fromJson(Map<String, dynamic> json) {
    DateTime? dateOf(dynamic v) {
      if (v == null) return null;
      return DateTime.tryParse('$v');
    }

    final rawLines = json['lines'] as List<dynamic>? ?? [];
    final List<ReceivingPoLine> lines = [];
    for (final e in rawLines) {
      try {
        if (e is! Map) continue;
        lines.add(ReceivingPoLine.fromJson(Map<String, dynamic>.from(e)));
      } catch (_) {
        continue;
      }
    }

    return ReceivingPurchaseOrder(
      id: '${json['id'] ?? ''}',
      poNumber: '${json['poNumber'] ?? ''}',
      poDate: dateOf(json['poDate']),
      status: json['status']?.toString(),
      supplierId: json['supplierId']?.toString(),
      supplierName: json['supplierName']?.toString(),
      orderType: json['orderType']?.toString(),
      lines: lines,
    );
  }
}

class ReceivingReceiptItem {
  const ReceivingReceiptItem({
    required this.id,
    required this.productName,
    this.sku,
    this.quantityReceived = 0,
    this.unitCost = 0,
  });

  final String id;
  final String productName;
  final String? sku;
  final double quantityReceived;
  final double unitCost;

  factory ReceivingReceiptItem.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    return ReceivingReceiptItem(
      id: '${json['id'] ?? ''}',
      productName: '${json['productName'] ?? '—'}',
      sku: json['sku']?.toString(),
      quantityReceived: numOf(json['quantityReceived']),
      unitCost: numOf(json['unitCost']),
    );
  }
}

class ReceivingGoodsReceipt {
  const ReceivingGoodsReceipt({
    required this.id,
    required this.receiptNumber,
    this.receiptDate,
    this.status,
    this.supplierName,
    this.poNumber,
    this.purchaseOrderId,
    this.totalAmount = 0,
    this.itemCount = 0,
    this.inventoryAppliedAt,
    this.items = const [],
  });

  final String id;
  final String receiptNumber;
  final DateTime? receiptDate;
  final String? status;
  final String? supplierName;
  final String? poNumber;
  final String? purchaseOrderId;
  final double totalAmount;
  final int itemCount;
  final DateTime? inventoryAppliedAt;
  final List<ReceivingReceiptItem> items;

  factory ReceivingGoodsReceipt.fromJson(Map<String, dynamic> json) {
    double numOf(dynamic v) {
      if (v is num) return v.toDouble();
      return double.tryParse('$v') ?? 0;
    }

    int intOf(dynamic v) => numOf(v).round();

    DateTime? dateOf(dynamic v) {
      if (v == null) return null;
      return DateTime.tryParse('$v');
    }

    final rawItems = json['items'] as List<dynamic>? ?? [];
    final List<ReceivingReceiptItem> items = [];
    for (final e in rawItems) {
      try {
        if (e is! Map) continue;
        items.add(ReceivingReceiptItem.fromJson(Map<String, dynamic>.from(e)));
      } catch (_) {
        continue;
      }
    }

    return ReceivingGoodsReceipt(
      id: '${json['id'] ?? ''}',
      receiptNumber: '${json['receiptNumber'] ?? ''}',
      receiptDate: dateOf(json['receiptDate']),
      status: json['status']?.toString(),
      supplierName: json['supplierName']?.toString(),
      poNumber: json['poNumber']?.toString(),
      purchaseOrderId: json['purchaseOrderId']?.toString(),
      totalAmount: numOf(json['totalAmount']),
      itemCount: intOf(json['itemCount']),
      inventoryAppliedAt: dateOf(json['inventoryAppliedAt']),
      items: items,
    );
  }
}

class ReceivingDataResponse {
  const ReceivingDataResponse({
    this.orderedGoodsOutstanding = const [],
    this.postedInventoryPending = const [],
    this.goodsReceivedPosted = const [],
  });

  final List<ReceivingPurchaseOrder> orderedGoodsOutstanding;
  final List<ReceivingGoodsReceipt> postedInventoryPending;
  final List<ReceivingGoodsReceipt> goodsReceivedPosted;

  int get orderedPoCount => orderedGoodsOutstanding.length;
  int get pendingReceiptCount => postedInventoryPending.length;
  int get receivedReceiptCount => goodsReceivedPosted.length;

  double get unitsStillToReceive => orderedGoodsOutstanding.fold(
        0,
        (sum, po) => sum + po.totalRemaining,
      );

  factory ReceivingDataResponse.fromJson(Map<String, dynamic> json) {
    List<T> parseList<T>(
      String key,
      T Function(Map<String, dynamic>) fromJson,
    ) {
      final raw = json[key] as List<dynamic>? ?? [];
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

    return ReceivingDataResponse(
      orderedGoodsOutstanding: parseList(
        'orderedGoodsOutstanding',
        ReceivingPurchaseOrder.fromJson,
      ),
      postedInventoryPending: parseList(
        'postedInventoryPending',
        ReceivingGoodsReceipt.fromJson,
      ),
      goodsReceivedPosted: parseList(
        'goodsReceivedPosted',
        ReceivingGoodsReceipt.fromJson,
      ),
    );
  }
}
