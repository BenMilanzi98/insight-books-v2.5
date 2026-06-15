// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pos_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(Pos)
final posProvider = PosProvider._();

final class PosProvider extends $NotifierProvider<Pos, PosPageState> {
  PosProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'posProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$posHash();

  @$internal
  @override
  Pos create() => Pos();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(PosPageState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<PosPageState>(value),
    );
  }
}

String _$posHash() => r'5244e99d0f9015d111c82dd043bda7091b39c0c0';

abstract class _$Pos extends $Notifier<PosPageState> {
  PosPageState build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<PosPageState, PosPageState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<PosPageState, PosPageState>,
              PosPageState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
