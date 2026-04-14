// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'invoice_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Invoice {

 String get id; String get invoiceNumber; PosClient get client; List<InvoiceItem> get items; double get subtotal; double get totalTax; double get totalDiscount; double get total; String get status; DateTime get dueDate; DateTime get createdAt; DateTime? get issueDate; String get currency; String? get title; String? get orderNumber; String? get terms; String? get notes; String? get templateId; double get totalPaid; double get remainingBalance; double get amountDue; List<InvoicePayment> get payments;
/// Create a copy of Invoice
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InvoiceCopyWith<Invoice> get copyWith => _$InvoiceCopyWithImpl<Invoice>(this as Invoice, _$identity);

  /// Serializes this Invoice to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Invoice&&(identical(other.id, id) || other.id == id)&&(identical(other.invoiceNumber, invoiceNumber) || other.invoiceNumber == invoiceNumber)&&(identical(other.client, client) || other.client == client)&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.totalTax, totalTax) || other.totalTax == totalTax)&&(identical(other.totalDiscount, totalDiscount) || other.totalDiscount == totalDiscount)&&(identical(other.total, total) || other.total == total)&&(identical(other.status, status) || other.status == status)&&(identical(other.dueDate, dueDate) || other.dueDate == dueDate)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.issueDate, issueDate) || other.issueDate == issueDate)&&(identical(other.currency, currency) || other.currency == currency)&&(identical(other.title, title) || other.title == title)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.terms, terms) || other.terms == terms)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.templateId, templateId) || other.templateId == templateId)&&(identical(other.totalPaid, totalPaid) || other.totalPaid == totalPaid)&&(identical(other.remainingBalance, remainingBalance) || other.remainingBalance == remainingBalance)&&(identical(other.amountDue, amountDue) || other.amountDue == amountDue)&&const DeepCollectionEquality().equals(other.payments, payments));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,invoiceNumber,client,const DeepCollectionEquality().hash(items),subtotal,totalTax,totalDiscount,total,status,dueDate,createdAt,issueDate,currency,title,orderNumber,terms,notes,templateId,totalPaid,remainingBalance,amountDue,const DeepCollectionEquality().hash(payments)]);

@override
String toString() {
  return 'Invoice(id: $id, invoiceNumber: $invoiceNumber, client: $client, items: $items, subtotal: $subtotal, totalTax: $totalTax, totalDiscount: $totalDiscount, total: $total, status: $status, dueDate: $dueDate, createdAt: $createdAt, issueDate: $issueDate, currency: $currency, title: $title, orderNumber: $orderNumber, terms: $terms, notes: $notes, templateId: $templateId, totalPaid: $totalPaid, remainingBalance: $remainingBalance, amountDue: $amountDue, payments: $payments)';
}


}

/// @nodoc
abstract mixin class $InvoiceCopyWith<$Res>  {
  factory $InvoiceCopyWith(Invoice value, $Res Function(Invoice) _then) = _$InvoiceCopyWithImpl;
@useResult
$Res call({
 String id, String invoiceNumber, PosClient client, List<InvoiceItem> items, double subtotal, double totalTax, double totalDiscount, double total, String status, DateTime dueDate, DateTime createdAt, DateTime? issueDate, String currency, String? title, String? orderNumber, String? terms, String? notes, String? templateId, double totalPaid, double remainingBalance, double amountDue, List<InvoicePayment> payments
});


$PosClientCopyWith<$Res> get client;

}
/// @nodoc
class _$InvoiceCopyWithImpl<$Res>
    implements $InvoiceCopyWith<$Res> {
  _$InvoiceCopyWithImpl(this._self, this._then);

  final Invoice _self;
  final $Res Function(Invoice) _then;

/// Create a copy of Invoice
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? invoiceNumber = null,Object? client = null,Object? items = null,Object? subtotal = null,Object? totalTax = null,Object? totalDiscount = null,Object? total = null,Object? status = null,Object? dueDate = null,Object? createdAt = null,Object? issueDate = freezed,Object? currency = null,Object? title = freezed,Object? orderNumber = freezed,Object? terms = freezed,Object? notes = freezed,Object? templateId = freezed,Object? totalPaid = null,Object? remainingBalance = null,Object? amountDue = null,Object? payments = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,invoiceNumber: null == invoiceNumber ? _self.invoiceNumber : invoiceNumber // ignore: cast_nullable_to_non_nullable
as String,client: null == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as PosClient,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<InvoiceItem>,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as double,totalTax: null == totalTax ? _self.totalTax : totalTax // ignore: cast_nullable_to_non_nullable
as double,totalDiscount: null == totalDiscount ? _self.totalDiscount : totalDiscount // ignore: cast_nullable_to_non_nullable
as double,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,dueDate: null == dueDate ? _self.dueDate : dueDate // ignore: cast_nullable_to_non_nullable
as DateTime,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,issueDate: freezed == issueDate ? _self.issueDate : issueDate // ignore: cast_nullable_to_non_nullable
as DateTime?,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,title: freezed == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String?,orderNumber: freezed == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String?,terms: freezed == terms ? _self.terms : terms // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,templateId: freezed == templateId ? _self.templateId : templateId // ignore: cast_nullable_to_non_nullable
as String?,totalPaid: null == totalPaid ? _self.totalPaid : totalPaid // ignore: cast_nullable_to_non_nullable
as double,remainingBalance: null == remainingBalance ? _self.remainingBalance : remainingBalance // ignore: cast_nullable_to_non_nullable
as double,amountDue: null == amountDue ? _self.amountDue : amountDue // ignore: cast_nullable_to_non_nullable
as double,payments: null == payments ? _self.payments : payments // ignore: cast_nullable_to_non_nullable
as List<InvoicePayment>,
  ));
}
/// Create a copy of Invoice
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PosClientCopyWith<$Res> get client {
  
  return $PosClientCopyWith<$Res>(_self.client, (value) {
    return _then(_self.copyWith(client: value));
  });
}
}


