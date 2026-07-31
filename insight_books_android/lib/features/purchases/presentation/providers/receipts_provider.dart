import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

import '../../data/purchases_offline_helpers.dart';
import '../../data/purchases_repository.dart';
import '../../domain/purchases_models.dart';
import 'purchases_hub_provider.dart';

const receiptStatuses = ['Draft', 'Posted'];

enum ReceiptMode { inventory, service }

extension ReceiptModeX on ReceiptMode {
  String get apiValue =>
      this == ReceiptMode.service ? 'service' : 'inventory';

  String get label =>
      this == ReceiptMode.service ? 'Service Receipt' : 'Inventory Receipt';
}

class ReceiptsStats {
  const ReceiptsStats({
    this.total = 0,
    this.draft = 0,
    this.posted = 0,
    this.pendingStock = 0,
    this.postedInventoryValue = 0,
  });

  final int total;
  final int draft;
  final int posted;
  final int pendingStock;
  final double postedInventoryValue;
}

class ReceiptsPageState {
  const ReceiptsPageState({
    this.receipts = const [],
    this.stats,
    this.isLoading = false,
    this.error,
    this.receiptMode = ReceiptMode.inventory,
    this.supplierFilter = '',
    this.statusFilter = 'all',
    this.totalPages = 1,
    this.currentPage = 1,
    this.totalCount = 0,
    this.canView = true,
    this.canCreate = true,
  });

  final List<GoodsReceipt> receipts;
  final ReceiptsStats? stats;
  final bool isLoading;
  final String? error;
  final ReceiptMode receiptMode;
  final String supplierFilter;
  final String statusFilter;
  final int totalPages;
  final int currentPage;
  final int totalCount;
  final bool canView;
  final bool canCreate;

  ReceiptsPageState copyWith({
    List<GoodsReceipt>? receipts,
    ReceiptsStats? stats,
    bool? isLoading,
    String? error,
    ReceiptMode? receiptMode,
    String? supplierFilter,
    String? statusFilter,
    int? totalPages,
    int? currentPage,
    int? totalCount,
    bool? canView,
    bool? canCreate,
  }) {
    return ReceiptsPageState(
      receipts: receipts ?? this.receipts,
      stats: stats ?? this.stats,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      receiptMode: receiptMode ?? this.receiptMode,
      supplierFilter: supplierFilter ?? this.supplierFilter,
      statusFilter: statusFilter ?? this.statusFilter,
      totalPages: totalPages ?? this.totalPages,
      currentPage: currentPage ?? this.currentPage,
      totalCount: totalCount ?? this.totalCount,
      canView: canView ?? this.canView,
      canCreate: canCreate ?? this.canCreate,
    );
  }
}

class ReceiptFormSupportData {
  const ReceiptFormSupportData({
    this.suppliers = const [],
    this.products = const [],
    this.purchaseOrders = const [],
  });

  final List<PurchaseSupplier> suppliers;
  final List<Map<String, dynamic>> products;
  final List<PurchaseOrder> purchaseOrders;

  Map<String, bool> get productPerishableMap {
    final map = <String, bool>{};
    for (final p in products) {
      final id = p['id']?.toString();
      if (id == null || id.isEmpty) continue;
      map[id] = p['isPerishable'] == true;
    }
    return map;
  }
}

/// Per-unit cost for a goods receipt line (web `receiptUnitCostFromPurchaseOrderLine`).
double receiptUnitCostFromPurchaseOrderLine(
  PurchaseOrderItem poLine,
  bool pricesIncludeTax,
) {
  final unitCost = poLine.unitCost;
  final ordered = poLine.quantityOrdered;
  final taxAmount = poLine.taxAmount;

  double out;
  if (pricesIncludeTax) {
    out = unitCost;
  } else if (ordered <= 0 || taxAmount == 0) {
    out = unitCost;
  } else {
    out = unitCost + taxAmount / ordered;
  }

  if (!out.isFinite || out < 0) {
    return unitCost.isFinite && unitCost >= 0 ? unitCost : 0;
  }
  return out;
}

DateTime? purchaseOrderReceiptAnchor(PurchaseOrder? po) {
  if (po == null) return null;
  return po.poDate;
}

String? purchaseOrderMinReceiptDateStr(PurchaseOrder? po) {
  final d = purchaseOrderReceiptAnchor(po);
  if (d == null) return null;
  return _formatYyyyMmDd(d);
}

String _formatYyyyMmDd(DateTime d) {
  final y = d.year.toString().padLeft(4, '0');
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}

void assertReceiptDateOnOrAfterPurchaseOrder(
  String receiptDateStr,
  PurchaseOrder purchaseOrder,
) {
  final ordStr = purchaseOrderMinReceiptDateStr(purchaseOrder);
  if (ordStr == null) return;
  final recStr = receiptDateStr.trim();
  if (recStr.isEmpty) return;
  if (recStr.compareTo(ordStr) < 0) {
    throw Exception(
      'Receipt date cannot be earlier than the purchase order date. '
      'Use the same date as the order or a later date.',
    );
  }
}

