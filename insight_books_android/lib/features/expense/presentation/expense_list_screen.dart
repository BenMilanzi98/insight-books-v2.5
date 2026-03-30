import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:file_picker/file_picker.dart';
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
    if (!state.canViewExpenses) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Expenses')),
        body: const Center(
          child: Text('You do not have permission to view this page.'),
        ),
      );
    }

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
                if (!state.canExportExpenses) return;
                try {
                  final bytes = await notifier.exportCsv();
                  if (!context.mounted) return;
                  if (bytes.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('No data to export')),
                    );
                    return;
                  }
                  final dir = await getTemporaryDirectory();
                  final file = File('${dir.path}/expenses_export.csv');
                  await file.writeAsBytes(bytes);
                  await SharePlus.instance.share(
                    ShareParams(files: [XFile(file.path)]),
                  );
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Export failed: $e')),
                    );
                  }
                }
              } else if (value == 'recurring') {
                _showRecurringSheet(context, ref);
              } else if (value == 'cogs') {
                _showCogsSheet(context, ref);
              } else if (value == 'historical') {
                _showHistoricalImportSheet(context, ref);
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
              if (state.canViewExpenses)
                const PopupMenuItem(
                  value: 'recurring',
                  child: ListTile(
                    leading: Icon(Icons.repeat),
                    title: Text('Recurring Expenses'),
                  ),
                ),
              if (state.canViewExpenses)
                const PopupMenuItem(
                  value: 'cogs',
                  child: ListTile(
                    leading: Icon(Icons.inventory),
                    title: Text('COGS'),
                  ),
                ),
              if (state.canUpdateExpenses)
                const PopupMenuItem(
                  value: 'historical',
                  child: ListTile(
                    leading: Icon(Icons.upload_file),
                    title: Text('Historical Import'),
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
                          && state.canUpdateExpenses
                          ? () => context.push('/expenses/${expense.id}/edit')
                          : null,
                      onDelete: expense.isEditable && !_isSelectMode
                          && state.canDeleteExpenses
                          ? () => _confirmDelete(context, ref, expense)
                          : null,
                      onRestore: state.showDeleted && !_isSelectMode
                          ? () => _confirmRestore(context, ref, expense)
                          : null,
                      onPartialPayment: expense.canAddPartialPayment && !_isSelectMode
                          ? () => _openPartialPayment(context, ref, expense)
                          : null,
                      onApprove: expense.status != 'Approved' &&
                              !_isSelectMode &&
                              state.canApproveExpenses
                          ? () async {
                              await notifier.updateExpense(
                                expense.id,
                                const UpdateExpenseRequest(status: 'Approved'),
                              );
                            }
                          : null,
                      onReject: expense.status != 'Rejected' &&
                              !_isSelectMode &&
                              state.canApproveExpenses
                          ? () async {
                              await notifier.updateExpense(
                                expense.id,
                                const UpdateExpenseRequest(status: 'Rejected'),
                              );
                            }
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
              onPressed: state.canCreateExpenses
                  ? () => context.push('/expenses/create')
                  : null,
              icon: const Icon(Icons.add),
              label: const Text('Add Expense'),
            ),
    );
  }

  Future<void> _showRecurringSheet(BuildContext context, WidgetRef ref) async {
    final notifier = ref.read(expenseControllerProvider.notifier);
    await notifier.loadRecurringExpenses();
    if (!context.mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        final screenState = ref.read(expenseControllerProvider);
        final rows = screenState.recurringExpenses;
        final maxH = MediaQuery.sizeOf(ctx).height * 0.55;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Text('Recurring Expenses', style: TextStyle(fontWeight: FontWeight.bold)),
                    const Spacer(),
                    IconButton(
                      tooltip: 'Export recurring CSV',
                      icon: const Icon(Icons.download_outlined),
                      onPressed: rows.isEmpty ? null : () => _exportRecurringCsv(rows),
                    ),
                    if (screenState.canUpdateExpenses)
                      IconButton(
                        icon: const Icon(Icons.add),
                        onPressed: () async {
                          await _showCreateRecurringDialog(context, ref);
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: maxH,
                  width: double.infinity,
                  child: rows.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Text('No recurring expenses'),
                          ),
                        )
                      : ListView.builder(
                          itemCount: rows.length,
                          itemBuilder: (_, i) {
                            final r = rows[i];
                            return ListTile(
                              title: Text((r['description'] ?? 'Recurring').toString()),
                              subtitle: Text('${r['frequency'] ?? 'monthly'} · MK ${r['amount'] ?? 0}'),
                              onTap: () => _showRecurringDetailsSheet(context, ref, r),
                              trailing: Wrap(
                                spacing: 4,
                                children: [
                                  if (screenState.canUpdateExpenses)
                                    IconButton(
                                      icon: const Icon(Icons.edit_outlined),
                                      onPressed: () async {
                                        await _showEditRecurringDialog(context, ref, r);
                                      },
                                    ),
                                  if (screenState.canDeleteExpenses)
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline),
                                      onPressed: () async {
                                        await notifier.deleteRecurringExpense((r['id'] ?? '').toString());
                                      },
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showCreateRecurringDialog(BuildContext context, WidgetRef ref) async {
    final descriptionCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    String frequency = 'monthly';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Create Recurring Expense'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: descriptionCtrl,
                decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder(), prefixText: 'MK '),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: frequency,
                decoration: const InputDecoration(labelText: 'Frequency', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'weekly', child: Text('Weekly')),
                  DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                  DropdownMenuItem(value: 'quarterly', child: Text('Quarterly')),
                  DropdownMenuItem(value: 'yearly', child: Text('Yearly')),
                ],
                onChanged: (v) => setDialogState(() => frequency = v ?? 'monthly'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
          ],
        ),
      ),
    );
    if (ok == true) {
      await ref.read(expenseControllerProvider.notifier).createRecurringExpense({
        'description': descriptionCtrl.text.trim(),
        'amount': double.tryParse(amountCtrl.text.trim()) ?? 0,
        'frequency': frequency,
      });
    }
    descriptionCtrl.dispose();
    amountCtrl.dispose();
  }

  Future<void> _showCogsSheet(BuildContext context, WidgetRef ref) async {
    final notifier = ref.read(expenseControllerProvider.notifier);
    await notifier.loadCogsData();
    if (!context.mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetCtx) {
        final s = ref.read(expenseControllerProvider);
        final summary = s.cogsSummary ?? const <String, dynamic>{};
        final settlements = s.cogsSettlements;
        final maxH = MediaQuery.sizeOf(sheetCtx).height * 0.5;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('COGS', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ListTile(
                  title: const Text('Total COGS'),
                  trailing: Text('MK ${summary['total'] ?? 0}'),
                ),
                const Divider(),
                SizedBox(
                  height: maxH,
                  width: double.infinity,
                  child: settlements.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Text('No settlements'),
                          ),
                        )
                      : ListView.builder(
                          itemCount: settlements.length,
                          itemBuilder: (_, i) {
                            final row = settlements[i];
                            return ListTile(
                              title: Text((row['description'] ?? 'Settlement').toString()),
                              subtitle: Text('${row['date'] ?? ''}'),
                              trailing: Wrap(
                                spacing: 4,
                                children: [
                                  Text('MK ${row['amount'] ?? 0}'),
                                  if (s.canUpdateExpenses)
                                    PopupMenuButton<String>(
                                      onSelected: (v) async {
                                        if (v == 'reverse_gl') {
                                          await _reverseCogsEntry(context, ref, row, saleMode: false);
                                          return;
                                        }
                                        if (v == 'reverse_sale') {
                                          if (!context.mounted) return;
                                          await _reverseCogsEntry(context, ref, row, saleMode: true);
                                        }
                                      },
                                      itemBuilder: (_) => const [
                                        PopupMenuItem(
                                          value: 'reverse_gl',
                                          child: Text('Reverse COGS GL'),
                                        ),
                                        PopupMenuItem(
                                          value: 'reverse_sale',
                                          child: Text('Reverse Linked Sale'),
                                        ),
                                      ],
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
                const SizedBox(height: 8),
                if (s.canCreateExpenses)
                  FilledButton.icon(
                    onPressed: () => _showCogsSettlementCreateDialog(context, ref, summary),
                    icon: const Icon(Icons.add),
                    label: const Text('Record Settlement'),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showHistoricalImportSheet(BuildContext context, WidgetRef ref) async {
    final batchCtrl = TextEditingController();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Historical Expense Import', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              controller: batchCtrl,
              decoration: const InputDecoration(
                labelText: 'Batch Name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: !ref.read(expenseControllerProvider).canExportExpenses
                  ? null
                  : () async {
                final bytes = await ref.read(expenseControllerProvider.notifier).downloadHistoricalTemplate();
                final dir = await getTemporaryDirectory();
                final file = File('${dir.path}/historical-expenses-template.csv');
                await file.writeAsBytes(bytes);
                await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
              },
              icon: const Icon(Icons.download_outlined),
              label: const Text('Download Template'),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: !ref.read(expenseControllerProvider).canUpdateExpenses
                  ? null
                  : () async {
                final picked = await FilePicker.platform.pickFiles();
                if (picked == null || picked.files.single.path == null) return;
                await ref.read(expenseControllerProvider.notifier).uploadHistoricalExpenses(
                      batchName: batchCtrl.text.trim().isEmpty ? 'Batch' : batchCtrl.text.trim(),
                      filePath: picked.files.single.path!,
                    );
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(ref.read(expenseControllerProvider).historicalUploadMessage ?? 'Uploaded')),
                );
              },
              icon: const Icon(Icons.upload_file),
              label: const Text('Upload CSV'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: !ref.read(expenseControllerProvider).canCreateExpenses
                  ? null
                  : () async {
                Navigator.pop(ctx);
                await _showSingleHistoricalExpenseDialog(context, ref, batchCtrl.text.trim());
              },
              icon: const Icon(Icons.note_add_outlined),
              label: const Text('Add Single Historical Expense'),
            ),
          ],
        ),
      ),
    );
    batchCtrl.dispose();
  }

  Future<void> _exportRecurringCsv(List<Map<String, dynamic>> rows) async {
    final headers = ['id', 'description', 'amount', 'frequency', 'status', 'nextRunDate'];
    final lines = <String>[
      headers.join(','),
      ...rows.map((r) {
        String cell(dynamic v) => '"${(v ?? '').toString().replaceAll('"', '""')}"';
        return [
          cell(r['id']),
          cell(r['description']),
          cell(r['amount']),
          cell(r['frequency']),
          cell(r['status']),
          cell(r['nextRunDate']),
        ].join(',');
      }),
    ];
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/recurring_expenses_export.csv');
    await file.writeAsString(lines.join('\n'));
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
  }

  Future<void> _showSingleHistoricalExpenseDialog(
    BuildContext context,
    WidgetRef ref,
    String batchName,
  ) async {
    final descCtrl = TextEditingController();
    final amtCtrl = TextEditingController();
    DateTime date = DateTime.now();
    final state = ref.read(expenseControllerProvider);
    ExpenseCategoryOption? category = state.categories.isNotEmpty ? state.categories.first : null;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (_, setModal) => AlertDialog(
          title: const Text('Single Historical Expense'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: descCtrl,
                decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: amtCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder(), prefixText: 'MK '),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<ExpenseCategoryOption>(
                initialValue: category,
                items: state.categories
                    .map((c) => DropdownMenuItem(value: c, child: Text(c.name, overflow: TextOverflow.ellipsis)))
                    .toList(),
                onChanged: (v) => setModal(() => category = v),
                decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(DateFormat.yMd().format(date)),
                trailing: const Icon(Icons.calendar_today),
                onTap: () async {
                  final d = await showDatePicker(
                    context: ctx,
                    initialDate: date,
                    firstDate: DateTime(2010),
                    lastDate: DateTime.now(),
                  );
                  if (d != null) setModal(() => date = d);
                },
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
          ],
        ),
      ),
    );
    if (ok == true && category != null) {
      await ref.read(expenseControllerProvider.notifier).createExpense(
            CreateExpenseRequest(
              description: descCtrl.text.trim(),
              amount: double.tryParse(amtCtrl.text.trim()) ?? 0,
              date: DateFormat('yyyy-MM-dd').format(date),
              expenseAccountId: category!.id,
              category: category!.name,
              status: 'Approved',
              notes: 'Historical entry${batchName.isNotEmpty ? ' · Batch: $batchName' : ''}',
              isHistorical: true,
              migrationBatch: batchName.isNotEmpty ? batchName : null,
            ),
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Historical expense created')),
        );
      }
    }
  }

  Future<void> _reverseCogsEntry(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> row, {
    required bool saleMode,
  }) async {
    final reasonCtrl = TextEditingController(text: 'COGS reversal from expenses module');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(saleMode ? 'Reverse Linked Sale' : 'Reverse COGS GL'),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(labelText: 'Reason', border: OutlineInputBorder()),
          minLines: 2,
          maxLines: 4,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Reverse')),
        ],
      ),
    );
    if (ok != true) return;
    final txnId = saleMode ? (row['saleId'] ?? row['transactionId']) : (row['transactionId'] ?? row['saleId']);
    final id = (txnId ?? '').toString();
    if (id.isEmpty) return;
    await ref.read(expenseControllerProvider.notifier).reverseTransaction(
          transactionId: id,
          transactionType: saleMode ? 'Sale' : 'Transaction',
          reason: reasonCtrl.text.trim().isEmpty ? 'Manual reversal' : reasonCtrl.text.trim(),
        );
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(saleMode ? 'Linked sale reversed' : 'COGS journal reversed')),
      );
    }
  }

  Future<void> _showRecurringDetailsSheet(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> recurring,
  ) async {
    final id = (recurring['id'] ?? '').toString();
    if (id.isEmpty) return;
    final details = await ref.read(expenseControllerProvider.notifier).getRecurringExpense(id);
    if (!context.mounted) return;
    final history = (details['history'] as List?) ?? const [];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetCtx) {
        final maxH = MediaQuery.sizeOf(sheetCtx).height * 0.45;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (details['description'] ?? recurring['description'] ?? 'Recurring Expense').toString(),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text('Amount: MK ${(details['amount'] ?? recurring['amount'] ?? 0)}'),
                Text('Frequency: ${(details['frequency'] ?? recurring['frequency'] ?? 'monthly')}'),
                Text('Start: ${(details['startDate'] ?? '-')}'),
                Text('End: ${(details['endDate'] ?? '-')}'),
                const SizedBox(height: 12),
                const Text('History', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                SizedBox(
                  height: maxH,
                  width: double.infinity,
                  child: history.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(12),
                            child: Text('No execution history available'),
                          ),
                        )
                      : ListView.builder(
                          itemCount: history.length,
                          itemBuilder: (_, i) {
                            final h = history[i] as Map;
                            return ListTile(
                              title: Text((h['date'] ?? h['createdAt'] ?? '').toString()),
                              subtitle: Text((h['status'] ?? '').toString()),
                              trailing: Text('MK ${h['amount'] ?? 0}'),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showEditRecurringDialog(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> recurring,
  ) async {
    final id = (recurring['id'] ?? '').toString();
    if (id.isEmpty) return;
    final descriptionCtrl = TextEditingController(
      text: (recurring['description'] ?? '').toString(),
    );
    final amountCtrl = TextEditingController(
      text: (recurring['amount'] ?? '').toString(),
    );
    String frequency = (recurring['frequency'] ?? 'monthly').toString();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Edit Recurring Expense'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: descriptionCtrl,
                decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder(), prefixText: 'MK '),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: frequency,
                decoration: const InputDecoration(labelText: 'Frequency', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'weekly', child: Text('Weekly')),
                  DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                  DropdownMenuItem(value: 'quarterly', child: Text('Quarterly')),
                  DropdownMenuItem(value: 'yearly', child: Text('Yearly')),
                ],
                onChanged: (v) => setDialogState(() => frequency = v ?? 'monthly'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Update')),
          ],
        ),
      ),
    );
    if (ok == true) {
      await ref.read(expenseControllerProvider.notifier).updateRecurringExpense(id, {
        'description': descriptionCtrl.text.trim(),
        'amount': double.tryParse(amountCtrl.text.trim()) ?? 0,
        'frequency': frequency,
      });
    }
    descriptionCtrl.dispose();
    amountCtrl.dispose();
  }

  Future<void> _showCogsSettlementCreateDialog(
    BuildContext context,
    WidgetRef ref,
    Map<String, dynamic> summary,
  ) async {
    final amountCtrl = TextEditingController(text: '${summary['total'] ?? 0}');
    final descriptionCtrl = TextEditingController(
      text: 'Total COGS Settlement - MK ${summary['total'] ?? 0}',
    );
    final notesCtrl = TextEditingController();
    DateTime date = DateTime.now();
    final paymentAccounts = ref.read(expenseControllerProvider).paymentAccounts;
    String? paymentMethod = paymentAccounts.isNotEmpty ? paymentAccounts.first.id : null;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Record COGS Settlement'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder(), prefixText: 'MK '),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: descriptionCtrl,
                  decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: paymentMethod,
                  decoration: const InputDecoration(labelText: 'Payment Method', border: OutlineInputBorder()),
                  items: paymentAccounts
                      .map((a) => DropdownMenuItem<String>(
                            value: a.id,
                            child: Text('${a.name}${a.accountType != null ? ' (${a.accountType})' : ''}'),
                          ))
                      .toList(),
                  onChanged: (v) => setDialogState(() => paymentMethod = v),
                ),
                const SizedBox(height: 8),
                ListTile(
                  title: const Text('Settlement Date'),
                  subtitle: Text(DateFormat('yyyy-MM-dd').format(date)),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: date,
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) {
                      setDialogState(() => date = picked);
                    }
                  },
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder()),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Record')),
          ],
        ),
      ),
    );
    if (ok == true) {
      await ref.read(expenseControllerProvider.notifier).createCogsSettlement({
        'amount': double.tryParse(amountCtrl.text.trim()) ?? 0,
        'description': descriptionCtrl.text.trim(),
        'date': DateFormat('yyyy-MM-dd').format(date),
        'paymentMethod': paymentMethod,
        'notes': notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
      });
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('COGS settlement recorded')),
      );
    }
    amountCtrl.dispose();
    descriptionCtrl.dispose();
    notesCtrl.dispose();
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
  final VoidCallback? onApprove;
  final VoidCallback? onReject;

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
    this.onApprove,
    this.onReject,
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          currencyFormat.format(expense.totalPayable),
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (expense.taxAmount > 0)
                          Text(
                            'Base ${currencyFormat.format(expense.amount)} + tax ${currencyFormat.format(expense.taxAmount)}',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.outline,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
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
              if (onEdit != null || onDelete != null || onRestore != null || onPartialPayment != null || onApprove != null || onReject != null) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    if (onApprove != null)
                      TextButton.icon(
                        onPressed: onApprove,
                        icon: const Icon(Icons.check_circle_outline, size: 18),
                        label: const Text('Approve'),
                      ),
                    if (onReject != null)
                      TextButton.icon(
                        onPressed: onReject,
                        icon: const Icon(Icons.cancel_outlined, size: 18),
                        label: const Text('Reject'),
                      ),
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
    final remaining = widget.expense.remainingBalance;

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
    if (amount > widget.expense.remainingBalance + 1e-9) {
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
