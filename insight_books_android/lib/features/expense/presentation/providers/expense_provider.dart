import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/expense_repository.dart';
import '../../domain/expense_model.dart';

class ExpensePageState {
  const ExpensePageState({
    this.expenses = const [],
    this.statistics,
    this.categories = const [],
    this.paymentAccounts = const [],
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
  });

  final List<Expense> expenses;
  final ExpenseStatistics? statistics;
  final List<ExpenseCategoryOption> categories;
  final List<PaymentAccountOption> paymentAccounts;
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

  ExpensePageState copyWith({
    List<Expense>? expenses,
    ExpenseStatistics? statistics,
    List<ExpenseCategoryOption>? categories,
    List<PaymentAccountOption>? paymentAccounts,
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
  }) {
    return ExpensePageState(
      expenses: expenses ?? this.expenses,
      statistics: statistics ?? this.statistics,
      categories: categories ?? this.categories,
      paymentAccounts: paymentAccounts ?? this.paymentAccounts,
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
    );
  }
}

class ExpenseController extends Notifier<ExpensePageState> {
  @override
  ExpensePageState build() {
    return const ExpensePageState(isLoading: true);
  }

  Future<void> loadAll() async {
    await loadCategories();
    await loadPaymentAccounts();
    await Future.wait([fetchExpenses(), fetchStatistics()]);
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
      state = state.copyWith(categories: list, isCategoriesLoading: false);
    } catch (_) {
      state = state.copyWith(isCategoriesLoading: false);
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
          accountId: state.categoryFilter == 'all' ? null : state.categoryFilter,
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

  Future<Expense?> createExpense(CreateExpenseRequest request) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(expenseRepositoryProvider);
      final created = await repo.createExpense(request);
      await loadAll();
      return created;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  Future<Expense?> updateExpense(String id, UpdateExpenseRequest request) async {
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
    final repo = ref.read(expenseRepositoryProvider);
    return repo.exportExpensesCsv(
      status: state.statusFilter == 'all' ? null : state.statusFilter,
      category: state.categoryFilter == 'all' ? null : state.categoryFilter,
      accountId: state.categoryFilter == 'all' ? null : state.categoryFilter,
      search: state.searchQuery.isEmpty ? null : state.searchQuery,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
    );
  }
}

final expenseControllerProvider =
    NotifierProvider<ExpenseController, ExpensePageState>(ExpenseController.new);
