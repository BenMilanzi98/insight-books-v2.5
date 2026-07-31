import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';

import 'package:intl/intl.dart';



import 'package:insightbooks_android/core/theme/app_theme.dart';

import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';

import 'package:insightbooks_android/shared/widgets/main_layout.dart';



import '../data/stock_movement_offline_queue.dart';

import '../data/stock_repository.dart';

import '../domain/stock_models.dart';

import 'providers/stock_details_provider.dart';

import 'providers/stock_provider.dart';

import 'stock_movement_sheet.dart';



class StockDetailsScreen extends ConsumerWidget {

  final String productId;



  const StockDetailsScreen({super.key, required this.productId});



  @override

  Widget build(BuildContext context, WidgetRef ref) {

    final async = ref.watch(stockDetailsProvider(productId));

    final movementsAsync = ref.watch(stockMovementHistoryProvider(productId));

    final page = ref.watch(stockControllerProvider);

    final theme = Theme.of(context);



    return Scaffold(

      drawer: const AppDrawer(),

      appBar: AppBar(

        title: const Text('Product details'),

        leading: IconButton(

          icon: const Icon(Icons.arrow_back),

          onPressed: () => context.pop(),

        ),

        actions: [

          const ThemeToggleButton(),

          if (page.canUpdate && async.hasValue)

            IconButton(

              icon: const Icon(Icons.edit_outlined),

              onPressed: () {

                final product = async.requireValue;

                context.push(

                  product.isService

                      ? '/stock/services/$productId/edit'

                      : '/stock/products/$productId/edit',

                );

              },

            ),

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

                Text('Failed to load: $e'),

                const SizedBox(height: 12),

                FilledButton(

                  onPressed: () =>

                      ref.invalidate(stockDetailsProvider(productId)),

                  child: const Text('Retry'),

                ),

              ],

            ),

          ),

        ),

