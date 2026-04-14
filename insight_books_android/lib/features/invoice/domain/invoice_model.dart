import 'package:freezed_annotation/freezed_annotation.dart';
import '../../pos/domain/pos_models.dart';

part 'invoice_model.freezed.dart';
part 'invoice_model.g.dart';

@freezed
abstract class Invoice with _$Invoice {
  const factory Invoice({
    required String id,
    required String invoiceNumber,
    required PosClient client,
    required List<InvoiceItem> items,
    required double subtotal,
    required double totalTax,
    required double totalDiscount,
    required double total,
    required String status,
    required DateTime dueDate,
    required DateTime createdAt,
    DateTime? issueDate,
    @Default('MWK') String currency,
    String? title,
    String? orderNumber,
    String? terms,
    String? notes,
    String? templateId,
    @Default(0) double totalPaid,
    @Default(0) double remainingBalance,
    @Default(0) double amountDue,
    @Default([]) List<InvoicePayment> payments,
  }) = _Invoice;

  factory Invoice.fromJson(Map<String, dynamic> json) =>
      _$InvoiceFromJson(json);
}

@freezed
abstract class InvoiceItem with _$InvoiceItem {
  const factory InvoiceItem({
    required String id,
    required PosProduct product,
    required double quantity,
    required double unitPrice,
    required double taxRate,
    required double taxAmount,
    required double discount,
    required double total,
    String? description,
  }) = _InvoiceItem;

  factory InvoiceItem.fromJson(Map<String, dynamic> json) =>
      _$InvoiceItemFromJson(json);
}

@freezed
abstract class InvoicePayment with _$InvoicePayment {
  const factory InvoicePayment({
    required String id,
    required double amount,
    required String paymentMethod,
    String? paymentDate,
    String? reference,
    String? notes,
    @Default('Completed') String status,
  }) = _InvoicePayment;

  factory InvoicePayment.fromJson(Map<String, dynamic> json) =>
      _$InvoicePaymentFromJson(json);
}

@freezed
abstract class InvoiceStatistics with _$InvoiceStatistics {
  const factory InvoiceStatistics({
    required InvoiceStatBucket paid,
    required InvoiceStatBucket pending,
    required InvoiceStatBucket overdue,
    required InvoiceStatBucket partial,
    required InvoiceStatBucket draft,
  }) = _InvoiceStatistics;

  factory InvoiceStatistics.fromJson(Map<String, dynamic> json) =>
      _$InvoiceStatisticsFromJson(json);
}

@freezed
abstract class InvoiceStatBucket with _$InvoiceStatBucket {
  const factory InvoiceStatBucket({
    @Default(0) int count,
    @Default(0) double amount,
  }) = _InvoiceStatBucket;

  factory InvoiceStatBucket.fromJson(Map<String, dynamic> json) =>
      _$InvoiceStatBucketFromJson(json);
}

@freezed
abstract class CreateInvoiceRequest with _$CreateInvoiceRequest {
  const factory CreateInvoiceRequest({
    required String clientId,
    required List<CreateInvoiceItemRequest> items,
    required DateTime dueDate,
    String? terms,
    String? notes,
    @Default('sent') String status,
  }) = _CreateInvoiceRequest;

  factory CreateInvoiceRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateInvoiceRequestFromJson(json);
}

@freezed
abstract class CreateInvoiceItemRequest with _$CreateInvoiceItemRequest {
  const factory CreateInvoiceItemRequest({
    required String productId,
    required double quantity,
    required double unitPrice,
    String? description,
  }) = _CreateInvoiceItemRequest;

  factory CreateInvoiceItemRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateInvoiceItemRequestFromJson(json);
}

class InvoiceListResponse {
  final List<Invoice> invoices;
  final int totalPages;
  final int totalCount;
  final int page;
  final int limit;

  InvoiceListResponse({
    required this.invoices,
    this.totalPages = 1,
    this.totalCount = 0,
    this.page = 1,
    this.limit = 20,
  });
}
