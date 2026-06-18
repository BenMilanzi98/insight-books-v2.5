import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:io';

import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import '../../data/expense_repository.dart';
import '../../domain/expense_model.dart';

String? _parseDefaultOutflowTaxId(Map<String, dynamic>? d) {
  if (d == null) return null;
  final direct = d['outflowTaxTypeId'] ?? d['defaultOutflowTaxTypeId'];
  if (direct != null) return direct.toString();
  final nested = d['defaultTaxTypeForOutflow'];
  if (nested is Map && nested['id'] != null) return nested['id'].toString();
  return null;
}

List<Map<String, dynamic>> _dedupeTaxTypesById(List<Map<String, dynamic>> raw) {
  final seen = <String>{};
  final out = <Map<String, dynamic>>[];
  for (final t in raw) {
    final id = '${t['id'] ?? ''}';
    if (id.isEmpty || !seen.add(id)) continue;
    out.add(t);
  }
  return out;
}

List<ExpenseCategoryOption> _dedupeCategoriesById(List<ExpenseCategoryOption> raw) {
  final seen = <String>{};
  final out = <ExpenseCategoryOption>[];
  for (final c in raw) {
    if (c.id.isEmpty || !seen.add(c.id)) continue;
    out.add(c);
  }
  return out;
}

class ExpensePageState {
  const ExpensePageState({
    this.expenses = const [],
    this.statistics,
    this.categories = const [],
    this.paymentAccounts = const [],
    this.suppliers = const [],
    this.branches = const [],
    this.isLoading = false,
    this.isStatsLoading = false,
    this.isCategoriesLoading = false,
    this.error,
    this.searchQuery = '',
    this.statusFilter = 'all',
    this.categoryFilter = 'all',
    this.showDeleted = false,
    this.totalPages = 1,
    this.currentPage = 1,
    this.totalCount = 0,
    this.dateFrom,
    this.dateTo,
    this.selectedExpenseIds = const [],
    this.branchId,
    this.recurringExpenses = const [],
    this.cogsSummary,
    this.cogsSettlements = const [],
    this.historicalUploadMessage,
    this.canViewExpenses = true,
    this.canCreateExpenses = true,
    this.canUpdateExpenses = true,
    this.canDeleteExpenses = true,
    this.canExportExpenses = true,
    this.canApproveExpenses = true,
    this.taxTypes = const [],
    this.taxAccounts = const [],
    this.defaultOutflowTaxTypeId,
  });

  final List<Expense> expenses;
  final ExpenseStatistics? statistics;
  final List<ExpenseCategoryOption> categories;
  final List<PaymentAccountOption> paymentAccounts;
  final List<SupplierOption> suppliers;
  final List<BranchOption> branches;
  final bool isLoading;
  final bool isStatsLoading;
  final bool isCategoriesLoading;
  final String? error;
  final String searchQuery;
  final String statusFilter;
  final String categoryFilter;
  final bool showDeleted;
  final int totalPages;
  final int currentPage;
  final int totalCount;
  final String? dateFrom;
  final String? dateTo;
  final List<String> selectedExpenseIds;
  final String? branchId;
  final List<Map<String, dynamic>> recurringExpenses;
  final Map<String, dynamic>? cogsSummary;
  final List<Map<String, dynamic>> cogsSettlements;
  final String? historicalUploadMessage;
  final bool canViewExpenses;
  final bool canCreateExpenses;
  final bool canUpdateExpenses;
  final bool canDeleteExpenses;
  final bool canExportExpenses;
  final bool canApproveExpenses;
  final List<Map<String, dynamic>> taxTypes;
  final List<Map<String, dynamic>> taxAccounts;
  final String? defaultOutflowTaxTypeId;

