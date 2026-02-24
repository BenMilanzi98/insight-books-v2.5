import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/dashboard_data.dart';

class SummaryCardsRow extends StatelessWidget {
  final DashboardData data;

  const SummaryCardsRow({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final summary = data.summary;
    final isMobile = MediaQuery.of(context).size.width < 600;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Text(
            'Financial Summary',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
        if (isMobile)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Column(
              children: [
                _buildCard(
                  context,
                  'Total Revenue',
                  summary.revenue.current,
                  summary.revenue.change,
                  Colors.green,
                  Icons.trending_up,
                ),
                const SizedBox(height: 12),
                _buildCard(
                  context,
                  'Total Expenses',
                  summary.expenses.current,
                  summary.expenses.change,
                  Colors.orange,
                  Icons.show_chart,
                ),
                const SizedBox(height: 12),
                _buildCard(
                  context,
                  'Net Profit',
                  summary.profit.current,
                  summary.profit.change,
                  Colors.blue,
                  Icons.account_balance_wallet,
                ),
                const SizedBox(height: 12),
                _buildCard(
                  context,
                  'Outstanding',
                  summary.outstandingInvoices.current,
                  summary.outstandingInvoices.change,
                  Colors.purple,
                  Icons.description,
                ),
              ],
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              children: [
                Expanded(
                  child: _buildCard(
                    context,
                    'Total Revenue',
                    summary.revenue.current,
                    summary.revenue.change,
                    Colors.green,
                    Icons.trending_up,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildCard(
                    context,
                    'Total Expenses',
                    summary.expenses.current,
                    summary.expenses.change,
                    Colors.orange,
                    Icons.show_chart,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildCard(
                    context,
                    'Net Profit',
                    summary.profit.current,
                    summary.profit.change,
                    Colors.blue,
                    Icons.account_balance_wallet,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildCard(
                    context,
                    'Outstanding',
                    summary.outstandingInvoices.current,
                    summary.outstandingInvoices.change,
                    Colors.purple,
                    Icons.description,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildCard(
    BuildContext context,
    String title,
    double amount,
    double change,
    Color color,
    IconData icon,
  ) {
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 2,
    );
    final isPositive = change >= 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: Colors.grey.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              if (change != 0)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: (isPositive ? Colors.green : Colors.red).withValues(
                      alpha: 0.1,
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isPositive ? Icons.arrow_upward : Icons.arrow_downward,
                        size: 12,
                        color: isPositive ? Colors.green : Colors.red,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${change.abs().toStringAsFixed(1)}%',
                        style: TextStyle(
                          color: isPositive ? Colors.green : Colors.red,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(title, style: TextStyle(color: Colors.grey[600], fontSize: 14)),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              currencyFormat.format(amount),
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
