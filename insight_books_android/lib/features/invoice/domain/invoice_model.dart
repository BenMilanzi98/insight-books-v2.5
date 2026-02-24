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
    required String status, // 'draft', 'sent', 'paid', 'overdue', 'cancelled'
    required DateTime dueDate,
    required DateTime createdAt,
    @Default('MWK') String currency,
    String? terms,
    String? notes,
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