  ExpensePageState copyWith({
    List<Expense>? expenses,
    ExpenseStatistics? statistics,
    List<ExpenseCategoryOption>? categories,
    List<PaymentAccountOption>? paymentAccounts,
    List<SupplierOption>? suppliers,
    List<BranchOption>? branches,
    bool? isLoading,
    bool? isStatsLoading,
    bool? isCategoriesLoading,
    String? error,
    String? searchQuery,
    String? statusFilter,
    String? categoryFilter,
    bool? showDeleted,
    int? totalPages,
    int? currentPage,
    int? totalCount,
    String? dateFrom,
    String? dateTo,
    List<String>? selectedExpenseIds,
    String? branchId,
    List<Map<String, dynamic>>? recurringExpenses,
    Map<String, dynamic>? cogsSummary,
    List<Map<String, dynamic>>? cogsSettlements,
    String? historicalUploadMessage,
    bool? canViewExpenses,
    bool? canCreateExpenses,
    bool? canUpdateExpenses,
    bool? canDeleteExpenses,
    bool? canExportExpenses,
    bool? canApproveExpenses,
    List<Map<String, dynamic>>? taxTypes,
    List<Map<String, dynamic>>? taxAccounts,
    String? defaultOutflowTaxTypeId,
  }) {
    return ExpensePageState(
      expenses: expenses ?? this.expenses,
      statistics: statistics ?? this.statistics,
      categories: categories ?? this.categories,
      paymentAccounts: paymentAccounts ?? this.paymentAccounts,
      suppliers: suppliers ?? this.suppliers,
      branches: branches ?? this.branches,
      isLoading: isLoading ?? this.isLoading,
      isStatsLoading: isStatsLoading ?? this.isStatsLoading,
      isCategoriesLoading: isCategoriesLoading ?? this.isCategoriesLoading,
      error: error,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      categoryFilter: categoryFilter ?? this.categoryFilter,
      showDeleted: showDeleted ?? this.showDeleted,
      totalPages: totalPages ?? this.totalPages,
      currentPage: currentPage ?? this.currentPage,
      totalCount: totalCount ?? this.totalCount,
      dateFrom: dateFrom ?? this.dateFrom,
      dateTo: dateTo ?? this.dateTo,
      selectedExpenseIds: selectedExpenseIds ?? this.selectedExpenseIds,
      branchId: branchId ?? this.branchId,
      recurringExpenses: recurringExpenses ?? this.recurringExpenses,
      cogsSummary: cogsSummary ?? this.cogsSummary,
      cogsSettlements: cogsSettlements ?? this.cogsSettlements,
      historicalUploadMessage: historicalUploadMessage ?? this.historicalUploadMessage,
      canViewExpenses: canViewExpenses ?? this.canViewExpenses,
      canCreateExpenses: canCreateExpenses ?? this.canCreateExpenses,
      canUpdateExpenses: canUpdateExpenses ?? this.canUpdateExpenses,
      canDeleteExpenses: canDeleteExpenses ?? this.canDeleteExpenses,
      canExportExpenses: canExportExpenses ?? this.canExportExpenses,
      canApproveExpenses: canApproveExpenses ?? this.canApproveExpenses,
      taxTypes: taxTypes ?? this.taxTypes,
      taxAccounts: taxAccounts ?? this.taxAccounts,
      defaultOutflowTaxTypeId:
          defaultOutflowTaxTypeId ?? this.defaultOutflowTaxTypeId,
    );
  }
}

class ExpenseController extends Notifier<ExpensePageState> {
  Exception _permissionError(String message) => Exception(message);
  @override
  ExpensePageState build() {
    return const ExpensePageState(isLoading: true);
  }

  Future<void> loadAll() async {
    await loadPermissions();
    await loadCategories();
    await loadPaymentAccounts();
    await loadSuppliers();
    await loadTaxData();
    await Future.wait([fetchExpenses(), fetchStatistics()]);
  }

