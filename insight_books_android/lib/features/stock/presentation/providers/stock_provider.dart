import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import '../../data/stock_movement_offline_queue.dart';
import '../../data/stock_repository.dart';
import '../../domain/stock_models.dart';
import 'stock_details_provider.dart';

/// Computes the new stock quantity after a movement.
double computeStockQtyAfterMovement({
  required double currentQty,
  required StockMovementType type,
  required double quantity,
}) {
  switch (type) {
    case StockMovementType.stockIn:
      return currentQty + quantity;
    case StockMovementType.stockOut:
      return (currentQty - quantity).clamp(0, double.infinity);
    case StockMovementType.adjustment:
      return quantity.clamp(0, double.infinity);
  }
}

class StockPageState {
  const StockPageState({
    this.products = const [],
    this.statistics,
    this.isLoading = false,
    this.error,
    this.searchQuery = '',
    this.statusFilter = 'all',
    this.categoryFilter = 'all',
    this.catalog = 'products',
    this.showDeleted = false,
    this.totalPages = 1,
    this.currentPage = 1,
    this.totalCount = 0,
    this.selectedProductIds = const [],
    this.canView = true,
    this.canCreate = true,
    this.canUpdate = true,
    this.canDelete = true,
    this.canAdjust = true,
    this.canExport = true,
    this.pendingMovementCount = 0,
    this.isSyncingMovements = false,
  });

  final List<StockProduct> products;
  final StockStatistics? statistics;
  final bool isLoading;
  final String? error;
  final String searchQuery;
  final String statusFilter;
  final String categoryFilter;
  final String catalog;
  final bool showDeleted;
  final int totalPages;
  final int currentPage;
  final int totalCount;
  final List<String> selectedProductIds;
  final bool canView;
  final bool canCreate;
  final bool canUpdate;
  final bool canDelete;
  final bool canAdjust;
  final bool canExport;
  final int pendingMovementCount;
  final bool isSyncingMovements;

  StockPageState copyWith({
    List<StockProduct>? products,
    StockStatistics? statistics,
    bool? isLoading,
    String? error,
    String? searchQuery,
    String? statusFilter,
    String? categoryFilter,
    String? catalog,
    bool? showDeleted,
    int? totalPages,
    int? currentPage,
    int? totalCount,
    List<String>? selectedProductIds,
    bool? canView,
    bool? canCreate,
    bool? canUpdate,
    bool? canDelete,
    bool? canAdjust,
    bool? canExport,
    int? pendingMovementCount,
    bool? isSyncingMovements,
  }) {
    return StockPageState(
      products: products ?? this.products,
      statistics: statistics ?? this.statistics,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      categoryFilter: categoryFilter ?? this.categoryFilter,
      catalog: catalog ?? this.catalog,
      showDeleted: showDeleted ?? this.showDeleted,
      totalPages: totalPages ?? this.totalPages,
      currentPage: currentPage ?? this.currentPage,
      totalCount: totalCount ?? this.totalCount,
      selectedProductIds: selectedProductIds ?? this.selectedProductIds,
      canView: canView ?? this.canView,
      canCreate: canCreate ?? this.canCreate,
      canUpdate: canUpdate ?? this.canUpdate,
      canDelete: canDelete ?? this.canDelete,
      canAdjust: canAdjust ?? this.canAdjust,
      canExport: canExport ?? this.canExport,
      pendingMovementCount: pendingMovementCount ?? this.pendingMovementCount,
      isSyncingMovements: isSyncingMovements ?? this.isSyncingMovements,
    );
  }
}

class StockController extends Notifier<StockPageState> {
  final StockMovementOfflineQueue _movementQueue = StockMovementOfflineQueue();

  Exception _permissionError(String message) => Exception(message);

  @override
  StockPageState build() {
    // Initial load is triggered by StockHubScreen after first frame.
    return const StockPageState(isLoading: true);
  }

  Future<void> load() async {
    await loadPermissions();
    await refresh();
  }

  Future<void> refresh() async {
    await refreshPendingMovementCount();
    await syncPendingMovements();
    await Future.wait([fetchProducts(), fetchStatistics()]);
  }

  Future<void> refreshPendingMovementCount() async {
    try {
      final count = await _movementQueue.pendingCount();
      state = state.copyWith(pendingMovementCount: count);
    } catch (_) {}
  }

  Future<Map<String, int>> syncPendingMovements() async {
    if (state.isSyncingMovements) {
      return {'synced': 0, 'failed': 0};
    }
    state = state.copyWith(isSyncingMovements: true);
    try {
      final repo = ref.read(stockRepositoryProvider);
      final syncedProductIds = <String>{};
      final result = await _movementQueue.syncPending((entry) async {
        final qty = entry['quantity'];
        final productId = '${entry['productId']}';
        await repo.postTransaction(
          productId: productId,
          type: '${entry['type']}',
          quantity: qty is num ? qty.toDouble() : double.tryParse('$qty') ?? 0,
          unitCost: entry['unitCost'] != null
              ? (entry['unitCost'] is num
                  ? (entry['unitCost'] as num).toDouble()
                  : double.tryParse('${entry['unitCost']}'))
              : null,
          notes: entry['notes']?.toString(),
        );
        syncedProductIds.add(productId);
      });
      await refreshPendingMovementCount();
      if ((result['synced'] ?? 0) > 0) {
        await Future.wait([fetchProducts(), fetchStatistics()]);
        for (final id in syncedProductIds) {
          ref.invalidate(stockDetailsProvider(id));
          ref.invalidate(stockMovementHistoryProvider(id));
        }
      }
      return result;
    } finally {
      state = state.copyWith(isSyncingMovements: false);
    }
  }

