// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tenant_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(TenantNotifier)
final tenantProvider = TenantNotifierProvider._();

final class TenantNotifierProvider
    extends $NotifierProvider<TenantNotifier, TenantState> {
  TenantNotifierProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'tenantProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$tenantNotifierHash();

  @$internal
  @override
  TenantNotifier create() => TenantNotifier();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(TenantState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<TenantState>(value),
    );
  }
}

String _$tenantNotifierHash() => r'62872251557967fa85cc18cca84b326104a78e3b';

abstract class _$TenantNotifier extends $Notifier<TenantState> {
  TenantState build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<TenantState, TenantState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<TenantState, TenantState>,
              TenantState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
