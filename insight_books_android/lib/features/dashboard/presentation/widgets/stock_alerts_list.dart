import 'package:flutter/material.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import '../../domain/dashboard_data.dart';

class StockAlertsList extends StatelessWidget {
  final List<StockAlert> alerts;

  const StockAlertsList({super.key, required this.alerts});

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      final successColor = AppTheme.successColor(context);
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppTheme.successBg(context),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: successColor.withValues(alpha: 0.2)),
          ),
          child: Column(
            children: [
              Icon(Icons.check_circle, color: successColor, size: 48),
              const SizedBox(height: 12),
              Text(
                'No stock alerts',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary(context),
                ),
              ),
              Text(
                'All inventory levels are healthy',
                style: TextStyle(fontSize: 14, color: AppTheme.textSecondary(context)),
              ),
            ],
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppTheme.warningColor(context), AppTheme.errorColor(context)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.warning_amber_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Stock Alerts',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary(context),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...alerts.map((alert) => _buildAlertItem(context, alert)),
        ],
      ),
    );
  }

  Widget _buildAlertItem(BuildContext context, StockAlert alert) {
    final isCritical = alert.type == 'out_of_stock' || alert.currentStock == 0;
    final color = isCritical ? AppTheme.errorColor(context) : AppTheme.warningColor(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isCritical ? Icons.error_outline : Icons.warning_amber_rounded,
            color: color,
            size: 24,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert.product,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: AppTheme.textPrimary(context),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  alert.message,
                  style: TextStyle(color: AppTheme.textSecondary(context), fontSize: 13),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _buildSmallBadge('Stock: ${alert.currentStock}', color),
                    if (alert.reorderPoint != null) ...[
                      const SizedBox(width: 8),
                      _buildSmallBadge(
                        'Point: ${alert.reorderPoint}',
                        AppTheme.textSecondary(context),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Coming soon')),
              );
            },
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.primary,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text(
              'Restock',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSmallBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
