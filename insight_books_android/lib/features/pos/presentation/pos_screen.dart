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
import 'package:insightbooks_android/features/pos/presentation/widgets/barcode_scanner_screen.dart';
import 'package:insightbooks_android/features/pos/data/pos_repository.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

double _saleTotalAmount(Map<String, dynamic> sale) {
  final raw = sale['rawTotal'];
  if (raw is num) return raw.toDouble();
  if (raw != null) {
    final p = double.tryParse(raw.toString());
    if (p != null) return p;
  }
  return _parseLocaleMoney('${sale['total'] ?? 0}');
}

double _parseLocaleMoney(String raw) {
  final s = raw.replaceAll(',', '').replaceAll(RegExp(r'[^\d.]'), '');
  if (s.isEmpty) return 0;
  return double.tryParse(s) ?? 0;
}

/// Matches API: min length for void/refund reasons (audit / GL reversal).
const int _kMinAuditReasonLength = 10;

bool _auditReasonOk(String? reason) =>
    reason != null && reason.trim().length >= _kMinAuditReasonLength;

void _showAuditReasonTooShort(BuildContext context) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(
        'Reason must be at least $_kMinAuditReasonLength characters (audit / GL reversal).',
      ),
    ),
  );
}

String _saleClientLabel(Map<String, dynamic> sale) {
  final c = sale['client'];
  if (c is String) {
    return c.isEmpty ? 'Walk-in Customer' : c;
  }
  if (c is Map) {
    final n = (c['name'] ?? '').toString();
    return n.isEmpty ? 'Walk-in Customer' : n;
  }
  return 'Walk-in Customer';
}

double _lineAmountFromItem(Map<String, dynamic> m) {
  final raw = m['rawAmount'] ?? m['lineTotal'];
  if (raw is num) return raw.toDouble();
  if (raw != null) {
    final p = double.tryParse(raw.toString());
    if (p != null) return p;
  }
  return _parseLocaleMoney('${m['lineTotal'] ?? m['total'] ?? m['amount'] ?? 0}');
}