  Future<void> loadPermissions() async {
    final perms = await ref.read(userPermissionsProvider.future);
    state = state.copyWith(
      canViewExpenses: satisfiesPermission(perms, 'expenses.view'),
      canCreateExpenses: satisfiesPermission(perms, 'expenses.create'),
      canUpdateExpenses: satisfiesPermission(perms, 'expenses.update'),
      canDeleteExpenses: satisfiesPermission(perms, 'expenses.delete'),
      canExportExpenses: satisfiesPermission(perms, 'expenses.export'),
      canApproveExpenses: satisfiesPermission(perms, 'expenses.approve'),
    );
  }

  Future<void> loadTaxData() async {
    final repo = ref.read(expenseRepositoryProvider);
    try {
      final taxes = await repo.fetchTaxTypes();
      final accounts = await repo.fetchTaxAccounts();
      final defaults = await repo.fetchTaxDefaults();
      state = state.copyWith(
        taxTypes: _dedupeTaxTypesById(taxes),
        taxAccounts: accounts,
        defaultOutflowTaxTypeId: _parseDefaultOutflowTaxId(defaults),
      );
    } catch (_) {
      state = state.copyWith(taxTypes: [], taxAccounts: []);
    }
  }

  Future<void> loadPaymentAccounts() async {
    try {
      final repo = ref.read(expenseRepositoryProvider);
      final list = await repo.fetchPaymentAccounts();
      state = state.copyWith(paymentAccounts: list);
    } catch (_) {
      state = state.copyWith(paymentAccounts: []);
    }
  }

  Future<void> loadCategories() async {
    state = state.copyWith(isCategoriesLoading: true);
    try {
      final repo = ref.read(expenseRepositoryProvider);
      final list = await repo.fetchExpenseCategories();
      state = state.copyWith(
        categories: _dedupeCategoriesById(list),
        isCategoriesLoading: false,
      );
    } catch (_) {
      state = state.copyWith(isCategoriesLoading: false);
    }
  }

  Future<void> loadSuppliers() async {
    try {
      final repo = ref.read(expenseRepositoryProvider);
      final list = await repo.fetchSuppliers();
      state = state.copyWith(suppliers: list);
    } catch (_) {
      state = state.copyWith(suppliers: []);
    }
  }

  Future<void> loadBranches() async {
    try {
      final repo = ref.read(expenseRepositoryProvider);
      final list = await repo.fetchBranches();
      state = state.copyWith(branches: list);
    } catch (_) {
      state = state.copyWith(branches: []);
    }
  }

