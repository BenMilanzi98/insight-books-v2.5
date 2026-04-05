import 'package:flutter/material.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/features/dashboard/domain/dashboard_data.dart';
import 'package:intl/intl.dart';

class RecentTransactionsTable extends StatelessWidget {
  final List<Transaction> transactions;

  const RecentTransactionsTable({super.key, required this.transactions});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateFormat = DateFormat('MMM dd, yyyy');
    final currencyFormat = NumberFormat.currency(symbol: 'MWK ');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Recent Transactions',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingTextStyle: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                columns: const [
                  DataColumn(label: Text('Date')),
                  DataColumn(label: Text('Description')),
                  DataColumn(label: Text('Status')),
                  DataColumn(label: Text('Amount'), numeric: true),
                ],
                rows: transactions.map((tx) {
                  final amountColor = tx.type == TransactionType.income
                      ? AppTheme.successColor(context)
                      : AppTheme.errorColor(context);
                  return DataRow(
                    cells: [
                      DataCell(Text(dateFormat.format(tx.date))),
                      DataCell(Text(tx.description)),
                      DataCell(_buildStatusBadge(context, tx.status)),
                      DataCell(
                        Text(
                          currencyFormat.format(tx.amount.abs()),
                          style: TextStyle(
                            color: amountColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(BuildContext context, TransactionStatus status) {
    Color bgColor;
    Color textColor;
    String text;

    switch (status) {
      case TransactionStatus.completed:
        bgColor = AppTheme.successBg(context);
        textColor = AppTheme.successColor(context);
        text = 'Completed';
        break;
      case TransactionStatus.pending:
        bgColor = AppTheme.warningBg(context);
        textColor = AppTheme.warningColor(context);
        text = 'Pending';
        break;
      case TransactionStatus.failed:
        bgColor = AppTheme.errorBg(context);
        textColor = AppTheme.errorColor(context);
        text = 'Failed';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: textColor,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
    );
  }
}
