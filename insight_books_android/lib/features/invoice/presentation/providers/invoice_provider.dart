import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../data/invoice_repository.dart';
import '../../domain/invoice_model.dart';

// ═══════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════

class InvoicePageState {
  final List<Invoice> invoices;
  final InvoiceStatistics? statistics;
  final bool isLoading;
  final String? error;
  final String searchQuery;
  final String statusFilter;

  // Sorting
  final String sortBy; // 'date', 'dueDate', 'total', 'clientName', 'status'
  final String sortOrder; // 'desc', 'asc'

  // Pagination
  final int page;
  final int totalPages;
  final int totalCount;
  final int limit;

  // Advanced filters
  final String? dateFrom;
  final String? dateTo;
  final String? clientFilter;
  final bool canViewInvoices;
  final bool canCreateInvoices;
  final bool canUpdateInvoices;
  final bool canDeleteInvoices;
  final bool canExportInvoices;
  final bool canSendInvoices;

  const InvoicePageState({
    this.invoices = const [],
    this.statistics,
    this.isLoading = false,
    this.error,
    this.searchQuery = '',
    this.statusFilter = 'all',
    this.sortBy = 'date',
    this.sortOrder = 'desc',
    this.page = 1,
    this.totalPages = 1,
    this.totalCount = 0,
    this.limit = 20,
    this.dateFrom,
    this.dateTo,
    this.clientFilter,
    this.canViewInvoices = true,
    this.canCreateInvoices = true,
    this.canUpdateInvoices = true,
    this.canDeleteInvoices = true,
    this.canExportInvoices = true,
    this.canSendInvoices = true,
  });

  InvoicePageState copyWith({
    List<Invoice>? invoices,
    InvoiceStatistics? statistics,
    bool? isLoading,
    String? error,
    String? searchQuery,
    String? statusFilter,
    String? sortBy,
    String? sortOrder,
    int? page,
    int? totalPages,
    int? totalCount,
    int? limit,
    String? dateFrom,
    String? dateTo,
    String? clientFilter,
    bool? canViewInvoices,
    bool? canCreateInvoices,
    bool? canUpdateInvoices,
    bool? canDeleteInvoices,
    bool? canExportInvoices,
    bool? canSendInvoices,
    bool clearError = false,
    bool clearDateFrom = false,
    bool clearDateTo = false,
    bool clearClientFilter = false,
  }) {
    return InvoicePageState(
      invoices: invoices ?? this.invoices,
      statistics: statistics ?? this.statistics,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      sortBy: sortBy ?? this.sortBy,
      sortOrder: sortOrder ?? this.sortOrder,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      totalCount: totalCount ?? this.totalCount,
      limit: limit ?? this.limit,
      dateFrom: clearDateFrom ? null : dateFrom ?? this.dateFrom,
      dateTo: clearDateTo ? null : dateTo ?? this.dateTo,
      clientFilter: clearClientFilter
          ? null
          : clientFilter ?? this.clientFilter,
      canViewInvoices: canViewInvoices ?? this.canViewInvoices,
      canCreateInvoices: canCreateInvoices ?? this.canCreateInvoices,
      canUpdateInvoices: canUpdateInvoices ?? this.canUpdateInvoices,
      canDeleteInvoices: canDeleteInvoices ?? this.canDeleteInvoices,
      canExportInvoices: canExportInvoices ?? this.canExportInvoices,
      canSendInvoices: canSendInvoices ?? this.canSendInvoices,
    );
  }
}

// ═══════════════════════════════════════════════════
//  Controller
// ═══════════════════════════════════════════════════

class InvoiceController extends Notifier<InvoicePageState> {
  InvoiceRepository get _repo => ref.read(invoiceRepositoryProvider);

  @override
  InvoicePageState build() {
    Future.microtask(() => refresh());
    return const InvoicePageState();
  }

  // —— Loading ——

  Future<void> loadInvoices() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repo.fetchInvoices(
        search: state.searchQuery.isNotEmpty ? state.searchQuery : null,
        status: state.statusFilter != 'all' ? state.statusFilter : null,
        page: state.page,
        limit: state.limit,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
        clientId: state.clientFilter,
      );
      state = state.copyWith(
        invoices: result.invoices,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        page: result.page,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadStatistics() async {
    try {
      final stats = await _repo.fetchStatistics(
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
      );
      state = state.copyWith(statistics: stats);
    } catch (_) {
      // statistics are non-essential
    }
  }

  Future<void> refresh() async {
    await loadPermissions();
    if (!state.canViewInvoices) {
      state = state.copyWith(
        invoices: const [],
        statistics: null,
        isLoading: false,
        error: null,
      );
      return;
    }
    state = state.copyWith(page: 1);
    await Future.wait([loadInvoices(), loadStatistics()]);
  }

  Future<void> loadPermissions() async {
    final perms = await _repo.fetchUserPermissions();
    state = state.copyWith(
      canViewInvoices: perms.isEmpty || perms.contains('invoices.view'),
      canCreateInvoices: perms.isEmpty || perms.contains('invoices.create'),
      canUpdateInvoices: perms.isEmpty || perms.contains('invoices.update'),
      canDeleteInvoices: perms.isEmpty || perms.contains('invoices.delete'),
      canExportInvoices: perms.isEmpty || perms.contains('invoices.export'),
      canSendInvoices: perms.isEmpty || perms.contains('invoices.send'),
    );
  }

  // —— Filtering ——

  void setSearch(String search) {
    state = state.copyWith(searchQuery: search, page: 1);
    loadInvoices();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status, page: 1);
    loadInvoices();
  }

