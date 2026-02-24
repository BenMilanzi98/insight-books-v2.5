import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';
import 'package:insightbooks_android/features/dashboard/presentation/dashboard_controller.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import 'package:insightbooks_android/features/dashboard/presentation/widgets/cash_flow_chart.dart';
import 'package:insightbooks_android/features/dashboard/presentation/widgets/recent_transactions_table.dart';
import 'package:insightbooks_android/features/dashboard/presentation/widgets/summary_cards_row.dart';
import 'package:insightbooks_android/features/dashboard/presentation/widgets/today_performance_cards.dart';
import 'package:insightbooks_android/features/dashboard/presentation/widgets/expense_breakdown_chart.dart';
import 'package:insightbooks_android/features/dashboard/presentation/widgets/accounts_financial_cards.dart';
import 'package:insightbooks_android/features/dashboard/presentation/widgets/stock_alerts_list.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardState = ref.watch(dashboardControllerProvider);
    final controller = ref.read(dashboardControllerProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      drawer: const AppDrawer(),
      body: CustomScrollView(
        slivers: [
          _buildAppBar(context, ref),
          _buildDateFilter(context, ref, controller),
          SliverToBoxAdapter(
            child: dashboardState.when(
              data: (data) => _buildContent(context, ref, data),
              loading: () => const SizedBox(
                height: 400,
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (err, stack) => _buildErrorState(err, ref),
            ),
          ),
          const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
        ],
      ),
    );
  }

  Widget _buildAppBar(BuildContext context, WidgetRef ref) {
    return SliverAppBar(
      expandedHeight: 120.0,
      floating: false,
      pinned: true,
      elevation: 0,
      backgroundColor: Colors.white,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.only(left: 16, bottom: 16),
        title: const Text(
          'Insights Dashboard',
          style: TextStyle(
            color: Colors.black87,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        background: Container(color: Colors.white),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.logout, color: Colors.black87),
          onPressed: () => ref.read(authStateProvider.notifier).logout(),
        ),
      ],
    );
  }

  Widget _buildDateFilter(
    BuildContext context,
    WidgetRef ref,
    DashboardController controller,
  ) {
    final ranges = {
      'today': 'Today',
      'thisWeek': 'Weekly',
      'thisMonth': 'Monthly',
      'thisYear': 'Yearly',
    };

    return SliverToBoxAdapter(
      child: Container(
        height: 60,
        color: Colors.white,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          children: ranges.entries.map((entry) {
            final isSelected = controller.dateRange == entry.key;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(entry.value),
                selected: isSelected,
                onSelected: (selected) {
                  if (selected) controller.setDateRange(entry.key);
                },
                selectedColor: Theme.of(context).primaryColor,
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : Colors.black87,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, WidgetRef ref, dynamic data) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 24),
        TodayPerformanceCards(today: data.today),
        const SizedBox(height: 24),
        SummaryCardsRow(data: data),
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: CashFlowChart(
            incomeData: data.incomeData,
            expenseData: data.expenseData,
            labels: data.months,
          ),
        ),
        const SizedBox(height: 24),
        ExpenseBreakdownChart(categories: data.expensesBreakdown),
        const SizedBox(height: 24),
        AccountsFinancialCards(
          receivables: data.receivables,
          payables: data.payables,
        ),
        const SizedBox(height: 24),
        StockAlertsList(alerts: data.stockAlerts),
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Text(
            'Recent Transactions',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(height: 12),
        RecentTransactionsTable(transactions: data.recentTransactions),
      ],
    );
  }

  Widget _buildErrorState(Object err, WidgetRef ref) {
    return SizedBox(
      height: 400,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text('Error: $err', textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () =>
                  ref.read(dashboardControllerProvider.notifier).refresh(),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
