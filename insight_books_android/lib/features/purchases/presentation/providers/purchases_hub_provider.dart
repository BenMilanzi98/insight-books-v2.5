import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import '../../data/purchases_offline_helpers.dart';
import '../../data/purchases_offline_queue.dart';
import '../../data/purchases_repository.dart';
import 'bills_provider.dart';
import 'orders_provider.dart';
import 'payments_provider.dart';
import 'receipts_provider.dart';
import 'suppliers_provider.dart';

class PurchasesHubState {
  const PurchasesHubState({
    this.canViewPurchases = false,
    this.canViewSuppliers = false,
    this.pendingOfflineCount = 0,
    this.failedOfflineCount = 0,
    this.isSyncing = false,
  });

  final bool canViewPurchases;
  final bool canViewSuppliers;
  final int pendingOfflineCount;
  final int failedOfflineCount;
  final bool isSyncing;

  bool get canAccessHub => canViewPurchases || canViewSuppliers;

  bool get showSuppliersTile => canViewSuppliers;
  bool get showOrdersTile => canViewPurchases;
  bool get showReceiptsTile => canViewPurchases;
  bool get showBillsTile => canViewPurchases;
  bool get showPaymentsTile => canViewPurchases;

  PurchasesHubState copyWith({
    bool? canViewPurchases,
    bool? canViewSuppliers,
    int? pendingOfflineCount,
    int? failedOfflineCount,
    bool? isSyncing,
  }) {
    return PurchasesHubState(
      canViewPurchases: canViewPurchases ?? this.canViewPurchases,
      canViewSuppliers: canViewSuppliers ?? this.canViewSuppliers,
      pendingOfflineCount: pendingOfflineCount ?? this.pendingOfflineCount,
      failedOfflineCount: failedOfflineCount ?? this.failedOfflineCount,
      isSyncing: isSyncing ?? this.isSyncing,
    );
  }
}

final purchasesHubProvider =
    NotifierProvider<PurchasesHubNotifier, PurchasesHubState>(
  PurchasesHubNotifier.new,
);

class PurchasesHubNotifier extends Notifier<PurchasesHubState> {
  PurchasesOfflineQueue get _queue => ref.read(purchasesOfflineQueueProvider);

  @override
  PurchasesHubState build() {
    ref.watch(userPermissionsProvider);
    Future.microtask(refreshPendingCount);
    return _stateFromPermissions();
  }

  PurchasesHubState _stateFromPermissions() {
    final perms =
        ref.read(userPermissionsProvider).asData?.value ?? <String>{};
    return PurchasesHubState(
      canViewPurchases: satisfiesPermission(perms, 'purchases.view'),
      canViewSuppliers: satisfiesPermission(perms, 'suppliers.view'),
    );
  }

  Future<void> refreshPendingCount() async {
    try {
      final pending = await _queue.pendingCount();
      final failed = (await _queue.listFailed()).length;
      state = state.copyWith(
        pendingOfflineCount: pending,
        failedOfflineCount: failed,
      );
    } catch (_) {}
  }

  Future<void> refresh() async {
    await refreshPendingCount();
    await syncPending();
  }

  Future<List<Map<String, dynamic>>> listFailed() => _queue.listFailed();

  Future<void> retryFailed(String id) async {
    await _queue.retry(id);
    await refreshPendingCount();
    await syncPending();
  }

  Future<void> discardFailed(String id) async {
    await _queue.discard(id);
    await refreshPendingCount();
  }

  Future<Map<String, int>> syncPending() async {
    if (state.isSyncing) return {'synced': 0, 'failed': 0};

    state = state.copyWith(isSyncing: true);
    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final result = await _queue.syncPending((entry) async {
        final action = '${entry['action']}';
        final payload = Map<String, dynamic>.from(entry['payload'] as Map);
        switch (action) {
          case 'create_supplier':
            await repo.createSupplier(payload);
            break;
          case 'create_order':
            await repo.createOrder(payload);
            break;
          case 'create_bill':
            await repo.createBill(payload);
            break;
          case 'create_receipt':
            await repo.createReceipt(payload);
            break;
          case 'create_payment':
            await repo.createPayment(payload);
            break;
          default:
            throw Exception('Unknown offline action: $action');
        }
      });

      await refreshPendingCount();

      if ((result['synced'] ?? 0) > 0) {
        ref.invalidate(suppliersControllerProvider);
        ref.invalidate(ordersControllerProvider);
        ref.invalidate(receiptsControllerProvider);
        ref.invalidate(billsControllerProvider);
        ref.invalidate(paymentsControllerProvider);
      }

      return result;
    } finally {
      state = state.copyWith(isSyncing: false);
    }
  }
}
