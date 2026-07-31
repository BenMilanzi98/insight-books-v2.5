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
import 'providers/receipts_provider.dart';

class ExpiryAllocationDraft {
  ExpiryAllocationDraft({
    this.qty = 1,
    this.expiryDate,
    this.unitCost = 0,
  });

  double qty;
  DateTime? expiryDate;
  double unitCost;
}

class ReceiptLineDraft {
  ReceiptLineDraft({
    this.productId,
    this.quantityReceived = 1,
    this.unitCost = 0,
    this.isPerishable = false,
    this.poItemId,
    List<ExpiryAllocationDraft>? expiryAllocations,
  }) : expiryAllocations = expiryAllocations ?? [];

  String? productId;
  double quantityReceived;
  double unitCost;
  bool isPerishable;
  String? poItemId;
  List<ExpiryAllocationDraft> expiryAllocations;

  Map<String, dynamic> toPayloadMap() => {
        'productId': productId,
        'quantityReceived': quantityReceived,
        'unitCost': unitCost,
        'isPerishable': isPerishable,
        'poItemId': poItemId,
        'expiryAllocations': expiryAllocations
            .map(
              (a) => {
                'qty': a.qty,
                'expiryDate': a.expiryDate != null
                    ? _formatYyyyMmDd(a.expiryDate!)
                    : null,
                'unitCost': a.unitCost,
              },
            )
            .toList(),
      };
}

String _formatYyyyMmDd(DateTime d) {
  final y = d.year.toString().padLeft(4, '0');
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}

class CreateReceiptScreen extends ConsumerStatefulWidget {
  final ReceiptMode mode;

  const CreateReceiptScreen({super.key, required this.mode});

  @override
  ConsumerState<CreateReceiptScreen> createState() =>
      _CreateReceiptScreenState();
}

class _CreateReceiptScreenState extends ConsumerState<CreateReceiptScreen> {
  final _formKey = GlobalKey<FormState>();
  final _notesCtrl = TextEditingController();

  String? _supplierId;
  String? _purchaseOrderId;
  DateTime _receiptDate = DateTime.now();
  String _status = 'Posted';
  List<ReceiptLineDraft> _lines = [ReceiptLineDraft()];
  bool _isSubmitting = false;
  String? _submitError;
  bool _poLinesLocked = false;

  bool get _isService => widget.mode == ReceiptMode.service;

  @override
  void initState() {
    super.initState();
    if (_isService) _status = 'Draft';
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  PurchaseOrder? _selectedPo(List<PurchaseOrder> orders) {
    if (_purchaseOrderId == null || _purchaseOrderId!.isEmpty) return null;
    for (final po in orders) {
      if (po.id == _purchaseOrderId) return po;
    }
    return null;
  }

  List<PurchaseOrder> _ordersForSupplier(List<PurchaseOrder> all) {
    if (_supplierId == null || _supplierId!.isEmpty) return all;
    return all.where((po) => po.supplierId == _supplierId).toList();
  }

  void _applyPoLines(
    PurchaseOrder po,
    Map<String, bool> perishableMap,
  ) {
    final openLines = openGoodsLinesFromPo(po, perishableMap);
    if (openLines.isEmpty) {
      setState(() {
        _poLinesLocked = false;
        _lines = [ReceiptLineDraft()];
      });
      return;
    }

    final pit = po.pricesIncludeTax;
    setState(() {
      _poLinesLocked = true;
      _lines = openLines.map((line) {
        final ordered = line.quantityOrdered;
        final already = line.quantityReceived;
        final remaining = (ordered - already).clamp(0.0, double.infinity);
        final qty = remaining > 0 ? remaining : 1.0;
        final unitCost =
            receiptUnitCostFromPurchaseOrderLine(line, pit);
        final isPerishable = perishableMap[line.productId ?? ''] ?? false;
        return ReceiptLineDraft(
          productId: line.productId,
          quantityReceived: qty,
          unitCost: unitCost,
          isPerishable: isPerishable,
          poItemId: line.id,
          expiryAllocations: isPerishable
              ? [ExpiryAllocationDraft(qty: qty, unitCost: unitCost)]
              : [],
        );
      }).toList();
    });
  }

  void _onSupplierChanged(String? value, ReceiptFormSupportData support) {
    setState(() {
      _supplierId = value;
      final filtered = _ordersForSupplier(support.purchaseOrders);
      final keepPo =
          filtered.any((po) => po.id == _purchaseOrderId);
      if (!keepPo) {
        _purchaseOrderId = null;
        if (!_isService) {
          _poLinesLocked = false;
          _lines = [ReceiptLineDraft()];
        }
      }
    });
  }

  void _onPoChanged(String? value, ReceiptFormSupportData support) {
    if (value == null || value.isEmpty) {
      setState(() {
        _purchaseOrderId = null;
        if (!_isService) {
          _poLinesLocked = false;
          _lines = [ReceiptLineDraft()];
        }
      });
      return;
    }

    final po = support.purchaseOrders.firstWhere(
      (p) => p.id == value,
      orElse: () => support.purchaseOrders.first,
    );

    setState(() {
      _purchaseOrderId = value;
      if (po.supplierId.isNotEmpty) _supplierId = po.supplierId;
      final minDate = purchaseOrderReceiptAnchor(po);
      if (minDate != null) _receiptDate = minDate;
    });

    if (!_isService) {
      _applyPoLines(po, support.productPerishableMap);
    }
  }

  Future<void> _pickReceiptDate(PurchaseOrder? selectedPo) async {
    final minDate = purchaseOrderReceiptAnchor(selectedPo);
    final picked = await showDatePicker(
      context: context,
      initialDate: _receiptDate,
      firstDate: minDate ?? DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _receiptDate = picked);
  }

  Future<void> _submit(ReceiptFormSupportData support) async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitError = null);

