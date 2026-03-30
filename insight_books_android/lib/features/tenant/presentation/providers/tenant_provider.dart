import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/features/dashboard/presentation/dashboard_controller.dart';
import '../../data/tenant_repository.dart';
import '../../domain/tenant_models.dart';

part 'tenant_provider.g.dart';

class TenantState {
  final List<Tenant> tenants;
  final List<Tenant> filteredTenants;
  final String? currentTenantId;
  final bool isLoading;
  final bool isSwitching;
  final String? error;
  final String searchTerm;

  TenantState({
    this.tenants = const [],
    this.filteredTenants = const [],
    this.currentTenantId,
    this.isLoading = true,
    this.isSwitching = false,
    this.error,
    this.searchTerm = '',
  });

  TenantState copyWith({
    List<Tenant>? tenants,
    List<Tenant>? filteredTenants,
    String? currentTenantId,
    bool? isLoading,
    bool? isSwitching,
    String? error,
    String? searchTerm,
    bool clearError = false,
  }) {
    return TenantState(
      tenants: tenants ?? this.tenants,
      filteredTenants: filteredTenants ?? this.filteredTenants,
      currentTenantId: currentTenantId ?? this.currentTenantId,
      isLoading: isLoading ?? this.isLoading,
      isSwitching: isSwitching ?? this.isSwitching,
      error: clearError ? null : (error ?? this.error),
      searchTerm: searchTerm ?? this.searchTerm,
    );
  }
}

@riverpod
class TenantNotifier extends _$TenantNotifier {
  @override
  TenantState build() {
    Future.microtask(() => loadData());
    return TenantState(isLoading: true);
  }

  Future<void> loadData() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repository = ref.read(tenantRepositoryProvider);
      final data = await repository.fetchTenants();

      final List<Tenant> tenants = (data['tenants'] as List)
          .map((t) => Tenant.fromJson(t))
          .toList();

      state = state.copyWith(
        tenants: tenants,
        filteredTenants: tenants,
        currentTenantId: data['currentTenantId'],
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load businesses: ${e.toString()}',
      );
    }
  }

  void setSearchTerm(String term) {
    final filtered = state.tenants.where((t) {
      return t.name.toLowerCase().contains(term.toLowerCase());
    }).toList();

    state = state.copyWith(searchTerm: term, filteredTenants: filtered);
  }

  Future<bool> switchTenant(String tenantId) async {
    state = state.copyWith(isSwitching: true, error: null);
    try {
      final repository = ref.read(tenantRepositoryProvider);
      await repository.switchTenant(tenantId);
      ref.invalidate(dashboardControllerProvider);
      ref.invalidate(userPermissionsProvider);
      ref.invalidate(accountProvider);
      await loadData();
      state = state.copyWith(isSwitching: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isSwitching: false,
        error: 'Failed to switch business: ${e.toString()}',
      );
      return false;
    }
  }

  Future<bool> addTenant(String name) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repository = ref.read(tenantRepositoryProvider);
      await repository.createTenant(name);
      await loadData(); // Reload the list
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to add business: ${e.toString()}',
      );
      return false;
    }
  }

  Future<bool> deleteTenant(String tenantId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repository = ref.read(tenantRepositoryProvider);
      await repository.deleteTenant(tenantId);
      await loadData(); // Reload the list
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to delete business: ${e.toString()}',
      );
      return false;
    }
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }
}
