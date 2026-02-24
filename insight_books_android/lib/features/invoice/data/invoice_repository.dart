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

      print('DEBUG: Invoices API response: ${response.data}');

      final List invoicesJson =
          response.data['invoices'] ?? response.data['data'] ?? [];
      print('DEBUG: Parsed invoices list length: ${invoicesJson.length}');
      return invoicesJson.map((json) {
        final Map<String, dynamic> data = Map<String, dynamic>.from(json);

        // Ensure numerical fields are doubles
        data['subtotal'] = _toDouble(data['subtotal']);
        data['totalTax'] = _toDouble(data['totalTax']);
        data['totalDiscount'] = _toDouble(data['totalDiscount']);
        data['total'] = _toDouble(data['total']);

        if (data['items'] != null) {
          data['items'] = (data['items'] as List).map((i) {
            final Map<String, dynamic> item = Map<String, dynamic>.from(i);
            item['quantity'] = _toDouble(item['quantity']);
            item['unitPrice'] = _toDouble(item['unitPrice']);
            item['taxRate'] = _toDouble(item['taxRate']);
            item['taxAmount'] = _toDouble(item['taxAmount']);
            item['discount'] = _toDouble(item['discount']);
            item['total'] = _toDouble(item['total']);
            return item;
          }).toList();
        }

        return Invoice.fromJson(data);
      }).toList();
    } catch (e) {
      rethrow;
    }
  }

  Future<Invoice> fetchInvoiceById(String id) async {
    try {
      final response = await _dio.get('/api/invoices/$id');
      final Map<String, dynamic> data =
          response.data['invoice'] ?? response.data;

      data['subtotal'] = _toDouble(data['subtotal']);
      data['totalTax'] = _toDouble(data['totalTax']);
      data['totalDiscount'] = _toDouble(data['totalDiscount']);
      data['total'] = _toDouble(data['total']);

      if (data['items'] != null) {
        data['items'] = (data['items'] as List).map((i) {
          final Map<String, dynamic> item = Map<String, dynamic>.from(i);
          item['quantity'] = _toDouble(item['quantity']);
          item['unitPrice'] = _toDouble(item['unitPrice']);
          item['taxRate'] = _toDouble(item['taxRate']);
          item['taxAmount'] = _toDouble(item['taxAmount']);
          item['discount'] = _toDouble(item['discount']);
          item['total'] = _toDouble(item['total']);
          return item;
        }).toList();
      }

      return Invoice.fromJson(data);
    } catch (e) {
      rethrow;
    }
  }

  Future<Invoice> createInvoice(CreateInvoiceRequest request) async {
    try {
      final response = await _dio.post('/api/invoices', data: request.toJson());
      final Map<String, dynamic> data =
          response.data['invoice'] ?? response.data;
      return Invoice.fromJson(data);
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

  double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }
}
