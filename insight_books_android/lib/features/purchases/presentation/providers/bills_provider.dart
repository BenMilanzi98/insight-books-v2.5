import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

import '../../data/purchases_offline_helpers.dart';
import '../../data/purchases_repository.dart';
import '../../domain/purchases_models.dart';
import 'purchases_hub_provider.dart';

const billStatuses = [
  'Draft',
  'Approved',
  'Unpaid',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Cancelled',
];

final _grbPlaceholderPattern = RegExp(r'^GRB-c[a-z0-9]+$', caseSensitive: false);

/// Web `displayBillNumber` — show GR-linked label when bill number is a GRB placeholder.
String displayBillNumber(SupplierBill bill) {
  final bn = bill.billNumber;
  final grReceipt = bill.receiptNumber;
  if (grReceipt != null &&
      grReceipt.isNotEmpty &&
      _grbPlaceholderPattern.hasMatch(bn)) {
    return 'GRB-$grReceipt';
  }
  if (_grbPlaceholderPattern.hasMatch(bn)) return '—';
  return bn.isNotEmpty ? bn : '—';
}

double _roundMoney(double value) => (value * 100).roundToDouble() / 100;

class BillsStats {
  const BillsStats({
    this.total = 0,
    this.unpaid = 0,
    this.overdue = 0,
    this.outstanding = 0,
  });

  final int total;
  final int unpaid;
  final int overdue;
  final double outstanding;
}

class BillsPageState {
  const BillsPageState({
    this.bills = const [],
    this.stats,
    this.isLoading = false,
    this.error,
    this.supplierFilter = '',
    this.statusFilter = 'all',
    this.totalPages = 1,
    this.currentPage = 1,
    this.totalCount = 0,
    this.canView = true,
    this.canCreate = true,
    this.canDelete = true,
  });

  final List<SupplierBill> bills;
  final BillsStats? stats;
  final bool isLoading;
  final String? error;
  final String supplierFilter;
  final String statusFilter;
  final int totalPages;
  final int currentPage;
  final int totalCount;
  final bool canView;
  final bool canCreate;
  final bool canDelete;

  BillsPageState copyWith({
    List<SupplierBill>? bills,
    BillsStats? stats,
    bool? isLoading,
    String? error,
    String? supplierFilter,
    String? statusFilter,
    int? totalPages,
    int? currentPage,
    int? totalCount,
    bool? canView,
    bool? canCreate,
    bool? canDelete,
  }) {
    return BillsPageState(
      bills: bills ?? this.bills,
      stats: stats ?? this.stats,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      supplierFilter: supplierFilter ?? this.supplierFilter,
      statusFilter: statusFilter ?? this.statusFilter,
      totalPages: totalPages ?? this.totalPages,
      currentPage: currentPage ?? this.currentPage,
      totalCount: totalCount ?? this.totalCount,
      canView: canView ?? this.canView,
      canCreate: canCreate ?? this.canCreate,
      canDelete: canDelete ?? this.canDelete,
    );
  }
}

class BillFormSupportData {
  const BillFormSupportData({
    this.suppliers = const [],
    this.products = const [],
    this.expenseCategories = const [],
  });

  final List<PurchaseSupplier> suppliers;
  final List<Map<String, dynamic>> products;
  final List<Map<String, dynamic>> expenseCategories;
}

