import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

import '../../data/purchases_offline_helpers.dart';
import '../../data/purchases_repository.dart';
import '../../domain/purchases_models.dart';
import 'purchases_hub_provider.dart';

const purchaseOrderStatuses = [
  'Draft',
  'Approved',
  'Sent',
  'Partially Received',
  'Received',
  'Cancelled',
];

class OrdersStats {
  const OrdersStats({
    this.totalCount = 0,
    this.awaitingApproval = 0,
    this.awaitingReceipt = 0,
    this.openAmount = 0,
  });

  final int totalCount;
  final int awaitingApproval;
  final int awaitingReceipt;
  final double openAmount;
}

class OrdersPageState {
  const OrdersPageState({
    this.orders = const [],
    this.stats,
    this.isLoading = false,
    this.error,
    this.searchQuery = '',
    this.statusFilter = 'all',
    this.totalPages = 1,
    this.currentPage = 1,
    this.totalCount = 0,
    this.canView = true,
    this.canCreate = true,
    this.canUpdate = true,
    this.canDelete = true,
  });

  final List<PurchaseOrder> orders;
  final OrdersStats? stats;
  final bool isLoading;
  final String? error;
  final String searchQuery;
  final String statusFilter;
  final int totalPages;
  final int currentPage;
  final int totalCount;
  final bool canView;
  final bool canCreate;
  final bool canUpdate;
  final bool canDelete;

  OrdersPageState copyWith({
    List<PurchaseOrder>? orders,
    OrdersStats? stats,
    bool? isLoading,
    String? error,
    String? searchQuery,
    String? statusFilter,
    int? totalPages,
    int? currentPage,
    int? totalCount,
    bool? canView,
    bool? canCreate,
    bool? canUpdate,
    bool? canDelete,
  }) {
    return OrdersPageState(
      orders: orders ?? this.orders,
      stats: stats ?? this.stats,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      searchQuery: searchQuery ?? this.searchQuery,
      statusFilter: statusFilter ?? this.statusFilter,
      totalPages: totalPages ?? this.totalPages,
      currentPage: currentPage ?? this.currentPage,
      totalCount: totalCount ?? this.totalCount,
      canView: canView ?? this.canView,
      canCreate: canCreate ?? this.canCreate,
      canUpdate: canUpdate ?? this.canUpdate,
      canDelete: canDelete ?? this.canDelete,
    );
  }
}

class OrderFormSupportData {
  const OrderFormSupportData({
    this.suppliers = const [],
    this.products = const [],
    this.expenseCategories = const [],
    this.taxTypes = const [],
  });

  final List<PurchaseSupplier> suppliers;
  final List<Map<String, dynamic>> products;
  final List<Map<String, dynamic>> expenseCategories;
  final List<Map<String, dynamic>> taxTypes;
}

class OrdersController extends Notifier<OrdersPageState> {
  Exception _permissionError(String message) => Exception(message);

  @override
  OrdersPageState build() {
    return const OrdersPageState(isLoading: true);
  }

  Future<void> load() async {
    await loadPermissions();
    await refresh();
  }

  Future<void> refresh() async {
    await Future.wait([fetchOrders(), fetchStats()]);
  }

  Future<void> loadPermissions() async {
    final perms = await ref.read(userPermissionsProvider.future);
    state = state.copyWith(
      canView: satisfiesPermission(perms, 'purchases.view'),
      canCreate: satisfiesPermission(perms, 'purchases.create'),
      canUpdate: satisfiesPermission(perms, 'purchases.update'),
      canDelete: satisfiesPermission(perms, 'purchases.delete'),
    );
  }

  String? _apiStatusFilter() {
    if (state.statusFilter == 'all') return null;
    return state.statusFilter;
  }

