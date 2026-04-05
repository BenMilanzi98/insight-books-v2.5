import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import '../../domain/dashboard_data.dart';

class CashFlowChart extends StatelessWidget {
  final List<ChartPoint> incomeData;
  final List<ChartPoint> expenseData;
  final List<String> labels;

  const CashFlowChart({
    super.key,
    required this.incomeData,
    required this.expenseData,
    required this.labels,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    if (labels.isEmpty || (incomeData.isEmpty && expenseData.isEmpty)) {
      return Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppTheme.borderColor(context)),
        ),
        child: Column(
          children: [
            Icon(Icons.show_chart_rounded, size: 48, color: AppTheme.textSecondary(context)),
            const SizedBox(height: 12),
            Text(
              'No cash flow data available',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppTheme.textPrimary(context),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Data will appear once transactions are recorded',
              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary(context)),
            ),
          ],
        ),
      );
    }

    final incomeColor = AppTheme.successColor(context);
    final expenseColor = AppTheme.errorColor(context);

    final maxIncome = incomeData.isEmpty
        ? 0.0
        : incomeData.map((e) => e.amount).reduce((a, b) => a > b ? a : b);
    final maxExpense = expenseData.isEmpty
        ? 0.0
        : expenseData.map((e) => e.amount).reduce((a, b) => a > b ? a : b);
    final maxVal = (maxIncome > maxExpense ? maxIncome : maxExpense);
    final maxY = maxVal == 0 ? 1000.0 : maxVal * 1.2;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Income & Expenses',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _buildLegend(context, 'Income', incomeColor),
              const SizedBox(width: 16),
              _buildLegend(context, 'Expenses', expenseColor),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 220,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (value) => FlLine(
                    color: colorScheme.outline.withValues(alpha: 0.2),
                    strokeWidth: 1,
                  ),
                ),
                titlesData: FlTitlesData(
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 32,
                      interval: (labels.length / 5).clamp(1, 100),
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index >= 0 && index < labels.length) {
                          return Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: Text(
                              labels[index],
                              style: TextStyle(
                                color: colorScheme.onSurfaceVariant,
                                fontSize: 10,
                              ),
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 45,
                      getTitlesWidget: (value, meta) {
                        if (value == 0) return const SizedBox.shrink();
                        return Text(
                          _formatCompact(value),
                          style: TextStyle(
                            color: colorScheme.onSurfaceVariant,
                            fontSize: 10,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                minX: 0,
                maxX: (labels.length - 1).toDouble(),
                minY: 0,
                maxY: maxY,
                lineBarsData: [
                  _lineBarData(incomeData, incomeColor),
                  _lineBarData(expenseData, expenseColor),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  LineChartBarData _lineBarData(List<ChartPoint> points, Color color) {
    return LineChartBarData(
      spots: points.map((p) => FlSpot(p.day.toDouble(), p.amount)).toList(),
      isCurved: true,
      color: color,
      barWidth: 3,
      isStrokeCapRound: true,
      dotData: const FlDotData(show: false),
      belowBarData: BarAreaData(
        show: true,
        color: color.withValues(alpha: 0.05),
      ),
    );
  }

  Widget _buildLegend(BuildContext context, String label, Color color) {
    final secondary = Theme.of(context).colorScheme.onSurfaceVariant;
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 12, color: secondary)),
      ],
    );
  }

  String _formatCompact(double value) {
    if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
    return value.toStringAsFixed(0);
  }
}