/// Adds pattern-matching-related methods to [Invoice].
extension InvoicePatterns on Invoice {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Invoice value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Invoice() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Invoice value)  $default,){
final _that = this;
switch (_that) {
case _Invoice():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Invoice value)?  $default,){
final _that = this;
switch (_that) {
case _Invoice() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String invoiceNumber,  PosClient client,  List<InvoiceItem> items,  double subtotal,  double totalTax,  double totalDiscount,  double total,  String status,  DateTime dueDate,  DateTime createdAt,  DateTime? issueDate,  String currency,  String? title,  String? orderNumber,  String? terms,  String? notes,  String? templateId,  double totalPaid,  double remainingBalance,  double amountDue,  List<InvoicePayment> payments)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Invoice() when $default != null:
return $default(_that.id,_that.invoiceNumber,_that.client,_that.items,_that.subtotal,_that.totalTax,_that.totalDiscount,_that.total,_that.status,_that.dueDate,_that.createdAt,_that.issueDate,_that.currency,_that.title,_that.orderNumber,_that.terms,_that.notes,_that.templateId,_that.totalPaid,_that.remainingBalance,_that.amountDue,_that.payments);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String invoiceNumber,  PosClient client,  List<InvoiceItem> items,  double subtotal,  double totalTax,  double totalDiscount,  double total,  String status,  DateTime dueDate,  DateTime createdAt,  DateTime? issueDate,  String currency,  String? title,  String? orderNumber,  String? terms,  String? notes,  String? templateId,  double totalPaid,  double remainingBalance,  double amountDue,  List<InvoicePayment> payments)  $default,) {final _that = this;
switch (_that) {
case _Invoice():
return $default(_that.id,_that.invoiceNumber,_that.client,_that.items,_that.subtotal,_that.totalTax,_that.totalDiscount,_that.total,_that.status,_that.dueDate,_that.createdAt,_that.issueDate,_that.currency,_that.title,_that.orderNumber,_that.terms,_that.notes,_that.templateId,_that.totalPaid,_that.remainingBalance,_that.amountDue,_that.payments);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String invoiceNumber,  PosClient client,  List<InvoiceItem> items,  double subtotal,  double totalTax,  double totalDiscount,  double total,  String status,  DateTime dueDate,  DateTime createdAt,  DateTime? issueDate,  String currency,  String? title,  String? orderNumber,  String? terms,  String? notes,  String? templateId,  double totalPaid,  double remainingBalance,  double amountDue,  List<InvoicePayment> payments)?  $default,) {final _that = this;
switch (_that) {
case _Invoice() when $default != null:
return $default(_that.id,_that.invoiceNumber,_that.client,_that.items,_that.subtotal,_that.totalTax,_that.totalDiscount,_that.total,_that.status,_that.dueDate,_that.createdAt,_that.issueDate,_that.currency,_that.title,_that.orderNumber,_that.terms,_that.notes,_that.templateId,_that.totalPaid,_that.remainingBalance,_that.amountDue,_that.payments);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Invoice implements Invoice {
  const _Invoice({required this.id, required this.invoiceNumber, required this.client, required final  List<InvoiceItem> items, required this.subtotal, required this.totalTax, required this.totalDiscount, required this.total, required this.status, required this.dueDate, required this.createdAt, this.issueDate, this.currency = 'MWK', this.title, this.orderNumber, this.terms, this.notes, this.templateId, this.totalPaid = 0, this.remainingBalance = 0, this.amountDue = 0, final  List<InvoicePayment> payments = const []}): _items = items,_payments = payments;
  factory _Invoice.fromJson(Map<String, dynamic> json) => _$InvoiceFromJson(json);

@override final  String id;
@override final  String invoiceNumber;
@override final  PosClient client;
 final  List<InvoiceItem> _items;
@override List<InvoiceItem> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  double subtotal;
@override final  double totalTax;
@override final  double totalDiscount;
@override final  double total;
@override final  String status;
@override final  DateTime dueDate;
@override final  DateTime createdAt;
@override final  DateTime? issueDate;
@override@JsonKey() final  String currency;
@override final  String? title;
@override final  String? orderNumber;
@override final  String? terms;
@override final  String? notes;
@override final  String? templateId;
@override@JsonKey() final  double totalPaid;
@override@JsonKey() final  double remainingBalance;
@override@JsonKey() final  double amountDue;
 final  List<InvoicePayment> _payments;
@override@JsonKey() List<InvoicePayment> get payments {
  if (_payments is EqualUnmodifiableListView) return _payments;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_payments);
}


/// Create a copy of Invoice
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InvoiceCopyWith<_Invoice> get copyWith => __$InvoiceCopyWithImpl<_Invoice>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InvoiceToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Invoice&&(identical(other.id, id) || other.id == id)&&(identical(other.invoiceNumber, invoiceNumber) || other.invoiceNumber == invoiceNumber)&&(identical(other.client, client) || other.client == client)&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.totalTax, totalTax) || other.totalTax == totalTax)&&(identical(other.totalDiscount, totalDiscount) || other.totalDiscount == totalDiscount)&&(identical(other.total, total) || other.total == total)&&(identical(other.status, status) || other.status == status)&&(identical(other.dueDate, dueDate) || other.dueDate == dueDate)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.issueDate, issueDate) || other.issueDate == issueDate)&&(identical(other.currency, currency) || other.currency == currency)&&(identical(other.title, title) || other.title == title)&&(identical(other.orderNumber, orderNumber) || other.orderNumber == orderNumber)&&(identical(other.terms, terms) || other.terms == terms)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.templateId, templateId) || other.templateId == templateId)&&(identical(other.totalPaid, totalPaid) || other.totalPaid == totalPaid)&&(identical(other.remainingBalance, remainingBalance) || other.remainingBalance == remainingBalance)&&(identical(other.amountDue, amountDue) || other.amountDue == amountDue)&&const DeepCollectionEquality().equals(other._payments, _payments));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,invoiceNumber,client,const DeepCollectionEquality().hash(_items),subtotal,totalTax,totalDiscount,total,status,dueDate,createdAt,issueDate,currency,title,orderNumber,terms,notes,templateId,totalPaid,remainingBalance,amountDue,const DeepCollectionEquality().hash(_payments)]);

@override
String toString() {
  return 'Invoice(id: $id, invoiceNumber: $invoiceNumber, client: $client, items: $items, subtotal: $subtotal, totalTax: $totalTax, totalDiscount: $totalDiscount, total: $total, status: $status, dueDate: $dueDate, createdAt: $createdAt, issueDate: $issueDate, currency: $currency, title: $title, orderNumber: $orderNumber, terms: $terms, notes: $notes, templateId: $templateId, totalPaid: $totalPaid, remainingBalance: $remainingBalance, amountDue: $amountDue, payments: $payments)';
}


}

