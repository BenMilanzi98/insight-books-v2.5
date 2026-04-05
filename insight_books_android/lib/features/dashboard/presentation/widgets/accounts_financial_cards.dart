import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import '../../domain/dashboard_data.dart';

class AccountsFinancialCards extends StatelessWidget {
  final AgingReport receivables;
  final AgingReport payables;

  const AccountsFinancialCards({
    super.key,
    required this.receivables,
    required this.payables,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        children: [
          _buildAgingCard(
            context,
            'Accounts Receivable',
            receivables,
            AppTheme.successColor(context),
            Icons.call_received,
          ),
          const SizedBox(height: 16),
          _buildAgingCard(
            context,
            'Accounts Payable',
            payables,
            AppTheme.errorColor(context),
            Icons.call_made,
          ),
        ],
      ),
    );
  }

  Widget _buildAgingCard(
    BuildContext context,
    String title,
    AgingReport report,
    Color color,
    IconData icon,
  ) {
    final currencyFormat = NumberFormat.currency(symbol: 'MWK ', decimalDigits: 0);
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: color.withValues(alpha: 0.1)),
                    ),
                    child: Icon(icon, color: color, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                  ),
                ],
              ),
              Icon(Icons.chevron_right, color: colorScheme.onSurfaceVariant, size: 20),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _buildMetricItem(context, 'Total', report.current, colorScheme.onSurface),
              _buildMetricItem(context, 'Not Due', report.notDue, AppTheme.successColor(context)),
              _buildMetricItem(context, 'Overdue', report.overdue, AppTheme.errorColor(context)),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'Aging Summary',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 12),
          ...report.aging.asMap().entries.map((entry) {
            final index = entry.key;
            final period = entry.value;
            final percentage = report.current > 0
                ? (period.amount / report.current)
                : 0.0;
            final agingColors = [
              AppTheme.successColor(context),
              AppTheme.warningColor(context),
              Color.lerp(AppTheme.warningColor(context), AppTheme.errorColor(context), 0.5)!,
              AppTheme.errorColor(context),
            ];
            final barColor = index < agingColors.length
                ? agingColors[index]
                : colorScheme.onSurfaceVariant;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12.0),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        period.range,
                        style: TextStyle(
                          fontSize: 12,
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                      Text(
                        currencyFormat.format(period.amount),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: percentage,
                      backgroundColor: colorScheme.surfaceContainerHighest,
                      valueColor: AlwaysStoppedAnimation<Color>(barColor),
                      minHeight: 6,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildMetricItem(BuildContext context, String label, double amount, Color color) {
    final currencyFormat = NumberFormat.currency(symbol: 'MWK ', decimalDigits: 0);
    final cs = Theme.of(context).colorScheme;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              currencyFormat.format(amount),
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
