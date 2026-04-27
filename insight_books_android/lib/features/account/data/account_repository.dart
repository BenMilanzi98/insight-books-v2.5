import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/features/account/domain/business_settings.dart';
import 'package:insightbooks_android/features/account/domain/user_model.dart';

final accountRepositoryProvider = Provider<AccountRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return AccountRepository(dio);
});

class AccountRepository {
  final Dio _dio;

  AccountRepository(this._dio);

  Future<User> fetchProfile() async {
    final response = await _dio.get('/api/profile');
    final Map<String, dynamic> responseData = response.data;

    // Handle data wrappers
    final data =
        (responseData['data'] ?? responseData['profile'] ?? responseData)
            as Map<String, dynamic>;

    return User(
      id: data['id']?.toString() ?? '',
      name: data['name']?.toString() ?? 'User',
      email: data['email']?.toString() ?? '',
      phone: data['phone']?.toString(),
      role: data['role']?.toString(),
      avatarUrl: data['avatarUrl']?.toString(),
    );
  }

  /// Soft-delete the signed-in user (server sets `isActive` false). Requires password.
  Future<void> deactivateOwnAccount({required String password}) async {
    await _dio.post('/api/profile/deactivate', data: {'password': password});
  }

  String? _toString(dynamic value) {
    if (value == null) return null;
    return value.toString();
  }

  Future<void> updateProfile(User user) async {
    await _dio.post('/api/profile', data: {'profile': user.toJson()});
  }

