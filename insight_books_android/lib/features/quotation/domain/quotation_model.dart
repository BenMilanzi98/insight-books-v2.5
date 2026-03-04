// Quotation domain models - plain Dart (no code generation required).

double _toDouble(dynamic value) {
  if (value == null) return 0.0;
  if (value is num) return value.toDouble();
  if (value is String) {
    return double.tryParse(value.replaceAll(',', '')) ?? 0.0;
  }
  return 0.0;
}

class Quotation {
  const Quotation({
    required this.id,
    required this.quotationNumber,
    required this.title,
    required this.client,
    required this.clientId,
    this.clientEmail,
    this.clientPhone,
    this.contactPerson,
    this.preparedBy,
    required this.date,
    required this.validUntil,
    required this.amount,
    this.discount = 0,
    this.subtotal = 0,
    this.taxAmount = 0,
    required this.status,
    this.notes,
    this.orderNumber,
    this.items = const [],
  });

  final String id;
  final String quotationNumber;
  final String title;
  final String client;
  final String clientId;
  final String? clientEmail;
  final String? clientPhone;
  final String? contactPerson;
  final String? preparedBy;
  final String date;
  final String validUntil;
  final double amount;
  final double discount;
  final double subtotal;
  final double taxAmount;
  final String status;
  final String? notes;
  final String? orderNumber;
  final List<QuotationItem> items;

  factory Quotation.fromJson(Map<String, dynamic> json) {
    final itemsList = json['items'] as List<dynamic>? ?? [];
    return Quotation(
      id: json['id'] as String,
      quotationNumber: json['quotationNumber'] as String,
      title: json['title'] as String? ?? 'Quotation',
      client: json['client'] is String
          ? json['client'] as String
          : (json['client'] as Map<String, dynamic>?)?['name'] as String? ??
              'Unknown',
      clientId: json['clientId'] as String,
      clientEmail: json['clientEmail'] as String?,
      clientPhone: json['clientPhone'] as String?,
      contactPerson: json['contactPerson'] as String?,
      preparedBy: json['preparedBy'] as String?,
      date: json['date'] as String? ?? '',
      validUntil: json['validUntil'] as String? ?? '',
      amount: _toDouble(json['amount']),
      discount: _toDouble(json['discount']),
      subtotal: _toDouble(json['subtotal']),
      taxAmount: _toDouble(json['taxAmount']),
      status: json['status'] as String? ?? 'Draft',
      notes: json['notes'] as String?,
      orderNumber: json['orderNumber'] as String?,
      items: itemsList
          .map((e) => QuotationItem.fromJson(
              Map<String, dynamic>.from(e as Map<dynamic, dynamic>)))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'quotationNumber': quotationNumber,
        'title': title,
        'client': client,
        'clientId': clientId,
        'clientEmail': clientEmail,
        'clientPhone': clientPhone,
        'contactPerson': contactPerson,
        'preparedBy': preparedBy,
        'date': date,
        'validUntil': validUntil,
        'amount': amount,
        'discount': discount,
        'subtotal': subtotal,
        'taxAmount': taxAmount,
        'status': status,
        'notes': notes,
        'orderNumber': orderNumber,
        'items': items.map((e) => e.toJson()).toList(),
      };
}

class QuotationItem {
  const QuotationItem({
    required this.id,
    required this.description,
    required this.quantity,
    required this.unitPrice,
    this.taxRate = 0,
    this.discountAmount = 0,
    required this.amount,
    this.productId,
  });

  final String id;
  final String description;
  final double quantity;
  final double unitPrice;
  final double taxRate;
  final double discountAmount;
  final double amount;
  final String? productId;

  factory QuotationItem.fromJson(Map<String, dynamic> json) => QuotationItem(
        id: json['id'] as String? ?? '',
        description: json['description'] as String? ?? '',
        quantity: _toDouble(json['quantity']),
        unitPrice: _toDouble(json['unitPrice']),
        taxRate: _toDouble(json['taxRate']),
        discountAmount: _toDouble(json['discountAmount']),
        amount: _toDouble(json['amount']),
        productId: json['productId'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'description': description,
        'quantity': quantity,
        'unitPrice': unitPrice,
        'taxRate': taxRate,
        'discountAmount': discountAmount,
        'amount': amount,
        'productId': productId,
      };
}

class QuotationStatistics {
  const QuotationStatistics({
    required this.pending,
    required this.approved,
    required this.converted,
    this.expired = const QuotationStatBucket(),
  });

  final QuotationStatBucket pending;
  final QuotationStatBucket approved;
  final QuotationStatBucket converted;
  final QuotationStatBucket expired;

  factory QuotationStatistics.fromJson(Map<String, dynamic> json) =>
      QuotationStatistics(
        pending: QuotationStatBucket.fromJson(
            Map<String, dynamic>.from(json['pending'] as Map? ?? {})),
        approved: QuotationStatBucket.fromJson(
            Map<String, dynamic>.from(json['approved'] as Map? ?? {})),
        converted: QuotationStatBucket.fromJson(
            Map<String, dynamic>.from(json['converted'] as Map? ?? {})),
        expired: json['expired'] != null
            ? QuotationStatBucket.fromJson(
                Map<String, dynamic>.from(json['expired'] as Map))
            : const QuotationStatBucket(),
      );
}

class QuotationStatBucket {
  const QuotationStatBucket({this.count = 0, this.total = 0});

  final int count;
  final double total;

  factory QuotationStatBucket.fromJson(Map<String, dynamic> json) =>
      QuotationStatBucket(
        count: (json['count'] as num?)?.toInt() ?? 0,
        total: _toDouble(json['total']),
      );
}

class CreateQuotationRequest {
  const CreateQuotationRequest({
    required this.clientId,
    required this.title,
    this.orderNumber,
    required this.issueDate,
    required this.validUntil,
    this.discount = 0,
    required this.items,
    this.notes,
    this.status = 'Draft',
  });

  final String clientId;
  final String title;
  final String? orderNumber;
  final String issueDate;
  final String validUntil;
  final double discount;
  final List<CreateQuotationItemRequest> items;
  final String? notes;
  final String status;

  Map<String, dynamic> toJson() => {
        'clientId': clientId,
        'title': title,
        if (orderNumber != null && orderNumber!.isNotEmpty) 'orderNumber': orderNumber,
        'issueDate': issueDate,
        'validUntil': validUntil,
        'discount': discount,
        'items': items.map((e) => e.toJson()).toList(),
        if (notes != null) 'notes': notes,
        'status': status,
      };
}

class CreateQuotationItemRequest {
  const CreateQuotationItemRequest({
    required this.description,
    required this.quantity,
    required this.unitPrice,
    this.taxRate = 0,
    this.discountAmount = 0,
    this.productId,
  });

  final String description;
  final double quantity;
  final double unitPrice;
  final double taxRate;
  final double discountAmount;
  final String? productId;

  Map<String, dynamic> toJson() => {
        'description': description,
        'quantity': quantity,
        'unitPrice': unitPrice,
        'taxRate': taxRate,
        'discountAmount': discountAmount,
        if (productId != null) 'productId': productId,
      };
}
