import 'package:flutter/material.dart';
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
                  return DataRow(
                    cells: [
                      DataCell(Text(dateFormat.format(tx.date))),
                      DataCell(Text(tx.description)),
                      DataCell(_buildStatusBadge(context, tx.status)),
                      DataCell(
                        Text(
                          currencyFormat.format(tx.amount.abs()),
                          style: TextStyle(
                            color: tx.type == TransactionType.income
                                ? Colors.green
                                : Colors.red,
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
        bgColor = Colors.green.withValues(alpha: 0.1);
        textColor = Colors.green;
        text = 'Completed';
        break;
      case TransactionStatus.pending:
        bgColor = Colors.orange.withValues(alpha: 0.1);
        textColor = Colors.orange;
        text = 'Pending';
        break;
      case TransactionStatus.failed:
        bgColor = Colors.red.withValues(alpha: 0.1);
        textColor = Colors.red;
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
