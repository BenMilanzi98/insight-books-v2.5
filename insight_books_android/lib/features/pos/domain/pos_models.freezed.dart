// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pos_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PosProduct {

 String get id; String get name; String? get sku; double get price; double? get stockLevel; String? get category; String? get accountId; List<ProductTax> get taxes; List<ProductUnit> get units;
/// Create a copy of PosProduct
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PosProductCopyWith<PosProduct> get copyWith => _$PosProductCopyWithImpl<PosProduct>(this as PosProduct, _$identity);

  /// Serializes this PosProduct to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PosProduct&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.price, price) || other.price == price)&&(identical(other.stockLevel, stockLevel) || other.stockLevel == stockLevel)&&(identical(other.category, category) || other.category == category)&&(identical(other.accountId, accountId) || other.accountId == accountId)&&const DeepCollectionEquality().equals(other.taxes, taxes)&&const DeepCollectionEquality().equals(other.units, units));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,sku,price,stockLevel,category,accountId,const DeepCollectionEquality().hash(taxes),const DeepCollectionEquality().hash(units));

@override
String toString() {
  return 'PosProduct(id: $id, name: $name, sku: $sku, price: $price, stockLevel: $stockLevel, category: $category, accountId: $accountId, taxes: $taxes, units: $units)';
}


}

/// @nodoc
abstract mixin class $PosProductCopyWith<$Res>  {
  factory $PosProductCopyWith(PosProduct value, $Res Function(PosProduct) _then) = _$PosProductCopyWithImpl;
@useResult
$Res call({
 String id, String name, String? sku, double price, double? stockLevel, String? category, String? accountId, List<ProductTax> taxes, List<ProductUnit> units
});




}
/// @nodoc
class _$PosProductCopyWithImpl<$Res>
    implements $PosProductCopyWith<$Res> {
  _$PosProductCopyWithImpl(this._self, this._then);

  final PosProduct _self;
  final $Res Function(PosProduct) _then;

/// Create a copy of PosProduct
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? sku = freezed,Object? price = null,Object? stockLevel = freezed,Object? category = freezed,Object? accountId = freezed,Object? taxes = null,Object? units = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,sku: freezed == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String?,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as double,stockLevel: freezed == stockLevel ? _self.stockLevel : stockLevel // ignore: cast_nullable_to_non_nullable
as double?,category: freezed == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String?,accountId: freezed == accountId ? _self.accountId : accountId // ignore: cast_nullable_to_non_nullable
as String?,taxes: null == taxes ? _self.taxes : taxes // ignore: cast_nullable_to_non_nullable
as List<ProductTax>,units: null == units ? _self.units : units // ignore: cast_nullable_to_non_nullable
as List<ProductUnit>,
  ));
}

}


/// Adds pattern-matching-related methods to [PosProduct].
extension PosProductPatterns on PosProduct {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PosProduct value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PosProduct() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PosProduct value)  $default,){
final _that = this;
switch (_that) {
case _PosProduct():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PosProduct value)?  $default,){
final _that = this;
switch (_that) {
case _PosProduct() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String? sku,  double price,  double? stockLevel,  String? category,  String? accountId,  List<ProductTax> taxes,  List<ProductUnit> units)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PosProduct() when $default != null:
return $default(_that.id,_that.name,_that.sku,_that.price,_that.stockLevel,_that.category,_that.accountId,_that.taxes,_that.units);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String? sku,  double price,  double? stockLevel,  String? category,  String? accountId,  List<ProductTax> taxes,  List<ProductUnit> units)  $default,) {final _that = this;
switch (_that) {
case _PosProduct():
return $default(_that.id,_that.name,_that.sku,_that.price,_that.stockLevel,_that.category,_that.accountId,_that.taxes,_that.units);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String? sku,  double price,  double? stockLevel,  String? category,  String? accountId,  List<ProductTax> taxes,  List<ProductUnit> units)?  $default,) {final _that = this;
switch (_that) {
case _PosProduct() when $default != null:
return $default(_that.id,_that.name,_that.sku,_that.price,_that.stockLevel,_that.category,_that.accountId,_that.taxes,_that.units);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PosProduct implements PosProduct {
  const _PosProduct({required this.id, required this.name, this.sku, required this.price, this.stockLevel, this.category, this.accountId, final  List<ProductTax> taxes = const [], final  List<ProductUnit> units = const []}): _taxes = taxes,_units = units;
  factory _PosProduct.fromJson(Map<String, dynamic> json) => _$PosProductFromJson(json);

@override final  String id;
@override final  String name;
@override final  String? sku;
@override final  double price;
@override final  double? stockLevel;
@override final  String? category;
@override final  String? accountId;
 final  List<ProductTax> _taxes;
@override@JsonKey() List<ProductTax> get taxes {
  if (_taxes is EqualUnmodifiableListView) return _taxes;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_taxes);
}

 final  List<ProductUnit> _units;
@override@JsonKey() List<ProductUnit> get units {
  if (_units is EqualUnmodifiableListView) return _units;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_units);
}


/// Create a copy of PosProduct
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PosProductCopyWith<_PosProduct> get copyWith => __$PosProductCopyWithImpl<_PosProduct>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PosProductToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PosProduct&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.price, price) || other.price == price)&&(identical(other.stockLevel, stockLevel) || other.stockLevel == stockLevel)&&(identical(other.category, category) || other.category == category)&&(identical(other.accountId, accountId) || other.accountId == accountId)&&const DeepCollectionEquality().equals(other._taxes, _taxes)&&const DeepCollectionEquality().equals(other._units, _units));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,sku,price,stockLevel,category,accountId,const DeepCollectionEquality().hash(_taxes),const DeepCollectionEquality().hash(_units));

@override
String toString() {
  return 'PosProduct(id: $id, name: $name, sku: $sku, price: $price, stockLevel: $stockLevel, category: $category, accountId: $accountId, taxes: $taxes, units: $units)';
}


}

/// @nodoc
abstract mixin class _$PosProductCopyWith<$Res> implements $PosProductCopyWith<$Res> {
  factory _$PosProductCopyWith(_PosProduct value, $Res Function(_PosProduct) _then) = __$PosProductCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String? sku, double price, double? stockLevel, String? category, String? accountId, List<ProductTax> taxes, List<ProductUnit> units
});




}
/// @nodoc
class __$PosProductCopyWithImpl<$Res>
    implements _$PosProductCopyWith<$Res> {
  __$PosProductCopyWithImpl(this._self, this._then);

  final _PosProduct _self;
  final $Res Function(_PosProduct) _then;

/// Create a copy of PosProduct
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? sku = freezed,Object? price = null,Object? stockLevel = freezed,Object? category = freezed,Object? accountId = freezed,Object? taxes = null,Object? units = null,}) {
  return _then(_PosProduct(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,sku: freezed == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String?,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as double,stockLevel: freezed == stockLevel ? _self.stockLevel : stockLevel // ignore: cast_nullable_to_non_nullable
as double?,category: freezed == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String?,accountId: freezed == accountId ? _self.accountId : accountId // ignore: cast_nullable_to_non_nullable
as String?,taxes: null == taxes ? _self._taxes : taxes // ignore: cast_nullable_to_non_nullable
as List<ProductTax>,units: null == units ? _self._units : units // ignore: cast_nullable_to_non_nullable
as List<ProductUnit>,
  ));
}


}


