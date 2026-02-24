// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_details_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(InvoiceDetails)
final invoiceDetailsProvider = InvoiceDetailsFamily._();

final class InvoiceDetailsProvider
    extends $AsyncNotifierProvider<InvoiceDetails, Invoice> {
  InvoiceDetailsProvider._({
    required InvoiceDetailsFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'invoiceDetailsProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$invoiceDetailsHash();

  @override
  String toString() {
    return r'invoiceDetailsProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  InvoiceDetails create() => InvoiceDetails();

  @override
  bool operator ==(Object other) {
    return other is InvoiceDetailsProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$invoiceDetailsHash() => r'de40ab2dfad902b5212c09404289322172ceea39';

final class InvoiceDetailsFamily extends $Family
    with
        $ClassFamilyOverride<
          InvoiceDetails,
          AsyncValue<Invoice>,
          Invoice,
          FutureOr<Invoice>,
          String
        > {
  InvoiceDetailsFamily._()
    : super(
        retry: null,
        name: r'invoiceDetailsProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  InvoiceDetailsProvider call(String id) =>
      InvoiceDetailsProvider._(argument: id, from: this);

  @override
  String toString() => r'invoiceDetailsProvider';
}

abstract class _$InvoiceDetails extends $AsyncNotifier<Invoice> {
  late final _$args = ref.$arg as String;
  String get id => _$args;

  FutureOr<Invoice> build(String id);
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<AsyncValue<Invoice>, Invoice>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<Invoice>, Invoice>,
              AsyncValue<Invoice>,
              Object?,
              Object?
            >;
    element.handleCreate(ref, () => build(_$args));
  }
}
