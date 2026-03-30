import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/features/auth/data/auth_repository.dart';

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
    state = const AsyncValue.data(false);
  }

  void forceLogout() {
    state = const AsyncValue.data(false);
  }
}
