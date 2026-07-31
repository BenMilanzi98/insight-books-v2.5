class BusinessSettings {
  const BusinessSettings({
    required this.name,
    this.subdomain,
    this.subscriptionPlan,
    this.defaultBranchId,
    this.tpin,
    this.logoUrl,
    this.faviconUrl,
    this.primaryColor = '#4f46e5',
    this.secondaryColor = '#7c3aed',
    this.buildingName,
    this.businessAddress,
    this.businessCity,
    this.businessPhone,
    this.businessEmail,
    this.receiptFooter,
    this.receiptPaperWidthMm = 80,
    this.defaultBankDetails,
    this.taxOutflowAccountId,
    this.emailFooter,
    this.currencyCode = 'MWK',
    this.taxEnabled = true,
    this.defaultTaxRate = 16.5,
    this.customDomain,
    this.emailNotifications = true,
    this.smsNotifications = false,
    this.inAppNotifications = true,
    this.dailyReports = false,
    this.weeklyReports = true,
    this.monthlyReports = true,
    this.invoiceReminders = true,
    this.lowStockAlerts = true,
    this.paymentReceipts = true,
  });

  final String name;
  final String? subdomain;
  final String? subscriptionPlan;
  final String? defaultBranchId;
  final String? tpin;
  final String? logoUrl;
  final String? faviconUrl;
  final String primaryColor;
  final String secondaryColor;
  final String? buildingName;
  final String? businessAddress;
  final String? businessCity;
  final String? businessPhone;
  final String? businessEmail;
  final String? receiptFooter;
  /// Thermal roll width in mm (58–90). Default 80.
  final int receiptPaperWidthMm;
  final String? defaultBankDetails;
  final String? taxOutflowAccountId;
  final String? emailFooter;
  final String currencyCode;
  final bool taxEnabled;
  final double defaultTaxRate;
  final String? customDomain;
  final bool emailNotifications;
  final bool smsNotifications;
  final bool inAppNotifications;
  final bool dailyReports;
  final bool weeklyReports;
  final bool monthlyReports;
  final bool invoiceReminders;
  final bool lowStockAlerts;
  final bool paymentReceipts;

  /// Clamp preferred thermal width to the supported range.
  static int normalizePaperWidthMm(dynamic value, {int fallback = 80}) {
    final parsed = value is int
        ? value
        : value is num
            ? value.round()
            : int.tryParse('$value');
    final base = parsed ?? fallback;
    if (base < 58) return 58;
    if (base > 90) return 90;
    return base;
  }

  BusinessSettings copyWith({
    String? name,
    String? subdomain,
    String? subscriptionPlan,
    String? defaultBranchId,
    String? tpin,
    String? logoUrl,
    String? faviconUrl,
    String? primaryColor,
    String? secondaryColor,
    String? buildingName,
    String? businessAddress,
    String? businessCity,
    String? businessPhone,
    String? businessEmail,
    String? receiptFooter,
    int? receiptPaperWidthMm,
    String? defaultBankDetails,
    String? taxOutflowAccountId,
    String? emailFooter,
    String? currencyCode,
    bool? taxEnabled,
    double? defaultTaxRate,
    String? customDomain,
    bool? emailNotifications,
    bool? smsNotifications,
    bool? inAppNotifications,
    bool? dailyReports,
    bool? weeklyReports,
    bool? monthlyReports,
    bool? invoiceReminders,
    bool? lowStockAlerts,
    bool? paymentReceipts,
  }) {
    return BusinessSettings(
      name: name ?? this.name,
      subdomain: subdomain ?? this.subdomain,
      subscriptionPlan: subscriptionPlan ?? this.subscriptionPlan,
      defaultBranchId: defaultBranchId ?? this.defaultBranchId,
      tpin: tpin ?? this.tpin,
      logoUrl: logoUrl ?? this.logoUrl,
      faviconUrl: faviconUrl ?? this.faviconUrl,
      primaryColor: primaryColor ?? this.primaryColor,
      secondaryColor: secondaryColor ?? this.secondaryColor,
      buildingName: buildingName ?? this.buildingName,
      businessAddress: businessAddress ?? this.businessAddress,
      businessCity: businessCity ?? this.businessCity,
      businessPhone: businessPhone ?? this.businessPhone,
      businessEmail: businessEmail ?? this.businessEmail,
      receiptFooter: receiptFooter ?? this.receiptFooter,
      receiptPaperWidthMm: receiptPaperWidthMm ?? this.receiptPaperWidthMm,
      defaultBankDetails: defaultBankDetails ?? this.defaultBankDetails,
      taxOutflowAccountId: taxOutflowAccountId ?? this.taxOutflowAccountId,
      emailFooter: emailFooter ?? this.emailFooter,
      currencyCode: currencyCode ?? this.currencyCode,
      taxEnabled: taxEnabled ?? this.taxEnabled,
      defaultTaxRate: defaultTaxRate ?? this.defaultTaxRate,
      customDomain: customDomain ?? this.customDomain,
      emailNotifications: emailNotifications ?? this.emailNotifications,
      smsNotifications: smsNotifications ?? this.smsNotifications,
      inAppNotifications: inAppNotifications ?? this.inAppNotifications,
      dailyReports: dailyReports ?? this.dailyReports,
      weeklyReports: weeklyReports ?? this.weeklyReports,
      monthlyReports: monthlyReports ?? this.monthlyReports,
      invoiceReminders: invoiceReminders ?? this.invoiceReminders,
      lowStockAlerts: lowStockAlerts ?? this.lowStockAlerts,
      paymentReceipts: paymentReceipts ?? this.paymentReceipts,
    );
  }

  factory BusinessSettings.fromJson(Map<String, dynamic> json) {
    return BusinessSettings(
      name: (json['name'] ?? '').toString(),
      subdomain: json['subdomain']?.toString(),
      subscriptionPlan: json['subscriptionPlan']?.toString(),
      defaultBranchId: json['defaultBranchId']?.toString(),
      tpin: json['tpin']?.toString(),
      logoUrl: json['logoUrl']?.toString(),
      faviconUrl: json['faviconUrl']?.toString(),
      primaryColor: (json['primaryColor'] ?? '#4f46e5').toString(),
      secondaryColor: (json['secondaryColor'] ?? '#7c3aed').toString(),
      buildingName: json['buildingName']?.toString(),
      businessAddress: json['businessAddress']?.toString(),
      businessCity: json['businessCity']?.toString(),
      businessPhone: json['businessPhone']?.toString(),
      businessEmail: json['businessEmail']?.toString(),
      receiptFooter: json['receiptFooter']?.toString(),
      receiptPaperWidthMm: normalizePaperWidthMm(json['receiptPaperWidthMm']),
      defaultBankDetails: json['defaultBankDetails']?.toString(),
      taxOutflowAccountId: json['taxOutflowAccountId']?.toString(),
      emailFooter: json['emailFooter']?.toString(),
      currencyCode: (json['currencyCode'] ?? 'MWK').toString(),
      taxEnabled: json['taxEnabled'] == null ? true : json['taxEnabled'] == true,
      defaultTaxRate: (json['defaultTaxRate'] is num)
          ? (json['defaultTaxRate'] as num).toDouble()
          : (double.tryParse('${json['defaultTaxRate']}') ?? 16.5),
      customDomain: json['customDomain']?.toString(),
      emailNotifications: json['emailNotifications'] == null
          ? true
          : json['emailNotifications'] == true,
      smsNotifications:
          json['smsNotifications'] == null ? false : json['smsNotifications'] == true,
      inAppNotifications: json['inAppNotifications'] == null
          ? true
          : json['inAppNotifications'] == true,
      dailyReports:
          json['dailyReports'] == null ? false : json['dailyReports'] == true,
      weeklyReports:
          json['weeklyReports'] == null ? true : json['weeklyReports'] == true,
      monthlyReports:
          json['monthlyReports'] == null ? true : json['monthlyReports'] == true,
      invoiceReminders: json['invoiceReminders'] == null
          ? true
          : json['invoiceReminders'] == true,
      lowStockAlerts:
          json['lowStockAlerts'] == null ? true : json['lowStockAlerts'] == true,
      paymentReceipts: json['paymentReceipts'] == null
          ? true
          : json['paymentReceipts'] == true,
    );
  }
}
