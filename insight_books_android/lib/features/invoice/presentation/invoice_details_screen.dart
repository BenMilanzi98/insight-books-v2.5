import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import '../data/invoice_repository.dart';
import '../domain/invoice_model.dart';
import 'providers/invoice_details_provider.dart';
import 'providers/invoice_provider.dart';
import '../../../shared/widgets/main_layout.dart';
import '../../../shared/pdf_share_sheet.dart';
import '../../../shared/server_pdf_preview_screen.dart';

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

  String _statusTitle(String status) {
    final s = status.trim();
    if (s.isEmpty) return '—';
    return s[0].toUpperCase() + s.substring(1);
  }

  @override
  Widget build(BuildContext context) {
    final invoiceAsync = ref.watch(invoiceDetailsProvider(widget.invoiceId));
    final invoiceState = ref.watch(invoiceControllerProvider);
    final theme = Theme.of(context);

    return Scaffold(
      drawer: const AppDrawer(),
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
                onPressed: () => ref.invalidate(
                  invoiceDetailsProvider(widget.invoiceId),
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (invoice) => _buildBody(invoice, theme, invoiceState),
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
      final sendLabel = status == 'paid'
          ? 'Send payment confirmation'
          : 'Send invoice';
      items.add(
        PopupMenuItem(
          value: 'send',
          child: ListTile(
            leading: const Icon(Icons.send_outlined),
            title: Text(sendLabel),
          ),
        ),
      );
    }
    if (permissions.canViewInvoices) {
      items.add(
        const PopupMenuItem(
          value: 'view_pdf',
          child: ListTile(
            leading: Icon(Icons.visibility_outlined),
            title: Text('View official PDF'),
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
            title: Text('Share PDF'),
          ),
        ),
      );
    }

    // Mark as Paid — pending/sent/overdue/partial
    if (['pending', 'sent', 'overdue', 'partial'].contains(status) &&
        permissions.canUpdateInvoices) {
      items.add(
        PopupMenuItem(
          value: 'mark_paid',
          child: ListTile(
            leading: Icon(
              Icons.check_circle,
              color: Theme.of(context).colorScheme.tertiary,
            ),
            title: const Text('Mark as Paid'),
          ),
        ),
      );
    }

    // Record payment — matches web isEligibleForPartialPayment: pending or partial only
    if (['pending', 'partial'].contains(status) &&
        permissions.canUpdateInvoices) {
      items.add(
        PopupMenuItem(
          value: 'partial_payment',
          child: ListTile(
            leading: Icon(
              Icons.pie_chart,
              color: Theme.of(context).colorScheme.secondary,
            ),
            title: const Text('Record Payment'),
          ),
        ),
      );
    }

    // Void — not void/paid
    if (!['void', 'paid'].contains(status) && permissions.canUpdateInvoices) {
      items.add(
        PopupMenuItem(
          value: 'void',
          child: ListTile(
            leading: Icon(
              Icons.block,
              color: Theme.of(context).colorScheme.outline,
            ),
            title: const Text('Void Invoice'),
          ),
        ),
      );
    }

    // Refund — paid/partial (has payments)
    if (['paid', 'partial'].contains(status) &&
        invoice.totalPaid > 0 &&
        permissions.canUpdateInvoices) {
      items.add(
        PopupMenuItem(
          value: 'refund',
          child: ListTile(
            leading: Icon(
              Icons.undo,
              color: Theme.of(context).colorScheme.secondary,
            ),
            title: const Text('Refund'),
          ),
        ),
      );
    }

    // Delete — same as web: Draft or Pending only
    if (permissions.canDeleteInvoices &&
        (status == 'draft' || status == 'pending')) {
      items.add(const PopupMenuDivider());
      items.add(
        PopupMenuItem(
          value: 'delete',
          child: ListTile(
            leading: Icon(
              Icons.delete,
              color: Theme.of(context).colorScheme.error,
            ),
            title: Text(
              'Delete',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
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
    if (action == 'view_pdf' && !permissions.canViewInvoices) {
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
        await ctx.push('/invoice/${invoice.id}/edit');
        if (context.mounted) {
          ref.invalidate(invoiceDetailsProvider(widget.invoiceId));
        }
        break;
      case 'mark_paid':
        await _showMarkAsPaidDialog(invoice);
        break;
      case 'send':
        await _showSendInvoiceDialog(invoice);
        break;
      case 'view_pdf':
        await _viewInvoicePdf(invoice);
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

  Widget _buildBody(Invoice invoice, ThemeData theme, InvoicePageState permissions) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // ── Status Banner ──
          _buildStatusBanner(invoice, theme),
          const SizedBox(height: 16),

          if (permissions.canViewInvoices) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Icon(Icons.picture_as_pdf_outlined, color: theme.colorScheme.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Official invoice PDF',
                        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    TextButton(
                      onPressed: () => _viewInvoicePdf(invoice),
                      child: const Text('View'),
                    ),
                    if (permissions.canExportInvoices)
                      FilledButton.tonalIcon(
                        onPressed: () => _downloadInvoicePdf(invoice),
                        icon: const Icon(Icons.share_outlined, size: 20),
                        label: const Text('Share'),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

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
    final color = _statusColor(invoice.status, theme);
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
                  _statusTitle(invoice.status),
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
            if (invoice.title != null && invoice.title!.trim().isNotEmpty)
              _DetailRow(
                label: 'Invoice title',
                value: invoice.title!,
                theme: theme,
              ),
            if (invoice.orderNumber != null &&
                invoice.orderNumber!.trim().isNotEmpty)
              _DetailRow(
                label: 'Order number',
                value: invoice.orderNumber!,
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
                color: theme.colorScheme.tertiary,
              ),
            if (invoice.remainingBalance > 0)
              _SummaryRow(
                label: 'Balance Due',
                value: _currencyFormat.format(invoice.remainingBalance),
                color: theme.colorScheme.error,
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
                  backgroundColor: theme.colorScheme.primaryContainer,
                  child: Icon(
                    Icons.payment,
                    color: theme.colorScheme.onPrimaryContainer,
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

  Future<List<Map<String, dynamic>>?> _loadPaymentAccountsForInvoice() async {
    try {
      final list = await ref
          .read(invoiceRepositoryProvider)
          .fetchPaymentAccountsLikeManagement();
      if (!mounted) return null;
      if (list.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'No payment accounts configured. Add accounts under Payments management on the web.',
            ),
          ),
        );
        return null;
      }
      return list;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              NetworkErrorMapper.toUserMessage(
                e,
                fallback: 'Could not load payment accounts',
              ),
            ),
          ),
        );
      }
      return null;
    }
  }

  String _paymentAccountDropdownLabel(Map<String, dynamic> acc) {
    final name = (acc['accountName'] ?? acc['name'] ?? 'Account').toString();
    final t = (acc['accountType'] ?? '').toString().trim();
    if (t.isEmpty) return name;
    return '$name ($t)';
  }

  Future<void> _showMarkAsPaidDialog(Invoice invoice) async {
    final accounts = await _loadPaymentAccountsForInvoice();
    if (!mounted || accounts == null || accounts.isEmpty) return;

    var selectedMethod = accounts.first['id']!.toString();

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
                    initialValue: selectedMethod,
                    decoration: const InputDecoration(
                      labelText: 'Payment account',
                    ),
                    items: accounts
                        .map(
                          (acc) => DropdownMenuItem<String>(
                            value: acc['id']!.toString(),
                            child: Text(_paymentAccountDropdownLabel(acc)),
                          ),
                        )
                        .toList(),
                    onChanged: (v) =>
                        setDialogState(() => selectedMethod = v ?? selectedMethod),
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
        ref.invalidate(invoiceDetailsProvider(widget.invoiceId));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invoice marked as paid')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(
            SnackBar(
              content: Text(
                NetworkErrorMapper.toUserMessage(
                  e,
                  fallback: 'Something went wrong',
                ),
              ),
            ),
          );
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  //  Partial Payment Sheet
  // ═══════════════════════════════════════════════════

  Future<void> _showPartialPaymentSheet(Invoice invoice) async {
    final accounts = await _loadPaymentAccountsForInvoice();
    if (accounts == null || accounts.isEmpty) return;

    final amountCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    var method = accounts.first['id']!.toString();
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
                      'Record Payment',
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
                      initialValue: method,
                      decoration: const InputDecoration(
                        labelText: 'Payment account',
                      ),
                      items: accounts
                          .map(
                            (acc) => DropdownMenuItem<String>(
                              value: acc['id']!.toString(),
                              child: Text(_paymentAccountDropdownLabel(acc)),
                            ),
                          )
                          .toList(),
                      onChanged: (v) =>
                          setSheetState(() => method = v ?? method),
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
        ref.invalidate(invoiceDetailsProvider(widget.invoiceId));
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Payment recorded')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(
            SnackBar(
              content: Text(
                NetworkErrorMapper.toUserMessage(
                  e,
                  fallback: 'Something went wrong',
                ),
              ),
            ),
          );
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
              style: ElevatedButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Void'),
            ),
          ],
        );
      },
    );

    if (confirmed == true && mounted) {
      final reason = reasonCtrl.text.trim();
      if (reason.length < 3) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Please provide a reason for voiding (at least 3 characters).',
              ),
            ),
          );
        }
        reasonCtrl.dispose();
        return;
      }
      try {
        await ref
            .read(invoiceControllerProvider.notifier)
            .voidInvoice(invoice.id, reason);
        ref.invalidate(invoiceDetailsProvider(widget.invoiceId));
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Invoice voided')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(
            SnackBar(
              content: Text(
                NetworkErrorMapper.toUserMessage(
                  e,
                  fallback: 'Something went wrong',
                ),
              ),
            ),
          );
        }
      }
    }
    reasonCtrl.dispose();
  }

  // ═══════════════════════════════════════════════════
  //  Refund Sheet
  // ═══════════════════════════════════════════════════

  Future<void> _showRefundSheet(Invoice invoice) async {
    final accounts = await _loadPaymentAccountsForInvoice();
    if (!mounted || accounts == null || accounts.isEmpty) return;

    final amountCtrl = TextEditingController();
    final reasonCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    var method = accounts.first['id']!.toString();
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
                      validator: (v) {
                        final t = v?.trim() ?? '';
                        if (t.isEmpty) return 'Required';
                        if (t.length < 3) {
                          return 'At least 3 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: method,
                      decoration: const InputDecoration(
                        labelText: 'Refund account',
                      ),
                      items: accounts
                          .map(
                            (acc) => DropdownMenuItem<String>(
                              value: acc['id']!.toString(),
                              child: Text(_paymentAccountDropdownLabel(acc)),
                            ),
                          )
                          .toList(),
                      onChanged: (v) =>
                          setSheetState(() => method = v ?? method),
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
                          backgroundColor:
                              Theme.of(ctx).colorScheme.secondaryContainer,
                          foregroundColor: Theme.of(ctx)
                              .colorScheme
                              .onSecondaryContainer,
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
        ref.invalidate(invoiceDetailsProvider(widget.invoiceId));
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Refund processed')));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(
            SnackBar(
              content: Text(
                NetworkErrorMapper.toUserMessage(
                  e,
                  fallback: 'Something went wrong',
                ),
              ),
            ),
          );
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
              style: ElevatedButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
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
          ).showSnackBar(
            SnackBar(
              content: Text(
                NetworkErrorMapper.toUserMessage(
                  e,
                  fallback: 'Something went wrong',
                ),
              ),
            ),
          );
        }
      }
    }
  }

  Future<void> _showSendInvoiceDialog(Invoice invoice) async {
    final messageCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          invoice.status.toLowerCase() == 'paid'
              ? 'Send payment confirmation'
              : 'Send invoice',
        ),
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
        ref.invalidate(invoiceDetailsProvider(widget.invoiceId));
        await ref
            .read(invoiceControllerProvider.notifier)
            .reloadPreservingPagination();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invoice sent successfully')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                NetworkErrorMapper.toUserMessage(
                  e,
                  fallback: 'Failed to send invoice',
                ),
              ),
            ),
          );
        }
      }
    }
    messageCtrl.dispose();
  }

  Future<void> _viewInvoicePdf(Invoice invoice) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const PopScope(
        canPop: false,
        child: AlertDialog(
          content: Row(
            children: [
              CircularProgressIndicator(),
              SizedBox(width: 20),
              Expanded(child: Text('Loading PDF…')),
            ],
          ),
        ),
      ),
    );
    try {
      final bytes = await ref.read(invoiceRepositoryProvider).downloadInvoicePdf(invoice.id);
      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop();
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ServerPdfPreviewScreen(
            title: 'Invoice ${invoice.invoiceNumber}',
            pdfBytes: Uint8List.fromList(bytes),
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        final msg = e.toString();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              msg.contains('HTML')
                  ? 'Server returned an error page instead of PDF. The invoice PDF may not be ready yet.'
                  : msg.contains('JSON')
                      ? 'Server could not generate invoice PDF.'
                      : 'Failed to open invoice PDF: $e',
            ),
          ),
        );
      }
    }
  }

  Future<void> _downloadInvoicePdf(Invoice invoice) async {
    try {
      final bytes = await ref.read(invoiceRepositoryProvider).downloadInvoicePdf(
            invoice.id,
          );
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/invoice-${invoice.invoiceNumber}.pdf');
      await file.writeAsBytes(bytes);
      final xfile = XFile(file.path, mimeType: 'application/pdf');
      if (!mounted) return;
      await showPdfShareSheet(
        context,
        file: xfile,
        title: 'Invoice ${invoice.invoiceNumber}',
        body: 'Invoice ${invoice.invoiceNumber}',
      );
    } catch (e) {
      if (mounted) {
        final msg = e.toString();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              msg.contains('HTML')
                  ? 'Server returned an error page instead of PDF. The invoice PDF may not be ready yet.'
                  : msg.contains('JSON')
                      ? 'Server could not generate invoice PDF.'
                      : 'Failed to download invoice: $e',
            ),
          ),
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

  Color _statusColor(String status, ThemeData theme) {
    switch (status.toLowerCase()) {
      case 'paid':
        return theme.colorScheme.tertiary;
      case 'pending':
      case 'sent':
        return theme.colorScheme.primary;
      case 'overdue':
        return theme.colorScheme.error;
      case 'draft':
        return theme.colorScheme.outline;
      case 'partial':
        return theme.colorScheme.secondary;
      case 'void':
        return theme.colorScheme.outline;
      default:
        return theme.colorScheme.outline;
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
