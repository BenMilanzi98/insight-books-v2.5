import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import 'package:insightbooks_android/shared/widgets/stat_card.dart';

import '../domain/purchases_models.dart';
import 'providers/orders_provider.dart';

class OrdersListScreen extends ConsumerStatefulWidget {
  const OrdersListScreen({super.key});

  @override
  ConsumerState<OrdersListScreen> createState() => _OrdersListScreenState();
}

class _OrdersListScreenState extends ConsumerState<OrdersListScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(ordersControllerProvider.notifier).load();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(ordersControllerProvider);
    final notifier = ref.read(ordersControllerProvider.notifier);
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 0);
    final dateFormat = DateFormat.yMMMd();

    if (!state.canView) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Purchase Orders')),
        body: const Center(
          child: Text('You do not have permission to view purchase orders.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Purchase Orders'),
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
              onPressed: () => context.push('/purchases/orders/create'),
              icon: const Icon(Icons.add),
              label: const Text('New order'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: notifier.refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            if (state.stats != null)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 96,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    children: [
                      SizedBox(
                        width: 140,
                        child: StatCard(
                          label: 'Total',
                          value: '${state.stats!.totalCount}',
                          count: state.stats!.totalCount,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 150,
                        child: StatCard(
                          label: 'Awaiting approval',
                          value: '${state.stats!.awaitingApproval}',
                          count: state.stats!.awaitingApproval,
                          color: Colors.orange,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 150,
                        child: StatCard(
                          label: 'Awaiting receipt',
                          value: '${state.stats!.awaitingReceipt}',
                          count: state.stats!.awaitingReceipt,
                          color: Colors.blue,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 160,
                        child: StatCard(
                          label: 'Open amount',
                          value: currency.format(state.stats!.openAmount),
                          count: 0,
                          color: const Color(0xFFEF4444),
                          subtitle: 'Excl. cancelled',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search PO number or supplier…',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _searchCtrl.text.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchCtrl.clear();
                              notifier.setSearch('');
                              setState(() {});
                            },
                          ),
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  onSubmitted: notifier.setSearch,
                  onChanged: (v) {
                    if (v.isEmpty) notifier.setSearch('');
                    setState(() {});
                  },
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: Row(
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: const Text('All'),
                        selected: state.statusFilter == 'all',
                        onSelected: (_) => notifier.setStatusFilter('all'),
                      ),
                    ),
                    for (final status in purchaseOrderStatuses)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(status),
                          selected: state.statusFilter == status,
                          onSelected: (_) => notifier.setStatusFilter(status),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (state.isLoading && state.orders.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null && state.orders.isEmpty)
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
            else if (state.orders.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Text(
                    'No purchase orders found',
                    style: TextStyle(color: AppTheme.textSecondary(context)),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.all(12),
                sliver: SliverList.separated(
                  itemCount: state.orders.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final order = state.orders[index];
                    return _OrderTile(
                      order: order,
                      currency: currency,
                      dateFormat: dateFormat,
                      onTap: () =>
                          context.push('/purchases/orders/${order.id}'),
                      onEdit: order.isLocked || !state.canUpdate
                          ? null
                          : () => context.push(
                                '/purchases/orders/${order.id}/edit',
                              ),
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

class _OrderTile extends StatelessWidget {
  const _OrderTile({
    required this.order,
    required this.currency,
    required this.dateFormat,
    required this.onTap,
    this.onEdit,
  });

  final PurchaseOrder order;
  final NumberFormat currency;
  final DateFormat dateFormat;
  final VoidCallback onTap;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitle = [
      order.supplierName ?? 'No supplier',
      if (order.poDate != null) dateFormat.format(order.poDate!),
      order.orderType,
    ].join(' · ');

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Icon(
            Icons.receipt_long_outlined,
            color: theme.colorScheme.onPrimaryContainer,
            size: 20,
          ),
        ),
        title: Text(
          order.poNumber.isNotEmpty ? order.poNumber : 'Draft PO',
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
            _StatusChip(status: order.status),
          ],
        ),
        isThreeLine: true,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              currency.format(order.totalAmount),
              style: theme.textTheme.titleSmall,
            ),
            if (onEdit != null)
              TextButton(
                onPressed: onEdit,
                child: const Text('Edit'),
              )
            else if (order.isLocked)
              Text(
                'Locked',
                style: TextStyle(
                  fontSize: 11,
                  color: AppTheme.textSecondary(context),
                ),
              ),
          ],
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
      case 'Approved':
        return Colors.blue;
      case 'Sent':
        return Colors.indigo;
      case 'Partially Received':
        return Colors.orange;
      case 'Received':
        return Colors.green;
      case 'Cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _colorFor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status,
        style: TextStyle(fontSize: 11, color: color.shade700, fontWeight: FontWeight.w600),
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