  void applyOptimisticMovement({
    required String productId,
    required StockMovementType type,
    required double quantity,
    double? currentQty,
  }) {
    final productIndex = state.products.indexWhere((p) => p.id == productId);
    final baseQty = currentQty ??
        (productIndex >= 0 ? state.products[productIndex].quantityInStock : 0);
    final newQty = computeStockQtyAfterMovement(
      currentQty: baseQty,
      type: type,
      quantity: quantity,
    );

    if (productIndex >= 0) {
      final updated = List<StockProduct>.from(state.products);
      updated[productIndex] =
          updated[productIndex].copyWith(quantityInStock: newQty);
      state = state.copyWith(products: updated);
    }
  }

  Future<void> loadPermissions() async {
    final perms = await ref.read(userPermissionsProvider.future);
    state = state.copyWith(
      canView: satisfiesPermission(perms, 'stock.view'),
      canCreate: satisfiesPermission(perms, 'stock.create'),
      canUpdate: satisfiesPermission(perms, 'stock.update'),
      canDelete: satisfiesPermission(perms, 'stock.delete'),
      canAdjust: satisfiesPermission(perms, 'stock.adjust'),
      canExport: satisfiesPermission(perms, 'stock.export'),
    );
  }

  Future<void> fetchProducts() async {
    if (!state.canView) {
      state = state.copyWith(
        isLoading: false,
        error: 'You do not have permission to view stock.',
        products: const [],
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(stockRepositoryProvider);
      final search = state.searchQuery.isEmpty ? null : state.searchQuery;

      if (state.showDeleted) {
        final response = await repo.fetchDeletedProducts(
          page: state.currentPage,
          limit: 20,
          search: search,
        );
        state = state.copyWith(
          products: response.products,
          totalPages: response.totalPages,
          totalCount: response.totalCount,
          isLoading: false,
        );
      } else {
        final response = await repo.fetchProducts(
          page: state.currentPage,
          limit: 20,
          catalog: state.catalog,
          search: search,
          status: state.statusFilter == 'all' ? null : state.statusFilter,
          category: state.categoryFilter == 'all' ? null : state.categoryFilter,
        );
        state = state.copyWith(
          products: response.products,
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
    if (!state.canView) return;

    try {
      final repo = ref.read(stockRepositoryProvider);
      final stats = await repo.fetchStatistics(catalog: state.catalog);
      state = state.copyWith(statistics: stats);
    } catch (_) {
      // Keep prior statistics on failure.
    }
  }

  void setSearch(String query) {
    state = state.copyWith(searchQuery: query, currentPage: 1);
    fetchProducts();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status, currentPage: 1);
    fetchProducts();
  }

  void setCategoryFilter(String category) {
    state = state.copyWith(categoryFilter: category, currentPage: 1);
    fetchProducts();
  }

  void setCatalog(String catalog) {
    if (state.catalog == catalog) return;
    state = state.copyWith(
      catalog: catalog,
      currentPage: 1,
      selectedProductIds: const [],
    );
    fetchProducts();
    fetchStatistics();
  }

  void setShowDeleted(bool show) {
    state = state.copyWith(showDeleted: show, currentPage: 1);
    fetchProducts();
  }

  void setPage(int page) {
    state = state.copyWith(currentPage: page);
    fetchProducts();
  }

  void toggleProductSelection(String id) {
    final current = List<String>.from(state.selectedProductIds);
    if (current.contains(id)) {
      current.remove(id);
    } else {
      current.add(id);
    }
    state = state.copyWith(selectedProductIds: current);
  }

  void clearSelection() {
    state = state.copyWith(selectedProductIds: const []);
  }

  void selectAllProducts() {
    state = state.copyWith(
      selectedProductIds: state.products.map((p) => p.id).toList(),
    );
  }

  Future<void> deleteProduct(String id, {String? reason}) async {
    if (!state.canDelete) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    try {
      final repo = ref.read(stockRepositoryProvider);
      await repo.deleteProduct(id, reason: reason);
      await load();
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }

  Future<void> restoreSelected({String? reason}) async {
    if (!state.canDelete) {
      throw _permissionError('You do not have permission to perform this action.');
    }
    final ids = state.selectedProductIds;
    if (ids.isEmpty) return;

    try {
      final repo = ref.read(stockRepositoryProvider);
      await repo.restoreProducts(ids);
      await load();
      state = state.copyWith(selectedProductIds: const []);
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }
}

final stockControllerProvider =
    NotifierProvider<StockController, StockPageState>(StockController.new);
