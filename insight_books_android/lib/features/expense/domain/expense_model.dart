// Expense domain models - plain Dart (no code generation required).

double _toDouble(dynamic value) {
  if (value == null) return 0.0;
  if (value is num) return value.toDouble();
  if (value is String) {
    return double.tryParse(value.replaceAll(',', '')) ?? 0.0;
  }
  return 0.0;
}

/// Single expense (regular, COGS, or salary advance).
class Expense {
  const Expense({
    required this.id,
    required this.description,
    required this.amount,
    required this.date,
    required this.category,
    required this.status,
    this.paymentStatus = 'Fully paid',
    this.merchant,
    this.notes,
    this.submittedBy,
    this.expenseAccount,
    this.sourceAccount,
    this.supplier,
    this.payments = const [],
    this.attachments = const [],
    this.isCOGS = false,
    this.isSalaryAdvance = false,
    this.taxAmount = 0,
    this.taxRate = 0,
    this.paidAmount = 0,
    this.paymentReference,
    this.expenseAccountId,
    this.sourceAccountId,
    this.supplierId,
    this.branchId,
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
    this.deletionReason,
    this.taxTypeId,
  });

  final String id;
  final String description;
  final double amount;
  final String date;
  final String category;
  final String status;
  final String paymentStatus;
  final String? merchant;
  final String? notes;
  final String? submittedBy;
  final ExpenseAccountInfo? expenseAccount;
  final ExpenseAccountInfo? sourceAccount;
  final Map<String, dynamic>? supplier;
  final List<ExpensePayment> payments;
  final List<ExpenseAttachment> attachments;
  final bool isCOGS;
  final bool isSalaryAdvance;
  final double taxAmount;
  final double taxRate;
  final double paidAmount;
  final String? paymentReference;
  final String? expenseAccountId;
  final String? sourceAccountId;
  final String? supplierId;
  final String? branchId;
  final String? createdAt;
  final String? updatedAt;
  final String? deletedAt;
  final String? deletionReason;
  final String? taxTypeId;

