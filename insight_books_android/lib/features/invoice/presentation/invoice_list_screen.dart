import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../shared/widgets/stat_card.dart';
import '../../../shared/widgets/main_layout.dart';
import '../../pos/data/pos_repository.dart';
import '../../pos/domain/pos_models.dart';
import '../domain/invoice_model.dart';
import 'providers/invoice_provider.dart';

class InvoiceListScreen extends ConsumerStatefulWidget {
  const InvoiceListScreen({super.key});

  @override
  ConsumerState<InvoiceListScreen> createState() => _InvoiceListScreenState();
}

class _InvoiceListScreenState extends ConsumerState<InvoiceListScreen> {
  List<PosClient> _clients = const [];
  final _searchController = TextEditingController();
  final _currencyFormat = NumberFormat.currency(
    symbol: 'MK ',
    decimalDigits: 2,
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadClients();
      ref.read(invoiceControllerProvider.notifier).refresh();
    });
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
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(invoiceControllerProvider);
    final controller = ref.read(invoiceControllerProvider.notifier);
    final theme = Theme.of(context);

    if (!state.canViewInvoices) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Invoices')),
        body: const Center(
          child: Text('You do not have permission to view this page.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Invoices'),
        actions: [
          // Sort button
          IconButton(
            icon: const Icon(Icons.sort),
            tooltip: 'Sort',
            onPressed: () => _showSortSheet(context, state, controller),
          ),
          // Filter button
          IconButton(
            icon: Badge(
              isLabelVisible: controller.hasActiveFilters,
              child: const Icon(Icons.filter_list),
            ),
            tooltip: 'Filter',
            onPressed: () => _showFilterSheet(context, state, controller),
          ),
          // Export button
          IconButton(
            icon: const Icon(Icons.file_download_outlined),
            tooltip: 'Export CSV',
            onPressed: state.canExportInvoices
                ? () => controller.exportCsv()
                : null,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: state.canCreateInvoices
            ? () => context.push('/invoice/create')
            : null,
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: () => controller.reloadPreservingPagination(),
        child: CustomScrollView(
          slivers: [
            // ── Statistics ──
            SliverToBoxAdapter(child: _buildStatistics(state, theme)),

            // ── Search Bar ──
            SliverToBoxAdapter(child: _buildSearchBar(controller, theme)),

            // ── Status Chips ──
            SliverToBoxAdapter(
              child: _buildStatusChips(state, controller, theme),
            ),

            // ── Active Filters Info ──
            if (state.dateFrom != null ||
                state.dateTo != null ||
                state.clientFilter != null)
              SliverToBoxAdapter(
                child: _buildActiveFiltersBar(state, controller, theme),
              ),

            // ── Invoice List ──
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
                      const SizedBox(height: 16),
                      Text(
                        'Failed to load invoices',
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      ElevatedButton(
                        onPressed: () => controller.refresh(),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              )
            else if (state.invoices.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.receipt_long,
                        size: 64,
                        color: theme.colorScheme.onSurface.withAlpha(80),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'No invoices found',
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        state.canCreateInvoices
                            ? 'Tap + to create your first invoice'
                            : 'You can view invoices but do not have permission to create new ones.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) =>
                      _buildInvoiceCard(state.invoices[index], theme),
                  childCount: state.invoices.length,
                ),
              ),

            // ── Pagination ──
            if (!state.isLoading &&
                state.invoices.isNotEmpty &&
                state.totalPages > 1)
              SliverToBoxAdapter(
                child: _buildPagination(state, controller, theme),
              ),

            // Bottom padding for FAB
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Statistics
  // ═══════════════════════════════════════════════════

  Widget _buildStatistics(InvoicePageState state, ThemeData theme) {
    final stats = state.statistics;
    if (stats == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: StatCard(
                  label: 'Paid',
                  value: _currencyFormat.format(stats.paid.amount),
                  count: stats.paid.count,
                  color: theme.colorScheme.tertiary,
                  subtitle:
                      '${stats.paid.count} invoice${stats.paid.count == 1 ? '' : 's'}',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: StatCard(
                  label: 'Pending',
                  value: _currencyFormat.format(stats.pending.amount),
                  count: stats.pending.count,
                  color: theme.colorScheme.primary,
                  subtitle:
                      '${stats.pending.count} invoice${stats.pending.count == 1 ? '' : 's'}',
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: StatCard(
                  label: 'Overdue',
                  value: _currencyFormat.format(stats.overdue.amount),
                  count: stats.overdue.count,
                  color: theme.colorScheme.error,
                  subtitle:
                      '${stats.overdue.count} invoice${stats.overdue.count == 1 ? '' : 's'}',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: StatCard(
                  label: 'Partial',
                  value: _currencyFormat.format(stats.partial.amount),
                  count: stats.partial.count,
                  color: theme.colorScheme.secondary,
                  subtitle:
                      '${stats.partial.count} invoice${stats.partial.count == 1 ? '' : 's'}',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Search
  // ═══════════════════════════════════════════════════

  Widget _buildSearchBar(InvoiceController controller, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: TextField(
        controller: _searchController,
        decoration: InputDecoration(
          hintText: 'Search by invoice number or client...',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    _searchController.clear();
                    controller.setSearch('');
                  },
                )
              : null,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 12,
          ),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
        onChanged: (v) {
          setState(() {}); // update suffixIcon visibility
          controller.setSearch(v);
        },
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Status Chips
  // ═══════════════════════════════════════════════════

  Widget _buildStatusChips(
    InvoicePageState state,
    InvoiceController controller,
    ThemeData theme,
  ) {
    // Matches web /invoice tabs: All, Drafts, Pending, Paid, Overdue
    final statuses = ['all', 'draft', 'pending', 'paid', 'overdue'];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: SizedBox(
        height: 40,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: statuses.length,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (context, i) {
            final s = statuses[i];
            final selected = state.statusFilter == s;
            final label = switch (s) {
              'all' => 'All',
              'draft' => 'Drafts',
              _ => s[0].toUpperCase() + s.substring(1),
            };
            return ChoiceChip(
              label: Text(
                label,
                style: TextStyle(
                  color: selected
                      ? theme.colorScheme.onPrimary
                      : theme.colorScheme.onSurface,
                  fontSize: 13,
                ),
              ),
              selected: selected,
              selectedColor: theme.colorScheme.primary,
              onSelected: (_) => controller.setStatusFilter(s),
              visualDensity: VisualDensity.compact,
            );
          },
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Active Filters Bar
  // ═══════════════════════════════════════════════════

  Widget _buildActiveFiltersBar(
    InvoicePageState state,
    InvoiceController controller,
    ThemeData theme,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          Icon(Icons.filter_alt, size: 16, color: theme.colorScheme.primary),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              [
                if (state.dateFrom != null || state.dateTo != null)
                  'Date: ${state.dateFrom ?? '...'} → ${state.dateTo ?? '...'}',
                if (state.clientFilter != null) 'Client filtered',
              ].join(' · '),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.primary,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          TextButton(
            onPressed: () => controller.resetFilters(),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Invoice Card
  // ═══════════════════════════════════════════════════

  Widget _buildInvoiceCard(Invoice invoice, ThemeData theme) {
    final statusColor = _statusColor(invoice.status, theme);
    final raw = invoice.status.trim();
    final statusLabel = raw.isEmpty
        ? '—'
        : raw[0].toUpperCase() + raw.substring(1);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/invoice/${invoice.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              Row(
                children: [
                  Expanded(
                    child: Text(
                      invoice.invoiceNumber,
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
                      color: statusColor.withAlpha(25),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: statusColor.withAlpha(80)),
                    ),
                    child: Text(
                      statusLabel,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Client name
              Row(
                children: [
                  Icon(
                    Icons.person_outline,
                    size: 16,
                    color: theme.colorScheme.onSurface.withAlpha(150),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      invoice.client.name,
                      style: theme.textTheme.bodyMedium,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Amount & Due date
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _currencyFormat.format(invoice.total),
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.calendar_today,
                    size: 14,
                    color: theme.colorScheme.onSurface.withAlpha(150),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Due ${DateFormat('MMM d, y').format(invoice.dueDate)}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: _isDueOrOverdue(invoice)
                          ? theme.colorScheme.error
                          : theme.colorScheme.onSurface.withAlpha(150),
                    ),
                  ),
                ],
              ),

              // Balance info for partial payments
              if (invoice.status.toLowerCase() == 'partial' &&
                  invoice.remainingBalance > 0) ...[
                const SizedBox(height: 6),
                Text(
                  'Balance: ${_currencyFormat.format(invoice.remainingBalance)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.secondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Pagination
  // ═══════════════════════════════════════════════════

  Widget _buildPagination(
    InvoicePageState state,
    InvoiceController controller,
    ThemeData theme,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left),
            onPressed: state.page > 1 ? () => controller.previousPage() : null,
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withAlpha(20),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              'Page ${state.page} of ${state.totalPages}',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: 8),
          DropdownButton<int>(
            value: state.limit,
            items: const [10, 20, 50, 100]
                .map(
                  (e) =>
                      DropdownMenuItem<int>(value: e, child: Text('$e / page')),
                )
                .toList(),
            onChanged: (value) {
              if (value != null) controller.setLimit(value);
            },
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: state.page < state.totalPages
                ? () => controller.nextPage()
                : null,
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════
  //  Sort Bottom Sheet
  // ═══════════════════════════════════════════════════

  void _showSortSheet(
    BuildContext context,
    InvoicePageState state,
    InvoiceController controller,
  ) {
    final sortOptions = {
      'date': 'Date',
      'dueDate': 'Due Date',
      'total': 'Amount',
      'clientName': 'Client',
      'status': 'Status',
    };

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Text(
                        'Sort By',
                        style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        icon: Icon(
                          state.sortOrder == 'asc'
                              ? Icons.arrow_upward
                              : Icons.arrow_downward,
                          size: 18,
                        ),
                        label: Text(
                          state.sortOrder == 'asc' ? 'Ascending' : 'Descending',
                        ),
                        onPressed: () {
                          controller.toggleSortOrder();
                          Navigator.pop(ctx);
                        },
                      ),
                    ],
                  ),
                ),
                const Divider(),
                ...sortOptions.entries.map((entry) {
                  final selected = state.sortBy == entry.key;
                  return ListTile(
                    leading: Icon(
                      selected
                          ? Icons.radio_button_checked
                          : Icons.radio_button_off,
                      color: selected
                          ? Theme.of(ctx).colorScheme.primary
                          : null,
                    ),
                    title: Text(entry.value),
                    onTap: () {
                      controller.setSortBy(entry.key);
                      Navigator.pop(ctx);
                    },
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════
  //  Filter Bottom Sheet
  // ═══════════════════════════════════════════════════

  void _showFilterSheet(
    BuildContext context,
    InvoicePageState state,
    InvoiceController controller,
  ) {
    DateTime? fromDate = state.dateFrom != null
        ? DateTime.tryParse(state.dateFrom!)
        : null;
    DateTime? toDate = state.dateTo != null
        ? DateTime.tryParse(state.dateTo!)
        : null;
    String? selectedClientId = state.clientFilter;
    // Web filter modal: same status options as chips (all + four statuses).
    const sheetStatusKeys = {'all', 'draft', 'pending', 'paid', 'overdue'};
    var sheetStatus = state.statusFilter;
    if (!sheetStatusKeys.contains(sheetStatus)) {
      sheetStatus = 'all';
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            'Filters',
                            style: Theme.of(ctx).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () {
                              controller.resetFilters();
                              Navigator.pop(ctx);
                            },
                            child: const Text('Reset All'),
                          ),
                        ],
                      ),
                      const Divider(),
                      const SizedBox(height: 8),

                      Text('Status', style: Theme.of(ctx).textTheme.titleSmall),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        key: ValueKey<String>('inv_fs_status_$sheetStatus'),
                        initialValue: sheetStatus,
                        decoration: const InputDecoration(
                          labelText: 'Status',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'all',
                            child: Text('All statuses'),
                          ),
                          DropdownMenuItem(
                            value: 'draft',
                            child: Text('Draft'),
                          ),
                          DropdownMenuItem(
                            value: 'pending',
                            child: Text('Pending'),
                          ),
                          DropdownMenuItem(value: 'paid', child: Text('Paid')),
                          DropdownMenuItem(
                            value: 'overdue',
                            child: Text('Overdue'),
                          ),
                        ],
                        onChanged: (v) {
                          if (v != null) setSheetState(() => sheetStatus = v);
                        },
                      ),
                      const SizedBox(height: 20),

                      // Date Range
                      Text(
                        'Date Range',
                        style: Theme.of(ctx).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.calendar_today, size: 16),
                              label: Text(
                                fromDate != null
                                    ? DateFormat('MMM d, y').format(fromDate!)
                                    : 'From',
                              ),
                              onPressed: () async {
                                final picked = await showDatePicker(
                                  context: ctx,
                                  initialDate: fromDate ?? DateTime.now(),
                                  firstDate: DateTime(2020),
                                  lastDate: DateTime.now(),
                                );
                                if (picked != null) {
                                  setSheetState(() => fromDate = picked);
                                }
                              },
                            ),
                          ),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8),
                            child: Text('→'),
                          ),
                          Expanded(
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.calendar_today, size: 16),
                              label: Text(
                                toDate != null
                                    ? DateFormat('MMM d, y').format(toDate!)
                                    : 'To',
                              ),
                              onPressed: () async {
                                final picked = await showDatePicker(
                                  context: ctx,
                                  initialDate: toDate ?? DateTime.now(),
                                  firstDate: DateTime(2020),
                                  lastDate: DateTime.now().add(
                                    const Duration(days: 365),
                                  ),
                                );
                                if (picked != null) {
                                  setSheetState(() => toDate = picked);
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Text('Client', style: Theme.of(ctx).textTheme.titleSmall),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String?>(
                        key: ValueKey<String?>('inv_client_$selectedClientId'),
                        initialValue: selectedClientId,
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('All Clients'),
                          ),
                          ..._clients.map(
                            (client) => DropdownMenuItem<String?>(
                              value: client.id,
                              child: Text(client.name),
                            ),
                          ),
                        ],
                        onChanged: (value) {
                          setSheetState(() => selectedClientId = value);
                        },
                      ),
                      const SizedBox(height: 24),

                      // Apply Button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () async {
                            await controller.applySheetFilters(
                              statusFilter: sheetStatus,
                              dateFrom: fromDate
                                  ?.toIso8601String()
                                  .split('T')
                                  .first,
                              dateTo: toDate
                                  ?.toIso8601String()
                                  .split('T')
                                  .first,
                              clientId: selectedClientId,
                            );
                            if (ctx.mounted) Navigator.pop(ctx);
                          },
                          child: const Text('Apply Filters'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════

  bool _isDueOrOverdue(Invoice invoice) {
    final status = invoice.status.toLowerCase();
    if (status == 'paid' || status == 'void' || status == 'draft') return false;
    return invoice.dueDate.isBefore(DateTime.now());
  }

  Color _statusColor(String status, ThemeData theme) {
    switch (status.toLowerCase()) {
      case 'paid':
        return theme.colorScheme.tertiary;
      case 'pending':
      case 'sent':
        return theme.colorScheme.primary;
      case 'overdue':
        return theme.colorScheme.error;
      case 'draft':
        return theme.colorScheme.outline;
      case 'partial':
        return theme.colorScheme.secondary;
      case 'void':
        return theme.colorScheme.outline;
      default:
        return theme.colorScheme.outline;
    }
  }
}
