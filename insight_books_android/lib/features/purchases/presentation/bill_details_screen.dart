import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../domain/purchases_models.dart';
import 'providers/bills_provider.dart';

class BillDetailsScreen extends ConsumerStatefulWidget {
  final String billId;

  const BillDetailsScreen({super.key, required this.billId});

  @override
  ConsumerState<BillDetailsScreen> createState() => _BillDetailsScreenState();
}

class _BillDetailsScreenState extends ConsumerState<BillDetailsScreen> {
  bool _reversing = false;
  bool _matching = false;

  Future<void> _showReverseDialog(SupplierBill bill) async {
    final reasonCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final reason = reasonCtrl.text;
            final valid = isValidReversalReason(reason);
            return AlertDialog(
              title: const Text('Reverse supplier bill'),
              content: SingleChildScrollView(
                child: Form(
                  key: formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'This cancels the bill and records reversals for audit. '
                        'Paid or partially paid bills also unwind linked supplier payments.',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppTheme.textSecondary(context),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: reasonCtrl,
                        maxLines: 3,
                        decoration: InputDecoration(
                          labelText: 'Reversal reason *',
                          hintText:
                              'Why are you reversing bill ${displayBillNumber(bill)}? (min 10 characters)',
                          border: const OutlineInputBorder(),
                        ),
                        onChanged: (_) => setDialogState(() {}),
                        validator: (v) {
                          if (!isValidReversalReason(v ?? '')) {
                            return 'At least 10 characters required';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'The reason is stored for audit.',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppTheme.textSecondary(context),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: Colors.red),
                  onPressed: valid && !_reversing
                      ? () {
                          if (formKey.currentState!.validate()) {
                            Navigator.pop(ctx, true);
                          }
                        }
                      : null,
                  child: const Text('Reverse'),
                ),
              ],
            );
          },
        );
      },
    );

    final reason = reasonCtrl.text.trim();
    reasonCtrl.dispose();
    if (confirmed != true || !mounted) return;

    setState(() => _reversing = true);
    try {
      await ref.read(billsControllerProvider.notifier).reverseBill(
            widget.billId,
            reason: reason,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Supplier bill reversed')),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(NetworkErrorMapper.toUserMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _reversing = false);
    }
  }

  Future<void> _runMatch(SupplierBill bill) async {
    setState(() => _matching = true);
    try {
      final result = await ref
          .read(billsControllerProvider.notifier)
          .matchBill(widget.billId);
      if (!mounted) return;
      final label = formatMatchingStatusLabel(result.matchingStatus);
      if (result.issueMessages.isNotEmpty) {
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text('Match: $label'),
            content: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: result.issueMessages
                    .map((m) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text('• $m'),
                        ))
                    .toList(),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Match result: $label')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(NetworkErrorMapper.toUserMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _matching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(billDetailProvider(widget.billId));
    final page = ref.watch(billsControllerProvider);
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);
    final dateFormat = DateFormat.yMMMd();

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Supplier bill'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          const ThemeToggleButton(),
          ...async.when(
            data: (bill) {
              final canReverse =
                  page.canDelete && bill.status != 'Cancelled';
              if (!canReverse) return <Widget>[];
              return [
                IconButton(
                  icon: _reversing
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.undo_rounded, color: Colors.red),
                  tooltip: 'Reverse bill',
                  onPressed: _reversing ? null : () => _showReverseDialog(bill),
                ),
              ];
            },
            loading: () => const <Widget>[],
            error: (_, _) => const <Widget>[],
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(NetworkErrorMapper.toUserMessage(e)),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () =>
                      ref.invalidate(billDetailProvider(widget.billId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (bill) {
          final balance = bill.totalAmount - bill.amountPaid;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        displayBillNumber(bill),
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (bill.receiptNumber != null &&
                          bill.receiptNumber!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Linked receipt: ${bill.receiptNumber}',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary(context),
                            ),
                          ),
                        ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _StatusChip(status: bill.status),
                          if (bill.matchingStatus != null &&
                              bill.matchingStatus!.isNotEmpty &&
                              bill.matchingStatus != 'NOT_REQUIRED')
                            _MatchingStatusChip(status: bill.matchingStatus!),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _DetailRow(
                        label: 'Supplier',
                        value: bill.supplierName ?? '—',
                      ),
                      if (bill.billDate != null)
                        _DetailRow(
                          label: 'Bill date',
                          value: dateFormat.format(bill.billDate!),
                        ),
                      if (bill.dueDate != null)
                        _DetailRow(
                          label: 'Due date',
                          value: dateFormat.format(bill.dueDate!),
                        ),
                      if (bill.billType != null)
                        _DetailRow(label: 'Type', value: bill.billType!),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Amounts',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _DetailRow(
                        label: 'Total',
                        value: currency.format(bill.totalAmount),
                      ),
                      _DetailRow(
                        label: 'Paid',
                        value: currency.format(bill.amountPaid),
                      ),
                      _DetailRow(
                        label: 'Balance due',
                        value: currency.format(balance),
                        emphasize: true,
                      ),
                    ],
                  ),
                ),
              ),
              if (bill.items.isNotEmpty) ...[
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Line items',
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        for (final item in bill.items)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.productName ??
                                            (item.description.isNotEmpty
                                                ? item.description
                                                : 'Line item'),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      if (item.quantity > 0)
                                        Text(
                                          '${item.quantity} × ${currency.format(item.unitCost)}',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: AppTheme.textSecondary(
                                              context,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                Text(currency.format(item.lineTotal)),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
              if (bill.status != 'Cancelled' &&
                  bill.receiptNumber != null &&
                  bill.receiptNumber!.isNotEmpty) ...[
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Three-way match',
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          bill.matchingStatus != null &&
                                  bill.matchingStatus!.isNotEmpty
                              ? formatMatchingStatusLabel(bill.matchingStatus)
                              : 'Not evaluated yet',
                          style: TextStyle(
                            color: AppTheme.textSecondary(context),
                          ),
                        ),
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: _matching ? null : () => _runMatch(bill),
                          icon: _matching
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.compare_arrows_rounded),
                          label: const Text('Run match'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              if (bill.status != 'Cancelled' && page.canDelete) ...[
                const SizedBox(height: 24),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.red,
                    minimumSize: const Size.fromHeight(48),
                  ),
                  onPressed: _reversing ? null : () => _showReverseDialog(bill),
                  icon: _reversing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.undo_rounded),
                  label: const Text('Reverse bill'),
                ),
                const SizedBox(height: 8),
                Text(
                  'Bills cannot be edited after creation.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppTheme.textSecondary(context),
                  ),
                ),
              ],
              const SizedBox(height: 32),
            ],
          );
        },
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: TextStyle(color: AppTheme.textSecondary(context)),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: emphasize
                  ? const TextStyle(fontWeight: FontWeight.bold)
                  : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _MatchingStatusChip extends StatelessWidget {
  const _MatchingStatusChip({required this.status});

  final String status;

  Color _colorFor(String s) {
    if (isSuccessfulMatchStatus(s)) return Colors.green;
    if (isBlockingMatchStatus(s)) return Colors.red;
    return Colors.orange;
  }

  @override
  Widget build(BuildContext context) {
    final color = _colorFor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        formatMatchingStatusLabel(status),
        style: TextStyle(
          color: color.shade700,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  Color _colorFor(String s) {
    switch (s) {
      case 'Paid':
        return Colors.green;
      case 'Partially Paid':
        return Colors.orange;
      case 'Overdue':
        return Colors.red;
      case 'Cancelled':
        return Colors.blueGrey;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _colorFor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: color.shade700,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

extension on Color {
  Color get shade700 {
    final hsl = HSLColor.fromColor(this);
    return hsl.withLightness((hsl.lightness * 0.55).clamp(0.0, 1.0)).toColor();
  }
}
