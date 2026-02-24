// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'business_settings.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_BusinessSettings _$BusinessSettingsFromJson(Map<String, dynamic> json) =>
    _BusinessSettings(
      name: json['name'] as String,
      subdomain: json['subdomain'] as String?,
      subscriptionPlan: json['subscriptionPlan'] as String?,
      logoUrl: json['logoUrl'] as String?,
      faviconUrl: json['faviconUrl'] as String?,
      primaryColor: json['primaryColor'] as String? ?? '#4f46e5',
      secondaryColor: json['secondaryColor'] as String? ?? '#7c3aed',
      buildingName: json['buildingName'] as String?,
      businessAddress: json['businessAddress'] as String?,
      businessCity: json['businessCity'] as String?,
      businessPhone: json['businessPhone'] as String?,
      businessEmail: json['businessEmail'] as String?,
      receiptFooter: json['receiptFooter'] as String?,
      emailFooter: json['emailFooter'] as String?,
      currencyCode: json['currencyCode'] as String? ?? 'MWK',
      taxEnabled: json['taxEnabled'] as bool? ?? true,
      defaultTaxRate: (json['defaultTaxRate'] as num?)?.toDouble() ?? 16.5,
      customDomain: json['customDomain'] as String?,
      emailNotifications: json['emailNotifications'] as bool? ?? true,
      smsNotifications: json['smsNotifications'] as bool? ?? false,
      inAppNotifications: json['inAppNotifications'] as bool? ?? true,
    );

Map<String, dynamic> _$BusinessSettingsToJson(_BusinessSettings instance) =>
    <String, dynamic>{
      'name': instance.name,
      'subdomain': instance.subdomain,
      'subscriptionPlan': instance.subscriptionPlan,
      'logoUrl': instance.logoUrl,
      'faviconUrl': instance.faviconUrl,
      'primaryColor': instance.primaryColor,
      'secondaryColor': instance.secondaryColor,
      'buildingName': instance.buildingName,
      'businessAddress': instance.businessAddress,
      'businessCity': instance.businessCity,
      'businessPhone': instance.businessPhone,
      'businessEmail': instance.businessEmail,
      'receiptFooter': instance.receiptFooter,
      'emailFooter': instance.emailFooter,
      'currencyCode': instance.currencyCode,
      'taxEnabled': instance.taxEnabled,
      'defaultTaxRate': instance.defaultTaxRate,
      'customDomain': instance.customDomain,
      'emailNotifications': instance.emailNotifications,
      'smsNotifications': instance.smsNotifications,
      'inAppNotifications': instance.inAppNotifications,
    };
