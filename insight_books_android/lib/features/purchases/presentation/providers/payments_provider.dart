import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

import '../../data/purchases_offline_helpers.dart';
import '../../data/purchases_repository.dart';
import '../../domain/purchases_models.dart';
import 'bills_provider.dart' show billsControllerProvider;
import 'purchases_hub_provider.dart';

final _grbPlaceholderPattern =
    RegExp(r'^GRB-c[a-z0-9]+$', caseSensitive: false);

double _roundMoney(double value) => (value * 100).roundToDouble() / 100;

bool _looksLikeRecordId(String? value) {
  if (value == null || value.isEmpty) return false;
  return value.length > 20 && RegExp(r'^[a-z0-9]+$', caseSensitive: false).hasMatch(value);
}

/// Web `displayPaymentMethod` parity.
String displayPaymentMethod(SupplierPayment payment) {
  if (payment.paymentMethodName != null &&
      payment.paymentMethodName!.isNotEmpty) {
    return payment.paymentMethodName!;
  }
  final method = payment.paymentAccountId;
  if (_looksLikeRecordId(method)) return 'Unknown method';
  return method ?? '—';
}

String displayAllocationBillNumber(SupplierPaymentAllocation allocation) {
  final bn = allocation.billNumber ?? '';
  final grReceipt = allocation.receiptNumber;
  if (grReceipt != null &&
      grReceipt.isNotEmpty &&
      _grbPlaceholderPattern.hasMatch(bn)) {
    return 'GRB-$grReceipt';
  }
  if (_grbPlaceholderPattern.hasMatch(bn)) return '—';
  return bn.isNotEmpty ? bn : '—';
}

class PaymentsStats {
  const PaymentsStats({
    this.total = 0,
    this.totalAmount = 0,
    this.monthAmount = 0,
    this.avg = 0,
  });

  final int total;
  final double totalAmount;
  final double monthAmount;
  final double avg;
}

class PaymentsPageState {
  const PaymentsPageState({
    this.payments = const [],
    this.stats,
    this.isLoading = false,
    this.error,
    this.supplierFilter = '',
    this.totalPages = 1,
    this.currentPage = 1,
    this.totalCount = 0,
    this.canView = true,
    this.canCreate = true,
  });

  final List<SupplierPayment> payments;
  final PaymentsStats? stats;
  final bool isLoading;
  final String? error;
  final String supplierFilter;
  final int totalPages;
  final int currentPage;
  final int totalCount;
  final bool canView;
  final bool canCreate;

  PaymentsPageState copyWith({
    List<SupplierPayment>? payments,
    PaymentsStats? stats,
    bool? isLoading,
    String? error,
    String? supplierFilter,
    int? totalPages,
    int? currentPage,
    int? totalCount,
    bool? canView,
    bool? canCreate,
  }) {
    return PaymentsPageState(
      payments: payments ?? this.payments,
      stats: stats ?? this.stats,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      supplierFilter: supplierFilter ?? this.supplierFilter,
      totalPages: totalPages ?? this.totalPages,
      currentPage: currentPage ?? this.currentPage,
      totalCount: totalCount ?? this.totalCount,
      canView: canView ?? this.canView,
      canCreate: canCreate ?? this.canCreate,
    );
  }
}

class PaymentFormSupportData {
  const PaymentFormSupportData({
    this.suppliers = const [],
    this.unpaidBills = const [],
    this.paymentAccounts = const [],
  });

  final List<PurchaseSupplier> suppliers;
  final List<SupplierBill> unpaidBills;
  final List<Map<String, dynamic>> paymentAccounts;
}

class PaymentAllocationDraft {
  PaymentAllocationDraft({
    required this.billId,
    this.billNumber,
    this.receiptNumber,
    this.dueDate,
    this.balanceDue = 0,
    this.amount = 0,
  });

  final String billId;
  final String? billNumber;
  final String? receiptNumber;
  final DateTime? dueDate;
  final double balanceDue;
  double amount;
}

