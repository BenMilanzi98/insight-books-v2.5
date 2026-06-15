import 'package:freezed_annotation/freezed_annotation.dart';

part 'pos_models.freezed.dart';
part 'pos_models.g.dart';

@freezed
abstract class PosProduct with _$PosProduct {
  const PosProduct._();

  const factory PosProduct({
    required String id,
    required String name,
    String? sku,
    String? barcode,
    required double price,
    double? stockLevel,
    String? category,
    String? accountId,
    @Default([]) List<ProductTax> taxes,
    @Default([]) List<ProductUnit> units,
    @Default([]) List<String> barcodes,
    @Default(false) bool isPerishable,
    @Default(false) bool isService,
    @Default(false) bool hasFlexibleUnits,
    String? nearestExpiryDate,
    int? expiresWithinDays,
    String? expiryAlertLevel,
  }) = _PosProduct;

  bool get hasExpiryWarning =>
      expiryAlertLevel == 'warning' || expiryAlertLevel == 'expired';

  String? get expiryBadgeLabel {
    if (expiryAlertLevel == 'expired') return 'Expired';
    if (expiryAlertLevel == 'warning' && expiresWithinDays != null) {
      return 'Exp ${expiresWithinDays}d';
    }
    if (expiryAlertLevel == 'warning') return 'Expiring soon';
    return null;
  }

  factory PosProduct.fromJson(Map<String, dynamic> json) =>
      _$PosProductFromJson(json);
}

@freezed
abstract class ProductTax with _$ProductTax {
  const factory ProductTax({
    required String id,
    required String taxName,
    required double taxRate,
  }) = _ProductTax;

  factory ProductTax.fromJson(Map<String, dynamic> json) =>
      _$ProductTaxFromJson(json);
}

@freezed
abstract class ProductUnit with _$ProductUnit {
  const factory ProductUnit({
    required String id,
    required String unitName,
    String? symbol,
    required double conversionRate,
    double? conversionToBase,
    required double? unitPrice,
    required bool isBaseUnit,
  }) = _ProductUnit;

  factory ProductUnit.fromJson(Map<String, dynamic> json) =>
      _$ProductUnitFromJson(json);
}

@freezed
abstract class PosClient with _$PosClient {
  const factory PosClient({
    required String id,
    required String name,
    String? email,
    String? phone,
  }) = _PosClient;

  factory PosClient.fromJson(Map<String, dynamic> json) =>
      _$PosClientFromJson(json);
}

@freezed
abstract class CartItem with _$CartItem {
  const factory CartItem({
    required PosProduct product,
    @Default(1) double quantity,
    @Default(0) double discount, // Per unit discount
    @Default(0) double discountAmount, // Total discount for this line
    @Default(0) double taxAmount,
    @Default([]) List<TaxBreakdown> taxBreakdown,
    Map<String, double>? unitQuantities, // For unit-managed products
    String? notes,
  }) = _CartItem;

  factory CartItem.fromJson(Map<String, dynamic> json) =>
      _$CartItemFromJson(json);
}

@freezed
abstract class TaxBreakdown with _$TaxBreakdown {
  const factory TaxBreakdown({
    required String taxName,
    required double rate,
    required double amount,
  }) = _TaxBreakdown;

  factory TaxBreakdown.fromJson(Map<String, dynamic> json) =>
      _$TaxBreakdownFromJson(json);
}

@freezed
abstract class PaymentAllocation with _$PaymentAllocation {
  const factory PaymentAllocation({
    required String paymentAccountId,
    required double amount,
  }) = _PaymentAllocation;

  factory PaymentAllocation.fromJson(Map<String, dynamic> json) =>
      _$PaymentAllocationFromJson(json);
}

@freezed
abstract class SaleRequest with _$SaleRequest {
  const factory SaleRequest({
    String? clientId,
    String? branchId,
    required List<SaleItemRequest> items,
    required double subtotal,
    required double totalTaxAmount,
    required double totalDiscountAmount,
    @Default(0) double globalDiscount,
    required double total,
    List<PaymentAllocation>? paymentAllocations,
    String? paymentMethod, // Legacy support
    String? notes,
    @Default('completed') String status,
  }) = _SaleRequest;

  factory SaleRequest.fromJson(Map<String, dynamic> json) =>
      _$SaleRequestFromJson(json);
}

@freezed
abstract class SaleItemRequest with _$SaleItemRequest {
  const factory SaleItemRequest({
    String? productId,
    required String description,
    required double quantity,
    required double unitPrice,
    @Default(0) double taxRate,
    @Default(0) double taxAmount,
    String? taxDescription,
    @Default(0) double discount,
    @Default(0) double discountAmount,
    @Default(false) bool isCustom,
    String? accountId,
    Map<String, double>? unitQuantities,
  }) = _SaleItemRequest;

  factory SaleItemRequest.fromJson(Map<String, dynamic> json) =>
      _$SaleItemRequestFromJson(json);
}
