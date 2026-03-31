import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/features/auth/data/auth_repository.dart';
import 'package:insightbooks_android/features/branch/presentation/branch_context_provider.dart';
import 'package:insightbooks_android/features/dashboard/presentation/dashboard_controller.dart';
import 'package:insightbooks_android/features/expense/presentation/providers/expense_provider.dart';
import 'package:insightbooks_android/features/invoice/presentation/providers/invoice_provider.dart';
import 'package:insightbooks_android/features/pos/presentation/providers/pos_provider.dart';
import 'package:insightbooks_android/features/quotation/presentation/providers/quotation_provider.dart';
import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

final authStateProvider = NotifierProvider<AuthController, AsyncValue<bool>>(
  () {
    return AuthController();
  },
);

class AuthController extends Notifier<AsyncValue<bool>> {
  late final AuthRepository _repository;

  @override
  AsyncValue<bool> build() {
    _repository = ref.watch(authRepositoryProvider);
    _checkInitialAuth();
    return const AsyncValue.loading();
  }

  void _invalidateFeatureCaches() {
    ref.invalidate(dashboardControllerProvider);
    ref.invalidate(tenantProvider);
    ref.invalidate(accountProvider);
    ref.invalidate(userPermissionsProvider);
    ref.invalidate(posProvider);
    ref.invalidate(invoiceControllerProvider);
    ref.invalidate(invoiceStatisticsProvider);
    ref.invalidate(quotationControllerProvider);
    ref.invalidate(expenseControllerProvider);
    ref.invalidate(branchContextProvider);
  }

  Future<void> _checkInitialAuth() async {
    try {
      final hasCredentials = await _repository.isAuthenticated();
      if (!hasCredentials) {
        state = const AsyncValue.data(false);
        return;
      }
      final valid = await _repository.validateSession();
      state = AsyncValue.data(valid);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<LoginResult> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final result = await _repository.login(email, password);
      state = AsyncValue.data(result.success);
      return result;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return LoginResult(success: false, message: e.toString());
    }
  }

  Future<void> logout() async {
    state = const AsyncValue.loading();
    await _repository.logout();
    _invalidateFeatureCaches();
    state = const AsyncValue.data(false);
  }

  /// Called after secure storage is cleared (e.g. 401) so UI state matches logged-out session.
  void forceLogout() {
    _invalidateFeatureCaches();
    state = const AsyncValue.data(false);
  }
}