int? _cartQuantityForProduct(PosProduct product, List<CartItem> cart) {
  for (final item in cart) {
    if (item.product.id == product.id) {
      return item.quantity.round();
    }
  }
  return null;
}

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
  /// Default: list view (primary). Users can switch to grid via the toggle.
  bool _productLayoutIsList = true;

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
              initialValue: posState.selectedBranchId,
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
                hintText: 'Scan barcode (camera) or type SKU…',
                prefixIcon: const Icon(Icons.qr_code_scanner),
                suffixIcon: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'Scan with device camera',
                      icon: const Icon(Icons.photo_camera_outlined),
                      onPressed: !posState.canCreateSales
                          ? null
                          : () => _scanBarcodeWithCamera(context, posNotifier),
                    ),
                    IconButton(
                      tooltip: 'Add to cart',
                      icon: const Icon(Icons.add_shopping_cart_outlined),
                      onPressed: !posState.canCreateSales
                          ? null
                          : () async {
                              final name = await posNotifier
                                  .addToCartByBarcode(_barcodeController.text);
                              if (!context.mounted) return;
                              if (name != null) {
                                _barcodeController.clear();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Added: $name')),
                                );
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'No product matches this barcode/SKU',
                                    ),
                                  ),
                                );
                              }
                            },
                    ),
                  ],
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
                final name = await posNotifier.addToCartByBarcode(value);
                if (!context.mounted) return;
                if (name != null) {
                  _barcodeController.clear();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Added: $name')),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('No product matches this barcode/SKU'),
                    ),
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

          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            child: Row(
              children: [
                Text(
                  'Products',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                ToggleButtons(
                  isSelected: [_productLayoutIsList, !_productLayoutIsList],
                  onPressed: (index) {
                    setState(() => _productLayoutIsList = index == 0);
                  },
                  borderRadius: BorderRadius.circular(8),
                  constraints: const BoxConstraints(minHeight: 36, minWidth: 44),
                  children: [
                    Tooltip(
                      message: 'List view',
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Icon(
                          Icons.view_list_rounded,
                          size: 22,
                          color: colorScheme.onSurface,
                        ),
                      ),
                    ),
                    Tooltip(
                      message: 'Grid view',
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Icon(
                          Icons.grid_view_rounded,
                          size: 22,
                          color: colorScheme.onSurface,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Product list (default) or grid
          Expanded(
            child: posState.isLoading
                ? const Center(child: CircularProgressIndicator())
                : posState.error != null
                ? Center(child: Text('Error: ${posState.error}', style: TextStyle(color: colorScheme.onSurface)))
                : posState.filteredProducts.isEmpty
                ? Center(child: Text('No products found', style: TextStyle(color: colorScheme.onSurfaceVariant)))
                : _productLayoutIsList
                    ? ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        itemCount: posState.filteredProducts.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final product = posState.filteredProducts[index];
                          final cartQuantity = _cartQuantityForProduct(
                            product,
                            posState.cart,
                          );
                          return _ProductListTile(
                            product: product,
                            cartQuantity: cartQuantity,
                            onAdd: posState.canCreateSales
                                ? () => posNotifier.addToCart(product)
                                : () {},
                          );
                        },
                      )
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
                          final cartQuantity = _cartQuantityForProduct(
                            product,
                            posState.cart,
                          );
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

  Future<void> _scanBarcodeWithCamera(
    BuildContext context,
    Pos posNotifier,
  ) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (ctx) => BarcodeScannerScreen(
          onBarcode: (code) => posNotifier.addToCartByBarcode(code),
        ),
      ),
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
                  initialValue: posState.historyStatusFilter,
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
                  initialValue: posState.historySortBy,
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
                        const Text('Sales (completed)'),
                        Text('${total['count'] ?? 0}'),
                        const SizedBox(height: 4),
                        Text(
                          'MWK ${total['amount'] ?? '0.00'}',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: cs.primary,
                          ),
                        ),
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
                        const SizedBox(height: 4),
                        Text(
                          'MWK ${refunded['amount'] ?? '0.00'}',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: cs.onSurfaceVariant,
                          ),
                        ),
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
                    final saleNo =
                        (sale['saleNumber'] ?? '').toString().trim();
                    final title =
                        saleNo.isNotEmpty ? 'Sale $saleNo' : 'Sale #$id';
                    final amount = _saleTotalAmount(sale);
                    final status = (sale['status'] ?? 'completed').toString();
                    final customerName = _saleClientLabel(sale);
                    final summary =
                        (sale['productSummary'] ?? '').toString().trim();
                    return Card(
                      child: ListTile(
                        leading: const Icon(Icons.receipt_long),
                        title: Text(title),
                        isThreeLine: summary.isNotEmpty,
                        onTap: () => _showSaleDetails(context, sale),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '$customerName · ${status.toUpperCase()}',
                            ),
                            if (summary.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  summary,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: cs.onSurfaceVariant,
                                  ),
                                ),
                              ),
                          ],
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
                              enabled: posState.canVoidSales ||
                                  posState.canRefundSales,
                              onSelected: (value) async {
                                if (value == 'void') {
                                  final reason =
                                      await _askReason(context, 'Void reason');
                                  if (!context.mounted) return;
                                  if (reason == null || reason.isEmpty) {
                                    return;
                                  }
                                  if (!_auditReasonOk(reason)) {
                                    _showAuditReasonTooShort(context);
                                    return;
                                  }
                                  final err =
                                      await posNotifier.voidSale(id, reason);
                                  if (!context.mounted) return;
                                  if (err != null) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(
                                      SnackBar(content: Text(err)),
                                    );
                                  } else {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(
                                      const SnackBar(
                                        content: Text('Sale voided'),
                                      ),
                                    );
                                  }
                                } else if (value == 'refund') {
                                  final reason = await _askReason(
                                    context,
                                    'Refund reason',
                                  );
                                  if (!context.mounted) return;
                                  if (reason == null || reason.isEmpty) {
                                    return;
                                  }
                                  if (!_auditReasonOk(reason)) {
                                    _showAuditReasonTooShort(context);
                                    return;
                                  }
                                  final err = await posNotifier.refundSale(
                                    id,
                                    reason,
                                  );
                                  if (!context.mounted) return;
                                  if (err != null) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(
                                      SnackBar(content: Text(err)),
                                    );
                                  } else {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(
                                      const SnackBar(
                                        content: Text('Sale refunded'),
                                      ),
                                    );
                                  }
                                }
                              },
                              itemBuilder: (ctx) => [
                                if (posState.canVoidSales)
                                  const PopupMenuItem(
                                    value: 'void',
                                    child: Text('Void'),
                                  ),
                                if (posState.canRefundSales)
                                  const PopupMenuItem(
                                    value: 'refund',
                                    child: Text('Refund'),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
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
          decoration: InputDecoration(
            border: const OutlineInputBorder(),
            hintText:
                'Enter reason (min $_kMinAuditReasonLength characters for audit)',
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
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SaleDetailSheet(preview: sale),
    );
  }
}

