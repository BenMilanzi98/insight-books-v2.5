import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../domain/invoice_model.dart';

final invoiceRepositoryProvider = Provider<InvoiceRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return InvoiceRepository(dio);
});

class InvoiceRepository {
  final Dio _dio;

  InvoiceRepository(this._dio);

  Future<InvoiceListResponse> fetchInvoices({
    String? search,
    String? status,
    int page = 1,
    int limit = 20,
    String? sortBy,
    String? sortOrder,
    String? dateFrom,
    String? dateTo,
    String? clientId,
  }) async {
    try {
      final response = await _dio.get(
        '/api/invoices',
        queryParameters: <String, dynamic>{
          'page': page,
          'limit': limit,
          ...?(search != null && search.isNotEmpty) ? {'search': search} : null,
          ...?(status != null && status != 'all' && status.isNotEmpty)
              ? {'status': status}
              : null,
          ...?sortBy != null ? {'sortBy': _mapSortField(sortBy)} : null,
          ...?sortOrder != null ? {'sortOrder': sortOrder} : null,
          ...?(dateFrom != null && dateFrom.isNotEmpty)
              ? {'dateFrom': dateFrom}
              : null,
          ...?(dateTo != null && dateTo.isNotEmpty) ? {'dateTo': dateTo} : null,
          ...?(clientId != null && clientId.isNotEmpty)
              ? {'client': clientId}
              : null,
        },
      );

      final data = response.data;
      if (data == null || data is! Map) {
        return InvoiceListResponse(invoices: []);
      }

      final dynamic raw = data['invoices'] ?? data['data'];
      final List invoicesJson = raw is List ? raw : [];
      final List<Invoice> result = [];
      for (final e in invoicesJson) {
        try {
          result.add(_parseInvoice(Map<String, dynamic>.from(e as Map)));
        } catch (_) {
          continue;
        }
      }

      final pagination = data['pagination'] as Map<String, dynamic>?;
      return InvoiceListResponse(
        invoices: result,
        totalPages: (pagination?['totalPages'] as num?)?.toInt() ?? 1,
        totalCount:
            (pagination?['totalCount'] as num?)?.toInt() ?? result.length,
        page: (pagination?['page'] as num?)?.toInt() ?? page,
        limit: (pagination?['limit'] as num?)?.toInt() ?? limit,
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<Invoice> fetchInvoiceById(String id) async {
    try {
      final response = await _dio.get('/api/invoices/$id');
      final Map<String, dynamic> data = response.data is Map<String, dynamic>
          ? Map<String, dynamic>.from(response.data)
          : Map<String, dynamic>.from(
              response.data['invoice'] ?? response.data,
            );

      return _parseInvoice(data);
    } catch (e) {
      rethrow;
    }
  }

  /// Fetches the default income account ID required by the API for each invoice item.
  Future<String> _getDefaultIncomeAccountId() async {
    final response = await _dio.get('/api/chart-of-accounts/income-accounts');
    final data = response.data;
    if (data == null || data is! Map) {
      throw Exception(
        'No income accounts found. Add an Income account (e.g. 4000 - Revenue) in Chart of Accounts.',
      );
    }
    final accounts = data['accounts'];
    if (accounts == null || accounts is! List || accounts.isEmpty) {
      throw Exception(
        'No income accounts found. Add an Income account (e.g. 4000 - Revenue) in Chart of Accounts.',
      );
    }
    final first = accounts.first;
    if (first is! Map) return (first as dynamic).toString();
    final id = first['id'];
    if (id == null || id.toString().isEmpty) {
      throw Exception(
        'Invalid income account. Add an Income account in Chart of Accounts.',
      );
    }
    return id.toString();
  }

  Future<Invoice> createInvoice(CreateInvoiceRequest request) async {
    try {
      final defaultAccountId = await _getDefaultIncomeAccountId();
      final body = request.toJson();
      final items = body['items'] as List<dynamic>? ?? [];
      final itemsWithAccount = items.map<Map<String, dynamic>>((e) {
        final map = Map<String, dynamic>.from(e as Map);
        map['accountId'] = defaultAccountId;
        return map;
      }).toList();
      body['items'] = itemsWithAccount;

      final response = await _dio.post('/api/invoices', data: body);
      final Map<String, dynamic> data =
          response.data['invoice'] ?? response.data;
      return _parseInvoice(Map<String, dynamic>.from(data));
    } catch (e) {
      rethrow;
    }
  }

  Future<Invoice> createInvoiceFromPayload(Map<String, dynamic> payload) async {
    try {
      final defaultAccountId = await _getDefaultIncomeAccountId();
      final body = Map<String, dynamic>.from(payload);
      final items = body['items'] as List<dynamic>? ?? [];
      body['items'] = items.map<Map<String, dynamic>>((e) {
        final map = Map<String, dynamic>.from(e as Map);
        map['accountId'] = map['accountId'] ?? defaultAccountId;
        return map;
      }).toList();
      final response = await _dio.post('/api/invoices', data: body);
      final Map<String, dynamic> data =
          response.data['invoice'] ?? response.data;
      return _parseInvoice(Map<String, dynamic>.from(data));
    } catch (e) {
      rethrow;
    }
  }

  Future<Invoice> updateInvoice(String id, CreateInvoiceRequest request) async {
    try {
      final defaultAccountId = await _getDefaultIncomeAccountId();
      final body = request.toJson();
      final items = body['items'] as List<dynamic>? ?? [];
      final itemsWithAccount = items.map<Map<String, dynamic>>((e) {
        final map = Map<String, dynamic>.from(e as Map);
        map['accountId'] = defaultAccountId;
        return map;
      }).toList();
      body['items'] = itemsWithAccount;

      final response = await _dio.put('/api/invoices/$id', data: body);
      final Map<String, dynamic> data =
          response.data['invoice'] ?? response.data;
      return _parseInvoice(Map<String, dynamic>.from(data));
    } catch (e) {
      rethrow;
    }
  }

  Future<void> updateInvoiceStatus(String id, String status) async {
    try {
      await _dio.patch('/api/invoices/$id/status', data: {'status': status});
    } catch (e) {
      rethrow;
    }
  }

  Future<InvoiceStatistics> fetchStatistics({String? dateFrom, String? dateTo}) async {
    try {
      final response = await _dio.get(
        '/api/invoices/statistics',
        queryParameters: <String, dynamic>{
          ...?(dateFrom != null && dateFrom.isNotEmpty)
              ? {'dateFrom': dateFrom}
              : null,
          ...?(dateTo != null && dateTo.isNotEmpty) ? {'dateTo': dateTo} : null,
        },
      );
      final raw = response.data;
      if (raw == null || raw is! Map) {
        return const InvoiceStatistics(
          paid: InvoiceStatBucket(),
          pending: InvoiceStatBucket(),
          overdue: InvoiceStatBucket(),
          partial: InvoiceStatBucket(),
          draft: InvoiceStatBucket(),
        );
      }
      final data = Map<String, dynamic>.from(raw);
      return InvoiceStatistics(
        paid: _parseStatBucket(data['paid']),
        pending: _parseStatBucket(data['pending']),
        overdue: _parseStatBucket(data['overdue']),
        partial: _parseStatBucket(data['partial']),
        draft: _parseStatBucket(data['draft']),
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<void> deleteInvoice(String id) async {
    try {
      await _dio.delete('/api/invoices/$id');
    } catch (e) {
      rethrow;
    }
  }

  Future<void> voidInvoice(String id, String reason) async {
    try {
      await _dio.post(
        '/api/invoices/void',
        data: {'invoiceId': id, 'reason': reason},
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<void> refundInvoice({
    required String invoiceId,
    required double refundAmount,
    required String refundReason,
    required String refundMethod,
    String? notes,
  }) async {
    try {
      await _dio.post(
        '/api/invoices/refund',
        data: {
          'invoiceId': invoiceId,
          'refundAmount': refundAmount,
          'refundReason': refundReason,
          'refundMethod': refundMethod,
          ...?notes != null ? {'notes': notes} : null,
        },
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<void> addPartialPayment({
    required String invoiceId,
    required double amount,
    required String paymentMethod,
    String? paymentDate,
    String? reference,
    String? notes,
  }) async {
    try {
      await _dio.post(
        '/api/invoices/partial-payment',
        data: {
          'invoiceId': invoiceId,
          'amount': amount,
          'paymentMethod': paymentMethod,
          ...?paymentDate != null ? {'paymentDate': paymentDate} : null,
          ...?reference != null ? {'reference': reference} : null,
          ...?notes != null ? {'notes': notes} : null,
        },
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<void> markAsPaid(String id, String paymentMethod) async {
    try {
      await _dio.post(
        '/api/invoices/$id/mark-paid',
        data: {'paymentMethod': paymentMethod},
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<void> sendInvoice(String invoiceId, {String? message}) async {
    try {
      await _dio.post(
        '/api/invoices/$invoiceId/send',
        data: <String, dynamic>{
          if (message != null && message.isNotEmpty) 'message': message,
        },
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<List<int>> downloadInvoicePdf(String invoiceId) async {
    try {
      final response = await _dio.get(
        '/api/invoices/$invoiceId/download',
        options: Options(responseType: ResponseType.bytes),
      );
      return response.data as List<int>;
    } catch (e) {
      rethrow;
    }
  }

  Future<List<InvoicePayment>> fetchPaymentHistory(String invoiceId) async {
    try {
      final response = await _dio.get(
        '/api/invoices/partial-payment',
        queryParameters: {'invoiceId': invoiceId},
      );
      final List paymentsJson = response.data['payments'] ?? [];
      return paymentsJson
          .map(
            (json) => InvoicePayment.fromJson(Map<String, dynamic>.from(json)),
          )
          .toList();
    } catch (e) {
      rethrow;
    }
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

  Future<List<int>> exportInvoices({
    String? status,
    String? search,
    String? dateFrom,
    String? dateTo,
    String? clientId,
    String format = 'csv',
  }) async {
    try {
      final response = await _dio.get(
        '/api/invoices/export',
        queryParameters: <String, dynamic>{
          'format': format,
          ...?(status != null && status.isNotEmpty) ? {'status': status} : null,
          ...?(search != null && search.isNotEmpty) ? {'search': search} : null,
          ...?(dateFrom != null && dateFrom.isNotEmpty)
              ? {'dateFrom': dateFrom}
              : null,
          ...?(dateTo != null && dateTo.isNotEmpty) ? {'dateTo': dateTo} : null,
          ...?(clientId != null && clientId.isNotEmpty)
              ? {'client': clientId}
              : null,
        },
        options: Options(responseType: ResponseType.bytes),
      );
      return response.data as List<int>;
    } catch (e) {
      rethrow;
    }
  }

  // —— Private helpers ——

  Invoice _parseInvoice(Map<String, dynamic> data) {
    data['subtotal'] = _toDouble(data['subtotal']);
    data['totalTax'] = _toDouble(data['totalTax'] ?? data['taxAmount'] ?? 0);
    data['totalDiscount'] = _toDouble(
      data['totalDiscount'] ?? data['totalDiscountAmount'] ?? 0,
    );
    data['total'] = _toDouble(data['total']);
    data['totalPaid'] = _toDouble(data['totalPaid']);
    data['remainingBalance'] = _toDouble(data['remainingBalance']);
    data['amountDue'] = _toDouble(data['amountDue']);

    // Normalize date fields
    if (data['issueDate'] != null && data['issueDate'] is String) {
      data['issueDate'] = data['issueDate'];
    }

    // Normalize items
    if (data['items'] != null) {
      data['items'] = (data['items'] as List).map((i) {
        final Map<String, dynamic> item = Map<String, dynamic>.from(i);
        item['quantity'] = _toDouble(item['quantity']);
        item['unitPrice'] = _toDouble(item['unitPrice']);
        item['taxRate'] = _toDouble(item['taxRate']);
        item['taxAmount'] = _toDouble(item['taxAmount'] ?? 0);
        item['discount'] = _toDouble(
          item['discount'] ?? item['discountAmount'] ?? 0,
        );
        item['total'] = _toDouble(item['total'] ?? item['amount'] ?? 0);

        // Ensure product exists for InvoiceItem
        if (item['product'] == null) {
          item['product'] = {
            'id': item['productId'] ?? '',
            'name': item['description'] ?? 'Item',
            'price': _toDouble(item['unitPrice']),
          };
        }

        // Ensure id exists
        item['id'] = item['id'] ?? '';

        return item;
      }).toList();
    } else {
      data['items'] = [];
    }

    // Normalize payments
    if (data['payments'] != null) {
      data['payments'] = (data['payments'] as List).map((p) {
        final Map<String, dynamic> payment = Map<String, dynamic>.from(p);
        payment['amount'] = _toDouble(payment['amount']);
        payment['id'] = payment['id'] ?? '';
        payment['paymentMethod'] = payment['paymentMethod'] ?? 'cash';
        return payment;
      }).toList();
    } else {
      data['payments'] = [];
    }

    // Normalize client
    if (data['client'] == null) {
      data['client'] = {'id': data['clientId'] ?? '', 'name': 'Unknown'};
    }

    return Invoice.fromJson(data);
  }

  InvoiceStatBucket _parseStatBucket(dynamic raw) {
    if (raw == null) return const InvoiceStatBucket();
    final data = Map<String, dynamic>.from(raw);
    return InvoiceStatBucket(
      count: (data['count'] is int)
          ? data['count']
          : int.tryParse(data['count']?.toString() ?? '0') ?? 0,
      amount: _toDouble(data['amount']),
    );
  }

  double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }

  String _mapSortField(String sortBy) {
    switch (sortBy) {
      case 'date':
      case 'createdAt':
        return 'issueDate';
      case 'client':
      case 'clientName':
        return 'clientName';
      default:
        return sortBy;
    }
  }
}
