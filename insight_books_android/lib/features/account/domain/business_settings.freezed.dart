// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'business_settings.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$BusinessSettings {

 String get name; String? get subdomain; String? get subscriptionPlan; String? get logoUrl; String? get faviconUrl; String get primaryColor; String get secondaryColor;// Address info
 String? get buildingName; String? get businessAddress; String? get businessCity; String? get businessPhone; String? get businessEmail;// Receipt customization
 String? get receiptFooter;// Settings
 String? get emailFooter; String get currencyCode; bool get taxEnabled; double get defaultTaxRate; String? get customDomain;// Notifications
 bool get emailNotifications; bool get smsNotifications; bool get inAppNotifications;
/// Create a copy of BusinessSettings
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BusinessSettingsCopyWith<BusinessSettings> get copyWith => _$BusinessSettingsCopyWithImpl<BusinessSettings>(this as BusinessSettings, _$identity);

  /// Serializes this BusinessSettings to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BusinessSettings&&(identical(other.name, name) || other.name == name)&&(identical(other.subdomain, subdomain) || other.subdomain == subdomain)&&(identical(other.subscriptionPlan, subscriptionPlan) || other.subscriptionPlan == subscriptionPlan)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.faviconUrl, faviconUrl) || other.faviconUrl == faviconUrl)&&(identical(other.primaryColor, primaryColor) || other.primaryColor == primaryColor)&&(identical(other.secondaryColor, secondaryColor) || other.secondaryColor == secondaryColor)&&(identical(other.buildingName, buildingName) || other.buildingName == buildingName)&&(identical(other.businessAddress, businessAddress) || other.businessAddress == businessAddress)&&(identical(other.businessCity, businessCity) || other.businessCity == businessCity)&&(identical(other.businessPhone, businessPhone) || other.businessPhone == businessPhone)&&(identical(other.businessEmail, businessEmail) || other.businessEmail == businessEmail)&&(identical(other.receiptFooter, receiptFooter) || other.receiptFooter == receiptFooter)&&(identical(other.emailFooter, emailFooter) || other.emailFooter == emailFooter)&&(identical(other.currencyCode, currencyCode) || other.currencyCode == currencyCode)&&(identical(other.taxEnabled, taxEnabled) || other.taxEnabled == taxEnabled)&&(identical(other.defaultTaxRate, defaultTaxRate) || other.defaultTaxRate == defaultTaxRate)&&(identical(other.customDomain, customDomain) || other.customDomain == customDomain)&&(identical(other.emailNotifications, emailNotifications) || other.emailNotifications == emailNotifications)&&(identical(other.smsNotifications, smsNotifications) || other.smsNotifications == smsNotifications)&&(identical(other.inAppNotifications, inAppNotifications) || other.inAppNotifications == inAppNotifications));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,name,subdomain,subscriptionPlan,logoUrl,faviconUrl,primaryColor,secondaryColor,buildingName,businessAddress,businessCity,businessPhone,businessEmail,receiptFooter,emailFooter,currencyCode,taxEnabled,defaultTaxRate,customDomain,emailNotifications,smsNotifications,inAppNotifications]);

@override
String toString() {
  return 'BusinessSettings(name: $name, subdomain: $subdomain, subscriptionPlan: $subscriptionPlan, logoUrl: $logoUrl, faviconUrl: $faviconUrl, primaryColor: $primaryColor, secondaryColor: $secondaryColor, buildingName: $buildingName, businessAddress: $businessAddress, businessCity: $businessCity, businessPhone: $businessPhone, businessEmail: $businessEmail, receiptFooter: $receiptFooter, emailFooter: $emailFooter, currencyCode: $currencyCode, taxEnabled: $taxEnabled, defaultTaxRate: $defaultTaxRate, customDomain: $customDomain, emailNotifications: $emailNotifications, smsNotifications: $smsNotifications, inAppNotifications: $inAppNotifications)';
}


}

