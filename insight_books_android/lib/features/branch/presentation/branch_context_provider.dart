import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/features/dashboard/presentation/dashboard_controller.dart';
import 'package:insightbooks_android/features/tenant/data/tenant_repository.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/pos/presentation/providers/pos_provider.dart';
import 'package:insightbooks_android/features/invoice/presentation/providers/invoice_provider.dart';
import 'package:insightbooks_android/features/quotation/presentation/providers/quotation_provider.dart';
import 'package:insightbooks_android/features/expense/presentation/providers/expense_provider.dart';

class BranchContextState {
  final List<Map<String, dynamic>> branches;
  final String? currentBranchId;
  final String currentBranchLabel;
  final List<String>? allowedBranchIds;
  final bool canSelectAllBranches;
  final bool loading;
  final bool switching;
  final String? error;
  final bool hasLoadedOnce;

  const BranchContextState({
    this.branches = const [],
    this.currentBranchId,
    this.currentBranchLabel = '',
    this.allowedBranchIds,
    this.canSelectAllBranches = true,
    this.loading = false,
    this.switching = false,
    this.error,
    this.hasLoadedOnce = false,
  });

  BranchContextState copyWith({
    List<Map<String, dynamic>>? branches,
    String? currentBranchId,
    String? currentBranchLabel,
    List<String>? allowedBranchIds,
    bool? canSelectAllBranches,
    bool? loading,
    bool? switching,
    String? error,
    bool? hasLoadedOnce,
    bool clearError = false,
  }) {
    return BranchContextState(
      branches: branches ?? this.branches,
      currentBranchId: currentBranchId ?? this.currentBranchId,
      currentBranchLabel: currentBranchLabel ?? this.currentBranchLabel,
      allowedBranchIds: allowedBranchIds ?? this.allowedBranchIds,
      canSelectAllBranches: canSelectAllBranches ?? this.canSelectAllBranches,
      loading: loading ?? this.loading,
      switching: switching ?? this.switching,
      error: clearError ? null : (error ?? this.error),
      hasLoadedOnce: hasLoadedOnce ?? this.hasLoadedOnce,
    );
  }

  bool get hasBranches => branches.isNotEmpty;
}

final branchContextProvider =
    NotifierProvider<BranchContextNotifier, BranchContextState>(
  BranchContextNotifier.new,
);

class BranchContextNotifier extends Notifier<BranchContextState> {
  @override
  BranchContextState build() {
    return const BranchContextState(loading: false, branches: []);
  }

  Future<void> refresh() async {
    if (state.loading) return;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final dio = ref.read(dioProvider);
      final meResp = await dio.get('/api/auth/me');
      final me = meResp.data is Map
          ? Map<String, dynamic>.from(meResp.data as Map)
          : <String, dynamic>{};

      String? currentId;
      final rawCurrent = me['currentBranchId'] ?? me['defaultBranchId'];
      if (rawCurrent != null && rawCurrent.toString().trim().isNotEmpty) {
        currentId = rawCurrent.toString().trim();
      }

      state = BranchContextState(
        branches: const [],
        currentBranchId: currentId,
        currentBranchLabel: '',
        allowedBranchIds: null,
        canSelectAllBranches: true,
        loading: false,
        hasLoadedOnce: true,
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: e.toString(),
        hasLoadedOnce: true,
      );
    }
  }

  Future<void> _invalidateAfterBranchChange() async {
    ref.invalidate(dashboardControllerProvider);
    ref.invalidate(accountProvider);
    ref.invalidate(userPermissionsProvider);
    ref.invalidate(posProvider);
    ref.invalidate(invoiceControllerProvider);
    ref.invalidate(invoiceStatisticsProvider);
    ref.invalidate(quotationControllerProvider);
    ref.invalidate(expenseControllerProvider);
  }

  Future<bool> selectBranch(String? branchId) async {
    state = state.copyWith(switching: true, clearError: true);
    try {
      final repo = ref.read(tenantRepositoryProvider);
      await repo.switchBranch(branchId);
      await _invalidateAfterBranchChange();
      await refresh();
      return true;
    } catch (e) {
      state = state.copyWith(
        switching: false,
        error: e.toString(),
      );
      return false;
    }
  }
}
