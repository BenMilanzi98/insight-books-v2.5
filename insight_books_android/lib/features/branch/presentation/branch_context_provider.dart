import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/features/account/data/account_repository.dart';
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

  const BranchContextState({
    this.branches = const [],
    this.currentBranchId,
    this.currentBranchLabel = '',
    this.allowedBranchIds,
    this.canSelectAllBranches = true,
    this.loading = true,
    this.switching = false,
    this.error,
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
    state = state.copyWith(loading: true, clearError: true);
    try {
      final dio = ref.read(dioProvider);
      final accountRepo = ref.read(accountRepositoryProvider);
      final meResp = await dio.get('/api/auth/me');
      final me = meResp.data is Map
          ? Map<String, dynamic>.from(meResp.data as Map)
          : <String, dynamic>{};

      final allowedRaw = me['allowedBranchIds'];
      List<String>? allowed;
      if (allowedRaw is List) {
        allowed = allowedRaw.map((e) => e.toString()).toList();
      }
      final canAll = allowed == null;

      final rawCurrent = me['currentBranchId'];
      String? currentId;
      if (rawCurrent != null && rawCurrent.toString().isNotEmpty) {
        currentId = rawCurrent.toString();
      }
      final rows = await accountRepo.fetchBranches();
      final active = rows.where((b) => (b['isActive'] ?? true) == true).toList();

      String label = 'All branches';
      if (currentId != null) {
        Map<String, dynamic>? found;
        for (final b in active) {
          if ((b['id'] ?? '').toString() == currentId) {
            found = b;
            break;
          }
        }
        if (found != null) {
          final name = (found['name'] ?? 'Branch').toString();
          final code = (found['code'] ?? '').toString();
          label = code.isEmpty ? name : '$name ($code)';
        } else {
          label = 'Branch';
        }
      }

      state = BranchContextState(
        branches: active,
        currentBranchId: currentId,
        currentBranchLabel: label,
        allowedBranchIds: allowed,
        canSelectAllBranches: canAll,
        loading: false,
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        error: e.toString(),
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
      state = state.copyWith(switching: false);
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