  Future<void> fetchExpenses() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(expenseRepositoryProvider);
      if (state.showDeleted) {
        final response = await repo.fetchDeletedExpenses(
          page: state.currentPage,
          limit: 20,
          search: state.searchQuery.isEmpty ? null : state.searchQuery,
        );
        state = state.copyWith(
          expenses: response.expenses,
          totalPages: response.totalPages,
          totalCount: response.totalCount,
          isLoading: false,
        );
      } else {
        final response = await repo.fetchExpenses(
          page: state.currentPage,
          limit: 20,
          sortBy: 'date',
          sortOrder: 'desc',
          status: state.statusFilter == 'all' ? null : state.statusFilter,
          category: state.categoryFilter == 'all' ? null : state.categoryFilter,
          search: state.searchQuery.isEmpty ? null : state.searchQuery,
          dateFrom: state.dateFrom,
          dateTo: state.dateTo,
          branchId: state.branchId,
        );
        state = state.copyWith(
          expenses: response.expenses,
          totalPages: response.totalPages,
          totalCount: response.totalCount,
          isLoading: false,
        );
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> fetchStatistics() async {
    state = state.copyWith(isStatsLoading: true);
    try {
      final repo = ref.read(expenseRepositoryProvider);
      final stats = await repo.fetchStatistics(
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
      );
      state = state.copyWith(statistics: stats, isStatsLoading: false);
    } catch (_) {
      state = state.copyWith(isStatsLoading: false);
    }
  }

  void setDateRange(String? from, String? to) {
    state = state.copyWith(dateFrom: from, dateTo: to, currentPage: 1);
    fetchExpenses();
    fetchStatistics();
  }

  void toggleExpenseSelection(String id) {
    final current = List<String>.from(state.selectedExpenseIds);
    if (current.contains(id)) {
      current.remove(id);
    } else {
      current.add(id);
    }
    state = state.copyWith(selectedExpenseIds: current);
  }

  void clearSelection() {
    state = state.copyWith(selectedExpenseIds: []);
  }

  void selectAllExpenses() {
    state = state.copyWith(
      selectedExpenseIds: state.expenses.map((e) => e.id).toList(),
    );
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query, currentPage: 1);
    fetchExpenses();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status, currentPage: 1);
    fetchExpenses();
  }

  void setCategoryFilter(String category) {
    state = state.copyWith(categoryFilter: category, currentPage: 1);
    fetchExpenses();
  }

  void setShowDeleted(bool show) {
    state = state.copyWith(showDeleted: show, currentPage: 1);
    fetchExpenses();
  }

  void setPage(int page) {
    state = state.copyWith(currentPage: page);
    fetchExpenses();
  }

  Future<Expense?> createExpense(
    CreateExpenseRequest request, {
    List<File> attachments = const [],
  }) async {
    if (!state.canCreateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(expenseRepositoryProvider);
      final created = attachments.isEmpty
          ? await repo.createExpense(request)
          : await repo.createExpenseWithAttachments(request, attachments);
      await loadAll();
      return created;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  Future<Expense?> updateExpense(String id, UpdateExpenseRequest request) async {
    if (!state.canUpdateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(expenseRepositoryProvider);
      final updated = await repo.updateExpense(id, request);
      await fetchExpenses();
      await fetchStatistics();
      return updated;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  Future<void> deleteExpense(String id, {String? reason}) async {
    if (!state.canDeleteExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    try {
      final repo = ref.read(expenseRepositoryProvider);
      await repo.deleteExpense(id, reason: reason);
      await loadAll();
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }

  Future<void> batchDeleteExpenses(List<String> ids, {String? reason}) async {
    if (!state.canDeleteExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    try {
      final repo = ref.read(expenseRepositoryProvider);
      await repo.batchDeleteExpenses(ids, reason: reason);
      await loadAll();
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }

  Future<Expense?> restoreExpense(String id, {String? reason}) async {
    if (!state.canDeleteExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    try {
      final repo = ref.read(expenseRepositoryProvider);
      final restored = await repo.restoreExpense(id, reason: reason);
      await loadAll();
      state = state.copyWith(selectedExpenseIds: []);
      return restored;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }

  /// Restore multiple expenses (API supports single restore; we call in loop).
  Future<void> batchRestoreExpenses(List<String> ids, {String? reason}) async {
    if (!state.canDeleteExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    try {
      final repo = ref.read(expenseRepositoryProvider);
      for (final id in ids) {
        await repo.restoreExpense(id, reason: reason);
      }
      await loadAll();
      state = state.copyWith(selectedExpenseIds: []);
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }

  Future<void> addPartialPayment(AddPartialPaymentRequest request) async {
    if (!state.canUpdateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    try {
      final repo = ref.read(expenseRepositoryProvider);
      await repo.addPartialPayment(request);
      await fetchExpenses();
      await fetchStatistics();
    } catch (e) {
      rethrow;
    }
  }

  Future<List<int>> exportCsv() async {
    if (!state.canExportExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    final repo = ref.read(expenseRepositoryProvider);
    return repo.exportExpensesCsv(
      status: state.statusFilter == 'all' ? null : state.statusFilter,
      category: state.categoryFilter == 'all' ? null : state.categoryFilter,
      search: state.searchQuery.isEmpty ? null : state.searchQuery,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
    );
  }

  Future<void> loadRecurringExpenses() async {
    final repo = ref.read(expenseRepositoryProvider);
    final rows = await repo.fetchRecurringExpenses();
    state = state.copyWith(recurringExpenses: rows);
  }

  Future<void> createRecurringExpense(Map<String, dynamic> payload) async {
    if (!state.canCreateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    final repo = ref.read(expenseRepositoryProvider);
    await repo.createRecurringExpense(payload);
    await loadRecurringExpenses();
  }

  Future<Map<String, dynamic>> getRecurringExpense(String id) async {
    return ref.read(expenseRepositoryProvider).fetchRecurringExpenseById(id);
  }

  Future<void> updateRecurringExpense(
    String id,
    Map<String, dynamic> payload,
  ) async {
    if (!state.canUpdateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    final repo = ref.read(expenseRepositoryProvider);
    await repo.updateRecurringExpense(id, payload);
    await loadRecurringExpenses();
  }

  Future<void> deleteRecurringExpense(String id) async {
    if (!state.canDeleteExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    final repo = ref.read(expenseRepositoryProvider);
    await repo.deleteRecurringExpense(id);
    await loadRecurringExpenses();
  }

  Future<void> loadCogsData({String? startDate, String? endDate}) async {
    final repo = ref.read(expenseRepositoryProvider);
    final summary = await repo.fetchCogsSummary(startDate: startDate, endDate: endDate);
    final settlements = await repo.fetchCogsSettlements();
    state = state.copyWith(cogsSummary: summary, cogsSettlements: settlements);
  }

  Future<void> createCogsSettlement(Map<String, dynamic> payload) async {
    if (!state.canCreateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    final repo = ref.read(expenseRepositoryProvider);
    await repo.createCogsSettlement(payload);
    await loadCogsData();
  }

  Future<List<int>> downloadHistoricalTemplate() async {
    if (!state.canExportExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    return ref.read(expenseRepositoryProvider).downloadHistoricalExpenseTemplate();
  }

  Future<void> uploadHistoricalExpenses({
    required String batchName,
    required String filePath,
  }) async {
    if (!state.canCreateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    final result = await ref.read(expenseRepositoryProvider).uploadHistoricalExpenses(
          batchName: batchName,
          filePath: filePath,
        );
    state = state.copyWith(
      historicalUploadMessage: (result['message'] ?? 'Upload complete').toString(),
    );
    await fetchExpenses();
    await fetchStatistics();
  }

  Future<ExpenseCategoryOption> createExpenseCategory({
    required String name,
    String? description,
  }) async {
    if (!state.canCreateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    final created = await ref.read(expenseRepositoryProvider).createExpenseCategory(
          name: name,
          description: description,
        );
    state = state.copyWith(
      categories: _dedupeCategoriesById([...state.categories, created]),
    );
    return created;
  }

  Future<Map<String, dynamic>> createTaxType({
    required String taxName,
    required double taxRate,
    required String accountId,
  }) async {
    if (!state.canCreateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    final created = await ref.read(expenseRepositoryProvider).createTaxType(
          taxName: taxName,
          taxRate: taxRate,
          accountId: accountId,
        );
    final row = (created['taxType'] is Map)
        ? Map<String, dynamic>.from(created['taxType'] as Map)
        : created;
    state = state.copyWith(
      taxTypes: _dedupeTaxTypesById([...state.taxTypes, row]),
    );
    return row;
  }

  Future<void> reverseTransaction({
    required String transactionId,
    required String transactionType,
    required String reason,
  }) async {
    if (!state.canUpdateExpenses) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    await ref.read(expenseRepositoryProvider).reversePostedTransaction(
          transactionId: transactionId,
          transactionType: transactionType,
          reversalReason: reason,
        );
    await loadCogsData();
    await fetchExpenses();
  }
}

final expenseControllerProvider =
    NotifierProvider<ExpenseController, ExpensePageState>(ExpenseController.new);
