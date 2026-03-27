import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'dart:io';
import 'package:share_plus/share_plus.dart';
import '../../../core/network/api_client.dart';
import '../domain/pos_models.dart';

final posRepositoryProvider = Provider<PosRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return PosRepository(dio);
});

class PosRepository {
  final Dio _dio;
  static const _productsCacheKey = 'pos_products_cache_v1';
  static const _productsCacheAtKey = 'pos_products_cache_at_v1';

  static const _clientsCacheKey = 'pos_clients_cache_v1';
  static const _paymentAccountsCacheKey = 'pos_payment_accounts_cache_v1';
  static const _incomeAccountsCacheKey = 'pos_income_accounts_cache_v1';
  static const _branchesCacheKey = 'pos_branches_cache_v1';
  static const _taxTypesCacheKey = 'pos_tax_types_cache_v1';
  static const _taxAccountsCacheKey = 'pos_tax_accounts_cache_v1';
  static const _taxDefaultsCacheKey = 'pos_tax_defaults_cache_v1';
  static const _permissionsCacheKey = 'pos_permissions_cache_v1';

  PosRepository(this._dio);

  Future<List<PosProduct>> fetchProducts({
    String? search,
    String? category,
  }) async {
    try {
      final response = await _dio.get(
        '/api/stock',
        queryParameters: {
          if (search != null && search.isNotEmpty) 'search': search,
          if (category != null && category != 'all' && category.isNotEmpty)
            'category': category,
          'limit': 100,
        },
      );
      final List productsJson = response.data['products'] ?? [];
      final products = productsJson
          .map((json) => _productFromRaw(Map<String, dynamic>.from(json as Map)))
          .toList();
      // Prefetch and keep an offline copy for POS continuity.
      if (search == null &&
          (category == null || category == 'all' || category.isEmpty)) {
        await _saveProductsCache(productsJson);
      }
      return products;
    } catch (e) {
      final cached = await _readProductsCache();
      if (cached.isNotEmpty) {
        return cached;
      }
      rethrow;
    }
  }

  Future<List<PosClient>> fetchClients({String? search}) async {
    try {
      final response = await _dio.get(
        '/api/clients',
        queryParameters: {
          if (search != null && search.isNotEmpty) 'search': search,
          'limit': 100,
        },
      );
      final List clientsJson = response.data['clients'] ?? [];
      final clients = clientsJson
          .map((json) => PosClient.fromJson(Map<String, dynamic>.from(json as Map)))
          .toList();
      if (search == null || search.isEmpty) {
        await _saveMapListCache(_clientsCacheKey, clientsJson);
      }
      return clients;
    } catch (e) {
      final cached = await _readMapListCache(_clientsCacheKey);
      if (cached.isEmpty) rethrow;
      return cached
          .map((m) => PosClient.fromJson(Map<String, dynamic>.from(m)))
          .toList();
    }
  }

  Future<List<Map<String, dynamic>>> fetchPaymentAccounts() async {
    try {
      final response = await _dio.get(
        '/api/payment-accounts',
        queryParameters: {'activeOnly': 'true'},
      );
      final List accounts = response.data['paymentAccounts'] ?? [];
      final list = accounts.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      await _saveMapListCache(_paymentAccountsCacheKey, list);
      return list;
    } catch (e) {
      final cached = await _readMapListCache(_paymentAccountsCacheKey);
      if (cached.isEmpty) rethrow;
      return cached.map((m) => Map<String, dynamic>.from(m)).toList();
    }
  }

  Future<List<Map<String, dynamic>>> fetchIncomeAccounts() async {
    try {
      final response = await _dio.get('/api/chart-of-accounts/income-accounts');
      final List accounts = response.data['accounts'] ?? [];
      final list = accounts.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      await _saveMapListCache(_incomeAccountsCacheKey, list);
      return list;
    } catch (e) {
      final cached = await _readMapListCache(_incomeAccountsCacheKey);
      if (cached.isEmpty) rethrow;
      return cached.map((m) => Map<String, dynamic>.from(m)).toList();
    }
  }

