import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
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
      return productsJson.map((json) {
        // Handle potential type mismatches in incoming JSON for double fields
        final Map<String, dynamic> data = Map<String, dynamic>.from(json);
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
      }).toList();
    } catch (e) {
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
      return clientsJson.map((json) => PosClient.fromJson(json)).toList();
    } catch (e) {
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> fetchPaymentAccounts() async {
    try {
      final response = await _dio.get(
        '/api/payment-accounts',
        queryParameters: {'activeOnly': 'true'},
      );
      final List accounts = response.data['paymentAccounts'] ?? [];
      return accounts.cast<Map<String, dynamic>>();
    } catch (e) {
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> fetchIncomeAccounts() async {
    try {
      final response = await _dio.get('/api/chart-of-accounts/income-accounts');
      final List accounts = response.data['accounts'] ?? [];
      return accounts.cast<Map<String, dynamic>>();
    } catch (e) {
      rethrow;
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
      return branches.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (e) {
      rethrow;
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
          if (sortBy != null && sortBy.isNotEmpty) 'sortBy': sortBy,
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

  Future<void> refundSale(String saleId, String reason) async {
    try {
      await _dio.post('/api/sales/$saleId/refund', data: {'reason': reason});
    } catch (e) {
      rethrow;
    }
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

  Future<List<int>> downloadReceiptPdf(String saleId) async {
    try {
      final response = await _dio.get(
        '/api/sales/$saleId/receipt',
        options: Options(responseType: ResponseType.bytes),
      );
      return response.data as List<int>;
    } catch (e) {
      rethrow;
    }
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
      return permissions;
    } catch (_) {
      return <String>{};
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
    final response = await _dio.get(
      '/api/tax-types',
      queryParameters: {'status': 'Active'},
    );
    final raw = response.data;
    final list = raw is Map ? (raw['taxTypes'] ?? raw['taxes'] ?? []) : [];
    return (list as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<List<Map<String, dynamic>>> fetchTaxAccounts() async {
    final response = await _dio.get('/api/tax-types/accounts');
    final raw = response.data;
    final list = raw is Map ? (raw['accounts'] ?? []) : [];
    return (list as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<Map<String, dynamic>?> fetchTaxDefaults() async {
    try {
      final response = await _dio.get('/api/settings/tax-defaults');
      return Map<String, dynamic>.from(response.data as Map);
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
    final response = await _dio.get(
      '/api/stock',
      queryParameters: {'search': trimmed, 'limit': 20},
    );
    final List productsJson = response.data['products'] ?? [];
    for (final raw in productsJson) {
      final data = Map<String, dynamic>.from(raw as Map);
      final sku = (data['sku'] ?? '').toString().trim().toLowerCase();
      final legacyBarcode = (data['barcode'] ?? '').toString().trim().toLowerCase();
      final barcodes = (data['barcodes'] is List)
          ? (data['barcodes'] as List).map((e) => e.toString().trim().toLowerCase()).toList()
          : const <String>[];
      final probe = trimmed.toLowerCase();
      if (sku == probe || legacyBarcode == probe || barcodes.contains(probe)) {
        data['price'] = _toDouble(data['price']);
        data['stockLevel'] = _toDouble(data['stockLevel']);
        if (data['taxes'] != null) {
          data['taxes'] = (data['taxes'] as List).map((t) {
            final tax = Map<String, dynamic>.from(t);
            tax['taxRate'] = _toDouble(tax['taxRate']);
            return tax;
          }).toList();
        }
        if (data['units'] != null) {
          data['units'] = (data['units'] as List).map((u) {
            final unit = Map<String, dynamic>.from(u);
            unit['conversionRate'] = _toDouble(unit['conversionRate']);
            unit['unitPrice'] = _toDouble(unit['unitPrice']);
            return unit;
          }).toList();
        }
        return PosProduct.fromJson(data);
      }
    }
    return null;
  }

  double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }
}
