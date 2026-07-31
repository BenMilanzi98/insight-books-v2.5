import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/stock_models.dart';

final stockRepositoryProvider = Provider<StockRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return StockRepository(dio);
});

class StockRepository {
  StockRepository(this._dio);

  final Dio _dio;

  /// GET /api/stock — paginated product/service catalog
  Future<StockListResponse> fetchProducts({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    String? status,
    String? location,
    String sort = 'name',
    String order = 'asc',
    String catalog = 'products',
    bool includeDeleted = false,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
        'sort': sort,
        'order': order,
        'catalog': catalog,
        ...?search != null && search.isNotEmpty ? {'search': search} : null,
        ...?category != null && category != 'all' ? {'category': category} : null,
        ...?status != null && status != 'all' ? {'status': status} : null,
        ...?location != null && location != 'all' ? {'location': location} : null,
        if (includeDeleted) 'includeDeleted': 'true',
      };

      final response = await _dio.get('/api/stock', queryParameters: queryParams);
      return _parseListResponse(
        response.data,
        page: page,
        limit: limit,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock/statistics
  Future<StockStatistics> fetchStatistics({String catalog = 'products'}) async {
    try {
      final response = await _dio.get('/api/stock/statistics');
      final data = response.data;
      if (data == null || data is! Map) {
        return const StockStatistics();
      }
      return StockStatistics.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock/:id
  Future<StockProduct> fetchProduct(String id) async {
    try {
      final response = await _dio.get('/api/stock/$id');
      return StockProduct.fromJson(_productMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/stock
  Future<StockProduct> createProduct(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post('/api/stock', data: body);
      return StockProduct.fromJson(_productMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// PUT /api/stock/:id
  Future<StockProduct> updateProduct(String id, Map<String, dynamic> body) async {
    try {
      final response = await _dio.put('/api/stock/$id', data: body);
      return StockProduct.fromJson(_productMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// DELETE /api/stock/:id
  Future<void> deleteProduct(String id, {String? reason}) async {
    try {
      await _dio.delete(
        '/api/stock/$id',
        data: reason != null && reason.isNotEmpty ? {'reason': reason} : null,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/stock/restore
  Future<void> restoreProducts(List<String> productIds) async {
    try {
      await _dio.post('/api/stock/restore', data: {'productIds': productIds});
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock/restore — deleted products archive
  Future<StockListResponse> fetchDeletedProducts({
    int page = 1,
    int limit = 20,
    String? search,
    String sortBy = 'deletedAt',
    String sortOrder = 'desc',
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
        'sortBy': sortBy,
        'sortOrder': sortOrder,
        ...?search != null && search.isNotEmpty ? {'search': search} : null,
      };

      final response = await _dio.get('/api/stock/restore', queryParameters: queryParams);
      final data = response.data;
      if (data == null || data is! Map) {
        return StockListResponse(products: const [], page: page, limit: limit, totalCount: 0, totalPages: 0);
      }

      final map = Map<String, dynamic>.from(data);
      final rawList = map['products'] as List<dynamic>? ?? [];
      final List<StockProduct> products = [];
      for (final e in rawList) {
        try {
          if (e is! Map) continue;
          final item = Map<String, dynamic>.from(e);
          item['isDeleted'] = true;
          products.add(StockProduct.fromJson(item));
        } catch (_) {
          continue;
        }
      }

      final pag = map['pagination'] is Map
          ? Map<String, dynamic>.from(map['pagination'] as Map)
          : <String, dynamic>{};

      return StockListResponse(
        products: products,
        page: (pag['currentPage'] as num?)?.toInt() ??
            (pag['page'] as num?)?.toInt() ??
            page,
        limit: (pag['itemsPerPage'] as num?)?.toInt() ??
            (pag['limit'] as num?)?.toInt() ??
            limit,
        totalCount: (pag['totalItems'] as num?)?.toInt() ??
            (pag['totalCount'] as num?)?.toInt() ??
            products.length,
        totalPages: (pag['totalPages'] as num?)?.toInt() ??
            (pag['pages'] as num?)?.toInt() ??
            1,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/services
  Future<StockProduct> createService(Map<String, dynamic> body) async {
    try {
      final response = await _dio.post('/api/services', data: body);
      return StockProduct.fromJson(_productMapFromResponse(response.data));
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/stock/transactions — Stock In / Out / Adjustment
  Future<void> postTransaction({
    required String productId,
    required String type,
    required double quantity,
    double? unitCost,
    String? notes,
  }) async {
    try {
      await _dio.post('/api/stock/transactions', data: {
        'productId': productId,
        'type': type,
        'quantity': quantity,
        if (unitCost != null) 'unitCost': unitCost,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      });
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock/transactions — paginated movement list
  Future<StockTransactionListResponse> fetchTransactions({
    int page = 1,
    int limit = 20,
    String? productId,
  }) async {
    try {
      final response = await _dio.get(
        '/api/stock/transactions',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (productId != null && productId.isNotEmpty) 'productId': productId,
        },
      );
      return _parseTransactionListResponse(response.data, page: page, limit: limit);
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock/movement-history — timeline for a product
  Future<List<StockTransaction>> fetchMovementHistory({
    required String productId,
    int limit = 50,
    String order = 'desc',
  }) async {
    try {
      final response = await _dio.get(
        '/api/stock/movement-history',
        queryParameters: {
          'productId': productId,
          'limit': limit,
          'order': order,
        },
      );
      final data = response.data;
      if (data == null || data is! Map) return const [];
      final raw = data['movements'] as List<dynamic>? ?? [];
      final List<StockTransaction> movements = [];
      for (final e in raw) {
        try {
          if (e is! Map) continue;
          movements.add(
            StockTransaction.fromJson(Map<String, dynamic>.from(e)),
          );
        } catch (_) {
          continue;
        }
      }
      return movements;
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock-transfers
  Future<StockTransferListResponse> fetchTransfers({
    String? status,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get(
        '/api/stock-transfers',
        queryParameters: {
          if (status != null && status.isNotEmpty && status != 'all')
            'status': status,
          if (branchId != null && branchId.isNotEmpty) 'branchId': branchId,
        },
      );
      final data = response.data;
      if (data == null || data is! Map) {
        return const StockTransferListResponse();
      }
      final map = Map<String, dynamic>.from(data);
      final raw = map['transfers'] as List<dynamic>? ?? [];
      final List<StockTransfer> transfers = [];
      for (final e in raw) {
        try {
          if (e is! Map) continue;
          transfers.add(
            StockTransfer.fromJson(Map<String, dynamic>.from(e)),
          );
        } catch (_) {
          continue;
        }
      }
      return StockTransferListResponse(
        transfers: transfers,
        count: (map['count'] as num?)?.toInt() ?? transfers.length,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/stock-transfers — cross-business transfer
  Future<StockTransfer> createTransfer({
    required String fromTenantId,
    required String toTenantId,
    required String productId,
    required double quantity,
    String? notes,
    bool directTransfer = true,
  }) async {
    try {
      final response = await _dio.post('/api/stock-transfers', data: {
        'fromTenantId': fromTenantId,
        'toTenantId': toTenantId,
        'productId': productId,
        'quantity': quantity,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        'directTransfer': directTransfer,
      });
      final data = response.data;
      if (data is Map && data['transfer'] is Map) {
        return StockTransfer.fromJson(
          Map<String, dynamic>.from(data['transfer'] as Map),
        );
      }
      if (data is Map) {
        return StockTransfer.fromJson(Map<String, dynamic>.from(data));
      }
      throw StateError('Invalid transfer response');
    } catch (e) {
      rethrow;
    }
  }

  /// PUT /api/stock-transfers/:id?action=approve|receive|reject
  Future<StockTransfer> transferAction(
    String id,
    String action, {
    String? rejectionReason,
  }) async {
    try {
      final response = await _dio.put(
        '/api/stock-transfers/$id',
        queryParameters: {'action': action},
        data: rejectionReason != null && rejectionReason.isNotEmpty
            ? {'rejectionReason': rejectionReason}
            : null,
      );
      final data = response.data;
      if (data is Map && data['transfer'] is Map) {
        return StockTransfer.fromJson(
          Map<String, dynamic>.from(data['transfer'] as Map),
        );
      }
      if (data is Map) {
        return StockTransfer.fromJson(Map<String, dynamic>.from(data));
      }
      throw StateError('Invalid transfer action response');
    } catch (e) {
      rethrow;
    }
  }

  /// Prefer GET /api/stock-by-business (v2.5); fall back to /api/stock-by-branch.
  Future<List<StockByBranchSummary>> fetchStockByBranch() async {
    try {
      final response = await _dio.get('/api/stock-by-business');
      final data = response.data;
      if (data is Map) {
        final raw = data['businesses'] as List<dynamic>? ??
            data['branches'] as List<dynamic>? ??
            [];
        return _parseStockByBranchRows(raw);
      }
    } catch (_) {
      // Fall through to legacy endpoint.
    }

    final response = await _dio.get('/api/stock-by-branch');
    final data = response.data;
    if (data == null || data is! Map) return const [];
    final raw = data['branches'] as List<dynamic>? ??
        data['businesses'] as List<dynamic>? ??
        [];
    return _parseStockByBranchRows(raw);
  }

  List<StockByBranchSummary> _parseStockByBranchRows(List<dynamic> raw) {
    final List<StockByBranchSummary> rows = [];
    for (final e in raw) {
      try {
        if (e is! Map) continue;
        rows.add(StockByBranchSummary.fromJson(Map<String, dynamic>.from(e)));
      } catch (_) {
        continue;
      }
    }
    return rows;
  }

  /// Download basic Excel import template (v2.5).
  Future<List<int>> downloadBasicImportTemplate({bool example = false}) async {
    final response = await _dio.get<List<int>>(
      '/api/stock/basic-import/template',
      queryParameters: {'example': example ? '1' : '0'},
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data ?? <int>[];
  }

  /// Preview basic Excel import (multipart).
  Future<Map<String, dynamic>> previewBasicImport({
    required List<int> fileBytes,
    required String filename,
    String purpose = 'STOCK_RECEIPT_IMPORT',
    bool updateSellingPrice = true,
    bool forceAsNewReceipt = false,
  }) async {
    final form = FormData.fromMap({
      'file': MultipartFile.fromBytes(fileBytes, filename: filename),
      'purpose': purpose,
      'updateSellingPrice': updateSellingPrice ? 'true' : 'false',
      'forceAsNewReceipt': forceAsNewReceipt ? 'true' : 'false',
    });
    final response = await _dio.post(
      '/api/stock/basic-import/preview',
      data: form,
    );
    return Map<String, dynamic>.from(response.data as Map? ?? {});
  }

  /// Confirm basic Excel import (multipart).
  Future<Map<String, dynamic>> confirmBasicImport({
    required List<int> fileBytes,
    required String filename,
    String purpose = 'STOCK_RECEIPT_IMPORT',
    bool updateSellingPrice = true,
    bool forceAsNewReceipt = false,
  }) async {
    final form = FormData.fromMap({
      'file': MultipartFile.fromBytes(fileBytes, filename: filename),
      'purpose': purpose,
      'updateSellingPrice': updateSellingPrice ? 'true' : 'false',
      'forceAsNewReceipt': forceAsNewReceipt ? 'true' : 'false',
    });
    final response = await _dio.post(
      '/api/stock/basic-import/confirm',
      data: form,
    );
    return Map<String, dynamic>.from(response.data as Map? ?? {});
  }

  /// Basic stock export (Excel bytes).
  Future<List<int>> downloadBasicExport() async {
    final response = await _dio.get<List<int>>(
      '/api/stock/basic-export',
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data ?? <int>[];
  }

  /// Products at a source business for transfer picker (all branches).
  Future<List<StockProduct>> fetchProductsForTransferSource({
    required String tenantId,
  }) async {
    try {
      final response = await _dio.get('/api/stock', queryParameters: {
        'tenantId': tenantId,
        'allBranches': 'true',
        'limit': 0,
        'page': 1,
      });
      final data = response.data;
      if (data == null || data is! Map) return const [];
      final raw = data['products'] as List<dynamic>? ?? [];
      final List<StockProduct> products = [];
      for (final e in raw) {
        try {
          if (e is! Map) continue;
          final p = StockProduct.fromJson(Map<String, dynamic>.from(e));
          if (p.quantityInStock > 0 && !p.isService) {
            products.add(p);
          }
        } catch (_) {
          continue;
        }
      }
      products.sort((a, b) => a.name.compareTo(b.name));
      return products;
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/inventory/expiry-alerts
  Future<ExpiryAlertsResponse> fetchExpiryAlerts({String? branchId}) async {
    try {
      final response = await _dio.get(
        '/api/inventory/expiry-alerts',
        queryParameters: {
          if (branchId != null && branchId.isNotEmpty) 'branchId': branchId,
        },
      );
      final data = response.data;
      if (data == null || data is! Map) {
        return const ExpiryAlertsResponse();
      }
      return ExpiryAlertsResponse.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/inventory/write-off
  Future<WriteOffResult> writeOff({
    required String batchId,
    double? quantity,
    String? notes,
    String? branchId,
  }) async {
    try {
      final response = await _dio.post('/api/inventory/write-off', data: {
        'batchId': batchId,
        if (quantity != null) 'quantity': quantity,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (branchId != null && branchId.isNotEmpty) 'branchId': branchId,
      });
      final data = response.data;
      if (data == null || data is! Map) {
        throw StateError('Invalid write-off response');
      }
      return WriteOffResult.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/inventory/restock
  Future<RestockResult> restock({
    required String productId,
    required double quantity,
    required double unitCost,
    String? expiryDate,
    String? branchId,
    String? notes,
    String? priorBatchId,
  }) async {
    try {
      final response = await _dio.post('/api/inventory/restock', data: {
        'productId': productId,
        'quantity': quantity,
        'unitCost': unitCost,
        if (expiryDate != null && expiryDate.isNotEmpty) 'expiryDate': expiryDate,
        if (branchId != null && branchId.isNotEmpty) 'branchId': branchId,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (priorBatchId != null && priorBatchId.isNotEmpty)
          'priorBatchId': priorBatchId,
      });
      final data = response.data;
      if (data == null || data is! Map) {
        throw StateError('Invalid restock response');
      }
      return RestockResult.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock/receiving — PO lines and goods receipts dashboard
  Future<ReceivingDataResponse> fetchReceiving() async {
    try {
      final response = await _dio.get('/api/stock/receiving');
      final data = response.data;
      if (data == null || data is! Map) {
        return const ReceivingDataResponse();
      }
      return ReceivingDataResponse.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock/:id/can-delete
  Future<Map<String, dynamic>> fetchCanDelete(String id) async {
    try {
      final response = await _dio.get('/api/stock/$id/can-delete');
      final data = response.data;
      if (data == null || data is! Map) return {};
      return Map<String, dynamic>.from(data);
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/units?includeUnits=true
  Future<List<StockBaseUnit>> fetchUnits({bool includeUnits = true}) async {
    try {
      final response = await _dio.get(
        '/api/units',
        queryParameters:
            includeUnits ? {'includeUnits': 'true'} : null,
      );
      final data = response.data;
      if (data == null || data is! Map) return const [];
      final raw = data['baseUnits'] as List<dynamic>? ?? [];
      final List<StockBaseUnit> baseUnits = [];
      for (final e in raw) {
        try {
          if (e is! Map) continue;
          baseUnits.add(StockBaseUnit.fromJson(Map<String, dynamic>.from(e)));
        } catch (_) {
          continue;
        }
      }
      return baseUnits;
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/tax-types?status=Active
  Future<List<StockTaxTypeOption>> fetchTaxTypes({String status = 'Active'}) async {
    try {
      final response = await _dio.get(
        '/api/tax-types',
        queryParameters: {'status': status},
      );
      final data = response.data;
      final raw = data is Map
          ? (data['taxTypes'] ?? data['taxes'] ?? [])
          : (data is List ? data : []);
      final List<StockTaxTypeOption> taxes = [];
      for (final e in raw) {
        try {
          if (e is! Map) continue;
          taxes.add(
            StockTaxTypeOption.fromJson(Map<String, dynamic>.from(e)),
          );
        } catch (_) {
          continue;
        }
      }
      return taxes;
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/categories?type=stock
  Future<List<String>> fetchStockCategories() async {
    try {
      final response = await _dio.get(
        '/api/categories',
        queryParameters: {'type': 'stock'},
      );
      final data = response.data;
      if (data == null || data is! Map) return const [];
      final raw = data['categories'] as List<dynamic>? ?? [];
      return raw.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/locations
  Future<List<String>> fetchLocations() async {
    try {
      final response = await _dio.get('/api/locations');
      final data = response.data;
      if (data == null || data is! Map) return const [];
      final raw = data['locations'] as List<dynamic>? ?? [];
      return raw.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/products/:id/taxes
  Future<List<String>> fetchProductTaxIds(String productId) async {
    try {
      final response = await _dio.get('/api/products/$productId/taxes');
      final data = response.data;
      final raw = data is List
          ? data
          : (data is Map ? (data['taxes'] ?? []) : []);
      final List<String> ids = [];
      for (final e in raw) {
        if (e is! Map) continue;
        final map = Map<String, dynamic>.from(e);
        final id = (map['taxTypeId'] ?? map['id'])?.toString();
        if (id != null && id.isNotEmpty) ids.add(id);
      }
      return ids;
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/products/:id/taxes
  Future<void> saveProductTaxes(
    String productId,
    List<String> taxTypeIds,
  ) async {
    try {
      await _dio.post(
        '/api/products/$productId/taxes',
        data: {'taxTypeIds': taxTypeIds},
      );
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/stock/export?format=csv — returns CSV bytes
  Future<StockExportResult> exportStockCsv({
    String? search,
    String? category,
    String? status,
    String? location,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'format': 'csv',
        'allBranches': 'true',
        ...?search != null && search.isNotEmpty ? {'search': search} : null,
        ...?category != null && category != 'all' && category != 'All'
            ? {'category': category}
            : null,
        ...?status != null && status != 'all' && status != 'All'
            ? {'status': status}
            : null,
        ...?location != null && location != 'all' && location != 'All'
            ? {'location': location}
            : null,
      };

      final response = await _dio.get<dynamic>(
        '/api/stock/export',
        queryParameters: queryParams,
        options: Options(responseType: ResponseType.bytes),
      );

      final bytes = _bytesFromResponse(response.data);
      final filename = _filenameFromContentDisposition(
            response.headers.value('content-disposition'),
          ) ??
          'stock_export.csv';

      return StockExportResult(bytes: bytes, filename: filename);
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/stock/batch-delete
  Future<BatchDeleteResult> batchDeleteProducts(
    List<String> productIds, {
    String? reason,
  }) async {
    try {
      final response = await _dio.post(
        '/api/stock/batch-delete',
        data: {
          'productIds': productIds,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
      final data = response.data;
      if (data is! Map) {
        throw StateError('Invalid batch delete response');
      }
      final map = Map<String, dynamic>.from(data);
      return BatchDeleteResult(
        deletedCount: (map['deletedCount'] as num?)?.toInt() ?? productIds.length,
        message: map['message']?.toString(),
      );
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/stock/upload-image (multipart)
  Future<String> uploadProductImage({
    required String productId,
    required String filePath,
  }) async {
    try {
      final formData = FormData.fromMap({
        'productId': productId,
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _dio.post(
        '/api/stock/upload-image',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
      final data = response.data;
      if (data is Map) {
        final url = (data['imageUrl'] ??
                data['imagePath'] ??
                data['url'] ??
                data['image'])
            ?.toString();
        if (url != null && url.isNotEmpty) return url;
      }
      throw StateError('Invalid image upload response');
    } catch (e) {
      rethrow;
    }
  }

  StockListResponse _parseListResponse(
    dynamic data, {
    required int page,
    required int limit,
  }) {
    if (data == null || data is! Map) {
      return StockListResponse(
        products: const [],
        page: page,
        limit: limit,
        totalCount: 0,
        totalPages: 0,
      );
    }

    final map = Map<String, dynamic>.from(data);
    final rawList = map['products'] as List<dynamic>? ?? [];
    final List<StockProduct> products = [];
    for (final e in rawList) {
      try {
        if (e is! Map) continue;
        products.add(StockProduct.fromJson(Map<String, dynamic>.from(e)));
      } catch (_) {
        continue;
      }
    }

    final pag = map['pagination'] is Map
        ? Map<String, dynamic>.from(map['pagination'] as Map)
        : <String, dynamic>{};

    return StockListResponse(
      products: products,
      page: (pag['page'] as num?)?.toInt() ?? page,
      limit: (pag['limit'] as num?)?.toInt() ?? limit,
      totalCount: (pag['totalCount'] as num?)?.toInt() ?? products.length,
      totalPages: (pag['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  StockTransactionListResponse _parseTransactionListResponse(
    dynamic data, {
    required int page,
    required int limit,
  }) {
    if (data == null || data is! Map) {
      return StockTransactionListResponse(page: page, limit: limit);
    }
    final map = Map<String, dynamic>.from(data);
    final rawList = map['transactions'] as List<dynamic>? ?? [];
    final List<StockTransaction> transactions = [];
    for (final e in rawList) {
      try {
        if (e is! Map) continue;
        transactions.add(
          StockTransaction.fromJson(Map<String, dynamic>.from(e)),
        );
      } catch (_) {
        continue;
      }
    }
    final pag = map['pagination'] is Map
        ? Map<String, dynamic>.from(map['pagination'] as Map)
        : <String, dynamic>{};
    return StockTransactionListResponse(
      transactions: transactions,
      page: (pag['page'] as num?)?.toInt() ?? page,
      limit: (pag['limit'] as num?)?.toInt() ?? limit,
      totalCount: (pag['totalCount'] as num?)?.toInt() ?? transactions.length,
      totalPages: (pag['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  Map<String, dynamic> _productMapFromResponse(dynamic data) {
    if (data == null || data is! Map) {
      throw StateError('Invalid product response');
    }
    final map = Map<String, dynamic>.from(data);
    if (map['product'] is Map) {
      return Map<String, dynamic>.from(map['product'] as Map);
    }
    return map;
  }

  List<int> _bytesFromResponse(dynamic data) {
    if (data == null) return const [];
    if (data is List<int>) return data;
    if (data is String) return data.codeUnits;
    return const [];
  }

  String? _filenameFromContentDisposition(String? header) {
    if (header == null || header.isEmpty) return null;
    final match = RegExp(r'filename="?([^";]+)"?').firstMatch(header);
    return match?.group(1);
  }
}

class StockExportResult {
  const StockExportResult({required this.bytes, required this.filename});

  final List<int> bytes;
  final String filename;
}

class BatchDeleteResult {
  const BatchDeleteResult({required this.deletedCount, this.message});

  final int deletedCount;
  final String? message;
}