bool isReceiptDateStrictlyAfterTodayUtc(String receiptDateStr) {
  final now = DateTime.now().toUtc();
  final todayMs = DateTime.utc(now.year, now.month, now.day).millisecondsSinceEpoch;
  final parts = receiptDateStr.split('-');
  if (parts.length < 3) return false;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return false;
  final receiptMs = DateTime.utc(y, m, d).millisecondsSinceEpoch;
  return receiptMs > todayMs;
}

bool purchaseOrderEligibleForReceipt(
  PurchaseOrder po,
  ReceiptMode mode,
) {
  if (po.status == 'Received') return false;
  if (po.status != 'Approved' && po.status != 'Partially Received') {
    return false;
  }
  if (mode == ReceiptMode.service) {
    return po.orderType == 'services' || po.orderType == 'mixed';
  }
  return po.orderType == 'goods' ||
      po.orderType == 'mixed' ||
      po.orderType == 'assets';
}

List<PurchaseOrderItem> openGoodsLinesFromPo(
  PurchaseOrder po,
  Map<String, bool> productPerishableMap,
) {
  final goodsItems = po.items.where(
    (line) =>
        line.productId != null &&
        line.productId!.isNotEmpty &&
        (line.lineType == 'goods' || line.lineType.isEmpty),
  );

  return goodsItems.where((line) {
    final already = line.quantityReceived;
    final rem = line.quantityOrdered - already;
    return rem > 0;
  }).toList();
}

List<Map<String, dynamic>> buildInventoryReceiptItemsPayload(
  List<Map<String, dynamic>> rawItems,
) {
  const epsilon = 1e-6;

  return rawItems.map((row) {
    final isPerishable = row['isPerishable'] == true;
    final qty = (row['quantityReceived'] as num?)?.toDouble() ?? 0;
    final unitCost = (row['unitCost'] as num?)?.toDouble() ?? 0;
    final allocations = row['expiryAllocations'] as List<dynamic>? ?? [];

    if (isPerishable) {
      if (allocations.isEmpty) {
        throw Exception(
          'Add at least one expiry allocation for perishable items.',
        );
      }
      final sumQty = allocations.fold<double>(
        0,
        (sum, a) => sum + ((a as Map)['qty'] as num? ?? 0).toDouble(),
      );
      if ((sumQty - qty).abs() > epsilon) {
        throw Exception(
          'Allocation quantity total ($sumQty) must equal received quantity ($qty).',
        );
      }
      for (var i = 0; i < allocations.length; i++) {
        final alloc = Map<String, dynamic>.from(allocations[i] as Map);
        if (((alloc['qty'] as num?)?.toDouble() ?? 0) <= 0) {
          throw Exception('Allocation ${i + 1}: qty must be greater than 0.');
        }
        if ((alloc['expiryDate']?.toString() ?? '').isEmpty) {
          throw Exception('Allocation ${i + 1}: expiry date is required.');
        }
      }
    }

    final expiryAllocations = isPerishable
        ? allocations.map((a) {
            final alloc = Map<String, dynamic>.from(a as Map);
            return {
              'qty': (alloc['qty'] as num?)?.toDouble() ?? 0,
              'expiryDate': alloc['expiryDate'],
              'unitCost': alloc['unitCost'] != null &&
                      alloc['unitCost'].toString().isNotEmpty
                  ? (alloc['unitCost'] as num).toDouble()
                  : unitCost,
            };
          }).toList()
        : <Map<String, dynamic>>[];

    String? expiryDate;
    if (isPerishable && expiryAllocations.length == 1) {
      expiryDate = expiryAllocations.first['expiryDate']?.toString();
    }

    final poItemId = row['poItemId']?.toString();
    return {
      'productId': row['productId'],
      'quantityReceived': qty,
      'unitCost': unitCost,
      'isPerishable': isPerishable,
      'expiryAllocations': expiryAllocations,
      if (expiryDate != null && expiryDate.isNotEmpty) 'expiryDate': expiryDate,
      if (poItemId != null && poItemId.isNotEmpty) 'poItemId': poItemId,
    };
  }).toList();
}

/// Build API payload matching web `ReceiptForm.handleSubmit`.
Map<String, dynamic> buildReceiptPayload({
  required ReceiptMode mode,
  required String supplierId,
  required String receiptDate,
  String? purchaseOrderId,
  required String status,
  String? notes,
  required List<Map<String, dynamic>> rawItems,
}) {
  if (mode == ReceiptMode.service) {
    return {
      'supplierId': supplierId,
      'receiptDate': receiptDate,
      if (purchaseOrderId != null && purchaseOrderId.isNotEmpty)
        'purchaseOrderId': purchaseOrderId,
      'status': status,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      'receiptType': 'service',
      'items': <Map<String, dynamic>>[],
    };
  }

  return {
    'supplierId': supplierId,
    'receiptDate': receiptDate,
    if (purchaseOrderId != null && purchaseOrderId.isNotEmpty)
      'purchaseOrderId': purchaseOrderId,
    'status': 'Posted',
    if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    'receiptType': 'inventory',
    'items': buildInventoryReceiptItemsPayload(rawItems),
  };
}