/// @nodoc
abstract mixin class $BusinessSettingsCopyWith<$Res>  {
  factory $BusinessSettingsCopyWith(BusinessSettings value, $Res Function(BusinessSettings) _then) = _$BusinessSettingsCopyWithImpl;
@useResult
$Res call({
 String name, String? subdomain, String? subscriptionPlan, String? logoUrl, String? faviconUrl, String primaryColor, String secondaryColor, String? buildingName, String? businessAddress, String? businessCity, String? businessPhone, String? businessEmail, String? receiptFooter, String? emailFooter, String currencyCode, bool taxEnabled, double defaultTaxRate, String? customDomain, bool emailNotifications, bool smsNotifications, bool inAppNotifications
});




}
/// @nodoc
class _$BusinessSettingsCopyWithImpl<$Res>
    implements $BusinessSettingsCopyWith<$Res> {
  _$BusinessSettingsCopyWithImpl(this._self, this._then);

  final BusinessSettings _self;
  final $Res Function(BusinessSettings) _then;

/// Create a copy of BusinessSettings
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? subdomain = freezed,Object? subscriptionPlan = freezed,Object? logoUrl = freezed,Object? faviconUrl = freezed,Object? primaryColor = null,Object? secondaryColor = null,Object? buildingName = freezed,Object? businessAddress = freezed,Object? businessCity = freezed,Object? businessPhone = freezed,Object? businessEmail = freezed,Object? receiptFooter = freezed,Object? emailFooter = freezed,Object? currencyCode = null,Object? taxEnabled = null,Object? defaultTaxRate = null,Object? customDomain = freezed,Object? emailNotifications = null,Object? smsNotifications = null,Object? inAppNotifications = null,}) {
  return _then(_self.copyWith(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,subdomain: freezed == subdomain ? _self.subdomain : subdomain // ignore: cast_nullable_to_non_nullable
as String?,subscriptionPlan: freezed == subscriptionPlan ? _self.subscriptionPlan : subscriptionPlan // ignore: cast_nullable_to_non_nullable
as String?,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,faviconUrl: freezed == faviconUrl ? _self.faviconUrl : faviconUrl // ignore: cast_nullable_to_non_nullable
as String?,primaryColor: null == primaryColor ? _self.primaryColor : primaryColor // ignore: cast_nullable_to_non_nullable
as String,secondaryColor: null == secondaryColor ? _self.secondaryColor : secondaryColor // ignore: cast_nullable_to_non_nullable
as String,buildingName: freezed == buildingName ? _self.buildingName : buildingName // ignore: cast_nullable_to_non_nullable
as String?,businessAddress: freezed == businessAddress ? _self.businessAddress : businessAddress // ignore: cast_nullable_to_non_nullable
as String?,businessCity: freezed == businessCity ? _self.businessCity : businessCity // ignore: cast_nullable_to_non_nullable
as String?,businessPhone: freezed == businessPhone ? _self.businessPhone : businessPhone // ignore: cast_nullable_to_non_nullable
as String?,businessEmail: freezed == businessEmail ? _self.businessEmail : businessEmail // ignore: cast_nullable_to_non_nullable
as String?,receiptFooter: freezed == receiptFooter ? _self.receiptFooter : receiptFooter // ignore: cast_nullable_to_non_nullable
as String?,emailFooter: freezed == emailFooter ? _self.emailFooter : emailFooter // ignore: cast_nullable_to_non_nullable
as String?,currencyCode: null == currencyCode ? _self.currencyCode : currencyCode // ignore: cast_nullable_to_non_nullable
as String,taxEnabled: null == taxEnabled ? _self.taxEnabled : taxEnabled // ignore: cast_nullable_to_non_nullable
as bool,defaultTaxRate: null == defaultTaxRate ? _self.defaultTaxRate : defaultTaxRate // ignore: cast_nullable_to_non_nullable
as double,customDomain: freezed == customDomain ? _self.customDomain : customDomain // ignore: cast_nullable_to_non_nullable
as String?,emailNotifications: null == emailNotifications ? _self.emailNotifications : emailNotifications // ignore: cast_nullable_to_non_nullable
as bool,smsNotifications: null == smsNotifications ? _self.smsNotifications : smsNotifications // ignore: cast_nullable_to_non_nullable
as bool,inAppNotifications: null == inAppNotifications ? _self.inAppNotifications : inAppNotifications // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [BusinessSettings].
extension BusinessSettingsPatterns on BusinessSettings {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BusinessSettings value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BusinessSettings() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BusinessSettings value)  $default,){
final _that = this;
switch (_that) {
case _BusinessSettings():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BusinessSettings value)?  $default,){
final _that = this;
switch (_that) {
case _BusinessSettings() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String? subdomain,  String? subscriptionPlan,  String? logoUrl,  String? faviconUrl,  String primaryColor,  String secondaryColor,  String? buildingName,  String? businessAddress,  String? businessCity,  String? businessPhone,  String? businessEmail,  String? receiptFooter,  String? emailFooter,  String currencyCode,  bool taxEnabled,  double defaultTaxRate,  String? customDomain,  bool emailNotifications,  bool smsNotifications,  bool inAppNotifications)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BusinessSettings() when $default != null:
return $default(_that.name,_that.subdomain,_that.subscriptionPlan,_that.logoUrl,_that.faviconUrl,_that.primaryColor,_that.secondaryColor,_that.buildingName,_that.businessAddress,_that.businessCity,_that.businessPhone,_that.businessEmail,_that.receiptFooter,_that.emailFooter,_that.currencyCode,_that.taxEnabled,_that.defaultTaxRate,_that.customDomain,_that.emailNotifications,_that.smsNotifications,_that.inAppNotifications);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String? subdomain,  String? subscriptionPlan,  String? logoUrl,  String? faviconUrl,  String primaryColor,  String secondaryColor,  String? buildingName,  String? businessAddress,  String? businessCity,  String? businessPhone,  String? businessEmail,  String? receiptFooter,  String? emailFooter,  String currencyCode,  bool taxEnabled,  double defaultTaxRate,  String? customDomain,  bool emailNotifications,  bool smsNotifications,  bool inAppNotifications)  $default,) {final _that = this;
switch (_that) {
case _BusinessSettings():
return $default(_that.name,_that.subdomain,_that.subscriptionPlan,_that.logoUrl,_that.faviconUrl,_that.primaryColor,_that.secondaryColor,_that.buildingName,_that.businessAddress,_that.businessCity,_that.businessPhone,_that.businessEmail,_that.receiptFooter,_that.emailFooter,_that.currencyCode,_that.taxEnabled,_that.defaultTaxRate,_that.customDomain,_that.emailNotifications,_that.smsNotifications,_that.inAppNotifications);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String? subdomain,  String? subscriptionPlan,  String? logoUrl,  String? faviconUrl,  String primaryColor,  String secondaryColor,  String? buildingName,  String? businessAddress,  String? businessCity,  String? businessPhone,  String? businessEmail,  String? receiptFooter,  String? emailFooter,  String currencyCode,  bool taxEnabled,  double defaultTaxRate,  String? customDomain,  bool emailNotifications,  bool smsNotifications,  bool inAppNotifications)?  $default,) {final _that = this;
switch (_that) {
case _BusinessSettings() when $default != null:
return $default(_that.name,_that.subdomain,_that.subscriptionPlan,_that.logoUrl,_that.faviconUrl,_that.primaryColor,_that.secondaryColor,_that.buildingName,_that.businessAddress,_that.businessCity,_that.businessPhone,_that.businessEmail,_that.receiptFooter,_that.emailFooter,_that.currencyCode,_that.taxEnabled,_that.defaultTaxRate,_that.customDomain,_that.emailNotifications,_that.smsNotifications,_that.inAppNotifications);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BusinessSettings implements BusinessSettings {
  const _BusinessSettings({required this.name, this.subdomain, this.subscriptionPlan, this.logoUrl, this.faviconUrl, this.primaryColor = '#4f46e5', this.secondaryColor = '#7c3aed', this.buildingName, this.businessAddress, this.businessCity, this.businessPhone, this.businessEmail, this.receiptFooter, this.emailFooter, this.currencyCode = 'MWK', this.taxEnabled = true, this.defaultTaxRate = 16.5, this.customDomain, this.emailNotifications = true, this.smsNotifications = false, this.inAppNotifications = true});
  factory _BusinessSettings.fromJson(Map<String, dynamic> json) => _$BusinessSettingsFromJson(json);

@override final  String name;
@override final  String? subdomain;
@override final  String? subscriptionPlan;
@override final  String? logoUrl;
@override final  String? faviconUrl;
@override@JsonKey() final  String primaryColor;
@override@JsonKey() final  String secondaryColor;
// Address info
@override final  String? buildingName;
@override final  String? businessAddress;
@override final  String? businessCity;
@override final  String? businessPhone;
@override final  String? businessEmail;
// Receipt customization
@override final  String? receiptFooter;
// Settings
@override final  String? emailFooter;
@override@JsonKey() final  String currencyCode;
@override@JsonKey() final  bool taxEnabled;
@override@JsonKey() final  double defaultTaxRate;
@override final  String? customDomain;
// Notifications
@override@JsonKey() final  bool emailNotifications;
@override@JsonKey() final  bool smsNotifications;
@override@JsonKey() final  bool inAppNotifications;

/// Create a copy of BusinessSettings
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BusinessSettingsCopyWith<_BusinessSettings> get copyWith => __$BusinessSettingsCopyWithImpl<_BusinessSettings>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BusinessSettingsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BusinessSettings&&(identical(other.name, name) || other.name == name)&&(identical(other.subdomain, subdomain) || other.subdomain == subdomain)&&(identical(other.subscriptionPlan, subscriptionPlan) || other.subscriptionPlan == subscriptionPlan)&&(identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl)&&(identical(other.faviconUrl, faviconUrl) || other.faviconUrl == faviconUrl)&&(identical(other.primaryColor, primaryColor) || other.primaryColor == primaryColor)&&(identical(other.secondaryColor, secondaryColor) || other.secondaryColor == secondaryColor)&&(identical(other.buildingName, buildingName) || other.buildingName == buildingName)&&(identical(other.businessAddress, businessAddress) || other.businessAddress == businessAddress)&&(identical(other.businessCity, businessCity) || other.businessCity == businessCity)&&(identical(other.businessPhone, businessPhone) || other.businessPhone == businessPhone)&&(identical(other.businessEmail, businessEmail) || other.businessEmail == businessEmail)&&(identical(other.receiptFooter, receiptFooter) || other.receiptFooter == receiptFooter)&&(identical(other.emailFooter, emailFooter) || other.emailFooter == emailFooter)&&(identical(other.currencyCode, currencyCode) || other.currencyCode == currencyCode)&&(identical(other.taxEnabled, taxEnabled) || other.taxEnabled == taxEnabled)&&(identical(other.defaultTaxRate, defaultTaxRate) || other.defaultTaxRate == defaultTaxRate)&&(identical(other.customDomain, customDomain) || other.customDomain == customDomain)&&(identical(other.emailNotifications, emailNotifications) || other.emailNotifications == emailNotifications)&&(identical(other.smsNotifications, smsNotifications) || other.smsNotifications == smsNotifications)&&(identical(other.inAppNotifications, inAppNotifications) || other.inAppNotifications == inAppNotifications));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,name,subdomain,subscriptionPlan,logoUrl,faviconUrl,primaryColor,secondaryColor,buildingName,businessAddress,businessCity,businessPhone,businessEmail,receiptFooter,emailFooter,currencyCode,taxEnabled,defaultTaxRate,customDomain,emailNotifications,smsNotifications,inAppNotifications]);

@override
String toString() {
  return 'BusinessSettings(name: $name, subdomain: $subdomain, subscriptionPlan: $subscriptionPlan, logoUrl: $logoUrl, faviconUrl: $faviconUrl, primaryColor: $primaryColor, secondaryColor: $secondaryColor, buildingName: $buildingName, businessAddress: $businessAddress, businessCity: $businessCity, businessPhone: $businessPhone, businessEmail: $businessEmail, receiptFooter: $receiptFooter, emailFooter: $emailFooter, currencyCode: $currencyCode, taxEnabled: $taxEnabled, defaultTaxRate: $defaultTaxRate, customDomain: $customDomain, emailNotifications: $emailNotifications, smsNotifications: $smsNotifications, inAppNotifications: $inAppNotifications)';
}


}

