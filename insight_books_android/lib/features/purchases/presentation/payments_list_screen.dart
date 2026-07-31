import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import 'package:insightbooks_android/shared/widgets/stat_card.dart';

import '../data/purchases_repository.dart';
import '../domain/purchases_models.dart';
import 'providers/payments_provider.dart';

class PaymentsListScreen extends ConsumerStatefulWidget {
  const PaymentsListScreen({super.key});

  @override
  ConsumerState<PaymentsListScreen> createState() => _PaymentsListScreenState();
}

class _PaymentsListScreenState extends ConsumerState<PaymentsListScreen> {
  List<PurchaseSupplier> _suppliers = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      ref.read(paymentsControllerProvider.notifier).load();
      _loadSuppliers();
    });
  }

  Future<void> _loadSuppliers() async {
    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final response = await repo.fetchSuppliers(page: 1, limit: 200);
      if (mounted) setState(() => _suppliers = response.items);
    } catch (_) {
      // Filter dropdown falls back to empty.
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(paymentsControllerProvider);
    final notifier = ref.read(paymentsControllerProvider.notifier);
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 0);
    final dateFormat = DateFormat.yMMMd();

    if (!state.canView) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Supplier Payments')),
        body: const Center(
          child: Text('You do not have permission to view supplier payments.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Supplier Payments'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: const [ThemeToggleButton()],
      ),
      floatingActionButton: state.canCreate
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/purchases/payments/create'),
              icon: const Icon(Icons.add),
              label: const Text('Record payment'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: notifier.refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            if (state.stats != null)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 96,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    children: [
                      SizedBox(
                        width: 150,
                        child: StatCard(
                          label: 'Payments recorded',
                          value: '${state.stats!.total}',
                          count: state.stats!.total,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 160,
                        child: StatCard(
                          label: 'Total disbursed',
                          value: currency.format(state.stats!.totalAmount),
                          count: 0,
                          color: Colors.green,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 140,
                        child: StatCard(
                          label: 'This month',
                          value: currency.format(state.stats!.monthAmount),
                          count: 0,
                          color: Colors.blue,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 160,
                        child: StatCard(
                          label: 'Average payment',
                          value: currency.format(state.stats!.avg),
                          count: 0,
                          color: const Color(0xFFEF4444),
                          subtitle: 'Per payment',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: DropdownButtonFormField<String>(
                  initialValue:
                      state.supplierFilter.isEmpty ? '' : state.supplierFilter,
                  decoration: const InputDecoration(
                    labelText: 'Supplier',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: [
                    const DropdownMenuItem(
                      value: '',
                      child: Text('All suppliers'),
                    ),
                    for (final s in _suppliers)
                      DropdownMenuItem(
                        value: s.id,
                        child: Text(
                          s.supplierName,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (v) => notifier.setSupplierFilter(v ?? ''),
                ),
              ),
            ),
            if (state.isLoading && state.payments.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null && state.payments.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(state.error!),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: notifier.refresh,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              )
            else if (state.payments.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Text(
                    'No supplier payments recorded',
                    style: TextStyle(color: AppTheme.textSecondary(context)),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.all(12),
                sliver: SliverList.separated(
                  itemCount: state.payments.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final payment = state.payments[index];
                    return _PaymentTile(
                      payment: payment,
                      currency: currency,
                      dateFormat: dateFormat,
                      onTap: () =>
                          context.push('/purchases/payments/${payment.id}'),
                    );
                  },
                ),
              ),
            if (state.totalPages > 1)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        onPressed: state.currentPage > 1
                            ? () => notifier.setPage(state.currentPage - 1)
                            : null,
                        icon: const Icon(Icons.chevron_left),
                      ),
                      Text('Page ${state.currentPage} / ${state.totalPages}'),
                      IconButton(
                        onPressed: state.currentPage < state.totalPages
                            ? () => notifier.setPage(state.currentPage + 1)
                            : null,
                        icon: const Icon(Icons.chevron_right),
                      ),
                    ],
                  ),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({
    required this.payment,
    required this.currency,
    required this.dateFormat,
    required this.onTap,
  });

  final SupplierPayment payment;
  final NumberFormat currency;
  final DateFormat dateFormat;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitle = [
      payment.supplierName ?? 'No supplier',
      '${payment.allocations.length} allocations',
    ].join(' · ');

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Icon(
            Icons.payments_outlined,
            color: theme.colorScheme.onPrimaryContainer,
            size: 20,
          ),
        ),
        title: Text(
          payment.paymentNumber ?? payment.id,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          subtitle,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppTheme.textSecondary(context),
            fontSize: 12,
          ),
        ),
        isThreeLine: true,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              currency.format(payment.amount),
              style: theme.textTheme.titleSmall,
            ),
            if (payment.paymentDate != null)
              Text(
                dateFormat.format(payment.paymentDate!),
                style: TextStyle(
                  fontSize: 10,
                  color: AppTheme.textSecondary(context),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
