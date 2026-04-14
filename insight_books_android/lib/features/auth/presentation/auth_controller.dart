import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';
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

  /// Incremented on every login so stale _checkInitialAuth results are ignored.
  int _epoch = 0;

  /// True between login() returning success and the post-login API calls
  /// completing. Prevents the 401 interceptor from clearing a fresh session.
  bool _loginInProgress = false;
  bool get loginInProgress => _loginInProgress;

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
    final capturedEpoch = _epoch;
    try {
      final storage = ref.read(storageServiceProvider);
      await storage.hydrate();

      if (!storage.hasCredentials) {
        if (_epoch == capturedEpoch) {
          state = const AsyncValue.data(false);
        }
        return;
      }

      final valid = await _repository.validateSession();
      if (_epoch == capturedEpoch) {
        state = AsyncValue.data(valid);
      }
    } catch (e, st) {
      debugPrint('[AuthController] Initial auth check failed: $e');
      if (_epoch == capturedEpoch) {
        state = AsyncValue.error(e, st);
      }
    }
  }

  Future<LoginResult> login(String email, String password) async {
    _epoch++;
    _loginInProgress = true;
    // Do **not** set [state] to loading here: [userPermissionsProvider] treats
    // [auth.value != true] as logged out and emits {}, which sends users to
    // /access-denied. LoginScreen shows progress via local [_submitting] instead.
    try {
      final result = await _repository.login(email, password);
      state = AsyncValue.data(result.success);
      if (result.success) {
        ref.invalidate(userPermissionsProvider);
      }
      if (!result.success) _loginInProgress = false;
      return result;
    } catch (e, st) {
      _loginInProgress = false;
      state = AsyncValue.error(e, st);
      return LoginResult(success: false, message: e.toString());
    }
  }

  void markLoginComplete() {
    _loginInProgress = false;
  }

  Future<void> logout() async {
    _epoch++;
    _loginInProgress = false;
    state = const AsyncValue.loading();
    await _repository.logout();
    _invalidateFeatureCaches();
    state = const AsyncValue.data(false);
  }

  void forceLogout() {
    if (_loginInProgress) return;
    _epoch++;
    _invalidateFeatureCaches();
    state = const AsyncValue.data(false);
  }
}
