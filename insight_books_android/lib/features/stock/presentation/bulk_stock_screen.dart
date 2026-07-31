import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../domain/bulk_stock_csv_parser.dart';
import 'providers/bulk_stock_provider.dart';
import 'providers/stock_provider.dart';

class BulkStockScreen extends ConsumerStatefulWidget {
  const BulkStockScreen({super.key});

  @override
  ConsumerState<BulkStockScreen> createState() => _BulkStockScreenState();
}

class _BulkStockScreenState extends ConsumerState<BulkStockScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _deleteReasonCtrl = TextEditingController();
  final _deleteSearchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(bulkStockControllerProvider.notifier).initialize();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _deleteReasonCtrl.dispose();
    _deleteSearchCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImportFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['csv'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    if (file.size > 5 * 1024 * 1024) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('File must be smaller than 5MB')),
      );
      return;
    }

    String? content;
    if (file.bytes != null) {
      content = String.fromCharCodes(file.bytes!);
    } else if (file.path != null) {
      content = await File(file.path!).readAsString();
    }

    if (content == null) return;
    ref.read(bulkStockControllerProvider.notifier).parseCsvContent(content);
  }

  Future<void> _shareTemplate() async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/stock_template.csv');
    await file.writeAsString(bulkStockTemplateCsv());
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
  }

  Future<void> _exportAndShare() async {
    final stockState = ref.read(stockControllerProvider);
    final notifier = ref.read(bulkStockControllerProvider.notifier);
    try {
      final result = await notifier.exportCsv(
        search: stockState.searchQuery.isEmpty ? null : stockState.searchQuery,
        category: stockState.categoryFilter,
        status: stockState.statusFilter,
      );
      if (!mounted) return;
      if (result.bytes.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No data to export')),
        );
        return;
      }
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/${result.filename}');
      await file.writeAsBytes(result.bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(file.path)]));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Export failed: $e')),
      );
    }
  }

  Future<void> _runImport() async {
    final notifier = ref.read(bulkStockControllerProvider.notifier);
    try {
      final summary = await notifier.importPreviewRows();
      if (!mounted) return;
      final parts = <String>[];
      if ((summary['created'] ?? 0) > 0) {
        parts.add('${summary['created']} created');
      }
      if ((summary['restored'] ?? 0) > 0) {
        parts.add('${summary['restored']} restored');
      }
      if ((summary['failed'] ?? 0) > 0) {
        parts.add('${summary['failed']} failed');
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Import complete: ${parts.join(', ')}')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Import failed: $e')),
      );
    }
  }

  Future<void> _confirmBatchDelete() async {
    final bulkState = ref.read(bulkStockControllerProvider);
    if (bulkState.selectedDeleteIds.isEmpty) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete ${bulkState.selectedDeleteIds.length} products?'),
        content: const Text(
          'Selected products will be soft-deleted. This action applies to your whole business.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      final count = await ref
          .read(bulkStockControllerProvider.notifier)
          .batchDeleteSelected(reason: _deleteReasonCtrl.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Deleted $count product(s)')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delete failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bulkState = ref.watch(bulkStockControllerProvider);
    final theme = Theme.of(context);

    if (bulkState.isOffline) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Bulk stock')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.cloud_off, size: 48, color: theme.colorScheme.error),
                const SizedBox(height: 16),
                const Text(
                  'Bulk import, export, and batch delete require an internet connection.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () =>
                      ref.read(bulkStockControllerProvider.notifier).initialize(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Bulk stock'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: const [ThemeToggleButton()],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Import'),
            Tab(text: 'Export'),
            Tab(text: 'Delete'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildImportTab(bulkState),
          _buildExportTab(bulkState),
          _buildDeleteTab(bulkState),
        ],
      ),
    );
  }

  Widget _buildImportTab(BulkStockState bulkState) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bulk upload instructions',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                const Text(
                  '• CSV files only (max 5MB)\n'
                  '• Required: Name, SKU, Category, Price, Stock Level\n'
                  '• New products apply across your whole business\n'
                  '• Deleted SKU conflicts are restored when possible',
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _shareTemplate,
                      icon: const Icon(Icons.description_outlined),
                      label: const Text('Share template'),
                    ),
                    if (bulkState.canCreate)
                      FilledButton.icon(
                        onPressed: bulkState.isImporting ? null : _pickImportFile,
                        icon: const Icon(Icons.upload_file),
                        label: const Text('Pick CSV'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
        if (!bulkState.canCreate)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text('You need stock.create permission to import.'),
          ),
        if (bulkState.parseErrors.isNotEmpty) ...[
          const SizedBox(height: 16),
          _errorCard(
            title: 'Validation errors (${bulkState.parseErrors.length})',
            messages: bulkState.parseErrors,
          ),
        ],
        if (bulkState.previewRows.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            'Preview (${bulkState.previewRows.length} products)',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          ...bulkState.previewRows.take(20).map(
                (row) => ListTile(
                  dense: true,
                  title: Text(row.name),
                  subtitle: Text('${row.sku} · ${row.category} · ${row.price}'),
                  trailing: Text('Qty ${row.stockLevel}'),
                ),
              ),
          if (bulkState.previewRows.length > 20)
            Text('+ ${bulkState.previewRows.length - 20} more rows'),
          const SizedBox(height: 12),
          if (bulkState.canCreate)
            FilledButton.icon(
              onPressed: bulkState.isImporting ||
                      bulkState.parseErrors.isNotEmpty
                  ? null
                  : _runImport,
              icon: bulkState.isImporting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.cloud_upload),
              label: Text(
                bulkState.isImporting
                    ? 'Importing…'
                    : 'Import ${bulkState.previewRows.length} products',
              ),
            ),
        ],
        if (bulkState.importProgress != null) ...[
          const SizedBox(height: 16),
          LinearProgressIndicator(value: bulkState.importProgress!.fraction),
          const SizedBox(height: 8),
          Text(
            '${bulkState.importProgress!.processed}/${bulkState.importProgress!.total} · '
            '${bulkState.importProgress!.created} created · '
            '${bulkState.importProgress!.restored} restored · '
            '${bulkState.importProgress!.failed} failed',
          ),
          if (bulkState.importProgress!.currentLabel != null)
            Text('Current: ${bulkState.importProgress!.currentLabel}'),
        ],
        if (bulkState.importErrors.isNotEmpty) ...[
          const SizedBox(height: 16),
          _errorCard(
            title: 'Import errors (${bulkState.importErrors.length})',
            messages: bulkState.importErrors
                .map((e) => '${e.sku} (${e.name}): ${e.message}')
                .toList(),
          ),
        ],
      ],
    );
  }

  Widget _buildExportTab(BulkStockState bulkState) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Export stock data',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Exports current stock as CSV using the same filters as the stock list, then opens the share sheet.',
                ),
                const SizedBox(height: 16),
                if (bulkState.canExport)
                  FilledButton.icon(
                    onPressed: bulkState.isExporting ? null : _exportAndShare,
                    icon: bulkState.isExporting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download),
                    label: Text(
                      bulkState.isExporting ? 'Exporting…' : 'Export CSV',
                    ),
                  )
                else
                  const Text('You need stock.export permission to export.'),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDeleteTab(BulkStockState bulkState) {
    final notifier = ref.read(bulkStockControllerProvider.notifier);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!bulkState.canDelete)
                const Text('You need stock.delete permission to batch delete.'),
              TextField(
                controller: _deleteSearchCtrl,
                decoration: InputDecoration(
                  labelText: 'Search products',
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.search),
                    onPressed: () {
                      notifier.setDeleteSearch(_deleteSearchCtrl.text.trim());
                      notifier.loadDeleteCandidates();
                    },
                  ),
                ),
                onSubmitted: (_) {
                  notifier.setDeleteSearch(_deleteSearchCtrl.text.trim());
                  notifier.loadDeleteCandidates();
                },
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _deleteReasonCtrl,
                decoration: const InputDecoration(
                  labelText: 'Reason (optional)',
                ),
              ),
            ],
          ),
        ),
        if (bulkState.selectedDeleteIds.isNotEmpty)
          Material(
            color: Theme.of(context).colorScheme.primaryContainer,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${bulkState.selectedDeleteIds.length} selected',
                    ),
                  ),
                  TextButton(
                    onPressed: notifier.clearDeleteSelection,
                    child: const Text('Clear'),
                  ),
                  if (bulkState.canDelete)
                    FilledButton(
                      onPressed:
                          bulkState.isDeleting ? null : _confirmBatchDelete,
                      child: bulkState.isDeleting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Delete selected'),
                    ),
                ],
              ),
            ),
          ),
        Expanded(
          child: bulkState.isLoadingProducts
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: notifier.loadDeleteCandidates,
                  child: bulkState.deleteCandidates.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 48),
                            Center(child: Text('No products found')),
                          ],
                        )
                      : ListView.builder(
                          itemCount: bulkState.deleteCandidates.length,
                          itemBuilder: (context, index) {
                            final product = bulkState.deleteCandidates[index];
                            final selected = bulkState.selectedDeleteIds
                                .contains(product.id);
                            return CheckboxListTile(
                              value: selected,
                              onChanged: bulkState.canDelete
                                  ? (_) =>
                                      notifier.toggleDeleteSelection(product.id)
                                  : null,
                              title: Text(product.name),
                              subtitle: Text(
                                '${product.sku} · ${product.category ?? 'Uncategorized'}',
                              ),
                              secondary: Text('${product.quantityInStock}'),
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }

  Widget _errorCard({required String title, required List<String> messages}) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            ...messages.take(10).map((m) => Text('• $m')),
            if (messages.length > 10)
              Text('+ ${messages.length - 10} more errors'),
          ],
        ),
      ),
    );
  }
}
