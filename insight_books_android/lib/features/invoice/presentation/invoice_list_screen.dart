import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'providers/invoice_provider.dart';
import '../domain/invoice_model.dart';

class InvoiceListScreen extends ConsumerWidget {
  const InvoiceListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(invoiceControllerProvider);
    final notifier = ref.read(invoiceControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoices'),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw),
            onPressed: () => notifier.setStatusFilter(state.statusFilter),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search invoices...',
                prefixIcon: const Icon(LucideIcons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              onChanged: notifier.setSearchQuery,
            ),
          ),

          // Status Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _StatusChip(
                  label: 'All',
                  isSelected: state.statusFilter == 'all',
                  onSelected: (_) => notifier.setStatusFilter('all'),
                ),
                const SizedBox(width: 8),
                _StatusChip(
                  label: 'Draft',
                  isSelected: state.statusFilter == 'Draft',
                  onSelected: (_) => notifier.setStatusFilter('Draft'),
                ),
                const SizedBox(width: 8),
                _StatusChip(
                  label: 'Sent',
                  isSelected: state.statusFilter == 'Sent',
                  onSelected: (_) => notifier.setStatusFilter('Sent'),
                ),
                const SizedBox(width: 8),
                _StatusChip(
                  label: 'Paid',
                  isSelected: state.statusFilter == 'Paid',
                  onSelected: (_) => notifier.setStatusFilter('Paid'),
                ),
                const SizedBox(width: 8),
                _StatusChip(
                  label: 'Overdue',
                  isSelected: state.statusFilter == 'Overdue',
                  onSelected: (_) => notifier.setStatusFilter('Overdue'),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Error Message
          if (state.error != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red[200]!),
              ),
              child: Row(
                children: [
                  const Icon(
                    LucideIcons.alertCircle,
                    color: Colors.red,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      state.error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.x, size: 16),
                    onPressed: () => notifier.fetchInvoices(), // Retry
                  ),
                ],
              ),
            ),

          // Invoice List
          Expanded(
            child: state.isLoading
                ? const Center(child: CircularProgressIndicator())
                : state.invoices.isEmpty && state.error == null
                ? _EmptyState(onRefresh: () => notifier.setStatusFilter('all'))
                : RefreshIndicator(
                    onRefresh: () async =>
                        notifier.setStatusFilter(state.statusFilter),
                    child: ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: state.invoices.length,
                      itemBuilder: (context, index) {
                        final invoice = state.invoices[index];
                        return _InvoiceCard(invoice: invoice);
                      },
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/invoice/create'),
        label: const Text('New Invoice'),
        icon: const Icon(LucideIcons.plus),
        backgroundColor: const Color(0xFF3B82F6),
        foregroundColor: Colors.white,
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final Function(bool) onSelected;

  const _StatusChip({
    required this.label,
    required this.isSelected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: onSelected,
      selectedColor: const Color(0xFF3B82F6).withValues(alpha: 0.2),
      checkmarkColor: const Color(0xFF3B82F6),
      labelStyle: TextStyle(
        color: isSelected ? const Color(0xFF3B82F6) : Colors.grey,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  final Invoice invoice;

  const _InvoiceCard({required this.invoice});

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '\$ ');
    final dateFormat = DateFormat('MMM dd, yyyy');

    Color statusColor;
    switch (invoice.status.toLowerCase()) {
      case 'paid':
        statusColor = Colors.green;
        break;
      case 'overdue':
        statusColor = Colors.red;
        break;
      case 'sent':
        statusColor = Colors.blue;
        break;
      default:
        statusColor = Colors.grey;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              invoice.invoiceNumber,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                invoice.status.toUpperCase(),
                style: TextStyle(
                  color: statusColor,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            Text(
              invoice.client.name,
              style: const TextStyle(fontSize: 16, color: Colors.black87),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(LucideIcons.calendar, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  'Due ${dateFormat.format(invoice.dueDate)}',
                  style: const TextStyle(color: Colors.grey, fontSize: 13),
                ),
              ],
            ),
          ],
        ),
        trailing: Text(
          currencyFormat.format(invoice.total),
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 16,
            color: Color(0xFF1E293B),
          ),
        ),
        onTap: () => context.push('/invoice/${invoice.id}'),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onRefresh;

  const _EmptyState({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.receipt, size: 64, color: Colors.grey[300]),
          const SizedBox(height: 16),
          const Text(
            'No invoices found',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Create your first invoice to get started',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: onRefresh,
            child: const Text('Show All Invoices'),
          ),
        ],
      ),
    );
  }
}
