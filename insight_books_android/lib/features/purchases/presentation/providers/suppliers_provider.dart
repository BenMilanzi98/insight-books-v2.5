import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

import '../../data/purchases_offline_helpers.dart';
import '../../data/purchases_repository.dart';
import '../../domain/purchases_models.dart';
import 'purchases_hub_provider.dart';

class SuppliersStats {
  const SuppliersStats({
    this.totalCount = 0,
    this.activeCount = 0,
    this.totalBalance = 0,
  });

  final int totalCount;
  final int activeCount;
  final double totalBalance;
}

class SuppliersPageState {
  const SuppliersPageState({
    this.suppliers = const [],
    this.stats,
    this.isLoading = false,
    this.error,
    this.searchQuery = '',
    this.statusFilter = 'all',
    this.totalPages = 1,
    this.currentPage = 1,
    this.totalCount = 0,
    this.selectedSupplierIds = const [],
    this.canView = true,
    this.canCreate = true,
    this.canUpdate = true,
    this.canDelete = true,
  });

  final List<PurchaseSupplier> suppliers;
  final SuppliersStats? stats;
  final bool isLoading;
  final String? error;
  final String searchQuery;
  final String statusFilter;
  final int totalPages;
  final int currentPage;
  final int totalCount;
  final List<String> selectedSupplierIds;
  final bool canView;
  final bool canCreate;
  final bool canUpdate;
  final bool canDelete;

  SuppliersPageState copyWith({
    List<PurchaseSupplier>? suppliers,
    SuppliersStats? stats,
    bool? isLoading,
    String? error,
    String? searchQuery,
    String? statusFilter,
    int? totalPages,
    int? currentPage,
    int? totalCount,
    List<String>? selectedSupplierIds,
    bool? canView,
    bool? canCreate,
    bool? canUpdate,
    bool? canDelete,
  }) {
    return SuppliersPageState(
      suppliers: suppliers ?? this.suppliers,
      stats: stats ?? this.stats,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      totalPages: totalPages ?? this.totalPages,
      currentPage: currentPage ?? this.currentPage,
      totalCount: totalCount ?? this.totalCount,
      selectedSupplierIds: selectedSupplierIds ?? this.selectedSupplierIds,
      canView: canView ?? this.canView,
      canCreate: canCreate ?? this.canCreate,
      canUpdate: canUpdate ?? this.canUpdate,
      canDelete: canDelete ?? this.canDelete,
    );
  }
}

class SupplierLedgerData {
  const SupplierLedgerData({
    required this.supplier,
    required this.transactions,
  });

  final PurchaseSupplier supplier;
  final Map<String, dynamic> transactions;
}


class SuppliersController extends Notifier<SuppliersPageState> {
  Exception _permissionError(String message) => Exception(message);

  @override
  SuppliersPageState build() {
    return const SuppliersPageState(isLoading: true);
  }

  Future<void> load() async {
    await loadPermissions();
    await refresh();
  }

  Future<void> refresh() async {
    await Future.wait([fetchSuppliers(), fetchStats()]);
  }

  Future<void> loadPermissions() async {
    final perms = await ref.read(userPermissionsProvider.future);
    state = state.copyWith(
      canView: satisfiesPermission(perms, 'suppliers.view'),
      canCreate: satisfiesPermission(perms, 'suppliers.create'),
      canUpdate: satisfiesPermission(perms, 'suppliers.update'),
      canDelete: satisfiesPermission(perms, 'suppliers.delete'),
    );
  }

  String? _apiStatusFilter() {
    if (state.statusFilter == 'active') return 'active';
    if (state.statusFilter == 'inactive') return 'inactive';
    return null;
  }

  Future<void> fetchSuppliers() async {
    if (!state.canView) {
      state = state.copyWith(
        isLoading: false,
        error: 'You do not have permission to view suppliers.',
        suppliers: const [],
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final search =
          state.searchQuery.trim().isEmpty ? null : state.searchQuery.trim();
      final response = await repo.fetchSuppliers(
        page: state.currentPage,
        limit: 20,
        search: search,
        status: _apiStatusFilter(),
      );
      state = state.copyWith(
        suppliers: response.items,
        totalPages: response.totalPages,
        totalCount: response.totalCount,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: NetworkErrorMapper.toUserMessage(e),
      );
    }
  }

  Future<void> fetchStats() async {
    if (!state.canView) return;

    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final all = await repo.fetchSuppliers(page: 1, limit: 100);
      final active = await repo.fetchSuppliers(
        page: 1,
        limit: 1,
        status: 'active',
      );
      final totalBalance = all.items.fold<double>(
        0,
        (sum, s) => sum + s.currentBalance,
      );
      state = state.copyWith(
        stats: SuppliersStats(
          totalCount: all.totalCount,
          activeCount: active.totalCount,
          totalBalance: totalBalance,
        ),
      );
    } catch (_) {
      // Keep prior stats on failure.
    }
  }