  Future<void> fetchOrders() async {
    if (!state.canView) {
      state = state.copyWith(
        isLoading: false,
        error: 'You do not have permission to view purchase orders.',
        orders: const [],
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final search =
          state.searchQuery.trim().isEmpty ? null : state.searchQuery.trim();
      final response = await repo.fetchOrders(
        page: state.currentPage,
        limit: 20,
        search: search,
        status: _apiStatusFilter(),
      );
      state = state.copyWith(
        orders: response.items,
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
      final all = await repo.fetchOrders(page: 1, limit: 100);
      final orders = all.items;
      final awaitingApproval = orders
          .where((o) => o.status == 'Draft' || o.status == 'Sent')
          .length;
      final awaitingReceipt = orders
          .where(
            (o) =>
                o.status == 'Approved' || o.status == 'Partially Received',
          )
          .length;
      final openAmount = orders
          .where((o) => o.status != 'Cancelled')
          .fold<double>(0, (sum, o) => sum + o.totalAmount);

      state = state.copyWith(
        stats: OrdersStats(
          totalCount: all.totalCount,
          awaitingApproval: awaitingApproval,
          awaitingReceipt: awaitingReceipt,
          openAmount: openAmount,
        ),
      );
    } catch (_) {
      // Keep prior stats on failure.
    }
  }

  void setSearch(String query) {
    state = state.copyWith(searchQuery: query, currentPage: 1);
    fetchOrders();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status, currentPage: 1);
    fetchOrders();
  }

  void setPage(int page) {
    state = state.copyWith(currentPage: page);
    fetchOrders();
  }

  void applyOptimisticOrder(PurchaseOrder order) {
    final updated = [order, ...state.orders];
    final stats = state.stats;
    state = state.copyWith(
      orders: updated,
      totalCount: state.totalCount + 1,
      stats: stats == null
          ? null
          : OrdersStats(
              totalCount: stats.totalCount + 1,
              awaitingApproval: order.status == 'Draft' ||
                      order.status == 'Sent'
                  ? stats.awaitingApproval + 1
                  : stats.awaitingApproval,
              awaitingReceipt: order.status == 'Approved' ||
                      order.status == 'Partially Received'
                  ? stats.awaitingReceipt + 1
                  : stats.awaitingReceipt,
              openAmount: stats.openAmount + order.totalAmount,
            ),
    );
  }

  Future<PurchaseOrder> createOrder(Map<String, dynamic> body) async {
    if (!state.canCreate) {
      throw _permissionError(
        'You do not have permission to create purchase orders.',
      );
    }
    final repo = ref.read(purchasesRepositoryProvider);
    final queue = ref.read(purchasesOfflineQueueProvider);
    final tenantId = ref.read(tenantProvider).currentTenantId ?? '';
    try {
      final created = await queueOrCreateOrder(repo, queue, tenantId, body);
      await refresh();
      return created;
    } on PurchasesQueuedException catch (e) {
      applyOptimisticOrder(e.optimistic as PurchaseOrder);
      ref.invalidate(purchasesHubProvider);
      rethrow;
    }
  }

  Future<PurchaseOrder> updateOrder(
    String id,
    Map<String, dynamic> body,
  ) async {
    if (!state.canUpdate) {
      throw _permissionError(
        'You do not have permission to update purchase orders.',
      );
    }
    final repo = ref.read(purchasesRepositoryProvider);
    final updated = await repo.updateOrder(id, body);
    await refresh();
    ref.invalidate(orderDetailProvider(id));
    return updated;
  }

  Future<void> cancelOrder(String id) async {
    if (!state.canDelete) {
      throw _permissionError(
        'You do not have permission to cancel purchase orders.',
      );
    }
    final repo = ref.read(purchasesRepositoryProvider);
    await repo.deleteOrder(id);
    await refresh();
    ref.invalidate(orderDetailProvider(id));
  }

  Future<void> uploadInvoice(
    String id,
    List<int> bytes,
    String filename,
  ) async {
    if (!state.canUpdate) {
      throw _permissionError(
        'You do not have permission to upload supplier invoices.',
      );
    }
    final repo = ref.read(purchasesRepositoryProvider);
    await repo.uploadOrderInvoice(id, bytes, filename);
    ref.invalidate(orderDetailProvider(id));
  }

  void restoreFromError() {
    state = state.copyWith(error: null);
  }
}

double roundMoney(double value) =>
    (value * 100).roundToDouble() / 100;

double multiplyMoney(double a, double b) => roundMoney(a * b);

double subtractMoney(double a, double b) => roundMoney(a - b);

double percentOfMoney(double base, double ratePct) =>
    roundMoney(base * ratePct / 100);

/// Build API payload matching web `OrderForm.handleSubmit`.
Map<String, dynamic> buildOrderPayload({
  required String supplierId,
  required String orderType,
  required String poDate,
  String? expectedDeliveryDate,
  required String status,
  String? notes,
  required bool pricesIncludeTax,
  required List<Map<String, dynamic>> rawItems,
}) {
  final normalizedItems = rawItems.map((item) {
    final qty = (item['quantityOrdered'] as num?)?.toDouble() ?? 0;
    final unitCost = roundMoney((item['unitCost'] as num?)?.toDouble() ?? 0);
    final taxRatePct = (item['taxRate'] as num?)?.toDouble() ?? 0;
    double lineSub;
    var taxAmount = roundMoney((item['taxAmount'] as num?)?.toDouble() ?? 0);

    if (pricesIncludeTax && taxRatePct > 0) {
      final lineTotalInclusive = multiplyMoney(qty, unitCost);
      lineSub = roundMoney(lineTotalInclusive / (1 + taxRatePct / 100));
      taxAmount = subtractMoney(lineTotalInclusive, lineSub);
    } else {
      lineSub = multiplyMoney(qty, unitCost);
      if (taxAmount == 0 && taxRatePct > 0) {
        taxAmount = percentOfMoney(lineSub, taxRatePct);
      }
    }

    final lineType = orderType == 'assets'
        ? 'asset'
        : orderType == 'goods'
            ? 'goods'
            : (item['lineType']?.toString() ??
                (item['productId'] != null ? 'goods' : 'service'));

    final map = <String, dynamic>{
      'lineType': lineType,
      'quantityOrdered': qty,
      'unitCost': unitCost,
      'taxRate': taxRatePct,
      'taxAmount': roundMoney(taxAmount),
    };

    final productId = item['productId']?.toString();
    if (productId != null && productId.isNotEmpty) map['productId'] = productId;

    final productUnitId = item['productUnitId']?.toString();
    if (productUnitId != null && productUnitId.isNotEmpty) {
      map['productUnitId'] = productUnitId;
    }

    final expenseCategoryId = item['expenseCategoryId']?.toString();
    if (expenseCategoryId != null && expenseCategoryId.isNotEmpty) {
      map['expenseCategoryId'] = expenseCategoryId;
    }

    final description = item['description']?.toString().trim();
    if (description != null && description.isNotEmpty) {
      map['description'] = description;
    }

    final taxTypeId = item['taxTypeId']?.toString();
    if (taxTypeId != null && taxTypeId.isNotEmpty) {
      map['taxTypeId'] = taxTypeId;
    }

    return map;
  }).toList();

  return {
    'supplierId': supplierId,
    'orderType': orderType,
    'poDate': poDate,
    if (expectedDeliveryDate != null && expectedDeliveryDate.isNotEmpty)
      'expectedDeliveryDate': expectedDeliveryDate,
    'status': status,
    if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    'pricesIncludeTax': pricesIncludeTax,
    'items': normalizedItems,
  };
}

double defaultProductCost(Map<String, dynamic> product) {
  double? toNumber(dynamic val) {
    if (val == null) return null;
    if (val is num) return val.toDouble();
    return double.tryParse('$val');
  }

  final candidates = [
    toNumber(product['lastPurchaseCost']),
    toNumber(product['cost']),
    toNumber(product['averageCost']),
    toNumber(product['costPrice']),
    toNumber(product['purchasePrice']),
    toNumber(product['unitCost']),
  ];
  for (final c in candidates) {
    if (c != null && c > 0) return c;
  }
  return 0;
}

final ordersControllerProvider =
    NotifierProvider<OrdersController, OrdersPageState>(
  OrdersController.new,
);

final orderDetailProvider =
    FutureProvider.family<PurchaseOrder, String>((ref, orderId) async {
  final repo = ref.watch(purchasesRepositoryProvider);
  return repo.fetchOrder(orderId);
});

final orderFormSupportProvider = FutureProvider<OrderFormSupportData>((ref) async {
  final repo = ref.watch(purchasesRepositoryProvider);
  final results = await Future.wait([
    repo.fetchSuppliers(page: 1, limit: 200),
    repo.fetchProductsWithUnits(),
    repo.fetchExpenseCategories(),
    repo.fetchTaxTypes(),
  ]);
  final suppliersResponse = results[0] as PurchaseSupplierListResponse;
  return OrderFormSupportData(
    suppliers: suppliersResponse.items,
    products: results[1] as List<Map<String, dynamic>>,
    expenseCategories: results[2] as List<Map<String, dynamic>>,
    taxTypes: results[3] as List<Map<String, dynamic>>,
  );
});