/// @nodoc
abstract mixin class _$InvoiceCopyWith<$Res> implements $InvoiceCopyWith<$Res> {
  factory _$InvoiceCopyWith(_Invoice value, $Res Function(_Invoice) _then) = __$InvoiceCopyWithImpl;
@override @useResult
$Res call({
 String id, String invoiceNumber, PosClient client, List<InvoiceItem> items, double subtotal, double totalTax, double totalDiscount, double total, String status, DateTime dueDate, DateTime createdAt, DateTime? issueDate, String currency, String? title, String? orderNumber, String? terms, String? notes, String? templateId, double totalPaid, double remainingBalance, double amountDue, List<InvoicePayment> payments
});


@override $PosClientCopyWith<$Res> get client;

}
/// @nodoc
class __$InvoiceCopyWithImpl<$Res>
    implements _$InvoiceCopyWith<$Res> {
  __$InvoiceCopyWithImpl(this._self, this._then);

  final _Invoice _self;
  final $Res Function(_Invoice) _then;

/// Create a copy of Invoice
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? invoiceNumber = null,Object? client = null,Object? items = null,Object? subtotal = null,Object? totalTax = null,Object? totalDiscount = null,Object? total = null,Object? status = null,Object? dueDate = null,Object? createdAt = null,Object? issueDate = freezed,Object? currency = null,Object? title = freezed,Object? orderNumber = freezed,Object? terms = freezed,Object? notes = freezed,Object? templateId = freezed,Object? totalPaid = null,Object? remainingBalance = null,Object? amountDue = null,Object? payments = null,}) {
  return _then(_Invoice(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,invoiceNumber: null == invoiceNumber ? _self.invoiceNumber : invoiceNumber // ignore: cast_nullable_to_non_nullable
as String,client: null == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as PosClient,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<InvoiceItem>,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as double,totalTax: null == totalTax ? _self.totalTax : totalTax // ignore: cast_nullable_to_non_nullable
as double,totalDiscount: null == totalDiscount ? _self.totalDiscount : totalDiscount // ignore: cast_nullable_to_non_nullable
as double,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,dueDate: null == dueDate ? _self.dueDate : dueDate // ignore: cast_nullable_to_non_nullable
as DateTime,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,issueDate: freezed == issueDate ? _self.issueDate : issueDate // ignore: cast_nullable_to_non_nullable
as DateTime?,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,title: freezed == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String?,orderNumber: freezed == orderNumber ? _self.orderNumber : orderNumber // ignore: cast_nullable_to_non_nullable
as String?,terms: freezed == terms ? _self.terms : terms // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,templateId: freezed == templateId ? _self.templateId : templateId // ignore: cast_nullable_to_non_nullable
as String?,totalPaid: null == totalPaid ? _self.totalPaid : totalPaid // ignore: cast_nullable_to_non_nullable
as double,remainingBalance: null == remainingBalance ? _self.remainingBalance : remainingBalance // ignore: cast_nullable_to_non_nullable
as double,amountDue: null == amountDue ? _self.amountDue : amountDue // ignore: cast_nullable_to_non_nullable
as double,payments: null == payments ? _self._payments : payments // ignore: cast_nullable_to_non_nullable
as List<InvoicePayment>,
  ));
}

/// Create a copy of Invoice
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PosClientCopyWith<$Res> get client {
  
  return $PosClientCopyWith<$Res>(_self.client, (value) {
    return _then(_self.copyWith(client: value));
  });
}
}


/// @nodoc
mixin _$InvoiceItem {

 String get id; PosProduct get product; double get quantity; double get unitPrice; double get taxRate; double get taxAmount; double get discount; double get total; String? get description;
/// Create a copy of InvoiceItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InvoiceItemCopyWith<InvoiceItem> get copyWith => _$InvoiceItemCopyWithImpl<InvoiceItem>(this as InvoiceItem, _$identity);

  /// Serializes this InvoiceItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InvoiceItem&&(identical(other.id, id) || other.id == id)&&(identical(other.product, product) || other.product == product)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.taxRate, taxRate) || other.taxRate == taxRate)&&(identical(other.taxAmount, taxAmount) || other.taxAmount == taxAmount)&&(identical(other.discount, discount) || other.discount == discount)&&(identical(other.total, total) || other.total == total)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,product,quantity,unitPrice,taxRate,taxAmount,discount,total,description);

@override
String toString() {
  return 'InvoiceItem(id: $id, product: $product, quantity: $quantity, unitPrice: $unitPrice, taxRate: $taxRate, taxAmount: $taxAmount, discount: $discount, total: $total, description: $description)';
}


}

/// @nodoc
abstract mixin class $InvoiceItemCopyWith<$Res>  {
  factory $InvoiceItemCopyWith(InvoiceItem value, $Res Function(InvoiceItem) _then) = _$InvoiceItemCopyWithImpl;
@useResult
$Res call({
 String id, PosProduct product, double quantity, double unitPrice, double taxRate, double taxAmount, double discount, double total, String? description
});


$PosProductCopyWith<$Res> get product;

}
/// @nodoc
class _$InvoiceItemCopyWithImpl<$Res>
    implements $InvoiceItemCopyWith<$Res> {
  _$InvoiceItemCopyWithImpl(this._self, this._then);

  final InvoiceItem _self;
  final $Res Function(InvoiceItem) _then;

/// Create a copy of InvoiceItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? product = null,Object? quantity = null,Object? unitPrice = null,Object? taxRate = null,Object? taxAmount = null,Object? discount = null,Object? total = null,Object? description = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,product: null == product ? _self.product : product // ignore: cast_nullable_to_non_nullable
as PosProduct,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as double,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,taxRate: null == taxRate ? _self.taxRate : taxRate // ignore: cast_nullable_to_non_nullable
as double,taxAmount: null == taxAmount ? _self.taxAmount : taxAmount // ignore: cast_nullable_to_non_nullable
as double,discount: null == discount ? _self.discount : discount // ignore: cast_nullable_to_non_nullable
as double,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of InvoiceItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PosProductCopyWith<$Res> get product {
  
  return $PosProductCopyWith<$Res>(_self.product, (value) {
    return _then(_self.copyWith(product: value));
  });
}
}


