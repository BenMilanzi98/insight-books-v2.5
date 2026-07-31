import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import '../../data/stock_repository.dart';
import '../../domain/stock_models.dart';
import 'stock_provider.dart';

class StockTransfersState {
  const StockTransfersState({
    this.transfers = const [],
    this.stockByBranch = const [],
    this.isLoading = false,
    this.isActionInProgress = false,
    this.error,
    this.statusFilter = 'all',
    this.canView = true,
    this.canManage = true,
    this.isOffline = false,
  });

  final List<StockTransfer> transfers;
  final List<StockByBranchSummary> stockByBranch;
  final bool isLoading;
  final bool isActionInProgress;
  final String? error;
  final String statusFilter;
  final bool canView;
  final bool canManage;
  final bool isOffline;

  StockTransfersState copyWith({
    List<StockTransfer>? transfers,
    List<StockByBranchSummary>? stockByBranch,
    bool? isLoading,
    bool? isActionInProgress,
    String? error,
    String? statusFilter,
    bool? canView,
    bool? canManage,
    bool? isOffline,
  }) {
    return StockTransfersState(
      transfers: transfers ?? this.transfers,
      stockByBranch: stockByBranch ?? this.stockByBranch,
      isLoading: isLoading ?? this.isLoading,
      isActionInProgress: isActionInProgress ?? this.isActionInProgress,
      error: error,
      statusFilter: statusFilter ?? this.statusFilter,
      canView: canView ?? this.canView,
      canManage: canManage ?? this.canManage,
      isOffline: isOffline ?? this.isOffline,
    );
  }
}

final stockTransfersControllerProvider =
    NotifierProvider<StockTransfersController, StockTransfersState>(
  StockTransfersController.new,
);

class StockTransfersController extends Notifier<StockTransfersState> {
  @override
  StockTransfersState build() => const StockTransfersState();

  StockRepository get _repo => ref.read(stockRepositoryProvider);

  Future<bool> _checkOnline() async {
    try {
      final result = await InternetAddress.lookup('example.com');
      return result.isNotEmpty && result.first.rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<void> loadPermissions() async {
    try {
      final perms = await ref.read(userPermissionsProvider.future);
      state = state.copyWith(
        canView: satisfiesPermission(perms, 'stock.view'),
        canManage: satisfiesPermission(perms, 'stock.update'),
      );
    } catch (_) {
      state = state.copyWith(canView: false, canManage: false);
    }
  }

  Future<void> load() async {
    await loadPermissions();
    if (!state.canView) return;
    await refresh();
  }

  Future<void> refresh() async {
    if (!state.canView) return;
    final online = await _checkOnline();
    if (!online) {
      state = state.copyWith(
        isOffline: true,
        isLoading: false,
        error: 'Transfers require an internet connection.',
      );
      return;
    }

    state = state.copyWith(
      isLoading: true,
      error: null,
      isOffline: false,
    );
    try {
      final results = await Future.wait([
        _repo.fetchTransfers(status: state.statusFilter),
        _repo.fetchStockByBranch(),
      ]);
      final transferResp = results[0] as StockTransferListResponse;
      final branchRows = results[1] as List<StockByBranchSummary>;
      state = state.copyWith(
        transfers: transferResp.transfers,
        stockByBranch: branchRows,
        isLoading: false,
        isOffline: false,
      );
    } catch (e) {
      final offline = NetworkErrorMapper.isConnectionError(e);
      state = state.copyWith(
        isLoading: false,
        isOffline: offline,
        error: offline
            ? 'Transfers require an internet connection.'
            : NetworkErrorMapper.toUserMessage(e),
      );
    }
  }

  Future<void> setStatusFilter(String filter) async {
    if (state.statusFilter == filter) return;
    state = state.copyWith(statusFilter: filter);
    await refresh();
  }

  Future<String?> _ensureOnlineForMutation() async {
    final online = await _checkOnline();
    if (!online) {
      state = state.copyWith(isOffline: true);
      return 'Transfers require an internet connection.';
    }
    state = state.copyWith(isOffline: false);
    return null;
  }

  Future<String?> approveTransfer(String id) async {
    if (!state.canManage) return 'You do not have permission to approve transfers.';
    final offlineMsg = await _ensureOnlineForMutation();
    if (offlineMsg != null) return offlineMsg;

    state = state.copyWith(isActionInProgress: true);
    try {
      await _repo.transferAction(id, 'approve');
      await refresh();
      return null;
    } catch (e) {
      return NetworkErrorMapper.toUserMessage(e);
    } finally {
      state = state.copyWith(isActionInProgress: false);
    }
  }

  Future<String?> receiveTransfer(String id) async {
    if (!state.canManage) return 'You do not have permission to receive transfers.';
    final offlineMsg = await _ensureOnlineForMutation();
    if (offlineMsg != null) return offlineMsg;

    state = state.copyWith(isActionInProgress: true);
    try {
      await _repo.transferAction(id, 'receive');
      await refresh();
      ref.read(stockControllerProvider.notifier).refresh();
      return null;
    } catch (e) {
      return NetworkErrorMapper.toUserMessage(e);
    } finally {
      state = state.copyWith(isActionInProgress: false);
    }
  }

  Future<String?> rejectTransfer(String id, String reason) async {
    if (!state.canManage) return 'You do not have permission to reject transfers.';
    final offlineMsg = await _ensureOnlineForMutation();
    if (offlineMsg != null) return offlineMsg;

    state = state.copyWith(isActionInProgress: true);
    try {
      await _repo.transferAction(
        id,
        'reject',
        rejectionReason: reason,
      );
      await refresh();
      return null;
    } catch (e) {
      return NetworkErrorMapper.toUserMessage(e);
    } finally {
      state = state.copyWith(isActionInProgress: false);
    }
  }

  Future<String?> createTransfer({
    required String fromTenantId,
    required String toTenantId,
    required String productId,
    required double quantity,
    String? notes,
    bool directTransfer = true,
  }) async {
    if (!state.canManage) return 'You do not have permission to create transfers.';
    final offlineMsg = await _ensureOnlineForMutation();
    if (offlineMsg != null) return offlineMsg;

    state = state.copyWith(isActionInProgress: true);
    try {
      await _repo.createTransfer(
        fromTenantId: fromTenantId,
        toTenantId: toTenantId,
        productId: productId,
        quantity: quantity,
        notes: notes,
        directTransfer: directTransfer,
      );
      await refresh();
      ref.read(stockControllerProvider.notifier).refresh();
      return null;
    } catch (e) {
      return NetworkErrorMapper.toUserMessage(e);
    } finally {
      state = state.copyWith(isActionInProgress: false);
    }
  }
}
