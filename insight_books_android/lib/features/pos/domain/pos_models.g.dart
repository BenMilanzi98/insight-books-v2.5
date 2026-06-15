// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pos_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PosProduct _$PosProductFromJson(Map<String, dynamic> json) => _PosProduct(
  id: json['id'] as String,
  name: json['name'] as String,
  sku: json['sku'] as String?,
  barcode: json['barcode'] as String?,
  price: (json['price'] as num).toDouble(),
  stockLevel: (json['stockLevel'] as num?)?.toDouble(),
  category: json['category'] as String?,
  accountId: json['accountId'] as String?,
  taxes:
      (json['taxes'] as List<dynamic>?)
          ?.map((e) => ProductTax.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  units:
      (json['units'] as List<dynamic>?)
          ?.map((e) => ProductUnit.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  barcodes:
      (json['barcodes'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const [],
  isPerishable: json['isPerishable'] as bool? ?? false,
  isService: json['isService'] as bool? ?? false,
  hasFlexibleUnits: json['hasFlexibleUnits'] as bool? ?? false,
  nearestExpiryDate: json['nearestExpiryDate'] as String?,
  expiresWithinDays: (json['expiresWithinDays'] as num?)?.toInt(),
  expiryAlertLevel: json['expiryAlertLevel'] as String?,
);

Map<String, dynamic> _$PosProductToJson(_PosProduct instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'sku': instance.sku,
      'barcode': instance.barcode,
      'price': instance.price,
      'stockLevel': instance.stockLevel,
      'category': instance.category,
      'accountId': instance.accountId,
      'taxes': instance.taxes,
      'units': instance.units,
      'barcodes': instance.barcodes,
      'isPerishable': instance.isPerishable,
      'isService': instance.isService,
      'hasFlexibleUnits': instance.hasFlexibleUnits,
      'nearestExpiryDate': instance.nearestExpiryDate,
      'expiresWithinDays': instance.expiresWithinDays,
      'expiryAlertLevel': instance.expiryAlertLevel,
    };

_ProductTax _$ProductTaxFromJson(Map<String, dynamic> json) => _ProductTax(
  id: json['id'] as String,
  taxName: json['taxName'] as String,
  taxRate: (json['taxRate'] as num).toDouble(),
);

Map<String, dynamic> _$ProductTaxToJson(_ProductTax instance) =>
    <String, dynamic>{
      'id': instance.id,
      'taxName': instance.taxName,
      'taxRate': instance.taxRate,
    };

_ProductUnit _$ProductUnitFromJson(Map<String, dynamic> json) => _ProductUnit(
  id: json['id'] as String,
  unitName: json['unitName'] as String,
  symbol: json['symbol'] as String?,
  conversionRate: (json['conversionRate'] as num).toDouble(),
  conversionToBase: (json['conversionToBase'] as num?)?.toDouble(),
  unitPrice: (json['unitPrice'] as num?)?.toDouble(),
  isBaseUnit: json['isBaseUnit'] as bool,
);

Map<String, dynamic> _$ProductUnitToJson(_ProductUnit instance) =>
    <String, dynamic>{
      'id': instance.id,
      'unitName': instance.unitName,
      'symbol': instance.symbol,
      'conversionRate': instance.conversionRate,
      'conversionToBase': instance.conversionToBase,
      'unitPrice': instance.unitPrice,
      'isBaseUnit': instance.isBaseUnit,
    };

_PosClient _$PosClientFromJson(Map<String, dynamic> json) => _PosClient(
  id: json['id'] as String,
  name: json['name'] as String,
  email: json['email'] as String?,
  phone: json['phone'] as String?,
);

Map<String, dynamic> _$PosClientToJson(_PosClient instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'email': instance.email,
      'phone': instance.phone,
    };

_CartItem _$CartItemFromJson(Map<String, dynamic> json) => _CartItem(
  product: PosProduct.fromJson(json['product'] as Map<String, dynamic>),
  quantity: (json['quantity'] as num?)?.toDouble() ?? 1,
  discount: (json['discount'] as num?)?.toDouble() ?? 0,
  discountAmount: (json['discountAmount'] as num?)?.toDouble() ?? 0,
  taxAmount: (json['taxAmount'] as num?)?.toDouble() ?? 0,
  taxBreakdown:
      (json['taxBreakdown'] as List<dynamic>?)
          ?.map((e) => TaxBreakdown.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  unitQuantities: (json['unitQuantities'] as Map<String, dynamic>?)?.map(
    (k, e) => MapEntry(k, (e as num).toDouble()),
  ),
  notes: json['notes'] as String?,
);

Map<String, dynamic> _$CartItemToJson(_CartItem instance) => <String, dynamic>{
  'product': instance.product,
  'quantity': instance.quantity,
  'discount': instance.discount,
  'discountAmount': instance.discountAmount,
  'taxAmount': instance.taxAmount,
  'taxBreakdown': instance.taxBreakdown,
  'unitQuantities': instance.unitQuantities,
  'notes': instance.notes,
};

_TaxBreakdown _$TaxBreakdownFromJson(Map<String, dynamic> json) =>
    _TaxBreakdown(
      taxName: json['taxName'] as String,
      rate: (json['rate'] as num).toDouble(),
      amount: (json['amount'] as num).toDouble(),
    );

Map<String, dynamic> _$TaxBreakdownToJson(_TaxBreakdown instance) =>
    <String, dynamic>{
      'taxName': instance.taxName,
      'rate': instance.rate,
      'amount': instance.amount,
    };

_PaymentAllocation _$PaymentAllocationFromJson(Map<String, dynamic> json) =>
    _PaymentAllocation(
      paymentAccountId: json['paymentAccountId'] as String,
      amount: (json['amount'] as num).toDouble(),
    );

Map<String, dynamic> _$PaymentAllocationToJson(_PaymentAllocation instance) =>
    <String, dynamic>{
      'paymentAccountId': instance.paymentAccountId,
      'amount': instance.amount,
    };

_SaleRequest _$SaleRequestFromJson(Map<String, dynamic> json) => _SaleRequest(
  clientId: json['clientId'] as String?,
  branchId: json['branchId'] as String?,
  items: (json['items'] as List<dynamic>)
      .map((e) => SaleItemRequest.fromJson(e as Map<String, dynamic>))
      .toList(),
  subtotal: (json['subtotal'] as num).toDouble(),
  totalTaxAmount: (json['totalTaxAmount'] as num).toDouble(),
  totalDiscountAmount: (json['totalDiscountAmount'] as num).toDouble(),
  globalDiscount: (json['globalDiscount'] as num?)?.toDouble() ?? 0,
  total: (json['total'] as num).toDouble(),
  paymentAllocations: (json['paymentAllocations'] as List<dynamic>?)
      ?.map((e) => PaymentAllocation.fromJson(e as Map<String, dynamic>))
      .toList(),
  paymentMethod: json['paymentMethod'] as String?,
  notes: json['notes'] as String?,
  status: json['status'] as String? ?? 'completed',
);

Map<String, dynamic> _$SaleRequestToJson(_SaleRequest instance) =>
    <String, dynamic>{
      'clientId': instance.clientId,
      'branchId': instance.branchId,
      'items': instance.items,
      'subtotal': instance.subtotal,
      'totalTaxAmount': instance.totalTaxAmount,
      'totalDiscountAmount': instance.totalDiscountAmount,
      'globalDiscount': instance.globalDiscount,
      'total': instance.total,
      'paymentAllocations': instance.paymentAllocations,
      'paymentMethod': instance.paymentMethod,
      'notes': instance.notes,
      'status': instance.status,
    };

_SaleItemRequest _$SaleItemRequestFromJson(Map<String, dynamic> json) =>
    _SaleItemRequest(
      productId: json['productId'] as String?,
      description: json['description'] as String,
      quantity: (json['quantity'] as num).toDouble(),
      unitPrice: (json['unitPrice'] as num).toDouble(),
      taxRate: (json['taxRate'] as num?)?.toDouble() ?? 0,
      taxAmount: (json['taxAmount'] as num?)?.toDouble() ?? 0,
      taxDescription: json['taxDescription'] as String?,
      discount: (json['discount'] as num?)?.toDouble() ?? 0,
      discountAmount: (json['discountAmount'] as num?)?.toDouble() ?? 0,
      isCustom: json['isCustom'] as bool? ?? false,
      accountId: json['accountId'] as String?,
      unitQuantities: (json['unitQuantities'] as Map<String, dynamic>?)?.map(
        (k, e) => MapEntry(k, (e as num).toDouble()),
      ),
    );

Map<String, dynamic> _$SaleItemRequestToJson(_SaleItemRequest instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'description': instance.description,
      'quantity': instance.quantity,
      'unitPrice': instance.unitPrice,
      'taxRate': instance.taxRate,
      'taxAmount': instance.taxAmount,
      'taxDescription': instance.taxDescription,
      'discount': instance.discount,
      'discountAmount': instance.discountAmount,
      'isCustom': instance.isCustom,
      'accountId': instance.accountId,
      'unitQuantities': instance.unitQuantities,
    };