/// Adds pattern-matching-related methods to [InvoiceItem].
extension InvoiceItemPatterns on InvoiceItem {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InvoiceItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InvoiceItem() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InvoiceItem value)  $default,){
final _that = this;
switch (_that) {
case _InvoiceItem():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InvoiceItem value)?  $default,){
final _that = this;
switch (_that) {
case _InvoiceItem() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  PosProduct product,  double quantity,  double unitPrice,  double taxRate,  double taxAmount,  double discount,  double total,  String? description)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InvoiceItem() when $default != null:
return $default(_that.id,_that.product,_that.quantity,_that.unitPrice,_that.taxRate,_that.taxAmount,_that.discount,_that.total,_that.description);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  PosProduct product,  double quantity,  double unitPrice,  double taxRate,  double taxAmount,  double discount,  double total,  String? description)  $default,) {final _that = this;
switch (_that) {
case _InvoiceItem():
return $default(_that.id,_that.product,_that.quantity,_that.unitPrice,_that.taxRate,_that.taxAmount,_that.discount,_that.total,_that.description);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  PosProduct product,  double quantity,  double unitPrice,  double taxRate,  double taxAmount,  double discount,  double total,  String? description)?  $default,) {final _that = this;
switch (_that) {
case _InvoiceItem() when $default != null:
return $default(_that.id,_that.product,_that.quantity,_that.unitPrice,_that.taxRate,_that.taxAmount,_that.discount,_that.total,_that.description);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InvoiceItem implements InvoiceItem {
  const _InvoiceItem({required this.id, required this.product, required this.quantity, required this.unitPrice, required this.taxRate, required this.taxAmount, required this.discount, required this.total, this.description});
  factory _InvoiceItem.fromJson(Map<String, dynamic> json) => _$InvoiceItemFromJson(json);

@override final  String id;
@override final  PosProduct product;
@override final  double quantity;
@override final  double unitPrice;
@override final  double taxRate;
@override final  double taxAmount;
@override final  double discount;
@override final  double total;
@override final  String? description;

/// Create a copy of InvoiceItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InvoiceItemCopyWith<_InvoiceItem> get copyWith => __$InvoiceItemCopyWithImpl<_InvoiceItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InvoiceItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InvoiceItem&&(identical(other.id, id) || other.id == id)&&(identical(other.product, product) || other.product == product)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.taxRate, taxRate) || other.taxRate == taxRate)&&(identical(other.taxAmount, taxAmount) || other.taxAmount == taxAmount)&&(identical(other.discount, discount) || other.discount == discount)&&(identical(other.total, total) || other.total == total)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,product,quantity,unitPrice,taxRate,taxAmount,discount,total,description);

@override
String toString() {
  return 'InvoiceItem(id: $id, product: $product, quantity: $quantity, unitPrice: $unitPrice, taxRate: $taxRate, taxAmount: $taxAmount, discount: $discount, total: $total, description: $description)';
}


}

/// @nodoc
abstract mixin class _$InvoiceItemCopyWith<$Res> implements $InvoiceItemCopyWith<$Res> {
  factory _$InvoiceItemCopyWith(_InvoiceItem value, $Res Function(_InvoiceItem) _then) = __$InvoiceItemCopyWithImpl;
@override @useResult
$Res call({
 String id, PosProduct product, double quantity, double unitPrice, double taxRate, double taxAmount, double discount, double total, String? description
});


@override $PosProductCopyWith<$Res> get product;

}
/// @nodoc
class __$InvoiceItemCopyWithImpl<$Res>
    implements _$InvoiceItemCopyWith<$Res> {
  __$InvoiceItemCopyWithImpl(this._self, this._then);

  final _InvoiceItem _self;
  final $Res Function(_InvoiceItem) _then;

/// Create a copy of InvoiceItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? product = null,Object? quantity = null,Object? unitPrice = null,Object? taxRate = null,Object? taxAmount = null,Object? discount = null,Object? total = null,Object? description = freezed,}) {
  return _then(_InvoiceItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,product: null == product ? _self.product : product // ignore: cast_nullable_to_non_nullable
as PosProduct,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as double,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,taxRate: null == taxRate ? _self.taxRate : taxRate // ignore: cast_nullable_to_non_nullable
as double,taxAmount: null == taxAmount ? _self.taxAmount : taxAmount // ignore: cast_nullable_to_non_nullable
as double,discount: null == discount ? _self.discount : discount // ignore: cast_nullable_to_non_nullable
as double,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of InvoiceItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PosProductCopyWith<$Res> get product {
  
  return $PosProductCopyWith<$Res>(_self.product, (value) {
    return _then(_self.copyWith(product: value));
  });
}
}


/// @nodoc
mixin _$InvoicePayment {

 String get id; double get amount; String get paymentMethod; String? get paymentDate; String? get reference; String? get notes; String get status;
/// Create a copy of InvoicePayment
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InvoicePaymentCopyWith<InvoicePayment> get copyWith => _$InvoicePaymentCopyWithImpl<InvoicePayment>(this as InvoicePayment, _$identity);

  /// Serializes this InvoicePayment to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InvoicePayment&&(identical(other.id, id) || other.id == id)&&(identical(other.amount, amount) || other.amount == amount)&&(identical(other.paymentMethod, paymentMethod) || other.paymentMethod == paymentMethod)&&(identical(other.paymentDate, paymentDate) || other.paymentDate == paymentDate)&&(identical(other.reference, reference) || other.reference == reference)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,amount,paymentMethod,paymentDate,reference,notes,status);

@override
String toString() {
  return 'InvoicePayment(id: $id, amount: $amount, paymentMethod: $paymentMethod, paymentDate: $paymentDate, reference: $reference, notes: $notes, status: $status)';
}


}

/// @nodoc
abstract mixin class $InvoicePaymentCopyWith<$Res>  {
  factory $InvoicePaymentCopyWith(InvoicePayment value, $Res Function(InvoicePayment) _then) = _$InvoicePaymentCopyWithImpl;
@useResult
$Res call({
 String id, double amount, String paymentMethod, String? paymentDate, String? reference, String? notes, String status
});




}
/// @nodoc
class _$InvoicePaymentCopyWithImpl<$Res>
    implements $InvoicePaymentCopyWith<$Res> {
  _$InvoicePaymentCopyWithImpl(this._self, this._then);

  final InvoicePayment _self;
  final $Res Function(InvoicePayment) _then;

/// Create a copy of InvoicePayment
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? amount = null,Object? paymentMethod = null,Object? paymentDate = freezed,Object? reference = freezed,Object? notes = freezed,Object? status = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as double,paymentMethod: null == paymentMethod ? _self.paymentMethod : paymentMethod // ignore: cast_nullable_to_non_nullable
as String,paymentDate: freezed == paymentDate ? _self.paymentDate : paymentDate // ignore: cast_nullable_to_non_nullable
as String?,reference: freezed == reference ? _self.reference : reference // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [InvoicePayment].
extension InvoicePaymentPatterns on InvoicePayment {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InvoicePayment value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InvoicePayment() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InvoicePayment value)  $default,){
final _that = this;
switch (_that) {
case _InvoicePayment():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InvoicePayment value)?  $default,){
final _that = this;
switch (_that) {
case _InvoicePayment() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  double amount,  String paymentMethod,  String? paymentDate,  String? reference,  String? notes,  String status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InvoicePayment() when $default != null:
return $default(_that.id,_that.amount,_that.paymentMethod,_that.paymentDate,_that.reference,_that.notes,_that.status);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  double amount,  String paymentMethod,  String? paymentDate,  String? reference,  String? notes,  String status)  $default,) {final _that = this;
switch (_that) {
case _InvoicePayment():
return $default(_that.id,_that.amount,_that.paymentMethod,_that.paymentDate,_that.reference,_that.notes,_that.status);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  double amount,  String paymentMethod,  String? paymentDate,  String? reference,  String? notes,  String status)?  $default,) {final _that = this;
switch (_that) {
case _InvoicePayment() when $default != null:
return $default(_that.id,_that.amount,_that.paymentMethod,_that.paymentDate,_that.reference,_that.notes,_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InvoicePayment implements InvoicePayment {
  const _InvoicePayment({required this.id, required this.amount, required this.paymentMethod, this.paymentDate, this.reference, this.notes, this.status = 'Completed'});
  factory _InvoicePayment.fromJson(Map<String, dynamic> json) => _$InvoicePaymentFromJson(json);

@override final  String id;
@override final  double amount;
@override final  String paymentMethod;
@override final  String? paymentDate;
@override final  String? reference;
@override final  String? notes;
@override@JsonKey() final  String status;

/// Create a copy of InvoicePayment
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InvoicePaymentCopyWith<_InvoicePayment> get copyWith => __$InvoicePaymentCopyWithImpl<_InvoicePayment>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InvoicePaymentToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InvoicePayment&&(identical(other.id, id) || other.id == id)&&(identical(other.amount, amount) || other.amount == amount)&&(identical(other.paymentMethod, paymentMethod) || other.paymentMethod == paymentMethod)&&(identical(other.paymentDate, paymentDate) || other.paymentDate == paymentDate)&&(identical(other.reference, reference) || other.reference == reference)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,amount,paymentMethod,paymentDate,reference,notes,status);

@override
String toString() {
  return 'InvoicePayment(id: $id, amount: $amount, paymentMethod: $paymentMethod, paymentDate: $paymentDate, reference: $reference, notes: $notes, status: $status)';
}


}

/// @nodoc
abstract mixin class _$InvoicePaymentCopyWith<$Res> implements $InvoicePaymentCopyWith<$Res> {
  factory _$InvoicePaymentCopyWith(_InvoicePayment value, $Res Function(_InvoicePayment) _then) = __$InvoicePaymentCopyWithImpl;
@override @useResult
$Res call({
 String id, double amount, String paymentMethod, String? paymentDate, String? reference, String? notes, String status
});




}
/// @nodoc
class __$InvoicePaymentCopyWithImpl<$Res>
    implements _$InvoicePaymentCopyWith<$Res> {
  __$InvoicePaymentCopyWithImpl(this._self, this._then);

  final _InvoicePayment _self;
  final $Res Function(_InvoicePayment) _then;

/// Create a copy of InvoicePayment
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? amount = null,Object? paymentMethod = null,Object? paymentDate = freezed,Object? reference = freezed,Object? notes = freezed,Object? status = null,}) {
  return _then(_InvoicePayment(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as double,paymentMethod: null == paymentMethod ? _self.paymentMethod : paymentMethod // ignore: cast_nullable_to_non_nullable
as String,paymentDate: freezed == paymentDate ? _self.paymentDate : paymentDate // ignore: cast_nullable_to_non_nullable
as String?,reference: freezed == reference ? _self.reference : reference // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$InvoiceStatistics {

 InvoiceStatBucket get paid; InvoiceStatBucket get pending; InvoiceStatBucket get overdue; InvoiceStatBucket get partial; InvoiceStatBucket get draft;
/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InvoiceStatisticsCopyWith<InvoiceStatistics> get copyWith => _$InvoiceStatisticsCopyWithImpl<InvoiceStatistics>(this as InvoiceStatistics, _$identity);

  /// Serializes this InvoiceStatistics to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InvoiceStatistics&&(identical(other.paid, paid) || other.paid == paid)&&(identical(other.pending, pending) || other.pending == pending)&&(identical(other.overdue, overdue) || other.overdue == overdue)&&(identical(other.partial, partial) || other.partial == partial)&&(identical(other.draft, draft) || other.draft == draft));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,paid,pending,overdue,partial,draft);

@override
String toString() {
  return 'InvoiceStatistics(paid: $paid, pending: $pending, overdue: $overdue, partial: $partial, draft: $draft)';
}


}

/// @nodoc
abstract mixin class $InvoiceStatisticsCopyWith<$Res>  {
  factory $InvoiceStatisticsCopyWith(InvoiceStatistics value, $Res Function(InvoiceStatistics) _then) = _$InvoiceStatisticsCopyWithImpl;
@useResult
$Res call({
 InvoiceStatBucket paid, InvoiceStatBucket pending, InvoiceStatBucket overdue, InvoiceStatBucket partial, InvoiceStatBucket draft
});


$InvoiceStatBucketCopyWith<$Res> get paid;$InvoiceStatBucketCopyWith<$Res> get pending;$InvoiceStatBucketCopyWith<$Res> get overdue;$InvoiceStatBucketCopyWith<$Res> get partial;$InvoiceStatBucketCopyWith<$Res> get draft;

}
/// @nodoc
class _$InvoiceStatisticsCopyWithImpl<$Res>
    implements $InvoiceStatisticsCopyWith<$Res> {
  _$InvoiceStatisticsCopyWithImpl(this._self, this._then);

  final InvoiceStatistics _self;
  final $Res Function(InvoiceStatistics) _then;

/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? paid = null,Object? pending = null,Object? overdue = null,Object? partial = null,Object? draft = null,}) {
  return _then(_self.copyWith(
paid: null == paid ? _self.paid : paid // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,pending: null == pending ? _self.pending : pending // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,overdue: null == overdue ? _self.overdue : overdue // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,partial: null == partial ? _self.partial : partial // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,draft: null == draft ? _self.draft : draft // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,
  ));
}
/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get paid {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.paid, (value) {
    return _then(_self.copyWith(paid: value));
  });
}/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get pending {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.pending, (value) {
    return _then(_self.copyWith(pending: value));
  });
}/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get overdue {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.overdue, (value) {
    return _then(_self.copyWith(overdue: value));
  });
}/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get partial {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.partial, (value) {
    return _then(_self.copyWith(partial: value));
  });
}/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get draft {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.draft, (value) {
    return _then(_self.copyWith(draft: value));
  });
}
}