  Future<Map<String, dynamic>> createSale(SaleRequest sale) async {
    try {
      final response = await _dio.post('/api/sales', data: sale.toJson());
      return response.data;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> createSaleFromPayload(
    Map<String, dynamic> saleData,
  ) async {
    try {
      final response = await _dio.post('/api/sales', data: saleData);
      return Map<String, dynamic>.from(response.data as Map);
    } catch (e) {
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> fetchBranches() async {
    try {
      final response = await _dio.get(
        '/api/branches',
        queryParameters: {'includeInactive': 'false'},
      );
      final List branches = response.data['branches'] ?? [];
      final list = branches.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      await _saveMapListCache(_branchesCacheKey, list);
      return list;
    } catch (e) {
      final cached = await _readMapListCache(_branchesCacheKey);
      if (cached.isEmpty) rethrow;
      return cached.map((m) => Map<String, dynamic>.from(m)).toList();
    }
  }

  Future<List<Map<String, dynamic>>> fetchSales({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    String? sortBy,
    String? sortOrder,
    String? dateFrom,
    String? dateTo,
  }) async {
    try {
      final response = await _dio.get(
        '/api/sales',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null && status.isNotEmpty && status != 'all') 'status': status,
          if (sortBy != null && sortBy.isNotEmpty)
            'sortBy': _mapSalesListSortBy(sortBy),
          if (sortOrder != null && sortOrder.isNotEmpty) 'sortOrder': sortOrder,
          if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
          if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
        },
      );
      final List sales = response.data['sales'] ?? [];
      return sales.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> fetchSalesStatistics({
    String? dateFrom,
    String? dateTo,
  }) async {
    try {
      final response = await _dio.get(
        '/api/sales/statistics',
        queryParameters: {
          if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
          if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
        },
      );
      return Map<String, dynamic>.from(response.data as Map);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> voidSale(String saleId, String reason) async {
    try {
      await _dio.post('/api/sales/$saleId/void', data: {'reason': reason});
    } catch (e) {
      rethrow;
    }
  }

  /// Matches web [refundSale]: reason required; [refundMethod] optional (e.g. cash).
  Future<void> refundSale(
    String saleId,
    String reason, {
    String? refundMethod,
  }) async {
    try {
      await _dio.post(
        '/api/sales/$saleId/refund',
        data: {
          'reason': reason,
          if (refundMethod != null && refundMethod.isNotEmpty)
            'refundMethod': refundMethod,
        },
      );
    } catch (e) {
      rethrow;
    }
  }

  /// Full sale with line items (same shape as web POS detail).
  Future<Map<String, dynamic>> fetchSaleById(String saleId) async {
    final response = await _dio.get('/api/sales/$saleId');
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<void> exportSalesCsv({
    String? search,
    String? status,
    String? dateFrom,
    String? dateTo,
  }) async {
    try {
      final response = await _dio.get(
        '/api/sales/export',
        queryParameters: {
          'format': 'csv',
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null && status.isNotEmpty && status != 'all') 'status': status,
          if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
          if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
        },
        options: Options(responseType: ResponseType.bytes),
      );
      final bytes = response.data as List<int>;
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/sales_export.csv');
      await file.writeAsBytes(bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
    } catch (e) {
      rethrow;
    }
  }

  /// Server returns HTML receipt (same as web print view). Bytes + file extension for sharing.
  Future<({List<int> bytes, String fileExtension, String mimeType})> downloadReceiptForShare(
    String saleId,
  ) async {
    final response = await _dio.get(
      '/api/sales/$saleId/receipt',
      options: Options(responseType: ResponseType.bytes),
    );
    final bytes = response.data as List<int>;
    final ct = (response.headers.value('content-type') ?? '').toLowerCase();
    final isHtml = ct.contains('text/html');
    return (
      bytes: bytes,
      fileExtension: isHtml ? 'html' : 'pdf',
      mimeType: isHtml ? 'text/html' : 'application/pdf',
    );
  }

  Future<List<int>> downloadReceiptPdf(String saleId) async {
    final r = await downloadReceiptForShare(saleId);
    return r.bytes;
  }

  /// Shares the same HTML receipt as the website (print / save from share sheet).
  Future<void> shareSaleReceipt(
    String saleId, {
    String? shareText,
  }) async {
    final r = await downloadReceiptForShare(saleId);
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/sale-receipt-$saleId.${r.fileExtension}');
    await file.writeAsBytes(r.bytes);
    await SharePlus.instance.share(
      ShareParams(
        files: [
          XFile(file.path, mimeType: r.mimeType),
        ],
        text: shareText ?? 'Sale receipt #$saleId',
      ),
    );
  }

  Future<Map<String, dynamic>> fetchDailyPosReport(String date) async {
    try {
      final response = await _dio.get(
        '/api/reports/pos-daily',
        queryParameters: {'date': date},
      );
      return Map<String, dynamic>.from(response.data as Map);
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> fetchEisHealth() async {
    final response = await _dio.get('/api/eis/health');
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Set<String>> fetchUserPermissions() async {
    try {
      final response = await _dio.get('/api/auth/me');
      final data = response.data;
      final user = data is Map ? (data['user'] ?? data) : data;
      final raw = user is Map ? (user['permissions'] ?? const []) : const [];
      final permissions = <String>{};
      if (raw is List) {
        for (final p in raw) {
          if (p != null) permissions.add(p.toString());
        }
      }
      await _saveStringListCache(_permissionsCacheKey, permissions.toList());
      return permissions;
    } catch (_) {
      final cached = await _readStringListCache(_permissionsCacheKey);
      return cached.isEmpty ? <String>{} : cached.toSet();
    }
  }

  Future<Map<String, dynamic>> fetchEisServerTime() async {
    final response = await _dio.get('/api/eis/server-time');
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> fetchEisTerminalStatus() async {
    final response = await _dio.get('/api/eis/terminal-status');
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> validateVat5(String certificateNumber) async {
    final response = await _dio.post(
      '/api/eis/vat5-validate',
      data: {'certificateNumber': certificateNumber},
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<List<Map<String, dynamic>>> fetchTaxTypes() async {
    try {
      final response = await _dio.get(
        '/api/tax-types',
        queryParameters: {'status': 'Active'},
      );
      final raw = response.data;
      final list = raw is Map ? (raw['taxTypes'] ?? raw['taxes'] ?? []) : [];
      final mapped = (list as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      await _saveMapListCache(_taxTypesCacheKey, mapped);
      return mapped;
    } catch (e) {
      final cached = await _readMapListCache(_taxTypesCacheKey);
      if (cached.isEmpty) rethrow;
      return cached.map((m) => Map<String, dynamic>.from(m)).toList();
    }
  }

  Future<List<Map<String, dynamic>>> fetchTaxAccounts() async {
    try {
      final response = await _dio.get('/api/tax-types/accounts');
      final raw = response.data;
      final list = raw is Map ? (raw['accounts'] ?? []) : [];
      final mapped = (list as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      await _saveMapListCache(_taxAccountsCacheKey, mapped);
      return mapped;
    } catch (e) {
      final cached = await _readMapListCache(_taxAccountsCacheKey);
      if (cached.isEmpty) rethrow;
      return cached.map((m) => Map<String, dynamic>.from(m)).toList();
    }
  }

  Future<Map<String, dynamic>?> fetchTaxDefaults() async {
    try {
      final response = await _dio.get('/api/settings/tax-defaults');
      final mapped = Map<String, dynamic>.from(response.data as Map);
      await _saveMapCache(_taxDefaultsCacheKey, mapped);
      return mapped;
    } catch (_) {
      final cached = await _readMapCache(_taxDefaultsCacheKey);
      return cached;
    }
  }

  Future<void> _saveMapListCache(String key, List data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, jsonEncode(data));
    } catch (_) {}
  }

  Future<List<dynamic>> _readMapListCache(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(key);
      if (raw == null || raw.isEmpty) return const [];
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded;
    } catch (_) {
      return const [];
    }
  }

  Future<void> _saveStringListCache(String key, List<String> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, jsonEncode(data));
    } catch (_) {}
  }

  Future<List<String>> _readStringListCache(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(key);
      if (raw == null || raw.isEmpty) return const [];
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded.map((e) => e.toString()).toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> _saveMapCache(String key, Map<String, dynamic> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, jsonEncode(data));
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> _readMapCache(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(key);
      if (raw == null || raw.isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is Map) return Map<String, dynamic>.from(decoded as Map);
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>> createTaxType({
    required String taxName,
    required double taxRate,
    required String accountId,
  }) async {
    final response = await _dio.post(
      '/api/tax-types',
      data: {
        'taxName': taxName,
        'taxRate': taxRate,
        'accountId': accountId,
        'status': 'Active',
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<List<int>> downloadHistoricalTemplate() async {
    try {
      final response = await _dio.get(
        '/api/historical-transactions/template',
        options: Options(responseType: ResponseType.bytes),
      );
      return response.data as List<int>;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> uploadHistoricalBatch({
    required String batchName,
    required String filePath,
  }) async {
    try {
      final formData = FormData.fromMap({
        'batchName': batchName,
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _dio.post(
        '/api/historical-transactions/batch-upload',
        data: formData,
      );
      return Map<String, dynamic>.from(response.data as Map);
    } catch (e) {
      rethrow;
    }
  }

  Future<PosProduct?> findProductByBarcodeOrSku(String code) async {
    final trimmed = code.trim();
    if (trimmed.isEmpty) return null;
    try {
      final response = await _dio.get(
        '/api/stock',
        queryParameters: {'search': trimmed, 'limit': 20},
      );
      final List productsJson = response.data['products'] ?? [];
      for (final raw in productsJson) {
        final data = Map<String, dynamic>.from(raw as Map);
        if (_matchesBarcodeOrSku(data, trimmed)) {
          return _productFromRaw(data);
        }
      }
      return null;
    } catch (_) {
      // Offline fallback: resolve from cached products.
      final cached = await _readProductsCache();
      for (final product in cached) {
        final sku = (product.sku ?? '').trim().toLowerCase();
        final probe = trimmed.toLowerCase();
        if (sku == probe) {
          return product;
        }
      }
      return null;
    }
  }

  Future<void> _saveProductsCache(List productsJson) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_productsCacheKey, jsonEncode(productsJson));
      await prefs.setString(_productsCacheAtKey, DateTime.now().toIso8601String());
    } catch (_) {
      // Ignore cache write failures; online flow should still work.
    }
  }

  Future<List<PosProduct>> _readProductsCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_productsCacheKey);
      if (raw == null || raw.isEmpty) return const [];
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      final list = decoded;
      return list
          .map((e) => _productFromRaw(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  PosProduct _productFromRaw(Map<String, dynamic> data) {
    data['price'] = _toDouble(data['price']);
    data['stockLevel'] = _toDouble(data['stockLevel']);
    if (data['taxes'] != null) {
      data['taxes'] = (data['taxes'] as List).map((t) {
        final Map<String, dynamic> tax = Map<String, dynamic>.from(t);
        tax['taxRate'] = _toDouble(tax['taxRate']);
        return tax;
      }).toList();
    }
    if (data['units'] != null) {
      data['units'] = (data['units'] as List).map((u) {
        final Map<String, dynamic> unit = Map<String, dynamic>.from(u);
        unit['conversionRate'] = _toDouble(unit['conversionRate']);
        unit['unitPrice'] = _toDouble(unit['unitPrice']);
        return unit;
      }).toList();
    }
    return PosProduct.fromJson(data);
  }

  bool _matchesBarcodeOrSku(Map<String, dynamic> data, String code) {
    final sku = (data['sku'] ?? '').toString().trim().toLowerCase();
    final legacyBarcode = (data['barcode'] ?? '').toString().trim().toLowerCase();
    final barcodes = (data['barcodes'] is List)
        ? (data['barcodes'] as List)
            .map((e) => e.toString().trim().toLowerCase())
            .toList()
        : const <String>[];
    final probe = code.toLowerCase();
    return sku == probe || legacyBarcode == probe || barcodes.contains(probe);
  }

  double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }

  /// API whitelist uses `saleDate`, not `date`.
  String _mapSalesListSortBy(String sortBy) {
    switch (sortBy) {
      case 'date':
        return 'saleDate';
      default:
        return sortBy;
    }
  }
}