        data: (product) {

          final isService = product.isService;

          StockProduct? listProduct;
          for (final p in page.products) {
            if (p.id == productId) {
              listProduct = p;
              break;
            }
          }
          final displayQty =
              listProduct?.quantityInStock ?? product.quantityInStock;



          return ListView(

            padding: const EdgeInsets.all(16),

            children: [

              Text(

                product.name,

                style: theme.textTheme.headlineSmall?.copyWith(

                  fontWeight: FontWeight.bold,

                ),

              ),

              if (product.sku != null && product.sku!.isNotEmpty) ...[

                const SizedBox(height: 4),

                Text('SKU: ${product.sku}',

                    style: TextStyle(color: AppTheme.textSecondary(context))),

              ],

              const SizedBox(height: 16),

              _infoCard(context, [

                _row('Status', product.status),

                if (!isService) _row('Qty in stock', '$displayQty'),

                _row('Unit price', product.unitPrice.toStringAsFixed(2)),

                if (!isService)

                  _row('Cost price', product.costPrice.toStringAsFixed(2)),

                if (!isService)

                  _row('Stock value', product.totalStockValue.toStringAsFixed(2)),

                if (!isService)

                  _row('Reorder point', '${product.reorderPoint}'),

                _row('Category', product.category ?? '—'),

                _row('Location', product.location ?? '—'),

                _row('Type', isService ? 'Service' : 'Product'),

                if (product.isPerishable) _row('Perishable', 'Yes'),

              ]),

              if (!isService && page.canAdjust) ...[

                const SizedBox(height: 16),

                Row(

                  children: [

                    Expanded(

                      child: OutlinedButton.icon(

                        onPressed: () => showStockMovementSheet(

                          context: context,

                          ref: ref,

                          productId: productId,

                          productName: product.name,

                          currentQty: displayQty,

                          type: StockMovementType.stockIn,

                        ),

                        icon: const Icon(Icons.add),

                        label: const Text('Stock In'),

                      ),

                    ),

                    const SizedBox(width: 8),

                    Expanded(

                      child: OutlinedButton.icon(

                        onPressed: () => showStockMovementSheet(

                          context: context,

                          ref: ref,

                          productId: productId,

                          productName: product.name,

                          currentQty: displayQty,

                          type: StockMovementType.stockOut,

                        ),

                        icon: const Icon(Icons.remove),

                        label: const Text('Stock Out'),

                      ),

                    ),

                  ],

                ),

                const SizedBox(height: 8),

                SizedBox(

                  width: double.infinity,

                  child: OutlinedButton.icon(

                    onPressed: () => showStockMovementSheet(

                      context: context,

                      ref: ref,

                      productId: productId,

                      productName: product.name,

                      currentQty: displayQty,

                      type: StockMovementType.adjustment,

                    ),

                    icon: const Icon(Icons.tune),

                    label: const Text('Adjust'),

                  ),

                ),

              ],

              if (product.description != null &&

                  product.description!.trim().isNotEmpty) ...[

                const SizedBox(height: 16),

                Text('Description', style: theme.textTheme.titleMedium),

                const SizedBox(height: 8),

                Text(product.description!),

              ],

              const SizedBox(height: 16),

              Text('Movement history', style: theme.textTheme.titleMedium),

              const SizedBox(height: 8),

              movementsAsync.when(

                loading: () => const Padding(

                  padding: EdgeInsets.all(16),

                  child: Center(child: CircularProgressIndicator()),

                ),

                error: (e, _) => Card(

                  child: ListTile(

                    leading: const Icon(Icons.error_outline),

                    title: const Text('Could not load movements'),

                    subtitle: Text('$e'),

                    trailing: IconButton(

                      icon: const Icon(Icons.refresh),

                      onPressed: () => ref.invalidate(

                        stockMovementHistoryProvider(productId),

                      ),

                    ),

                  ),

                ),

                data: (movements) {

                  if (movements.isEmpty) {

                    return Card(

                      child: ListTile(

                        leading: const Icon(Icons.history),

                        title: const Text('No movements yet'),

                        subtitle: Text(

                          isService

                              ? 'Services do not track stock movements.'

                              : 'Stock In, Out, and Adjustments appear here.',

                        ),

                      ),

                    );

                  }

                  return Card(

                    child: Column(

                      children: [

                        for (var i = 0; i < movements.length; i++)

                          _MovementTile(

                            tx: movements[i],

                            showDivider: i < movements.length - 1,

                          ),

                      ],

                    ),

                  );

                },

              ),

              if (page.canDelete) ...[

                const SizedBox(height: 24),

                OutlinedButton.icon(

                  onPressed: () => _confirmDelete(context, ref, product.id),

                  icon: const Icon(Icons.delete_outline),

                  label: const Text('Delete'),

                  style: OutlinedButton.styleFrom(

                    foregroundColor: theme.colorScheme.error,

                  ),

                ),

              ],

            ],

          );

        },

      ),

    );

  }



  Widget _infoCard(BuildContext context, List<Widget> children) {

    return Card(

      child: Padding(

        padding: const EdgeInsets.all(12),

        child: Column(children: children),

      ),

    );

  }



  Widget _row(String label, String value) {

    return Padding(

      padding: const EdgeInsets.symmetric(vertical: 6),

      child: Row(

        children: [

          Expanded(child: Text(label)),

          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),

        ],

      ),

    );

  }



  Future<void> _confirmDelete(

    BuildContext context,

    WidgetRef ref,

    String id,

  ) async {

    final repo = ref.read(stockRepositoryProvider);

    Map<String, dynamic>? canDelete;

    try {

      canDelete = await repo.fetchCanDelete(id);

    } catch (_) {}

    if (!context.mounted) return;

    final ok = await showDialog<bool>(

      context: context,

      builder: (ctx) => AlertDialog(

        title: const Text('Delete product?'),

        content: Text(

          canDelete != null && canDelete['canDelete'] == false

              ? 'This product may be in use (${canDelete['reason'] ?? 'see usage'}). Soft-delete anyway?'

              : 'This will soft-delete the product. You can restore it later from the archive.',

        ),

        actions: [

          TextButton(

            onPressed: () => Navigator.of(ctx).pop(false),

            child: const Text('Cancel'),

          ),

          FilledButton(

            onPressed: () => Navigator.of(ctx).pop(true),

            child: const Text('Delete'),

          ),

        ],

      ),

    );

    if (ok != true || !context.mounted) return;

    try {

      await ref.read(stockControllerProvider.notifier).deleteProduct(id);

      if (!context.mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(

        const SnackBar(content: Text('Product deleted')),

      );

      context.pop();

    } catch (e) {

      if (!context.mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(

        SnackBar(content: Text('Delete failed: $e')),

      );

    }

  }

}



class _MovementTile extends StatelessWidget {

  const _MovementTile({

    required this.tx,

    required this.showDivider,

  });



  final StockTransaction tx;

  final bool showDivider;



  @override

  Widget build(BuildContext context) {

    final theme = Theme.of(context);

    final dateFmt = DateFormat('dd MMM yyyy, HH:mm');

    final delta = tx.delta;

    final deltaText = delta != null

        ? (delta >= 0 ? '+$delta' : '$delta')

        : '${tx.quantity}';



    return Column(

      children: [

        ListTile(

          leading: Icon(_iconForType(tx.type), color: _colorForType(tx.type)),

          title: Text(tx.type.isNotEmpty ? tx.type : 'Movement'),

          subtitle: Text(

            [

              dateFmt.format(tx.date),

              if (tx.userName != null && tx.userName!.isNotEmpty) tx.userName,

              if (tx.notes != null && tx.notes!.isNotEmpty) tx.notes,

            ].whereType<String>().join(' · '),

          ),

          trailing: Text(

            deltaText,

            style: theme.textTheme.titleMedium?.copyWith(

              fontWeight: FontWeight.w600,

              color: _colorForType(tx.type),

            ),

          ),

        ),

        if (showDivider) const Divider(height: 1, indent: 16, endIndent: 16),

      ],

    );

  }



  IconData _iconForType(String type) {

    final t = type.toLowerCase();

    if (t.contains('in')) return Icons.add_circle_outline;

    if (t.contains('out')) return Icons.remove_circle_outline;

    return Icons.tune;

  }



  Color _colorForType(String type) {

    final t = type.toLowerCase();

    if (t.contains('in')) return Colors.green;

    if (t.contains('out')) return Colors.orange;

    return Colors.blue;

  }

}


