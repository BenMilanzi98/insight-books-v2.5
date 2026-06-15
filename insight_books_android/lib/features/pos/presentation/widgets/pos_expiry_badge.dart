import 'package:flutter/material.dart';
import '../../domain/pos_models.dart';

class PosExpiryBadge extends StatelessWidget {
  final PosProduct product;
  final bool compact;

  const PosExpiryBadge({
    super.key,
    required this.product,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final label = product.expiryBadgeLabel;
    if (label == null) return const SizedBox.shrink();

    final colorScheme = Theme.of(context).colorScheme;
    final isExpired = product.expiryAlertLevel == 'expired';
    final bg = isExpired ? colorScheme.errorContainer : colorScheme.tertiaryContainer;
    final fg = isExpired ? colorScheme.onErrorContainer : colorScheme.onTertiaryContainer;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 8,
        vertical: compact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(compact ? 6 : 8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: compact ? 10 : 11,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

Widget? buildPosExpiryCartBanner(List<CartItem> cart) {
  final expiring = cart.where((item) => item.product.hasExpiryWarning).toList();
  if (expiring.isEmpty) return null;

  return Builder(
    builder: (context) {
      final colorScheme = Theme.of(context).colorScheme;
      final names = expiring.map((e) => e.product.name).take(3).join(', ');
      final suffix = expiring.length > 3 ? ' (+${expiring.length - 3} more)' : '';

      return Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colorScheme.tertiaryContainer.withValues(alpha: 0.65),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.tertiary.withValues(alpha: 0.4)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.warning_amber_rounded, size: 20, color: colorScheme.onTertiaryContainer),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Some items expire within 30 days: $names$suffix',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: colorScheme.onTertiaryContainer,
                ),
              ),
            ),
          ],
        ),
      );
    },
  );
}
