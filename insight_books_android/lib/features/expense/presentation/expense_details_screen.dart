import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../data/expense_repository.dart';
import '../domain/expense_model.dart';
import 'providers/expense_details_provider.dart';
import 'providers/expense_provider.dart';

class ExpenseDetailsScreen extends ConsumerWidget {
  final String expenseId;

  const ExpenseDetailsScreen({super.key, required this.expenseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expenseAsync = ref.watch(expenseDetailsProvider(expenseId));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Expense Details'),
        actions: [
          expenseAsync.whenOrNull(
                data: (expense) => PopupMenuButton<String>(
                  onSelected: (action) =>
                      _handleAction(context, ref, expense, action),
                  itemBuilder: (ctx) => _buildMenuItems(expense),
                  icon: const Icon(Icons.more_vert),
                ),
              ) ??
              const SizedBox.shrink(),
        ],
      ),
      body: expenseAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline,
                size: 48,
                color: theme.colorScheme.error,
              ),
              const SizedBox(height: 12),
              Text(
                'Failed to load expense',
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              FilledButton.tonalIcon(
                onPressed: () =>
                    ref.invalidate(expenseDetailsProvider(expenseId)),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (expense) => _ExpenseDetailsBody(
              expense: expense,
              expenseId: expenseId,
            ),
      ),
    );
  }

  List<PopupMenuEntry<String>> _buildMenuItems(Expense expense) {
    final items = <PopupMenuEntry<String>>[];
    if (expense.isEditable) {
      items.add(
        const PopupMenuItem(
          value: 'edit',
          child: ListTile(
            leading: Icon(Icons.edit_outlined),
            title: Text('Edit'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
      if (expense.canAddPartialPayment) {
        items.add(
          const PopupMenuItem(
            value: 'partial_payment',
            child: ListTile(
              leading: Icon(Icons.payment_outlined),
              title: Text('Add payment'),
              dense: true,
              contentPadding: EdgeInsets.zero,
            ),
          ),
        );
      }
      items.add(
        const PopupMenuItem(
          value: 'delete',
          child: ListTile(
            leading: Icon(Icons.delete_outline, color: Colors.red),
            title: Text('Delete', style: TextStyle(color: Colors.red)),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }
    return items;
  }

  Future<void> _handleAction(
    BuildContext context,
    WidgetRef ref,
    Expense expense,
    String action,
  ) async {
    switch (action) {
      case 'edit':
        context.push('/expenses/${expense.id}/edit');
        break;
      case 'partial_payment':
        showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          builder: (ctx) => _PartialPaymentSheet(
            expense: expense,
            onSubmitted: () {
              Navigator.pop(ctx);
              ref.invalidate(expenseDetailsProvider(expenseId));
              ref.read(expenseControllerProvider.notifier).loadAll();
            },
          ),
        );
        break;
      case 'delete':
        final reasonCtrl = TextEditingController();
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete Expense'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Delete "${expense.description}"?'),
                const SizedBox(height: 12),
                TextField(
                  controller: reasonCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Reason (optional)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error,
                ),
                child: const Text('Delete'),
              ),
            ],
          ),
        );
        if (confirmed == true && context.mounted) {
          try {
            await ref.read(expenseControllerProvider.notifier).deleteExpense(
                  expense.id,
                  reason: reasonCtrl.text.isEmpty ? null : reasonCtrl.text,
                );
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Expense deleted')),
              );
              context.pop();
            }
          } catch (e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Failed: $e')),
              );
            }
          }
        }
        break;
    }
  }
}

Future<void> _pickAndUploadAttachments(
  BuildContext context,
  WidgetRef ref,
  String expenseId,
) async {
  final result = await FilePicker.platform.pickFiles(
    type: FileType.custom,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
    allowMultiple: true,
  );
  if (result == null || result.files.isEmpty || !context.mounted) return;
  final paths = result.files
      .map((f) => f.path)
      .where((p) => p != null && p.isNotEmpty)
      .cast<String>()
      .toList();
  if (paths.isEmpty) return;
  final files = paths.map((p) => File(p)).toList();
  try {
    await ref.read(expenseRepositoryProvider).uploadAttachments(expenseId, files);
    ref.invalidate(expenseDetailsProvider(expenseId));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${files.length} file(s) attached')),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Upload failed: $e')),
      );
    }
  }
}

Future<void> _confirmDeleteAttachment(
  BuildContext context,
  WidgetRef ref,
  String expenseId,
  String attachmentId,
) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Delete attachment'),
      content: const Text('Remove this attachment?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
  if (ok != true || !context.mounted) return;
  try {
    await ref.read(expenseRepositoryProvider).deleteAttachment(expenseId, attachmentId);
    ref.invalidate(expenseDetailsProvider(expenseId));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attachment removed')),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e')),
      );
    }
  }
}

class _ExpenseDetailsBody extends ConsumerWidget {
  final Expense expense;
  final String expenseId;