/// Build API payload matching web suppliers `BillForm.handleSubmit`.
Map<String, dynamic> buildBillPayload({
  required String supplierId,
  required String billDate,
  required String dueDate,
  required String billType,
  required String status,
  String? billNumber,
  String? notes,
  required List<Map<String, dynamic>> rawItems,
}) {
  double subtotal = 0;
  final items = rawItems.map((item) {
    if (billType == 'expense') {
      final amount = _roundMoney((item['amount'] as num?)?.toDouble() ?? 0);
      subtotal = _roundMoney(subtotal + amount);
      return {
        'expenseAccountId': item['expenseAccountId'],
        'amount': amount,
        if (item['description'] != null &&
            '${item['description']}'.trim().isNotEmpty)
          'description': '${item['description']}'.trim(),
      };
    }

    final quantity = (item['quantity'] as num?)?.toDouble() ?? 0;
    final unitCost = _roundMoney((item['unitCost'] as num?)?.toDouble() ?? 0);
    subtotal = _roundMoney(subtotal + quantity * unitCost);
    return {
      if (item['productId'] != null) 'productId': item['productId'],
      'quantity': quantity,
      'unitCost': unitCost,
      if (item['description'] != null &&
          '${item['description']}'.trim().isNotEmpty)
        'description': '${item['description']}'.trim(),
    };
  }).toList();

  return {
    'supplierId': supplierId,
    'billDate': billDate,
    'dueDate': dueDate,
    'billType': billType,
    'status': status,
    if (billNumber != null && billNumber.trim().isNotEmpty)
      'billNumber': billNumber.trim(),
    if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    'items': items,
    'subtotal': subtotal,
    'taxAmount': 0,
    'totalAmount': subtotal,
  };
}

bool isValidReversalReason(String reason) => reason.trim().length >= 10;

/// Human-readable label for v2.5 [SupplierBill.matchingStatus].
String formatMatchingStatusLabel(String? status) {
  if (status == null || status.isEmpty) return 'Not evaluated';
  return status
      .split('_')
      .map((part) =>
          part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}')
      .join(' ');
}

const _blockingMatchStatuses = {
  'BLOCKED',
  'OVER_BILLED',
  'RECEIPT_MISSING',
  'ORDER_MISSING',
  'WRONG_SUPPLIER',
  'WRONG_PRODUCT',
  'WRONG_CURRENCY',
  'DUPLICATE_BILL',
};

bool isBlockingMatchStatus(String? status) =>
    status != null && _blockingMatchStatuses.contains(status);

const _successfulMatchStatuses = {
  'EXACT_MATCH',
  'WITHIN_TOLERANCE',
  'MATCHED_WITH_VARIANCE',
  'NOT_REQUIRED',
};

bool isSuccessfulMatchStatus(String? status) =>
    status != null && _successfulMatchStatuses.contains(status);

class BillsController extends Notifier<BillsPageState> {
  Exception _permissionError(String message) => Exception(message);

  @override
  BillsPageState build() => const BillsPageState(isLoading: true);

  Future<void> load() async {
    await loadPermissions();
    await refresh();
  }

  Future<void> refresh() async {
    await Future.wait([fetchBills(), fetchStats()]);
  }

