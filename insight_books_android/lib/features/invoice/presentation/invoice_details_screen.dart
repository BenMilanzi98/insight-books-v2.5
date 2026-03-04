import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../data/invoice_repository.dart';
import '../domain/invoice_model.dart';
import 'providers/invoice_details_provider.dart';
import 'providers/invoice_provider.dart';

class InvoiceDetailsScreen extends ConsumerWidget {
  final String invoiceId;

  const InvoiceDetailsScreen({super.key, required this.invoiceId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoiceAsync = ref.watch(invoiceDetailsProvider(invoiceId));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoice Details'),
        actions: [
          invoiceAsync.whenOrNull(
                data: (invoice) => PopupMenuButton<String>(
                  onSelected: (action) =>
                      _handleAction(context, ref, invoice, action),
                  itemBuilder: (ctx) => _buildMenuItems(invoice),
                  icon: const Icon(Icons.more_vert),
                ),
              ) ??
              const SizedBox.shrink(),
        ],
      ),
      body: invoiceAsync.when(
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
                'Failed to load invoice',
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              FilledButton.tonalIcon(
                onPressed: () =>
                    ref.invalidate(invoiceDetailsProvider(invoiceId)),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (invoice) =>
            _InvoiceDetailsBody(invoice: invoice, invoiceId: invoiceId),
      ),
    );
  }

