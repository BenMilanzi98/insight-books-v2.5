import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import '../../pos/data/pos_repository.dart';
import '../../pos/domain/pos_models.dart';
import '../domain/quotation_model.dart';
import '../data/quotation_repository.dart';
import 'providers/quotation_provider.dart';

class QuotationListScreen extends ConsumerStatefulWidget {
  const QuotationListScreen({super.key});

  @override
  ConsumerState<QuotationListScreen> createState() => _QuotationListScreenState();
}

class _QuotationListScreenState extends ConsumerState<QuotationListScreen> {
  final _searchController = TextEditingController();
  List<PosClient> _clients = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadClients();
      ref.read(quotationControllerProvider.notifier).loadAll();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadClients() async {
    try {
      final clients = await ref.read(posRepositoryProvider).fetchClients();
      if (!mounted) return;
      setState(() {
        _clients = clients;
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(quotationControllerProvider);
    final notifier = ref.read(quotationControllerProvider.notifier);
    final theme = Theme.of(context);

    if (!state.canViewQuotations) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quotations')),
        body: const Center(
          child: Text('You do not have permission to view this page.'),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Quotations'),
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
          IconButton(
            icon: const Icon(Icons.sort),
            tooltip: 'Sort',
            onPressed: () => _showSortSheet(context, state, notifier),
          ),
          IconButton(
            icon: Badge(
              isLabelVisible:
                  state.dateFrom != null ||
                  state.dateTo != null ||
                  state.clientFilter != null,
              child: const Icon(Icons.filter_list),
            ),
            tooltip: 'Filter',
            onPressed: () => _showFilterSheet(context, state, notifier),
          ),
          IconButton(
            icon: const Icon(Icons.file_download_outlined),
            tooltip: 'Export CSV',
            onPressed: state.canExportQuotations ? () => notifier.exportCsv() : null,
          ),
          const ThemeToggleButton(),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => notifier.loadAll(),
        child: CustomScrollView(
          slivers: [
            if (state.statistics != null)
              SliverToBoxAdapter(
                child: _StatisticsRow(statistics: state.statistics!),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search by quotation number or client...',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {});
                              notifier.setSearchQuery('');
                            },
                          )
                        : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    filled: true,
                    fillColor: theme.colorScheme.surfaceContainerLow,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  onChanged: (value) {
                    setState(() {});
                    notifier.setSearchQuery(value);
                  },
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
                        value: 'pending',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Approved',
                        value: 'approved',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Drafts',
                        value: 'draft',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Converted',
                        value: 'converted',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                      _StatusChip(
                        label: 'Expired',
                        value: 'expired',
                        current: state.statusFilter,
                        onTap: notifier.setStatusFilter,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (state.dateFrom != null ||
                state.dateTo != null ||
                state.clientFilter != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                  child: Row(
                    children: [
                      Icon(
                        Icons.filter_alt,
                        size: 16,
                        color: theme.colorScheme.primary,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          [
                            if (state.dateFrom != null || state.dateTo != null)
                              'Date: ${state.dateFrom ?? '...'} -> ${state.dateTo ?? '...'}',
                            if (state.clientFilter != null) 'Client filtered',
                          ].join(' · '),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.primary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      TextButton(
                        onPressed: notifier.resetAdvancedFilters,
                        child: const Text('Clear'),
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
                        'Failed to load quotations',
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      FilledButton.tonalIcon(
                        onPressed: () => notifier.fetchQuotations(),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              )
            else if (state.quotations.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.description_outlined,
                        size: 64,
                        color: theme.colorScheme.outline,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'No quotations found',
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Create your first quotation',
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
                  itemCount: state.quotations.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final q = state.quotations[index];
                    return _QuotationCard(
                      quotation: q,
                      onTap: () => context.push('/quotation/${q.id}'),
                      onEdit: q.status != 'Converted'
                          && state.canUpdateQuotations
                          ? () => context.push('/quotation/${q.id}/edit')
                          : null,
                      onDuplicate: q.status != 'Converted'
                          && state.canCreateQuotations
                          ? () async {
                              try {
                                final duplicated = await notifier.duplicateQuotation(
                                  q.id,
                                );
                                if (!context.mounted || duplicated == null) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Quotation duplicated')),
                                );
                              } catch (e) {
                                if (!context.mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Duplicate failed: $e')),
                                );
                              }
                            }
                          : null,
                      onSend: q.status != 'Converted'
                          && state.canSendQuotations
                          ? () => _showSendDialog(context, q)
                          : null,
                      onConvert: q.status == 'Approved'
                          && state.canConvertQuotations
                          ? () => _showConvertDialog(context, q)
                          : null,
                      onDelete: (q.status == 'Draft')
                          && state.canDeleteQuotations
                          ? () => _confirmDelete(context, ref, q)
                          : null,
                    );
                  },
                ),
              ),
            if (!state.isLoading &&
                state.quotations.isNotEmpty &&
                state.totalPages > 1)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    alignment: WrapAlignment.center,
                    children: [
                      IconButton(
                        onPressed: state.currentPage > 1
                            ? () => notifier.setPage(state.currentPage - 1)
                            : null,
                        icon: const Icon(Icons.chevron_left),
                      ),
                      Text(
                        'Page ${state.currentPage} of ${state.totalPages}',
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(width: 8),
                      DropdownButton<int>(
                        value: state.limit,
                        items: const [10, 20, 50, 100]
                            .map(
                              (e) => DropdownMenuItem<int>(
                                value: e,
                                child: Text('$e / page'),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value != null) notifier.setLimit(value);
                        },
                      ),
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: state.canCreateQuotations ? () => context.push('/quotation/create') : null,
        icon: const Icon(Icons.add),
        label: const Text('New Quotation'),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    Quotation quotation,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Quotation'),
        content: Text(
          'Delete quotation ${quotation.quotationNumber}? This cannot be undone.',
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
        await ref
            .read(quotationControllerProvider.notifier)
            .deleteQuotation(quotation.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Quotation deleted')),
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

  Future<void> _showSendDialog(BuildContext context, Quotation quotation) async {
    final messageCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send Quotation'),
        content: TextField(
          controller: messageCtrl,
          decoration: const InputDecoration(
            labelText: 'Message (optional)',
            border: OutlineInputBorder(),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Send'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      try {
        await ref
            .read(quotationRepositoryProvider)
            .sendQuotation(quotation.id, message: messageCtrl.text.trim());
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Quotation sent')),
        );
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Send failed: $e')),
        );
      }
    }
  }

  Future<void> _showConvertDialog(BuildContext context, Quotation quotation) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Convert to Invoice'),
        content: Text(
          'Convert quotation ${quotation.quotationNumber} to an invoice?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Convert'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      try {
        final result = await ref
            .read(quotationRepositoryProvider)
            .convertToInvoice(quotation.id);
        await ref.read(quotationControllerProvider.notifier).loadAll();
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Converted to ${result.invoiceNumber}')),
        );
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Convert failed: $e')),
        );
      }
    }
  }

  void _showSortSheet(
    BuildContext context,
    QuotationPageState state,
    QuotationController controller,
  ) {
    final sortOptions = {
      'date': 'Date',
      'validUntil': 'Valid Until',
      'amount': 'Amount',
      'clientName': 'Client',
    };
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 2),
                child: Row(
                  children: [
                    Text(
                      'Sort Quotations',
                      style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      state.sortOrder == 'asc' ? 'Ascending' : 'Descending',
                      style: Theme.of(ctx).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Divider(),
              ...sortOptions.entries.map(
                (entry) => ListTile(
                  title: Text(entry.value),
                  trailing: state.sortBy == entry.key
                      ? Text(state.sortOrder == 'asc' ? '↑' : '↓')
                      : null,
                  onTap: () {
                    controller.setSortBy(entry.key);
                    Navigator.pop(ctx);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showFilterSheet(
    BuildContext context,
    QuotationPageState state,
    QuotationController controller,
  ) {
    DateTime? fromDate = state.dateFrom != null
        ? DateTime.tryParse(state.dateFrom!)
        : null;
    DateTime? toDate = state.dateTo != null ? DateTime.tryParse(state.dateTo!) : null;
    String? selectedClientId = state.clientFilter;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(
                      'Filter Quotations',
                      style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () {
                        controller.resetAdvancedFilters();
                        Navigator.pop(ctx);
                      },
                      child: const Text('Reset All'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final picked = await showDatePicker(
                            context: ctx,
                            initialDate: fromDate ?? DateTime.now(),
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now(),
                          );
                          if (picked != null) setSheetState(() => fromDate = picked);
                        },
                        child: Text(
                          fromDate != null
                              ? DateFormat('MMM d, y').format(fromDate!)
                              : 'From',
                        ),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Text('→'),
                    ),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final picked = await showDatePicker(
                            context: ctx,
                            initialDate: toDate ?? DateTime.now(),
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) setSheetState(() => toDate = picked);
                        },
                        child: Text(
                          toDate != null
                              ? DateFormat('MMM d, y').format(toDate!)
                              : 'To',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String?>(
                  initialValue: selectedClientId,
                  decoration: const InputDecoration(
                    labelText: 'Client',
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('All Clients'),
                    ),
                    ..._clients.map(
                      (c) => DropdownMenuItem<String?>(
                        value: c.id,
                        child: Text(c.name),
                      ),
                    ),
                  ],
                  onChanged: (value) => setSheetState(() => selectedClientId = value),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      controller.setDateRange(
                        fromDate?.toIso8601String().split('T').first,
                        toDate?.toIso8601String().split('T').first,
                      );
                      controller.setClientFilter(selectedClientId);
                      Navigator.pop(ctx);
                    },
                    child: const Text('Apply'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatisticsRow extends StatelessWidget {
  final QuotationStatistics statistics;

  const _StatisticsRow({required this.statistics});

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.compactCurrency(
      symbol: 'MK ',
      decimalDigits: 0,
    );
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          _StatCard(
            label: 'Pending',
            count: statistics.pending.count,
            amount: formatter.format(statistics.pending.total),
            color: Colors.orange,
            icon: Icons.schedule,
          ),
          const SizedBox(width: 10),
          _StatCard(
            label: 'Approved',
            count: statistics.approved.count,
            amount: formatter.format(statistics.approved.total),
            color: Colors.green,
            icon: Icons.check_circle_outline,
          ),
          const SizedBox(width: 10),
          _StatCard(
            label: 'Converted',
            count: statistics.converted.count,
            amount: formatter.format(statistics.converted.total),
            color: Colors.blue,
            icon: Icons.call_made,
          ),
          const SizedBox(width: 10),
          _StatCard(
            label: 'Expired',
            count: statistics.expired.count,
            amount: formatter.format(statistics.expired.total),
            color: Colors.red,
            icon: Icons.warning_amber_outlined,
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
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              amount,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              '$count quotation${count == 1 ? '' : 's'}',
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

class _QuotationCard extends StatelessWidget {
  final Quotation quotation;
  final VoidCallback onTap;
  final VoidCallback? onDelete;
  final VoidCallback? onEdit;
  final VoidCallback? onDuplicate;
  final VoidCallback? onSend;
  final VoidCallback? onConvert;

  const _QuotationCard({
    required this.quotation,
    required this.onTap,
    this.onDelete,
    this.onEdit,
    this.onDuplicate,
    this.onSend,
    this.onConvert,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateFormat = DateFormat('d MMM y');
    final currencyFormat = NumberFormat.currency(
      symbol: 'MK ',
      decimalDigits: 2,
    );
    final statusColor = _statusColor(quotation.status);

    Widget card = Card(
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
                  Expanded(
                    child: Text(
                      quotation.quotationNumber,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      quotation.status,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.person_outline,
                    size: 14,
                    color: theme.colorScheme.outline,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      quotation.client,
                      style: theme.textTheme.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Icon(
                    Icons.calendar_today_outlined,
                    size: 12,
                    color: theme.colorScheme.outline,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Valid ${dateFormat.format(DateTime.tryParse(quotation.validUntil) ?? DateTime.now())}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                quotation.title,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.outline,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                currencyFormat.format(quotation.amount),
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  if (onSend != null)
                    OutlinedButton.icon(
                      onPressed: onSend,
                      icon: const Icon(Icons.send_outlined, size: 16),
                      label: const Text('Send'),
                    ),
                  if (onConvert != null)
                    OutlinedButton.icon(
                      onPressed: onConvert,
                      icon: const Icon(Icons.call_made, size: 16),
                      label: const Text('Convert'),
                    ),
                  if (onEdit != null)
                    OutlinedButton.icon(
                      onPressed: onEdit,
                      icon: const Icon(Icons.edit_outlined, size: 16),
                      label: const Text('Edit'),
                    ),
                  if (onDuplicate != null)
                    OutlinedButton.icon(
                      onPressed: onDuplicate,
                      icon: const Icon(Icons.copy, size: 16),
                      label: const Text('Duplicate'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (onDelete != null) {
      card = Dismissible(
        key: ValueKey(quotation.id),
        direction: DismissDirection.endToStart,
        confirmDismiss: (_) async {
          onDelete!();
          return false;
        },
        background: Container(
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 24),
          decoration: BoxDecoration(
            color: theme.colorScheme.error.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(Icons.delete_outline, color: theme.colorScheme.error),
        ),
        child: card,
      );
    }
    return card;
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'draft':
        return Colors.grey;
      case 'converted':
        return Colors.blue;
      case 'expired':
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}