/// Adds pattern-matching-related methods to [InvoiceStatistics].
extension InvoiceStatisticsPatterns on InvoiceStatistics {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InvoiceStatistics value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InvoiceStatistics() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InvoiceStatistics value)  $default,){
final _that = this;
switch (_that) {
case _InvoiceStatistics():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InvoiceStatistics value)?  $default,){
final _that = this;
switch (_that) {
case _InvoiceStatistics() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( InvoiceStatBucket paid,  InvoiceStatBucket pending,  InvoiceStatBucket overdue,  InvoiceStatBucket partial,  InvoiceStatBucket draft)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InvoiceStatistics() when $default != null:
return $default(_that.paid,_that.pending,_that.overdue,_that.partial,_that.draft);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( InvoiceStatBucket paid,  InvoiceStatBucket pending,  InvoiceStatBucket overdue,  InvoiceStatBucket partial,  InvoiceStatBucket draft)  $default,) {final _that = this;
switch (_that) {
case _InvoiceStatistics():
return $default(_that.paid,_that.pending,_that.overdue,_that.partial,_that.draft);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( InvoiceStatBucket paid,  InvoiceStatBucket pending,  InvoiceStatBucket overdue,  InvoiceStatBucket partial,  InvoiceStatBucket draft)?  $default,) {final _that = this;
switch (_that) {
case _InvoiceStatistics() when $default != null:
return $default(_that.paid,_that.pending,_that.overdue,_that.partial,_that.draft);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InvoiceStatistics implements InvoiceStatistics {
  const _InvoiceStatistics({required this.paid, required this.pending, required this.overdue, required this.partial, required this.draft});
  factory _InvoiceStatistics.fromJson(Map<String, dynamic> json) => _$InvoiceStatisticsFromJson(json);

@override final  InvoiceStatBucket paid;
@override final  InvoiceStatBucket pending;
@override final  InvoiceStatBucket overdue;
@override final  InvoiceStatBucket partial;
@override final  InvoiceStatBucket draft;

/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InvoiceStatisticsCopyWith<_InvoiceStatistics> get copyWith => __$InvoiceStatisticsCopyWithImpl<_InvoiceStatistics>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InvoiceStatisticsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InvoiceStatistics&&(identical(other.paid, paid) || other.paid == paid)&&(identical(other.pending, pending) || other.pending == pending)&&(identical(other.overdue, overdue) || other.overdue == overdue)&&(identical(other.partial, partial) || other.partial == partial)&&(identical(other.draft, draft) || other.draft == draft));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,paid,pending,overdue,partial,draft);

@override
String toString() {
  return 'InvoiceStatistics(paid: $paid, pending: $pending, overdue: $overdue, partial: $partial, draft: $draft)';
}


}

/// @nodoc
abstract mixin class _$InvoiceStatisticsCopyWith<$Res> implements $InvoiceStatisticsCopyWith<$Res> {
  factory _$InvoiceStatisticsCopyWith(_InvoiceStatistics value, $Res Function(_InvoiceStatistics) _then) = __$InvoiceStatisticsCopyWithImpl;
@override @useResult
$Res call({
 InvoiceStatBucket paid, InvoiceStatBucket pending, InvoiceStatBucket overdue, InvoiceStatBucket partial, InvoiceStatBucket draft
});


@override $InvoiceStatBucketCopyWith<$Res> get paid;@override $InvoiceStatBucketCopyWith<$Res> get pending;@override $InvoiceStatBucketCopyWith<$Res> get overdue;@override $InvoiceStatBucketCopyWith<$Res> get partial;@override $InvoiceStatBucketCopyWith<$Res> get draft;

}
/// @nodoc
class __$InvoiceStatisticsCopyWithImpl<$Res>
    implements _$InvoiceStatisticsCopyWith<$Res> {
  __$InvoiceStatisticsCopyWithImpl(this._self, this._then);

  final _InvoiceStatistics _self;
  final $Res Function(_InvoiceStatistics) _then;

/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? paid = null,Object? pending = null,Object? overdue = null,Object? partial = null,Object? draft = null,}) {
  return _then(_InvoiceStatistics(
paid: null == paid ? _self.paid : paid // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,pending: null == pending ? _self.pending : pending // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,overdue: null == overdue ? _self.overdue : overdue // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,partial: null == partial ? _self.partial : partial // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,draft: null == draft ? _self.draft : draft // ignore: cast_nullable_to_non_nullable
as InvoiceStatBucket,
  ));
}

/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get paid {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.paid, (value) {
    return _then(_self.copyWith(paid: value));
  });
}/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get pending {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.pending, (value) {
    return _then(_self.copyWith(pending: value));
  });
}/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get overdue {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.overdue, (value) {
    return _then(_self.copyWith(overdue: value));
  });
}/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get partial {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.partial, (value) {
    return _then(_self.copyWith(partial: value));
  });
}/// Create a copy of InvoiceStatistics
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<$Res> get draft {
  
  return $InvoiceStatBucketCopyWith<$Res>(_self.draft, (value) {
    return _then(_self.copyWith(draft: value));
  });
}
}


