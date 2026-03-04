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
                        onUpdateQuantity: (q) =>
                            posNotifier.updateQuantity(item.product.id, q),
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
                      onPressed: posState.cart.isNotEmpty
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
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const CheckoutView(),
    );
  }
}

class _CartItemTile extends StatelessWidget {
  final dynamic item; // CartItem
  final Function(double) onUpdateQuantity;
  final VoidCallback onRemove;

  const _CartItemTile({
    required this.item,
    required this.onUpdateQuantity,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 2,
    );
    final product = item.product;
    final colorScheme = Theme.of(context).colorScheme;

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
              ],
            ),
          ),
          Row(
            children: [
              IconButton(
                icon: Icon(Icons.remove_circle_outline, color: colorScheme.error),
                onPressed: () => onUpdateQuantity(item.quantity - 1),
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
                onPressed: () => onUpdateQuantity(item.quantity + 1),
              ),
            ],
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: Icon(Icons.delete_outline, color: colorScheme.onSurfaceVariant),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}
