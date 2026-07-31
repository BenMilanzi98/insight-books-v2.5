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
import 'providers/bills_provider.dart';

class BillsListScreen extends ConsumerStatefulWidget {
  const BillsListScreen({super.key});

  @override
  ConsumerState<BillsListScreen> createState() => _BillsListScreenState();
}

class _BillsListScreenState extends ConsumerState<BillsListScreen> {
  List<PurchaseSupplier> _suppliers = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      ref.read(billsControllerProvider.notifier).load();
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
    final state = ref.watch(billsControllerProvider);
    final notifier = ref.read(billsControllerProvider.notifier);
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 0);
    final dateFormat = DateFormat.yMMMd();

    if (!state.canView) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Supplier Bills')),
        body: const Center(
          child: Text('You do not have permission to view supplier bills.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Supplier Bills'),
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
              onPressed: () => context.push('/purchases/bills/create'),
              icon: const Icon(Icons.add),
              label: const Text('New bill'),
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
                        width: 130,
                        child: StatCard(
                          label: 'Total bills',
                          value: '${state.stats!.total}',
                          count: state.stats!.total,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 160,
                        child: StatCard(
                          label: 'Unpaid / partial',
                          value: '${state.stats!.unpaid}',
                          count: state.stats!.unpaid,
                          color: Colors.orange,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 120,
                        child: StatCard(
                          label: 'Overdue',
                          value: '${state.stats!.overdue}',
                          count: state.stats!.overdue,
                          color: Colors.red,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 170,
                        child: StatCard(
                          label: 'Outstanding',
                          value: currency.format(state.stats!.outstanding),
                          count: 0,
                          color: const Color(0xFFEF4444),
                          subtitle: 'Balance due',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: state.supplierFilter.isEmpty
                            ? ''
                            : state.supplierFilter,
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
                        onChanged: (v) =>
                            notifier.setSupplierFilter(v ?? ''),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: state.statusFilter,
                        decoration: const InputDecoration(
                          labelText: 'Status',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: [
                          const DropdownMenuItem(
                            value: 'all',
                            child: Text('All statuses'),
                          ),
                          for (final status in billStatuses)
                            DropdownMenuItem(
                              value: status,
                              child: Text(status),
                            ),
                        ],
                        onChanged: (v) =>
                            notifier.setStatusFilter(v ?? 'all'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (state.isLoading && state.bills.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null && state.bills.isEmpty)
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
            else if (state.bills.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Text(
                    'No bills found',
                    style: TextStyle(color: AppTheme.textSecondary(context)),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.all(12),
                sliver: SliverList.separated(
                  itemCount: state.bills.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final bill = state.bills[index];
                    return _BillTile(
                      bill: bill,
                      currency: currency,
                      dateFormat: dateFormat,
                      onTap: () =>
                          context.push('/purchases/bills/${bill.id}'),
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

class _BillTile extends StatelessWidget {
  const _BillTile({
    required this.bill,
    required this.currency,
    required this.dateFormat,
    required this.onTap,
  });

  final SupplierBill bill;
  final NumberFormat currency;
  final DateFormat dateFormat;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final balance = bill.totalAmount - bill.amountPaid;
    final subtitle = [
      bill.supplierName ?? 'No supplier',
      if (bill.dueDate != null) 'Due ${dateFormat.format(bill.dueDate!)}',
    ].join(' · ');

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Icon(
            Icons.request_quote_outlined,
            color: theme.colorScheme.onPrimaryContainer,
            size: 20,
          ),
        ),
        title: Text(
          displayBillNumber(bill),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              subtitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppTheme.textSecondary(context),
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 4),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [
                _StatusChip(status: bill.status),
                if (bill.matchingStatus != null &&
                    bill.matchingStatus!.isNotEmpty &&
                    bill.matchingStatus != 'NOT_REQUIRED')
                  _MatchingChip(status: bill.matchingStatus!),
              ],
            ),
          ],
        ),
        isThreeLine: true,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              currency.format(balance),
              style: theme.textTheme.titleSmall,
            ),
            if (bill.amountPaid > 0)
              Text(
                'Paid ${currency.format(bill.amountPaid)}',
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

class _MatchingChip extends StatelessWidget {
  const _MatchingChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = isBlockingMatchStatus(status)
        ? Colors.red
        : isSuccessfulMatchStatus(status)
            ? Colors.green
            : Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        formatMatchingStatusLabel(status),
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 10,
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  Color _colorFor(String s) {
    switch (s) {
      case 'Paid':
        return Colors.green;
      case 'Partially Paid':
        return Colors.orange;
      case 'Overdue':
        return Colors.red;
      case 'Cancelled':
        return Colors.blueGrey;
      case 'Approved':
        return Colors.blue;
      case 'Unpaid':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _colorFor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status,
        style: TextStyle(
          fontSize: 11,
          color: color.shade700,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

extension on Color {
  Color get shade700 {
    final hsl = HSLColor.fromColor(this);
    return hsl.withLightness((hsl.lightness * 0.55).clamp(0.0, 1.0)).toColor();
  }
}
