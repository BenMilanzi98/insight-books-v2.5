import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/features/pos/presentation/providers/pos_provider.dart';
import 'package:insightbooks_android/features/pos/presentation/widgets/checkout_view.dart';

class CartSheet extends ConsumerWidget {
  const CartSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final posState = ref.watch(posProvider);
    final posNotifier = ref.read(posProvider.notifier);
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 2,
    );
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Review Cart',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: posState.canUpdateSales
                    ? () => _showAddCustomProduct(context, ref)
                    : null,
                icon: const Icon(Icons.add_box_outlined),
                label: const Text('Add Custom Product'),
              ),
            ),
          ),
          const Divider(height: 1),

          // Items List
          Expanded(
            child: posState.cart.isEmpty
                ? Center(child: Text('Your cart is empty', style: TextStyle(color: colorScheme.onSurfaceVariant)))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: posState.cart.length,
                    itemBuilder: (context, index) {
                      final item = posState.cart[index];
                      return _CartItemTile(
                        item: item,
                        canMutate: posState.canUpdateSales,
                        taxTypes: posState.taxTypes,
                        onUpdateQuantity: (q) =>
                            posNotifier.updateQuantity(item.product.id, q),
                        onUpdateDiscount: (d) =>
                            posNotifier.updateItemDiscount(item.product.id, d),
                        onApplyTax: (tax) =>
                            posNotifier.applyTaxToCartItem(item.product.id, tax),
                        onSetUnitQuantities: (units) =>
                            posNotifier.setUnitQuantities(item.product.id, units),
                        onRemove: () =>
                            posNotifier.removeFromCart(item.product.id),
                      );
                    },
                  ),
          ),

          // Summary & Checkout
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: colorScheme.surface,
              boxShadow: [
                BoxShadow(
                  color: colorScheme.shadow.withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(
                            labelText: 'Global discount %',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          onChanged: posState.canUpdateSales
                              ? (value) {
                            final discount = double.tryParse(value) ?? 0;
                            posNotifier.setGlobalDiscount(discount);
                          }
                              : null,
                          enabled: posState.canUpdateSales,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildSummaryRow(context, 'Subtotal', currencyFormat.format(posState.subtotal)),
                  if (posState.totalDiscount > 0)
                    _buildSummaryRow(
                      context,
                      'Discount',
                      '- ${currencyFormat.format(posState.totalDiscount)}',
                      color: colorScheme.error,
                    ),
                  _buildSummaryRow(context, 'Tax', currencyFormat.format(posState.totalTax)),
                  const Divider(height: 24),
                  _buildSummaryRow(context, 'Total', currencyFormat.format(posState.total), isTotal: true),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: posState.cart.isNotEmpty && posState.canCreateSales
                          ? () => _showCheckout(context)
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colorScheme.primary,
                        foregroundColor: colorScheme.onPrimary,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Proceed to Checkout',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(
    BuildContext context,
    String label,
    String value, {
    bool isTotal = false,
    Color? color,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    final labelColor = color ?? (isTotal ? colorScheme.onSurface : colorScheme.onSurfaceVariant);
    final valueColor = color ?? colorScheme.onSurface;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isTotal ? 18 : 14,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              color: labelColor,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: isTotal ? 20 : 14,
              fontWeight: FontWeight.bold,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  void _showCheckout(BuildContext context) {
    final posState = ProviderScope.containerOf(context, listen: false).read(posProvider);
    if (!posState.canCreateSales) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You do not have permission to perform this action.')),
      );
      return;
    }
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const CheckoutView(),
    );
  }

  Future<void> _showAddCustomProduct(BuildContext context, WidgetRef ref) async {
    final posState = ref.read(posProvider);
    if (!posState.canUpdateSales) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You do not have permission to perform this action.')),
      );
      return;
    }
    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final qtyCtrl = TextEditingController(text: '1');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Custom Product'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: priceCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Selling Price',
                border: OutlineInputBorder(),
                prefixText: 'MWK ',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: qtyCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Quantity',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add')),
        ],
      ),
    );
    if (ok == true) {
      final name = nameCtrl.text.trim();
      final price = double.tryParse(priceCtrl.text.trim()) ?? 0;
      final qty = double.tryParse(qtyCtrl.text.trim()) ?? 1;
      if (name.isNotEmpty && price > 0) {
        ref.read(posProvider.notifier).addCustomProduct(
              name: name,
              unitPrice: price,
              quantity: qty <= 0 ? 1 : qty,
            );
      }
    }
    nameCtrl.dispose();
    priceCtrl.dispose();
    qtyCtrl.dispose();
  }
}

