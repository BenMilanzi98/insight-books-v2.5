import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import '../../data/stock_repository.dart';
import '../../domain/stock_models.dart';
import 'stock_provider.dart';

class ExpiryAlertsState {
  const ExpiryAlertsState({
    this.rows = const [],
    this.summary = const ExpiryAlertSummary(),
    this.thresholds = const ExpiryAlertThresholds(),
    this.migrationPending = false,
    this.isLoading = false,
    this.isActionInProgress = false,
    this.error,
    this.statusFilter = 'all',
    this.canView = true,
    this.canAdjust = false,
    this.isOffline = false,
  });

  final List<ExpiryAlert> rows;
  final ExpiryAlertSummary summary;
  final ExpiryAlertThresholds thresholds;
  final bool migrationPending;
  final bool isLoading;
  final bool isActionInProgress;
  final String? error;
  final String statusFilter;
  final bool canView;
  final bool canAdjust;
  final bool isOffline;

  List<ExpiryAlert> get filteredRows {
    if (statusFilter == 'all') return rows;
    return rows.where((r) => r.status == statusFilter).toList();
  }

  ExpiryAlertsState copyWith({
    List<ExpiryAlert>? rows,
    ExpiryAlertSummary? summary,
    ExpiryAlertThresholds? thresholds,
    bool? migrationPending,
    bool? isLoading,
    bool? isActionInProgress,
    String? error,
    String? statusFilter,
    bool? canView,
    bool? canAdjust,
    bool? isOffline,
  }) {
    return ExpiryAlertsState(
      rows: rows ?? this.rows,
      summary: summary ?? this.summary,
      thresholds: thresholds ?? this.thresholds,
      migrationPending: migrationPending ?? this.migrationPending,
      isLoading: isLoading ?? this.isLoading,
      isActionInProgress: isActionInProgress ?? this.isActionInProgress,
      error: error,
      statusFilter: statusFilter ?? this.statusFilter,
      canView: canView ?? this.canView,
      canAdjust: canAdjust ?? this.canAdjust,
      isOffline: isOffline ?? this.isOffline,
    );
  }
}

final expiryAlertsControllerProvider =
    NotifierProvider<ExpiryAlertsController, ExpiryAlertsState>(
  ExpiryAlertsController.new,
);

class ExpiryAlertsController extends Notifier<ExpiryAlertsState> {
  @override
  ExpiryAlertsState build() => const ExpiryAlertsState();

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
        canAdjust: satisfiesPermission(perms, 'stock.adjust'),
      );
    } catch (_) {
      state = state.copyWith(canView: false, canAdjust: false);
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
        error: 'Expiry alerts require an internet connection.',
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null, isOffline: false);
    try {
      final response = await _repo.fetchExpiryAlerts();
      state = state.copyWith(
        rows: response.rows,
        summary: response.summary,
        thresholds: response.thresholds,
        migrationPending: response.migrationPending,
        isLoading: false,
        isOffline: false,
      );
    } catch (e) {
      final offline = NetworkErrorMapper.isConnectionError(e);
      state = state.copyWith(
        isLoading: false,
        isOffline: offline,
        error: offline
            ? 'Expiry alerts require an internet connection.'
            : NetworkErrorMapper.toUserMessage(e),
      );
    }
  }

  Future<void> setStatusFilter(String filter) async {
    if (state.statusFilter == filter) return;
    state = state.copyWith(statusFilter: filter);
  }

  Future<String?> _ensureOnlineForMutation() async {
    final online = await _checkOnline();
    if (!online) {
      state = state.copyWith(isOffline: true);
      return 'Write-off and restock require an internet connection.';
    }
    state = state.copyWith(isOffline: false);
    return null;
  }

  Future<String?> writeOff({
    required ExpiryAlert alert,
    double? quantity,
    String? notes,
  }) async {
    if (!state.canAdjust) {
      return 'You do not have permission to write off inventory.';
    }
    final offlineMsg = await _ensureOnlineForMutation();
    if (offlineMsg != null) return offlineMsg;

    state = state.copyWith(isActionInProgress: true);
    try {
      await _repo.writeOff(
        batchId: alert.batchId,
        quantity: quantity,
        notes: notes,
        branchId: alert.branchId,
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

  Future<String?> restock({
    required ExpiryAlert alert,
    required double quantity,
    required double unitCost,
    String? expiryDate,
    String? notes,
  }) async {
    if (!state.canAdjust) {
      return 'You do not have permission to restock inventory.';
    }
    final offlineMsg = await _ensureOnlineForMutation();
    if (offlineMsg != null) return offlineMsg;

    state = state.copyWith(isActionInProgress: true);
    try {
      await _repo.restock(
        productId: alert.productId,
        quantity: quantity,
        unitCost: unitCost,
        expiryDate: expiryDate,
        branchId: alert.branchId,
        notes: notes,
        priorBatchId: alert.batchId,
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
