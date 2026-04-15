import 'package:freezed_annotation/freezed_annotation.dart';

part 'tenant_models.freezed.dart';
part 'tenant_models.g.dart';

@freezed
abstract class Tenant with _$Tenant {
  const factory Tenant({
    required String id,
    required String name,
    required Subscription subscription,
  }) = _Tenant;

  factory Tenant.fromJson(Map<String, dynamic> json) => _$TenantFromJson(json);
}

@freezed
abstract class Subscription with _$Subscription {
  const factory Subscription({
    @Default(false) bool isExpired,
    @Default(0) int daysRemaining,
    @Default(false) bool isTrial,
    String? planName,
  }) = _Subscription;

  factory Subscription.fromJson(Map<String, dynamic> json) =>
      _$SubscriptionFromJson(json);
}

extension TenantSubscriptionAccess on Tenant {
  /// True when paid plan or trial is still within its end date ([Subscription.isExpired] is false).
  bool get hasActiveSubscriptionOrTrial => !subscription.isExpired;
}