class _SaleDetailSheet extends ConsumerStatefulWidget {
  const _SaleDetailSheet({required this.preview});

  final Map<String, dynamic> preview;

  @override
  ConsumerState<_SaleDetailSheet> createState() => _SaleDetailSheetState();
}

class _SaleDetailSheetState extends ConsumerState<_SaleDetailSheet> {
  Map<String, dynamic>? _full;
  Object? _error;
  var _actionBusy = false;

  String _friendlyFullDetailsError(Object? e) {
    if (e == null) return '';
    final msg = e.toString().toLowerCase();
    final looksNetwork =
        msg.contains('socket') ||
        msg.contains('network') ||
        msg.contains('timeout') ||
        msg.contains('failed to connect') ||
        msg.contains('connection refused') ||
        msg.contains('dns');
    if (looksNetwork) {
      return 'Failed to connect to the internet, please check your internet connection.';
    }
    return 'Could not load full details.';
  }

  @override
  void initState() {
    super.initState();
    final id = (widget.preview['id'] ?? '').toString();
    // Offline queued sales use `OFFLINE-*` ids; preview data is already present.
    if (id.isEmpty || id.startsWith('OFFLINE-')) return;
    Future.microtask(() => _fetchSale(id));
  }

  Future<void> _fetchSale(String id) async {
    try {
      final map = await ref.read(posRepositoryProvider).fetchSaleById(id);
      if (!mounted) return;
      setState(() => _full = map);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  Future<String?> _askRefundReason() async {
    final ctrl = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Refund reason'),
        content: TextField(
          controller: ctrl,
          decoration: InputDecoration(
            border: const OutlineInputBorder(),
            hintText:
                'Enter reason (min $_kMinAuditReasonLength characters for audit)',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
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

  Future<void> _refundSale(String saleId) async {
    final reason = await _askRefundReason();
    if (reason == null || reason.isEmpty) return;
    if (!_auditReasonOk(reason)) {
      if (mounted) _showAuditReasonTooShort(context);
      return;
    }
    setState(() => _actionBusy = true);
    try {
      final err = await ref.read(posProvider.notifier).refundSale(saleId, reason);
      if (!mounted) return;
      if (err != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sale refunded')),
        );
        await ref.read(posProvider.notifier).loadSalesHistory();
        if (mounted) Navigator.of(context).pop();
      }
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  Future<void> _shareReceipt({required bool forPrint}) async {
    final sale = _full ?? widget.preview;
    final saleId = (sale['id'] ?? '').toString();
    if (saleId.isEmpty || saleId.startsWith('OFFLINE-')) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Receipt is available after the sale syncs online.'),
          ),
        );
      }
      return;
    }
    setState(() => _actionBusy = true);
    try {
      await ref.read(posRepositoryProvider).shareSaleReceipt(
            saleId,
            shareText: forPrint
                ? 'Open this receipt to print or share (same as website).'
                : 'Save this receipt file (same as website).',
          );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open receipt: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final posState = ref.watch(posProvider);
    final currencyFormat =
        NumberFormat.currency(symbol: 'MWK ', decimalDigits: 2);
    final sale = _full ?? widget.preview;
    final saleNo = (sale['saleNumber'] ?? '').toString().trim();
    final id = (sale['id'] ?? '').toString();
    final title =
        saleNo.isNotEmpty ? 'Sale $saleNo' : 'Sale #$id';
    final total = _saleTotalAmount(sale);
    final items = (sale['items'] is List) ? (sale['items'] as List) : const [];
    final batchProducts =
        (sale['batchProducts'] is List) ? (sale['batchProducts'] as List) : const [];
    final statusLc = (sale['status'] ?? 'completed').toString().toLowerCase();
    final isOffline = id.startsWith('OFFLINE-');
    final canRefund = !isOffline &&
        posState.canRefundSales &&
        statusLc == 'completed';

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.92,
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
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (canRefund)
                  FilledButton.icon(
                    onPressed: _actionBusy ? null : () => _refundSale(id),
                    icon: const Icon(Icons.undo, size: 18),
                    label: const Text('Refund'),
                  ),
                OutlinedButton.icon(
                  onPressed: _actionBusy || isOffline
                      ? null
                      : () => _shareReceipt(forPrint: true),
                  icon: const Icon(Icons.print_outlined, size: 18),
                  label: const Text('Print receipt'),
                ),
                OutlinedButton.icon(
                  onPressed: _actionBusy || isOffline
                      ? null
                      : () => _shareReceipt(forPrint: false),
                  icon: const Icon(Icons.download_outlined, size: 18),
                  label: const Text('Download'),
                ),
              ],
            ),
            if (isOffline)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Refund and receipt file require a synced sale.',
                  style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                ),
              ),
            const SizedBox(height: 8),
            if (_full == null && _error == null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: cs.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Loading line items…',
                      style: TextStyle(color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
          _friendlyFullDetailsError(_error),
                  style: TextStyle(color: cs.error),
                ),
              ),
            Text(
              'Status: ${(sale['status'] ?? 'completed').toString().toUpperCase()}',
            ),
            Text('Total: ${currencyFormat.format(total)}'),
            if (sale['createdAt'] != null)
              Text('Date: ${sale['createdAt']}'),
            if (sale['saleDate'] != null)
              Text('Sale date: ${sale['saleDate']}'),
            const SizedBox(height: 12),
            const Text(
              'Items',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            if (items.isEmpty && batchProducts.isEmpty)
              Text(
                'No item breakdown available',
                style: TextStyle(color: cs.onSurfaceVariant),
              )
            else ...[
              ...items.map((item) {
                final m = item is Map<String, dynamic>
                    ? item
                    : Map<String, dynamic>.from(item as Map);
                final name = (m['product'] is Map)
                    ? ((m['product'] as Map)['name'] ?? '').toString()
                    : '';
                final line = name.isNotEmpty
                    ? name
                    : (m['description'] ?? m['name'] ?? 'Item').toString();
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(line),
                  subtitle: Text('Qty: ${m['quantity'] ?? 0}'),
                  trailing: Text(
                    currencyFormat.format(_lineAmountFromItem(m)),
                  ),
                );
              }),
              ...batchProducts.map((bp) {
                final m = bp is Map<String, dynamic>
                    ? bp
                    : Map<String, dynamic>.from(bp as Map);
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text((m['name'] ?? 'Item').toString()),
                  subtitle: Text('Qty: ${m['quantity'] ?? 0}'),
                  trailing: const Text('—'),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }
}

class _ProductListTile extends StatelessWidget {
  final PosProduct product;
  final int? cartQuantity;
  final VoidCallback onAdd;

  const _ProductListTile({
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
    final subtitleParts = <String>[];
    if (product.category != null && product.category!.trim().isNotEmpty) {
      subtitleParts.add(product.category!.trim());
    }
    if (product.sku != null && product.sku!.trim().isNotEmpty) {
      subtitleParts.add('SKU: ${product.sku!.trim()}');
    }

    return Card(
      elevation: inCart ? 1 : 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: inCart ? colorScheme.primary : colorScheme.outline.withValues(alpha: 0.35),
          width: inCart ? 2 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      color: inCart ? colorScheme.primaryContainer.withValues(alpha: 0.22) : null,
      child: InkWell(
        onTap: onAdd,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              CircleAvatar(
                backgroundColor: colorScheme.primaryContainer,
                child: Icon(
                  Icons.inventory_2_outlined,
                  color: colorScheme.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      product.name,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: colorScheme.onSurface,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (subtitleParts.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitleParts.join(' · '),
                        style: TextStyle(
                          fontSize: 12,
                          color: colorScheme.onSurfaceVariant,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    currencyFormat.format(product.price),
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: colorScheme.primary,
                    ),
                  ),
                  if (inCart)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.shopping_cart_checkout,
                            size: 14,
                            color: colorScheme.primary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${cartQuantity!}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 4),
              Icon(
                Icons.add_circle_outline,
                color: colorScheme.primary,
                size: 22,
              ),
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
