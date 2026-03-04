import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/invoice_repository.dart';
import '../../domain/invoice_model.dart';

final invoiceDetailsProvider = FutureProvider.family<Invoice, String>((
  ref,
  id,
) async {
  final repo = ref.watch(invoiceRepositoryProvider);
  return repo.fetchInvoiceById(id);
});

final invoicePaymentHistoryProvider =
    FutureProvider.family<List<InvoicePayment>, String>((ref, invoiceId) async {
      final repo = ref.watch(invoiceRepositoryProvider);
      return repo.fetchPaymentHistory(invoiceId);
    });