/// @nodoc
mixin _$ProductTax {

 String get id; String get taxName; double get taxRate;
/// Create a copy of ProductTax
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProductTaxCopyWith<ProductTax> get copyWith => _$ProductTaxCopyWithImpl<ProductTax>(this as ProductTax, _$identity);

  /// Serializes this ProductTax to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProductTax&&(identical(other.id, id) || other.id == id)&&(identical(other.taxName, taxName) || other.taxName == taxName)&&(identical(other.taxRate, taxRate) || other.taxRate == taxRate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,taxName,taxRate);

@override
String toString() {
  return 'ProductTax(id: $id, taxName: $taxName, taxRate: $taxRate)';
}


}

/// @nodoc
abstract mixin class $ProductTaxCopyWith<$Res>  {
  factory $ProductTaxCopyWith(ProductTax value, $Res Function(ProductTax) _then) = _$ProductTaxCopyWithImpl;
@useResult
$Res call({
 String id, String taxName, double taxRate
});




}
/// @nodoc
class _$ProductTaxCopyWithImpl<$Res>
    implements $ProductTaxCopyWith<$Res> {
  _$ProductTaxCopyWithImpl(this._self, this._then);

  final ProductTax _self;
  final $Res Function(ProductTax) _then;

/// Create a copy of ProductTax
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? taxName = null,Object? taxRate = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,taxName: null == taxName ? _self.taxName : taxName // ignore: cast_nullable_to_non_nullable
as String,taxRate: null == taxRate ? _self.taxRate : taxRate // ignore: cast_nullable_to_non_nullable
as double,
  ));
}

}


/// Adds pattern-matching-related methods to [ProductTax].
extension ProductTaxPatterns on ProductTax {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProductTax value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProductTax() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProductTax value)  $default,){
final _that = this;
switch (_that) {
case _ProductTax():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProductTax value)?  $default,){
final _that = this;
switch (_that) {
case _ProductTax() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String taxName,  double taxRate)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProductTax() when $default != null:
return $default(_that.id,_that.taxName,_that.taxRate);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String taxName,  double taxRate)  $default,) {final _that = this;
switch (_that) {
case _ProductTax():
return $default(_that.id,_that.taxName,_that.taxRate);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String taxName,  double taxRate)?  $default,) {final _that = this;
switch (_that) {
case _ProductTax() when $default != null:
return $default(_that.id,_that.taxName,_that.taxRate);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProductTax implements ProductTax {
  const _ProductTax({required this.id, required this.taxName, required this.taxRate});
  factory _ProductTax.fromJson(Map<String, dynamic> json) => _$ProductTaxFromJson(json);

@override final  String id;
@override final  String taxName;
@override final  double taxRate;

/// Create a copy of ProductTax
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProductTaxCopyWith<_ProductTax> get copyWith => __$ProductTaxCopyWithImpl<_ProductTax>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProductTaxToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProductTax&&(identical(other.id, id) || other.id == id)&&(identical(other.taxName, taxName) || other.taxName == taxName)&&(identical(other.taxRate, taxRate) || other.taxRate == taxRate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,taxName,taxRate);

@override
String toString() {
  return 'ProductTax(id: $id, taxName: $taxName, taxRate: $taxRate)';
}


}

/// @nodoc
abstract mixin class _$ProductTaxCopyWith<$Res> implements $ProductTaxCopyWith<$Res> {
  factory _$ProductTaxCopyWith(_ProductTax value, $Res Function(_ProductTax) _then) = __$ProductTaxCopyWithImpl;
@override @useResult
$Res call({
 String id, String taxName, double taxRate
});




}
/// @nodoc
class __$ProductTaxCopyWithImpl<$Res>
    implements _$ProductTaxCopyWith<$Res> {
  __$ProductTaxCopyWithImpl(this._self, this._then);

  final _ProductTax _self;
  final $Res Function(_ProductTax) _then;

/// Create a copy of ProductTax
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? taxName = null,Object? taxRate = null,}) {
  return _then(_ProductTax(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,taxName: null == taxName ? _self.taxName : taxName // ignore: cast_nullable_to_non_nullable
as String,taxRate: null == taxRate ? _self.taxRate : taxRate // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}


/// @nodoc
mixin _$ProductUnit {

 String get id; String get unitName; double get conversionRate; double? get unitPrice; bool get isBaseUnit;
/// Create a copy of ProductUnit
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProductUnitCopyWith<ProductUnit> get copyWith => _$ProductUnitCopyWithImpl<ProductUnit>(this as ProductUnit, _$identity);

  /// Serializes this ProductUnit to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProductUnit&&(identical(other.id, id) || other.id == id)&&(identical(other.unitName, unitName) || other.unitName == unitName)&&(identical(other.conversionRate, conversionRate) || other.conversionRate == conversionRate)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.isBaseUnit, isBaseUnit) || other.isBaseUnit == isBaseUnit));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,unitName,conversionRate,unitPrice,isBaseUnit);

@override
String toString() {
  return 'ProductUnit(id: $id, unitName: $unitName, conversionRate: $conversionRate, unitPrice: $unitPrice, isBaseUnit: $isBaseUnit)';
}


}

/// @nodoc
abstract mixin class $ProductUnitCopyWith<$Res>  {
  factory $ProductUnitCopyWith(ProductUnit value, $Res Function(ProductUnit) _then) = _$ProductUnitCopyWithImpl;
@useResult
$Res call({
 String id, String unitName, double conversionRate, double? unitPrice, bool isBaseUnit
});




}
/// @nodoc
class _$ProductUnitCopyWithImpl<$Res>
    implements $ProductUnitCopyWith<$Res> {
  _$ProductUnitCopyWithImpl(this._self, this._then);

  final ProductUnit _self;
  final $Res Function(ProductUnit) _then;

/// Create a copy of ProductUnit
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? unitName = null,Object? conversionRate = null,Object? unitPrice = freezed,Object? isBaseUnit = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,unitName: null == unitName ? _self.unitName : unitName // ignore: cast_nullable_to_non_nullable
as String,conversionRate: null == conversionRate ? _self.conversionRate : conversionRate // ignore: cast_nullable_to_non_nullable
as double,unitPrice: freezed == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double?,isBaseUnit: null == isBaseUnit ? _self.isBaseUnit : isBaseUnit // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [ProductUnit].
extension ProductUnitPatterns on ProductUnit {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProductUnit value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProductUnit() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProductUnit value)  $default,){
final _that = this;
switch (_that) {
case _ProductUnit():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProductUnit value)?  $default,){
final _that = this;
switch (_that) {
case _ProductUnit() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String unitName,  double conversionRate,  double? unitPrice,  bool isBaseUnit)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProductUnit() when $default != null:
return $default(_that.id,_that.unitName,_that.conversionRate,_that.unitPrice,_that.isBaseUnit);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String unitName,  double conversionRate,  double? unitPrice,  bool isBaseUnit)  $default,) {final _that = this;
switch (_that) {
case _ProductUnit():
return $default(_that.id,_that.unitName,_that.conversionRate,_that.unitPrice,_that.isBaseUnit);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String unitName,  double conversionRate,  double? unitPrice,  bool isBaseUnit)?  $default,) {final _that = this;
switch (_that) {
case _ProductUnit() when $default != null:
return $default(_that.id,_that.unitName,_that.conversionRate,_that.unitPrice,_that.isBaseUnit);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProductUnit implements ProductUnit {
  const _ProductUnit({required this.id, required this.unitName, required this.conversionRate, required this.unitPrice, required this.isBaseUnit});
  factory _ProductUnit.fromJson(Map<String, dynamic> json) => _$ProductUnitFromJson(json);

@override final  String id;
@override final  String unitName;
@override final  double conversionRate;
@override final  double? unitPrice;
@override final  bool isBaseUnit;

/// Create a copy of ProductUnit
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProductUnitCopyWith<_ProductUnit> get copyWith => __$ProductUnitCopyWithImpl<_ProductUnit>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProductUnitToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProductUnit&&(identical(other.id, id) || other.id == id)&&(identical(other.unitName, unitName) || other.unitName == unitName)&&(identical(other.conversionRate, conversionRate) || other.conversionRate == conversionRate)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.isBaseUnit, isBaseUnit) || other.isBaseUnit == isBaseUnit));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,unitName,conversionRate,unitPrice,isBaseUnit);

@override
String toString() {
  return 'ProductUnit(id: $id, unitName: $unitName, conversionRate: $conversionRate, unitPrice: $unitPrice, isBaseUnit: $isBaseUnit)';
}


}

/// @nodoc
abstract mixin class _$ProductUnitCopyWith<$Res> implements $ProductUnitCopyWith<$Res> {
  factory _$ProductUnitCopyWith(_ProductUnit value, $Res Function(_ProductUnit) _then) = __$ProductUnitCopyWithImpl;
@override @useResult
$Res call({
 String id, String unitName, double conversionRate, double? unitPrice, bool isBaseUnit
});




}
/// @nodoc
class __$ProductUnitCopyWithImpl<$Res>
    implements _$ProductUnitCopyWith<$Res> {
  __$ProductUnitCopyWithImpl(this._self, this._then);

  final _ProductUnit _self;
  final $Res Function(_ProductUnit) _then;

/// Create a copy of ProductUnit
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? unitName = null,Object? conversionRate = null,Object? unitPrice = freezed,Object? isBaseUnit = null,}) {
  return _then(_ProductUnit(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,unitName: null == unitName ? _self.unitName : unitName // ignore: cast_nullable_to_non_nullable
as String,conversionRate: null == conversionRate ? _self.conversionRate : conversionRate // ignore: cast_nullable_to_non_nullable
as double,unitPrice: freezed == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double?,isBaseUnit: null == isBaseUnit ? _self.isBaseUnit : isBaseUnit // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$PosClient {

 String get id; String get name; String? get email; String? get phone;
/// Create a copy of PosClient
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PosClientCopyWith<PosClient> get copyWith => _$PosClientCopyWithImpl<PosClient>(this as PosClient, _$identity);

  /// Serializes this PosClient to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PosClient&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.email, email) || other.email == email)&&(identical(other.phone, phone) || other.phone == phone));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,email,phone);

@override
String toString() {
  return 'PosClient(id: $id, name: $name, email: $email, phone: $phone)';
}


}

/// @nodoc
abstract mixin class $PosClientCopyWith<$Res>  {
  factory $PosClientCopyWith(PosClient value, $Res Function(PosClient) _then) = _$PosClientCopyWithImpl;
@useResult
$Res call({
 String id, String name, String? email, String? phone
});




}
/// @nodoc
class _$PosClientCopyWithImpl<$Res>
    implements $PosClientCopyWith<$Res> {
  _$PosClientCopyWithImpl(this._self, this._then);

  final PosClient _self;
  final $Res Function(PosClient) _then;

/// Create a copy of PosClient
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? email = freezed,Object? phone = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [PosClient].
extension PosClientPatterns on PosClient {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PosClient value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PosClient() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PosClient value)  $default,){
final _that = this;
switch (_that) {
case _PosClient():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PosClient value)?  $default,){
final _that = this;
switch (_that) {
case _PosClient() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  String? email,  String? phone)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PosClient() when $default != null:
return $default(_that.id,_that.name,_that.email,_that.phone);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  String? email,  String? phone)  $default,) {final _that = this;
switch (_that) {
case _PosClient():
return $default(_that.id,_that.name,_that.email,_that.phone);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  String? email,  String? phone)?  $default,) {final _that = this;
switch (_that) {
case _PosClient() when $default != null:
return $default(_that.id,_that.name,_that.email,_that.phone);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PosClient implements PosClient {
  const _PosClient({required this.id, required this.name, this.email, this.phone});
  factory _PosClient.fromJson(Map<String, dynamic> json) => _$PosClientFromJson(json);

@override final  String id;
@override final  String name;
@override final  String? email;
@override final  String? phone;

/// Create a copy of PosClient
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PosClientCopyWith<_PosClient> get copyWith => __$PosClientCopyWithImpl<_PosClient>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PosClientToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PosClient&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.email, email) || other.email == email)&&(identical(other.phone, phone) || other.phone == phone));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,email,phone);

