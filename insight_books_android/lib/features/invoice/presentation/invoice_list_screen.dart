import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import '../domain/invoice_model.dart';
import 'providers/invoice_provider.dart';

class InvoiceListScreen extends ConsumerStatefulWidget {
  const InvoiceListScreen({super.key});

  @override
  ConsumerState<InvoiceListScreen> createState() => _InvoiceListScreenState();
}

class _InvoiceListScreenState extends ConsumerState<InvoiceListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(invoiceControllerProvider.notifier).loadAll();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(invoiceControllerProvider);
    final notifier = ref.read(invoiceControllerProvider.notifier);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Invoicing'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        backgroundColor: Theme.of(context).colorScheme.surface,
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        elevation: 0,
        actions: const [ThemeToggleButton()],
      ),
      body: RefreshIndicator(
        onRefresh: () => notifier.loadAll(),
        child: CustomScrollView(
          slivers: [
            // ── Statistics Cards ──
            if (state.statistics != null)
              SliverToBoxAdapter(
                child: _StatisticsRow(statistics: state.statistics!),
              ),

            // ── Search Bar ──
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Search invoices…',
                    prefixIcon: const Icon(Icons.search),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    filled: true,
                    fillColor: theme.colorScheme.surfaceContainerLow,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  onChanged: notifier.setSearchQuery,
                ),
              ),
            ),

            // ── Status Filter Chips ──
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _StatusChip(
                        label: 'All',
                        value: 'all',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Pending',
                        value: 'Pending',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Paid',
                        value: 'Paid',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Overdue',
                        value: 'Overdue',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Partial',
                        value: 'Partial',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Draft',
                        value: 'Draft',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── List ──
            if (state.isLoading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null)
              SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
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
                          'Failed to load invoices',
                          style: theme.textTheme.titleMedium,
                          textAlign: TextAlign.center,
                        ),
                        if (state.error != null && state.error!.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            state.error!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.outline,
                            ),
                            textAlign: TextAlign.center,
                            maxLines: 4,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        const SizedBox(height: 16),
                        FilledButton.tonalIcon(
                          onPressed: () => notifier.loadAll(),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else if (state.invoices.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.receipt_long_outlined,
                        size: 64,
                        color: theme.colorScheme.outline,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'No invoices found',
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Create your first invoice',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.outline,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 4,
                ),
                sliver: SliverList.separated(
                  itemCount: state.invoices.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final invoice = state.invoices[index];
                    return _InvoiceCard(
                      invoice: invoice,
                      onTap: () => context.push('/invoice/${invoice.id}'),
                      onDelete:
                          (invoice.status == 'Draft' ||
                              invoice.status == 'Pending')
                          ? () => _confirmDelete(context, ref, invoice)
                          : null,
                    );
                  },
                ),
              ),

            // Bottom padding
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/invoice/create'),
        icon: const Icon(Icons.add),
        label: const Text('New Invoice'),
      ),
    );
  }

  Future<void> _confirmDelete(
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
        await ref
            .read(invoiceControllerProvider.notifier)
            .deleteInvoice(invoice.id);
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Invoice deleted')));
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Failed to delete: $e')));
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════
//  Statistics Row
// ═══════════════════════════════════════════════════

class _StatisticsRow extends StatelessWidget {
  final InvoiceStatistics statistics;

  const _StatisticsRow({required this.statistics});

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.compactCurrency(
      symbol: 'MK',
      decimalDigits: 0,
    );
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          _StatCard(
            label: 'Paid',
            count: statistics.paid.count,
            amount: formatter.format(statistics.paid.amount),
            color: Colors.green,
            icon: Icons.check_circle_outline,
          ),
          const SizedBox(width: 10),
          _StatCard(
            label: 'Pending',
            count: statistics.pending.count,
            amount: formatter.format(statistics.pending.amount),
            color: Colors.orange,
            icon: Icons.schedule,
          ),
          const SizedBox(width: 10),
          _StatCard(
            label: 'Overdue',
            count: statistics.overdue.count,
            amount: formatter.format(statistics.overdue.amount),
            color: Colors.red,
            icon: Icons.warning_amber_outlined,
          ),
          const SizedBox(width: 10),
          _StatCard(
            label: 'Partial',
            count: statistics.partial.count,
            amount: formatter.format(statistics.partial.amount),
            color: Colors.blue,
            icon: Icons.pie_chart_outline,
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int count;
  final String amount;
  final Color color;
  final IconData icon;

  const _StatCard({
    required this.label,
    required this.count,
    required this.amount,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: color.withValues(alpha: 0.3)),
      ),
      color: color.withValues(alpha: 0.06),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              amount,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            Text(
              '$count invoice${count == 1 ? '' : 's'}',
              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════
//  Status Filter Chip
// ═══════════════════════════════════════════════════

class _StatusChip extends StatelessWidget {
  final String label;
  final String value;
  final String current;
  final ValueChanged<String> onTap;

  const _StatusChip({
    required this.label,
    required this.value,
    required this.current,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final selected = current == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(value),
        showCheckmark: false,
      ),
    );
  }
}

// ═══════════════════════════════════════════════════
//  Invoice Card
// ═══════════════════════════════════════════════════

class _InvoiceCard extends StatelessWidget {
  final Invoice invoice;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  const _InvoiceCard({
    required this.invoice,
    required this.onTap,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateFormat = DateFormat('d MMM y');
    final currencyFormat = NumberFormat.currency(
      symbol: 'MK ',
      decimalDigits: 2,
    );

    final statusColor = _statusColor(invoice.status);

    Widget card = Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.4),
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Row 1: Invoice number + Status chip
              Row(
                children: [
                  Expanded(
                    child: Text(
                      invoice.invoiceNumber,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      invoice.status,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Row 2: Client + date
              Row(
                children: [
                  Icon(
                    Icons.person_outline,
                    size: 14,
                    color: theme.colorScheme.outline,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      invoice.client.name,
                      style: theme.textTheme.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Icon(
                    Icons.calendar_today_outlined,
                    size: 12,
                    color: theme.colorScheme.outline,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Due ${dateFormat.format(invoice.dueDate)}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Row 3: Total + paid info
              Row(
                children: [
                  Expanded(
                    child: Text(
                      currencyFormat.format(invoice.total),
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  if (invoice.totalPaid > 0 && invoice.status != 'Paid')
                    Text(
                      'Paid: ${currencyFormat.format(invoice.totalPaid)}',
                      style: TextStyle(fontSize: 12, color: Colors.green[700]),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    // Wrap with Dismissible for delete
    if (onDelete != null) {
      card = Dismissible(
        key: ValueKey(invoice.id),
        direction: DismissDirection.endToStart,
        confirmDismiss: (_) async {
          onDelete!();
          return false; // handled by the callback
        },
        background: Container(
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 24),
          decoration: BoxDecoration(
            color: theme.colorScheme.error.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(Icons.delete_outline, color: theme.colorScheme.error),
        ),
        child: card,
      );
    }

    return card;
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
      case 'refunded':
      case 'partially_refunded':
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }
}
