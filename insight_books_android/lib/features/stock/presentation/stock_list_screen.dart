import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/shared/widgets/stat_card.dart';

import '../domain/stock_models.dart';
import 'providers/stock_provider.dart';

/// Products or services list body used inside [StockHubScreen].
class StockListScreen extends ConsumerStatefulWidget {
  final String catalog; // products | services

  const StockListScreen({super.key, required this.catalog});

  @override
  ConsumerState<StockListScreen> createState() => _StockListScreenState();
}

class _StockListScreenState extends ConsumerState<StockListScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(stockControllerProvider);
    final notifier = ref.read(stockControllerProvider.notifier);
    final theme = Theme.of(context);
    final isServices = widget.catalog == 'services';

    if (!state.canView) {
      return const Center(
        child: Text('You do not have permission to view stock.'),
      );
    }

    final stats = state.statistics;

    return Column(
      children: [
        if (stats != null)
          SizedBox(
            height: 96,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              children: [
                SizedBox(
                  width: 140,
                  child: StatCard(
                    label: isServices ? 'Services' : 'Products',
                    value: '${isServices ? stats.serviceCount : stats.totalItems}',
                    count: isServices ? stats.serviceCount : stats.totalItems,
                    color: theme.colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 140,
                  child: StatCard(
                    label: 'Stock value',
                    value: stats.totalValue.toStringAsFixed(0),
                    count: 0,
                    color: Colors.teal,
                  ),
                ),
                if (!isServices) ...[
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 140,
                    child: StatCard(
                      label: 'Low stock',
                      value: '${stats.lowStock}',
                      count: stats.lowStock,
                      color: Colors.orange,
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 140,
                    child: StatCard(
                      label: 'Out of stock',
                      value: '${stats.outOfStock}',
                      count: stats.outOfStock,
                      color: theme.colorScheme.error,
                    ),
                  ),
                ],
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: isServices ? 'Search services' : 'Search products',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searchCtrl.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _searchCtrl.clear();
                        notifier.setSearch('');
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
        if (!isServices)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Row(
              children: [
                for (final status in const [
                  'all',
                  'In Stock',
                  'Low Stock',
                  'Out of Stock',
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(status == 'all' ? 'All' : status),
                      selected: state.statusFilter == status,
                      onSelected: (_) => notifier.setStatusFilter(status),
                    ),
                  ),
              ],
            ),
          ),
        if (state.showDeleted)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: theme.colorScheme.secondaryContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Expanded(child: Text('Viewing deleted items')),
                  TextButton(
                    onPressed: () => notifier.setShowDeleted(false),
                    child: const Text('Back to active'),
                  ),
                ],
              ),
            ),
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: notifier.refresh,
            child: state.isLoading && state.products.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 120),
                      Center(child: CircularProgressIndicator()),
                    ],
                  )
                : state.error != null && state.products.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 80),
                          Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
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
                        ],
                      )
                    : state.products.isEmpty
                        ? ListView(
                            children: [
                              SizedBox(height: 80),
                              Center(
                                child: Text(
                                  isServices
                                      ? 'No services found'
                                      : 'No products found',
                                  style: TextStyle(
                                    color: AppTheme.textSecondary(context),
                                  ),
                                ),
                              ),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(12),
                            itemCount: state.products.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final p = state.products[index];
                              return _ProductTile(
                                product: p,
                                canUpdate: state.canUpdate,
                                canDelete: state.canDelete,
                                showDeleted: state.showDeleted,
                                onOpen: () =>
                                    context.push('/stock/products/${p.id}'),
                                onEdit: () => context.push(
                                  isServices
                                      ? '/stock/services/${p.id}/edit'
                                      : '/stock/products/${p.id}/edit',
                                ),
                                onDelete: () async {
                                  try {
                                    await notifier.deleteProduct(p.id);
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(
                                        const SnackBar(
                                          content: Text('Deleted'),
                                        ),
                                      );
                                    }
                                  } catch (e) {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(
                                        SnackBar(
                                          content: Text('Delete failed: $e'),
                                        ),
                                      );
                                    }
                                  }
                                },
                                onRestore: () async {
                                  try {
                                    notifier.clearSelection();
                                    notifier.toggleProductSelection(p.id);
                                    await notifier.restoreSelected();
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(
                                        const SnackBar(
                                          content: Text('Restored'),
                                        ),
                                      );
                                    }
                                  } catch (e) {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(
                                        SnackBar(
                                          content: Text('Restore failed: $e'),
                                        ),
                                      );
                                    }
                                  }
                                },
                              );
                            },
                          ),
          ),
        ),
        if (state.totalPages > 1)
          Padding(
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
      ],
    );
  }
}

class _ProductTile extends StatelessWidget {
  const _ProductTile({
    required this.product,
    required this.canUpdate,
    required this.canDelete,
    required this.showDeleted,
    required this.onOpen,
    required this.onEdit,
    required this.onDelete,
    required this.onRestore,
  });

  final StockProduct product;
  final bool canUpdate;
  final bool canDelete;
  final bool showDeleted;
  final VoidCallback onOpen;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: ListTile(
        onTap: onOpen,
        title: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(
          [
            if (product.sku != null && product.sku!.isNotEmpty) product.sku!,
            if (!product.isService) 'Qty ${product.quantityInStock}',
            product.status,
          ].where((e) => e.toString().isNotEmpty).join(' · '),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: AppTheme.textSecondary(context), fontSize: 12),
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (v) {
            if (v == 'edit') onEdit();
            if (v == 'delete') onDelete();
            if (v == 'restore') onRestore();
          },
          itemBuilder: (_) => [
            if (canUpdate && !showDeleted)
              const PopupMenuItem(value: 'edit', child: Text('Edit')),
            if (canDelete && !showDeleted)
              const PopupMenuItem(value: 'delete', child: Text('Delete')),
            if (canDelete && showDeleted)
              const PopupMenuItem(value: 'restore', child: Text('Restore')),
          ],
          child: Icon(Icons.more_vert, color: theme.colorScheme.onSurface),
        ),
      ),
    );
  }
}
