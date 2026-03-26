import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:insightbooks_android/features/pos/presentation/providers/pos_provider.dart';
import 'package:insightbooks_android/features/pos/domain/pos_models.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/features/pos/presentation/widgets/cart_sheet.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _barcodeController = TextEditingController();
  final TextEditingController _historySearchController = TextEditingController();
  String _selectedCategory = 'all';

  @override
  void dispose() {
    _searchController.dispose();
    _barcodeController.dispose();
    _historySearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final posState = ref.watch(posProvider);
    final posNotifier = ref.read(posProvider.notifier);
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 2,
    );
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    if (!posState.canViewSales) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(
          title: const Text('Point of Sale'),
          actions: const [ThemeToggleButton()],
        ),
        body: const Center(
          child: Text('You do not have permission to view this page.'),
        ),
      );
    }

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Point of Sale'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.refresh(posProvider),
          ),
          const ThemeToggleButton(),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'sell', label: Text('Sell')),
                ButtonSegment(value: 'history', label: Text('Sales History')),
                ButtonSegment(
                  value: 'historical_import',
                  label: Text('Historical Import'),
                ),
              ],
              selected: {posState.activeTab},
              onSelectionChanged: (set) {
                posNotifier.setActiveTab(set.first);
              },
            ),
          ),
          const SizedBox(height: 8),
          if (!posState.isOnline)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Card(
                color: Theme.of(context).colorScheme.tertiaryContainer,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Text(
                    'You are offline. Sales will be queued and synced when reconnected.'
                    '${posState.offlineSalesCount > 0 ? ' (${posState.offlineSalesCount} pending)' : ''}',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onTertiaryContainer,
                    ),
                  ),
                ),
              ),
            ),
          if (posState.eisEnabled)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  Icon(
                    posState.serverTimeSource == 'mra'
                        ? Icons.verified_outlined
                        : Icons.access_time_outlined,
                    size: 16,
                    color: colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    posState.serverTime != null
                        ? 'Server: ${posState.serverTime}'
                        : 'Server time unavailable',
                    style: TextStyle(
                      fontSize: 12,
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          if (posState.offlineBlockedMessage != null &&
              posState.offlineBlockedMessage!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Text(
                    posState.offlineBlockedMessage!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    ),
                  ),
                ),
              ),
            ),
          if (posState.isOnline && posState.offlineSalesCount > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Card(
                child: ListTile(
                  dense: true,
                  leading: const Icon(Icons.sync_problem_outlined),
                  title: Text('${posState.offlineSalesCount} offline sale(s) pending'),
                  trailing: FilledButton.tonal(
                    onPressed: () async {
                      final res = await posNotifier.syncOfflineSales();
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            'Synced ${res['synced']} sale(s), failed ${res['failed']}',
                          ),
                        ),
                      );
                    },
                    child: const Text('Sync now'),
                  ),
                ),
              ),
            ),
          if (posState.activeTab == 'history') ...[
            Expanded(
              child: _buildSalesHistory(context, posState, posNotifier),
            ),
          ] else if (posState.activeTab == 'historical_import') ...[
            Expanded(
              child: _buildHistoricalImport(context, posState, posNotifier),
            ),
          ] else ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: DropdownButtonFormField<String>(
              value: posState.selectedBranchId,
              decoration: const InputDecoration(
                labelText: 'Branch',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: posState.branches
                  .map(
                    (b) => DropdownMenuItem<String>(
                      value: (b['id'] ?? '').toString(),
                      child: Text((b['name'] ?? 'Branch').toString()),
                    ),
                  )
                  .toList(),
              onChanged: (value) => posNotifier.setSelectedBranch(value),
            ),
          ),
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search products or scan SKU...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          posNotifier.searchProducts('');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor: colorScheme.surface,
              ),
              onChanged: posNotifier.searchProducts,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              controller: _barcodeController,
              decoration: InputDecoration(
                hintText: 'Scan barcode to add item',
                prefixIcon: const Icon(Icons.qr_code_scanner),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.add_shopping_cart_outlined),
                  onPressed: () async {
                    if (!posState.canCreateSales) return;
                    final ok = await posNotifier.addToCartByBarcode(_barcodeController.text);
                    if (!mounted) return;
                    if (ok) {
                      _barcodeController.clear();
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('No product matches this barcode/SKU')),
                      );
                    }
                  },
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor: colorScheme.surface,
              ),
              textInputAction: TextInputAction.done,
              onSubmitted: (value) async {
                if (!posState.canCreateSales) return;
                final ok = await posNotifier.addToCartByBarcode(value);
                if (!mounted) return;
                if (ok) {
                  _barcodeController.clear();
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('No product matches this barcode/SKU')),
                  );
                }
              },
            ),
          ),

          // Categories
          SizedBox(
            height: 50,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _buildCategoryChip(context, 'all', 'All Products'),
                ...posState.products
                    .map((p) => p.category)
                    .whereType<String>()
                    .toSet()
                    .map((cat) => _buildCategoryChip(context, cat, cat)),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Product Grid
          Expanded(
            child: posState.isLoading
                ? const Center(child: CircularProgressIndicator())
                : posState.error != null
                ? Center(child: Text('Error: ${posState.error}', style: TextStyle(color: colorScheme.onSurface)))
                : posState.filteredProducts.isEmpty
                ? Center(child: Text('No products found', style: TextStyle(color: colorScheme.onSurfaceVariant)))
                : GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 0.75,
                          crossAxisSpacing: 16,
                          mainAxisSpacing: 16,
                        ),
                    itemCount: posState.filteredProducts.length,
                    itemBuilder: (context, index) {
                      final product = posState.filteredProducts[index];
                      int? cartQuantity;
                      for (final item in posState.cart) {
                        if (item.product.id == product.id) {
                          cartQuantity = item.quantity.round();
                          break;
                        }
                      }
                      return _ProductCard(
                        product: product,
                        cartQuantity: cartQuantity,
                        onAdd: posState.canCreateSales
                            ? () => posNotifier.addToCart(product)
                            : () {},
                      );
                    },
                  ),
          ),
          ],
        ],
      ),
      bottomNavigationBar: posState.cart.isNotEmpty
          ? Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                boxShadow: [
                  BoxShadow(
                    color: colorScheme.shadow.withValues(alpha: 0.1),
                    blurRadius: 10,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${posState.cart.length} items',
                            style: TextStyle(
                              color: colorScheme.onSurfaceVariant,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            currencyFormat.format(posState.total),
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: colorScheme.onSurface,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: posState.canCreateSales
                          ? () => _showCart(context)
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colorScheme.primary,
                        foregroundColor: colorScheme.onPrimary,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 32,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Review Cart'),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildCategoryChip(BuildContext context, String id, String label) {
    final isSelected = _selectedCategory == id;
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8.0),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (selected) {
          setState(() => _selectedCategory = id);
          ref.read(posProvider.notifier).filterByCategory(id);
        },
        backgroundColor: colorScheme.surface,
        selectedColor: colorScheme.primary.withValues(alpha: 0.2),
        checkmarkColor: colorScheme.primary,
        labelStyle: TextStyle(
          color: isSelected ? colorScheme.primary : colorScheme.onSurface,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        side: BorderSide(
          color: isSelected ? colorScheme.primary : colorScheme.outline.withValues(alpha: 0.5),
        ),
      ),
    );
  }

  void _showCart(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const CartSheet(),
    );
  }

  Widget _buildSalesHistory(
    BuildContext context,
    PosPageState posState,
    Pos posNotifier,
  ) {
    final currencyFormat = NumberFormat.currency(symbol: 'MWK ', decimalDigits: 2);
    final cs = Theme.of(context).colorScheme;
    final stats = posState.salesStatistics ?? const <String, dynamic>{};
    final total = (stats['total'] as Map?) ?? const {};
    final refunded = (stats['refunded'] as Map?) ?? const {};

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final now = DateTime.now();
                    final picked = await showDatePicker(
                      context: context,
                      initialDate:
                          DateTime.tryParse(posState.dailyReportDate) ?? now,
                      firstDate: DateTime(2020),
                      lastDate: now,
                    );
                    if (picked != null) {
                      posNotifier.setDailyReportDate(
                        picked.toIso8601String().split('T').first,
                      );
                    }
                  },
                  icon: const Icon(Icons.assessment_outlined, size: 16),
                  label: Text(
                    posState.dailyReportDate.isEmpty
                        ? 'Daily Report Date'
                        : posState.dailyReportDate,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final now = DateTime.now();
                    final picked = await showDatePicker(
                      context: context,
                      initialDate:
                          DateTime.tryParse(posState.historyDateFrom ?? '') ?? now,
                      firstDate: DateTime(2020),
                      lastDate: now,
                    );
                    if (picked != null) {
                      posNotifier.setHistoryDateRange(
                        picked.toIso8601String().split('T').first,
                        posState.historyDateTo,
                      );
                    }
                  },
                  icon: const Icon(Icons.calendar_today, size: 16),
                  label: Text(posState.historyDateFrom ?? 'From Date'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final now = DateTime.now();
                    final picked = await showDatePicker(
                      context: context,
                      initialDate:
                          DateTime.tryParse(posState.historyDateTo ?? '') ?? now,
                      firstDate: DateTime(2020),
                      lastDate: now,
                    );
                    if (picked != null) {
                      posNotifier.setHistoryDateRange(
                        posState.historyDateFrom,
                        picked.toIso8601String().split('T').first,
                      );
                    }
                  },
                  icon: const Icon(Icons.calendar_today, size: 16),
                  label: Text(posState.historyDateTo ?? 'To Date'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Export CSV',
                onPressed: !posState.canExportSales
                    ? null
                    : () async {
                  try {
                    await posNotifier.exportSalesCsv();
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Sales export ready')),
                    );
                  } catch (e) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Export failed: $e')),
                    );
                  }
                },
                icon: const Icon(Icons.file_download_outlined),
              ),
            ],
          ),
        ),
        if (posState.dailyReport != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                      child: _reportMetric(
                        'Sales',
                        '${posState.dailyReport?['salesCount'] ?? 0}',
                      ),
                    ),
                    Expanded(
                      child: _reportMetric(
                        'Items',
                        '${posState.dailyReport?['itemsSold'] ?? 0}',
                      ),
                    ),
                    Expanded(
                      child: _reportMetric(
                        'Gross',
                        currencyFormat.format(
                          double.tryParse(
                                '${posState.dailyReport?['grossSales'] ?? 0}',
                              ) ??
                              0,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: TextField(
            controller: _historySearchController,
            decoration: InputDecoration(
              hintText: 'Search receipt, client or notes...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _historySearchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _historySearchController.clear();
                        setState(() {});
                        posNotifier.setHistorySearchQuery('');
                      },
                    )
                  : null,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              filled: true,
              fillColor: cs.surface,
            ),
            onChanged: (value) {
              setState(() {});
              posNotifier.setHistorySearchQuery(value);
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: posState.historyStatusFilter,
                  decoration: const InputDecoration(
                    labelText: 'Status',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('All')),
                    DropdownMenuItem(value: 'completed', child: Text('Completed')),
                    DropdownMenuItem(value: 'voided', child: Text('Voided')),
                    DropdownMenuItem(value: 'refunded', child: Text('Refunded')),
                  ],
                  onChanged: (value) {
                    if (value != null) posNotifier.setHistoryStatusFilter(value);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: posState.historySortBy,
                  decoration: const InputDecoration(
                    labelText: 'Sort',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: const [
                    DropdownMenuItem(value: 'date', child: Text('Date')),
                    DropdownMenuItem(value: 'total', child: Text('Amount')),
                    DropdownMenuItem(value: 'status', child: Text('Status')),
                  ],
                  onChanged: (value) {
                    if (value != null) posNotifier.setHistorySortBy(value);
                  },
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Sales'),
                        Text('${total['count'] ?? 0}'),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Refunded'),
                        Text('${refunded['count'] ?? 0}'),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: posState.recentSales.isEmpty
              ? Center(
                  child: Text(
                    'No recent sales',
                    style: TextStyle(color: cs.onSurfaceVariant),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  itemBuilder: (context, index) {
                    final sale = posState.recentSales[index];
                    final id = (sale['id'] ?? '').toString();
                    final amount = double.tryParse('${sale['total'] ?? 0}') ?? 0;
                    final status = (sale['status'] ?? 'completed').toString();
                    final customerName =
                        ((sale['client'] is Map)
                                ? (sale['client']['name'] ?? '')
                                : '') as String;
                    return Card(
                      child: ListTile(
                        leading: const Icon(Icons.receipt_long),
                        title: Text('Sale #$id'),
                        onTap: () => _showSaleDetails(context, sale),
                        subtitle: Text(
                          '${customerName.isEmpty ? "Walk-in Customer" : customerName} · ${status.toUpperCase()}',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              currencyFormat.format(amount),
                              style: TextStyle(
                                color: cs.onSurface,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            PopupMenuButton<String>(
                              enabled: posState.canVoidSales || posState.canRefundSales,
                              onSelected: (value) async {
                                if (value == 'void') {
                                  final reason = await _askReason(context, 'Void reason');
                                  if (reason != null && reason.isNotEmpty) {
                                    await posNotifier.voidSale(id, reason);
                                  }
                                } else if (value == 'refund') {
                                  final reason = await _askReason(context, 'Refund reason');
                                  if (reason != null && reason.isNotEmpty) {
                                    await posNotifier.refundSale(id, reason);
                                  }
                                }
                              },
                              itemBuilder: (ctx) => [
                                if (posState.canVoidSales)
                                  const PopupMenuItem(value: 'void', child: Text('Void')),
                                if (posState.canRefundSales)
                                  const PopupMenuItem(value: 'refund', child: Text('Refund')),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemCount: posState.recentSales.length,
                ),
        ),
      ],
    );
  }

  Widget _buildHistoricalImport(
    BuildContext context,
    PosPageState posState,
    Pos posNotifier,
  ) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextFormField(
          initialValue: posState.historicalBatchName,
          decoration: const InputDecoration(
            labelText: 'Batch Name',
            border: OutlineInputBorder(),
          ),
          onChanged: posNotifier.setHistoricalBatchName,
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: !posState.canExportSales
              ? null
              : () async {
            try {
              final bytes = await posNotifier.downloadHistoricalTemplate();
              final dir = await getTemporaryDirectory();
              final file = File('${dir.path}/historical-sales-template.csv');
              await file.writeAsBytes(bytes);
              await SharePlus.instance.share(
                ShareParams(files: [XFile(file.path)]),
              );
            } catch (e) {
              if (!context.mounted) return;
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text('Template failed: $e')));
            }
          },
          icon: const Icon(Icons.download_outlined),
          label: const Text('Download CSV Template'),
        ),
        const SizedBox(height: 8),
        FilledButton.icon(
          onPressed: !posState.canUpdateSales
              ? null
              : () async {
            try {
              final picked = await FilePicker.platform.pickFiles();
              if (picked == null || picked.files.single.path == null) return;
              await posNotifier.uploadHistoricalBatch(picked.files.single.path!);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    posState.historicalUploadResult ?? 'Batch uploaded',
                  ),
                ),
              );
            } catch (e) {
              if (!context.mounted) return;
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
            }
          },
          icon: const Icon(Icons.upload_file_outlined),
          label: const Text('Upload Historical Batch'),
        ),
        const SizedBox(height: 12),
        if ((posState.historicalUploadResult ?? '').isNotEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(posState.historicalUploadResult!),
            ),
          ),
      ],
    );
  }

  Widget _reportMetric(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }

  Future<String?> _askReason(BuildContext context, String title) async {
    final ctrl = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            hintText: 'Enter reason',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    return value;
  }

  Future<void> _showSaleDetails(
    BuildContext context,
    Map<String, dynamic> sale,
  ) async {
    final cs = Theme.of(context).colorScheme;
    final currencyFormat = NumberFormat.currency(symbol: 'MWK ', decimalDigits: 2);
    final items = (sale['items'] is List) ? (sale['items'] as List) : const [];
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        builder: (_, controller) => Container(
          decoration: BoxDecoration(
            color: cs.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: ListView(
            controller: controller,
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Sale #${sale['id'] ?? ''}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text('Status: ${(sale['status'] ?? 'completed').toString().toUpperCase()}'),
              Text('Total: ${currencyFormat.format(double.tryParse('${sale['total'] ?? 0}') ?? 0)}'),
              if (sale['createdAt'] != null)
                Text('Date: ${sale['createdAt']}'),
              const SizedBox(height: 12),
              const Text(
                'Items',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              if (items.isEmpty)
                Text('No item breakdown available', style: TextStyle(color: cs.onSurfaceVariant))
              else
                ...items.map((item) {
                  final m = item is Map<String, dynamic>
                      ? item
                      : Map<String, dynamic>.from(item as Map);
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text((m['description'] ?? m['name'] ?? 'Item').toString()),
                    subtitle: Text('Qty: ${m['quantity'] ?? 0}'),
                    trailing: Text(
                      currencyFormat.format(double.tryParse('${m['lineTotal'] ?? m['total'] ?? 0}') ?? 0),
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final PosProduct product;
  final int? cartQuantity;
  final VoidCallback onAdd;

  const _ProductCard({
    required this.product,
    this.cartQuantity,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 2,
    );
    final colorScheme = Theme.of(context).colorScheme;
    final inCart = cartQuantity != null;

    return Card(
      elevation: inCart ? 2 : 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: inCart ? colorScheme.primary : Colors.transparent,
          width: inCart ? 2.5 : 0,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      color: inCart ? colorScheme.primaryContainer.withValues(alpha: 0.25) : null,
      child: InkWell(
        onTap: onAdd,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            if (inCart)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: colorScheme.primary,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: colorScheme.shadow.withValues(alpha: 0.2),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.shopping_cart_checkout, size: 14, color: colorScheme.onPrimary),
                      const SizedBox(width: 4),
                      Text(
                        '${cartQuantity!}',
                        style: TextStyle(
                          color: colorScheme.onPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Positioned.fill(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      color: colorScheme.primaryContainer.withValues(alpha: inCart ? 0.5 : 0.3),
                      child: Center(
                        child: Icon(
                          Icons.inventory_2,
                          color: colorScheme.primary.withValues(alpha: inCart ? 1.0 : 0.7),
                          size: 48,
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product.name,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: colorScheme.onSurface,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        if (product.category != null)
                          Text(
                            product.category!,
                            style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 12),
                          ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                currencyFormat.format(product.price),
                                style: TextStyle(
                                  color: colorScheme.primary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: colorScheme.primary.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(
                                Icons.add,
                                color: colorScheme.primary,
                                size: 16,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
