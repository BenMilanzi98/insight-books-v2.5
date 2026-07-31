import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import 'package:insightbooks_android/shared/widgets/stat_card.dart';

import '../data/purchases_repository.dart';
import '../domain/purchases_models.dart';
import 'providers/receipts_provider.dart';

class ReceiptsListScreen extends ConsumerStatefulWidget {
  const ReceiptsListScreen({super.key});

  @override
  ConsumerState<ReceiptsListScreen> createState() => _ReceiptsListScreenState();
}

class _ReceiptsListScreenState extends ConsumerState<ReceiptsListScreen> {
  List<PurchaseSupplier> _suppliers = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      ref.read(receiptsControllerProvider.notifier).load();
      _loadSuppliers();
    });
  }

  Future<void> _loadSuppliers() async {
    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final response = await repo.fetchSuppliers(page: 1, limit: 200);
      if (mounted) setState(() => _suppliers = response.items);
    } catch (_) {
      // Filter dropdown falls back to empty.
    }
  }

  void _showReceiptDetails(GoodsReceipt receipt) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _ReceiptDetailSheet(receipt: receipt),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(receiptsControllerProvider);
    final notifier = ref.read(receiptsControllerProvider.notifier);
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 0);
    final dateFormat = DateFormat.yMMMd();
    final isService = state.receiptMode == ReceiptMode.service;

    if (!state.canView) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Receipts')),
        body: const Center(
          child: Text('You do not have permission to view receipts.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(isService ? 'Service Receipts' : 'Goods Receipts'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: const [ThemeToggleButton()],
      ),
      floatingActionButton: state.canCreate
          ? FloatingActionButton.extended(
              onPressed: () => context.push(
                '/purchases/receipts/create?mode=${state.receiptMode.apiValue}',
              ),
              icon: const Icon(Icons.add),
              label: Text(isService ? 'Receive service' : 'Receive goods'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: notifier.refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: SegmentedButton<ReceiptMode>(
                  segments: const [
                    ButtonSegment(
                      value: ReceiptMode.inventory,
                      label: Text('Inventory'),
                      icon: Icon(Icons.inventory_2_outlined, size: 18),
                    ),
                    ButtonSegment(
                      value: ReceiptMode.service,
                      label: Text('Service'),
                      icon: Icon(Icons.handyman_outlined, size: 18),
                    ),
                  ],
                  selected: {state.receiptMode},
                  onSelectionChanged: (selected) {
                    notifier.setReceiptMode(selected.first);
                  },
                ),
              ),
            ),
            if (state.stats != null)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 96,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    children: [
                      SizedBox(
                        width: 130,
                        child: StatCard(
                          label: 'Receipts',
                          value: '${state.stats!.total}',
                          count: state.stats!.total,
                          color: theme.colorScheme.primary,
                          subtitle: 'All statuses',
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 140,
                        child: StatCard(
                          label: isService ? 'Draft' : 'Stock pending',
                          value: isService
                              ? '${state.stats!.draft}'
                              : '${state.stats!.pendingStock}',
                          count: isService
                              ? state.stats!.draft
                              : state.stats!.pendingStock,
                          color: isService ? Colors.grey : Colors.orange,
                          subtitle: isService
                              ? null
                              : 'Posted, not in stock yet',
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 120,
                        child: StatCard(
                          label: 'Posted',
                          value: '${state.stats!.posted}',
                          count: state.stats!.posted,
                          color: Colors.green,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 170,
                        child: StatCard(
                          label: 'Posted inventory',
                          value: currency.format(
                            state.stats!.postedInventoryValue,
                          ),
                          count: 0,
                          color: const Color(0xFFEF4444),
                          subtitle: 'Added to stock',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: state.supplierFilter.isEmpty
                            ? ''
                            : state.supplierFilter,
                        decoration: const InputDecoration(
                          labelText: 'Supplier',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: [
                          const DropdownMenuItem(
                            value: '',
                            child: Text('All suppliers'),
                          ),
                          for (final s in _suppliers)
                            DropdownMenuItem(
                              value: s.id,
                              child: Text(
                                s.supplierName,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: (v) =>
                            notifier.setSupplierFilter(v ?? ''),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: state.statusFilter,
                        decoration: const InputDecoration(
                          labelText: 'Status',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: [
                          DropdownMenuItem(
                            value: 'all',
                            child: const Text('All statuses'),
                          ),
                          ...receiptStatuses.map(
                            (s) => DropdownMenuItem(value: s, child: Text(s)),
                          ),
                        ],
                        onChanged: (v) =>
                            notifier.setStatusFilter(v ?? 'all'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (state.isLoading && state.receipts.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null && state.receipts.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(state.error!),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: notifier.refresh,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              )
            else if (state.receipts.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Text(
                    isService
                        ? 'No service receipts found.'
                        : 'No goods receipts found.',
                    style: TextStyle(color: AppTheme.textSecondary(context)),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.all(12),
                sliver: SliverList.separated(
                  itemCount: state.receipts.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final receipt = state.receipts[index];
                    return _ReceiptTile(
                      receipt: receipt,
                      currency: currency,
                      dateFormat: dateFormat,
                      onTap: () => _showReceiptDetails(receipt),
                    );
                  },
                ),
              ),
            if (state.totalPages > 1)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        onPressed: state.currentPage > 1
                            ? () => notifier.setPage(state.currentPage - 1)
                            : null,
                        icon: const Icon(Icons.chevron_left),
                      ),
                      Text('Page ${state.currentPage} / ${state.totalPages}'),
                      IconButton(
                        onPressed: state.currentPage < state.totalPages
                            ? () => notifier.setPage(state.currentPage + 1)
                            : null,
                        icon: const Icon(Icons.chevron_right),
                      ),
                    ],
                  ),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
    );
  }
}

class _ReceiptTile extends StatelessWidget {
  const _ReceiptTile({
    required this.receipt,
    required this.currency,
    required this.dateFormat,
    required this.onTap,
  });

  final GoodsReceipt receipt;
  final NumberFormat currency;
  final DateFormat dateFormat;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitle = [
      receipt.supplierName ?? 'No supplier',
      if (receipt.poNumber != null && receipt.poNumber!.isNotEmpty)
        'PO ${receipt.poNumber}',
      if (receipt.receiptDate != null)
        dateFormat.format(receipt.receiptDate!),
    ].join(' · ');

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Icon(
            Icons.receipt_outlined,
            color: theme.colorScheme.onPrimaryContainer,
            size: 20,
          ),
        ),
        title: Text(
          receipt.receiptNumber.isNotEmpty
              ? receipt.receiptNumber
              : 'Receipt',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              subtitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppTheme.textSecondary(context),
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 4),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                _StatusChip(status: receipt.status),
                if (receipt.deferredStockPosting)
                  const _BadgeChip(
                    label: 'Stock on receipt date',
                    color: Colors.lightBlue,
                  ),
                if (receipt.stockPostingPending &&
                    !receipt.deferredStockPosting)
                  const _BadgeChip(
                    label: 'Stock pending',
                    color: Colors.orange,
                  ),
              ],
            ),
          ],
        ),
        isThreeLine: true,
        trailing: Text(
          currency.format(receipt.totalAmount),
          style: theme.textTheme.titleSmall,
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = status == 'Posted' ? Colors.green : Colors.grey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status,
        style: TextStyle(
          fontSize: 11,
          color: color == Colors.green
              ? Colors.green.shade700
              : Colors.grey.shade700,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _BadgeChip extends StatelessWidget {
  const _BadgeChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          color: color == Colors.lightBlue
              ? Colors.lightBlue.shade800
              : Colors.orange.shade800,
        ),
      ),
    );
  }
}

class _ReceiptDetailSheet extends StatelessWidget {
  const _ReceiptDetailSheet({required this.receipt});

  final GoodsReceipt receipt;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 0);
    final dateFormat = DateFormat.yMMMd();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Material(
          child: Column(
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 8, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            receipt.receiptNumber.isNotEmpty
                                ? receipt.receiptNumber
                                : 'Receipt',
                            style: theme.textTheme.titleLarge,
                          ),
                          Text(
                            [
                              receipt.supplierName ?? '—',
                              if (receipt.receiptDate != null)
                                dateFormat.format(receipt.receiptDate!),
                            ].join(' · '),
                            style: TextStyle(
                              color: AppTheme.textSecondary(context),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(16),
                  children: [
                    _DetailRow(
                      label: 'Status',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _StatusChip(status: receipt.status),
                          if (receipt.deferredStockPosting)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                'Stock scheduled for receipt date.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.blue.shade800,
                                ),
                              ),
                            ),
                          if (receipt.stockPostingPending &&
                              !receipt.deferredStockPosting)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                'Stock posting pending.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.orange.shade800,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    _DetailRow(
                      label: 'Total amount',
                      value: currency.format(receipt.totalAmount),
                    ),
                    _DetailRow(
                      label: 'PO link',
                      value: receipt.poNumber ?? 'Not linked',
                    ),
                    _DetailRow(
                      label: 'Type',
                      value: receipt.receiptType ?? 'inventory',
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Items',
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    if (receipt.items.isEmpty)
                      Text(
                        'Service receipt (no inventory items).',
                        style: TextStyle(
                          color: AppTheme.textSecondary(context),
                        ),
                      )
                    else
                      ...receipt.items.map(
                        (item) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            title: Text(
                              item.productName ?? item.productId ?? '—',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              'Qty ${item.quantityReceived.toStringAsFixed(0)} · '
                              'Unit ${currency.format(item.unitCost)}',
                            ),
                            trailing: Text(
                              currency.format(
                                item.quantityReceived * item.unitCost,
                              ),
                              style: theme.textTheme.titleSmall,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    this.value,
    this.child,
  });

  final String label;
  final String? value;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: AppTheme.textSecondary(context),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: child ??
                Text(value ?? '—', style: const TextStyle(fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
