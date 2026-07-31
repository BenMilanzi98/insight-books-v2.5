import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/features/tenant/data/tenant_repository.dart';
import 'package:insightbooks_android/features/tenant/domain/tenant_models.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../data/stock_repository.dart';
import '../domain/stock_models.dart';
import 'providers/stock_transfers_provider.dart';

class CreateTransferScreen extends ConsumerStatefulWidget {
  const CreateTransferScreen({super.key});

  @override
  ConsumerState<CreateTransferScreen> createState() =>
      _CreateTransferScreenState();
}

class _CreateTransferScreenState extends ConsumerState<CreateTransferScreen> {
  List<Tenant> _tenants = [];
  List<StockProduct> _products = [];
  String? _fromTenantId;
  String? _toTenantId;
  String? _productId;
  bool _directTransfer = true;
  bool _loadingTenants = true;
  bool _loadingProducts = false;
  bool _submitting = false;
  bool _isOffline = false;
  String? _loadError;

  final _qtyCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final online = await _checkOnline();
    if (!online) {
      if (mounted) {
        setState(() {
          _isOffline = true;
          _loadingTenants = false;
        });
      }
      return;
    }

    setState(() {
      _loadingTenants = true;
      _loadError = null;
      _isOffline = false;
    });
    try {
      final data =
          await ref.read(tenantRepositoryProvider).fetchTenants();
      final all = ((data['tenants'] as List?) ?? [])
          .map((t) => Tenant.fromJson(t as Map<String, dynamic>))
          .where((t) => t.hasActiveSubscriptionOrTrial)
          .toList();
      final currentId = data['currentTenantId']?.toString();
      if (!mounted) return;
      setState(() {
        _tenants = all;
        _fromTenantId = currentId ?? (all.isNotEmpty ? all.first.id : null);
        _loadingTenants = false;
      });
      if (_fromTenantId != null) {
        await _loadProducts(_fromTenantId!);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingTenants = false;
        _loadError = NetworkErrorMapper.toUserMessage(e);
        _isOffline = NetworkErrorMapper.isConnectionError(e);
      });
    }
  }

  Future<bool> _checkOnline() async {
    try {
      final result = await InternetAddress.lookup('example.com');
      return result.isNotEmpty && result.first.rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<void> _loadProducts(String tenantId) async {
    setState(() {
      _loadingProducts = true;
      _productId = null;
      _products = [];
    });
    try {
      final products = await ref
          .read(stockRepositoryProvider)
          .fetchProductsForTransferSource(tenantId: tenantId);
      if (!mounted) return;
      setState(() {
        _products = products;
        _productId = products.isNotEmpty ? products.first.id : null;
        _loadingProducts = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingProducts = false;
        _loadError = NetworkErrorMapper.toUserMessage(e);
        _isOffline = NetworkErrorMapper.isConnectionError(e);
      });
    }
  }

  StockProduct? get _selectedProduct {
    if (_productId == null) return null;
    for (final p in _products) {
      if (p.id == _productId) return p;
    }
    return null;
  }

  Future<void> _submit() async {
    if (_isOffline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Transfers require an internet connection.'),
        ),
      );
      return;
    }

    if (_fromTenantId == null || _toTenantId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select source and destination businesses.')),
      );
      return;
    }
    if (_fromTenantId == _toTenantId) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Source and destination must be different.'),
        ),
      );
      return;
    }
    if (_productId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a product.')),
      );
      return;
    }

    final qty = double.tryParse(_qtyCtrl.text.trim());
    if (qty == null || qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid quantity.')),
      );
      return;
    }

    final product = _selectedProduct;
    if (product != null && qty > product.quantityInStock) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Insufficient stock. Available: ${product.quantityInStock}',
          ),
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    final err = await ref
        .read(stockTransfersControllerProvider.notifier)
        .createTransfer(
          fromTenantId: _fromTenantId!,
          toTenantId: _toTenantId!,
          productId: _productId!,
          quantity: qty,
          notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
          directTransfer: _directTransfer,
        );
    if (!mounted) return;
    setState(() => _submitting = false);

    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Transfer created successfully')),
    );
    context.pop(true);
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final transfersState = ref.watch(stockTransfersControllerProvider);

    if (!transfersState.canManage) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Create transfer')),
        body: const Center(
          child: Text('You do not have permission to create transfers.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Create transfer'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: const [ThemeToggleButton()],
      ),
      body: _isOffline
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.cloud_off, size: 48),
                    const SizedBox(height: 12),
                    const Text(
                      'Transfers require an internet connection',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _bootstrap,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : _loadingTenants
              ? const Center(child: CircularProgressIndicator())
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_loadError != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            _loadError!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ),
                      DropdownButtonFormField<String>(
                        value: _fromTenantId,
                        decoration: const InputDecoration(
                          labelText: 'From business',
                          border: OutlineInputBorder(),
                        ),
                        items: _tenants
                            .map(
                              (t) => DropdownMenuItem(
                                value: t.id,
                                child: Text(t.name),
                              ),
                            )
                            .toList(),
                        onChanged: (v) async {
                          setState(() => _fromTenantId = v);
                          if (v != null) await _loadProducts(v);
                        },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _toTenantId,
                        decoration: const InputDecoration(
                          labelText: 'To business',
                          border: OutlineInputBorder(),
                        ),
                        items: _tenants
                            .where((t) => t.id != _fromTenantId)
                            .map(
                              (t) => DropdownMenuItem(
                                value: t.id,
                                child: Text(t.name),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => setState(() => _toTenantId = v),
                      ),
                      const SizedBox(height: 12),
                      if (_loadingProducts)
                        const LinearProgressIndicator()
                      else
                        DropdownButtonFormField<String>(
                          value: _productId,
                          decoration: const InputDecoration(
                            labelText: 'Product',
                            border: OutlineInputBorder(),
                          ),
                          items: _products
                              .map(
                                (p) => DropdownMenuItem(
                                  value: p.id,
                                  child: Text(
                                    '${p.name}${p.sku != null ? ' (${p.sku})' : ''} · ${p.quantityInStock}',
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _productId = v),
                        ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _qtyCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: InputDecoration(
                          labelText: 'Quantity',
                          border: const OutlineInputBorder(),
                          helperText: _selectedProduct != null
                              ? 'Available: ${_selectedProduct!.quantityInStock}'
                              : null,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _notesCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Notes (optional)',
                          border: OutlineInputBorder(),
                        ),
                        maxLines: 3,
                      ),
                      const SizedBox(height: 12),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Direct transfer'),
                        subtitle: const Text(
                          'When on, stock moves immediately. When off, transfer stays pending for approval.',
                        ),
                        value: _directTransfer,
                        onChanged: (v) => setState(() => _directTransfer = v),
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _submitting ? null : _submit,
                        child: _submitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Create transfer'),
                      ),
                    ],
                  ),
                ),
    );
  }
}