class _CartItemTile extends StatelessWidget {
  final dynamic item; // CartItem
  final bool canMutate;
  final Function(double) onUpdateQuantity;
  final VoidCallback onRemove;
  final Function(double) onUpdateDiscount;
  final List<Map<String, dynamic>> taxTypes;
  final Function(Map<String, dynamic>) onApplyTax;
  final Function(Map<String, double>) onSetUnitQuantities;

  const _CartItemTile({
    required this.item,
    required this.canMutate,
    required this.onUpdateQuantity,
    required this.onRemove,
    required this.onUpdateDiscount,
    required this.taxTypes,
    required this.onApplyTax,
    required this.onSetUnitQuantities,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 2,
    );
    final product = item.product;
    final colorScheme = Theme.of(context).colorScheme;
    final grossLineTotal = (product.price as num).toDouble() * (item.quantity as num).toDouble();
    final discountAmount = (item.discountAmount as num).toDouble();
    final netLineTotal = (grossLineTotal - discountAmount).clamp(0, double.infinity).toDouble();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: colorScheme.outline.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: TextStyle(fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                ),
                Text(
                  currencyFormat.format(product.price),
                  style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 12),
                ),
                const SizedBox(height: 4),
                if (discountAmount > 0)
                  Text(
                    'Discount: -${currencyFormat.format(discountAmount)}',
                    style: TextStyle(
                      color: colorScheme.error,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                Text(
                  'Line total: ${currencyFormat.format(netLineTotal)}',
                  style: TextStyle(
                    color: colorScheme.onSurface,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Row(
            children: [
              IconButton(
                icon: Icon(Icons.remove_circle_outline, color: colorScheme.error),
                onPressed: canMutate ? () => onUpdateQuantity(item.quantity - 1) : null,
              ),
              SizedBox(
                width: 30,
                child: Text(
                  item.quantity.toInt().toString(),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                ),
              ),
              IconButton(
                icon: Icon(Icons.add_circle_outline, color: colorScheme.primary),
                onPressed: canMutate ? () => onUpdateQuantity(item.quantity + 1) : null,
              ),
              IconButton(
                icon: Icon(Icons.percent, color: colorScheme.secondary),
                onPressed: !canMutate ? null : () async {
                  final ctrl = TextEditingController(
                    text: (item.discount as num).toString(),
                  );
                  final value = await showDialog<double>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Item discount (per unit)'),
                      content: TextField(
                        controller: ctrl,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(),
                          prefixText: 'MWK ',
                        ),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Cancel'),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(
                            ctx,
                            double.tryParse(ctrl.text.trim()) ?? 0,
                          ),
                          child: const Text('Apply'),
                        ),
                      ],
                    ),
                  );
                  if (value != null) {
                    onUpdateDiscount(value);
                  }
                  ctrl.dispose();
                },
              ),
              IconButton(
                icon: Icon(Icons.request_quote_outlined, color: colorScheme.primary),
                onPressed: taxTypes.isEmpty
                    || !canMutate
                    ? null
                    : () async {
                        final selected = await showModalBottomSheet<Map<String, dynamic>>(
                          context: context,
                          builder: (ctx) => ListView(
                            shrinkWrap: true,
                            children: [
                              ...taxTypes.map(
                                (t) => ListTile(
                                  title: Text((t['taxName'] ?? t['name'] ?? 'Tax').toString()),
                                  subtitle: Text('${t['taxRate'] ?? 0}%'),
                                  onTap: () => Navigator.pop(ctx, t),
                                ),
                              ),
                              const Divider(height: 1),
                              ListTile(
                              leading: const Icon(Icons.add),
                              title: const Text('Create Tax Type'),
                              onTap: () async {
                                Navigator.pop(ctx);
                                final taxNameCtrl = TextEditingController();
                                final taxRateCtrl = TextEditingController();
                                String? accountId;
                                final container = ProviderScope.containerOf(
                                  context,
                                  listen: false,
                                );
                                final accounts = container.read(posProvider).taxAccounts;
                                final ok = await showDialog<bool>(
                                  context: context,
                                  builder: (dCtx) => StatefulBuilder(
                                    builder: (dCtx, setDialogState) => AlertDialog(
                                      title: const Text('Create Tax Type'),
                                      content: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          TextField(
                                            controller: taxNameCtrl,
                                            decoration: const InputDecoration(
                                              labelText: 'Tax Name',
                                              border: OutlineInputBorder(),
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          TextField(
                                            controller: taxRateCtrl,
                                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                            decoration: const InputDecoration(
                                              labelText: 'Tax Rate %',
                                              border: OutlineInputBorder(),
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          DropdownButtonFormField<String>(
                                            initialValue: accountId,
                                            decoration: const InputDecoration(
                                              labelText: 'Account',
                                              border: OutlineInputBorder(),
                                            ),
                                            items: accounts
                                                .map(
                                                  (a) => DropdownMenuItem(
                                                    value: (a['id'] ?? '').toString(),
                                                    child: Text(
                                                      (a['name'] ?? a['accountName'] ?? 'Account')
                                                          .toString(),
                                                    ),
                                                  ),
                                                )
                                                .toList(),
                                            onChanged: (v) => setDialogState(() => accountId = v),
                                          ),
                                        ],
                                      ),
                                      actions: [
                                        TextButton(
                                          onPressed: () => Navigator.pop(dCtx, false),
                                          child: const Text('Cancel'),
                                        ),
                                        FilledButton(
                                          onPressed: () => Navigator.pop(dCtx, true),
                                          child: const Text('Create'),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                                if (ok == true &&
                                    taxNameCtrl.text.trim().isNotEmpty &&
                                    accountId != null) {
                                  final created = await container
                                      .read(posProvider.notifier)
                                      .createAndAddTaxType(
                                        taxName: taxNameCtrl.text.trim(),
                                        taxRate: double.tryParse(taxRateCtrl.text.trim()) ?? 0,
                                        accountId: accountId!,
                                      );
                                  onApplyTax(created);
                                }
                                taxNameCtrl.dispose();
                                taxRateCtrl.dispose();
                              },
                              ),
                            ],
                          ),
                        );
                        if (selected != null) onApplyTax(selected);
                      },
              ),
              if ((product.units).isNotEmpty)
                IconButton(
                  icon: Icon(Icons.straighten, color: colorScheme.tertiary),
                  onPressed: () async {
                    if (!canMutate) return;
                    final unitInputs = <String, TextEditingController>{
                      for (final u in product.units)
                        u.id: TextEditingController(
                          text: ((item.unitQuantities?[u.id] ?? 0)).toString(),
                        ),
                    };
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Unit Quantities'),
                        content: SizedBox(
                          width: 360,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: product.units
                                .map(
                                  (u) => Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: TextField(
                                      controller: unitInputs[u.id],
                                      keyboardType:
                                          const TextInputType.numberWithOptions(decimal: true),
                                      decoration: InputDecoration(
                                        labelText:
                                            '${u.unitName} (x${u.conversionRate.toStringAsFixed(0)})',
                                        border: const OutlineInputBorder(),
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: const Text('Cancel'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            child: const Text('Apply'),
                          ),
                        ],
                      ),
                    );
                    if (confirmed == true) {
                      final map = <String, double>{};
                      for (final u in product.units) {
                        map[u.id] = double.tryParse(unitInputs[u.id]!.text.trim()) ?? 0;
                      }
                      onSetUnitQuantities(map);
                    }
                    for (final c in unitInputs.values) {
                      c.dispose();
                    }
                  },
                ),
            ],
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: Icon(Icons.delete_outline, color: colorScheme.onSurfaceVariant),
            onPressed: canMutate ? onRemove : null,
          ),
        ],
      ),
    );
  }
}
