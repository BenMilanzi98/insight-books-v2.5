import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'package:insightbooks_android/core/config/app_public_urls.dart';
import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../data/stock_repository.dart';
import '../domain/stock_models.dart';
import 'providers/stock_details_provider.dart';
import 'providers/stock_provider.dart';

class CreateEditProductScreen extends ConsumerStatefulWidget {
  final String? productId;

  const CreateEditProductScreen({super.key, this.productId});

  @override
  ConsumerState<CreateEditProductScreen> createState() =>
      _CreateEditProductScreenState();
}

class _CreateEditProductScreenState
    extends ConsumerState<CreateEditProductScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _skuCtrl = TextEditingController();
  final _unitPriceCtrl = TextEditingController();
  final _costPriceCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController(text: '0');
  final _reorderCtrl = TextEditingController(text: '0');
  final _descriptionCtrl = TextEditingController();
  final _newBarcodeCtrl = TextEditingController();

  bool _isPerishable = false;
  bool _isSubmitting = false;
  bool _isLoading = true;
  bool _isOffline = false;
  String? _loadError;

  List<String> _categories = [];
  List<String> _locations = [];
  List<StockBaseUnit> _baseUnits = [];
  List<StockTaxTypeOption> _taxTypes = [];
  String? _selectedCategory;
  String? _selectedLocation;
  final Set<String> _selectedTaxIds = {};
  List<String> _barcodes = [];

  bool _unitManagementEnabled = false;
  String? _selectedBaseUnitId;
  final Set<String> _selectedUnitIds = {};

  String? _existingImageUrl;
  String? _pendingImagePath;

  bool get _isEdit =>
      widget.productId != null && widget.productId!.trim().isNotEmpty;

  List<StockUnitOption> get _unitsForSelectedBase {
    if (_selectedBaseUnitId == null) return const [];
    for (final base in _baseUnits) {
      if (base.id == _selectedBaseUnitId) return base.units;
    }
    return const [];
  }

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<bool> _checkOnline() async {
    try {
      final result = await InternetAddress.lookup('example.com');
      return result.isNotEmpty && result.first.rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<void> _bootstrap() async {
    final online = await _checkOnline();
    if (!online) {
      if (mounted) {
        setState(() {
          _isOffline = true;
          _isLoading = false;
        });
      }
      return;
    }

    setState(() {
      _isLoading = true;
      _loadError = null;
      _isOffline = false;
    });

    final repo = ref.read(stockRepositoryProvider);
    try {
      final results = await Future.wait([
        repo.fetchStockCategories(),
        repo.fetchLocations(),
        repo.fetchUnits(),
        repo.fetchTaxTypes(),
      ]);

      _categories = results[0] as List<String>;
      _locations = results[1] as List<String>;
      _baseUnits = results[2] as List<StockBaseUnit>;
      _taxTypes = results[3] as List<StockTaxTypeOption>;

      if (_isEdit) {
        await _loadProductForEdit(repo);
      }

      if (!mounted) return;
      setState(() => _isLoading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _loadError = NetworkErrorMapper.toUserMessage(e);
        _isOffline = NetworkErrorMapper.isConnectionError(e);
      });
    }
  }

  Future<void> _loadProductForEdit(StockRepository repo) async {
    final product = await repo.fetchProduct(widget.productId!);
    final taxIds = await repo.fetchProductTaxIds(widget.productId!);

    _nameCtrl.text = product.name;
    _skuCtrl.text = product.sku ?? '';
    _unitPriceCtrl.text = product.unitPrice.toString();
    _costPriceCtrl.text = product.costPrice.toString();
    _qtyCtrl.text = product.quantityInStock.toString();
    _reorderCtrl.text = product.reorderPoint.toString();
    _descriptionCtrl.text = product.description ?? '';
    _isPerishable = product.isPerishable;
    _selectedCategory = product.category;
    _selectedLocation = product.location;
    _barcodes = List<String>.from(product.barcodes);
    _selectedTaxIds
      ..clear()
      ..addAll(taxIds);
    _existingImageUrl = product.imageUrl;

    if (product.hasUnitManagement) {
      _unitManagementEnabled = true;
      _selectedUnitIds
        ..clear()
        ..addAll(product.productUnits.map((u) => u.id));
      final first = product.productUnits.first;
      _selectedBaseUnitId = first.baseUnitId ??
          _baseUnits
              .firstWhere(
                (b) => b.units.any((u) => u.id == first.id),
                orElse: () => _baseUnits.isNotEmpty
                    ? _baseUnits.first
                    : const StockBaseUnit(id: '', displayName: ''),
              )
              .id;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _skuCtrl.dispose();
    _unitPriceCtrl.dispose();
    _costPriceCtrl.dispose();
    _qtyCtrl.dispose();
    _reorderCtrl.dispose();
    _descriptionCtrl.dispose();
    _newBarcodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1200,
      imageQuality: 85,
    );
    if (file == null) return;
    final length = await file.length();
    if (length > 2 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image must be 2MB or smaller')),
        );
      }
      return;
    }
    setState(() => _pendingImagePath = file.path);
  }

  void _clearImage() {
    setState(() {
      _pendingImagePath = null;
      _existingImageUrl = null;
    });
  }

  void _addBarcode() {
    final value = _newBarcodeCtrl.text.trim();
    if (value.isEmpty || _barcodes.contains(value)) return;
    setState(() {
      _barcodes = [..._barcodes, value];
      _newBarcodeCtrl.clear();
    });
  }

  void _removeBarcode(String barcode) {
    setState(() => _barcodes = _barcodes.where((b) => b != barcode).toList());
  }

  Future<String?> _promptNewOption(String label) async {
    final ctrl = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Add $label'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(hintText: '$label name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    return value != null && value.isNotEmpty ? value : null;
  }

  Future<void> _addCategoryOption() async {
    final value = await _promptNewOption('category');
    if (value == null) return;
    setState(() {
      if (!_categories.contains(value)) {
        _categories = [..._categories, value];
      }
      _selectedCategory = value;
    });
  }

  Future<void> _addLocationOption() async {
    final value = await _promptNewOption('location');
    if (value == null) return;
    setState(() {
      if (!_locations.contains(value)) {
        _locations = [..._locations, value];
      }
      _selectedLocation = value;
    });
  }

  Map<String, dynamic> _body() {
    double parseNum(String raw) => double.tryParse(raw.trim()) ?? 0;

    final body = <String, dynamic>{
      'name': _nameCtrl.text.trim(),
      'sku': _skuCtrl.text.trim().isEmpty ? null : _skuCtrl.text.trim(),
      'unitPrice': parseNum(_unitPriceCtrl.text),
      'costPrice': parseNum(_costPriceCtrl.text),
      'quantityInStock': parseNum(_qtyCtrl.text),
      'reorderPoint': parseNum(_reorderCtrl.text),
      'category': (_selectedCategory ?? '').trim().isEmpty
          ? null
          : _selectedCategory!.trim(),
      'location': (_selectedLocation ?? '').trim().isEmpty
          ? null
          : _selectedLocation!.trim(),
      'description': _descriptionCtrl.text.trim().isEmpty
          ? null
          : _descriptionCtrl.text.trim(),
      'isPerishable': _isPerishable,
      'isService': false,
      'barcodes': _barcodes,
    };

    if (_unitManagementEnabled && _selectedUnitIds.isNotEmpty) {
      StockBaseUnit? baseUnit;
      for (final b in _baseUnits) {
        if (b.id == _selectedBaseUnitId) {
          baseUnit = b;
          break;
        }
      }

      final selectedUnits = _unitsForSelectedBase
          .where((u) => _selectedUnitIds.contains(u.id))
          .map((u) => {
                'id': u.id,
                'name': u.name,
                'symbol': u.symbol,
                'isBaseUnit': u.isBaseUnit,
                'conversionToBase': u.conversionToBase,
                'baseUnitId': u.baseUnitId,
              })
          .toList();

      final unitConfigurations = <String, dynamic>{};
      for (final u in selectedUnits) {
        final id = u['id']?.toString() ?? '';
        if (id.isEmpty) continue;
        unitConfigurations[id] = {
          'unitPrice': parseNum(_unitPriceCtrl.text),
          'costPrice': parseNum(_costPriceCtrl.text),
          'quantityInStock': parseNum(_qtyCtrl.text),
          'reorderPoint': parseNum(_reorderCtrl.text),
          'isDefault': u['isBaseUnit'] == true,
        };
      }

      body['unitManagementEnabled'] = true;
      if (baseUnit != null) {
        body['selectedBaseUnit'] = {
          'id': baseUnit.id,
          'displayName': baseUnit.displayName,
        };
      }
      body['selectedUnits'] = selectedUnits;
      body['unitConfigurations'] = unitConfigurations;
    } else {
      body['unitManagementEnabled'] = false;
      body['selectedUnits'] = [];
      body['unitConfigurations'] = {};
    }

    return body;
  }

  Future<void> _handleSkuConflict(DioException e) async {
    final data = e.response?.data;
    String? deletedId;
    if (data is Map) {
      deletedId = (data['deletedProductId'] ?? data['productId'] ?? data['id'])
          ?.toString();
    }
    if (!mounted) return;
    final choice = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('SKU already exists'),
        content: Text(
          deletedId != null && deletedId.isNotEmpty
              ? 'A deleted product uses this SKU. Restore it, or change the SKU and save again.'
              : 'This SKU conflicts with an existing product. Change the SKU and try again.',
        ),
        actions: [
          if (deletedId != null && deletedId.isNotEmpty)
            TextButton(
              onPressed: () => Navigator.of(ctx).pop('restore'),
              child: const Text('Restore'),
            ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop('change'),
            child: const Text('Change SKU'),
          ),
        ],
      ),
    );
    if (choice == 'restore' && deletedId != null && deletedId.isNotEmpty) {
      await ref.read(stockRepositoryProvider).restoreProducts([deletedId]);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Product restored.')),
      );
      ref.invalidate(stockControllerProvider);
      context.pop();
    }
  }

  Future<void> _save() async {
    if (_isOffline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Create/edit requires an internet connection.'),
        ),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    final repo = ref.read(stockRepositoryProvider);
    try {
      StockProduct saved;
      if (_isEdit) {
        saved = await repo.updateProduct(widget.productId!, _body());
      } else {
        saved = await repo.createProduct(_body());
      }

      final productId = _isEdit ? widget.productId! : saved.id;

      try {
        await repo.saveProductTaxes(productId, _selectedTaxIds.toList());
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Product saved but taxes failed: ${NetworkErrorMapper.toUserMessage(e)}',
              ),
            ),
          );
        }
      }

      if (_pendingImagePath != null && _pendingImagePath!.isNotEmpty) {
        try {
          await repo.uploadProductImage(
            productId: productId,
            filePath: _pendingImagePath!,
          );
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Product saved but image upload failed: ${NetworkErrorMapper.toUserMessage(e)}',
                ),
              ),
            );
          }
        }
      }

      ref.invalidate(stockControllerProvider);
      if (_isEdit) {
        ref.invalidate(stockDetailsProvider(widget.productId!));
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEdit ? 'Product updated' : 'Product created'),
        ),
      );
      context.pop();
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        await _handleSkuConflict(e);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: ${e.message ?? e}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Save failed: ${NetworkErrorMapper.toUserMessage(e)}',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Widget _buildImageSection(ThemeData theme) {
    final previewPath = _pendingImagePath;
    final remoteUrl = resolveAppAssetUrl(_existingImageUrl);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Product image', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        InkWell(
          onTap: _pickImage,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            width: double.infinity,
            height: 140,
            decoration: BoxDecoration(
              border: Border.all(color: theme.dividerColor),
              borderRadius: BorderRadius.circular(12),
            ),
            child: previewPath != null
                ? Stack(
                    fit: StackFit.expand,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(11),
                        child: Image.file(File(previewPath), fit: BoxFit.contain),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: IconButton.filledTonal(
                          onPressed: _clearImage,
                          icon: const Icon(Icons.close, size: 18),
                        ),
                      ),
                    ],
                  )
                : remoteUrl != null
                    ? Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(11),
                            child: Image.network(remoteUrl, fit: BoxFit.contain),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: IconButton.filledTonal(
                              onPressed: _clearImage,
                              icon: const Icon(Icons.close, size: 18),
                            ),
                          ),
                        ],
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.upload, color: theme.hintColor, size: 36),
                          const SizedBox(height: 8),
                          Text(
                            'Tap to upload (max 2MB)',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
          ),
        ),
      ],
    );
  }

  Widget _buildBarcodesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Barcodes'),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _newBarcodeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Add barcode',
                  hintText: 'Scan or enter barcode',
                ),
                onSubmitted: (_) => _addBarcode(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: _addBarcode,
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        if (_barcodes.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _barcodes
                .map(
                  (bc) => InputChip(
                    label: Text(bc, style: const TextStyle(fontFamily: 'monospace')),
                    onDeleted: () => _removeBarcode(bc),
                  ),
                )
                .toList(),
          ),
        ],
      ],
    );
  }

  Widget _buildTaxSection(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Taxes', style: theme.textTheme.titleSmall),
        Text(
          'Applied automatically in POS',
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: 8),
        if (_taxTypes.isEmpty)
          Text(
            'No active tax types available.',
            style: theme.textTheme.bodySmall,
          )
        else
          DecoratedBox(
            decoration: BoxDecoration(
              border: Border.all(color: theme.dividerColor),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: _taxTypes.map((tax) {
                final label = tax.taxCode != null && tax.taxCode!.isNotEmpty
                    ? '${tax.taxName} (${tax.taxCode})'
                    : tax.taxName;
                final rateLabel = tax.calculationType == 'Fixed'
                    ? '${tax.taxRate} MWK'
                    : '${tax.taxRate}%';
                return CheckboxListTile(
                  dense: true,
                  title: Text(label),
                  subtitle: Text(rateLabel),
                  value: _selectedTaxIds.contains(tax.id),
                  onChanged: (checked) {
                    setState(() {
                      if (checked == true) {
                        _selectedTaxIds.add(tax.id);
                      } else {
                        _selectedTaxIds.remove(tax.id);
                      }
                    });
                  },
                );
              }).toList(),
            ),
          ),
      ],
    );
  }

  Widget _buildUnitSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Unit management'),
          subtitle: const Text('Sell in multiple units (e.g. kg, g)'),
          value: _unitManagementEnabled,
          onChanged: (enabled) {
            setState(() {
              _unitManagementEnabled = enabled;
              if (enabled &&
                  _selectedBaseUnitId == null &&
                  _baseUnits.isNotEmpty) {
                _selectedBaseUnitId = _baseUnits.first.id;
              }
              if (!enabled) {
                _selectedUnitIds.clear();
              }
            });
          },
        ),
        if (_unitManagementEnabled) ...[
          if (_baseUnits.isEmpty)
            const Text('No units catalog available.')
          else ...[
            DropdownButtonFormField<String>(
              value: _selectedBaseUnitId,
              decoration: const InputDecoration(labelText: 'Base unit family'),
              items: _baseUnits
                  .map(
                    (b) => DropdownMenuItem(
                      value: b.id,
                      child: Text(b.displayName),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                setState(() {
                  _selectedBaseUnitId = value;
                  _selectedUnitIds.clear();
                });
              },
            ),
            const SizedBox(height: 8),
            ..._unitsForSelectedBase.map(
              (unit) => CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text(
                  unit.symbol != null && unit.symbol!.isNotEmpty
                      ? '${unit.name} (${unit.symbol})'
                      : unit.name,
                ),
                subtitle: unit.isBaseUnit ? const Text('Base unit') : null,
                value: _selectedUnitIds.contains(unit.id),
                onChanged: (checked) {
                  setState(() {
                    if (checked == true) {
                      _selectedUnitIds.add(unit.id);
                    } else {
                      _selectedUnitIds.remove(unit.id);
                    }
                  });
                },
              ),
            ),
          ],
        ],
      ],
    );
  }

  Widget _buildCategoryDropdown() {
    final options = List<String>.from(_categories);
    if (_selectedCategory != null &&
        _selectedCategory!.isNotEmpty &&
        !options.contains(_selectedCategory)) {
      options.insert(0, _selectedCategory!);
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: DropdownButtonFormField<String>(
            value: _selectedCategory,
            decoration: const InputDecoration(labelText: 'Category'),
            items: options
                .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                .toList(),
            onChanged: (v) => setState(() => _selectedCategory = v),
          ),
        ),
        IconButton(
          tooltip: 'Add category',
          onPressed: _addCategoryOption,
          icon: const Icon(Icons.add),
        ),
      ],
    );
  }

  Widget _buildLocationDropdown() {
    final options = List<String>.from(_locations);
    if (_selectedLocation != null &&
        _selectedLocation!.isNotEmpty &&
        !options.contains(_selectedLocation)) {
      options.insert(0, _selectedLocation!);
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: DropdownButtonFormField<String>(
            value: _selectedLocation,
            decoration: const InputDecoration(labelText: 'Location'),
            items: options
                .map((l) => DropdownMenuItem(value: l, child: Text(l)))
                .toList(),
            onChanged: (v) => setState(() => _selectedLocation = v),
          ),
        ),
        IconButton(
          tooltip: 'Add location',
          onPressed: _addLocationOption,
          icon: const Icon(Icons.add),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Product' : 'Add Product'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: const [ThemeToggleButton()],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _isOffline
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.cloud_off, size: 48),
                        const SizedBox(height: 12),
                        const Text(
                          'Create and edit products requires an internet connection.',
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _bootstrap,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _loadError != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_loadError!, textAlign: TextAlign.center),
                            const SizedBox(height: 16),
                            FilledButton(
                              onPressed: _bootstrap,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : Form(
                      key: _formKey,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildImageSection(theme),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _nameCtrl,
                            decoration:
                                const InputDecoration(labelText: 'Name *'),
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Required'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _skuCtrl,
                            decoration:
                                const InputDecoration(labelText: 'SKU'),
                          ),
                          const SizedBox(height: 12),
                          _buildBarcodesSection(),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _unitPriceCtrl,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                                  decoration: const InputDecoration(
                                    labelText: 'Unit price',
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: _costPriceCtrl,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                                  decoration: const InputDecoration(
                                    labelText: 'Cost price',
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _qtyCtrl,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                                  decoration: const InputDecoration(
                                    labelText: 'Quantity in stock',
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: _reorderCtrl,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                                  decoration: const InputDecoration(
                                    labelText: 'Reorder point',
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _buildCategoryDropdown(),
                          const SizedBox(height: 12),
                          _buildLocationDropdown(),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _descriptionCtrl,
                            maxLines: 3,
                            decoration: const InputDecoration(
                              labelText: 'Description',
                            ),
                          ),
                          const SizedBox(height: 12),
                          _buildUnitSection(),
                          const SizedBox(height: 12),
                          _buildTaxSection(theme),
                          const SizedBox(height: 12),
                          SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Perishable'),
                            value: _isPerishable,
                            onChanged: (v) => setState(() => _isPerishable = v),
                          ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: _isSubmitting ? null : _save,
                            child: _isSubmitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Text(
                                    _isEdit ? 'Save changes' : 'Create product',
                                  ),
                          ),
                          Text(
                            'Online only for create/edit, taxes, and image upload.',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
    );
  }
}