class ReceiptsController extends Notifier<ReceiptsPageState> {
  Exception _permissionError(String message) => Exception(message);

  @override
  ReceiptsPageState build() {
    return const ReceiptsPageState(isLoading: true);
  }

  Future<void> load() async {
    await loadPermissions();
    await refresh();
  }

  Future<void> refresh() async {
    await fetchReceipts();
  }

  Future<void> loadPermissions() async {
    final perms = await ref.read(userPermissionsProvider.future);
    state = state.copyWith(
      canView: satisfiesPermission(perms, 'purchases.view'),
      canCreate: satisfiesPermission(perms, 'purchases.create'),
    );
  }

  String? _apiStatusFilter() {
    if (state.statusFilter == 'all') return null;
    return state.statusFilter;
  }

  String? _apiSupplierFilter() {
    if (state.supplierFilter.isEmpty) return null;
    return state.supplierFilter;
  }

  List<GoodsReceipt> _filterByMode(List<GoodsReceipt> all) {
    final want = state.receiptMode.apiValue;
    return all
        .where((r) => (r.receiptType ?? 'inventory') == want)
        .toList();
  }

  ReceiptsStats _computeStats(List<GoodsReceipt> receipts) {
    final draft = receipts.where((r) => r.status == 'Draft').length;
    final posted = receipts.where((r) => r.status == 'Posted').length;
    final pendingStock =
        receipts.where((r) => r.stockPostingPending).length;
    final inventoryValue = receipts
        .where((r) => r.status == 'Posted')
        .fold<double>(0, (sum, r) => sum + r.totalAmount);

    return ReceiptsStats(
      total: receipts.length,
      draft: draft,
      posted: posted,
      pendingStock: pendingStock,
      postedInventoryValue: inventoryValue,
    );
  }

  Future<void> fetchReceipts() async {
    if (!state.canView) {
      state = state.copyWith(
        isLoading: false,
        error: 'You do not have permission to view receipts.',
        receipts: const [],
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final response = await repo.fetchReceipts(
        page: state.currentPage,
        limit: 50,
        supplierId: _apiSupplierFilter(),
        status: _apiStatusFilter(),
      );
      final filtered = _filterByMode(response.items);
      state = state.copyWith(
        receipts: filtered,
        stats: _computeStats(filtered),
        totalPages: response.totalPages,
        totalCount: filtered.length,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: NetworkErrorMapper.toUserMessage(e),
      );
    }
  }

  void setReceiptMode(ReceiptMode mode) {
    state = state.copyWith(receiptMode: mode, currentPage: 1);
    fetchReceipts();
  }

  void setSupplierFilter(String supplierId) {
    state = state.copyWith(supplierFilter: supplierId, currentPage: 1);
    fetchReceipts();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status, currentPage: 1);
    fetchReceipts();
  }

  void setPage(int page) {
    state = state.copyWith(currentPage: page);
    fetchReceipts();
  }

  void applyOptimisticReceipt(GoodsReceipt receipt) {
    if ((receipt.receiptType ?? 'inventory') != state.receiptMode.apiValue) {
      return;
    }
    final updated = [receipt, ...state.receipts];
    state = state.copyWith(
      receipts: updated,
      stats: _computeStats(updated),
      totalCount: updated.length,
    );
  }

  Future<GoodsReceipt> createReceipt(Map<String, dynamic> body) async {
    if (!state.canCreate) {
      throw _permissionError(
        'You do not have permission to create receipts.',
      );
    }
    final repo = ref.read(purchasesRepositoryProvider);
    final queue = ref.read(purchasesOfflineQueueProvider);
    final tenantId = ref.read(tenantProvider).currentTenantId ?? '';
    try {
      final created = await queueOrCreateReceipt(repo, queue, tenantId, body);
      await refresh();
      return created;
    } on PurchasesQueuedException catch (e) {
      applyOptimisticReceipt(e.optimistic as GoodsReceipt);
      ref.invalidate(purchasesHubProvider);
      rethrow;
    }
  }

  void restoreFromError() {
    state = state.copyWith(error: null);
  }
}

final receiptsControllerProvider =
    NotifierProvider<ReceiptsController, ReceiptsPageState>(
  ReceiptsController.new,
);

final receiptFormSupportProvider =
    FutureProvider.family<ReceiptFormSupportData, ReceiptMode>(
  (ref, mode) async {
    final repo = ref.watch(purchasesRepositoryProvider);
    final results = await Future.wait([
      repo.fetchSuppliers(page: 1, limit: 200, status: 'active'),
      repo.fetchProductsWithUnits(),
      repo.fetchOrders(page: 1, limit: 100),
    ]);

    final suppliersResponse = results[0] as PurchaseSupplierListResponse;
    final products = results[1] as List<Map<String, dynamic>>;
    final ordersResponse = results[2] as PurchaseOrderListResponse;

    final eligibleOrders = ordersResponse.items
        .where((po) => purchaseOrderEligibleForReceipt(po, mode))
        .toList();

    return ReceiptFormSupportData(
      suppliers: suppliersResponse.items,
      products: products,
      purchaseOrders: eligibleOrders,
    );
  },
);
