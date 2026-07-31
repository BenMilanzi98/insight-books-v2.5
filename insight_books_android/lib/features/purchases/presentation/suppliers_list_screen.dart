import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import 'package:insightbooks_android/shared/widgets/stat_card.dart';

import '../domain/purchases_models.dart';
import 'providers/suppliers_provider.dart';

class SuppliersListScreen extends ConsumerStatefulWidget {
  const SuppliersListScreen({super.key});

  @override
  ConsumerState<SuppliersListScreen> createState() =>
      _SuppliersListScreenState();
}

class _SuppliersListScreenState extends ConsumerState<SuppliersListScreen> {
  final _searchCtrl = TextEditingController();
  bool _selectMode = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(suppliersControllerProvider.notifier).load();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(suppliersControllerProvider);
    final notifier = ref.read(suppliersControllerProvider.notifier);
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 0);

    if (!state.canView) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Suppliers')),
        body: const Center(
          child: Text('You do not have permission to view suppliers.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Suppliers'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: [
          const ThemeToggleButton(),
          if (state.suppliers.isNotEmpty && state.canUpdate)
            IconButton(
              icon: Icon(_selectMode ? Icons.close : Icons.checklist),
              tooltip: _selectMode ? 'Cancel selection' : 'Select',
              onPressed: () {
                setState(() {
                  _selectMode = !_selectMode;
                  if (!_selectMode) notifier.clearSelection();
                });
              },
            ),
        ],
      ),
      floatingActionButton: state.canCreate
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/purchases/suppliers/create'),
              icon: const Icon(Icons.add),
              label: const Text('New supplier'),
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
                        width: 140,
                        child: StatCard(
                          label: 'Total',
                          value: '${state.stats!.totalCount}',
                          count: state.stats!.totalCount,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 140,
                        child: StatCard(
                          label: 'Active',
                          value: '${state.stats!.activeCount}',
                          count: state.stats!.activeCount,
                          color: Colors.green,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 160,
                        child: StatCard(
                          label: 'Balance',
                          value: currency.format(state.stats!.totalBalance),
                          count: 0,
                          color: const Color(0xFFEF4444),
                          subtitle: 'Outstanding',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search suppliers…',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _searchCtrl.text.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchCtrl.clear();
                              notifier.setSearch('');
                              setState(() {});
                            },
                          ),
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  onSubmitted: notifier.setSearch,
                  onChanged: (v) {
                    if (v.isEmpty) notifier.setSearch('');
                    setState(() {});
                  },
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: Row(
                  children: [
                    for (final entry in const [
                      ('all', 'All'),
                      ('active', 'Active'),
                      ('inactive', 'Inactive'),
                    ])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(entry.$2),
                          selected: state.statusFilter == entry.$1,
                          onSelected: (_) =>
                              notifier.setStatusFilter(entry.$1),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (_selectMode && state.selectedSupplierIds.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text('${state.selectedSupplierIds.length} selected'),
                      FilledButton.tonal(
                        onPressed: () async {
                          try {
                            await notifier.bulkSetActive(true);
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Suppliers activated')),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('$e')),
                            );
                          }
                        },
                        child: const Text('Activate'),
                      ),
                      FilledButton.tonal(
                        onPressed: () async {
                          try {
                            await notifier.bulkSetActive(false);
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Suppliers deactivated'),
                              ),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('$e')),
                            );
                          }
                        },
                        child: const Text('Deactivate'),
                      ),
                      TextButton(
                        onPressed: notifier.clearSelection,
                        child: const Text('Clear'),
                      ),
                    ],
                  ),
                ),
              ),
            if (state.isLoading && state.suppliers.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null && state.suppliers.isEmpty)
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
            else if (state.suppliers.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Text(
                    'No suppliers found',
                    style: TextStyle(color: AppTheme.textSecondary(context)),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.all(12),
                sliver: SliverList.separated(
                  itemCount: state.suppliers.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final supplier = state.suppliers[index];
                    final selected =
                        state.selectedSupplierIds.contains(supplier.id);
                    return _SupplierTile(
                      supplier: supplier,
                      currency: currency,
                      selectMode: _selectMode,
                      selected: selected,
                      canUpdate: state.canUpdate,
                      canDelete: state.canDelete,
                      onTap: () {
                        if (_selectMode) {
                          notifier.toggleSelection(supplier.id);
                        } else {
                          context.push('/purchases/suppliers/${supplier.id}');
                        }
                      },
                      onEdit: () => context.push(
                        '/purchases/suppliers/${supplier.id}/edit',
                      ),
                      onDeactivate: () => _confirmDeactivate(
                        context,
                        notifier,
                        supplier,
                      ),
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

  Future<void> _confirmDeactivate(
    BuildContext context,
    SuppliersController notifier,
    PurchaseSupplier supplier,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Deactivate supplier?'),
        content: Text(
          'Deactivate ${supplier.supplierName}? They will be hidden from selection lists.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await notifier.deactivateSupplier(supplier.id);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Supplier deactivated')),
      );
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e')),
      );
    }
  }
}

class _SupplierTile extends StatelessWidget {
  const _SupplierTile({
    required this.supplier,
    required this.currency,
    required this.selectMode,
    required this.selected,
    required this.canUpdate,
    required this.canDelete,
    required this.onTap,
    required this.onEdit,
    required this.onDeactivate,
  });

  final PurchaseSupplier supplier;
  final NumberFormat currency;
  final bool selectMode;
  final bool selected;
  final bool canUpdate;
  final bool canDelete;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDeactivate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitle = [
      if (supplier.supplierCode != null && supplier.supplierCode!.isNotEmpty)
        supplier.supplierCode!,
      if (!supplier.isActive) 'Inactive',
      currency.format(supplier.currentBalance),
    ].join(' · ');

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: selectMode
            ? Checkbox(value: selected, onChanged: (_) => onTap())
            : CircleAvatar(
                backgroundColor: supplier.isActive
                    ? theme.colorScheme.primaryContainer
                    : theme.colorScheme.surfaceContainerHighest,
                child: Icon(
                  Icons.storefront_outlined,
                  color: theme.colorScheme.onPrimaryContainer,
                  size: 20,
                ),
              ),
        title: Text(
          supplier.supplierName,
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
        trailing: selectMode
            ? null
            : PopupMenuButton<String>(
                onSelected: (v) {
                  if (v == 'edit') onEdit();
                  if (v == 'deactivate') onDeactivate();
                },
                itemBuilder: (_) => [
                  if (canUpdate)
                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                  if (canDelete && supplier.isActive)
                    const PopupMenuItem(
                      value: 'deactivate',
                      child: Text('Deactivate'),
                    ),
                ],
                child: Icon(Icons.more_vert, color: theme.colorScheme.onSurface),
              ),
      ),
    );
  }
}
