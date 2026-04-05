import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:io';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
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
    this.sortBy = 'date',
    this.sortOrder = 'desc',
    this.dateFrom,
    this.dateTo,
    this.clientFilter,
    this.totalPages = 1,
    this.currentPage = 1,
    this.limit = 20,
    this.canViewQuotations = true,
    this.canCreateQuotations = true,
    this.canUpdateQuotations = true,
    this.canDeleteQuotations = true,
    this.canExportQuotations = true,
    this.canSendQuotations = true,
    this.canConvertQuotations = true,
  });

  final List<Quotation> quotations;
  final QuotationStatistics? statistics;
  final bool isLoading;
  final bool isStatsLoading;
  final String? error;
  final String searchQuery;
  final String statusFilter;
  final String sortBy;
  final String sortOrder;
  final String? dateFrom;
  final String? dateTo;
  final String? clientFilter;
  final int totalPages;
  final int currentPage;
  final int limit;
  final bool canViewQuotations;
  final bool canCreateQuotations;
  final bool canUpdateQuotations;
  final bool canDeleteQuotations;
  final bool canExportQuotations;
  final bool canSendQuotations;
  final bool canConvertQuotations;

  QuotationPageState copyWith({
    List<Quotation>? quotations,
    QuotationStatistics? statistics,
    bool? isLoading,
    bool? isStatsLoading,
    String? error,
    String? searchQuery,
    String? statusFilter,
    String? sortBy,
    String? sortOrder,
    String? dateFrom,
    String? dateTo,
    String? clientFilter,
    int? totalPages,
    int? currentPage,
    int? limit,
    bool? canViewQuotations,
    bool? canCreateQuotations,
    bool? canUpdateQuotations,
    bool? canDeleteQuotations,
    bool? canExportQuotations,
    bool? canSendQuotations,
    bool? canConvertQuotations,
  }) {
    return QuotationPageState(
      quotations: quotations ?? this.quotations,
      statistics: statistics ?? this.statistics,
      isLoading: isLoading ?? this.isLoading,
      isStatsLoading: isStatsLoading ?? this.isStatsLoading,
      error: error,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      sortBy: sortBy ?? this.sortBy,
      sortOrder: sortOrder ?? this.sortOrder,
      dateFrom: dateFrom ?? this.dateFrom,
      dateTo: dateTo ?? this.dateTo,
      clientFilter: clientFilter ?? this.clientFilter,
      totalPages: totalPages ?? this.totalPages,
      currentPage: currentPage ?? this.currentPage,
      limit: limit ?? this.limit,
      canViewQuotations: canViewQuotations ?? this.canViewQuotations,
      canCreateQuotations: canCreateQuotations ?? this.canCreateQuotations,
      canUpdateQuotations: canUpdateQuotations ?? this.canUpdateQuotations,
      canDeleteQuotations: canDeleteQuotations ?? this.canDeleteQuotations,
      canExportQuotations: canExportQuotations ?? this.canExportQuotations,
      canSendQuotations: canSendQuotations ?? this.canSendQuotations,
      canConvertQuotations: canConvertQuotations ?? this.canConvertQuotations,
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
    await loadPermissions();
    if (!state.canViewQuotations) {
      state = state.copyWith(
        quotations: const [],
        statistics: null,
        isLoading: false,
        error: null,
      );
      return;
    }
    fetchQuotations();
    fetchStatistics();
  }

  Future<void> loadPermissions() async {
    final perms = await ref.read(userPermissionsProvider.future);
    final relax = perms.isEmpty;
    state = state.copyWith(
      canViewQuotations: relax || perms.contains('quotations.view'),
      canCreateQuotations: relax || perms.contains('quotations.create'),
      canUpdateQuotations: relax || perms.contains('quotations.update'),
      canDeleteQuotations: relax || perms.contains('quotations.delete'),
      canExportQuotations: relax || perms.contains('quotations.export'),
      canSendQuotations: relax || perms.contains('quotations.send'),
      canConvertQuotations: relax || perms.contains('quotations.convert'),
    );
  }

  Future<void> fetchQuotations() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(quotationRepositoryProvider);
      final response = await repo.fetchQuotations(
        page: state.currentPage,
        limit: state.limit,
        search: state.searchQuery.isEmpty ? null : state.searchQuery,
        status: state.statusFilter == 'all' ? null : state.statusFilter,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
        clientId: state.clientFilter,
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
      final stats = await repo.fetchStatistics(
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
      );
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

  void setSortBy(String sortBy) {
    final isSame = state.sortBy == sortBy;
    state = state.copyWith(
      sortBy: sortBy,
      sortOrder: isSame ? (state.sortOrder == 'asc' ? 'desc' : 'asc') : 'desc',
      currentPage: 1,
    );
    fetchQuotations();
  }

  void setDateRange(String? from, String? to) {
    state = state.copyWith(dateFrom: from, dateTo: to, currentPage: 1);
    fetchQuotations();
    fetchStatistics();
  }

  void setClientFilter(String? clientId) {
    state = state.copyWith(clientFilter: clientId, currentPage: 1);
    fetchQuotations();
  }

  void resetAdvancedFilters() {
    state = state.copyWith(
      dateFrom: null,
      dateTo: null,
      clientFilter: null,
      currentPage: 1,
    );
    fetchQuotations();
    fetchStatistics();
  }

  void setLimit(int limit) {
    state = state.copyWith(limit: limit, currentPage: 1);
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

  Future<void> exportCsv() async {
    try {
      final repo = ref.read(quotationRepositoryProvider);
      final bytes = await repo.exportQuotations(
        format: 'csv',
        status: state.statusFilter == 'all' ? null : state.statusFilter,
        search: state.searchQuery.isEmpty ? null : state.searchQuery,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
        clientId: state.clientFilter,
      );
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/quotations_export.csv');
      await file.writeAsBytes(bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
    } catch (e) {
      state = state.copyWith(error: 'Export failed: $e');
    }
  }
}

final quotationControllerProvider =
    NotifierProvider<QuotationController, QuotationPageState>(
        QuotationController.new);