/// Build API payload matching web `PaymentForm.handleSubmit`.
Map<String, dynamic> buildPaymentPayload({
  required String supplierId,
  required String paymentDate,
  String? paymentMethod,
  String? referenceNumber,
  String? notes,
  required List<PaymentAllocationDraft> allocations,
}) {
  final positive = allocations.where((a) => a.amount > 0).toList();
  final totalAmount = _roundMoney(
    positive.fold<double>(0, (sum, a) => sum + a.amount),
  );

  return {
    'supplierId': supplierId,
    'paymentDate': paymentDate,
    if (paymentMethod != null && paymentMethod.isNotEmpty)
      'paymentMethod': paymentMethod,
    if (referenceNumber != null && referenceNumber.trim().isNotEmpty)
      'referenceNumber': referenceNumber.trim(),
    if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    'totalAmount': totalAmount,
    'allocations': positive
        .map(
          (a) => {
            'billId': a.billId,
            'amount': _roundMoney(a.amount),
          },
        )
        .toList(),
  };
}

/// Web parity: total must be > 0; each allocation ≤ bill balance.
String? validatePaymentAllocations(List<PaymentAllocationDraft> allocations) {
  final positive = allocations.where((a) => a.amount > 0).toList();
  if (positive.isEmpty) {
    return 'Enter at least one bill allocation greater than zero.';
  }

  for (final alloc in positive) {
    if (alloc.amount > alloc.balanceDue + 0.001) {
      final label = alloc.billNumber ?? alloc.billId;
      return 'Allocation for bill $label exceeds remaining balance.';
    }
  }

  return null;
}

double totalAllocationsAmount(List<PaymentAllocationDraft> allocations) {
  return _roundMoney(
    allocations.fold<double>(0, (sum, a) => sum + a.amount),
  );
}

List<PaymentAllocationDraft> draftsForSupplierBills(
  List<SupplierBill> bills,
  String supplierId,
) {
  return bills
      .where(
        (b) => b.supplierId == supplierId && b.balanceDue > 0,
      )
      .map(
        (b) => PaymentAllocationDraft(
          billId: b.id,
          billNumber: b.billNumber,
          receiptNumber: b.receiptNumber,
          dueDate: b.dueDate,
          balanceDue: b.balanceDue,
        ),
      )
      .toList();
}

class PaymentsController extends Notifier<PaymentsPageState> {
  Exception _permissionError(String message) => Exception(message);

  @override
  PaymentsPageState build() => const PaymentsPageState(isLoading: true);

  Future<void> load() async {
    await loadPermissions();
    await refresh();
  }

  Future<void> refresh() async {
    await Future.wait([fetchPayments(), fetchStats()]);
  }

  Future<void> loadPermissions() async {
    final perms = await ref.read(userPermissionsProvider.future);
    state = state.copyWith(
      canView: satisfiesPermission(perms, 'purchases.view'),
      canCreate: satisfiesPermission(perms, 'purchases.create'),
    );
  }

  String? _apiSupplierFilter() {
    if (state.supplierFilter.isEmpty) return null;
    return state.supplierFilter;
  }

