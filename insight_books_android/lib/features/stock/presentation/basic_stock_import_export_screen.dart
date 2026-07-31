import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../data/stock_repository.dart';
import 'providers/stock_provider.dart';

/// v2.5 basic Excel import/export (4-column business-scoped template).
class BasicStockImportExportScreen extends ConsumerStatefulWidget {
  const BasicStockImportExportScreen({super.key});

  @override
  ConsumerState<BasicStockImportExportScreen> createState() =>
      _BasicStockImportExportScreenState();
}

class _BasicStockImportExportScreenState
    extends ConsumerState<BasicStockImportExportScreen> {
  bool _busy = false;
  String? _error;
  String? _filename;
  Uint8List? _fileBytes;
  Map<String, dynamic>? _preview;
  Map<String, dynamic>? _result;
  bool _updateSellingPrice = true;
  bool _forceAsNewReceipt = false;

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['xlsx', 'xls'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    setState(() {
      _filename = file.name;
      _fileBytes = file.bytes;
      _preview = null;
      _result = null;
      _error = null;
    });
  }

  Future<void> _downloadTemplate({required bool example}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final bytes = await ref
          .read(stockRepositoryProvider)
          .downloadBasicImportTemplate(example: example);
      final dir = await getTemporaryDirectory();
      final path =
          '${dir.path}/Stock_Import_Template${example ? '_example' : ''}.xlsx';
      await File(path).writeAsBytes(bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(path)]));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _runPreview() async {
    if (_fileBytes == null || _filename == null) {
      setState(() => _error = 'Choose an Excel file first.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
    });
    try {
      final data = await ref.read(stockRepositoryProvider).previewBasicImport(
            fileBytes: _fileBytes!,
            filename: _filename!,
            updateSellingPrice: _updateSellingPrice,
            forceAsNewReceipt: _forceAsNewReceipt,
          );
      setState(() {
        _preview = data['preview'] is Map
            ? Map<String, dynamic>.from(data['preview'] as Map)
            : data;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _preview = null;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _runConfirm() async {
    if (_fileBytes == null || _filename == null) {
      setState(() => _error = 'Choose an Excel file first.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await ref.read(stockRepositoryProvider).confirmBasicImport(
            fileBytes: _fileBytes!,
            filename: _filename!,
            updateSellingPrice: _updateSellingPrice,
            forceAsNewReceipt: _forceAsNewReceipt,
          );
      setState(() {
        _result = data['result'] is Map
            ? Map<String, dynamic>.from(data['result'] as Map)
            : data;
      });
      await ref.read(stockControllerProvider.notifier).refresh();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _export() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final bytes =
          await ref.read(stockRepositoryProvider).downloadBasicExport();
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/stock_basic_export.xlsx';
      await File(path).writeAsBytes(bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(path)]));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final page = ref.watch(stockControllerProvider);

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Basic import / export'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: const [ThemeToggleButton()],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Columns: Item Name, Quantity, Order Price, Selling Price. '
            'Scoped to the current business (no branch).',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          if (_error != null) ...[
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 12),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (page.canCreate) ...[
                OutlinedButton(
                  onPressed: _busy ? null : () => _downloadTemplate(example: false),
                  child: const Text('Download template'),
                ),
                OutlinedButton(
                  onPressed: _busy ? null : () => _downloadTemplate(example: true),
                  child: const Text('Template + example'),
                ),
              ],
              if (page.canExport)
                FilledButton.tonal(
                  onPressed: _busy ? null : _export,
                  child: const Text('Export Excel'),
                ),
            ],
          ),
          const SizedBox(height: 24),
          if (page.canCreate) ...[
            Text('Import', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : _pickFile,
              icon: const Icon(Icons.upload_file),
              label: Text(_filename ?? 'Choose Excel file'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Update selling price'),
              value: _updateSellingPrice,
              onChanged: _busy
                  ? null
                  : (v) => setState(() => _updateSellingPrice = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Force as new receipt'),
              value: _forceAsNewReceipt,
              onChanged: _busy
                  ? null
                  : (v) => setState(() => _forceAsNewReceipt = v),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : _runPreview,
                    child: const Text('Preview'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : _runConfirm,
                    child: const Text('Confirm import'),
                  ),
                ),
              ],
            ),
            if (_busy) ...[
              const SizedBox(height: 16),
              const LinearProgressIndicator(),
            ],
            if (_preview != null) ...[
              const SizedBox(height: 16),
              Text('Preview', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              SelectableText(_preview.toString()),
            ],
            if (_result != null) ...[
              const SizedBox(height: 16),
              Text('Result', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              SelectableText(_result.toString()),
            ],
          ],
        ],
      ),
    );
  }
}
