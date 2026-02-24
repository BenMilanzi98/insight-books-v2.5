// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tenant_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Tenant _$TenantFromJson(Map<String, dynamic> json) => _Tenant(
  id: json['id'] as String,
  name: json['name'] as String,
  subscription: Subscription.fromJson(
    json['subscription'] as Map<String, dynamic>,
  ),
);

Map<String, dynamic> _$TenantToJson(_Tenant instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'subscription': instance.subscription,
};

_Subscription _$SubscriptionFromJson(Map<String, dynamic> json) =>
    _Subscription(
      isExpired: json['isExpired'] as bool? ?? false,
      daysRemaining: (json['daysRemaining'] as num?)?.toInt() ?? 0,
      isTrial: json['isTrial'] as bool? ?? false,
      planName: json['planName'] as String?,
    );

Map<String, dynamic> _$SubscriptionToJson(_Subscription instance) =>
    <String, dynamic>{
      'isExpired': instance.isExpired,
      'daysRemaining': instance.daysRemaining,
      'isTrial': instance.isTrial,
      'planName': instance.planName,
    };