  const _ExpenseDetailsBody({
    required this.expense,
    required this.expenseId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final currencyFormat =
        NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(
                  color: theme.colorScheme.outlineVariant.withValues(alpha: 0.4)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    expense.description,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _DetailRow(
                    label: 'Amount',
                    value: currencyFormat.format(expense.amount),
                    valueStyle: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  _DetailRow(label: 'Date', value: expense.date),
                  _DetailRow(label: 'Category', value: expense.category),
                  _DetailRow(label: 'Status', value: expense.status),
                  _DetailRow(
                      label: 'Payment status', value: expense.paymentStatus),
                  if (expense.merchant != null &&
                      expense.merchant!.isNotEmpty)
                    _DetailRow(label: 'Merchant', value: expense.merchant!),
                  if (expense.submittedBy != null &&
                      expense.submittedBy!.isNotEmpty)
                    _DetailRow(
                        label: 'Submitted by', value: expense.submittedBy!),
                  if (expense.notes != null && expense.notes!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Notes',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: theme.colorScheme.outline,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(expense.notes!),
                  ],
                ],
              ),
            ),
          ),
          if (expense.payments.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'Payments',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            ...expense.payments.map((p) => Card(
                  elevation: 0,
                  margin: const EdgeInsets.only(bottom: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                        color: theme.colorScheme.outlineVariant
                            .withValues(alpha: 0.3)),
                  ),
                  child: ListTile(
                    title: Text(currencyFormat.format(p.amount)),
                    subtitle: Text(
                        '${p.paymentMethod} • ${p.paymentDate ?? ''}'),
                    trailing: p.reference != null
                        ? Text(
                            p.reference!,
                            style: theme.textTheme.bodySmall,
                            overflow: TextOverflow.ellipsis,
                          )
                        : null,
                  ),
                )),
          ],
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Attachments',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (expense.isEditable)
                TextButton.icon(
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add'),
                  onPressed: () => _pickAndUploadAttachments(context, ref, expenseId),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (expense.attachments.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No attachments',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
            )
          else
            ...expense.attachments.map((a) => ListTile(
                  leading: const Icon(Icons.attach_file),
                  title: Text(a.name ?? 'Attachment'),
                  subtitle: a.size != null ? Text(a.size!) : null,
                  trailing: expense.isEditable
                      ? IconButton(
                          icon: Icon(
                            Icons.delete_outline,
                            size: 20,
                            color: theme.colorScheme.error,
                          ),
                          onPressed: () => _confirmDeleteAttachment(
                              context, ref, expenseId, a.id),
                        )
                      : null,
                )),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final TextStyle? valueStyle;

  const _DetailRow({
    required this.label,
    required this.value,
    this.valueStyle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                color: Theme.of(context).colorScheme.outline,
                fontSize: 14,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: valueStyle ?? const TextStyle(fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}

class _PartialPaymentSheet extends ConsumerStatefulWidget {
  final Expense expense;
  final VoidCallback onSubmitted;

  const _PartialPaymentSheet({
    required this.expense,
    required this.onSubmitted,
  });

  @override
  ConsumerState<_PartialPaymentSheet> createState() =>
      _PartialPaymentSheetState();
}

class _PartialPaymentSheetState extends ConsumerState<_PartialPaymentSheet> {
  final _amountCtrl = TextEditingController();
  final _paymentMethodCtrl = TextEditingController(text: 'Cash');
  final _referenceCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  DateTime _paymentDate = DateTime.now();
  bool _submitting = false;

  @override
  void dispose() {
    _amountCtrl.dispose();
    _paymentMethodCtrl.dispose();
    _referenceCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final remaining =
        widget.expense.amount - widget.expense.paidAmount;

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Add payment', style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Remaining: MK ${remaining.toStringAsFixed(2)}',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountCtrl,
              decoration: const InputDecoration(
                labelText: 'Amount',
                border: OutlineInputBorder(),
                prefixText: 'MK ',
              ),
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _paymentMethodCtrl,
              decoration: const InputDecoration(
                labelText: 'Payment method',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            ListTile(
              title: const Text('Payment date'),
              subtitle: Text(DateFormat.yMd().format(_paymentDate)),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: _paymentDate,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now()
                      .add(const Duration(days: 365)),
                );
                if (date != null) setState(() => _paymentDate = date);
              },
            ),
            TextField(
              controller: _referenceCtrl,
              decoration: const InputDecoration(
                labelText: 'Reference (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              decoration: const InputDecoration(
                labelText: 'Notes (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      height: 24,
                      width: 24,
                      child:
                          CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Add payment'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final amount =
        double.tryParse(_amountCtrl.text.replaceAll(',', ''));
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid amount')),
      );
      return;
    }
    if (amount > (widget.expense.amount - widget.expense.paidAmount)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Amount exceeds remaining balance')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(expenseControllerProvider.notifier).addPartialPayment(
            AddPartialPaymentRequest(
              expenseId: widget.expense.id,
              amount: amount,
              paymentMethod:
                  _paymentMethodCtrl.text.trim().isEmpty
                      ? 'Cash'
                      : _paymentMethodCtrl.text.trim(),
              paymentDate:
                  DateFormat('yyyy-MM-dd').format(_paymentDate),
              reference: _referenceCtrl.text.trim().isEmpty
                  ? null
                  : _referenceCtrl.text.trim(),
              notes: _notesCtrl.text.trim().isEmpty
                  ? null
                  : _notesCtrl.text.trim(),
            ),
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment added')),
        );
        widget.onSubmitted();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
