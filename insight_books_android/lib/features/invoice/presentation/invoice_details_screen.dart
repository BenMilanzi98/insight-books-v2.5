import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../data/invoice_repository.dart';
import '../domain/invoice_model.dart';
import 'providers/invoice_details_provider.dart';
import 'providers/invoice_provider.dart';

class InvoiceDetailsScreen extends ConsumerStatefulWidget {
  final String invoiceId;
  const InvoiceDetailsScreen({super.key, required this.invoiceId});

  @override
  ConsumerState<InvoiceDetailsScreen> createState() =>
      _InvoiceDetailsScreenState();
}

class _InvoiceDetailsScreenState extends ConsumerState<InvoiceDetailsScreen> {
  final _currencyFormat = NumberFormat.currency(
    symbol: 'MK ',
    decimalDigits: 2,
  );

  @override
  Widget build(BuildContext context) {
    final invoiceAsync = ref.watch(invoiceDetailsProvider(widget.invoiceId));
    final invoiceState = ref.watch(invoiceControllerProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoice Details'),
        actions: [
          invoiceAsync.whenOrNull(
                data: (invoice) => PopupMenuButton<String>(
                  onSelected: (action) =>
                      _handleAction(action, invoice, context, invoiceState),
                  itemBuilder: (_) => _buildMenuItems(invoice, invoiceState),
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
              const SizedBox(height: 16),
              Text(
                'Failed to load invoice',
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () => ref.invalidate(invoiceDetailsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (invoice) => _buildBody(invoice, theme),
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Menu Items
  // ═══════════════════════════════════════════════════

  List<PopupMenuEntry<String>> _buildMenuItems(
    Invoice invoice,
    InvoicePageState permissions,
  ) {
    final status = invoice.status.toLowerCase();
    final items = <PopupMenuEntry<String>>[];

    // Edit — only draft invoices
    if (status == 'draft' && permissions.canUpdateInvoices) {
      items.add(
        const PopupMenuItem(
          value: 'edit',
          child: ListTile(leading: Icon(Icons.edit), title: Text('Edit')),
        ),
      );
      items.add(const PopupMenuDivider());
    }

    if (permissions.canSendInvoices) {
      items.add(
        const PopupMenuItem(
          value: 'send',
          child: ListTile(
            leading: Icon(Icons.send_outlined),
            title: Text('Send Invoice'),
          ),
        ),
      );
    }
    if (permissions.canExportInvoices) {
      items.add(
        const PopupMenuItem(
          value: 'download',
          child: ListTile(
            leading: Icon(Icons.picture_as_pdf_outlined),
            title: Text('Download PDF'),
          ),
        ),
      );
    }

    // Mark as Paid — pending/sent/overdue/partial
    if (['pending', 'sent', 'overdue', 'partial'].contains(status) &&
        permissions.canUpdateInvoices) {
      items.add(
        const PopupMenuItem(
          value: 'mark_paid',
          child: ListTile(
            leading: Icon(Icons.check_circle, color: Colors.green),
            title: Text('Mark as Paid'),
          ),
        ),
      );
    }

    // Partial Payment — pending/sent/overdue/partial
    if (['pending', 'sent', 'overdue', 'partial'].contains(status) &&
        permissions.canUpdateInvoices) {
      items.add(
        const PopupMenuItem(
          value: 'partial_payment',
          child: ListTile(
            leading: Icon(Icons.pie_chart, color: Colors.blue),
            title: Text('Record Partial Payment'),
          ),
        ),
      );
    }

    // Void — not void/paid
    if (!['void', 'paid'].contains(status) && permissions.canUpdateInvoices) {
      items.add(
        const PopupMenuItem(
          value: 'void',
          child: ListTile(
            leading: Icon(Icons.block, color: Colors.brown),
            title: Text('Void Invoice'),
          ),
        ),
      );
    }

    // Refund — paid/partial (has payments)
    if (['paid', 'partial'].contains(status) &&
        invoice.totalPaid > 0 &&
        permissions.canUpdateInvoices) {
      items.add(
        const PopupMenuItem(
          value: 'refund',
          child: ListTile(
            leading: Icon(Icons.undo, color: Colors.orange),
            title: Text('Refund'),
          ),
        ),
      );
    }

    // Delete
    if (permissions.canDeleteInvoices) {
      items.add(const PopupMenuDivider());
      items.add(
        const PopupMenuItem(
          value: 'delete',
          child: ListTile(
            leading: Icon(Icons.delete, color: Colors.red),
            title: Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ),
      );
    }

    return items;
  }

  // ═══════════════════════════════════════════════════
  //  Action Handler
  // ═══════════════════════════════════════════════════

  Future<void> _handleAction(
    String action,
    Invoice invoice,
    BuildContext ctx,
    InvoicePageState permissions,
  ) async {
    final requiresUpdate = {'edit', 'mark_paid', 'partial_payment', 'void', 'refund'};
    if (requiresUpdate.contains(action) && !permissions.canUpdateInvoices) {
      _showPermissionDenied();
      return;
    }
    if (action == 'send' && !permissions.canSendInvoices) {
      _showPermissionDenied();
      return;
    }
    if (action == 'download' && !permissions.canExportInvoices) {
      _showPermissionDenied();
      return;
    }
    if (action == 'delete' && !permissions.canDeleteInvoices) {
      _showPermissionDenied();
      return;
    }
    switch (action) {
      case 'edit':
        ctx.push('/invoice/${invoice.id}/edit');
        break;
      case 'mark_paid':
        await _showMarkAsPaidDialog(invoice);
        break;
      case 'send':
        await _showSendInvoiceDialog(invoice);
        break;
      case 'download':
        await _downloadInvoicePdf(invoice);
        break;
      case 'partial_payment':
        await _showPartialPaymentSheet(invoice);
        break;
      case 'void':
        await _showVoidDialog(invoice);
        break;
      case 'refund':
        await _showRefundSheet(invoice);
        break;
      case 'delete':
        await _showDeleteDialog(invoice);
        break;
    }
  }

  // ═══════════════════════════════════════════════════
  //  Body
  // ═══════════════════════════════════════════════════

  Widget _buildBody(Invoice invoice, ThemeData theme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // ── Status Banner ──
          _buildStatusBanner(invoice, theme),
          const SizedBox(height: 16),

          // ── Client & Dates Card ──
          _buildInfoCard(invoice, theme),
          const SizedBox(height: 12),

          // ── Items Card ──
          _buildItemsCard(invoice, theme),
          const SizedBox(height: 12),

          // ── Summary Card ──
          _buildSummaryCard(invoice, theme),
          const SizedBox(height: 12),

          // ── Payment History ──
          if (invoice.payments.isNotEmpty) ...[
            _buildPaymentHistoryCard(invoice, theme),
            const SizedBox(height: 12),
          ],

          // ── Notes ──
          if (invoice.notes != null && invoice.notes!.isNotEmpty) ...[
            _buildNotesCard(invoice, theme),
            const SizedBox(height: 12),
          ],

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Status Banner
  // ═══════════════════════════════════════════════════

  Widget _buildStatusBanner(Invoice invoice, ThemeData theme) {
    final color = _statusColor(invoice.status);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Row(
        children: [
          Icon(_statusIcon(invoice.status), color: color, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invoice.status[0].toUpperCase() + invoice.status.substring(1),
                  style: TextStyle(
                    color: color,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  invoice.invoiceNumber,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: color.withAlpha(180),
                  ),
                ),
              ],
            ),
          ),
          Text(
            _currencyFormat.format(invoice.total),
            style: TextStyle(
              color: color,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Info Card
  // ═══════════════════════════════════════════════════

  Widget _buildInfoCard(Invoice invoice, ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Details',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const Divider(),
            _DetailRow(
              label: 'Client',
              value: invoice.client.name,
              theme: theme,
            ),
            _DetailRow(
              label: 'Issue Date',
              value: invoice.issueDate != null
                  ? DateFormat('MMM d, y').format(invoice.issueDate!)
                  : DateFormat('MMM d, y').format(invoice.createdAt),
              theme: theme,
            ),
            _DetailRow(
              label: 'Due Date',
              value: DateFormat('MMM d, y').format(invoice.dueDate),
              theme: theme,
            ),
            _DetailRow(
              label: 'Currency',
              value: invoice.currency,
              theme: theme,
            ),
            if (invoice.terms != null && invoice.terms!.isNotEmpty)
              _DetailRow(label: 'Terms', value: invoice.terms!, theme: theme),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Items Card
  // ═══════════════════════════════════════════════════

  Widget _buildItemsCard(Invoice invoice, ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Items',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const Divider(),
            ...invoice.items.map(
              (item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.product.name,
                            style: const TextStyle(fontWeight: FontWeight.w500),
                          ),
                          Text(
                            '${item.quantity.toStringAsFixed(item.quantity.truncateToDouble() == item.quantity ? 0 : 2)} × ${_currencyFormat.format(item.unitPrice)}',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface.withAlpha(150),
                            ),
                          ),
                          if (item.taxRate > 0)
                            Text(
                              'Tax: ${item.taxRate.toStringAsFixed(1)}%',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurface.withAlpha(
                                  120,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Text(
                      _currencyFormat.format(item.total),
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Summary Card
  // ═══════════════════════════════════════════════════

  Widget _buildSummaryCard(Invoice invoice, ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _SummaryRow(
              label: 'Subtotal',
              value: _currencyFormat.format(invoice.subtotal),
            ),
            if (invoice.totalTax > 0)
              _SummaryRow(
                label: 'Tax',
                value: _currencyFormat.format(invoice.totalTax),
              ),
            if (invoice.totalDiscount > 0)
              _SummaryRow(
                label: 'Discount',
                value: '-${_currencyFormat.format(invoice.totalDiscount)}',
              ),
            const Divider(),
            _SummaryRow(
              label: 'Total',
              value: _currencyFormat.format(invoice.total),
              isBold: true,
            ),
            if (invoice.totalPaid > 0)
              _SummaryRow(
                label: 'Paid',
                value: _currencyFormat.format(invoice.totalPaid),
                color: Colors.green,
              ),
            if (invoice.remainingBalance > 0)
              _SummaryRow(
                label: 'Balance Due',
                value: _currencyFormat.format(invoice.remainingBalance),
                color: Colors.red,
                isBold: true,
              ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Payment History Card
  // ═══════════════════════════════════════════════════

  Widget _buildPaymentHistoryCard(Invoice invoice, ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Payment History',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const Divider(),
            ...invoice.payments.map((payment) {
              final parsedDate = payment.paymentDate != null
                  ? DateTime.tryParse(payment.paymentDate!)
                  : null;
              final date = parsedDate != null
                  ? DateFormat('MMM d, y').format(parsedDate)
                  : 'Unknown';
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  radius: 18,
                  backgroundColor: Colors.green.withAlpha(25),
                  child: const Icon(
                    Icons.payment,
                    color: Colors.green,
                    size: 20,
                  ),
                ),
                title: Text(_currencyFormat.format(payment.amount)),
                subtitle: Text(
                  '${payment.paymentMethod} · $date',
                  style: theme.textTheme.bodySmall,
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Notes Card
  // ═══════════════════════════════════════════════════

  Widget _buildNotesCard(Invoice invoice, ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Notes',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const Divider(),
            Text(invoice.notes!, style: theme.textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Mark as Paid Dialog
  // ═══════════════════════════════════════════════════

  Future<void> _showMarkAsPaidDialog(Invoice invoice) async {
    String selectedMethod = 'cash';
    final methods = ['cash', 'bank_transfer', 'mobile_money', 'card', 'cheque'];

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              title: const Text('Mark as Paid'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Mark ${invoice.invoiceNumber} as fully paid (${_currencyFormat.format(invoice.remainingBalance > 0 ? invoice.remainingBalance : invoice.total)})?',
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: selectedMethod,
                    decoration: const InputDecoration(
                      labelText: 'Payment Method',
                    ),
                    items: methods
                        .map(
                          (m) => DropdownMenuItem(
                            value: m,
                            child: Text(m.replaceAll('_', ' ').toUpperCase()),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setDialogState(() => selectedMethod = v!),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Mark as Paid'),
                ),
              ],
            );
          },
        );
      },
    );

    if (confirmed == true && mounted) {
      try {
        await ref
            .read(invoiceControllerProvider.notifier)
            .markAsPaid(invoice.id, selectedMethod);
        ref.invalidate(invoiceDetailsProvider);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invoice marked as paid')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  //  Partial Payment Sheet
  // ═══════════════════════════════════════════════════

  Future<void> _showPartialPaymentSheet(Invoice invoice) async {
    final amountCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String method = 'cash';
    final methods = ['cash', 'bank_transfer', 'mobile_money', 'card', 'cheque'];
    final formKey = GlobalKey<FormState>();

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                16,
                16,
                16,
                MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Record Partial Payment',
                      style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Balance: ${_currencyFormat.format(invoice.remainingBalance > 0 ? invoice.remainingBalance : invoice.total)}',
                      style: Theme.of(ctx).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: amountCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Amount',
                        prefixText: 'MK ',
                      ),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Required';
                        final amount = double.tryParse(v);
                        if (amount == null || amount <= 0) return 'Invalid';
                        final max = invoice.remainingBalance > 0
                            ? invoice.remainingBalance
                            : invoice.total;
                        if (amount > max) return 'Exceeds balance';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: method,
                      decoration: const InputDecoration(
                        labelText: 'Payment Method',
                      ),
                      items: methods
                          .map(
                            (m) => DropdownMenuItem(
                              value: m,
                              child: Text(m.replaceAll('_', ' ').toUpperCase()),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setSheetState(() => method = v!),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: notesCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Notes (optional)',
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          if (formKey.currentState!.validate()) {
                            Navigator.pop(ctx, true);
                          }
                        },
                        child: const Text('Record Payment'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (confirmed == true && mounted) {
      try {
        await ref
            .read(invoiceControllerProvider.notifier)
            .addPartialPayment(
              invoiceId: invoice.id,
              amount: double.parse(amountCtrl.text),
              paymentMethod: method,
              notes: notesCtrl.text.isNotEmpty ? notesCtrl.text : null,
            );
        ref.invalidate(invoiceDetailsProvider);
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Payment recorded')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      }
    }
    amountCtrl.dispose();
    notesCtrl.dispose();
  }

  // ═══════════════════════════════════════════════════
  //  Void Dialog
  // ═══════════════════════════════════════════════════

  Future<void> _showVoidDialog(Invoice invoice) async {
    final reasonCtrl = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Void Invoice'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Void ${invoice.invoiceNumber}? This cannot be undone.'),
              const SizedBox(height: 16),
              TextField(
                controller: reasonCtrl,
                decoration: const InputDecoration(
                  labelText: 'Reason',
                  hintText: 'Why are you voiding?',
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
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.brown),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Void'),
            ),
          ],
        );
      },
    );

    if (confirmed == true && mounted) {
      try {
        await ref
            .read(invoiceControllerProvider.notifier)
            .voidInvoice(invoice.id, reasonCtrl.text);
        ref.invalidate(invoiceDetailsProvider);
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Invoice voided')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      }
    }
    reasonCtrl.dispose();
  }

  // ═══════════════════════════════════════════════════
  //  Refund Sheet
  // ═══════════════════════════════════════════════════

  Future<void> _showRefundSheet(Invoice invoice) async {
    final amountCtrl = TextEditingController();
    final reasonCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String method = 'cash';
    final methods = ['cash', 'bank_transfer', 'mobile_money', 'card', 'cheque'];
    final formKey = GlobalKey<FormState>();

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                16,
                16,
                16,
                MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Refund Payment',
                      style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Total paid: ${_currencyFormat.format(invoice.totalPaid)}',
                      style: Theme.of(ctx).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: amountCtrl,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Refund Amount',
                        prefixText: 'MK ',
                      ),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Required';
                        final amount = double.tryParse(v);
                        if (amount == null || amount <= 0) return 'Invalid';
                        if (amount > invoice.totalPaid) {
                          return 'Cannot exceed paid amount';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: reasonCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Reason for Refund',
                      ),
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: method,
                      decoration: const InputDecoration(
                        labelText: 'Refund Method',
                      ),
                      items: methods
                          .map(
                            (m) => DropdownMenuItem(
                              value: m,
                              child: Text(m.replaceAll('_', ' ').toUpperCase()),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setSheetState(() => method = v!),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: notesCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Notes (optional)',
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.orange,
                        ),
                        onPressed: () {
                          if (formKey.currentState!.validate()) {
                            Navigator.pop(ctx, true);
                          }
                        },
                        child: const Text('Process Refund'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (confirmed == true && mounted) {
      try {
        await ref
            .read(invoiceControllerProvider.notifier)
            .refundInvoice(
              invoiceId: invoice.id,
              refundAmount: double.parse(amountCtrl.text),
              refundReason: reasonCtrl.text,
              refundMethod: method,
              notes: notesCtrl.text.isNotEmpty ? notesCtrl.text : null,
            );
        ref.invalidate(invoiceDetailsProvider);
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Refund processed')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      }
    }
    amountCtrl.dispose();
    reasonCtrl.dispose();
    notesCtrl.dispose();
  }

  // ═══════════════════════════════════════════════════
  //  Delete Dialog
  // ═══════════════════════════════════════════════════

  Future<void> _showDeleteDialog(Invoice invoice) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Delete Invoice'),
          content: Text(
            'Delete ${invoice.invoiceNumber}? This action cannot be undone.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete'),
            ),
          ],
        );
      },
    );

    if (confirmed == true && mounted) {
      try {
        await ref
            .read(invoiceControllerProvider.notifier)
            .deleteInvoice(invoice.id);
        if (mounted) context.pop();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      }
    }
  }

  Future<void> _showSendInvoiceDialog(Invoice invoice) async {
    final messageCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send Invoice'),
        content: TextField(
          controller: messageCtrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Message (optional)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Send'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      try {
        await ref.read(invoiceRepositoryProvider).sendInvoice(
              invoice.id,
              message: messageCtrl.text.trim().isEmpty
                  ? null
                  : messageCtrl.text.trim(),
            );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invoice sent successfully')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to send invoice: $e')),
          );
        }
      }
    }
    messageCtrl.dispose();
  }

  Future<void> _downloadInvoicePdf(Invoice invoice) async {
    try {
      final bytes = await ref.read(invoiceRepositoryProvider).downloadInvoicePdf(
            invoice.id,
          );
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/invoice-${invoice.invoiceNumber}.pdf');
      await file.writeAsBytes(bytes);
      await SharePlus.instance.share(
        ShareParams(files: [XFile(file.path)]),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to download invoice: $e')),
        );
      }
    }
  }

  void _showPermissionDenied() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('You do not have permission to perform this action.')),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════

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

// ═══════════════════════════════
//  Helper Widgets
// ═══════════════════════════════

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final ThemeData theme;
  const _DetailRow({
    required this.label,
    required this.value,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withAlpha(150),
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

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