    final selectedPo = _selectedPo(support.purchaseOrders);
    final receiptDateStr = _formatYyyyMmDd(_receiptDate);

    if (selectedPo != null) {
      try {
        assertReceiptDateOnOrAfterPurchaseOrder(receiptDateStr, selectedPo);
      } catch (e) {
        setState(() => _submitError = e.toString().replaceFirst('Exception: ', ''));
        return;
      }
    }

    if (_isService &&
        (_purchaseOrderId == null || _purchaseOrderId!.isEmpty)) {
      setState(() => _submitError = 'Select a service purchase order.');
      return;
    }

    if (!_isService) {
      for (final line in _lines) {
        if (line.productId == null || line.productId!.isEmpty) {
          setState(() => _submitError = 'Each line must have a product.');
          return;
        }
        if (line.quantityReceived <= 0) {
          setState(() => _submitError = 'Quantity must be greater than 0.');
          return;
        }
        if (line.unitCost < 0) {
          setState(() => _submitError = 'Unit cost cannot be negative.');
          return;
        }
      }
    }

    setState(() => _isSubmitting = true);

    try {
      final payload = buildReceiptPayload(
        mode: widget.mode,
        supplierId: _supplierId!,
        receiptDate: receiptDateStr,
        purchaseOrderId: _purchaseOrderId,
        status: _isService ? _status : 'Posted',
        notes: _notesCtrl.text,
        rawItems: _lines.map((l) => l.toPayloadMap()).toList(),
      );

      await ref.read(receiptsControllerProvider.notifier).createReceipt(payload);
      if (!mounted) return;
      context.pop(true);
    } on PurchasesQueuedException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Queued for sync')),
      );
      context.pop(true);
    } catch (e) {
      setState(
        () => _submitError = NetworkErrorMapper.toUserMessage(e),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
  @override
  Widget build(BuildContext context) {
    final supportAsync = ref.watch(receiptFormSupportProvider(widget.mode));
    final dateFormat = DateFormat.yMMMd();
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 0);

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(_isService ? 'Receive Service' : 'Receive Goods'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: const [ThemeToggleButton()],
      ),
      body: supportAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(NetworkErrorMapper.toUserMessage(e))),
        data: (support) {
          final selectedPo = _selectedPo(support.purchaseOrders);
          final ordersForSupplier = _ordersForSupplier(support.purchaseOrders);
          final receiptDateStr = _formatYyyyMmDd(_receiptDate);
          final futureNotice = !_isService &&
              isReceiptDateStrictlyAfterTodayUtc(receiptDateStr);

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_submitError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Material(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          _submitError!,
                          style: TextStyle(color: Colors.red.shade800),
                        ),
                      ),
                    ),
                  ),
                _SectionCard(
                  title: 'Receipt details',
                  subtitle: 'Supplier, dates, and posting status.',
                  child: Column(
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _supplierId,
                        decoration: const InputDecoration(
                          labelText: 'Supplier *',
                          border: OutlineInputBorder(),
                        ),
                        items: [
                          for (final s in support.suppliers)
                            DropdownMenuItem(
                              value: s.id,
                              child: Text(
                                s.supplierName,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null,
                        onChanged: (v) => _onSupplierChanged(v, support),
                      ),
                      const SizedBox(height: 12),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Receipt date'),
                        subtitle: Text(dateFormat.format(_receiptDate)),
                        trailing: const Icon(Icons.calendar_today),
                        onTap: () => _pickReceiptDate(selectedPo),
                      ),
                      if (selectedPo != null &&
                          purchaseOrderMinReceiptDateStr(selectedPo) != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            'Cannot be before PO date '
                            '(${dateFormat.format(selectedPo.poDate ?? _receiptDate)}).',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary(context),
                            ),
                          ),
                        ),
                      if (futureNotice)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Material(
                            color: Colors.lightBlue.shade50,
                            borderRadius: BorderRadius.circular(8),
                            child: const Padding(
                              padding: EdgeInsets.all(12),
                              child: Text(
                                'This receipt date is in the future. Stock will be '
                                'applied automatically on that date.',
                                style: TextStyle(fontSize: 12),
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        initialValue: _purchaseOrderId,
                        decoration: InputDecoration(
                          labelText: _isService
                              ? 'Purchase order *'
                              : 'Purchase order (optional)',
                          border: const OutlineInputBorder(),
                        ),
                        items: [
                          if (!_isService)
                            const DropdownMenuItem(
                              value: null,
                              child: Text('None'),
                            ),
                          for (final po in ordersForSupplier)
                            DropdownMenuItem(
                              value: po.id,
                              child: Text(
                                '${po.poNumber} — ${po.supplierName ?? ''}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        validator: _isService
                            ? (v) => v == null || v.isEmpty ? 'Required' : null
                            : null,
                        onChanged: (v) => _onPoChanged(v, support),
                      ),
                      if (_isService) ...[
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: _status,
                          decoration: const InputDecoration(
                            labelText: 'Status',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'Draft',
                              child: Text('Draft'),
                            ),
                            DropdownMenuItem(
                              value: 'Posted',
                              child: Text('Posted'),
                            ),
                          ],
                          onChanged: (v) {
                            if (v != null) setState(() => _status = v);
                          },
                        ),
                      ],
                    ],
                  ),
                ),
                if (_isService)
                  _SectionCard(
                    title: 'Service receipt confirmation',
                    subtitle:
                        'Confirms service completion. Does not update inventory.',
                    child: Material(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(8),
                      child: const Padding(
                        padding: EdgeInsets.all(12),
                        child: Text(
                          'Select a service PO, then post receipt to move it to payables.',
                        ),
                      ),
                    ),
                  )
                else
                  _SectionCard(
                    title: 'Items received',
                    child: Column(
                      children: [
                        for (var i = 0; i < _lines.length; i++)
                          _LineEditor(
                            index: i,
                            line: _lines[i],
                            products: support.products,
                            currency: currency,
                            locked: _poLinesLocked,
                            canRemove: _lines.length > 1 && !_poLinesLocked,
                            onChanged: () => setState(() {}),
                            onRemove: () {
                              setState(() => _lines.removeAt(i));
                            },
                          ),
                        if (!_poLinesLocked)
                          OutlinedButton.icon(
                            onPressed: () {
                              setState(
                                () => _lines.add(ReceiptLineDraft()),
                              );
                            },
                            icon: const Icon(Icons.add),
                            label: const Text('Add item'),
                          ),
                      ],
                    ),
                  ),
                _SectionCard(
                  title: 'Notes',
                  subtitle: 'Optional internal notes.',
                  child: TextFormField(
                    controller: _notesCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'Condition of goods, discrepancies…',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed:
                            _isSubmitting ? null : () => context.pop(),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: _isSubmitting
                            ? null
                            : () => _submit(support),
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Post receipt'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.child,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            if (subtitle != null)
              Padding(
                padding: const EdgeInsets.only(top: 4, bottom: 12),
                child: Text(
                  subtitle!,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppTheme.textSecondary(context),
                  ),
                ),
              )
            else
              const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _LineEditor extends StatelessWidget {
  const _LineEditor({
    required this.index,
    required this.line,
    required this.products,
    required this.currency,
    required this.locked,
    required this.canRemove,
    required this.onChanged,
    required this.onRemove,
  });

  final int index;
  final ReceiptLineDraft line;
  final List<Map<String, dynamic>> products;
  final NumberFormat currency;
  final bool locked;
  final bool canRemove;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final lineTotal = line.quantityReceived * line.unitCost;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(12),
        color: Colors.grey.shade50,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DropdownButtonFormField<String>(
            initialValue: line.productId,
            decoration: const InputDecoration(
              labelText: 'Product *',
              border: OutlineInputBorder(),
              isDense: true,
            ),
            items: [
              for (final p in products)
                DropdownMenuItem(
                  value: p['id']?.toString(),
                  child: Text(
                    p['name']?.toString() ?? 'Product',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            onChanged: locked
                ? null
                : (v) {
                    line.productId = v;
                    line.isPerishable =
                        products.any((p) => p['id']?.toString() == v &&
                            p['isPerishable'] == true);
                    if (line.isPerishable && line.expiryAllocations.isEmpty) {
                      line.expiryAllocations.add(
                        ExpiryAllocationDraft(
                          qty: line.quantityReceived,
                          unitCost: line.unitCost,
                        ),
                      );
                    } else if (!line.isPerishable) {
                      line.expiryAllocations.clear();
                    }
                    onChanged();
                  },
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: line.quantityReceived.toString(),
                  decoration: const InputDecoration(
                    labelText: 'Qty',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
                  ],
                  onChanged: (v) {
                    line.quantityReceived = double.tryParse(v) ?? 0;
                    if (line.isPerishable &&
                        line.expiryAllocations.length == 1) {
                      line.expiryAllocations.first.qty = line.quantityReceived;
                    }
                    onChanged();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  initialValue: line.unitCost.toString(),
                  decoration: const InputDecoration(
                    labelText: 'Unit cost',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
                  ],
                  onChanged: (v) {
                    line.unitCost = double.tryParse(v) ?? 0;
                    if (line.isPerishable &&
                        line.expiryAllocations.length == 1) {
                      line.expiryAllocations.first.unitCost = line.unitCost;
                    }
                    onChanged();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Perishable'),
            value: line.isPerishable,
            onChanged: locked
                ? null
                : (v) {
                    line.isPerishable = v ?? false;
                    if (line.isPerishable && line.expiryAllocations.isEmpty) {
                      line.expiryAllocations.add(
                        ExpiryAllocationDraft(
                          qty: line.quantityReceived,
                          unitCost: line.unitCost,
                        ),
                      );
                    } else if (!line.isPerishable) {
                      line.expiryAllocations.clear();
                    }
                    onChanged();
                  },
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Line total: ${currency.format(lineTotal)}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              if (canRemove)
                TextButton(
                  onPressed: onRemove,
                  child: const Text('Remove', style: TextStyle(color: Colors.red)),
                ),
            ],
          ),
          if (line.isPerishable) ...[
            const Divider(),
            Text(
              'Expiry allocations',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            for (var ai = 0; ai < line.expiryAllocations.length; ai++)
              _AllocationRow(
                allocation: line.expiryAllocations[ai],
                onChanged: onChanged,
                onRemove: line.expiryAllocations.length > 1
                    ? () {
                        line.expiryAllocations.removeAt(ai);
                        onChanged();
                      }
                    : null,
              ),
            TextButton.icon(
              onPressed: () {
                line.expiryAllocations.add(
                  ExpiryAllocationDraft(unitCost: line.unitCost),
                );
                onChanged();
              },
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add allocation'),
            ),
            Text(
              'Allocation total: ${line.expiryAllocations.fold<double>(0, (s, a) => s + a.qty).toStringAsFixed(0)} '
              '/ Received: ${line.quantityReceived.toStringAsFixed(0)}',
              style: TextStyle(
                fontSize: 11,
                color: AppTheme.textSecondary(context),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AllocationRow extends StatelessWidget {
  const _AllocationRow({
    required this.allocation,
    required this.onChanged,
    this.onRemove,
  });

  final ExpiryAllocationDraft allocation;
  final VoidCallback onChanged;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: TextFormField(
              initialValue: allocation.qty.toString(),
              decoration: const InputDecoration(
                labelText: 'Qty',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              onChanged: (v) {
                allocation.qty = double.tryParse(v) ?? 0;
                onChanged();
              },
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 3,
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                allocation.expiryDate != null
                    ? DateFormat.yMMMd().format(allocation.expiryDate!)
                    : 'Expiry date',
                style: const TextStyle(fontSize: 13),
              ),
              trailing: const Icon(Icons.calendar_today, size: 18),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: allocation.expiryDate ?? DateTime.now(),
                  firstDate: DateTime(2000),
                  lastDate: DateTime(2100),
                );
                if (picked != null) {
                  allocation.expiryDate = picked;
                  onChanged();
                }
              },
            ),
          ),
          if (onRemove != null)
            IconButton(
              onPressed: onRemove,
              icon: const Icon(Icons.delete_outline, color: Colors.red),
            ),
        ],
      ),
    );
  }
}
