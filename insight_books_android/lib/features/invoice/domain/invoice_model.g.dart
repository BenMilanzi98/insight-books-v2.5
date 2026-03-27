// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Invoice _$InvoiceFromJson(Map<String, dynamic> json) => _Invoice(
  id: json['id'] as String,
  invoiceNumber: json['invoiceNumber'] as String,
  client: PosClient.fromJson(json['client'] as Map<String, dynamic>),
  items: (json['items'] as List<dynamic>)
      .map((e) => InvoiceItem.fromJson(e as Map<String, dynamic>))
      .toList(),
  subtotal: (json['subtotal'] as num).toDouble(),
  totalTax: (json['totalTax'] as num).toDouble(),
  totalDiscount: (json['totalDiscount'] as num).toDouble(),
  total: (json['total'] as num).toDouble(),
  status: json['status'] as String,
  dueDate: DateTime.parse(json['dueDate'] as String),
  createdAt: DateTime.parse(json['createdAt'] as String),
  issueDate: json['issueDate'] == null
      ? null
      : DateTime.parse(json['issueDate'] as String),
  currency: json['currency'] as String? ?? 'MWK',
  title: json['title'] as String?,
  orderNumber: json['orderNumber'] as String?,
  terms: json['terms'] as String?,
  notes: json['notes'] as String?,
  totalPaid: (json['totalPaid'] as num?)?.toDouble() ?? 0,
  remainingBalance: (json['remainingBalance'] as num?)?.toDouble() ?? 0,
  amountDue: (json['amountDue'] as num?)?.toDouble() ?? 0,
  payments:
      (json['payments'] as List<dynamic>?)
          ?.map((e) => InvoicePayment.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$InvoiceToJson(_Invoice instance) => <String, dynamic>{
  'id': instance.id,
  'invoiceNumber': instance.invoiceNumber,
  'client': instance.client,
  'items': instance.items,
  'subtotal': instance.subtotal,
  'totalTax': instance.totalTax,
  'totalDiscount': instance.totalDiscount,
  'total': instance.total,
  'status': instance.status,
  'dueDate': instance.dueDate.toIso8601String(),
  'createdAt': instance.createdAt.toIso8601String(),
  'issueDate': instance.issueDate?.toIso8601String(),
  'currency': instance.currency,
  'title': instance.title,
  'orderNumber': instance.orderNumber,
  'terms': instance.terms,
  'notes': instance.notes,
  'totalPaid': instance.totalPaid,
  'remainingBalance': instance.remainingBalance,
  'amountDue': instance.amountDue,
  'payments': instance.payments,
};

_InvoiceItem _$InvoiceItemFromJson(Map<String, dynamic> json) => _InvoiceItem(
  id: json['id'] as String,
  product: PosProduct.fromJson(json['product'] as Map<String, dynamic>),
  quantity: (json['quantity'] as num).toDouble(),
  unitPrice: (json['unitPrice'] as num).toDouble(),
  taxRate: (json['taxRate'] as num).toDouble(),
  taxAmount: (json['taxAmount'] as num).toDouble(),
  discount: (json['discount'] as num).toDouble(),
  total: (json['total'] as num).toDouble(),
  description: json['description'] as String?,
);

Map<String, dynamic> _$InvoiceItemToJson(_InvoiceItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'product': instance.product,
      'quantity': instance.quantity,
      'unitPrice': instance.unitPrice,
      'taxRate': instance.taxRate,
      'taxAmount': instance.taxAmount,
      'discount': instance.discount,
      'total': instance.total,
      'description': instance.description,
    };

_InvoicePayment _$InvoicePaymentFromJson(Map<String, dynamic> json) =>
    _InvoicePayment(
      id: json['id'] as String,
      amount: (json['amount'] as num).toDouble(),
      paymentMethod: json['paymentMethod'] as String,
      paymentDate: json['paymentDate'] as String?,
      reference: json['reference'] as String?,
      notes: json['notes'] as String?,
      status: json['status'] as String? ?? 'Completed',
    );

Map<String, dynamic> _$InvoicePaymentToJson(_InvoicePayment instance) =>
    <String, dynamic>{
      'id': instance.id,
      'amount': instance.amount,
      'paymentMethod': instance.paymentMethod,
      'paymentDate': instance.paymentDate,
      'reference': instance.reference,
      'notes': instance.notes,
      'status': instance.status,
    };

_InvoiceStatistics _$InvoiceStatisticsFromJson(
  Map<String, dynamic> json,
) => _InvoiceStatistics(
  paid: InvoiceStatBucket.fromJson(json['paid'] as Map<String, dynamic>),
  pending: InvoiceStatBucket.fromJson(json['pending'] as Map<String, dynamic>),
  overdue: InvoiceStatBucket.fromJson(json['overdue'] as Map<String, dynamic>),
  partial: InvoiceStatBucket.fromJson(json['partial'] as Map<String, dynamic>),
  draft: InvoiceStatBucket.fromJson(json['draft'] as Map<String, dynamic>),
);

Map<String, dynamic> _$InvoiceStatisticsToJson(_InvoiceStatistics instance) =>
    <String, dynamic>{
      'paid': instance.paid,
      'pending': instance.pending,
      'overdue': instance.overdue,
      'partial': instance.partial,
      'draft': instance.draft,
    };

_InvoiceStatBucket _$InvoiceStatBucketFromJson(Map<String, dynamic> json) =>
    _InvoiceStatBucket(
      count: (json['count'] as num?)?.toInt() ?? 0,
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
    );

Map<String, dynamic> _$InvoiceStatBucketToJson(_InvoiceStatBucket instance) =>
    <String, dynamic>{'count': instance.count, 'amount': instance.amount};

_CreateInvoiceRequest _$CreateInvoiceRequestFromJson(
  Map<String, dynamic> json,
) => _CreateInvoiceRequest(
  clientId: json['clientId'] as String,
  items: (json['items'] as List<dynamic>)
      .map((e) => CreateInvoiceItemRequest.fromJson(e as Map<String, dynamic>))
      .toList(),
  dueDate: DateTime.parse(json['dueDate'] as String),
  terms: json['terms'] as String?,
  notes: json['notes'] as String?,
  status: json['status'] as String? ?? 'sent',
);

Map<String, dynamic> _$CreateInvoiceRequestToJson(
  _CreateInvoiceRequest instance,
) => <String, dynamic>{
  'clientId': instance.clientId,
  'items': instance.items,
  'dueDate': instance.dueDate.toIso8601String(),
  'terms': instance.terms,
  'notes': instance.notes,
  'status': instance.status,
};

_CreateInvoiceItemRequest _$CreateInvoiceItemRequestFromJson(
  Map<String, dynamic> json,
) => _CreateInvoiceItemRequest(
  productId: json['productId'] as String,
  quantity: (json['quantity'] as num).toDouble(),
  unitPrice: (json['unitPrice'] as num).toDouble(),
  description: json['description'] as String?,
);

Map<String, dynamic> _$CreateInvoiceItemRequestToJson(
  _CreateInvoiceItemRequest instance,
) => <String, dynamic>{
  'productId': instance.productId,
  'quantity': instance.quantity,
  'unitPrice': instance.unitPrice,
  'description': instance.description,
};
