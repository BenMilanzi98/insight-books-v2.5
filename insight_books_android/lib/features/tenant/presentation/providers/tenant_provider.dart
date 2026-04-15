import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/features/branch/presentation/branch_context_provider.dart';
import 'package:insightbooks_android/features/dashboard/presentation/dashboard_controller.dart';
import '../../data/tenant_repository.dart';
import '../../domain/tenant_models.dart';

part 'tenant_provider.g.dart';

class TenantState {
  final List<Tenant> tenants;
  final List<Tenant> filteredTenants;
  final String? currentTenantId;
  /// Row for [currentTenantId] from the API, even when subscription is expired (not in [tenants]).
  final Tenant? sessionTenant;
  /// Count of memberships returned by the API that are not in [tenants] (expired / inactive).
  final int inactiveMembershipCount;
  final bool isLoading;
  final bool isSwitching;
  final String? error;
  final String searchTerm;

  TenantState({
    this.tenants = const [],
    this.filteredTenants = const [],
    this.currentTenantId,
    this.sessionTenant,
    this.inactiveMembershipCount = 0,
    this.isLoading = true,
    this.isSwitching = false,
    this.error,
    this.searchTerm = '',
  });

  TenantState copyWith({
    List<Tenant>? tenants,
    List<Tenant>? filteredTenants,
    String? currentTenantId,
    Tenant? sessionTenant,
    bool setSessionTenant = false,
    int? inactiveMembershipCount,
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
      sessionTenant: setSessionTenant ? sessionTenant : this.sessionTenant,
      inactiveMembershipCount:
          inactiveMembershipCount ?? this.inactiveMembershipCount,
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

      final all = ((data['tenants'] as List?) ?? [])
          .map((t) => Tenant.fromJson(t as Map<String, dynamic>))
          .toList();
      final active =
          all.where((t) => t.hasActiveSubscriptionOrTrial).toList();
      final cid = data['currentTenantId'] as String?;
      Tenant? sessionTenant;
      if (cid != null) {
        for (final t in all) {
          if (t.id == cid) {
            sessionTenant = t;
            break;
          }
        }
      }
      final term = state.searchTerm;
      final filtered = term.isEmpty
          ? active
          : active
                .where(
                  (t) =>
                      t.name.toLowerCase().contains(term.toLowerCase()),
                )
                .toList();

      state = state.copyWith(
        tenants: active,
        filteredTenants: filtered,
        currentTenantId: cid,
        sessionTenant: sessionTenant,
        setSessionTenant: true,
        inactiveMembershipCount: all.length - active.length,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load businesses: ${e.toString()}',
        tenants: const [],
        filteredTenants: const [],
        sessionTenant: null,
        setSessionTenant: true,
        inactiveMembershipCount: 0,
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
      ref.invalidate(branchContextProvider);
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