/// @nodoc
abstract mixin class _$BusinessSettingsCopyWith<$Res> implements $BusinessSettingsCopyWith<$Res> {
  factory _$BusinessSettingsCopyWith(_BusinessSettings value, $Res Function(_BusinessSettings) _then) = __$BusinessSettingsCopyWithImpl;
@override @useResult
$Res call({
 String name, String? subdomain, String? subscriptionPlan, String? logoUrl, String? faviconUrl, String primaryColor, String secondaryColor, String? buildingName, String? businessAddress, String? businessCity, String? businessPhone, String? businessEmail, String? receiptFooter, String? emailFooter, String currencyCode, bool taxEnabled, double defaultTaxRate, String? customDomain, bool emailNotifications, bool smsNotifications, bool inAppNotifications
});




}
/// @nodoc
class __$BusinessSettingsCopyWithImpl<$Res>
    implements _$BusinessSettingsCopyWith<$Res> {
  __$BusinessSettingsCopyWithImpl(this._self, this._then);

  final _BusinessSettings _self;
  final $Res Function(_BusinessSettings) _then;

/// Create a copy of BusinessSettings
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? subdomain = freezed,Object? subscriptionPlan = freezed,Object? logoUrl = freezed,Object? faviconUrl = freezed,Object? primaryColor = null,Object? secondaryColor = null,Object? buildingName = freezed,Object? businessAddress = freezed,Object? businessCity = freezed,Object? businessPhone = freezed,Object? businessEmail = freezed,Object? receiptFooter = freezed,Object? emailFooter = freezed,Object? currencyCode = null,Object? taxEnabled = null,Object? defaultTaxRate = null,Object? customDomain = freezed,Object? emailNotifications = null,Object? smsNotifications = null,Object? inAppNotifications = null,}) {
  return _then(_BusinessSettings(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,subdomain: freezed == subdomain ? _self.subdomain : subdomain // ignore: cast_nullable_to_non_nullable
as String?,subscriptionPlan: freezed == subscriptionPlan ? _self.subscriptionPlan : subscriptionPlan // ignore: cast_nullable_to_non_nullable
as String?,logoUrl: freezed == logoUrl ? _self.logoUrl : logoUrl // ignore: cast_nullable_to_non_nullable
as String?,faviconUrl: freezed == faviconUrl ? _self.faviconUrl : faviconUrl // ignore: cast_nullable_to_non_nullable
as String?,primaryColor: null == primaryColor ? _self.primaryColor : primaryColor // ignore: cast_nullable_to_non_nullable
as String,secondaryColor: null == secondaryColor ? _self.secondaryColor : secondaryColor // ignore: cast_nullable_to_non_nullable
as String,buildingName: freezed == buildingName ? _self.buildingName : buildingName // ignore: cast_nullable_to_non_nullable
as String?,businessAddress: freezed == businessAddress ? _self.businessAddress : businessAddress // ignore: cast_nullable_to_non_nullable
as String?,businessCity: freezed == businessCity ? _self.businessCity : businessCity // ignore: cast_nullable_to_non_nullable
as String?,businessPhone: freezed == businessPhone ? _self.businessPhone : businessPhone // ignore: cast_nullable_to_non_nullable
as String?,businessEmail: freezed == businessEmail ? _self.businessEmail : businessEmail // ignore: cast_nullable_to_non_nullable
as String?,receiptFooter: freezed == receiptFooter ? _self.receiptFooter : receiptFooter // ignore: cast_nullable_to_non_nullable
as String?,emailFooter: freezed == emailFooter ? _self.emailFooter : emailFooter // ignore: cast_nullable_to_non_nullable
as String?,currencyCode: null == currencyCode ? _self.currencyCode : currencyCode // ignore: cast_nullable_to_non_nullable
as String,taxEnabled: null == taxEnabled ? _self.taxEnabled : taxEnabled // ignore: cast_nullable_to_non_nullable
as bool,defaultTaxRate: null == defaultTaxRate ? _self.defaultTaxRate : defaultTaxRate // ignore: cast_nullable_to_non_nullable
as double,customDomain: freezed == customDomain ? _self.customDomain : customDomain // ignore: cast_nullable_to_non_nullable
as String?,emailNotifications: null == emailNotifications ? _self.emailNotifications : emailNotifications // ignore: cast_nullable_to_non_nullable
as bool,smsNotifications: null == smsNotifications ? _self.smsNotifications : smsNotifications // ignore: cast_nullable_to_non_nullable
as bool,inAppNotifications: null == inAppNotifications ? _self.inAppNotifications : inAppNotifications // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
