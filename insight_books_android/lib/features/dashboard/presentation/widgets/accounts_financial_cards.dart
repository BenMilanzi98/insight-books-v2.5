import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
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
            Colors.green,
            Icons.call_received,
          ),
          const SizedBox(height: 16),
          _buildAgingCard(
            context,
            'Accounts Payable',
            payables,
            Colors.red,
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
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 0,
    );

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withValues(alpha: 0.1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
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
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const Icon(Icons.chevron_right, color: Colors.grey, size: 20),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _buildMetricItem('Total', report.current, Colors.grey[800]!),
              _buildMetricItem('Not Due', report.notDue, Colors.green),
              _buildMetricItem('Overdue', report.overdue, Colors.red),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'Aging Summary',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
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
              Colors.green,
              Colors.yellow[700]!,
              Colors.orange,
              Colors.red,
            ];
            final barColor = index < agingColors.length
                ? agingColors[index]
                : Colors.grey;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12.0),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        period.range,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                      Text(
                        currencyFormat.format(period.amount),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: percentage,
                      backgroundColor: Colors.grey[100],
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

  Widget _buildMetricItem(String label, double amount, Color color) {
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 0,
    );
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
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
