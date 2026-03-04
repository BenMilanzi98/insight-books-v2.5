// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(InvoiceController)
final invoiceControllerProvider = InvoiceControllerProvider._();

final class InvoiceControllerProvider
    extends $NotifierProvider<InvoiceController, InvoicePageState> {
  InvoiceControllerProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'invoiceControllerProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$invoiceControllerHash();

  @$internal
  @override
  InvoiceController create() => InvoiceController();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(InvoicePageState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<InvoicePageState>(value),
    );
  }
}

String _$invoiceControllerHash() => r'077c335a8e8e85fd927e75b197341fc634c05299';

abstract class _$InvoiceController extends $Notifier<InvoicePageState> {
  InvoicePageState build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<InvoicePageState, InvoicePageState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<InvoicePageState, InvoicePageState>,
              InvoicePageState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
