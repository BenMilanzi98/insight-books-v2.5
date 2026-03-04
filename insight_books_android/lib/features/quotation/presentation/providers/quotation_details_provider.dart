import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/quotation_repository.dart';
import '../../domain/quotation_model.dart';

final quotationDetailsProvider =
    FutureProvider.family<Quotation, String>((ref, id) async {
  final repo = ref.watch(quotationRepositoryProvider);
  return repo.fetchQuotationById(id);
});
