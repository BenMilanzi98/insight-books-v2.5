import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/expense_model.dart';

final expenseRepositoryProvider = Provider<ExpenseRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return ExpenseRepository(dio);
});

class ExpenseRepository {
  final Dio _dio;

  ExpenseRepository(this._dio);

  /// GET /api/expenses with filters and pagination
  Future<ExpenseListResponse> fetchExpenses({
    int page = 1,
    int limit = 10,
    String? sortBy,
    String? sortOrder,
    String? status,
    String? category,
    String? accountId,
    String? search,
    String? dateFrom,
    String? dateTo,
    String? branchId,
    bool includeDeleted = false,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
        ...? sortBy != null ? {'sortBy': sortBy} : null,
        ...? sortOrder != null ? {'sortOrder': sortOrder} : null,
        ...? status != null && status != 'all' ? {'status': status} : null,
        ...? category != null && category != 'all' ? {'category': category} : null,
        ...? accountId != null && accountId != 'all' ? {'accountId': accountId} : null,
        ...? search != null && search.isNotEmpty ? {'search': search} : null,
        ...? dateFrom != null ? {'dateFrom': dateFrom} : null,
        ...? dateTo != null ? {'dateTo': dateTo} : null,
        ...? branchId != null ? {'branchId': branchId} : null,
        if (includeDeleted) 'includeDeleted': 'true',
      };

      final response = await _dio.get('/api/expenses', queryParameters: queryParams);
      final data = response.data;
      if (data == null || data is! Map) {
        return ExpenseListResponse(expenses: [], page: 1, limit: limit, totalCount: 0, totalPages: 0);
      }

      final rawList = data['expenses'] as List<dynamic>? ?? [];
      final List<Expense> expenses = [];
      for (final e in rawList) {
        try {
          expenses.add(Expense.fromJson(Map<String, dynamic>.from(e as Map)));
        } catch (_) {
          continue;
        }
      }

      final pag = data['pagination'] as Map<String, dynamic>? ?? {};
      final totalCount = (pag['totalCount'] as num?)?.toInt() ?? expenses.length;
      final totalPages = (pag['totalPages'] as num?)?.toInt() ?? 1;

      return ExpenseListResponse(
        expenses: expenses,
        page: (pag['page'] as num?)?.toInt() ?? page,
        limit: (pag['limit'] as num?)?.toInt() ?? limit,
        totalCount: totalCount,
        totalPages: totalPages,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/expenses/deleted
  Future<ExpenseListResponse> fetchDeletedExpenses({
    int page = 1,
    int limit = 20,
    String? search,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
        ...? search != null && search.isNotEmpty ? {'search': search} : null,
      };
      final response = await _dio.get('/api/expenses/deleted', queryParameters: queryParams);
      final data = response.data;
      if (data == null || data is! Map) {
        return ExpenseListResponse(expenses: [], page: 1, limit: limit, totalCount: 0, totalPages: 0);
      }

      final rawList = data['expenses'] as List<dynamic>? ?? [];
      final List<Expense> expenses = [];
      for (final e in rawList) {
        try {
          final map = Map<String, dynamic>.from(e as Map);
          map['id'] = map['id'] ?? '';
          map['description'] = map['description'] ?? '';
          map['amount'] = map['rawAmount'] ?? map['amount'] ?? 0;
          map['date'] = map['date'] ?? '';
          map['category'] = map['category'] ?? '';
          map['status'] = map['status'] ?? 'Pending';
          map['deletedAt'] = map['deletedAt']?.toString();
          map['deletionReason'] = map['deletionReason'];
          expenses.add(Expense.fromJson(map));
        } catch (_) {
          continue;
        }
      }

      final pag = data['pagination'] as Map<String, dynamic>? ?? {};
      return ExpenseListResponse(
        expenses: expenses,
        page: (pag['page'] as num?)?.toInt() ?? page,
        limit: (pag['limit'] as num?)?.toInt() ?? limit,
        totalCount: (pag['total'] as num?)?.toInt() ?? expenses.length,
        totalPages: (pag['pages'] as num?)?.toInt() ?? 1,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/expenses/:id
  Future<Expense> fetchExpenseById(String id) async {
    try {
      final response = await _dio.get('/api/expenses/$id');
      final data = response.data;
      final map = data is Map<String, dynamic> ? data : Map<String, dynamic>.from(data as Map);
      return Expense.fromJson(map);
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/expenses
  Future<Expense> createExpense(CreateExpenseRequest request) async {
    try {
      final response = await _dio.post('/api/expenses', data: request.toJson());
      final raw = response.data;
      final map = raw is Map && raw['expense'] != null
          ? Map<String, dynamic>.from(raw['expense'] as Map)
          : Map<String, dynamic>.from(raw as Map);
      return Expense.fromJson(map);
    } catch (e) {
      rethrow;
    }
  }

  /// PUT /api/expenses/:id
  Future<Expense> updateExpense(String id, UpdateExpenseRequest request) async {
    try {
      final response = await _dio.put('/api/expenses/$id', data: request.toJson());
      final raw = response.data;
      final map = raw is Map && raw['expense'] != null
          ? Map<String, dynamic>.from(raw['expense'] as Map)
          : Map<String, dynamic>.from(raw as Map);
      return Expense.fromJson(map);
    } catch (e) {
      rethrow;
    }
  }

  /// DELETE /api/expenses/:id with optional reason
  Future<void> deleteExpense(String id, {String? reason}) async {
    try {
      await _dio.delete(
        '/api/expenses/$id',
        data: reason != null ? {'reason': reason} : null,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/expenses/restore
  Future<Expense> restoreExpense(String expenseId, {String? reason}) async {
    try {
      final response = await _dio.post(
        '/api/expenses/restore',
        data: {'expenseId': expenseId, ...? reason != null ? {'reason': reason} : null},
      );
      final raw = response.data;
      final map = raw is Map && raw['expense'] != null
          ? Map<String, dynamic>.from(raw['expense'] as Map)
          : Map<String, dynamic>.from(raw as Map);
      return Expense.fromJson(map);
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/expenses/batch-delete
  Future<void> batchDeleteExpenses(List<String> expenseIds, {String? reason}) async {
    try {
      await _dio.post(
        '/api/expenses/batch-delete',
        data: {'expenseIds': expenseIds, ...? reason != null ? {'reason': reason} : null},
      );
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/expenses/statistics
  Future<ExpenseStatistics> fetchStatistics({String? dateFrom, String? dateTo}) async {
    try {
      final queryParams = <String, dynamic>{
        ...? dateFrom != null ? {'dateFrom': dateFrom} : null,
        ...? dateTo != null ? {'dateTo': dateTo} : null,
      };
      final response = await _dio.get(
        '/api/expenses/statistics',
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );
      final data = response.data;
      if (data == null || data is! Map) {
        return const ExpenseStatistics(
          total: ExpenseStatBucket(),
          approved: ExpenseStatBucket(),
          pending: ExpenseStatBucket(),
          rejected: ExpenseStatBucket(),
        );
      }
      return ExpenseStatistics.fromJson(Map<String, dynamic>.from(data));
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/payment-accounts?activeOnly=true — for Source of Funds dropdown
  Future<List<PaymentAccountOption>> fetchPaymentAccounts() async {
    try {
      final response = await _dio.get(
        '/api/payment-accounts',
        queryParameters: {'activeOnly': 'true'},
      );
      final data = response.data;
      if (data == null || data is! Map) return [];
      final list = data['paymentAccounts'] as List<dynamic>? ?? [];
      return list
          .map((e) =>
              PaymentAccountOption.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/categories?type=expense — expense categories for filter and form
  Future<List<ExpenseCategoryOption>> fetchExpenseCategories() async {
    try {
      final response = await _dio.get('/api/categories', queryParameters: {'type': 'expense'});
      final data = response.data;
      if (data == null || data is! Map) return [];
      final list = data['categories'] as List<dynamic>? ?? [];
      return list
          .map((e) => ExpenseCategoryOption.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/expenses/partial-payment
  Future<void> addPartialPayment(AddPartialPaymentRequest request) async {
    try {
      await _dio.post('/api/expenses/partial-payment', data: request.toJson());
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/expenses/partial-payment?expenseId=...
  Future<PartialPaymentHistoryResponse> fetchPartialPaymentHistory(String expenseId) async {
    try {
      final response = await _dio.get(
        '/api/expenses/partial-payment',
        queryParameters: {'expenseId': expenseId},
      );
      final data = response.data;
      if (data == null || data is! Map) {
        return PartialPaymentHistoryResponse(payments: [], expense: null);
      }
      final map = Map<String, dynamic>.from(data);
      final paymentsList = map['payments'] as List<dynamic>? ?? [];
      final payments = paymentsList
          .map((e) => ExpensePayment.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      Expense? expense;
      if (map['expense'] != null) {
        expense = Expense.fromJson(Map<String, dynamic>.from(map['expense'] as Map));
      }
      return PartialPaymentHistoryResponse(payments: payments, expense: expense);
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/expenses/:id/attachments
  Future<List<ExpenseAttachment>> fetchAttachments(String expenseId) async {
    try {
      final response = await _dio.get('/api/expenses/$expenseId/attachments');
      final data = response.data;
      if (data == null || data is! Map) return [];
      final list = data['attachments'] as List<dynamic>? ?? [];
      return list
          .map((e) =>
              ExpenseAttachment.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (e) {
      rethrow;
    }
  }

  /// POST /api/expenses/:id/attachments — upload one or more files (key: file)
  Future<List<ExpenseAttachment>> uploadAttachments(
    String expenseId,
    List<File> files,
  ) async {
    try {
      final formData = FormData();
      for (final file in files) {
        final name = file.path.split(RegExp(r'[/\\]')).last;
        formData.files.add(MapEntry(
          'file',
          await MultipartFile.fromFile(file.path, filename: name),
        ));
      }
      final response = await _dio.post(
        '/api/expenses/$expenseId/attachments',
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
          sendTimeout: const Duration(seconds: 60),
        ),
      );
      final data = response.data;
      if (data == null || data is! Map) return [];
      final list = data['attachments'] as List<dynamic>? ?? [];
      return list
          .map((e) =>
              ExpenseAttachment.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (e) {
      rethrow;
    }
  }

  /// DELETE /api/expenses/:id/attachments/:attachmentId
  Future<void> deleteAttachment(String expenseId, String attachmentId) async {
    try {
      await _dio.delete(
          '/api/expenses/$expenseId/attachments/$attachmentId');
    } catch (e) {
      rethrow;
    }
  }

  /// GET /api/expenses/export?format=csv&... — returns CSV bytes
  Future<List<int>> exportExpensesCsv({
    String? status,
    String? category,
    String? accountId,
    String? search,
    String? dateFrom,
    String? dateTo,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'format': 'csv',
        ...? status != null && status != 'all' ? {'status': status} : null,
        ...? category != null && category != 'all' ? {'category': category} : null,
        ...? accountId != null && accountId != 'all' ? {'accountId': accountId} : null,
        ...? search != null && search.isNotEmpty ? {'search': search} : null,
        ...? dateFrom != null ? {'dateFrom': dateFrom} : null,
        ...? dateTo != null ? {'dateTo': dateTo} : null,
      };
      final response = await _dio.get<dynamic>(
        '/api/expenses/export',
        queryParameters: queryParams,
        options: Options(responseType: ResponseType.bytes),
      );
      if (response.data == null) return [];
      if (response.data is List<int>) return response.data as List<int>;
      if (response.data is String) {
        return response.data.toString().codeUnits;
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }
}

class ExpenseListResponse {
  const ExpenseListResponse({
    required this.expenses,
    required this.page,
    required this.limit,
    required this.totalCount,
    required this.totalPages,
  });

  final List<Expense> expenses;
  final int page;
  final int limit;
  final int totalCount;
  final int totalPages;
}

class PartialPaymentHistoryResponse {
  const PartialPaymentHistoryResponse({
    required this.payments,
    this.expense,
  });

  final List<ExpensePayment> payments;
  final Expense? expense;
}
