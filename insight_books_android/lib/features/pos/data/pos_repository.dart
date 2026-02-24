import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
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

  double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }
}
