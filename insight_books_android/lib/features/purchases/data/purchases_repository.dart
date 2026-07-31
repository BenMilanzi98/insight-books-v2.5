import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/purchases_models.dart';

final purchasesRepositoryProvider = Provider<PurchasesRepository>((ref) {
  return PurchasesRepository(ref.watch(dioProvider));
});

class PurchasesRepository {
  PurchasesRepository(this._dio);

  final Dio _dio;

  // ---------------------------------------------------------------------------
  // Suppliers
  // ---------------------------------------------------------------------------

  /// GET /api/purchases/suppliers
  Future<PurchaseSupplierListResponse> fetchSuppliers({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
  }) async {
    try {
      final response = await _dio.get(
        '/api/purchases/suppliers',
        queryParameters: {
          'page': page,
          'limit': limit,
          ...?search != null && search.isNotEmpty ? {'search': search} : null,
          ...?status != null && status.isNotEmpty && status != 'all'
              ? {'status': status}
              : null,
        },
      );
      return _parseListResponse(
        response.data,
        PurchaseSupplierListResponse.fromJson,
        page: page,
        limit: limit,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/purchases/suppliers/:id
  Future<PurchaseSupplier> fetchSupplier(
    String id, {
    bool includeTransactions = false,
  }) async {
    try {
      final response = await _dio.get(
        '/api/purchases/suppliers/$id',
        queryParameters: includeTransactions
            ? {'includeTransactions': 'true'}
            : null,
      );
      return PurchaseSupplier.fromJson(_supplierMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/purchases/suppliers
  Future<PurchaseSupplier> createSupplier(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post('/api/purchases/suppliers', data: body);
      return PurchaseSupplier.fromJson(_supplierMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// PUT /api/purchases/suppliers/:id
  Future<PurchaseSupplier> updateSupplier(
    String id,
    Map<String, dynamic> body,
  ) async {
    try {
      final response =
          await _dio.put('/api/purchases/suppliers/$id', data: body);
      return PurchaseSupplier.fromJson(_supplierMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// DELETE /api/purchases/suppliers/:id
  Future<void> deleteSupplier(String id) async {
    try {
      await _dio.delete('/api/purchases/suppliers/$id');
    } catch (e) {
      rethrow;
    }
  }

  /// PUT /api/purchases/suppliers/bulk
  Future<void> bulkUpdateSuppliers(Map<String, dynamic> body) async {
    try {
      await _dio.put('/api/purchases/suppliers/bulk', data: body);
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/purchases/suppliers/:id/transactions
  Future<Map<String, dynamic>> fetchSupplierTransactions(String id) async {
    try {
      final response =
          await _dio.get('/api/purchases/suppliers/$id/transactions');
      final data = response.data;
      if (data == null || data is! Map) return {};
      return Map<String, dynamic>.from(data);
    } catch (e) {
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------------

  /// GET /api/purchases/orders
  Future<PurchaseOrderListResponse> fetchOrders({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
  }) async {
    try {
      final response = await _dio.get(
        '/api/purchases/orders',
        queryParameters: {
          'page': page,
          'limit': limit,
          ...?search != null && search.isNotEmpty ? {'search': search} : null,
          ...?status != null && status.isNotEmpty && status != 'all'
              ? {'status': status}
              : null,
        },
      );
      return _parseListResponse(
        response.data,
        PurchaseOrderListResponse.fromJson,
        page: page,
        limit: limit,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/purchases/orders/:id
  Future<PurchaseOrder> fetchOrder(String id) async {
    try {
      final response = await _dio.get('/api/purchases/orders/$id');
      return PurchaseOrder.fromJson(_orderMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/purchases/orders
  Future<PurchaseOrder> createOrder(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post('/api/purchases/orders', data: body);
      return PurchaseOrder.fromJson(_orderMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// PUT /api/purchases/orders/:id
  Future<PurchaseOrder> updateOrder(
    String id,
    Map<String, dynamic> body,
  ) async {
    try {
      final response =
          await _dio.put('/api/purchases/orders/$id', data: body);
      return PurchaseOrder.fromJson(_orderMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// DELETE /api/purchases/orders/:id — cancel PO
  Future<void> deleteOrder(String id) async {
    try {
      await _dio.delete('/api/purchases/orders/$id');
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/purchases/orders/:id/upload — multipart invoice upload
  Future<void> uploadOrderInvoice(
    String id,
    List<int> bytes,
    String filename,
  ) async {
    try {
      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(bytes, filename: filename),
      });
      await _dio.post(
        '/api/purchases/orders/$id/upload',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
    } catch (e) {
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Receipts
  // ---------------------------------------------------------------------------

  /// GET /api/purchases/receipts
  Future<GoodsReceiptListResponse> fetchReceipts({
    int page = 1,
    int limit = 20,
    String? supplierId,
    String? status,
  }) async {
    try {
      final response = await _dio.get(
        '/api/purchases/receipts',
        queryParameters: {
          'page': page,
          'limit': limit,
          ...?supplierId != null && supplierId.isNotEmpty
              ? {'supplierId': supplierId}
              : null,
          ...?status != null && status.isNotEmpty && status != 'all'
              ? {'status': status}
              : null,
        },
      );
      return _parseListResponse(
        response.data,
        GoodsReceiptListResponse.fromJson,
        page: page,
        limit: limit,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/purchases/receipts
  Future<GoodsReceipt> createReceipt(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post('/api/purchases/receipts', data: body);
      return GoodsReceipt.fromJson(_receiptMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Bills
  // ---------------------------------------------------------------------------

  /// GET /api/purchases/bills
  Future<SupplierBillListResponse> fetchBills({
    int page = 1,
    int limit = 20,
    String? supplierId,
    String? status,
  }) async {
    try {
      final response = await _dio.get(
        '/api/purchases/bills',
        queryParameters: {
          'page': page,
          'limit': limit,
          ...?supplierId != null && supplierId.isNotEmpty
              ? {'supplierId': supplierId}
              : null,
          ...?status != null && status.isNotEmpty && status != 'all'
              ? {'status': status}
              : null,
        },
      );
      return _parseListResponse(
        response.data,
        SupplierBillListResponse.fromJson,
        page: page,
        limit: limit,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/purchases/bills/:id
  Future<SupplierBill> fetchBill(String id) async {
    try {
      final response = await _dio.get('/api/purchases/bills/$id');
      return SupplierBill.fromJson(_billMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/purchases/bills
  Future<SupplierBill> createBill(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post('/api/purchases/bills', data: body);
      return SupplierBill.fromJson(_billMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// DELETE /api/purchases/bills/:id — reverse/cancel bill
  Future<void> reverseBill(String id, {required String reason}) async {
    try {
      await _dio.delete(
        '/api/purchases/bills/$id',
        data: {'reversalReason': reason, 'reason': reason},
      );
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/purchases/bills/match — evaluate three-way match (v2.5).
  Future<BillMatchResult> matchBill(String billId) async {
    try {
      final response = await _dio.post(
        '/api/purchases/bills/match',
        data: {'billId': billId},
      );
      final data = response.data;
      if (data is Map && data['match'] is Map) {
        return BillMatchResult.fromJson(
          Map<String, dynamic>.from(data['match'] as Map),
        );
      }
      if (data is Map) {
        return BillMatchResult.fromJson(Map<String, dynamic>.from(data));
      }
      throw Exception('Unexpected match response');
    } catch (e) {
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  /// GET /api/purchases/payments
  Future<SupplierPaymentListResponse> fetchPayments({
    int page = 1,
    int limit = 20,
    String? supplierId,
  }) async {
    try {
      final response = await _dio.get(
        '/api/purchases/payments',
        queryParameters: {
          'page': page,
          'limit': limit,
          ...?supplierId != null && supplierId.isNotEmpty
              ? {'supplierId': supplierId}
              : null,
        },
      );
      return _parseListResponse(
        response.data,
        SupplierPaymentListResponse.fromJson,
        page: page,
        limit: limit,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/purchases/payments
  Future<SupplierPayment> createPayment(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post('/api/purchases/payments', data: body);
      return SupplierPayment.fromJson(_paymentMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// No dedicated GET /api/purchases/payments/:id — scan paginated list.
  Future<SupplierPayment> fetchPayment(String id) async {
    try {
      var page = 1;
      const limit = 100;
      while (true) {
        final list = await fetchPayments(page: page, limit: limit);
        for (final payment in list.items) {
          if (payment.id == id) return payment;
        }
        if (page >= list.totalPages || list.items.isEmpty) break;
        page++;
      }
      throw StateError('Payment not found: $id');
    } catch (e) {
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Supporting APIs
  // ---------------------------------------------------------------------------

  /// GET /api/categories?type=expense
  Future<List<Map<String, dynamic>>> fetchExpenseCategories() async {
    try {
      final response = await _dio.get(
        '/api/categories',
        queryParameters: {'type': 'expense'},
      );
      return _mapListFromResponse(response.data, key: 'categories');
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/tax-types?status=Active
  Future<List<Map<String, dynamic>>> fetchTaxTypes() async {
    try {
      final response = await _dio.get(
        '/api/tax-types',
        queryParameters: {'status': 'Active'},
      );
      final data = response.data;
      final raw = data is Map
          ? (data['taxTypes'] ?? data['taxes'] ?? [])
          : (data is List ? data : []);
      return _mapListFromRaw(raw);
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock?productUnits=1 — product catalog for PO line picker (web parity).
  Future<List<Map<String, dynamic>>> fetchProductsWithUnits({
    int page = 1,
    int limit = 500,
  }) async {
    try {
      final response = await _dio.get(
        '/api/stock',
        queryParameters: {
          'productUnits': '1',
          'page': page,
          'limit': limit,
          'catalog': 'products',
        },
      );
      return _mapListFromResponse(response.data, key: 'products');
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/payment-accounts?activeOnly=true
  Future<List<Map<String, dynamic>>> fetchPaymentAccounts() async {
    try {
      final response = await _dio.get(
        '/api/payment-accounts',
        queryParameters: {'activeOnly': 'true'},
      );
      return _mapListFromResponse(response.data, key: 'paymentAccounts');
    } catch (e) {
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Response helpers
  // ---------------------------------------------------------------------------

  T _parseListResponse<T>(
    dynamic data,
    T Function(Map<String, dynamic>) fromJson, {
    required int page,
    required int limit,
  }) {
    if (data == null || data is! Map) {
      return fromJson({'page': page, 'limit': limit});
    }
    return fromJson(Map<String, dynamic>.from(data));
  }

  Map<String, dynamic> _supplierMapFromResponse(dynamic data) {
    if (data == null || data is! Map) {
      throw StateError('Invalid supplier response');
    }
    final map = Map<String, dynamic>.from(data);
    if (map['supplier'] is Map) {
      return Map<String, dynamic>.from(map['supplier'] as Map);
    }
    return map;
  }

  Map<String, dynamic> _orderMapFromResponse(dynamic data) {
    if (data == null || data is! Map) {
      throw StateError('Invalid purchase order response');
    }
    final map = Map<String, dynamic>.from(data);
    if (map['purchaseOrder'] is Map) {
      return Map<String, dynamic>.from(map['purchaseOrder'] as Map);
    }
    return map;
  }

  Map<String, dynamic> _receiptMapFromResponse(dynamic data) {
    if (data == null || data is! Map) {
      throw StateError('Invalid goods receipt response');
    }
    final map = Map<String, dynamic>.from(data);
    if (map['goodsReceipt'] is Map) {
      return Map<String, dynamic>.from(map['goodsReceipt'] as Map);
    }
    if (map['receipt'] is Map) {
      return Map<String, dynamic>.from(map['receipt'] as Map);
    }
    return map;
  }

  Map<String, dynamic> _billMapFromResponse(dynamic data) {
    if (data == null || data is! Map) {
      throw StateError('Invalid supplier bill response');
    }
    final map = Map<String, dynamic>.from(data);
    if (map['bill'] is Map) {
      return Map<String, dynamic>.from(map['bill'] as Map);
    }
    return map;
  }

  Map<String, dynamic> _paymentMapFromResponse(dynamic data) {
    if (data == null || data is! Map) {
      throw StateError('Invalid supplier payment response');
    }
    final map = Map<String, dynamic>.from(data);
    if (map['payment'] is Map) {
      return Map<String, dynamic>.from(map['payment'] as Map);
    }
    return map;
  }

  List<Map<String, dynamic>> _mapListFromResponse(
    dynamic data, {
    required String key,
  }) {
    if (data == null || data is! Map) return const [];
    final raw = data[key] as List<dynamic>? ?? [];
    return _mapListFromRaw(raw);
  }

  List<Map<String, dynamic>> _mapListFromRaw(dynamic raw) {
    if (raw is! List) return const [];
    final List<Map<String, dynamic>> items = [];
    for (final e in raw) {
      try {
        if (e is! Map) continue;
        items.add(Map<String, dynamic>.from(e));
      } catch (_) {
        continue;
      }
    }
    return items;
  }
}
