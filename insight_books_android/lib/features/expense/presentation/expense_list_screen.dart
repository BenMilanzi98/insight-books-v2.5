import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../domain/expense_model.dart';
import 'providers/expense_provider.dart';

class ExpenseListScreen extends ConsumerStatefulWidget {
  const ExpenseListScreen({super.key});

  @override
  ConsumerState<ExpenseListScreen> createState() => _ExpenseListScreenState();
}

class _ExpenseListScreenState extends ConsumerState<ExpenseListScreen> {
  bool _isSelectMode = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(expenseControllerProvider.notifier).loadAll();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(expenseControllerProvider);
    final notifier = ref.read(expenseControllerProvider.notifier);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Expenses'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        backgroundColor: Theme.of(context).colorScheme.surface,
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        elevation: 0,
        actions: [
          const ThemeToggleButton(),
          if (state.expenses.isNotEmpty)
            IconButton(
              icon: Icon(_isSelectMode ? Icons.close : Icons.checklist),
              tooltip: _isSelectMode ? 'Cancel selection' : 'Select',
              onPressed: () {
                setState(() {
                  _isSelectMode = !_isSelectMode;
                  if (!_isSelectMode) ref.read(expenseControllerProvider.notifier).clearSelection();
                });
              },
            ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) async {
              if (value == 'export') {
                try {
                  final bytes = await notifier.exportCsv();
                  if (!context.mounted) return;
                  if (bytes.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('No data to export')),
                    );
                    return;
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text(
                            'Exported ${bytes.length} bytes. Save to file from share.')),
                  );
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Export failed: $e')),
                    );
                  }
                }
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'export',
                child: ListTile(
                  leading: Icon(Icons.download),
                  title: Text('Export CSV'),
                ),
              ),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => notifier.loadAll(),
        child: CustomScrollView(
          slivers: [
            if (state.statistics != null && !state.showDeleted)
              SliverToBoxAdapter(
                child: _StatisticsRow(statistics: state.statistics!),
              ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Search expenses…',
                    prefixIcon: const Icon(Icons.search),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    filled: true,
                    fillColor: theme.colorScheme.surfaceContainerLow,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  onChanged: notifier.setSearchQuery,
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _StatusChip(
                        label: 'All',
                        value: 'all',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Pending',
                        value: 'Pending',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Approved',
                        value: 'Approved',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Rejected',
                        value: 'Rejected',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                    ],
                  ),
                ),
              ),
            ),

            if (!state.showDeleted)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.calendar_today, size: 18),
                          label: Text(
                            state.dateFrom != null
                                ? '${state.dateFrom} – ${state.dateTo ?? "..."}'
                                : 'Date range',
                          ),
                          onPressed: () async {
                            final from = await showDatePicker(
                              context: context,
                              initialDate: state.dateFrom != null
                                  ? DateTime.tryParse(state.dateFrom!) ?? DateTime.now()
                                  : DateTime.now(),
                              firstDate: DateTime(2020),
                              lastDate: DateTime.now().add(const Duration(days: 365)),
                            );
                            if (from == null || !context.mounted) return;
                            final to = await showDatePicker(
                              context: context,
                              initialDate: state.dateTo != null
                                  ? DateTime.tryParse(state.dateTo!) ?? from
                                  : from,
                              firstDate: from,
                              lastDate: DateTime.now().add(const Duration(days: 365)),
                            );
                            if (!context.mounted) return;
                            notifier.setDateRange(
                              DateFormat('yyyy-MM-dd').format(from),
                              to != null ? DateFormat('yyyy-MM-dd').format(to) : null,
                            );
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: () {
                          notifier.setDateRange(null, null);
                        },
                        child: const Text('Clear'),
                      ),
                    ],
                  ),
                ),
              ),
            if (!state.showDeleted && state.categories.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: state.categoryFilter == 'all'
                              ? 'all'
                              : (state.categories
                                      .any((c) => c.id == state.categoryFilter)
                                  ? state.categoryFilter
                                  : 'all'),
                          decoration: InputDecoration(
                            labelText: 'Category',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                          ),
                          items: [
                            const DropdownMenuItem(
                              value: 'all',
                              child: Text('All categories'),
                            ),
                            ...state.categories.map((c) => DropdownMenuItem(
                                  value: c.id,
                                  child: Text(
                                    c.name,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                )),
                          ],
                          onChanged: (v) => notifier.setCategoryFilter(v ?? 'all'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Row(
                  children: [
                    Text(
                      'Show deleted',
                      style: theme.textTheme.bodyMedium,
                    ),
                    const SizedBox(width: 8),
                    Switch(
                      value: state.showDeleted,
                      onChanged: (v) => notifier.setShowDeleted(v),
                    ),
                  ],
                ),
              ),
            ),

            if (state.isLoading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null)
              SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.error_outline,
                          size: 48,
                          color: theme.colorScheme.error,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Failed to load expenses',
                          style: theme.textTheme.titleMedium,
                          textAlign: TextAlign.center,
                        ),
                        if (state.error != null && state.error!.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            state.error!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.outline,
                            ),
                            textAlign: TextAlign.center,
                            maxLines: 4,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        const SizedBox(height: 16),
                        FilledButton.tonalIcon(
                          onPressed: () => notifier.loadAll(),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else if (state.expenses.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.receipt_long_outlined,
                        size: 64,
                        color: theme.colorScheme.outline,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        state.showDeleted
                            ? 'No deleted expenses'
                            : 'No expenses found',
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        state.showDeleted
                            ? 'Deleted items will appear here'
                            : 'Add your first expense',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.outline,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                sliver: SliverList.separated(
                  itemCount: state.expenses.length + (state.totalPages > 1 ? 1 : 0) + (_isSelectMode && state.selectedExpenseIds.isNotEmpty ? 1 : 0),
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    if (index == state.expenses.length) {
                      if (_isSelectMode && state.selectedExpenseIds.isNotEmpty) {
                        return _BatchActionBar(
                          count: state.selectedExpenseIds.length,
                          showDeleted: state.showDeleted,
                          onDelete: () => _confirmBatchDelete(context, ref, state.selectedExpenseIds),
                          onRestore: state.showDeleted
                              ? () => _confirmBatchRestore(context, ref, state.selectedExpenseIds)
                              : null,
                          onSelectAll: () => notifier.selectAllExpenses(),
                        );
                      }
                      return _PaginationRow(
                        currentPage: state.currentPage,
                        totalPages: state.totalPages,
                        onPrev: () {
                          if (state.currentPage > 1) notifier.setPage(state.currentPage - 1);
                        },
                        onNext: () {
                          if (state.currentPage < state.totalPages) notifier.setPage(state.currentPage + 1);
                        },
                      );
                    }
                    if (index == state.expenses.length + 1) {
                      return _PaginationRow(
                        currentPage: state.currentPage,
                        totalPages: state.totalPages,
                        onPrev: () {
                          if (state.currentPage > 1) notifier.setPage(state.currentPage - 1);
                        },
                        onNext: () {
                          if (state.currentPage < state.totalPages) notifier.setPage(state.currentPage + 1);
                        },
                      );
                    }
                    final expense = state.expenses[index];
                    final isSelected = state.selectedExpenseIds.contains(expense.id);
                    return _ExpenseCard(
                      expense: expense,
                      showDeleted: state.showDeleted,
                      isSelectMode: _isSelectMode,
                      isSelected: isSelected,
                      onTap: () {
                        if (_isSelectMode) {
                          notifier.toggleExpenseSelection(expense.id);
                        } else {
                          context.push('/expenses/${expense.id}');
                        }
                      },
                      onToggleSelect: _isSelectMode ? () => notifier.toggleExpenseSelection(expense.id) : null,
                      onEdit: expense.isEditable && !_isSelectMode
                          ? () => context.push('/expenses/${expense.id}/edit')
                          : null,
                      onDelete: expense.isEditable && !_isSelectMode
                          ? () => _confirmDelete(context, ref, expense)
                          : null,
                      onRestore: state.showDeleted && !_isSelectMode
                          ? () => _confirmRestore(context, ref, expense)
                          : null,
                      onPartialPayment: expense.canAddPartialPayment && !_isSelectMode
                          ? () => _openPartialPayment(context, ref, expense)
                          : null,
                    );
                  },
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
      floatingActionButton: state.showDeleted
          ? null
          : FloatingActionButton.extended(
              onPressed: () => context.push('/expenses/create'),
              icon: const Icon(Icons.add),
              label: const Text('Add Expense'),
            ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    Expense expense,
  ) async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Expense'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Delete "${expense.description}"? You can restore it later from "Show deleted".',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      try {
        await ref.read(expenseControllerProvider.notifier).deleteExpense(
              expense.id,
              reason: reasonCtrl.text.isEmpty ? null : reasonCtrl.text,
            );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Expense deleted')),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete: $e')),
          );
        }
      }
    }
  }

  Future<void> _confirmRestore(
    BuildContext context,
    WidgetRef ref,
    Expense expense,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Restore Expense'),
        content: Text(
          'Restore "${expense.description}"?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Restore'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      try {
        await ref.read(expenseControllerProvider.notifier).restoreExpense(expense.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Expense restored')),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to restore: $e')),
          );
        }
      }
    }
  }

  Future<void> _confirmBatchDelete(
    BuildContext context,
    WidgetRef ref,
    List<String> ids,
  ) async {
    final reasonCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete expenses'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Delete ${ids.length} expense(s)? You can restore them later.'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      try {
        await ref.read(expenseControllerProvider.notifier).batchDeleteExpenses(
              ids,
              reason: reasonCtrl.text.isEmpty ? null : reasonCtrl.text,
            );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${ids.length} expense(s) deleted')),
          );
          setState(() => _isSelectMode = false);
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e')),
          );
        }
      }
    }
  }

  Future<void> _confirmBatchRestore(
    BuildContext context,
    WidgetRef ref,
    List<String> ids,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Restore expenses'),
        content: Text('Restore ${ids.length} expense(s)?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Restore')),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      try {
        await ref.read(expenseControllerProvider.notifier).batchRestoreExpenses(ids);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${ids.length} expense(s) restored')),
          );
          setState(() => _isSelectMode = false);
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e')),
          );
        }
      }
    }
  }

  void _openPartialPayment(BuildContext context, WidgetRef ref, Expense expense) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _PartialPaymentSheet(
        expense: expense,
        onSubmitted: () {
          Navigator.pop(ctx);
          ref.read(expenseControllerProvider.notifier).loadAll();
        },
      ),
    );
  }
}