  Future<void> fetchPayments() async {
    if (!state.canView) {
      state = state.copyWith(
        isLoading: false,
        error: 'You do not have permission to view supplier payments.',
        payments: const [],
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final response = await repo.fetchPayments(
        page: state.currentPage,
        limit: 20,
        supplierId: _apiSupplierFilter(),
      );
      state = state.copyWith(
        payments: response.items,
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
      final all = await repo.fetchPayments(
        page: 1,
        limit: 100,
        supplierId: _apiSupplierFilter(),
      );
      final payments = all.items;
      final totalAmount = payments.fold<double>(
        0,
        (sum, p) => sum + p.amount,
      );
      final now = DateTime.now();
      final monthAmount = payments
          .where((p) {
            final d = p.paymentDate;
            if (d == null) return false;
            return d.month == now.month && d.year == now.year;
          })
          .fold<double>(0, (sum, p) => sum + p.amount);
      final avg = payments.isEmpty ? 0.0 : totalAmount / payments.length;

      state = state.copyWith(
        stats: PaymentsStats(
          total: all.totalCount,
          totalAmount: totalAmount,
          monthAmount: monthAmount,
          avg: avg,
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

  void setPage(int page) {
    state = state.copyWith(currentPage: page);
    fetchPayments();
  }

  void applyOptimisticPayment(SupplierPayment payment) {
    final updated = [payment, ...state.payments];
    final stats = state.stats;
    state = state.copyWith(
      payments: updated,
      totalCount: state.totalCount + 1,
      stats: stats == null
          ? null
          : PaymentsStats(
              total: stats.total + 1,
              totalAmount: stats.totalAmount + payment.amount,
              monthAmount: stats.monthAmount,
              avg: stats.avg,
            ),
    );
  }

  Future<SupplierPayment> createPayment(Map<String, dynamic> body) async {
    if (!state.canCreate) {
      throw _permissionError(
        'You do not have permission to record supplier payments.',
      );
    }
    final repo = ref.read(purchasesRepositoryProvider);
    final queue = ref.read(purchasesOfflineQueueProvider);
    final tenantId = ref.read(tenantProvider).currentTenantId ?? '';
    try {
      final created = await queueOrCreatePayment(repo, queue, tenantId, body);
      await refresh();
      ref.invalidate(billsControllerProvider);
      return created;
    } on PurchasesQueuedException catch (e) {
      applyOptimisticPayment(e.optimistic as SupplierPayment);
      ref.invalidate(purchasesHubProvider);
      rethrow;
    }
  }

  void restoreFromError() {
    state = state.copyWith(error: null);
  }
}

final paymentsControllerProvider =
    NotifierProvider<PaymentsController, PaymentsPageState>(
  PaymentsController.new,
);

final paymentDetailProvider =
    FutureProvider.family<SupplierPayment, String>((ref, paymentId) async {
  final repo = ref.watch(purchasesRepositoryProvider);
  return repo.fetchPayment(paymentId);
});

final paymentFormSupportProvider =
    FutureProvider<PaymentFormSupportData>((ref) async {
  final repo = ref.watch(purchasesRepositoryProvider);
  final results = await Future.wait([
    repo.fetchSuppliers(page: 1, limit: 200),
    repo.fetchBills(page: 1, limit: 200, status: 'Unpaid'),
    repo.fetchPaymentAccounts(),
  ]);
  final suppliersResponse = results[0] as PurchaseSupplierListResponse;
  final billsResponse = results[1] as SupplierBillListResponse;
  return PaymentFormSupportData(
    suppliers: suppliersResponse.items,
    unpaidBills: billsResponse.items,
    paymentAccounts: results[2] as List<Map<String, dynamic>>,
  );
});

String? defaultPaymentAccountId(List<Map<String, dynamic>> accounts) {
  if (accounts.isEmpty) return null;

  bool isActive(Map<String, dynamic> a) =>
      a['isActive'] == true || a['isActive'] == 1;

  final bank = accounts.cast<Map<String, dynamic>?>().firstWhere(
        (a) =>
            a != null &&
            isActive(a) &&
            '${a['accountType']}'.toLowerCase() == 'bank',
        orElse: () => null,
      );
  if (bank != null) return bank['id']?.toString();

  final active = accounts.cast<Map<String, dynamic>?>().firstWhere(
        (a) => a != null && isActive(a),
        orElse: () => null,
      );
  if (active != null) return active['id']?.toString();

  return accounts.first['id']?.toString();
}

String paymentAccountLabel(Map<String, dynamic> account) {
  final name = account['name']?.toString() ?? 'Account';
  final type = account['accountType']?.toString();
  if (type != null && type.isNotEmpty) return '$name ($type)';
  return name;
}
