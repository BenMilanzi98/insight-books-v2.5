import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import '../../domain/dashboard_data.dart';

class ExpenseBreakdownChart extends StatelessWidget {
  final List<ExpenseCategory> categories;

  const ExpenseBreakdownChart({super.key, required this.categories});

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) return const SizedBox.shrink();

    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: colorScheme.outline.withValues(alpha: 0.3)),
          boxShadow: [
            BoxShadow(
              color: colorScheme.shadow.withValues(alpha: 0.12),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Expenses Breakdown',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 180,
              child: PieChart(
                PieChartData(
                  sectionsSpace: 2,
                  centerSpaceRadius: 40,
                  sections: categories.asMap().entries.map((entry) {
                    final index = entry.key;
                    final category = entry.value;
                    return PieChartSectionData(
                      color: _getColor(context, index),
                      value: category.amount,
                      title: '${category.percentage.toStringAsFixed(0)}%',
                      radius: 50,
                      titleStyle: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Column(
              children: categories.asMap().entries.map((entry) {
                final index = entry.key;
                final category = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: Row(
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: _getColor(context, index),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          category.category,
                          style: TextStyle(
                            fontSize: 14,
                            color: colorScheme.onSurface,
                          ),
                        ),
                      ),
                      Text(
                        NumberFormat.currency(
                          symbol: 'MWK ',
                          decimalDigits: 0,
                        ).format(category.amount),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Color _getColor(BuildContext context, int index) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = [
      AppTheme.infoColor(context),
      Theme.of(context).colorScheme.secondary,
      AppTheme.successColor(context),
      AppTheme.warningColor(context),
      AppTheme.errorColor(context),
      Theme.of(context).colorScheme.primary,
      isDark ? const Color(0xFF2DD4BF) : const Color(0xFF14B8A6),
    ];
    return colors[index % colors.length];
  }
}
