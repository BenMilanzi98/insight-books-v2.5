import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/pdf_bytes.dart';
import '../domain/quotation_model.dart';

final quotationRepositoryProvider = Provider<QuotationRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return QuotationRepository(dio);
});

class QuotationRepository {
  final Dio _dio;

  QuotationRepository(this._dio);

  Future<QuotationListResponse> fetchQuotations({
    int page = 1,
    int limit = 20,
    String? sortBy,
    String? sortOrder,
    String? status,
    String? search,
    String? dateFrom,
    String? dateTo,
    String? clientId,
  }) async {
    try {
      final response = await _dio.get(
        '/api/quotations',
        queryParameters: <String, dynamic>{
          'page': page,
          'limit': limit,
          ...? sortBy != null ? {'sortBy': _mapSortField(sortBy)} : null,
          ...? sortOrder != null ? {'sortOrder': sortOrder} : null,
          ...? (status != null && status != 'all') ? {'status': status} : null,
          ...? (search != null && search.isNotEmpty) ? {'search': search} : null,
          ...? dateFrom != null ? {'dateFrom': dateFrom} : null,
          ...? dateTo != null ? {'dateTo': dateTo} : null,
          ...? clientId != null ? {'clientId': clientId} : null,
        },
      );
      final data = response.data as Map<String, dynamic>;
      final list = data['quotations'] as List<dynamic>? ?? [];
      final pagination = data['pagination'] as Map<String, dynamic>?;
      final quotations = list
          .map((e) => Quotation.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      return QuotationListResponse(
        quotations: quotations,
        totalPages: (pagination?['totalPages'] as num?)?.toInt() ?? 1,
        totalCount: (pagination?['totalCount'] as num?)?.toInt() ?? 0,
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<Quotation> fetchQuotationById(String id) async {
    try {
      final response = await _dio.get('/api/quotations/$id');
      final data = response.data is Map<String, dynamic>
          ? response.data as Map<String, dynamic>
          : Map<String, dynamic>.from(response.data as Map);
      return Quotation.fromJson(_normalizeQuotationJson(data));
    } catch (e) {
      rethrow;
    }
  }

  Future<Quotation> createQuotation(CreateQuotationRequest request) async {
    try {
      final response = await _dio.post(
        '/api/quotations',
        data: request.toJson(),
      );
      final data = response.data as Map<String, dynamic>;
      final quotationData = data['quotation'] as Map<String, dynamic>? ?? data;
      return Quotation.fromJson(_normalizeQuotationJson(quotationData));
    } catch (e) {
      rethrow;
    }
  }

  Future<Quotation> updateQuotation(String id, CreateQuotationRequest request) async {
    try {
      final response = await _dio.put(
        '/api/quotations/$id',
        data: request.toJson(),
      );
      final data = response.data as Map<String, dynamic>;
      final quotationData = data['quotation'] as Map<String, dynamic>? ?? data;
      return Quotation.fromJson(_normalizeQuotationJson(quotationData));
    } catch (e) {
      rethrow;
    }
  }

  Future<void> deleteQuotation(String id) async {
    try {
      await _dio.delete('/api/quotations/$id');
    } catch (e) {
      rethrow;
    }
  }

  Future<Quotation> duplicateQuotation(String id) async {
    try {
      final response = await _dio.post('/api/quotations/$id/duplicate');
      final data = response.data as Map<String, dynamic>;
      final quotationData = data['quotation'] as Map<String, dynamic>? ?? data;
      return Quotation.fromJson(_normalizeQuotationJson(quotationData));
    } catch (e) {
      rethrow;
    }
  }

  Future<ConvertToInvoiceResult> convertToInvoice(String quotationId) async {
    try {
      final response = await _dio.post('/api/quotations/$quotationId/convert');
      final data = response.data as Map<String, dynamic>;
      return ConvertToInvoiceResult(
        invoiceId: data['invoiceId'] as String? ?? '',
        invoiceNumber: data['invoiceNumber'] as String? ?? '',
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<void> sendQuotation(String quotationId, {String? message}) async {
    try {
      await _dio.post(
        '/api/quotations/$quotationId/send',
        data: {'message': message ?? '', 'otherEmails': []},
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<void> sendQuotationAdvanced(
    String quotationId, {
    String? message,
    List<String> otherEmails = const [],
    List<String> attachmentPaths = const [],
  }) async {
    try {
      if (attachmentPaths.isEmpty) {
        await _dio.post(
          '/api/quotations/$quotationId/send',
          data: <String, dynamic>{
            'message': message ?? '',
            'otherEmails': otherEmails,
          },
        );
        return;
      }
      final formData = FormData.fromMap({
        'message': message ?? '',
        'otherEmails': otherEmails,
        'attachments': [
          for (final path in attachmentPaths)
            await MultipartFile.fromFile(path),
        ],
      });
      await _dio.post('/api/quotations/$quotationId/send', data: formData);
    } catch (e) {
      rethrow;
    }
  }

  Future<List<int>> downloadQuotationPdf(String quotationId) async {
    try {
      final response = await _dio.get(
        '/api/quotations/$quotationId/download/pdf',
        options: Options(
          responseType: ResponseType.bytes,
          validateStatus: (_) => true,
        ),
      );
      final code = response.statusCode ?? 0;
      if (code < 200 || code >= 300) {
        final raw = bytesFromDioResponse(response.data, label: 'Quotation');
        final preview = previewNonPdfBytes(raw);
        if (kDebugMode && preview.isNotEmpty) {
          debugPrint('Quotation PDF error body (HTTP $code): $preview');
        }
        throw Exception(
          'Quotation PDF download failed (HTTP $code). ${preview.isEmpty ? '' : 'Server said: $preview'}',
        );
      }
      return requirePdfBytesFromResponse(response.data, label: 'Quotation');
    } catch (e) {
      rethrow;
    }
  }

  Future<QuotationStatistics> fetchStatistics({String? dateFrom, String? dateTo}) async {
    try {
      final response = await _dio.get(
        '/api/quotations/statistics',
        queryParameters: <String, dynamic>{
          ...? (dateFrom != null && dateFrom.isNotEmpty) ? {'dateFrom': dateFrom} : null,
          ...? (dateTo != null && dateTo.isNotEmpty) ? {'dateTo': dateTo} : null,
        },
      );
      final data = Map<String, dynamic>.from(response.data as Map);
      return QuotationStatistics.fromJson(data);
    } catch (e) {
      rethrow;
    }
  }

  Future<List<int>> exportQuotations({
    String? status,
    String? search,
    String? dateFrom,
    String? dateTo,
    String? clientId,
    String format = 'csv',
  }) async {
    try {
      final response = await _dio.get(
        '/api/quotations/export',
        queryParameters: <String, dynamic>{
          'format': format,
          ...? (status != null && status.isNotEmpty) ? {'status': status} : null,
          ...? (search != null && search.isNotEmpty) ? {'search': search} : null,
          ...? (dateFrom != null && dateFrom.isNotEmpty) ? {'dateFrom': dateFrom} : null,
          ...? (dateTo != null && dateTo.isNotEmpty) ? {'dateTo': dateTo} : null,
          ...? (clientId != null && clientId.isNotEmpty) ? {'clientId': clientId} : null,
        },
        options: Options(responseType: ResponseType.bytes),
      );
      return response.data as List<int>;
    } catch (e) {
      rethrow;
    }
  }

  Map<String, dynamic> _normalizeQuotationJson(Map<String, dynamic> data) {
    data['amount'] = _toDouble(data['amount']);
    data['discount'] = _toDouble(data['discount']);
    data['subtotal'] = _toDouble(data['subtotal']);
    data['taxAmount'] = _toDouble(data['taxAmount']);
    final items = data['items'] as List<dynamic>? ?? [];
    data['items'] = items.map((e) {
      final item = Map<String, dynamic>.from(e as Map);
      item['quantity'] = _toDouble(item['quantity']);
      item['unitPrice'] = _toDouble(item['unitPrice']);
      item['taxRate'] = _toDouble(item['taxRate']);
      item['discountAmount'] = _toDouble(item['discountAmount']);
      item['amount'] = _toDouble(item['amount']);
      item['id'] = item['id'] ?? '';
      return item;
    }).toList();
    return data;
  }

  double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value.replaceAll(',', '')) ?? 0.0;
    return 0.0;
  }

  String _mapSortField(String sortBy) {
    switch (sortBy) {
      case 'amount':
        return 'amount';
      case 'clientName':
        return 'clientName';
      case 'validUntil':
        return 'validUntil';
      case 'date':
      default:
        return 'date';
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
}

class QuotationListResponse {
  final List<Quotation> quotations;
  final int totalPages;
  final int totalCount;
  QuotationListResponse({
    required this.quotations,
    required this.totalPages,
    required this.totalCount,
  });
}

class ConvertToInvoiceResult {
  final String invoiceId;
  final String invoiceNumber;
  ConvertToInvoiceResult({required this.invoiceId, required this.invoiceNumber});
}