  // —— Sorting ——

  void setSortBy(String sortBy) {
    state = state.copyWith(sortBy: sortBy, page: 1);
    loadInvoices();
  }

  void setSortOrder(String order) {
    state = state.copyWith(sortOrder: order, page: 1);
    loadInvoices();
  }

  void toggleSortOrder() {
    setSortOrder(state.sortOrder == 'asc' ? 'desc' : 'asc');
  }

  // —— Pagination ——

  void setPage(int page) {
    if (page < 1 || page > state.totalPages) return;
    state = state.copyWith(page: page);
    loadInvoices();
  }

  void nextPage() => setPage(state.page + 1);
  void previousPage() => setPage(state.page - 1);

  // —— Advanced Filters ——

  void setDateRange(String? from, String? to) {
    state = state.copyWith(
      dateFrom: from,
      dateTo: to,
      clearDateFrom: from == null,
      clearDateTo: to == null,
      page: 1,
    );
    Future.wait([loadInvoices(), loadStatistics()]);
  }

  void setClientFilter(String? clientId) {
    state = state.copyWith(
      clientFilter: clientId,
      clearClientFilter: clientId == null,
      page: 1,
    );
    loadInvoices();
  }

  void setLimit(int limit) {
    if (limit <= 0) return;
    state = state.copyWith(limit: limit, page: 1);
    loadInvoices();
  }

  void resetFilters() {
    state = state.copyWith(
      searchQuery: '',
      statusFilter: 'all',
      sortBy: 'date',
      sortOrder: 'desc',
      page: 1,
      clearDateFrom: true,
      clearDateTo: true,
      clearClientFilter: true,
    );
    loadInvoices();
  }

  bool get hasActiveFilters {
    return state.statusFilter != 'all' ||
        state.searchQuery.isNotEmpty ||
        state.dateFrom != null ||
        state.dateTo != null ||
        state.clientFilter != null;
  }

  // —— CRUD ——

  Future<void> deleteInvoice(String id) async {
    await _repo.deleteInvoice(id);
    await refresh();
  }

  Future<Invoice> updateInvoice(String id, CreateInvoiceRequest request) async {
    final invoice = await _repo.updateInvoice(id, request);
    await refresh();
    return invoice;
  }

  // —— Payment Actions ——

  Future<void> markAsPaid(String id, String paymentMethod) async {
    await _repo.markAsPaid(id, paymentMethod);
    await refresh();
  }

  Future<void> voidInvoice(String id, String reason) async {
    await _repo.voidInvoice(id, reason);
    await refresh();
  }

  Future<void> refundInvoice({
    required String invoiceId,
    required double refundAmount,
    required String refundReason,
    required String refundMethod,
    String? notes,
  }) async {
    await _repo.refundInvoice(
      invoiceId: invoiceId,
      refundAmount: refundAmount,
      refundReason: refundReason,
      refundMethod: refundMethod,
      notes: notes,
    );
    await refresh();
  }

  Future<void> addPartialPayment({
    required String invoiceId,
    required double amount,
    required String paymentMethod,
    String? paymentDate,
    String? reference,
    String? notes,
  }) async {
    await _repo.addPartialPayment(
      invoiceId: invoiceId,
      amount: amount,
      paymentMethod: paymentMethod,
      paymentDate: paymentDate,
      reference: reference,
      notes: notes,
    );
    await refresh();
  }

  // —— Export ——

  Future<void> exportCsv() async {
    try {
      final bytes = await _repo.exportInvoices(
        status: state.statusFilter != 'all' ? state.statusFilter : null,
        search: state.searchQuery.isNotEmpty ? state.searchQuery : null,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
        clientId: state.clientFilter,
      );
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/invoices_export.csv');
      await file.writeAsBytes(bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
    } catch (e) {
      state = state.copyWith(error: 'Export failed: $e');
    }
  }
}

// ═══════════════════════════════════════════════════
//  Providers
// ═══════════════════════════════════════════════════

final invoiceControllerProvider =
    NotifierProvider<InvoiceController, InvoicePageState>(InvoiceController.new);

final invoiceStatisticsProvider = FutureProvider<InvoiceStatistics>((ref) {
  final repo = ref.watch(invoiceRepositoryProvider);
  return repo.fetchStatistics();
});