  void setSearch(String query) {
    state = state.copyWith(searchQuery: query, currentPage: 1);
    fetchSuppliers();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status, currentPage: 1);
    fetchSuppliers();
  }

  void setPage(int page) {
    state = state.copyWith(currentPage: page);
    fetchSuppliers();
  }

  void toggleSelection(String id) {
    final current = List<String>.from(state.selectedSupplierIds);
    if (current.contains(id)) {
      current.remove(id);
    } else {
      current.add(id);
    }
    state = state.copyWith(selectedSupplierIds: current);
  }

  void clearSelection() {
    state = state.copyWith(selectedSupplierIds: const []);
  }

  void selectAllVisible() {
    state = state.copyWith(
      selectedSupplierIds: state.suppliers.map((s) => s.id).toList(),
    );
  }

  void applyOptimisticSupplier(PurchaseSupplier supplier) {
    final updated = [supplier, ...state.suppliers];
    final stats = state.stats;
    state = state.copyWith(
      suppliers: updated,
      totalCount: state.totalCount + 1,
      stats: stats == null
          ? null
          : SuppliersStats(
              totalCount: stats.totalCount + 1,
              activeCount: supplier.isActive
                  ? stats.activeCount + 1
                  : stats.activeCount,
              totalBalance: stats.totalBalance,
            ),
    );
  }

  Future<PurchaseSupplier> createSupplier(Map<String, dynamic> body) async {
    if (!state.canCreate) {
      throw _permissionError('You do not have permission to create suppliers.');
    }
    final repo = ref.read(purchasesRepositoryProvider);
    final queue = ref.read(purchasesOfflineQueueProvider);
    final tenantId = ref.read(tenantProvider).currentTenantId ?? '';
    try {
      final created = await queueOrCreateSupplier(
        repo,
        queue,
        tenantId,
        body,
      );
      await refresh();
      return created;
    } on PurchasesQueuedException catch (e) {
      applyOptimisticSupplier(e.optimistic as PurchaseSupplier);
      ref.invalidate(purchasesHubProvider);
      rethrow;
    }
  }

  Future<PurchaseSupplier> updateSupplier(
    String id,
    Map<String, dynamic> body,
  ) async {
    if (!state.canUpdate) {
      throw _permissionError('You do not have permission to update suppliers.');
    }
    final repo = ref.read(purchasesRepositoryProvider);
    final updated = await repo.updateSupplier(id, body);
    await refresh();
    ref.invalidate(supplierLedgerProvider(id));
    return updated;
  }

  Future<void> deactivateSupplier(String id) async {
    if (!state.canDelete) {
      throw _permissionError('You do not have permission to deactivate suppliers.');
    }
    final repo = ref.read(purchasesRepositoryProvider);
    await repo.deleteSupplier(id);
    await refresh();
    ref.invalidate(supplierLedgerProvider(id));
  }

  Future<void> bulkSetActive(bool isActive) async {
    if (!state.canUpdate) {
      throw _permissionError('You do not have permission to update suppliers.');
    }
    final ids = state.selectedSupplierIds;
    if (ids.isEmpty) return;

    final repo = ref.read(purchasesRepositoryProvider);
    await repo.bulkUpdateSuppliers({
      'ids': ids,
      'updates': {'isActive': isActive},
    });
    state = state.copyWith(selectedSupplierIds: const []);
    await refresh();
  }

  void restoreFromError() {
    state = state.copyWith(error: null);
  }
}

final suppliersControllerProvider =
    NotifierProvider<SuppliersController, SuppliersPageState>(
  SuppliersController.new,
);

final supplierLedgerProvider =
    FutureProvider.family<SupplierLedgerData, String>((ref, supplierId) async {
  final repo = ref.watch(purchasesRepositoryProvider);
  final results = await Future.wait([
    repo.fetchSupplier(supplierId),
    repo.fetchSupplierTransactions(supplierId),
  ]);
  return SupplierLedgerData(
    supplier: results[0] as PurchaseSupplier,
    transactions: results[1] as Map<String, dynamic>,
  );
});
