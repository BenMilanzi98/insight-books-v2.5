import 'package:freezed_annotation/freezed_annotation.dart';

part 'business_settings.freezed.dart';
part 'business_settings.g.dart';

@freezed
abstract class BusinessSettings with _$BusinessSettings {
  const factory BusinessSettings({
    required String name,
    String? subdomain,
    String? subscriptionPlan,
    String? logoUrl,
    String? faviconUrl,
    @Default('#4f46e5') String primaryColor,
    @Default('#7c3aed') String secondaryColor,

    // Address info
    String? buildingName,
    String? businessAddress,
    String? businessCity,
    String? businessPhone,
    String? businessEmail,

    // Receipt customization
    String? receiptFooter,

    // Settings
    String? emailFooter,
    @Default('MWK') String currencyCode,
    @Default(true) bool taxEnabled,
    @Default(16.5) double defaultTaxRate,
    String? customDomain,

    // Notifications
    @Default(true) bool emailNotifications,
    @Default(false) bool smsNotifications,
    @Default(true) bool inAppNotifications,
  }) = _BusinessSettings;

  factory BusinessSettings.fromJson(Map<String, dynamic> json) =>
      _$BusinessSettingsFromJson(json);
}
