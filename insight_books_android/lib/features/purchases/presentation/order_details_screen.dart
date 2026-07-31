import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../domain/purchases_models.dart';
import 'providers/orders_provider.dart';

class OrderDetailsScreen extends ConsumerStatefulWidget {
  final String orderId;

  const OrderDetailsScreen({super.key, required this.orderId});

  @override
  ConsumerState<OrderDetailsScreen> createState() => _OrderDetailsScreenState();
}

class _OrderDetailsScreenState extends ConsumerState<OrderDetailsScreen> {
  bool _uploading = false;

  Future<void> _pickAndUploadInvoice() async {
    final page = ref.read(ordersControllerProvider);
    if (!page.canUpdate) return;

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not read selected file')),
      );
      return;
    }

    setState(() => _uploading = true);
    try {
      await ref.read(ordersControllerProvider.notifier).uploadInvoice(
            widget.orderId,
            bytes,
            file.name,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Supplier invoice uploaded')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(NetworkErrorMapper.toUserMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _confirmCancel(PurchaseOrder order) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel purchase order?'),
        content: Text(
          'Cancel ${order.poNumber}? Linked bills/expenses may be reversed where allowed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    try {
      await ref.read(ordersControllerProvider.notifier).cancelOrder(order.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Purchase order cancelled')),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(NetworkErrorMapper.toUserMessage(e))),
      );
    }
  }

  Future<void> _openInvoiceUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(orderDetailProvider(widget.orderId));
    final page = ref.watch(ordersControllerProvider);
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);
    final dateFormat = DateFormat.yMMMd();

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Purchase order'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          const ThemeToggleButton(),
          async.whenOrNull(
                data: (order) {
                  final canEdit =
                      page.canUpdate && !order.isLocked && order.status != 'Cancelled';
                  final canCancel =
                      page.canDelete && !order.isLocked && order.status != 'Cancelled';
                  if (!canEdit && !canCancel) return null;
                  return PopupMenuButton<String>(
                    onSelected: (action) {
                      if (action == 'edit') {
                        context.push('/purchases/orders/${order.id}/edit');
                      } else if (action == 'cancel') {
                        _confirmCancel(order);
                      }
                    },
                    itemBuilder: (_) => [
                      if (canEdit)
                        const PopupMenuItem(value: 'edit', child: Text('Edit')),
                      if (canCancel)
                        const PopupMenuItem(
                          value: 'cancel',
                          child: Text('Cancel order'),
                        ),
                    ],
                  );
                },
              ) ??
              const SizedBox.shrink(),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(NetworkErrorMapper.toUserMessage(e)),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () =>
                      ref.invalidate(orderDetailProvider(widget.orderId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (order) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(orderDetailProvider(widget.orderId));
            await ref.read(orderDetailProvider(widget.orderId).future);
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                order.poNumber.isNotEmpty ? order.poNumber : 'Purchase order',
                style: theme.textTheme.headlineSmall,
              ),
              const SizedBox(height: 4),
              Text(
                [
                  order.supplierName ?? 'No supplier',
                  if (order.poDate != null) dateFormat.format(order.poDate!),
                ].join(' · '),
                style: TextStyle(color: AppTheme.textSecondary(context)),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _InfoChip(label: 'Type', value: order.orderType),
                  _InfoChip(label: 'Status', value: order.status),
                  if (order.expectedDeliveryDate != null)
                    _InfoChip(
                      label: 'Expected',
                      value: dateFormat.format(order.expectedDeliveryDate!),
                    ),
                  _InfoChip(
                    label: 'Tax mode',
                    value: order.pricesIncludeTax ? 'Inclusive' : 'Exclusive',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      _AmountRow(label: 'Subtotal', value: currency.format(order.subtotal)),
                      _AmountRow(label: 'Tax', value: currency.format(order.taxAmount)),
                      const Divider(),
                      _AmountRow(
                        label: 'Total',
                        value: currency.format(order.totalAmount),
                        bold: true,
                      ),
                    ],
                  ),
                ),
              ),
              if (order.notes != null && order.notes!.trim().isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Notes', style: theme.textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(order.notes!),
              ],
              const SizedBox(height: 16),
              Text('Line items', style: theme.textTheme.titleSmall),
              const SizedBox(height: 8),
              if (order.items.isEmpty)
                Text(
                  'No lines',
                  style: TextStyle(color: AppTheme.textSecondary(context)),
                )
              else
                ...order.items.map((item) => _LineTile(item: item, currency: currency)),
              const SizedBox(height: 16),
              Text('Supplier invoice', style: theme.textTheme.titleSmall),
              const SizedBox(height: 8),
              if (order.supplierInvoiceUrl != null &&
                  order.supplierInvoiceUrl!.isNotEmpty) ...[
                OutlinedButton.icon(
                  onPressed: () => _openInvoiceUrl(order.supplierInvoiceUrl!),
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: const Text('View supplier invoice'),
                ),
                if (page.canUpdate) ...[
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: _uploading ? null : _pickAndUploadInvoice,
                    icon: _uploading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.upload_file),
                    label: Text(_uploading ? 'Uploading…' : 'Replace invoice'),
                  ),
                ],
              ] else if (page.canUpdate)
                OutlinedButton.icon(
                  onPressed: _uploading ? null : _pickAndUploadInvoice,
                  icon: _uploading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.attach_file),
                  label: Text(
                    _uploading
                        ? 'Uploading…'
                        : 'Attach supplier invoice (PDF/Image)',
                  ),
                )
              else
                Text(
                  'No invoice attached',
                  style: TextStyle(color: AppTheme.textSecondary(context)),
                ),
              if (order.supplierId.isNotEmpty) ...[
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () =>
                      context.push('/purchases/suppliers/${order.supplierId}'),
                  child: const Text('View supplier ledger →'),
                ),
              ],
              if (order.isLocked) ...[
                const SizedBox(height: 16),
                Card(
                  color: Colors.orange.shade50,
                  child: const ListTile(
                    leading: Icon(Icons.lock_outline),
                    title: Text('Order locked'),
                    subtitle: Text(
                      'Goods have been received on this order. Edit and cancel are disabled.',
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              color: AppTheme.textSecondary(context),
            ),
          ),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.value,
    this.bold = false,
  });

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final style = bold
        ? Theme.of(context).textTheme.titleMedium
        : Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text(value, style: style?.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _LineTile extends StatelessWidget {
  const _LineTile({required this.item, required this.currency});

  final PurchaseOrderItem item;
  final NumberFormat currency;

  @override
  Widget build(BuildContext context) {
    final title = item.productName ??
        item.description ??
        item.lineType;
    final lineTotal = multiplyMoney(item.quantityOrdered, item.unitCost);
    final subtitle = [
      item.lineType,
      'Qty ${item.quantityOrdered}',
      if (item.quantityReceived > 0) 'Rcvd ${item.quantityReceived}',
      currency.format(item.unitCost),
    ].join(' · ');

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Text(subtitle),
        trailing: Text(currency.format(lineTotal + item.taxAmount)),
      ),
    );
  }
}
