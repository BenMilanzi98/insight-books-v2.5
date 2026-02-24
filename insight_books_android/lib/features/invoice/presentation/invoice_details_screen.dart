import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import 'providers/invoice_details_provider.dart';
import '../domain/invoice_model.dart';

class InvoiceDetailsScreen extends ConsumerWidget {
  final String invoiceId;

  const InvoiceDetailsScreen({super.key, required this.invoiceId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoiceAsync = ref.watch(invoiceDetailsProvider(invoiceId));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Invoice #${invoiceId.substring(0, 8).toUpperCase()}'),
        actions: [
          invoiceAsync.when(
            data: (invoice) => IconButton(
              icon: const Icon(LucideIcons.refreshCw),
              onPressed: () =>
                  ref.invalidate(invoiceDetailsProvider(invoiceId)),
            ),
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: invoiceAsync.when(
        data: (invoice) => _InvoiceDetailsContent(invoice: invoice),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                LucideIcons.alertTriangle,
                size: 48,
                color: Colors.amber,
              ),
              const SizedBox(height: 16),
              Text('Error: $error'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () =>
                    ref.invalidate(invoiceDetailsProvider(invoiceId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: invoiceAsync.when(
        data: (invoice) => invoice.status != 'Paid'
            ? SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: ElevatedButton(
                    onPressed: () => _showStatusDialog(context, ref, invoice),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3B82F6),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text('Update Status'),
                  ),
                ),
              )
            : null,
        loading: () => null,
        error: (_, _) => null,
      ),
    );
  }

  void _showStatusDialog(BuildContext context, WidgetRef ref, Invoice invoice) {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ListTile(
                title: Text(
                  'Update Status',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              ListTile(
                leading: const Icon(
                  LucideIcons.checkCircle,
                  color: Colors.green,
                ),
                title: const Text('Mark as Paid'),
                onTap: () {
                  ref
                      .read(invoiceDetailsProvider(invoiceId).notifier)
                      .markAsPaid();
                  context.pop();
                },
              ),
              ListTile(
                leading: const Icon(LucideIcons.send, color: Colors.blue),
                title: const Text('Mark as Sent'),
                onTap: () {
                  ref
                      .read(invoiceDetailsProvider(invoiceId).notifier)
                      .updateStatus('Sent');
                  context.pop();
                },
              ),
              ListTile(
                leading: const Icon(LucideIcons.fileEdit, color: Colors.grey),
                title: const Text('Mark as Draft'),
                onTap: () {
                  ref
                      .read(invoiceDetailsProvider(invoiceId).notifier)
                      .updateStatus('Draft');
                  context.pop();
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _InvoiceDetailsContent extends StatelessWidget {
  final Invoice invoice;

  const _InvoiceDetailsContent({required this.invoice});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildStatusHeader(),
          const SizedBox(height: 16),
          _buildInfoCard(),
          const SizedBox(height: 16),
          _buildClientCard(),
          const SizedBox(height: 16),
          _buildItemsCard(),
          const SizedBox(height: 16),
          _buildSummaryCard(),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildStatusHeader() {
    final statusColor = _getStatusColor(invoice.status);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              _getStatusIcon(invoice.status),
              color: statusColor,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invoice.status,
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
                Text(
                  'Invoice ${invoice.invoiceNumber}',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    return _CardWrapper(
      child: Column(
        children: [
          _InfoRow(
            label: 'Issue Date',
            value: DateFormat('MMM dd, yyyy').format(invoice.createdAt),
            icon: LucideIcons.calendar,
          ),
          const Divider(),
          _InfoRow(
            label: 'Due Date',
            value: DateFormat('MMM dd, yyyy').format(invoice.dueDate),
            icon: LucideIcons.calendarClock,
            valueColor:
                invoice.status != 'Paid' &&
                    invoice.dueDate.isBefore(DateTime.now())
                ? Colors.red
                : null,
          ),
          const Divider(),
          _InfoRow(
            label: 'Currency',
            value: invoice.currency,
            icon: LucideIcons.banknote,
          ),
        ],
      ),
    );
  }

  Widget _buildClientCard() {
    return _CardWrapper(
      title: 'Customer Details',
      icon: LucideIcons.user,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            invoice.client.name,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          if (invoice.client.email != null) ...[
            const SizedBox(height: 4),
            Text(
              invoice.client.email!,
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
          if (invoice.client.phone != null) ...[
            const SizedBox(height: 4),
            Text(
              invoice.client.phone!,
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildItemsCard() {
    return _CardWrapper(
      title: 'Line Items',
      icon: LucideIcons.list,
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var item in invoice.items)
            ListTile(
              title: Text(item.product.name),
              subtitle: Text(
                '${item.quantity.toStringAsFixed(0)} x ${NumberFormat.currency(symbol: invoice.currency == 'MWK' ? 'MK' : '\$').format(item.unitPrice)}',
              ),
              trailing: Text(
                NumberFormat.currency(
                  symbol: invoice.currency == 'MWK' ? 'MK' : '\$',
                ).format(item.total),
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          if (invoice.items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16.0),
              child: Text('No items in this invoice'),
            ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard() {
    return _CardWrapper(
      child: Column(
        children: [
          _SummaryRow(
            label: 'Subtotal',
            value: invoice.subtotal,
            currency: invoice.currency,
          ),
          if (invoice.totalTax > 0)
            _SummaryRow(
              label: 'Tax',
              value: invoice.totalTax,
              currency: invoice.currency,
            ),
          if (invoice.totalDiscount > 0)
            _SummaryRow(
              label: 'Discount',
              value: -invoice.totalDiscount,
              currency: invoice.currency,
              valueColor: Colors.green,
            ),
          const Divider(),
          _SummaryRow(
            label: 'Total',
            value: invoice.total,
            currency: invoice.currency,
            isBold: true,
            fontSize: 20,
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
        return Colors.green;
      case 'overdue':
        return Colors.red;
      case 'sent':
      case 'pending':
        return Colors.blue;
      default:
        return Colors.orange;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
        return LucideIcons.checkCircle;
      case 'overdue':
        return LucideIcons.alertCircle;
      default:
        return LucideIcons.fileText;
    }
  }
}

class _CardWrapper extends StatelessWidget {
  final String? title;
  final IconData? icon;
  final Widget child;
  final EdgeInsets? padding;

  const _CardWrapper({
    this.title,
    this.icon,
    required this.child,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18, color: Colors.blue),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    title!.toUpperCase(),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey[600],
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            ),
          if (title != null) const Divider(height: 1),
          Padding(padding: padding ?? const EdgeInsets.all(16), child: child),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? valueColor;

  const _InfoRow({
    required this.label,
    required this.value,
    required this.icon,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Colors.grey[400]),
          const SizedBox(width: 12),
          Text(label, style: TextStyle(color: Colors.grey[600])),
          const Spacer(),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.bold, color: valueColor),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final double value;
  final String currency;
  final bool isBold;
  final double fontSize;
  final Color? valueColor;

  const _SummaryRow({
    required this.label,
    required this.value,
    required this.currency,
    this.isBold = false,
    this.fontSize = 14,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    final currencySymbol = currency == 'MWK' ? 'MK' : '\$';
    final formatter = NumberFormat.currency(symbol: currencySymbol);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: isBold ? Colors.black : Colors.grey[600],
            ),
          ),
          Text(
            formatter.format(value),
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: valueColor ?? (isBold ? Colors.black : Colors.black),
            ),
          ),
        ],
      ),
    );
  }
}
