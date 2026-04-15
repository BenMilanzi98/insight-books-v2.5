import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/features/dashboard/presentation/dashboard_controller.dart';
import 'package:insightbooks_android/features/tenant/domain/tenant_models.dart';
import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';
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

    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: () => controller.refresh(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
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
                error: (err, stack) => _buildErrorState(context, err, ref),
              ),
            ),
            const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context, WidgetRef ref) {
    final tenantState = ref.watch(tenantProvider);
    final matching = tenantState.currentTenantId != null
        ? tenantState.tenants
            .where((t) => t.id == tenantState.currentTenantId)
        : <Tenant>[];
    final currentTenant = matching.isNotEmpty
        ? matching.first
        : tenantState.sessionTenant;
    final businessName = currentTenant?.name.trim();
    final title =
        (businessName != null && businessName.isNotEmpty)
            ? businessName
            : 'Dashboard';

    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return SliverAppBar(
      expandedHeight: 120.0,
      floating: false,
      pinned: true,
      elevation: 0,
      backgroundColor: colorScheme.surface,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.only(left: 16, bottom: 16),
        title: Text(
          title,
          style: TextStyle(
            color: colorScheme.onSurface,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        background: Container(color: colorScheme.surface),
      ),
      actions: [
        const ThemeToggleButton(),
        IconButton(
          icon: Icon(Icons.logout_rounded, color: colorScheme.onSurface),
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

    final colorScheme = Theme.of(context).colorScheme;
    return SliverToBoxAdapter(
      child: Container(
        height: 60,
        color: colorScheme.surface,
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
                selectedColor: colorScheme.primary,
                labelStyle: TextStyle(
                  color: isSelected ? colorScheme.onPrimary : colorScheme.onSurface,
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

  Widget _buildErrorState(BuildContext context, Object err, WidgetRef ref) {
    final colorScheme = Theme.of(context).colorScheme;
    final msg = NetworkErrorMapper.toUserMessage(
      err,
      fallback: 'Failed to load dashboard',
    );
    return SizedBox(
      height: 400,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: colorScheme.error),
            const SizedBox(height: 16),
            Text(
              msg,
              textAlign: TextAlign.center,
              style: TextStyle(color: colorScheme.onSurface),
            ),
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