  List<PopupMenuEntry<String>> _buildMenuItems(Invoice invoice) {
    final items = <PopupMenuEntry<String>>[];
    final status = invoice.status.toLowerCase();

    if (status == 'pending' ||
        status == 'sent' ||
        status == 'partial' ||
        status == 'overdue') {
      items.add(
        const PopupMenuItem(
          value: 'mark_paid',
          child: ListTile(
            leading: Icon(Icons.check_circle_outline, color: Colors.green),
            title: Text('Mark as Paid'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }

    if (status == 'pending' ||
        status == 'sent' ||
        status == 'partial' ||
        status == 'overdue') {
      items.add(
        const PopupMenuItem(
          value: 'partial_payment',
          child: ListTile(
            leading: Icon(Icons.payment_outlined, color: Colors.blue),
            title: Text('Record Payment'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }

    if (status != 'void' && status != 'paid' && status != 'refunded') {
      items.add(
        const PopupMenuItem(
          value: 'void',
          child: ListTile(
            leading: Icon(Icons.block, color: Colors.brown),
            title: Text('Void Invoice'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }

    if (status == 'draft' || status == 'pending') {
      items.add(
        const PopupMenuItem(
          value: 'delete',
          child: ListTile(
            leading: Icon(Icons.delete_outline, color: Colors.red),
            title: Text('Delete Invoice'),
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
    Invoice invoice,
    String action,
  ) async {
    switch (action) {
      case 'mark_paid':
        await _showMarkAsPaidDialog(context, ref, invoice);
        break;
      case 'partial_payment':
        await _showPartialPaymentSheet(context, ref, invoice);
        break;
      case 'void':
        await _showVoidDialog(context, ref, invoice);
        break;
      case 'delete':
        await _showDeleteDialog(context, ref, invoice);
        break;
    }
  }

  Future<void> _showMarkAsPaidDialog(
    BuildContext context,
    WidgetRef ref,
    Invoice invoice,
  ) async {
    String method = 'cash';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Mark as Paid'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Mark invoice ${invoice.invoiceNumber} as fully paid?'),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: method,
                decoration: const InputDecoration(
                  labelText: 'Payment Method',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'cash', child: Text('Cash')),
                  DropdownMenuItem(
                    value: 'bank_transfer',
                    child: Text('Bank Transfer'),
                  ),
                  DropdownMenuItem(
                    value: 'mobile_money',
                    child: Text('Mobile Money'),
                  ),
                  DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
                  DropdownMenuItem(value: 'card', child: Text('Card')),
                ],
                onChanged: (v) => setState(() => method = v ?? 'cash'),
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
              child: const Text('Confirm'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && context.mounted) {
      try {
        await ref
            .read(invoiceRepositoryProvider)
            .markAsPaid(invoice.id, method);
        ref.invalidate(invoiceDetailsProvider(invoiceId));
        ref.invalidate(invoiceControllerProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invoice marked as paid')),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      }
    }
  }

  Future<void> _showPartialPaymentSheet(
    BuildContext context,
    WidgetRef ref,
    Invoice invoice,
  ) async {
    final amountCtrl = TextEditingController();
    final refCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String method = 'cash';
    final formatter = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Record Payment',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Text(
                'Outstanding: ${formatter.format(invoice.amountDue > 0 ? invoice.amountDue : invoice.total - invoice.totalPaid)}',
                style: TextStyle(color: Colors.grey[600]),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Amount',
                  prefixText: 'MK ',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: method,
                decoration: const InputDecoration(
                  labelText: 'Payment Method',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'cash', child: Text('Cash')),
                  DropdownMenuItem(
                    value: 'bank_transfer',
                    child: Text('Bank Transfer'),
                  ),
                  DropdownMenuItem(
                    value: 'mobile_money',
                    child: Text('Mobile Money'),
                  ),
                  DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
                  DropdownMenuItem(value: 'card', child: Text('Card')),
                ],
                onChanged: (v) => setState(() => method = v ?? 'cash'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: refCtrl,
                decoration: const InputDecoration(
                  labelText: 'Reference (optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notesCtrl,
                decoration: const InputDecoration(
                  labelText: 'Notes (optional)',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    final amount = double.tryParse(amountCtrl.text);
                    if (amount == null || amount <= 0) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Enter a valid amount')),
                      );
                      return;
                    }
                    Navigator.pop(ctx);
                    try {
                      await ref
                          .read(invoiceRepositoryProvider)
                          .addPartialPayment(
                            invoiceId: invoice.id,
                            amount: amount,
                            paymentMethod: method,
                            reference: refCtrl.text.isNotEmpty
                                ? refCtrl.text
                                : null,
                            notes: notesCtrl.text.isNotEmpty
                                ? notesCtrl.text
                                : null,
                          );
                      ref.invalidate(invoiceDetailsProvider(invoiceId));
                      ref.invalidate(invoiceControllerProvider);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Payment recorded')),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(
                          context,
                        ).showSnackBar(SnackBar(content: Text('Error: $e')));
                      }
                    }
                  },
                  child: const Text('Record Payment'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showVoidDialog(
    BuildContext context,
    WidgetRef ref,
    Invoice invoice,
  ) async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Void Invoice'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Void invoice ${invoice.invoiceNumber}?'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Reason for voiding',
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
            style: FilledButton.styleFrom(backgroundColor: Colors.brown),
            child: const Text('Void'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      if (reasonCtrl.text.trim().length < 3) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reason must be at least 3 characters')),
        );
        return;
      }
      try {
        await ref
            .read(invoiceRepositoryProvider)
            .voidInvoice(invoice.id, reasonCtrl.text.trim());
        ref.invalidate(invoiceDetailsProvider(invoiceId));
        ref.invalidate(invoiceControllerProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Invoice voided')));
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      }
    }
  }

  Future<void> _showDeleteDialog(
    BuildContext context,
    WidgetRef ref,
    Invoice invoice,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Invoice'),
        content: Text(
          'Delete invoice ${invoice.invoiceNumber}? This cannot be undone.',
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
        await ref.read(invoiceRepositoryProvider).deleteInvoice(invoice.id);
        ref.invalidate(invoiceControllerProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Invoice deleted')));
          context.pop();
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════
//  Invoice Details Body
// ═══════════════════════════════════════════════════

class _InvoiceDetailsBody extends ConsumerWidget {
  final Invoice invoice;
  final String invoiceId;

  const _InvoiceDetailsBody({required this.invoice, required this.invoiceId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final dateFormat = DateFormat('d MMM y');
    final currencyFormat = NumberFormat.currency(
      symbol: 'MK ',
      decimalDigits: 2,
    );
    final statusColor = _statusColor(invoice.status);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Status Badge + Invoice Number ──
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: statusColor.withValues(alpha: 0.3)),
          ),
          color: statusColor.withValues(alpha: 0.06),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Icon(_statusIcon(invoice.status), size: 40, color: statusColor),
                const SizedBox(height: 8),
                Text(
                  invoice.status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: statusColor,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  invoice.invoiceNumber,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // ── Dates ──
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(
              color: theme.colorScheme.outlineVariant.withValues(alpha: 0.4),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Issue Date',
                        style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        invoice.issueDate != null
                            ? dateFormat.format(invoice.issueDate!)
                            : dateFormat.format(invoice.createdAt),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Due Date',
                        style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        dateFormat.format(invoice.dueDate),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // ── Client ──
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(
              color: theme.colorScheme.outlineVariant.withValues(alpha: 0.4),
            ),
          ),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: theme.colorScheme.primaryContainer,
              child: Text(
                invoice.client.name.isNotEmpty
                    ? invoice.client.name[0].toUpperCase()
                    : 'C',
                style: TextStyle(color: theme.colorScheme.onPrimaryContainer),
              ),
            ),
            title: Text(
              invoice.client.name,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: Text(invoice.client.email ?? invoice.client.phone ?? ''),
          ),
        ),
        const SizedBox(height: 16),

        // ── Line Items ──
        Text(
          'Items',
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        ...invoice.items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: theme.colorScheme.outlineVariant.withValues(
                    alpha: 0.3,
                  ),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.description ?? item.product.name,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          Text(
                            '${item.quantity} × ${currencyFormat.format(item.unitPrice)}',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      currencyFormat.format(item.total),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),

        // ── Financial Summary ──
        Card(
          elevation: 0,
          color: theme.colorScheme.surfaceContainerLow,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _SummaryRow(
                  label: 'Subtotal',
                  value: currencyFormat.format(invoice.subtotal),
                ),
                if (invoice.totalDiscount > 0)
                  _SummaryRow(
                    label: 'Discount',
                    value: '-${currencyFormat.format(invoice.totalDiscount)}',
                    color: Colors.red,
                  ),
                if (invoice.totalTax > 0)
                  _SummaryRow(
                    label: 'Tax',
                    value: currencyFormat.format(invoice.totalTax),
                  ),
                const Divider(height: 20),
                _SummaryRow(
                  label: 'Total',
                  value: currencyFormat.format(invoice.total),
                  isBold: true,
                ),
                if (invoice.totalPaid > 0) ...[
                  const SizedBox(height: 8),
                  _SummaryRow(
                    label: 'Paid',
                    value: currencyFormat.format(invoice.totalPaid),
                    color: Colors.green,
                  ),
                  _SummaryRow(
                    label: 'Balance Due',
                    value: currencyFormat.format(
                      invoice.amountDue > 0
                          ? invoice.amountDue
                          : invoice.total - invoice.totalPaid,
                    ),
                    isBold: true,
                    color: Colors.orange,
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // ── Payment History ──
        if (invoice.payments.isNotEmpty) ...[
          Text(
            'Payment History',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          ...invoice.payments.map(
            (p) => Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.green.withValues(alpha: 0.3)),
              ),
              child: ListTile(
                leading: const Icon(
                  Icons.check_circle,
                  color: Colors.green,
                  size: 20,
                ),
                title: Text(
                  currencyFormat.format(p.amount),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(p.paymentMethod),
                trailing: Text(
                  p.paymentDate ?? '',
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],

        // ── Notes ──
        if (invoice.notes != null && invoice.notes!.isNotEmpty) ...[
          Text(
            'Notes',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(invoice.notes!, style: theme.textTheme.bodyMedium),
          const SizedBox(height: 16),
        ],
      ],
    );
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
        return Colors.green;
      case 'pending':
      case 'sent':
        return Colors.orange;
      case 'overdue':
        return Colors.red;
      case 'draft':
        return Colors.grey;
      case 'partial':
        return Colors.blue;
      case 'void':
        return Colors.brown;
      default:
        return Colors.grey;
    }
  }

  IconData _statusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
        return Icons.check_circle;
      case 'pending':
      case 'sent':
        return Icons.schedule;
      case 'overdue':
        return Icons.warning_amber;
      case 'draft':
        return Icons.edit_note;
      case 'partial':
        return Icons.pie_chart;
      case 'void':
        return Icons.block;
      default:
        return Icons.receipt_long;
    }
  }
}

// ═══════════════════════════════════════════════════
//  Summary Row
// ═══════════════════════════════════════════════════

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;
  final Color? color;

  const _SummaryRow({
    required this.label,
    required this.value,
    this.isBold = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: color,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