  Future<void> loadPermissions() async {
    final perms = await ref.read(userPermissionsProvider.future);
    state = state.copyWith(
      canView: satisfiesPermission(perms, 'purchases.view'),
      canCreate: satisfiesPermission(perms, 'purchases.create'),
      canDelete: satisfiesPermission(perms, 'purchases.delete'),
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

  Future<void> fetchBills() async {
    if (!state.canView) {
      state = state.copyWith(
        isLoading: false,
        error: 'You do not have permission to view supplier bills.',
        bills: const [],
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final response = await repo.fetchBills(
        page: state.currentPage,
        limit: 20,
        supplierId: _apiSupplierFilter(),
        status: _apiStatusFilter(),
      );
      state = state.copyWith(
        bills: response.items,
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
      final all = await repo.fetchBills(
        page: 1,
        limit: 100,
        supplierId: _apiSupplierFilter(),
      );
      final bills = all.items;
      final unpaid = bills
          .where(
            (b) => b.status == 'Unpaid' || b.status == 'Partially Paid',
          )
          .length;
      final overdue = bills.where((b) => b.status == 'Overdue').length;
      final outstanding = bills.fold<double>(
        0,
        (sum, b) => sum + (b.totalAmount - b.amountPaid),
      );

      state = state.copyWith(
        stats: BillsStats(
          total: all.totalCount,
          unpaid: unpaid,
          overdue: overdue,
          outstanding: outstanding,
        ),
      );
    } catch (_) {
      // Keep prior stats on failure.
    }
  }

  void setSupplierFilter(String supplierId) {
    state = state.copyWith(supplierFilter: supplierId, currentPage: 1);
    refresh();
  }

  void setStatusFilter(String status) {
    state = state.copyWith(statusFilter: status, currentPage: 1);
    fetchBills();
  }

  void setPage(int page) {
    state = state.copyWith(currentPage: page);
    fetchBills();
  }

  void applyOptimisticBill(SupplierBill bill) {
    final updated = [bill, ...state.bills];
    final stats = state.stats;
    state = state.copyWith(
      bills: updated,
      totalCount: state.totalCount + 1,
      stats: stats == null
          ? null
          : BillsStats(
              total: stats.total + 1,
              unpaid: bill.status == 'Unpaid' ||
                      bill.status == 'Partially Paid'
                  ? stats.unpaid + 1
                  : stats.unpaid,
              overdue:
                  bill.status == 'Overdue' ? stats.overdue + 1 : stats.overdue,
              outstanding: stats.outstanding + bill.balanceDue,
            ),
    );
  }

  Future<SupplierBill> createBill(Map<String, dynamic> body) async {
    if (!state.canCreate) {
      throw _permissionError(
        'You do not have permission to create supplier bills.',
      );
    }
    final repo = ref.read(purchasesRepositoryProvider);
    final queue = ref.read(purchasesOfflineQueueProvider);
    final tenantId = ref.read(tenantProvider).currentTenantId ?? '';
    try {
      final created = await queueOrCreateBill(repo, queue, tenantId, body);
      await refresh();
      return created;
    } on PurchasesQueuedException catch (e) {
      applyOptimisticBill(e.optimistic as SupplierBill);
      ref.invalidate(purchasesHubProvider);
      rethrow;
    }
  }

  Future<void> reverseBill(String id, {required String reason}) async {
    if (!state.canDelete) {
      throw _permissionError(
        'You do not have permission to reverse supplier bills.',
      );
    }
    if (!isValidReversalReason(reason)) {
      throw Exception('Reversal reason must be at least 10 characters.');
    }
    final repo = ref.read(purchasesRepositoryProvider);
    await repo.reverseBill(id, reason: reason.trim());
    await refresh();
    ref.invalidate(billDetailProvider(id));
  }

  Future<BillMatchResult> matchBill(String id) async {
    if (!state.canView) {
      throw _permissionError(
        'You do not have permission to evaluate bill matching.',
      );
    }
    final repo = ref.read(purchasesRepositoryProvider);
    final result = await repo.matchBill(id);
    await refresh();
    ref.invalidate(billDetailProvider(id));
    return result;
  }

  void restoreFromError() {
    state = state.copyWith(error: null);
  }
}

final billsControllerProvider =
    NotifierProvider<BillsController, BillsPageState>(
  BillsController.new,
);

final billDetailProvider =
    FutureProvider.family<SupplierBill, String>((ref, billId) async {
  final repo = ref.watch(purchasesRepositoryProvider);
  return repo.fetchBill(billId);
});

final billFormSupportProvider = FutureProvider<BillFormSupportData>((ref) async {
  final repo = ref.watch(purchasesRepositoryProvider);
  final results = await Future.wait([
    repo.fetchSuppliers(page: 1, limit: 200),
    repo.fetchProductsWithUnits(),
    repo.fetchExpenseCategories(),
  ]);
  final suppliersResponse = results[0] as PurchaseSupplierListResponse;
  return BillFormSupportData(
    suppliers: suppliersResponse.items,
    products: results[1] as List<Map<String, dynamic>>,
    expenseCategories: results[2] as List<Map<String, dynamic>>,
  );
});

double defaultProductCost(Map<String, dynamic> product) {
  double? toNumber(dynamic val) {
    if (val == null) return null;
    if (val is num) return val.toDouble();
    return double.tryParse('$val');
  }

  for (final key in [
    'lastPurchaseCost',
    'cost',
    'averageCost',
    'costPrice',
    'purchasePrice',
    'unitCost',
  ]) {
    final c = toNumber(product[key]);
    if (c != null && c > 0) return c;
  }
  return 0;
}
