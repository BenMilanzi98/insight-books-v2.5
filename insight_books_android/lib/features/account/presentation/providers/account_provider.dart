import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../domain/user_model.dart';
import '../../domain/business_settings.dart';
import '../../data/account_repository.dart';

part 'account_provider.g.dart';

class AccountState {
  final User? user;
  final BusinessSettings? settings;
  final bool isLoading;
  final bool isSaving;
  final String? error;
  final String? successMessage;

  AccountState({
    this.user,
    this.settings,
    this.isLoading = false,
    this.isSaving = false,
    this.error,
    this.successMessage,
  });

  AccountState copyWith({
    User? user,
    BusinessSettings? settings,
    bool? isLoading,
    bool? isSaving,
    String? error,
    String? successMessage,
    bool clearSuccess = false,
  }) {
    return AccountState(
      user: user ?? this.user,
      settings: settings ?? this.settings,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      error: error ?? this.error,
      successMessage: clearSuccess
          ? null
          : (successMessage ?? this.successMessage),
    );
  }
}

@riverpod
class Account extends _$Account {
  @override
  AccountState build() {
    Future.microtask(() => loadData());
    return AccountState(isLoading: true);
  }

  Future<void> loadData() async {
    state = state.copyWith(isLoading: true, error: null);
    final repository = ref.read(accountRepositoryProvider);

    // Load Profile
    try {
      final profile = await repository.fetchProfile();
      state = state.copyWith(user: profile);
    } catch (e) {
      state = state.copyWith(error: 'Failed to load profile: ${e.toString()}');
    }

    // Load Settings
    try {
      final settings = await repository.fetchBusinessSettings();
      state = state.copyWith(settings: settings);
    } catch (e) {
      state = state.copyWith(
        error: state.error != null
            ? '${state.error}\nFailed to load settings: ${e.toString()}'
            : 'Failed to load settings: ${e.toString()}',
      );
    }

    state = state.copyWith(isLoading: false);
  }

  Future<void> updateProfile(User user) async {
    state = state.copyWith(isSaving: true, error: null, clearSuccess: true);
    try {
      final repository = ref.read(accountRepositoryProvider);
      await repository.updateProfile(user);
      state = state.copyWith(
        user: user,
        isSaving: false,
        successMessage: 'Profile updated successfully',
      );
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        error: 'Failed to update profile: ${e.toString()}',
      );
    }
  }

  Future<void> updatePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    state = state.copyWith(isSaving: true, error: null, clearSuccess: true);
    try {
      final repository = ref.read(accountRepositoryProvider);
      await repository.updatePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      );
      state = state.copyWith(
        isSaving: false,
        successMessage: 'Password updated successfully',
      );
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        error: 'Failed to update password: ${e.toString()}',
      );
    }
  }

  Future<void> updateBusinessSettings(
    BusinessSettings settings, {
    String? logoPath,
    String? faviconPath,
  }) async {
    state = state.copyWith(isSaving: true, error: null, clearSuccess: true);
    try {
      final repository = ref.read(accountRepositoryProvider);
      await repository.updateBusinessSettings(
        settings,
        logoPath: logoPath,
        faviconPath: faviconPath,
      );

      // Reload settings to get updated URLs/data
      final updatedSettings = await repository.fetchBusinessSettings();

      state = state.copyWith(
        settings: updatedSettings,
        isSaving: false,
        successMessage: 'Business settings updated successfully',
      );
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        error: 'Failed to update business settings: ${e.toString()}',
      );
    }
  }

  void clearMessages() {
    state = state.copyWith(error: null, clearSuccess: true);
  }
}
