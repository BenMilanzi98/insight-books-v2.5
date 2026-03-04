import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../data/invoice_repository.dart';
import '../../domain/invoice_model.dart';

part 'invoice_provider.g.dart';

class InvoicePageState {
  final List<Invoice> invoices;
  final InvoiceStatistics? statistics;
  final bool isLoading;
  final bool isStatsLoading;
  final String? error;
  final String searchQuery;
  final String statusFilter;

  const InvoicePageState({
    this.invoices = const [],
    this.statistics,
    this.isLoading = false,
    this.isStatsLoading = false,
    this.error,
    this.searchQuery = '',
    this.statusFilter = 'all',
  });

  InvoicePageState copyWith({
    List<Invoice>? invoices,
    InvoiceStatistics? statistics,
    bool? isLoading,
    bool? isStatsLoading,
    String? error,
    String? searchQuery,
    String? statusFilter,
  }) {
    return InvoicePageState(
      invoices: invoices ?? this.invoices,
      statistics: statistics ?? this.statistics,
      isLoading: isLoading ?? this.isLoading,
      isStatsLoading: isStatsLoading ?? this.isStatsLoading,
      error: error,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
    );
  }
}

@Riverpod(keepAlive: true)
class InvoiceController extends _$InvoiceController {
  @override
  InvoicePageState build() {
    return const InvoicePageState(isLoading: true);
  }

  Future<void> loadAll() async {
    await Future.wait([fetchInvoices(), fetchStatistics()]);
  }

  Future<void> fetchInvoices() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(invoiceRepositoryProvider);
      final invoices = await repo.fetchInvoices(
        search: state.searchQuery.isEmpty ? null : state.searchQuery,
        status: state.statusFilter == 'all' ? null : state.statusFilter,
        page: 1,
        limit: 20,
      );
      state = state.copyWith(invoices: invoices, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> fetchStatistics() async {
    state = state.copyWith(isStatsLoading: true);
    try {
      final repo = ref.read(invoiceRepositoryProvider);
      final stats = await repo.fetchStatistics();
      state = state.copyWith(statistics: stats, isStatsLoading: false);
    } catch (e) {
      state = state.copyWith(isStatsLoading: false);
    }
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
    fetchInvoices();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status);
    fetchInvoices();
  }

  Future<void> createInvoice(CreateInvoiceRequest request) async {
    state = state.copyWith(isLoading: true);
    try {
      final repo = ref.read(invoiceRepositoryProvider);
      await repo.createInvoice(request);
      await loadAll();
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  Future<void> deleteInvoice(String id) async {
    try {
      final repo = ref.read(invoiceRepositoryProvider);
      await repo.deleteInvoice(id);
      await loadAll();
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }
}