/// @nodoc
mixin _$InvoiceStatBucket {

 int get count; double get amount;
/// Create a copy of InvoiceStatBucket
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InvoiceStatBucketCopyWith<InvoiceStatBucket> get copyWith => _$InvoiceStatBucketCopyWithImpl<InvoiceStatBucket>(this as InvoiceStatBucket, _$identity);

  /// Serializes this InvoiceStatBucket to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InvoiceStatBucket&&(identical(other.count, count) || other.count == count)&&(identical(other.amount, amount) || other.amount == amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,count,amount);

@override
String toString() {
  return 'InvoiceStatBucket(count: $count, amount: $amount)';
}


}

/// @nodoc
abstract mixin class $InvoiceStatBucketCopyWith<$Res>  {
  factory $InvoiceStatBucketCopyWith(InvoiceStatBucket value, $Res Function(InvoiceStatBucket) _then) = _$InvoiceStatBucketCopyWithImpl;
@useResult
$Res call({
 int count, double amount
});




}
/// @nodoc
class _$InvoiceStatBucketCopyWithImpl<$Res>
    implements $InvoiceStatBucketCopyWith<$Res> {
  _$InvoiceStatBucketCopyWithImpl(this._self, this._then);

  final InvoiceStatBucket _self;
  final $Res Function(InvoiceStatBucket) _then;

/// Create a copy of InvoiceStatBucket
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? count = null,Object? amount = null,}) {
  return _then(_self.copyWith(
count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as double,
  ));
}

}


