import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../domain/invoice_model.dart';
import '../../data/invoice_repository.dart';

part 'invoice_provider.g.dart';

class InvoicePageState {
  final List<Invoice> invoices;
  final bool isLoading;
  final String? error;
  final String searchQuery;
  final String statusFilter;
  final bool isSubmitting;

  InvoicePageState({
    this.invoices = const [],
    this.isLoading = false,
    this.error,
    this.searchQuery = '',
    this.statusFilter = 'all',
    this.isSubmitting = false,
  });

  InvoicePageState copyWith({
    List<Invoice>? invoices,
    bool? isLoading,
    String? error,
    String? searchQuery,
    String? statusFilter,
    bool? isSubmitting,
  }) {
    return InvoicePageState(
      invoices: invoices ?? this.invoices,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      isSubmitting: isSubmitting ?? this.isSubmitting,
    );
  }
}

@riverpod
class InvoiceController extends _$InvoiceController {
  @override
  InvoicePageState build() {
    // Start initial fetch
    Future.microtask(() => fetchInvoices());
    return InvoicePageState(isLoading: true);
  }

  Future<void> fetchInvoices({String? search, String? status}) async {
    final query = search ?? state.searchQuery;
    final filter = status ?? state.statusFilter;

    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(invoiceRepositoryProvider);
      final invoices = await repo.fetchInvoices(search: query, status: filter);

      if (!ref.mounted) return;

      state = state.copyWith(invoices: invoices, isLoading: false);
    } catch (e) {
      if (!ref.mounted) return;
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query, isLoading: true);
    fetchInvoices();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status, isLoading: true);
    fetchInvoices();
  }

  Future<bool> createInvoice(CreateInvoiceRequest request) async {
    state = state.copyWith(isSubmitting: true, error: null);
    try {
      final repository = ref.read(invoiceRepositoryProvider);
      await repository.createInvoice(request);

      if (!ref.mounted) return true;

      state = state.copyWith(isSubmitting: false);
      fetchInvoices(); // Refresh list
      return true;
    } catch (e) {
      if (!ref.mounted) return false;
      state = state.copyWith(isSubmitting: false, error: e.toString());
      return false;
    }
  }

  Future<void> updateStatus(String id, String status) async {
    try {
      final repository = ref.read(invoiceRepositoryProvider);
      await repository.updateInvoiceStatus(id, status);
      fetchInvoices(); // Refresh list
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}