  Future<void> updatePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await _dio.post(
      '/api/profile',
      data: {
        'passwordUpdate': {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
          'confirmPassword': confirmPassword,
        },
      },
    );
  }

  Future<BusinessSettings> fetchBusinessSettings() async {
    try {
      final responses = await Future.wait([
        _dio.get('/api/account'),
        _dio.get('/api/tenant/settings'),
      ]);

      final Map<String, dynamic> accountDataRaw = responses[0].data;
      final Map<String, dynamic> tenantDataRaw = responses[1].data;

      // Unpack data wrappers if they exist
      final accountData =
          (accountDataRaw['data'] ??
                  accountDataRaw['account'] ??
                  accountDataRaw)
              as Map<String, dynamic>;
      final tenantData =
          (tenantDataRaw['data'] ?? tenantDataRaw['settings'] ?? tenantDataRaw)
              as Map<String, dynamic>;

      return BusinessSettings(
        name: _toString(accountData['name'] ?? tenantData['name']) ?? '',
        subdomain: _toString(accountData['subdomain']),
        subscriptionPlan: _toString(accountData['subscriptionPlan']),
        defaultBranchId: _toString(
          accountData['defaultBranchId'] ?? tenantData['defaultBranchId'],
        ),
        tpin: _toString(accountData['tpin'] ?? tenantData['tpin']),
        logoUrl: _toString(accountData['logoUrl'] ?? tenantData['logoUrl']),
        faviconUrl: _toString(accountData['faviconUrl']),
        primaryColor:
            _toString(
              accountData['primaryColor'] ?? tenantData['primaryColor'],
            ) ??
            '#4f46e5',
        secondaryColor:
            _toString(
              accountData['secondaryColor'] ?? tenantData['secondaryColor'],
            ) ??
            '#7c3aed',
        buildingName: _toString(tenantData['buildingName']),
        businessAddress: _toString(tenantData['businessAddress']),
        businessCity: _toString(tenantData['businessCity']),
        businessPhone: _toString(tenantData['businessPhone']),
        businessEmail: _toString(tenantData['businessEmail']),
        receiptFooter: _toString(tenantData['receiptFooter']),
        defaultBankDetails: _toString(tenantData['defaultBankDetails']),
        taxOutflowAccountId: _toString(tenantData['taxOutflowAccountId']),
        emailFooter: _toString(
          accountData['emailFooter'] ?? tenantData['emailFooter'],
        ),
        currencyCode: _toString(tenantData['currencyCode']) ?? 'MWK',
        taxEnabled: tenantData['taxEnabled'] ?? true,
        defaultTaxRate: _toDouble(tenantData['defaultTaxRate'] ?? 16.5),
        customDomain: _toString(accountData['customDomain']),
        emailNotifications: accountData['emailNotifications'] ?? true,
        smsNotifications: accountData['smsNotifications'] ?? false,
        inAppNotifications: accountData['inAppNotifications'] ?? true,
        dailyReports: tenantData['dailyReports'] ?? false,
        weeklyReports: tenantData['weeklyReports'] ?? true,
        monthlyReports: tenantData['monthlyReports'] ?? true,
        invoiceReminders: tenantData['invoiceReminders'] ?? true,
        lowStockAlerts: tenantData['lowStockAlerts'] ?? true,
        paymentReceipts: tenantData['paymentReceipts'] ?? true,
      );
    } catch (e) {
      rethrow;
    }
  }

  double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }

  Future<void> updateBusinessSettings(
    BusinessSettings settings, {
    String? logoPath,
    String? faviconPath,
  }) async {
    // 1. Update Account Settings (handles files via FormData)
    final formData = FormData.fromMap({
      'name': settings.name,
      'primaryColor': settings.primaryColor,
      'secondaryColor': settings.secondaryColor,
      'defaultBranchId': settings.defaultBranchId,
      'emailFooter': settings.emailFooter,
      'customDomain': settings.customDomain,
      'emailNotifications': settings.emailNotifications,
      'smsNotifications': settings.smsNotifications,
      'inAppNotifications': settings.inAppNotifications,
    });

    if (logoPath != null) {
      formData.files.add(
        MapEntry('logoUrl', await MultipartFile.fromFile(logoPath)),
      );
    }

    if (faviconPath != null) {
      formData.files.add(
        MapEntry('faviconUrl', await MultipartFile.fromFile(faviconPath)),
      );
    }

    await _dio.post('/api/account', data: formData);

    // 2. Update Tenant Settings
    await _dio.put(
      '/api/tenant/settings',
      data: {
        'name': settings.name,
        'tpin': settings.tpin,
        'primaryColor': settings.primaryColor,
        'secondaryColor': settings.secondaryColor,
        'buildingName': settings.buildingName,
        'businessAddress': settings.businessAddress,
        'businessCity': settings.businessCity,
        'businessPhone': settings.businessPhone,
        'businessEmail': settings.businessEmail,
        'receiptFooter': settings.receiptFooter,
        'defaultBankDetails': settings.defaultBankDetails,
        'taxOutflowAccountId': settings.taxOutflowAccountId,
        'emailFooter': settings.emailFooter,
        'currencyCode': settings.currencyCode,
        'taxEnabled': settings.taxEnabled,
        'defaultTaxRate': settings.defaultTaxRate,
        'dailyReports': settings.dailyReports,
        'weeklyReports': settings.weeklyReports,
        'monthlyReports': settings.monthlyReports,
        'invoiceReminders': settings.invoiceReminders,
        'lowStockAlerts': settings.lowStockAlerts,
        'paymentReceipts': settings.paymentReceipts,
      },
    );
  }

  Future<List<Map<String, dynamic>>> fetchBranches() async {
    final response = await _dio.get('/api/branches');
    final raw = response.data;
    final list = raw is Map ? (raw['branches'] ?? []) : [];
    return (list as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<List<Map<String, dynamic>>> fetchChartAccounts() async {
    final all = <Map<String, dynamic>>[];
    int page = 1;
    const pageSize = 200;

    while (true) {
      final response = await _dio.get(
        '/api/chart-of-accounts',
        queryParameters: {'limit': pageSize, 'page': page},
      );
      final raw = response.data;
      final List batch = raw is Map ? (raw['accounts'] ?? []) : [];
      all.addAll(
        batch.whereType<Map>().map((e) => Map<String, dynamic>.from(e)),
      );
      if (batch.length < pageSize) break;
      page++;
    }

    return all;
  }



  Future<List<Map<String, dynamic>>> fetchInvoiceTemplates() async {
    final response = await _dio.get('/api/invoice/templates');
    final raw = response.data;
    final list = raw is Map ? (raw['templates'] ?? []) : [];
    return (list as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<Map<String, dynamic>> createInvoiceTemplate({
    required String name,
    String? content,
    bool isDefault = false,
  }) async {
    final response = await _dio.post(
      '/api/invoice/templates',
      data: {
        'name': name,
        'content': content ?? '{}',
        'isDefault': isDefault,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> updateInvoiceTemplate({
    required String id,
    required String name,
    String? content,
    bool isDefault = false,
  }) async {
    final response = await _dio.put(
      '/api/invoice/templates',
      data: {
        'id': id,
        'name': name,
        'content': content ?? '{}',
        'isDefault': isDefault,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<void> deleteInvoiceTemplate(String id) async {
    await _dio.delete('/api/invoice/templates/$id');
  }

  Future<void> setDefaultInvoiceTemplate(String id) async {
    await _dio.put('/api/invoice/templates/$id/set-default');
  }
}
