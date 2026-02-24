import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../domain/invoice_model.dart';
import '../../data/invoice_repository.dart';

part 'invoice_details_provider.g.dart';

@riverpod
class InvoiceDetails extends _$InvoiceDetails {
  @override
  FutureOr<Invoice> build(String id) async {
    final repo = ref.watch(invoiceRepositoryProvider);
    return repo.fetchInvoiceById(id);
  }

  Future<void> updateStatus(String status) async {
    final invoice = state.value;
    if (invoice == null) return;

    state = const AsyncLoading();
    try {
      final repo = ref.read(invoiceRepositoryProvider);
      await repo.updateInvoiceStatus(invoice.id, status);
      // Refresh after update
      ref.invalidateSelf();
    } catch (e, stack) {
      state = AsyncError(e, stack);
    }
  }

  Future<void> markAsPaid() async {
    await updateStatus('Paid');
  }
}
