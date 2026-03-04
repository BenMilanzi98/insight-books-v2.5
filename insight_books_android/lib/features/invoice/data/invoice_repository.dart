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

  Future<List<Invoice>> fetchInvoices({String? search, String? status}) async {
    try {
      final response = await _dio.get(
        '/api/invoices',
        queryParameters: {
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null && status != 'all' && status.isNotEmpty)
            'status': status,
        },
      );

      final List invoicesJson =
          response.data['invoices'] ?? response.data['data'] ?? [];
      return invoicesJson.map((json) {
        return _parseInvoice(Map<String, dynamic>.from(json));
      }).toList();
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

  Future<Invoice> createInvoice(CreateInvoiceRequest request) async {
    try {
      final response = await _dio.post('/api/invoices', data: request.toJson());
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

  Future<InvoiceStatistics> fetchStatistics() async {
    try {
      final response = await _dio.get('/api/invoices/statistics');
      final data = Map<String, dynamic>.from(response.data);

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
          ...? notes != null ? {'notes': notes} : null,
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
          ...? paymentDate != null ? {'paymentDate': paymentDate} : null,
          ...? reference != null ? {'reference': reference} : null,
          ...? notes != null ? {'notes': notes} : null,
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
}
