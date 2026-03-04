import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/expense_repository.dart';
import '../../domain/expense_model.dart';

final expenseDetailsProvider =
    FutureProvider.family<Expense, String>((ref, expenseId) async {
  final repo = ref.watch(expenseRepositoryProvider);
  return repo.fetchExpenseById(expenseId);
});

final expensePartialPaymentsProvider =
    FutureProvider.family<PartialPaymentHistoryResponse, String>(
        (ref, expenseId) async {
  final repo = ref.watch(expenseRepositoryProvider);
  return repo.fetchPartialPaymentHistory(expenseId);
});

final expenseAttachmentsProvider =
    FutureProvider.family<List<ExpenseAttachment>, String>((ref, expenseId) async {
  final repo = ref.watch(expenseRepositoryProvider);
  return repo.fetchAttachments(expenseId);
});
