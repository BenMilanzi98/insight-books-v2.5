import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../data/purchases_offline_helpers.dart';
import '../domain/purchases_models.dart';
import 'providers/orders_provider.dart';

const _orderTypes = [
  ('goods', 'Inventory / Goods'),
  ('services', 'Goods & Services'),
  ('assets', 'Asset Purchase'),
];

class OrderLineDraft {
  OrderLineDraft({
    this.lineType = 'goods',
    this.productId,
    this.productUnitId,
    this.expenseCategoryId,
    this.description = '',
    this.quantityOrdered = 1,
    this.unitCost = 0,
    this.taxTypeId,
    this.taxRate = 0,
    this.taxAmount = 0,
    this.quantityReceived = 0,
  });

  String lineType;
  String? productId;
  String? productUnitId;
  String? expenseCategoryId;
  String description;
  double quantityOrdered;
  double unitCost;
  String? taxTypeId;
  double taxRate;
  double taxAmount;
  double quantityReceived;

  Map<String, dynamic> toPayloadMap() => {
        'lineType': lineType,
        'productId': productId,
        'productUnitId': productUnitId,
        'expenseCategoryId': expenseCategoryId,
        'description': description,
        'quantityOrdered': quantityOrdered,
        'unitCost': unitCost,
        'taxTypeId': taxTypeId,
        'taxRate': taxRate,
        'taxAmount': taxAmount,
      };
}

class CreateEditOrderScreen extends ConsumerStatefulWidget {
  final String? orderId;

  const CreateEditOrderScreen({super.key, this.orderId});

  @override
  ConsumerState<CreateEditOrderScreen> createState() =>
      _CreateEditOrderScreenState();
}

class _CreateEditOrderScreenState extends ConsumerState<CreateEditOrderScreen> {
  final _formKey = GlobalKey<FormState>();
  final _notesCtrl = TextEditingController();

  String _orderType = 'goods';
  String? _supplierId;
  String _status = 'Draft';
  DateTime _poDate = DateTime.now();
  DateTime? _expectedDeliveryDate;
  bool _pricesIncludeTax = false;
  List<OrderLineDraft> _lines = [OrderLineDraft()];
  bool _isSubmitting = false;
  String? _loadError;
  PurchaseOrder? _loadedOrder;

  bool get _isEdit =>
      widget.orderId != null && widget.orderId!.trim().isNotEmpty;

  bool get _isLocked =>
      _loadedOrder?.isLocked == true ||
      _lines.any((l) => l.quantityReceived > 0);

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  void _applyOrder(PurchaseOrder order) {
    _loadedOrder = order;
    _orderType = order.orderType;
    _supplierId = order.supplierId.isNotEmpty ? order.supplierId : null;
    _status = order.status;
    _poDate = order.poDate ?? DateTime.now();
    _expectedDeliveryDate = order.expectedDeliveryDate;
    _pricesIncludeTax = order.pricesIncludeTax;
    _notesCtrl.text = order.notes ?? '';
    if (order.items.isNotEmpty) {
      _lines = order.items
          .map(
            (item) => OrderLineDraft(
              lineType: item.lineType,
              productId: item.productId,
              productUnitId: item.productUnitId,
              expenseCategoryId: item.expenseCategoryId,
              description: item.description ?? '',
              quantityOrdered: item.quantityOrdered,
              unitCost: item.unitCost,
              taxTypeId: item.taxTypeId,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
              quantityReceived: item.quantityReceived,
            ),
          )
          .toList();
    }
  }

  String _defaultLineTypeForOrder(String orderType) {
    if (orderType == 'assets') return 'asset';
    if (orderType == 'services') return 'service';
    return 'goods';
  }

  void _onOrderTypeChanged(String? value) {
    if (value == null) return;
    setState(() {
      _orderType = value;
      for (final line in _lines) {
        if (value == 'goods') {
          line.lineType = 'goods';
          line.expenseCategoryId = null;
        } else if (value == 'assets') {
          line.lineType = 'asset';
          line.productId = null;
          line.productUnitId = null;
        } else if (line.lineType == 'goods' && line.productId == null) {
          line.lineType = 'service';
        }
      }
    });
  }