class _StatisticsRow extends StatelessWidget {
  final ExpenseStatistics statistics;

  const _StatisticsRow({required this.statistics});

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.compactCurrency(symbol: 'MK ', decimalDigits: 0);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          _StatCard(
            label: 'Total',
            count: statistics.total.count,
            amount: formatter.format(statistics.total.amount),
            color: Colors.blue,
            icon: Icons.list_alt,
          ),
          const SizedBox(width: 10),
          _StatCard(
            label: 'Approved',
            count: statistics.approved.count,
            amount: formatter.format(statistics.approved.amount),
            color: Colors.green,
            icon: Icons.check_circle_outline,
          ),
          const SizedBox(width: 10),
          _StatCard(
            label: 'Pending',
            count: statistics.pending.count,
            amount: formatter.format(statistics.pending.amount),
            color: Colors.orange,
            icon: Icons.schedule,
          ),
          const SizedBox(width: 10),
          _StatCard(
            label: 'Rejected',
            count: statistics.rejected.count,
            amount: formatter.format(statistics.rejected.amount),
            color: Colors.red,
            icon: Icons.cancel_outlined,
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int count;
  final String amount;
  final Color color;
  final IconData icon;

  const _StatCard({
    required this.label,
    required this.count,
    required this.amount,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: color.withValues(alpha: 0.3)),
      ),
      color: color.withValues(alpha: 0.06),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              amount,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            Text(
              '$count expense${count == 1 ? '' : 's'}',
              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final String value;
  final String current;
  final ValueChanged<String> onTap;

  const _StatusChip({
    required this.label,
    required this.value,
    required this.current,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final selected = current == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(value),
        showCheckmark: false,
      ),
    );
  }
}

class _BatchActionBar extends StatelessWidget {
  final int count;
  final bool showDeleted;
  final VoidCallback onDelete;
  final VoidCallback? onRestore;
  final VoidCallback onSelectAll;

