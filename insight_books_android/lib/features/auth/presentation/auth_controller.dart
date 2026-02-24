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
    final isAuth = await _repository.isAuthenticated();
    state = AsyncValue.data(isAuth);
  }

  Future<bool> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final success = await _repository.login(email, password);
      state = AsyncValue.data(success);
      return success;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
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