@override
String toString() {
  return 'PosClient(id: $id, name: $name, email: $email, phone: $phone)';
}


}

/// @nodoc
abstract mixin class _$PosClientCopyWith<$Res> implements $PosClientCopyWith<$Res> {
  factory _$PosClientCopyWith(_PosClient value, $Res Function(_PosClient) _then) = __$PosClientCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, String? email, String? phone
});




}
/// @nodoc
class __$PosClientCopyWithImpl<$Res>
    implements _$PosClientCopyWith<$Res> {
  __$PosClientCopyWithImpl(this._self, this._then);

  final _PosClient _self;
  final $Res Function(_PosClient) _then;

/// Create a copy of PosClient
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? email = freezed,Object? phone = freezed,}) {
  return _then(_PosClient(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,phone: freezed == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$CartItem {

 PosProduct get product; double get quantity; double get discount;// Per unit discount
 double get discountAmount;// Total discount for this line
 double get taxAmount; List<TaxBreakdown> get taxBreakdown; Map<String, double>? get unitQuantities;// For unit-managed products
 String? get notes;
/// Create a copy of CartItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CartItemCopyWith<CartItem> get copyWith => _$CartItemCopyWithImpl<CartItem>(this as CartItem, _$identity);

  /// Serializes this CartItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CartItem&&(identical(other.product, product) || other.product == product)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.discount, discount) || other.discount == discount)&&(identical(other.discountAmount, discountAmount) || other.discountAmount == discountAmount)&&(identical(other.taxAmount, taxAmount) || other.taxAmount == taxAmount)&&const DeepCollectionEquality().equals(other.taxBreakdown, taxBreakdown)&&const DeepCollectionEquality().equals(other.unitQuantities, unitQuantities)&&(identical(other.notes, notes) || other.notes == notes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,product,quantity,discount,discountAmount,taxAmount,const DeepCollectionEquality().hash(taxBreakdown),const DeepCollectionEquality().hash(unitQuantities),notes);

@override
String toString() {
  return 'CartItem(product: $product, quantity: $quantity, discount: $discount, discountAmount: $discountAmount, taxAmount: $taxAmount, taxBreakdown: $taxBreakdown, unitQuantities: $unitQuantities, notes: $notes)';
}


}

/// @nodoc
abstract mixin class $CartItemCopyWith<$Res>  {
  factory $CartItemCopyWith(CartItem value, $Res Function(CartItem) _then) = _$CartItemCopyWithImpl;
@useResult
$Res call({
 PosProduct product, double quantity, double discount, double discountAmount, double taxAmount, List<TaxBreakdown> taxBreakdown, Map<String, double>? unitQuantities, String? notes
});


$PosProductCopyWith<$Res> get product;

}
/// @nodoc
class _$CartItemCopyWithImpl<$Res>
    implements $CartItemCopyWith<$Res> {
  _$CartItemCopyWithImpl(this._self, this._then);

  final CartItem _self;
  final $Res Function(CartItem) _then;

/// Create a copy of CartItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? product = null,Object? quantity = null,Object? discount = null,Object? discountAmount = null,Object? taxAmount = null,Object? taxBreakdown = null,Object? unitQuantities = freezed,Object? notes = freezed,}) {
  return _then(_self.copyWith(
product: null == product ? _self.product : product // ignore: cast_nullable_to_non_nullable
as PosProduct,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as double,discount: null == discount ? _self.discount : discount // ignore: cast_nullable_to_non_nullable
as double,discountAmount: null == discountAmount ? _self.discountAmount : discountAmount // ignore: cast_nullable_to_non_nullable
as double,taxAmount: null == taxAmount ? _self.taxAmount : taxAmount // ignore: cast_nullable_to_non_nullable
as double,taxBreakdown: null == taxBreakdown ? _self.taxBreakdown : taxBreakdown // ignore: cast_nullable_to_non_nullable
as List<TaxBreakdown>,unitQuantities: freezed == unitQuantities ? _self.unitQuantities : unitQuantities // ignore: cast_nullable_to_non_nullable
as Map<String, double>?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of CartItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PosProductCopyWith<$Res> get product {
  
  return $PosProductCopyWith<$Res>(_self.product, (value) {
    return _then(_self.copyWith(product: value));
  });
}
}


/// Adds pattern-matching-related methods to [CartItem].
extension CartItemPatterns on CartItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CartItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CartItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CartItem value)  $default,){
final _that = this;
switch (_that) {
case _CartItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CartItem value)?  $default,){
final _that = this;
switch (_that) {
case _CartItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PosProduct product,  double quantity,  double discount,  double discountAmount,  double taxAmount,  List<TaxBreakdown> taxBreakdown,  Map<String, double>? unitQuantities,  String? notes)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CartItem() when $default != null:
return $default(_that.product,_that.quantity,_that.discount,_that.discountAmount,_that.taxAmount,_that.taxBreakdown,_that.unitQuantities,_that.notes);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PosProduct product,  double quantity,  double discount,  double discountAmount,  double taxAmount,  List<TaxBreakdown> taxBreakdown,  Map<String, double>? unitQuantities,  String? notes)  $default,) {final _that = this;
switch (_that) {
case _CartItem():
return $default(_that.product,_that.quantity,_that.discount,_that.discountAmount,_that.taxAmount,_that.taxBreakdown,_that.unitQuantities,_that.notes);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PosProduct product,  double quantity,  double discount,  double discountAmount,  double taxAmount,  List<TaxBreakdown> taxBreakdown,  Map<String, double>? unitQuantities,  String? notes)?  $default,) {final _that = this;
switch (_that) {
case _CartItem() when $default != null:
return $default(_that.product,_that.quantity,_that.discount,_that.discountAmount,_that.taxAmount,_that.taxBreakdown,_that.unitQuantities,_that.notes);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CartItem implements CartItem {
  const _CartItem({required this.product, this.quantity = 1, this.discount = 0, this.discountAmount = 0, this.taxAmount = 0, final  List<TaxBreakdown> taxBreakdown = const [], final  Map<String, double>? unitQuantities, this.notes}): _taxBreakdown = taxBreakdown,_unitQuantities = unitQuantities;
  factory _CartItem.fromJson(Map<String, dynamic> json) => _$CartItemFromJson(json);

@override final  PosProduct product;
@override@JsonKey() final  double quantity;
@override@JsonKey() final  double discount;
// Per unit discount
@override@JsonKey() final  double discountAmount;
// Total discount for this line
@override@JsonKey() final  double taxAmount;
 final  List<TaxBreakdown> _taxBreakdown;
@override@JsonKey() List<TaxBreakdown> get taxBreakdown {
  if (_taxBreakdown is EqualUnmodifiableListView) return _taxBreakdown;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_taxBreakdown);
}

 final  Map<String, double>? _unitQuantities;
@override Map<String, double>? get unitQuantities {
  final value = _unitQuantities;
  if (value == null) return null;
  if (_unitQuantities is EqualUnmodifiableMapView) return _unitQuantities;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}

// For unit-managed products
@override final  String? notes;

/// Create a copy of CartItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CartItemCopyWith<_CartItem> get copyWith => __$CartItemCopyWithImpl<_CartItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CartItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CartItem&&(identical(other.product, product) || other.product == product)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.discount, discount) || other.discount == discount)&&(identical(other.discountAmount, discountAmount) || other.discountAmount == discountAmount)&&(identical(other.taxAmount, taxAmount) || other.taxAmount == taxAmount)&&const DeepCollectionEquality().equals(other._taxBreakdown, _taxBreakdown)&&const DeepCollectionEquality().equals(other._unitQuantities, _unitQuantities)&&(identical(other.notes, notes) || other.notes == notes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,product,quantity,discount,discountAmount,taxAmount,const DeepCollectionEquality().hash(_taxBreakdown),const DeepCollectionEquality().hash(_unitQuantities),notes);

@override
String toString() {
  return 'CartItem(product: $product, quantity: $quantity, discount: $discount, discountAmount: $discountAmount, taxAmount: $taxAmount, taxBreakdown: $taxBreakdown, unitQuantities: $unitQuantities, notes: $notes)';
}


}

/// @nodoc
abstract mixin class _$CartItemCopyWith<$Res> implements $CartItemCopyWith<$Res> {
  factory _$CartItemCopyWith(_CartItem value, $Res Function(_CartItem) _then) = __$CartItemCopyWithImpl;
@override @useResult
$Res call({
 PosProduct product, double quantity, double discount, double discountAmount, double taxAmount, List<TaxBreakdown> taxBreakdown, Map<String, double>? unitQuantities, String? notes
});


@override $PosProductCopyWith<$Res> get product;

}
/// @nodoc
class __$CartItemCopyWithImpl<$Res>
    implements _$CartItemCopyWith<$Res> {
  __$CartItemCopyWithImpl(this._self, this._then);

  final _CartItem _self;
  final $Res Function(_CartItem) _then;

/// Create a copy of CartItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? product = null,Object? quantity = null,Object? discount = null,Object? discountAmount = null,Object? taxAmount = null,Object? taxBreakdown = null,Object? unitQuantities = freezed,Object? notes = freezed,}) {
  return _then(_CartItem(
product: null == product ? _self.product : product // ignore: cast_nullable_to_non_nullable
as PosProduct,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as double,discount: null == discount ? _self.discount : discount // ignore: cast_nullable_to_non_nullable
as double,discountAmount: null == discountAmount ? _self.discountAmount : discountAmount // ignore: cast_nullable_to_non_nullable
as double,taxAmount: null == taxAmount ? _self.taxAmount : taxAmount // ignore: cast_nullable_to_non_nullable
as double,taxBreakdown: null == taxBreakdown ? _self._taxBreakdown : taxBreakdown // ignore: cast_nullable_to_non_nullable
as List<TaxBreakdown>,unitQuantities: freezed == unitQuantities ? _self._unitQuantities : unitQuantities // ignore: cast_nullable_to_non_nullable
as Map<String, double>?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of CartItem
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
mixin _$TaxBreakdown {

 String get taxName; double get rate; double get amount;
/// Create a copy of TaxBreakdown
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TaxBreakdownCopyWith<TaxBreakdown> get copyWith => _$TaxBreakdownCopyWithImpl<TaxBreakdown>(this as TaxBreakdown, _$identity);

  /// Serializes this TaxBreakdown to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TaxBreakdown&&(identical(other.taxName, taxName) || other.taxName == taxName)&&(identical(other.rate, rate) || other.rate == rate)&&(identical(other.amount, amount) || other.amount == amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,taxName,rate,amount);

@override
String toString() {
  return 'TaxBreakdown(taxName: $taxName, rate: $rate, amount: $amount)';
}


}

/// @nodoc
abstract mixin class $TaxBreakdownCopyWith<$Res>  {
  factory $TaxBreakdownCopyWith(TaxBreakdown value, $Res Function(TaxBreakdown) _then) = _$TaxBreakdownCopyWithImpl;
@useResult
$Res call({
 String taxName, double rate, double amount
});




}
/// @nodoc
class _$TaxBreakdownCopyWithImpl<$Res>
    implements $TaxBreakdownCopyWith<$Res> {
  _$TaxBreakdownCopyWithImpl(this._self, this._then);

  final TaxBreakdown _self;
  final $Res Function(TaxBreakdown) _then;

/// Create a copy of TaxBreakdown
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? taxName = null,Object? rate = null,Object? amount = null,}) {
  return _then(_self.copyWith(
taxName: null == taxName ? _self.taxName : taxName // ignore: cast_nullable_to_non_nullable
as String,rate: null == rate ? _self.rate : rate // ignore: cast_nullable_to_non_nullable
as double,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as double,
  ));
}

}


/// Adds pattern-matching-related methods to [TaxBreakdown].
extension TaxBreakdownPatterns on TaxBreakdown {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TaxBreakdown value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TaxBreakdown() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TaxBreakdown value)  $default,){
final _that = this;
switch (_that) {
case _TaxBreakdown():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TaxBreakdown value)?  $default,){
final _that = this;
switch (_that) {
case _TaxBreakdown() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String taxName,  double rate,  double amount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TaxBreakdown() when $default != null:
return $default(_that.taxName,_that.rate,_that.amount);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String taxName,  double rate,  double amount)  $default,) {final _that = this;
switch (_that) {
case _TaxBreakdown():
return $default(_that.taxName,_that.rate,_that.amount);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String taxName,  double rate,  double amount)?  $default,) {final _that = this;
switch (_that) {
case _TaxBreakdown() when $default != null:
return $default(_that.taxName,_that.rate,_that.amount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TaxBreakdown implements TaxBreakdown {
  const _TaxBreakdown({required this.taxName, required this.rate, required this.amount});
  factory _TaxBreakdown.fromJson(Map<String, dynamic> json) => _$TaxBreakdownFromJson(json);

@override final  String taxName;
@override final  double rate;
@override final  double amount;

/// Create a copy of TaxBreakdown
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TaxBreakdownCopyWith<_TaxBreakdown> get copyWith => __$TaxBreakdownCopyWithImpl<_TaxBreakdown>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TaxBreakdownToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TaxBreakdown&&(identical(other.taxName, taxName) || other.taxName == taxName)&&(identical(other.rate, rate) || other.rate == rate)&&(identical(other.amount, amount) || other.amount == amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,taxName,rate,amount);

@override
String toString() {
  return 'TaxBreakdown(taxName: $taxName, rate: $rate, amount: $amount)';
}


}

/// @nodoc
abstract mixin class _$TaxBreakdownCopyWith<$Res> implements $TaxBreakdownCopyWith<$Res> {
  factory _$TaxBreakdownCopyWith(_TaxBreakdown value, $Res Function(_TaxBreakdown) _then) = __$TaxBreakdownCopyWithImpl;
@override @useResult
$Res call({
 String taxName, double rate, double amount
});




}
/// @nodoc
class __$TaxBreakdownCopyWithImpl<$Res>
    implements _$TaxBreakdownCopyWith<$Res> {
  __$TaxBreakdownCopyWithImpl(this._self, this._then);

  final _TaxBreakdown _self;
  final $Res Function(_TaxBreakdown) _then;

/// Create a copy of TaxBreakdown
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? taxName = null,Object? rate = null,Object? amount = null,}) {
  return _then(_TaxBreakdown(
taxName: null == taxName ? _self.taxName : taxName // ignore: cast_nullable_to_non_nullable
as String,rate: null == rate ? _self.rate : rate // ignore: cast_nullable_to_non_nullable
as double,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}


/// @nodoc
mixin _$PaymentAllocation {

 String get paymentAccountId; double get amount;
/// Create a copy of PaymentAllocation
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaymentAllocationCopyWith<PaymentAllocation> get copyWith => _$PaymentAllocationCopyWithImpl<PaymentAllocation>(this as PaymentAllocation, _$identity);

  /// Serializes this PaymentAllocation to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaymentAllocation&&(identical(other.paymentAccountId, paymentAccountId) || other.paymentAccountId == paymentAccountId)&&(identical(other.amount, amount) || other.amount == amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,paymentAccountId,amount);

@override
String toString() {
  return 'PaymentAllocation(paymentAccountId: $paymentAccountId, amount: $amount)';
}


}

/// @nodoc
abstract mixin class $PaymentAllocationCopyWith<$Res>  {
  factory $PaymentAllocationCopyWith(PaymentAllocation value, $Res Function(PaymentAllocation) _then) = _$PaymentAllocationCopyWithImpl;
@useResult
$Res call({
 String paymentAccountId, double amount
});




}
/// @nodoc
class _$PaymentAllocationCopyWithImpl<$Res>
    implements $PaymentAllocationCopyWith<$Res> {
  _$PaymentAllocationCopyWithImpl(this._self, this._then);

  final PaymentAllocation _self;
  final $Res Function(PaymentAllocation) _then;

/// Create a copy of PaymentAllocation
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? paymentAccountId = null,Object? amount = null,}) {
  return _then(_self.copyWith(
paymentAccountId: null == paymentAccountId ? _self.paymentAccountId : paymentAccountId // ignore: cast_nullable_to_non_nullable
as String,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as double,
  ));
}

}


/// Adds pattern-matching-related methods to [PaymentAllocation].
extension PaymentAllocationPatterns on PaymentAllocation {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaymentAllocation value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaymentAllocation() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaymentAllocation value)  $default,){
final _that = this;
switch (_that) {
case _PaymentAllocation():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaymentAllocation value)?  $default,){
final _that = this;
switch (_that) {
case _PaymentAllocation() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String paymentAccountId,  double amount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaymentAllocation() when $default != null:
return $default(_that.paymentAccountId,_that.amount);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String paymentAccountId,  double amount)  $default,) {final _that = this;
switch (_that) {
case _PaymentAllocation():
return $default(_that.paymentAccountId,_that.amount);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String paymentAccountId,  double amount)?  $default,) {final _that = this;
switch (_that) {
case _PaymentAllocation() when $default != null:
return $default(_that.paymentAccountId,_that.amount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaymentAllocation implements PaymentAllocation {
  const _PaymentAllocation({required this.paymentAccountId, required this.amount});
  factory _PaymentAllocation.fromJson(Map<String, dynamic> json) => _$PaymentAllocationFromJson(json);

@override final  String paymentAccountId;
@override final  double amount;

/// Create a copy of PaymentAllocation
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaymentAllocationCopyWith<_PaymentAllocation> get copyWith => __$PaymentAllocationCopyWithImpl<_PaymentAllocation>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaymentAllocationToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaymentAllocation&&(identical(other.paymentAccountId, paymentAccountId) || other.paymentAccountId == paymentAccountId)&&(identical(other.amount, amount) || other.amount == amount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,paymentAccountId,amount);

@override
String toString() {
  return 'PaymentAllocation(paymentAccountId: $paymentAccountId, amount: $amount)';
}


}

/// @nodoc
abstract mixin class _$PaymentAllocationCopyWith<$Res> implements $PaymentAllocationCopyWith<$Res> {
  factory _$PaymentAllocationCopyWith(_PaymentAllocation value, $Res Function(_PaymentAllocation) _then) = __$PaymentAllocationCopyWithImpl;
@override @useResult
$Res call({
 String paymentAccountId, double amount
});




}
/// @nodoc
class __$PaymentAllocationCopyWithImpl<$Res>
    implements _$PaymentAllocationCopyWith<$Res> {
  __$PaymentAllocationCopyWithImpl(this._self, this._then);

  final _PaymentAllocation _self;
  final $Res Function(_PaymentAllocation) _then;

/// Create a copy of PaymentAllocation
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? paymentAccountId = null,Object? amount = null,}) {
  return _then(_PaymentAllocation(
paymentAccountId: null == paymentAccountId ? _self.paymentAccountId : paymentAccountId // ignore: cast_nullable_to_non_nullable
as String,amount: null == amount ? _self.amount : amount // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}


/// @nodoc
mixin _$SaleRequest {

 String? get clientId; String? get branchId; List<SaleItemRequest> get items; double get subtotal; double get totalTaxAmount; double get totalDiscountAmount; double get globalDiscount; double get total; List<PaymentAllocation>? get paymentAllocations; String? get paymentMethod;// Legacy support
 String? get notes; String get status;
/// Create a copy of SaleRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SaleRequestCopyWith<SaleRequest> get copyWith => _$SaleRequestCopyWithImpl<SaleRequest>(this as SaleRequest, _$identity);

  /// Serializes this SaleRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SaleRequest&&(identical(other.clientId, clientId) || other.clientId == clientId)&&(identical(other.branchId, branchId) || other.branchId == branchId)&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.totalTaxAmount, totalTaxAmount) || other.totalTaxAmount == totalTaxAmount)&&(identical(other.totalDiscountAmount, totalDiscountAmount) || other.totalDiscountAmount == totalDiscountAmount)&&(identical(other.globalDiscount, globalDiscount) || other.globalDiscount == globalDiscount)&&(identical(other.total, total) || other.total == total)&&const DeepCollectionEquality().equals(other.paymentAllocations, paymentAllocations)&&(identical(other.paymentMethod, paymentMethod) || other.paymentMethod == paymentMethod)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,clientId,branchId,const DeepCollectionEquality().hash(items),subtotal,totalTaxAmount,totalDiscountAmount,globalDiscount,total,const DeepCollectionEquality().hash(paymentAllocations),paymentMethod,notes,status);

@override
String toString() {
  return 'SaleRequest(clientId: $clientId, branchId: $branchId, items: $items, subtotal: $subtotal, totalTaxAmount: $totalTaxAmount, totalDiscountAmount: $totalDiscountAmount, globalDiscount: $globalDiscount, total: $total, paymentAllocations: $paymentAllocations, paymentMethod: $paymentMethod, notes: $notes, status: $status)';
}


}

/// @nodoc
abstract mixin class $SaleRequestCopyWith<$Res>  {
  factory $SaleRequestCopyWith(SaleRequest value, $Res Function(SaleRequest) _then) = _$SaleRequestCopyWithImpl;
@useResult
$Res call({
 String? clientId, String? branchId, List<SaleItemRequest> items, double subtotal, double totalTaxAmount, double totalDiscountAmount, double globalDiscount, double total, List<PaymentAllocation>? paymentAllocations, String? paymentMethod, String? notes, String status
});




}
/// @nodoc
class _$SaleRequestCopyWithImpl<$Res>
    implements $SaleRequestCopyWith<$Res> {
  _$SaleRequestCopyWithImpl(this._self, this._then);

  final SaleRequest _self;
  final $Res Function(SaleRequest) _then;

/// Create a copy of SaleRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? clientId = freezed,Object? branchId = freezed,Object? items = null,Object? subtotal = null,Object? totalTaxAmount = null,Object? totalDiscountAmount = null,Object? globalDiscount = null,Object? total = null,Object? paymentAllocations = freezed,Object? paymentMethod = freezed,Object? notes = freezed,Object? status = null,}) {
  return _then(_self.copyWith(
clientId: freezed == clientId ? _self.clientId : clientId // ignore: cast_nullable_to_non_nullable
as String?,branchId: freezed == branchId ? _self.branchId : branchId // ignore: cast_nullable_to_non_nullable
as String?,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<SaleItemRequest>,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as double,totalTaxAmount: null == totalTaxAmount ? _self.totalTaxAmount : totalTaxAmount // ignore: cast_nullable_to_non_nullable
as double,totalDiscountAmount: null == totalDiscountAmount ? _self.totalDiscountAmount : totalDiscountAmount // ignore: cast_nullable_to_non_nullable
as double,globalDiscount: null == globalDiscount ? _self.globalDiscount : globalDiscount // ignore: cast_nullable_to_non_nullable
as double,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,paymentAllocations: freezed == paymentAllocations ? _self.paymentAllocations : paymentAllocations // ignore: cast_nullable_to_non_nullable
as List<PaymentAllocation>?,paymentMethod: freezed == paymentMethod ? _self.paymentMethod : paymentMethod // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [SaleRequest].
extension SaleRequestPatterns on SaleRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SaleRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SaleRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SaleRequest value)  $default,){
final _that = this;
switch (_that) {
case _SaleRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SaleRequest value)?  $default,){
final _that = this;
switch (_that) {
case _SaleRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? clientId,  String? branchId,  List<SaleItemRequest> items,  double subtotal,  double totalTaxAmount,  double totalDiscountAmount,  double globalDiscount,  double total,  List<PaymentAllocation>? paymentAllocations,  String? paymentMethod,  String? notes,  String status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SaleRequest() when $default != null:
return $default(_that.clientId,_that.branchId,_that.items,_that.subtotal,_that.totalTaxAmount,_that.totalDiscountAmount,_that.globalDiscount,_that.total,_that.paymentAllocations,_that.paymentMethod,_that.notes,_that.status);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? clientId,  String? branchId,  List<SaleItemRequest> items,  double subtotal,  double totalTaxAmount,  double totalDiscountAmount,  double globalDiscount,  double total,  List<PaymentAllocation>? paymentAllocations,  String? paymentMethod,  String? notes,  String status)  $default,) {final _that = this;
switch (_that) {
case _SaleRequest():
return $default(_that.clientId,_that.branchId,_that.items,_that.subtotal,_that.totalTaxAmount,_that.totalDiscountAmount,_that.globalDiscount,_that.total,_that.paymentAllocations,_that.paymentMethod,_that.notes,_that.status);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? clientId,  String? branchId,  List<SaleItemRequest> items,  double subtotal,  double totalTaxAmount,  double totalDiscountAmount,  double globalDiscount,  double total,  List<PaymentAllocation>? paymentAllocations,  String? paymentMethod,  String? notes,  String status)?  $default,) {final _that = this;
switch (_that) {
case _SaleRequest() when $default != null:
return $default(_that.clientId,_that.branchId,_that.items,_that.subtotal,_that.totalTaxAmount,_that.totalDiscountAmount,_that.globalDiscount,_that.total,_that.paymentAllocations,_that.paymentMethod,_that.notes,_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SaleRequest implements SaleRequest {
  const _SaleRequest({this.clientId, this.branchId, required final  List<SaleItemRequest> items, required this.subtotal, required this.totalTaxAmount, required this.totalDiscountAmount, this.globalDiscount = 0, required this.total, final  List<PaymentAllocation>? paymentAllocations, this.paymentMethod, this.notes, this.status = 'completed'}): _items = items,_paymentAllocations = paymentAllocations;
  factory _SaleRequest.fromJson(Map<String, dynamic> json) => _$SaleRequestFromJson(json);

@override final  String? clientId;
@override final  String? branchId;
 final  List<SaleItemRequest> _items;
@override List<SaleItemRequest> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  double subtotal;
@override final  double totalTaxAmount;
@override final  double totalDiscountAmount;
@override@JsonKey() final  double globalDiscount;
@override final  double total;
 final  List<PaymentAllocation>? _paymentAllocations;
@override List<PaymentAllocation>? get paymentAllocations {
  final value = _paymentAllocations;
  if (value == null) return null;
  if (_paymentAllocations is EqualUnmodifiableListView) return _paymentAllocations;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

@override final  String? paymentMethod;
// Legacy support
@override final  String? notes;
@override@JsonKey() final  String status;

/// Create a copy of SaleRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SaleRequestCopyWith<_SaleRequest> get copyWith => __$SaleRequestCopyWithImpl<_SaleRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SaleRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SaleRequest&&(identical(other.clientId, clientId) || other.clientId == clientId)&&(identical(other.branchId, branchId) || other.branchId == branchId)&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.totalTaxAmount, totalTaxAmount) || other.totalTaxAmount == totalTaxAmount)&&(identical(other.totalDiscountAmount, totalDiscountAmount) || other.totalDiscountAmount == totalDiscountAmount)&&(identical(other.globalDiscount, globalDiscount) || other.globalDiscount == globalDiscount)&&(identical(other.total, total) || other.total == total)&&const DeepCollectionEquality().equals(other._paymentAllocations, _paymentAllocations)&&(identical(other.paymentMethod, paymentMethod) || other.paymentMethod == paymentMethod)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,clientId,branchId,const DeepCollectionEquality().hash(_items),subtotal,totalTaxAmount,totalDiscountAmount,globalDiscount,total,const DeepCollectionEquality().hash(_paymentAllocations),paymentMethod,notes,status);

@override
String toString() {
  return 'SaleRequest(clientId: $clientId, branchId: $branchId, items: $items, subtotal: $subtotal, totalTaxAmount: $totalTaxAmount, totalDiscountAmount: $totalDiscountAmount, globalDiscount: $globalDiscount, total: $total, paymentAllocations: $paymentAllocations, paymentMethod: $paymentMethod, notes: $notes, status: $status)';
}


}

/// @nodoc
abstract mixin class _$SaleRequestCopyWith<$Res> implements $SaleRequestCopyWith<$Res> {
  factory _$SaleRequestCopyWith(_SaleRequest value, $Res Function(_SaleRequest) _then) = __$SaleRequestCopyWithImpl;
@override @useResult
$Res call({
 String? clientId, String? branchId, List<SaleItemRequest> items, double subtotal, double totalTaxAmount, double totalDiscountAmount, double globalDiscount, double total, List<PaymentAllocation>? paymentAllocations, String? paymentMethod, String? notes, String status
});




}
/// @nodoc
class __$SaleRequestCopyWithImpl<$Res>
    implements _$SaleRequestCopyWith<$Res> {
  __$SaleRequestCopyWithImpl(this._self, this._then);

  final _SaleRequest _self;
  final $Res Function(_SaleRequest) _then;

/// Create a copy of SaleRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? clientId = freezed,Object? branchId = freezed,Object? items = null,Object? subtotal = null,Object? totalTaxAmount = null,Object? totalDiscountAmount = null,Object? globalDiscount = null,Object? total = null,Object? paymentAllocations = freezed,Object? paymentMethod = freezed,Object? notes = freezed,Object? status = null,}) {
  return _then(_SaleRequest(
clientId: freezed == clientId ? _self.clientId : clientId // ignore: cast_nullable_to_non_nullable
as String?,branchId: freezed == branchId ? _self.branchId : branchId // ignore: cast_nullable_to_non_nullable
as String?,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<SaleItemRequest>,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as double,totalTaxAmount: null == totalTaxAmount ? _self.totalTaxAmount : totalTaxAmount // ignore: cast_nullable_to_non_nullable
as double,totalDiscountAmount: null == totalDiscountAmount ? _self.totalDiscountAmount : totalDiscountAmount // ignore: cast_nullable_to_non_nullable
as double,globalDiscount: null == globalDiscount ? _self.globalDiscount : globalDiscount // ignore: cast_nullable_to_non_nullable
as double,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,paymentAllocations: freezed == paymentAllocations ? _self._paymentAllocations : paymentAllocations // ignore: cast_nullable_to_non_nullable
as List<PaymentAllocation>?,paymentMethod: freezed == paymentMethod ? _self.paymentMethod : paymentMethod // ignore: cast_nullable_to_non_nullable
as String?,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$SaleItemRequest {

 String? get productId; String get description; double get quantity; double get unitPrice; double get taxRate; double get taxAmount; String? get taxDescription; double get discount; double get discountAmount; bool get isCustom; String? get accountId; Map<String, double>? get unitQuantities;
/// Create a copy of SaleItemRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SaleItemRequestCopyWith<SaleItemRequest> get copyWith => _$SaleItemRequestCopyWithImpl<SaleItemRequest>(this as SaleItemRequest, _$identity);

  /// Serializes this SaleItemRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SaleItemRequest&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.description, description) || other.description == description)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.taxRate, taxRate) || other.taxRate == taxRate)&&(identical(other.taxAmount, taxAmount) || other.taxAmount == taxAmount)&&(identical(other.taxDescription, taxDescription) || other.taxDescription == taxDescription)&&(identical(other.discount, discount) || other.discount == discount)&&(identical(other.discountAmount, discountAmount) || other.discountAmount == discountAmount)&&(identical(other.isCustom, isCustom) || other.isCustom == isCustom)&&(identical(other.accountId, accountId) || other.accountId == accountId)&&const DeepCollectionEquality().equals(other.unitQuantities, unitQuantities));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,productId,description,quantity,unitPrice,taxRate,taxAmount,taxDescription,discount,discountAmount,isCustom,accountId,const DeepCollectionEquality().hash(unitQuantities));

@override
String toString() {
  return 'SaleItemRequest(productId: $productId, description: $description, quantity: $quantity, unitPrice: $unitPrice, taxRate: $taxRate, taxAmount: $taxAmount, taxDescription: $taxDescription, discount: $discount, discountAmount: $discountAmount, isCustom: $isCustom, accountId: $accountId, unitQuantities: $unitQuantities)';
}


}

/// @nodoc
abstract mixin class $SaleItemRequestCopyWith<$Res>  {
  factory $SaleItemRequestCopyWith(SaleItemRequest value, $Res Function(SaleItemRequest) _then) = _$SaleItemRequestCopyWithImpl;
@useResult
$Res call({
 String? productId, String description, double quantity, double unitPrice, double taxRate, double taxAmount, String? taxDescription, double discount, double discountAmount, bool isCustom, String? accountId, Map<String, double>? unitQuantities
});




}
/// @nodoc
class _$SaleItemRequestCopyWithImpl<$Res>
    implements $SaleItemRequestCopyWith<$Res> {
  _$SaleItemRequestCopyWithImpl(this._self, this._then);

  final SaleItemRequest _self;
  final $Res Function(SaleItemRequest) _then;

/// Create a copy of SaleItemRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? productId = freezed,Object? description = null,Object? quantity = null,Object? unitPrice = null,Object? taxRate = null,Object? taxAmount = null,Object? taxDescription = freezed,Object? discount = null,Object? discountAmount = null,Object? isCustom = null,Object? accountId = freezed,Object? unitQuantities = freezed,}) {
  return _then(_self.copyWith(
productId: freezed == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String?,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as double,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,taxRate: null == taxRate ? _self.taxRate : taxRate // ignore: cast_nullable_to_non_nullable
as double,taxAmount: null == taxAmount ? _self.taxAmount : taxAmount // ignore: cast_nullable_to_non_nullable
as double,taxDescription: freezed == taxDescription ? _self.taxDescription : taxDescription // ignore: cast_nullable_to_non_nullable
as String?,discount: null == discount ? _self.discount : discount // ignore: cast_nullable_to_non_nullable
as double,discountAmount: null == discountAmount ? _self.discountAmount : discountAmount // ignore: cast_nullable_to_non_nullable
as double,isCustom: null == isCustom ? _self.isCustom : isCustom // ignore: cast_nullable_to_non_nullable
as bool,accountId: freezed == accountId ? _self.accountId : accountId // ignore: cast_nullable_to_non_nullable
as String?,unitQuantities: freezed == unitQuantities ? _self.unitQuantities : unitQuantities // ignore: cast_nullable_to_non_nullable
as Map<String, double>?,
  ));
}

}


/// Adds pattern-matching-related methods to [SaleItemRequest].
extension SaleItemRequestPatterns on SaleItemRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SaleItemRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SaleItemRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SaleItemRequest value)  $default,){
final _that = this;
switch (_that) {
case _SaleItemRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SaleItemRequest value)?  $default,){
final _that = this;
switch (_that) {
case _SaleItemRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? productId,  String description,  double quantity,  double unitPrice,  double taxRate,  double taxAmount,  String? taxDescription,  double discount,  double discountAmount,  bool isCustom,  String? accountId,  Map<String, double>? unitQuantities)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SaleItemRequest() when $default != null:
return $default(_that.productId,_that.description,_that.quantity,_that.unitPrice,_that.taxRate,_that.taxAmount,_that.taxDescription,_that.discount,_that.discountAmount,_that.isCustom,_that.accountId,_that.unitQuantities);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? productId,  String description,  double quantity,  double unitPrice,  double taxRate,  double taxAmount,  String? taxDescription,  double discount,  double discountAmount,  bool isCustom,  String? accountId,  Map<String, double>? unitQuantities)  $default,) {final _that = this;
switch (_that) {
case _SaleItemRequest():
return $default(_that.productId,_that.description,_that.quantity,_that.unitPrice,_that.taxRate,_that.taxAmount,_that.taxDescription,_that.discount,_that.discountAmount,_that.isCustom,_that.accountId,_that.unitQuantities);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? productId,  String description,  double quantity,  double unitPrice,  double taxRate,  double taxAmount,  String? taxDescription,  double discount,  double discountAmount,  bool isCustom,  String? accountId,  Map<String, double>? unitQuantities)?  $default,) {final _that = this;
switch (_that) {
case _SaleItemRequest() when $default != null:
return $default(_that.productId,_that.description,_that.quantity,_that.unitPrice,_that.taxRate,_that.taxAmount,_that.taxDescription,_that.discount,_that.discountAmount,_that.isCustom,_that.accountId,_that.unitQuantities);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SaleItemRequest implements SaleItemRequest {
  const _SaleItemRequest({this.productId, required this.description, required this.quantity, required this.unitPrice, this.taxRate = 0, this.taxAmount = 0, this.taxDescription, this.discount = 0, this.discountAmount = 0, this.isCustom = false, this.accountId, final  Map<String, double>? unitQuantities}): _unitQuantities = unitQuantities;
  factory _SaleItemRequest.fromJson(Map<String, dynamic> json) => _$SaleItemRequestFromJson(json);

@override final  String? productId;
@override final  String description;
@override final  double quantity;
@override final  double unitPrice;
@override@JsonKey() final  double taxRate;
@override@JsonKey() final  double taxAmount;
@override final  String? taxDescription;
@override@JsonKey() final  double discount;
@override@JsonKey() final  double discountAmount;
@override@JsonKey() final  bool isCustom;
@override final  String? accountId;
 final  Map<String, double>? _unitQuantities;
@override Map<String, double>? get unitQuantities {
  final value = _unitQuantities;
  if (value == null) return null;
  if (_unitQuantities is EqualUnmodifiableMapView) return _unitQuantities;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}


/// Create a copy of SaleItemRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SaleItemRequestCopyWith<_SaleItemRequest> get copyWith => __$SaleItemRequestCopyWithImpl<_SaleItemRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SaleItemRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SaleItemRequest&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.description, description) || other.description == description)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.taxRate, taxRate) || other.taxRate == taxRate)&&(identical(other.taxAmount, taxAmount) || other.taxAmount == taxAmount)&&(identical(other.taxDescription, taxDescription) || other.taxDescription == taxDescription)&&(identical(other.discount, discount) || other.discount == discount)&&(identical(other.discountAmount, discountAmount) || other.discountAmount == discountAmount)&&(identical(other.isCustom, isCustom) || other.isCustom == isCustom)&&(identical(other.accountId, accountId) || other.accountId == accountId)&&const DeepCollectionEquality().equals(other._unitQuantities, _unitQuantities));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,productId,description,quantity,unitPrice,taxRate,taxAmount,taxDescription,discount,discountAmount,isCustom,accountId,const DeepCollectionEquality().hash(_unitQuantities));

@override
String toString() {
  return 'SaleItemRequest(productId: $productId, description: $description, quantity: $quantity, unitPrice: $unitPrice, taxRate: $taxRate, taxAmount: $taxAmount, taxDescription: $taxDescription, discount: $discount, discountAmount: $discountAmount, isCustom: $isCustom, accountId: $accountId, unitQuantities: $unitQuantities)';
}


}

/// @nodoc
abstract mixin class _$SaleItemRequestCopyWith<$Res> implements $SaleItemRequestCopyWith<$Res> {
  factory _$SaleItemRequestCopyWith(_SaleItemRequest value, $Res Function(_SaleItemRequest) _then) = __$SaleItemRequestCopyWithImpl;
@override @useResult
$Res call({
 String? productId, String description, double quantity, double unitPrice, double taxRate, double taxAmount, String? taxDescription, double discount, double discountAmount, bool isCustom, String? accountId, Map<String, double>? unitQuantities
});




}
/// @nodoc
class __$SaleItemRequestCopyWithImpl<$Res>
    implements _$SaleItemRequestCopyWith<$Res> {
  __$SaleItemRequestCopyWithImpl(this._self, this._then);

  final _SaleItemRequest _self;
  final $Res Function(_SaleItemRequest) _then;

/// Create a copy of SaleItemRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? productId = freezed,Object? description = null,Object? quantity = null,Object? unitPrice = null,Object? taxRate = null,Object? taxAmount = null,Object? taxDescription = freezed,Object? discount = null,Object? discountAmount = null,Object? isCustom = null,Object? accountId = freezed,Object? unitQuantities = freezed,}) {
  return _then(_SaleItemRequest(
productId: freezed == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String?,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as double,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as double,taxRate: null == taxRate ? _self.taxRate : taxRate // ignore: cast_nullable_to_non_nullable
as double,taxAmount: null == taxAmount ? _self.taxAmount : taxAmount // ignore: cast_nullable_to_non_nullable
as double,taxDescription: freezed == taxDescription ? _self.taxDescription : taxDescription // ignore: cast_nullable_to_non_nullable
as String?,discount: null == discount ? _self.discount : discount // ignore: cast_nullable_to_non_nullable
as double,discountAmount: null == discountAmount ? _self.discountAmount : discountAmount // ignore: cast_nullable_to_non_nullable
as double,isCustom: null == isCustom ? _self.isCustom : isCustom // ignore: cast_nullable_to_non_nullable
as bool,accountId: freezed == accountId ? _self.accountId : accountId // ignore: cast_nullable_to_non_nullable
as String?,unitQuantities: freezed == unitQuantities ? _self._unitQuantities : unitQuantities // ignore: cast_nullable_to_non_nullable
as Map<String, double>?,
  ));
}


}

// dart format on