/// Adds pattern-matching-related methods to [InvoiceStatBucket].
extension InvoiceStatBucketPatterns on InvoiceStatBucket {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InvoiceStatBucket value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InvoiceStatBucket() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InvoiceStatBucket value)  $default,){
final _that = this;
switch (_that) {
case _InvoiceStatBucket():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InvoiceStatBucket value)?  $default,){
final _that = this;
switch (_that) {
case _InvoiceStatBucket() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int count,  double amount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InvoiceStatBucket() when $default != null:
return $default(_that.count,_that.amount);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int count,  double amount)  $default,) {final _that = this;
switch (_that) {
case _InvoiceStatBucket():
return $default(_that.count,_that.amount);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int count,  double amount)?  $default,) {final _that = this;
switch (_that) {
case _InvoiceStatBucket() when $default != null:
return $default(_that.count,_that.amount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InvoiceStatBucket implements InvoiceStatBucket {
  const _InvoiceStatBucket({this.count = 0, this.amount = 0});
  factory _InvoiceStatBucket.fromJson(Map<String, dynamic> json) => _$InvoiceStatBucketFromJson(json);

@override@JsonKey() final  int count;
@override@JsonKey() final  double amount;

/// Create a copy of InvoiceStatBucket
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InvoiceStatBucketCopyWith<_InvoiceStatBucket> get copyWith => __$InvoiceStatBucketCopyWithImpl<_InvoiceStatBucket>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InvoiceStatBucketToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InvoiceStatBucket&&(identical(other.count, count) || other.count == count)&&(identical(other.amount, amount) || other.amount == amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,count,amount);

@override
String toString() {
  return 'InvoiceStatBucket(count: $count, amount: $amount)';
}


}

/// @nodoc
abstract mixin class _$InvoiceStatBucketCopyWith<$Res> implements $InvoiceStatBucketCopyWith<$Res> {
  factory _$InvoiceStatBucketCopyWith(_InvoiceStatBucket value, $Res Function(_InvoiceStatBucket) _then) = __$InvoiceStatBucketCopyWithImpl;
@override @useResult
$Res call({
 int count, double amount
});




}
/// @nodoc
class __$InvoiceStatBucketCopyWithImpl<$Res>
    implements _$InvoiceStatBucketCopyWith<$Res> {
  __$InvoiceStatBucketCopyWithImpl(this._self, this._then);

  final _InvoiceStatBucket _self;
  final $Res Function(_InvoiceStatBucket) _then;

/// Create a copy of InvoiceStatBucket
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? count = null,Object? amount = null,}) {
  return _then(_InvoiceStatBucket(
count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}


/// @nodoc
mixin _$CreateInvoiceRequest {

 String get clientId; List<CreateInvoiceItemRequest> get items; DateTime get dueDate; String? get terms; String? get notes; String get status;
/// Create a copy of CreateInvoiceRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateInvoiceRequestCopyWith<CreateInvoiceRequest> get copyWith => _$CreateInvoiceRequestCopyWithImpl<CreateInvoiceRequest>(this as CreateInvoiceRequest, _$identity);

  /// Serializes this CreateInvoiceRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateInvoiceRequest&&(identical(other.clientId, clientId) || other.clientId == clientId)&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.dueDate, dueDate) || other.dueDate == dueDate)&&(identical(other.terms, terms) || other.terms == terms)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,clientId,const DeepCollectionEquality().hash(items),dueDate,terms,notes,status);

@override
String toString() {
  return 'CreateInvoiceRequest(clientId: $clientId, items: $items, dueDate: $dueDate, terms: $terms, notes: $notes, status: $status)';
}


}

/// @nodoc
abstract mixin class $CreateInvoiceRequestCopyWith<$Res>  {
  factory $CreateInvoiceRequestCopyWith(CreateInvoiceRequest value, $Res Function(CreateInvoiceRequest) _then) = _$CreateInvoiceRequestCopyWithImpl;
@useResult
$Res call({
 String clientId, List<CreateInvoiceItemRequest> items, DateTime dueDate, String? terms, String? notes, String status
});




}
/// @nodoc
class _$CreateInvoiceRequestCopyWithImpl<$Res>
    implements $CreateInvoiceRequestCopyWith<$Res> {
  _$CreateInvoiceRequestCopyWithImpl(this._self, this._then);

  final CreateInvoiceRequest _self;
  final $Res Function(CreateInvoiceRequest) _then;

/// Create a copy of CreateInvoiceRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? clientId = null,Object? items = null,Object? dueDate = null,Object? terms = freezed,Object? notes = freezed,Object? status = null,}) {
  return _then(_self.copyWith(
clientId: null == clientId ? _self.clientId : clientId // ignore: cast_nullable_to_non_nullable
as String,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<CreateInvoiceItemRequest>,dueDate: null == dueDate ? _self.dueDate : dueDate // ignore: cast_nullable_to_non_nullable
as DateTime,terms: freezed == terms ? _self.terms : terms // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateInvoiceRequest].
extension CreateInvoiceRequestPatterns on CreateInvoiceRequest {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateInvoiceRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateInvoiceRequest() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateInvoiceRequest value)  $default,){
final _that = this;
switch (_that) {
case _CreateInvoiceRequest():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateInvoiceRequest value)?  $default,){
final _that = this;
switch (_that) {
case _CreateInvoiceRequest() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String clientId,  List<CreateInvoiceItemRequest> items,  DateTime dueDate,  String? terms,  String? notes,  String status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateInvoiceRequest() when $default != null:
return $default(_that.clientId,_that.items,_that.dueDate,_that.terms,_that.notes,_that.status);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String clientId,  List<CreateInvoiceItemRequest> items,  DateTime dueDate,  String? terms,  String? notes,  String status)  $default,) {final _that = this;
switch (_that) {
case _CreateInvoiceRequest():
return $default(_that.clientId,_that.items,_that.dueDate,_that.terms,_that.notes,_that.status);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String clientId,  List<CreateInvoiceItemRequest> items,  DateTime dueDate,  String? terms,  String? notes,  String status)?  $default,) {final _that = this;
switch (_that) {
case _CreateInvoiceRequest() when $default != null:
return $default(_that.clientId,_that.items,_that.dueDate,_that.terms,_that.notes,_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateInvoiceRequest implements CreateInvoiceRequest {
  const _CreateInvoiceRequest({required this.clientId, required final  List<CreateInvoiceItemRequest> items, required this.dueDate, this.terms, this.notes, this.status = 'sent'}): _items = items;
  factory _CreateInvoiceRequest.fromJson(Map<String, dynamic> json) => _$CreateInvoiceRequestFromJson(json);

@override final  String clientId;
 final  List<CreateInvoiceItemRequest> _items;
@override List<CreateInvoiceItemRequest> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  DateTime dueDate;
@override final  String? terms;
@override final  String? notes;
@override@JsonKey() final  String status;

/// Create a copy of CreateInvoiceRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateInvoiceRequestCopyWith<_CreateInvoiceRequest> get copyWith => __$CreateInvoiceRequestCopyWithImpl<_CreateInvoiceRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateInvoiceRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateInvoiceRequest&&(identical(other.clientId, clientId) || other.clientId == clientId)&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.dueDate, dueDate) || other.dueDate == dueDate)&&(identical(other.terms, terms) || other.terms == terms)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,clientId,const DeepCollectionEquality().hash(_items),dueDate,terms,notes,status);

@override
String toString() {
  return 'CreateInvoiceRequest(clientId: $clientId, items: $items, dueDate: $dueDate, terms: $terms, notes: $notes, status: $status)';
}


}

/// @nodoc
abstract mixin class _$CreateInvoiceRequestCopyWith<$Res> implements $CreateInvoiceRequestCopyWith<$Res> {
  factory _$CreateInvoiceRequestCopyWith(_CreateInvoiceRequest value, $Res Function(_CreateInvoiceRequest) _then) = __$CreateInvoiceRequestCopyWithImpl;
@override @useResult
$Res call({
 String clientId, List<CreateInvoiceItemRequest> items, DateTime dueDate, String? terms, String? notes, String status
});




}
/// @nodoc
class __$CreateInvoiceRequestCopyWithImpl<$Res>
    implements _$CreateInvoiceRequestCopyWith<$Res> {
  __$CreateInvoiceRequestCopyWithImpl(this._self, this._then);

  final _CreateInvoiceRequest _self;
  final $Res Function(_CreateInvoiceRequest) _then;

/// Create a copy of CreateInvoiceRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? clientId = null,Object? items = null,Object? dueDate = null,Object? terms = freezed,Object? notes = freezed,Object? status = null,}) {
  return _then(_CreateInvoiceRequest(
clientId: null == clientId ? _self.clientId : clientId // ignore: cast_nullable_to_non_nullable
as String,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<CreateInvoiceItemRequest>,dueDate: null == dueDate ? _self.dueDate : dueDate // ignore: cast_nullable_to_non_nullable
as DateTime,terms: freezed == terms ? _self.terms : terms // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$CreateInvoiceItemRequest {

 String get productId; double get quantity; double get unitPrice; String? get description;
/// Create a copy of CreateInvoiceItemRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateInvoiceItemRequestCopyWith<CreateInvoiceItemRequest> get copyWith => _$CreateInvoiceItemRequestCopyWithImpl<CreateInvoiceItemRequest>(this as CreateInvoiceItemRequest, _$identity);

  /// Serializes this CreateInvoiceItemRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateInvoiceItemRequest&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,productId,quantity,unitPrice,description);

@override
String toString() {
  return 'CreateInvoiceItemRequest(productId: $productId, quantity: $quantity, unitPrice: $unitPrice, description: $description)';
}


}

/// @nodoc
abstract mixin class $CreateInvoiceItemRequestCopyWith<$Res>  {
  factory $CreateInvoiceItemRequestCopyWith(CreateInvoiceItemRequest value, $Res Function(CreateInvoiceItemRequest) _then) = _$CreateInvoiceItemRequestCopyWithImpl;
@useResult
$Res call({
 String productId, double quantity, double unitPrice, String? description
});




}
/// @nodoc
class _$CreateInvoiceItemRequestCopyWithImpl<$Res>
    implements $CreateInvoiceItemRequestCopyWith<$Res> {
  _$CreateInvoiceItemRequestCopyWithImpl(this._self, this._then);

  final CreateInvoiceItemRequest _self;
  final $Res Function(CreateInvoiceItemRequest) _then;

/// Create a copy of CreateInvoiceItemRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? productId = null,Object? quantity = null,Object? unitPrice = null,Object? description = freezed,}) {
  return _then(_self.copyWith(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as double,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateInvoiceItemRequest].
extension CreateInvoiceItemRequestPatterns on CreateInvoiceItemRequest {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateInvoiceItemRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateInvoiceItemRequest() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateInvoiceItemRequest value)  $default,){
final _that = this;
switch (_that) {
case _CreateInvoiceItemRequest():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateInvoiceItemRequest value)?  $default,){
final _that = this;
switch (_that) {
case _CreateInvoiceItemRequest() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String productId,  double quantity,  double unitPrice,  String? description)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateInvoiceItemRequest() when $default != null:
return $default(_that.productId,_that.quantity,_that.unitPrice,_that.description);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String productId,  double quantity,  double unitPrice,  String? description)  $default,) {final _that = this;
switch (_that) {
case _CreateInvoiceItemRequest():
return $default(_that.productId,_that.quantity,_that.unitPrice,_that.description);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String productId,  double quantity,  double unitPrice,  String? description)?  $default,) {final _that = this;
switch (_that) {
case _CreateInvoiceItemRequest() when $default != null:
return $default(_that.productId,_that.quantity,_that.unitPrice,_that.description);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateInvoiceItemRequest implements CreateInvoiceItemRequest {
  const _CreateInvoiceItemRequest({required this.productId, required this.quantity, required this.unitPrice, this.description});
  factory _CreateInvoiceItemRequest.fromJson(Map<String, dynamic> json) => _$CreateInvoiceItemRequestFromJson(json);

@override final  String productId;
@override final  double quantity;
@override final  double unitPrice;
@override final  String? description;

/// Create a copy of CreateInvoiceItemRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateInvoiceItemRequestCopyWith<_CreateInvoiceItemRequest> get copyWith => __$CreateInvoiceItemRequestCopyWithImpl<_CreateInvoiceItemRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateInvoiceItemRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateInvoiceItemRequest&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,productId,quantity,unitPrice,description);

@override
String toString() {
  return 'CreateInvoiceItemRequest(productId: $productId, quantity: $quantity, unitPrice: $unitPrice, description: $description)';
}


}

/// @nodoc
abstract mixin class _$CreateInvoiceItemRequestCopyWith<$Res> implements $CreateInvoiceItemRequestCopyWith<$Res> {
  factory _$CreateInvoiceItemRequestCopyWith(_CreateInvoiceItemRequest value, $Res Function(_CreateInvoiceItemRequest) _then) = __$CreateInvoiceItemRequestCopyWithImpl;
@override @useResult
$Res call({
 String productId, double quantity, double unitPrice, String? description
});




}
/// @nodoc
class __$CreateInvoiceItemRequestCopyWithImpl<$Res>
    implements _$CreateInvoiceItemRequestCopyWith<$Res> {
  __$CreateInvoiceItemRequestCopyWithImpl(this._self, this._then);

  final _CreateInvoiceItemRequest _self;
  final $Res Function(_CreateInvoiceItemRequest) _then;

/// Create a copy of CreateInvoiceItemRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? productId = null,Object? quantity = null,Object? unitPrice = null,Object? description = freezed,}) {
  return _then(_CreateInvoiceItemRequest(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as double,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