  factory Expense.fromJson(Map<String, dynamic> json) {
    final paymentsList = json['payments'] as List<dynamic>? ?? [];
    final attachmentsList = json['attachments'] as List<dynamic>? ?? [];
    final submittedByObj = json['submittedBy'];
    String? submittedByName;
    if (submittedByObj is Map) {
      submittedByName = submittedByObj['name'] as String?;
    } else if (submittedByObj is String) {
      submittedByName = submittedByObj;
    }

    return Expense(
      id: json['id'] as String? ?? '',
      description: json['description'] as String? ?? '',
      amount: _toDouble(json['amount']),
      date: json['date'] is String
          ? json['date'] as String
          : (json['date'] != null ? json['date'].toString().split('T').first : ''),
      category: json['category'] as String? ?? '',
      status: json['status'] as String? ?? 'Pending',
      paymentStatus: json['paymentStatus'] as String? ?? 'Fully paid',
      merchant: json['merchant'] as String?,
      notes: json['notes'] as String?,
      submittedBy: submittedByName,
      expenseAccount: json['expenseAccount'] != null
          ? ExpenseAccountInfo.fromJson(
              Map<String, dynamic>.from(json['expenseAccount'] as Map))
          : null,
      sourceAccount: json['sourceAccount'] != null
          ? ExpenseAccountInfo.fromJson(
              Map<String, dynamic>.from(json['sourceAccount'] as Map))
          : null,
      supplier: json['supplier'] != null
          ? Map<String, dynamic>.from(json['supplier'] as Map)
          : null,
      payments: paymentsList
          .map((e) => ExpensePayment.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      attachments: attachmentsList
          .map((e) =>
              ExpenseAttachment.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      isCOGS: json['isCOGS'] == true,
      isSalaryAdvance: json['isSalaryAdvance'] == true,
      taxAmount: _toDouble(json['taxAmount']),
      taxRate: _toDouble(json['taxRate']),
      paidAmount: _toDouble(json['paidAmount']),
      paymentReference: json['paymentReference'] as String?,
      expenseAccountId: json['expenseAccountId'] as String?,
      sourceAccountId: json['sourceAccountId'] as String?,
      supplierId: json['supplierId'] as String?,
      branchId: json['branchId'] as String?,
      createdAt: json['createdAt']?.toString(),
      updatedAt: json['updatedAt']?.toString(),
      deletedAt: json['deletedAt']?.toString(),
      deletionReason: json['deletionReason'] as String?,
      taxTypeId: json['taxTypeId'] as String? ??
          (json['taxType'] is Map
              ? (json['taxType'] as Map)['id'] as String?
              : null),
    );
  }

  /// Whether this expense can be edited (not COGS/salary advance from system).
  bool get isEditable => !isCOGS && !isSalaryAdvance;

  /// Whether partial payment can be added (pending or partially paid).
  bool get canAddPartialPayment =>
      (paymentStatus == 'Pending' || paymentStatus == 'Partially') && isEditable;

  /// Total owed (base + tax), aligned with API `totalWithTax` / payment logic.
  double get totalPayable => amount + taxAmount;

  /// Balance remaining for partial payments.
  double get remainingBalance => totalPayable - paidAmount;
}

class ExpenseAccountInfo {
  const ExpenseAccountInfo({
    required this.id,
    this.accountCode,
    this.accountName,
    this.name,
  });

  final String id;
  final String? accountCode;
  final String? accountName;
  final String? name;

  String get displayName =>
      accountName ?? name ?? accountCode ?? id;

  factory ExpenseAccountInfo.fromJson(Map<String, dynamic> json) {
    return ExpenseAccountInfo(
      id: json['id'] as String? ?? '',
      accountCode: json['accountCode'] as String? ?? json['code'] as String?,
      accountName: json['accountName'] as String?,
      name: json['name'] as String?,
    );
  }
}

class ExpensePayment {
  const ExpensePayment({
    required this.id,
    required this.amount,
    required this.paymentMethod,
    this.paymentDate,
    this.reference,
    this.notes,
    this.status = 'Completed',
  });

  final String id;
  final double amount;
  final String paymentMethod;
  final String? paymentDate;
  final String? reference;
  final String? notes;
  final String status;

  factory ExpensePayment.fromJson(Map<String, dynamic> json) {
    return ExpensePayment(
      id: json['id'] as String? ?? '',
      amount: _toDouble(json['amount']),
      paymentMethod: json['paymentMethod'] as String? ?? '',
      paymentDate: json['paymentDate']?.toString(),
      reference: json['reference'] as String?,
      notes: json['notes'] as String?,
      status: json['status'] as String? ?? 'Completed',
    );
  }
}

class ExpenseAttachment {
  const ExpenseAttachment({
    required this.id,
    this.name,
    this.type,
    this.size,
    this.date,
    this.url,
  });

  final String id;
  final String? name;
  final String? type;
  final String? size;
  final String? date;
  final String? url;

  factory ExpenseAttachment.fromJson(Map<String, dynamic> json) {
    return ExpenseAttachment(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? json['filename'] as String?,
      type: json['type'] as String? ?? json['fileType'] as String?,
      size: json['size'] as String?,
      date: json['date']?.toString() ?? json['uploadedAt']?.toString(),
      url: json['url'] as String?,
    );
  }
}

/// Statistics from GET /api/expenses/statistics
class ExpenseStatistics {
  const ExpenseStatistics({
    required this.total,
    required this.approved,
    required this.pending,
    required this.rejected,
    this.byCategory = const [],
  });

  final ExpenseStatBucket total;
  final ExpenseStatBucket approved;
  final ExpenseStatBucket pending;
  final ExpenseStatBucket rejected;
  final List<ExpenseByCategory> byCategory;

  factory ExpenseStatistics.fromJson(Map<String, dynamic> json) {
    final byCat = json['byCategory'] as List<dynamic>? ?? [];
    return ExpenseStatistics(
      total: ExpenseStatBucket.fromJson(
          Map<String, dynamic>.from((json['total'] ?? {}) as Map)),
      approved: ExpenseStatBucket.fromJson(
          Map<String, dynamic>.from((json['approved'] ?? {}) as Map)),
      pending: ExpenseStatBucket.fromJson(
          Map<String, dynamic>.from((json['pending'] ?? {}) as Map)),
      rejected: ExpenseStatBucket.fromJson(
          Map<String, dynamic>.from((json['rejected'] ?? {}) as Map)),
      byCategory: byCat
          .map((e) =>
              ExpenseByCategory.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }
}

class ExpenseStatBucket {
  const ExpenseStatBucket({this.count = 0, this.amount = 0});

  final int count;
  final double amount;

  factory ExpenseStatBucket.fromJson(Map<String, dynamic> json) {
    return ExpenseStatBucket(
      count: (json['count'] as num?)?.toInt() ?? 0,
      amount: _toDouble(json['amount']),
    );
  }
}

class ExpenseByCategory {
  const ExpenseByCategory({
    required this.category,
    this.amount = 0,
    this.percentage = 0,
  });

  final String category;
  final double amount;
  final int percentage;

  factory ExpenseByCategory.fromJson(Map<String, dynamic> json) {
    return ExpenseByCategory(
      category: json['category'] as String? ?? '',
      amount: _toDouble(json['amount']),
      percentage: (json['percentage'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Category option for filter and create form (from GET /api/categories?type=expense)
class ExpenseCategoryOption {
  const ExpenseCategoryOption({
    required this.id,
    required this.name,
    this.code,
    this.accountId,
    this.description,
  });

  final String id;
  final String name;
  final String? code;
  final String? accountId;
  final String? description;

  /// For API filter we send accountId (or category name); backend accepts both.
  String get filterValue => id;

  factory ExpenseCategoryOption.fromJson(Map<String, dynamic> json) {
    final id = json['id'] as String? ?? json['accountId'] as String? ?? '';
    final name = json['name'] as String? ?? '';
    return ExpenseCategoryOption(
      id: id,
      name: name,
      code: json['code'] as String? ?? json['accountCode'] as String?,
      accountId: json['accountId'] as String? ?? id,
      description: json['description'] as String?,
    );
  }
}

/// Payment account for Source of Funds dropdown (GET /api/payment-accounts)
class PaymentAccountOption {
  const PaymentAccountOption({
    required this.id,
    required this.name,
    this.accountType,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String? accountType;
  final bool isActive;

  factory PaymentAccountOption.fromJson(Map<String, dynamic> json) {
    return PaymentAccountOption(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Unnamed',
      accountType: json['accountType'] as String?,
      isActive: json['isActive'] != false,
    );
  }
}

class SupplierOption {
  const SupplierOption({
    required this.id,
    required this.name,
    this.email,
    this.phone,
  });

  final String id;
  final String name;
  final String? email;
  final String? phone;

  factory SupplierOption.fromJson(Map<String, dynamic> json) {
    return SupplierOption(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Unnamed Supplier',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
    );
  }
}

class BranchOption {
  const BranchOption({
    required this.id,
    required this.name,
    this.isActive = true,
  });

  final String id;
  final String name;
  final bool isActive;

  factory BranchOption.fromJson(Map<String, dynamic> json) {
    return BranchOption(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Branch',
      isActive: json['isActive'] != false,
    );
  }
}

/// Create expense request body
class CreateExpenseRequest {
  const CreateExpenseRequest({
    required this.description,
    required this.amount,
    required this.date,
    this.expenseAccountId,
    this.category,
    this.paymentMethod,
    this.paymentStatus = 'Fully paid',
    this.status = 'Pending',
    this.notes,
    this.merchant,
    this.taxAmount,
    this.taxRate,
    this.sourceAccountId,
    this.branchId,
    this.supplierId,
    this.paidAmount,
    this.paymentReference,
    this.taxTypeId,
    this.isHistorical,
    this.migrationBatch,
  });

  final String description;
  final double amount;
  final String date;
  final String? expenseAccountId;
  final String? category;
  final String? paymentMethod;
  final String paymentStatus;
  final String status;
  final String? notes;
  final String? merchant;
  final double? taxAmount;
  final double? taxRate;
  final String? sourceAccountId;
  final String? branchId;
  final String? supplierId;
  final double? paidAmount;
  final String? paymentReference;
  final String? taxTypeId;
  final bool? isHistorical;
  final String? migrationBatch;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'description': description,
      'amount': amount,
      'date': date,
      if (expenseAccountId != null) 'expenseAccountId': expenseAccountId,
      if (category != null) 'category': category,
      if (paymentMethod != null) 'paymentMethod': paymentMethod,
      'paymentStatus': paymentStatus,
      'status': status,
      if (notes != null) 'notes': notes,
      if (merchant != null) 'merchant': merchant,
      if (taxAmount != null) 'taxAmount': taxAmount,
      if (taxRate != null) 'taxRate': taxRate,
      if (taxTypeId != null) 'taxTypeId': taxTypeId,
      if (sourceAccountId != null) 'sourceAccountId': sourceAccountId,
      if (branchId != null) 'branchId': branchId,
      if (supplierId != null) 'supplierId': supplierId,
      if (paidAmount != null) 'paidAmount': paidAmount,
      if (paymentReference != null) 'paymentReference': paymentReference,
      if (isHistorical == true) 'isHistorical': true,
      if (migrationBatch != null && migrationBatch!.isNotEmpty)
        'migrationBatch': migrationBatch,
    };
  }
}

/// Update expense request body (partial)
class UpdateExpenseRequest {
  const UpdateExpenseRequest({
    this.description,
    this.amount,
    this.date,
    this.expenseAccountId,
    this.category,
    this.paymentMethod,
    this.paymentStatus,
    this.status,
    this.notes,
    this.merchant,
    this.paidAmount,
    this.paymentReference,
    this.taxAmount,
    this.taxRate,
    this.supplierId,
    this.branchId,
    this.taxTypeId,
  });

  final String? description;
  final double? amount;
  final String? date;
  final String? expenseAccountId;
  final String? category;
  final String? paymentMethod;
  final String? paymentStatus;
  final String? status;
  final String? notes;
  final String? merchant;
  final double? paidAmount;
  final String? paymentReference;
  final double? taxAmount;
  final double? taxRate;
  final String? supplierId;
  final String? branchId;
  final String? taxTypeId;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      if (description != null) 'description': description,
      if (amount != null) 'amount': amount,
      if (date != null) 'date': date,
      if (expenseAccountId != null) 'expenseAccountId': expenseAccountId,
      if (category != null) 'category': category,
      if (paymentMethod != null) 'paymentMethod': paymentMethod,
      if (paymentStatus != null) 'paymentStatus': paymentStatus,
      if (status != null) 'status': status,
      if (notes != null) 'notes': notes,
      if (merchant != null) 'merchant': merchant,
      if (paidAmount != null) 'paidAmount': paidAmount,
      if (paymentReference != null) 'paymentReference': paymentReference,
      if (taxAmount != null) 'taxAmount': taxAmount,
      if (taxRate != null) 'taxRate': taxRate,
      if (taxTypeId != null) 'taxTypeId': taxTypeId,
      if (supplierId != null) 'supplierId': supplierId,
      if (branchId != null) 'branchId': branchId,
    };
  }
}

/// Partial payment request
class AddPartialPaymentRequest {
  const AddPartialPaymentRequest({
    required this.expenseId,
    required this.amount,
    required this.paymentMethod,
    required this.paymentDate,
    this.reference,
    this.notes,
  });

  final String expenseId;
  final double amount;
  final String paymentMethod;
  final String paymentDate;
  final String? reference;
  final String? notes;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'expenseId': expenseId,
      'amount': amount,
      'paymentMethod': paymentMethod,
      'paymentDate': paymentDate,
      if (reference != null) 'reference': reference,
      if (notes != null) 'notes': notes,
    };
  }
}
