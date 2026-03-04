import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/quotation_repository.dart';
import '../../domain/quotation_model.dart';

class QuotationPageState {
  const QuotationPageState({
    this.quotations = const [],
    this.statistics,
    this.isLoading = false,
    this.isStatsLoading = false,
    this.error,
    this.searchQuery = '',
    this.statusFilter = 'all',
    this.totalPages = 1,
    this.currentPage = 1,
  });

  final List<Quotation> quotations;
  final QuotationStatistics? statistics;
  final bool isLoading;
  final bool isStatsLoading;
  final String? error;
  final String searchQuery;
  final String statusFilter;
  final int totalPages;
  final int currentPage;

  QuotationPageState copyWith({
    List<Quotation>? quotations,
    QuotationStatistics? statistics,
    bool? isLoading,
    bool? isStatsLoading,
    String? error,
    String? searchQuery,
    String? statusFilter,
    int? totalPages,
    int? currentPage,
  }) {
    return QuotationPageState(
      quotations: quotations ?? this.quotations,
      statistics: statistics ?? this.statistics,
      isLoading: isLoading ?? this.isLoading,
      isStatsLoading: isStatsLoading ?? this.isStatsLoading,
      error: error,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      totalPages: totalPages ?? this.totalPages,
      currentPage: currentPage ?? this.currentPage,
    );
  }
}

class QuotationController extends Notifier<QuotationPageState> {
  @override
  QuotationPageState build() {
    Future.microtask(() => loadAll());
    return const QuotationPageState(isLoading: true);
  }

  Future<void> loadAll() async {
    fetchQuotations();
    fetchStatistics();
  }

  Future<void> fetchQuotations() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(quotationRepositoryProvider);
      final response = await repo.fetchQuotations(
        page: state.currentPage,
        limit: 20,
        search: state.searchQuery.isEmpty ? null : state.searchQuery,
        status: state.statusFilter == 'all' ? null : state.statusFilter,
      );
      state = state.copyWith(
        quotations: response.quotations,
        totalPages: response.totalPages,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> fetchStatistics() async {
    state = state.copyWith(isStatsLoading: true);
    try {
      final repo = ref.read(quotationRepositoryProvider);
      final stats = await repo.fetchStatistics();
      state = state.copyWith(statistics: stats, isStatsLoading: false);
    } catch (_) {
      state = state.copyWith(isStatsLoading: false);
    }
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query, currentPage: 1);
    fetchQuotations();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status, currentPage: 1);
    fetchQuotations();
  }

  void setPage(int page) {
    state = state.copyWith(currentPage: page);
    fetchQuotations();
  }

  Future<Quotation?> createQuotation(CreateQuotationRequest request) async {
    state = state.copyWith(isLoading: true);
    try {
      final repo = ref.read(quotationRepositoryProvider);
      final created = await repo.createQuotation(request);
      await loadAll();
      return created;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  Future<Quotation?> updateQuotation(String id, CreateQuotationRequest request) async {
    state = state.copyWith(isLoading: true);
    try {
      final repo = ref.read(quotationRepositoryProvider);
      final updated = await repo.updateQuotation(id, request);
      await loadAll();
      return updated;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  Future<void> deleteQuotation(String id) async {
    try {
      final repo = ref.read(quotationRepositoryProvider);
      await repo.deleteQuotation(id);
      await loadAll();
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }

  Future<Quotation?> duplicateQuotation(String id) async {
    try {
      final repo = ref.read(quotationRepositoryProvider);
      final duplicated = await repo.duplicateQuotation(id);
      await loadAll();
      return duplicated;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }
}

final quotationControllerProvider =
    NotifierProvider<QuotationController, QuotationPageState>(
        QuotationController.new);