  const _BatchActionBar({
    required this.count,
    required this.showDeleted,
    required this.onDelete,
    this.onRestore,
    required this.onSelectAll,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Text('$count selected', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(width: 12),
            TextButton(onPressed: onSelectAll, child: const Text('Select all')),
            const Spacer(),
            FilledButton.tonal(
              onPressed: onDelete,
              child: const Text('Delete'),
            ),
            if (showDeleted && onRestore != null) ...[
              const SizedBox(width: 8),
              FilledButton.tonal(onPressed: onRestore, child: const Text('Restore')),
            ],
          ],
        ),
      ),
    );
  }
}

class _ExpenseCard extends StatelessWidget {
  final Expense expense;
  final bool showDeleted;
  final bool isSelectMode;
  final bool isSelected;
  final VoidCallback onTap;
  final VoidCallback? onToggleSelect;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onRestore;
  final VoidCallback? onPartialPayment;

  const _ExpenseCard({
    required this.expense,
    required this.showDeleted,
    this.isSelectMode = false,
    this.isSelected = false,
    required this.onTap,
    this.onToggleSelect,
    this.onEdit,
    this.onDelete,
    this.onRestore,
    this.onPartialPayment,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currencyFormat = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);
    final statusColor = _expenseStatusColor(expense.status);
    final paymentColor = _paymentStatusColor(expense.paymentStatus);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.4),
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (isSelectMode)
                    Padding(
                      padding: const EdgeInsets.only(right: 10),
                      child: Checkbox(
                        value: isSelected,
                        onChanged: (_) => onToggleSelect?.call(),
                      ),
                    ),
                  Expanded(
                    child: Text(
                      expense.description,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      expense.status,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.category_outlined, size: 14, color: theme.colorScheme.outline),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      expense.category,
                      style: theme.textTheme.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    expense.date,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Text(
                    currencyFormat.format(expense.amount),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (expense.paymentStatus != 'Fully paid') ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: paymentColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        expense.paymentStatus,
                        style: TextStyle(fontSize: 10, color: paymentColor),
                      ),
                    ),
                  ],
                ],
              ),
              if (onEdit != null || onDelete != null || onRestore != null || onPartialPayment != null) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    if (onEdit != null)
                      TextButton.icon(
                        onPressed: onEdit,
                        icon: const Icon(Icons.edit_outlined, size: 18),
                        label: const Text('Edit'),
                      ),
                    if (onPartialPayment != null)
                      TextButton.icon(
                        onPressed: onPartialPayment,
                        icon: const Icon(Icons.payment, size: 18),
                        label: const Text('Pay'),
                      ),
                    if (onDelete != null)
                      TextButton.icon(
                        onPressed: onDelete,
                        icon: Icon(Icons.delete_outline, size: 18, color: theme.colorScheme.error),
                        label: Text('Delete', style: TextStyle(color: theme.colorScheme.error)),
                      ),
                    if (onRestore != null)
                      TextButton.icon(
                        onPressed: onRestore,
                        icon: const Icon(Icons.restore, size: 18),
                        label: const Text('Restore'),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _expenseStatusColor(String status) {
    switch (status) {
      case 'Approved':
        return Colors.green;
      case 'Pending':
        return Colors.orange;
      case 'Rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  Color _paymentStatusColor(String status) {
    switch (status) {
      case 'Fully paid':
        return Colors.green;
      case 'Partially':
        return Colors.blue;
      case 'Pending':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }
}

class _PaginationRow extends StatelessWidget {
  final int currentPage;
  final int totalPages;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  const _PaginationRow({
    required this.currentPage,
    required this.totalPages,
    required this.onPrev,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            onPressed: currentPage > 1 ? onPrev : null,
            icon: const Icon(Icons.chevron_left),
          ),
          Text('Page $currentPage of $totalPages'),
          IconButton(
            onPressed: currentPage < totalPages ? onNext : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

class _PartialPaymentSheet extends ConsumerStatefulWidget {
  final Expense expense;
  final VoidCallback onSubmitted;

  const _PartialPaymentSheet({
    required this.expense,
    required this.onSubmitted,
  });

  @override
  ConsumerState<_PartialPaymentSheet> createState() => _PartialPaymentSheetState();
}

class _PartialPaymentSheetState extends ConsumerState<_PartialPaymentSheet> {
  final _amountCtrl = TextEditingController();
  final _paymentMethodCtrl = TextEditingController(text: 'Cash');
  final _referenceCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  DateTime _paymentDate = DateTime.now();
  bool _submitting = false;

  @override
  void dispose() {
    _amountCtrl.dispose();
    _paymentMethodCtrl.dispose();
    _referenceCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final remaining = widget.expense.amount - widget.expense.paidAmount;

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Add payment',
              style: theme.textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Remaining: MK ${remaining.toStringAsFixed(2)}',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountCtrl,
              decoration: const InputDecoration(
                labelText: 'Amount',
                border: OutlineInputBorder(),
                prefixText: 'MK ',
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _paymentMethodCtrl,
              decoration: const InputDecoration(
                labelText: 'Payment method',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            ListTile(
              title: const Text('Payment date'),
              subtitle: Text(DateFormat.yMd().format(_paymentDate)),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: _paymentDate,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (date != null) setState(() => _paymentDate = date);
              },
            ),
            TextField(
              controller: _referenceCtrl,
              decoration: const InputDecoration(
                labelText: 'Reference (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              decoration: const InputDecoration(
                labelText: 'Notes (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Add payment'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', ''));
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid amount')),
      );
      return;
    }
    if (amount > (widget.expense.amount - widget.expense.paidAmount)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Amount exceeds remaining balance')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(expenseControllerProvider.notifier).addPartialPayment(
            AddPartialPaymentRequest(
              expenseId: widget.expense.id,
              amount: amount,
              paymentMethod: _paymentMethodCtrl.text.trim().isEmpty
                  ? 'Cash'
                  : _paymentMethodCtrl.text.trim(),
              paymentDate: DateFormat('yyyy-MM-dd').format(_paymentDate),
              reference: _referenceCtrl.text.trim().isEmpty
                  ? null
                  : _referenceCtrl.text.trim(),
              notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
            ),
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment added')),
        );
        widget.onSubmitted();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