  void _addLine() {
    setState(() {
      _lines.add(OrderLineDraft(lineType: _defaultLineTypeForOrder(_orderType)));
    });
  }

  void _removeLine(int index) {
    if (_lines.length <= 1) return;
    setState(() => _lines.removeAt(index));
  }

  ({double subtotal, double tax, double total}) _totals() {
    var sub = 0.0;
    var tax = 0.0;
    for (final line in _lines) {
      final qty = line.quantityOrdered;
      final unitCost = line.unitCost;
      final taxRatePct = line.taxRate;
      double lineSub;
      var lineTax = line.taxAmount;
      if (_pricesIncludeTax && taxRatePct > 0) {
        final inclusive = multiplyMoney(qty, unitCost);
        lineSub = roundMoney(inclusive / (1 + taxRatePct / 100));
        lineTax = subtractMoney(inclusive, lineSub);
      } else {
        lineSub = multiplyMoney(qty, unitCost);
        if (lineTax == 0 && taxRatePct > 0) {
          lineTax = percentOfMoney(lineSub, taxRatePct);
        }
      }
      sub = roundMoney(sub + lineSub);
      tax = roundMoney(tax + lineTax);
    }
    return (subtotal: sub, tax: tax, total: roundMoney(sub + tax));
  }

  Future<void> _pickDate({required bool poDate}) async {
    final initial = poDate
        ? _poDate
        : (_expectedDeliveryDate ?? _poDate);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (poDate) {
        _poDate = picked;
        if (_expectedDeliveryDate != null &&
            _expectedDeliveryDate!.isBefore(_poDate)) {
          _expectedDeliveryDate = null;
        }
      } else {
        _expectedDeliveryDate = picked;
      }
    });
  }

  Future<void> _save() async {
    if (_isLocked) return;
    if (!_formKey.currentState!.validate()) return;
    if (_supplierId == null || _supplierId!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a supplier')),
      );
      return;
    }

    for (var i = 0; i < _lines.length; i++) {
      final line = _lines[i];
      if (line.quantityOrdered <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Line ${i + 1}: quantity must be greater than 0')),
        );
        return;
      }
      if (line.unitCost < 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Line ${i + 1}: unit cost cannot be negative')),
        );
        return;
      }
      if (_orderType == 'goods' && (line.productId == null || line.productId!.isEmpty)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Line ${i + 1}: select a product')),
        );
        return;
      }
      if (_orderType == 'assets') {
        if (line.description.trim().isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Line ${i + 1}: description is required')),
          );
          return;
        }
        if (line.expenseCategoryId == null || line.expenseCategoryId!.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Line ${i + 1}: select an expense category')),
          );
          return;
        }
      }
      if (_orderType == 'services' &&
          line.lineType != 'goods' &&
          line.description.trim().isEmpty &&
          (line.expenseCategoryId == null || line.expenseCategoryId!.isEmpty)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Line ${i + 1}: service lines need description or category')),
        );
        return;
      }
    }

    setState(() => _isSubmitting = true);
    final dateStr = DateFormat('yyyy-MM-dd').format(_poDate);
    final expectedStr = _expectedDeliveryDate != null
        ? DateFormat('yyyy-MM-dd').format(_expectedDeliveryDate!)
        : null;

    final payload = buildOrderPayload(
      supplierId: _supplierId!,
      orderType: _orderType,
      poDate: dateStr,
      expectedDeliveryDate: expectedStr,
      status: _status,
      notes: _notesCtrl.text,
      pricesIncludeTax: _pricesIncludeTax,
      rawItems: _lines.map((l) => l.toPayloadMap()).toList(),
    );

    final notifier = ref.read(ordersControllerProvider.notifier);
    try {
      if (_isEdit) {
        await notifier.updateOrder(widget.orderId!, payload);
      } else {
        await notifier.createOrder(payload);
      }
      if (!mounted) return;
      context.pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEdit ? 'Purchase order updated' : 'Purchase order created'),
        ),
      );
    } on PurchasesQueuedException {
      if (!mounted) return;
      context.pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Queued for sync')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(NetworkErrorMapper.toUserMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final supportAsync = ref.watch(orderFormSupportProvider);
    final orderAsync = _isEdit
        ? ref.watch(orderDetailProvider(widget.orderId!))
        : const AsyncValue.data(null);

    if (_isEdit && orderAsync.hasValue && _loadedOrder == null) {
      _applyOrder(orderAsync.value!);
    }

    final dateFormat = DateFormat.yMMMd();
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);
    final totals = _totals();
    final page = ref.watch(ordersControllerProvider);
    final canSave = _isEdit ? page.canUpdate : page.canCreate;

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit purchase order' : 'New purchase order'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: const [ThemeToggleButton()],
      ),
      body: supportAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Failed to load form data: $e'),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => ref.invalidate(orderFormSupportProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (support) {
          if (_isEdit && orderAsync.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (_isEdit && orderAsync.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(NetworkErrorMapper.toUserMessage(orderAsync.error!)),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () =>
                          ref.invalidate(orderDetailProvider(widget.orderId!)),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final supplierIds = support.suppliers.map((s) => s.id).toSet();
          final supplierInList =
              _supplierId != null && supplierIds.contains(_supplierId);

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_isLocked)
                  Card(
                    color: Colors.orange.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Icon(Icons.lock_outline, color: Colors.orange.shade800),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'This order is locked because goods have been received. Editing is disabled.',
                              style: TextStyle(color: Colors.orange.shade900),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (_loadError != null) ...[
                  Text(_loadError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  const SizedBox(height: 8),
                ],
                _sectionTitle('Order information'),
                DropdownButtonFormField<String>(
                  value: _orderType,
                  decoration: const InputDecoration(
                    labelText: 'Order type',
                    border: OutlineInputBorder(),
                  ),
                  items: _orderTypes
                      .map(
                        (e) => DropdownMenuItem(value: e.$1, child: Text(e.$2)),
                      )
                      .toList(),
                  onChanged: _isLocked ? null : _onOrderTypeChanged,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: supplierInList ? _supplierId : null,
                  decoration: const InputDecoration(
                    labelText: 'Supplier *',
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    if (!supplierInList &&
                        _supplierId != null &&
                        _loadedOrder?.supplierName != null)
                      DropdownMenuItem(
                        value: _supplierId,
                        child: Text(
                          _loadedOrder!.supplierName!,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ...support.suppliers.map(
                      (s) => DropdownMenuItem(
                        value: s.id,
                        child: Text(s.supplierName, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                  ],
                  onChanged: _isLocked
                      ? null
                      : (v) => setState(() => _supplierId = v),
                  validator: (v) =>
                      v == null || v.isEmpty ? 'Supplier is required' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _status,
                  decoration: const InputDecoration(
                    labelText: 'Status',
                    border: OutlineInputBorder(),
                  ),
                  items: purchaseOrderStatuses
                      .where((s) => s != 'Cancelled')
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: _isLocked ? null : (v) => setState(() => _status = v ?? 'Draft'),
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('PO date *'),
                  subtitle: Text(dateFormat.format(_poDate)),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: _isLocked ? null : () => _pickDate(poDate: true),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Expected delivery'),
                  subtitle: Text(
                    _expectedDeliveryDate != null
                        ? dateFormat.format(_expectedDeliveryDate!)
                        : 'Not set',
                  ),
                  trailing: const Icon(Icons.event),
                  onTap: _isLocked ? null : () => _pickDate(poDate: false),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Prices include tax'),
                  value: _pricesIncludeTax,
                  onChanged: _isLocked
                      ? null
                      : (v) => setState(() => _pricesIncludeTax = v),
                ),
                const SizedBox(height: 8),
                _sectionTitle('Line items'),
                for (var i = 0; i < _lines.length; i++)
                  _LineEditor(
                    key: ValueKey('line-$i-${_lines[i].lineType}'),
                    index: i,
                    line: _lines[i],
                    orderType: _orderType,
                    products: support.products,
                    expenseCategories: support.expenseCategories,
                    taxTypes: support.taxTypes,
                    pricesIncludeTax: _pricesIncludeTax,
                    locked: _isLocked,
                    canRemove: _lines.length > 1,
                    onChanged: () => setState(() {}),
                    onRemove: () => _removeLine(i),
                  ),
                if (!_isLocked)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: _addLine,
                      icon: const Icon(Icons.add),
                      label: const Text('Add line'),
                    ),
                  ),
                const SizedBox(height: 8),
                _sectionTitle('Totals'),
                Text('Subtotal: ${currency.format(totals.subtotal)}'),
                Text('Tax: ${currency.format(totals.tax)}'),
                Text(
                  'Total: ${currency.format(totals.total)}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _notesCtrl,
                  enabled: !_isLocked,
                  decoration: const InputDecoration(
                    labelText: 'Notes',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _isLocked || _isSubmitting || !canSave ? null : _save,
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(_isEdit ? 'Update purchase order' : 'Save purchase order'),
                ),
                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _LineEditor extends StatelessWidget {
  const _LineEditor({
    super.key,
    required this.index,
    required this.line,
    required this.orderType,
    required this.products,
    required this.expenseCategories,
    required this.taxTypes,
    required this.pricesIncludeTax,
    required this.locked,
    required this.canRemove,
    required this.onChanged,
    required this.onRemove,
  });

  final int index;
  final OrderLineDraft line;
  final String orderType;
  final List<Map<String, dynamic>> products;
  final List<Map<String, dynamic>> expenseCategories;
  final List<Map<String, dynamic>> taxTypes;
  final bool pricesIncludeTax;
  final bool locked;
  final bool canRemove;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  Map<String, dynamic>? _productById(String? id) {
    if (id == null) return null;
    for (final p in products) {
      if ('${p['id']}' == id) return p;
    }
    return null;
  }

  List<Map<String, dynamic>> _productUnits(String? productId) {
    final product = _productById(productId);
    if (product == null) return const [];
    final raw = product['productUnits'];
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  String _expenseCategoryLabel(Map<String, dynamic> cat) {
    final code = cat['code']?.toString() ??
        cat['accountCode']?.toString() ??
        (cat['account'] is Map
            ? (cat['account'] as Map)['accountCode']?.toString()
            : '') ??
        '';
    final name = cat['name']?.toString() ??
        (cat['account'] is Map
            ? (cat['account'] as Map)['accountName']?.toString()
            : '') ??
        '';
    if (code.isNotEmpty && name.isNotEmpty) return '$code — $name';
    return code.isNotEmpty ? code : (name.isNotEmpty ? name : '—');
  }

  @override
  Widget build(BuildContext context) {
    final units = _productUnits(line.productId);
    final productIds = products.map((p) => '${p['id']}').toSet();
    final productInList =
        line.productId != null && productIds.contains(line.productId);
    final showProduct = orderType == 'goods' ||
        (orderType == 'services' && line.lineType == 'goods');
    final showServiceFields = orderType == 'assets' ||
        (orderType == 'services' && line.lineType != 'goods');

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Line ${index + 1}', style: Theme.of(context).textTheme.titleSmall),
                const Spacer(),
                if (line.quantityReceived > 0)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Text(
                      'Received: ${line.quantityReceived}',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.textSecondary(context),
                      ),
                    ),
                  ),
                if (canRemove && !locked)
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: onRemove,
                    tooltip: 'Remove line',
                  ),
              ],
            ),
            if (orderType == 'services') ...[
              DropdownButtonFormField<String>(
                value: line.lineType,
                decoration: const InputDecoration(
                  labelText: 'Line type',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                items: const [
                  DropdownMenuItem(value: 'goods', child: Text('Goods')),
                  DropdownMenuItem(value: 'service', child: Text('Service')),
                ],
                onChanged: locked
                    ? null
                    : (v) {
                        line.lineType = v ?? 'service';
                        if (v == 'service') {
                          line.productId = null;
                          line.productUnitId = null;
                        }
                        onChanged();
                      },
              ),
              const SizedBox(height: 8),
            ],
            if (showProduct) ...[
              if (!productInList && line.productId != null)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Product'),
                  subtitle: Text(
                    line.description.isNotEmpty
                        ? line.description
                        : 'ID ${line.productId}',
                  ),
                )
              else
                DropdownButtonFormField<String>(
                  value: productInList ? line.productId : null,
                decoration: const InputDecoration(
                  labelText: 'Product',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                isExpanded: true,
                items: products
                    .map(
                      (p) => DropdownMenuItem(
                        value: '${p['id']}',
                        child: Text(
                          '${p['name'] ?? p['id']}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: locked
                    ? null
                    : (v) {
                        line.productId = v;
                        final product = _productById(v);
                        if (product != null) {
                          final cost = defaultProductCost(product);
                          if (cost > 0) line.unitCost = cost;
                          if (line.description.isEmpty) {
                            line.description = '${product['name'] ?? ''}';
                          }
                          final pus = _productUnits(v);
                          line.productUnitId =
                              pus.length == 1 ? '${pus.first['id']}' : null;
                        } else {
                          line.productUnitId = null;
                        }
                        onChanged();
                      },
                ),
              if (productInList && units.length > 1) ...[
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: line.productUnitId,
                  decoration: const InputDecoration(
                    labelText: 'Unit',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  isExpanded: true,
                  items: units
                      .map(
                        (u) => DropdownMenuItem(
                          value: '${u['id']}',
                          child: Text('${u['symbol'] ?? u['name'] ?? u['id']}'),
                        ),
                      )
                      .toList(),
                  onChanged: locked ? null : (v) {
                    line.productUnitId = v;
                    onChanged();
                  },
                ),
              ],
              const SizedBox(height: 8),
            ],
            if (showServiceFields || orderType == 'assets') ...[
              if (expenseCategories.isNotEmpty)
                DropdownButtonFormField<String>(
                  value: line.expenseCategoryId,
                  decoration: const InputDecoration(
                    labelText: 'Expense category',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  isExpanded: true,
                  items: expenseCategories
                      .map(
                        (c) => DropdownMenuItem(
                          value: '${c['id']}',
                          child: Text(
                            _expenseCategoryLabel(c),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: locked ? null : (v) {
                    line.expenseCategoryId = v;
                    onChanged();
                  },
                ),
              const SizedBox(height: 8),
              TextFormField(
                initialValue: line.description,
                enabled: !locked,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onChanged: (v) {
                  line.description = v;
                },
              ),
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    initialValue: line.quantityOrdered == 0
                        ? ''
                        : '${line.quantityOrdered}',
                    enabled: !locked,
                    decoration: const InputDecoration(
                      labelText: 'Qty',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                    ],
                    onChanged: (v) {
                      line.quantityOrdered = double.tryParse(v) ?? 0;
                      onChanged();
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    initialValue: line.unitCost == 0 ? '' : '${line.unitCost}',
                    enabled: !locked,
                    decoration: InputDecoration(
                      labelText: pricesIncludeTax ? 'Unit (incl. tax)' : 'Unit cost',
                      border: const OutlineInputBorder(),
                      isDense: true,
                    ),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                    ],
                    onChanged: (v) {
                      line.unitCost = double.tryParse(v) ?? 0;
                      onChanged();
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: line.taxTypeId,
              decoration: const InputDecoration(
                labelText: 'Tax type',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              isExpanded: true,
              items: [
                const DropdownMenuItem<String>(
                  value: null,
                  child: Text('No tax'),
                ),
                ...taxTypes.map(
                  (t) => DropdownMenuItem(
                    value: '${t['id']}',
                    child: Text(
                      '${t['name'] ?? t['id']} (${t['taxRate'] ?? 0}%)',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
              onChanged: locked
                  ? null
                  : (v) {
                      line.taxTypeId = v;
                      if (v != null) {
                        for (final t in taxTypes) {
                          if ('${t['id']}' == v) {
                            line.taxRate = (t['taxRate'] as num?)?.toDouble() ??
                                double.tryParse('${t['taxRate']}') ??
                                0;
                            break;
                          }
                        }
                      } else {
                        line.taxRate = 0;
                        line.taxAmount = 0;
                      }
                      onChanged();
                    },
            ),
          ],
        ),
      ),
    );
  }
}
