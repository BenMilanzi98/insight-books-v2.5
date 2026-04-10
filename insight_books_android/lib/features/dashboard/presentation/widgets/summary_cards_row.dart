import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import '../../domain/dashboard_data.dart';

class SummaryCardsRow extends StatefulWidget {
  final DashboardData data;

  const SummaryCardsRow({super.key, required this.data});

  @override
  State<SummaryCardsRow> createState() => _SummaryCardsRowState();
}

class _SummaryCardsRowState extends State<SummaryCardsRow>
    with TickerProviderStateMixin {
  late final List<AnimationController> _controllers;
  late final List<Animation<double>> _fades;
  late final List<Animation<Offset>> _slides;

  static const _cardCount = 4;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(_cardCount, (i) {
      return AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 450),
      );
    });
    _fades = _controllers
        .map((c) => Tween<double>(begin: 0, end: 1)
            .animate(CurvedAnimation(parent: c, curve: Curves.easeOut)))
        .toList();
    _slides = _controllers
        .map((c) => Tween<Offset>(begin: const Offset(0, 20), end: Offset.zero)
            .animate(CurvedAnimation(parent: c, curve: Curves.easeOutCubic)))
        .toList();

    for (var i = 0; i < _cardCount; i++) {
      Future.delayed(Duration(milliseconds: 80 * i), () {
        if (mounted) _controllers[i].forward();
      });
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  Widget _animated(int index, Widget child) {
    return AnimatedBuilder(
      animation: _controllers[index],
      builder: (context, _) => Opacity(
        opacity: _fades[index].value,
        child: Transform.translate(offset: _slides[index].value, child: child),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final summary = widget.data.summary;
    final isMobile = MediaQuery.of(context).size.width < 600;
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final revenueColor = AppTheme.successColor(context);
    final expensesColor = AppTheme.warningColor(context);
    final profitColor = AppTheme.infoColor(context);
    final outstandingColor = colorScheme.secondary;

    final cards = [
      _buildCard(context, 'Total Revenue', summary.revenue.current, summary.revenue.change, revenueColor, Icons.trending_up),
      _buildCard(context, 'Total Expenses', summary.expenses.current, summary.expenses.change, expensesColor, Icons.show_chart),
      _buildCard(context, 'Net Profit', summary.profit.current, summary.profit.change, profitColor, Icons.account_balance_wallet),
      _buildCard(context, 'Outstanding', summary.outstandingInvoices.current, summary.outstandingInvoices.change, outstandingColor, Icons.description),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Text(
            'Financial Summary',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
              color: colorScheme.onSurface,
            ),
          ),
        ),
        if (isMobile)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Column(
              children: [
                for (var i = 0; i < cards.length; i++) ...[
                  if (i > 0) const SizedBox(height: 12),
                  _animated(i, cards[i]),
                ],
              ],
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              children: [
                for (var i = 0; i < cards.length; i++) ...[
                  if (i > 0) const SizedBox(width: 12),
                  Expanded(child: _animated(i, cards[i])),
                ],
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
    final currencyFormat = NumberFormat.currency(symbol: 'MWK ', decimalDigits: 2);
    final isPositive = change >= 0;
    final colorScheme = Theme.of(context).colorScheme;
    final changeColor = isPositive ? AppTheme.successColor(context) : AppTheme.errorColor(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: colorScheme.outline.withValues(alpha: 0.3)),
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
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: changeColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isPositive ? Icons.arrow_upward : Icons.arrow_downward,
                        size: 12,
                        color: changeColor,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${change.abs().toStringAsFixed(1)}%',
                        style: TextStyle(
                          color: changeColor,
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
          Text(
            title,
            style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 14),
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              currencyFormat.format(amount),
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
