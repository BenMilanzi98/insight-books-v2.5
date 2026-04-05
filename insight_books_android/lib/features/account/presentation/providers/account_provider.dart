import 'package:flutter/foundation.dart';
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
  final bool canViewSystem;
  final bool canUpdateSystem;
  final List<Map<String, dynamic>> invoiceTemplates;

  AccountState({
    this.user,
    this.settings,
    this.isLoading = false,
    this.isSaving = false,
    this.error,
    this.successMessage,
    this.canViewSystem = true,
    this.canUpdateSystem = true,
    this.invoiceTemplates = const [],
  });

  AccountState copyWith({
    User? user,
    BusinessSettings? settings,
    bool? isLoading,
    bool? isSaving,
    String? error,
    String? successMessage,
    bool? canViewSystem,
    bool? canUpdateSystem,
    List<Map<String, dynamic>>? invoiceTemplates,
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
      canViewSystem: canViewSystem ?? this.canViewSystem,
      canUpdateSystem: canUpdateSystem ?? this.canUpdateSystem,
      invoiceTemplates: invoiceTemplates ?? this.invoiceTemplates,
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
    try {
      final perms = await repository.fetchUserPermissions();
      state = state.copyWith(
        canViewSystem: perms.contains('*') || perms.contains('all') || perms.contains('system.view'),
        canUpdateSystem: perms.contains('*') || perms.contains('all') || perms.contains('system.update'),
      );
    } catch (e) {
      debugPrint('[Account] Failed to load permissions: $e');
    }

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

    try {
      final templates = await repository.fetchInvoiceTemplates();
      state = state.copyWith(invoiceTemplates: templates);
    } catch (e) {
      debugPrint('[Account] Failed to load invoice templates: $e');
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
    if (!state.canUpdateSystem) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
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

  Future<void> loadInvoiceTemplates() async {
    try {
      final templates = await ref.read(accountRepositoryProvider).fetchInvoiceTemplates();
      state = state.copyWith(invoiceTemplates: templates);
    } catch (e) {
      state = state.copyWith(error: 'Failed to load templates: $e');
    }
  }

  Future<void> createInvoiceTemplate({
    required String name,
    String? content,
  }) async {
    if (!state.canUpdateSystem) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
    state = state.copyWith(isSaving: true, error: null, clearSuccess: true);
    try {
      await ref.read(accountRepositoryProvider).createInvoiceTemplate(
            name: name,
            content: content,
          );
      await loadInvoiceTemplates();
      state = state.copyWith(isSaving: false, successMessage: 'Template created');
    } catch (e) {
      state = state.copyWith(isSaving: false, error: 'Failed to create template: $e');
    }
  }

  Future<void> updateInvoiceTemplate({
    required String id,
    required String name,
    String? content,
    bool isDefault = false,
  }) async {
    if (!state.canUpdateSystem) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
    state = state.copyWith(isSaving: true, error: null, clearSuccess: true);
    try {
      await ref.read(accountRepositoryProvider).updateInvoiceTemplate(
            id: id,
            name: name,
            content: content,
            isDefault: isDefault,
          );
      await loadInvoiceTemplates();
      state = state.copyWith(isSaving: false, successMessage: 'Template updated');
    } catch (e) {
      state = state.copyWith(isSaving: false, error: 'Failed to update template: $e');
    }
  }

  Future<void> setDefaultInvoiceTemplate(String id) async {
    if (!state.canUpdateSystem) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
    state = state.copyWith(isSaving: true, error: null, clearSuccess: true);
    try {
      await ref.read(accountRepositoryProvider).setDefaultInvoiceTemplate(id);
      await loadInvoiceTemplates();
      state = state.copyWith(isSaving: false, successMessage: 'Default template updated');
    } catch (e) {
      state = state.copyWith(isSaving: false, error: 'Failed to set default: $e');
    }
  }

  Future<void> deleteInvoiceTemplate(String id) async {
    if (!state.canUpdateSystem) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
    state = state.copyWith(isSaving: true, error: null, clearSuccess: true);
    try {
      await ref.read(accountRepositoryProvider).deleteInvoiceTemplate(id);
      await loadInvoiceTemplates();
      state = state.copyWith(isSaving: false, successMessage: 'Template deleted');
    } catch (e) {
      state = state.copyWith(isSaving: false, error: 'Failed to delete template: $e');
    }
  }
}
