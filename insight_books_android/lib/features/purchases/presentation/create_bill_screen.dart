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
import 'providers/bills_provider.dart';

class BillLineDraft {
  BillLineDraft({
    this.productId,
    this.expenseAccountId,
    this.description = '',
    this.quantity = 1,
    this.unitCost = 0,
    this.amount = 0,
  });

  String? productId;
  String? expenseAccountId;
  String description;
  double quantity;
  double unitCost;
  double amount;

  Map<String, dynamic> toPayloadMap(String billType) {
    if (billType == 'expense') {
      return {
        'expenseAccountId': expenseAccountId,
        'amount': amount,
        'description': description,
      };
    }
    return {
      'productId': productId,
      'quantity': quantity,
      'unitCost': unitCost,
      'description': description,
    };
  }
}

class CreateBillScreen extends ConsumerStatefulWidget {
  const CreateBillScreen({super.key});

  @override
  ConsumerState<CreateBillScreen> createState() => _CreateBillScreenState();
}

class _CreateBillScreenState extends ConsumerState<CreateBillScreen> {
  final _formKey = GlobalKey<FormState>();
  final _billNumberCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  String? _supplierId;
  String _billType = 'inventory';
  String _status = 'Unpaid';
  DateTime _billDate = DateTime.now();
  DateTime _dueDate = DateTime.now();
  List<BillLineDraft> _lines = [BillLineDraft()];
  bool _isSubmitting = false;

  @override
  void dispose() {
    _billNumberCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  double get _subtotal {
    if (_billType == 'expense') {
      return _lines.fold<double>(0, (sum, l) => sum + l.amount);
    }
    return _lines.fold<double>(0, (sum, l) => sum + l.quantity * l.unitCost);
  }

  Future<void> _pickDate({required bool isBillDate}) async {
    final initial = isBillDate ? _billDate : _dueDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (isBillDate) {
        _billDate = picked;
      } else {
        _dueDate = picked;
      }
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_supplierId == null || _supplierId!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a supplier')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final dateFmt = DateFormat('yyyy-MM-dd');
      final payload = buildBillPayload(
        supplierId: _supplierId!,
        billDate: dateFmt.format(_billDate),
        dueDate: dateFmt.format(_dueDate),
        billType: _billType,
        status: _status,
        billNumber: _billNumberCtrl.text,
        notes: _notesCtrl.text,
        rawItems: _lines.map((l) => l.toPayloadMap(_billType)).toList(),
      );
      final created =
          await ref.read(billsControllerProvider.notifier).createBill(payload);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Bill ${displayBillNumber(created)} saved',
          ),
        ),
      );
      context.pop();
    } on PurchasesQueuedException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Queued for sync')),
      );
      context.pop();
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
    final supportAsync = ref.watch(billFormSupportProvider);
    final page = ref.watch(billsControllerProvider);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);
    final dateFormat = DateFormat.yMMMd();

    if (!page.canCreate) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('New supplier bill')),
        body: const Center(
          child: Text('You do not have permission to create supplier bills.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('New supplier bill'),
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
            child: Text(NetworkErrorMapper.toUserMessage(e)),
          ),
        ),
        data: (support) {
          final products = support.products;
          final expenseAccounts = support.expenseCategories
              .where((c) => c['accountId'] != null || c['id'] != null)
              .toList();

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Existing bills cannot be edited; reverse a bill if you need to undo it.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppTheme.textSecondary(context),
                  ),
                ),
                const SizedBox(height: 12),
                _Section(
                  title: 'Bill details',
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
                              child: Text(s.supplierName),
                            ),
                        ],
                        onChanged: (v) => setState(() => _supplierId = v),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null,
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _billType,
                        decoration: const InputDecoration(
                          labelText: 'Bill type',
                          border: OutlineInputBorder(),
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'inventory',
                            child: Text('Inventory purchase'),
                          ),
                          DropdownMenuItem(
                            value: 'expense',
                            child: Text('Operating expense'),
                          ),
                        ],
                        onChanged: (v) {
                          if (v == null) return;
                          setState(() {
                            _billType = v;
                            _lines = [BillLineDraft()];
                          });
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _billNumberCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Bill number',
                          hintText: 'Optional reference',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: const Text('Bill date'),
                              subtitle: Text(dateFormat.format(_billDate)),
                              trailing: const Icon(Icons.calendar_today),
                              onTap: () => _pickDate(isBillDate: true),
                            ),
                          ),
                          Expanded(
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: const Text('Due date'),
                              subtitle: Text(dateFormat.format(_dueDate)),
                              trailing: const Icon(Icons.calendar_today),
                              onTap: () => _pickDate(isBillDate: false),
                            ),
                          ),
                        ],
                      ),
                      DropdownButtonFormField<String>(
                        initialValue: _status,
                        decoration: const InputDecoration(
                          labelText: 'Status',
                          border: OutlineInputBorder(),
                        ),
                        items: [
                          for (final s in billStatuses)
                            DropdownMenuItem(value: s, child: Text(s)),
                        ],
                        onChanged: (v) {
                          if (v != null) setState(() => _status = v);
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _Section(
                  title: 'Line items',
                  child: Column(
                    children: [
                      for (var i = 0; i < _lines.length; i++)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _billType == 'expense'
                              ? _ExpenseLineEditor(
                                  line: _lines[i],
                                  accounts: expenseAccounts,
                                  currency: currency,
                                  onChanged: () => setState(() {}),
                                  onRemove: _lines.length > 1
                                      ? () => setState(
                                            () => _lines.removeAt(i),
                                          )
                                      : null,
                                )
                              : _InventoryLineEditor(
                                  line: _lines[i],
                                  products: products,
                                  currency: currency,
                                  onChanged: () => setState(() {}),
                                  onRemove: _lines.length > 1
                                      ? () => setState(
                                            () => _lines.removeAt(i),
                                          )
                                      : null,
                                ),
                        ),
                      OutlinedButton.icon(
                        onPressed: () =>
                            setState(() => _lines.add(BillLineDraft())),
                        icon: const Icon(Icons.add),
                        label: const Text('Add item'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _Section(
                  title: 'Notes & total',
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _notesCtrl,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Notes',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.amber.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Colors.amber.withValues(alpha: 0.4),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'BILL TOTAL',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.amber,
                                  ),
                                ),
                                Text('Subtotal excluding taxes'),
                              ],
                            ),
                            Text(
                              currency.format(_subtotal),
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
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
                        onPressed: _isSubmitting ? null : _submit,
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text('Save bill'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _InventoryLineEditor extends StatelessWidget {
  const _InventoryLineEditor({
    required this.line,
    required this.products,
    required this.currency,
    required this.onChanged,
    this.onRemove,
  });

  final BillLineDraft line;
  final List<Map<String, dynamic>> products;
  final NumberFormat currency;
  final VoidCallback onChanged;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: line.productId,
          decoration: const InputDecoration(
            labelText: 'Product *',
            border: OutlineInputBorder(),
          ),
          items: [
            for (final p in products)
              DropdownMenuItem(
                value: p['id']?.toString(),
                child: Text(
                  '${p['name'] ?? p['productName'] ?? 'Product'}${p['sku'] != null ? ' (${p['sku']})' : ''}',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
          onChanged: (v) {
            line.productId = v;
            if (v != null) {
              final product = products.firstWhere(
                (p) => p['id']?.toString() == v,
                orElse: () => const {},
              );
              if (product.isNotEmpty && line.unitCost <= 0) {
                line.unitCost = defaultProductCost(product);
              }
            }
            onChanged();
          },
          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                initialValue: line.quantity == 0 ? '' : '${line.quantity}',
                decoration: const InputDecoration(
                  labelText: 'Quantity *',
                  border: OutlineInputBorder(),
                ),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                ],
                onChanged: (v) {
                  line.quantity = double.tryParse(v) ?? 0;
                  onChanged();
                },
                validator: (v) {
                  final n = double.tryParse(v ?? '') ?? 0;
                  if (n <= 0) return 'Must be > 0';
                  return null;
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextFormField(
                initialValue: line.unitCost == 0 ? '' : '${line.unitCost}',
                decoration: const InputDecoration(
                  labelText: 'Unit cost *',
                  border: OutlineInputBorder(),
                ),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                ],
                onChanged: (v) {
                  line.unitCost = double.tryParse(v) ?? 0;
                  onChanged();
                },
                validator: (v) {
                  final n = double.tryParse(v ?? '') ?? 0;
                  if (n < 0) return 'Invalid';
                  return null;
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Line total: ${currency.format(line.quantity * line.unitCost)}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            if (onRemove != null)
              TextButton(
                onPressed: onRemove,
                child: const Text('Remove', style: TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ],
    );
  }
}

class _ExpenseLineEditor extends StatelessWidget {
  const _ExpenseLineEditor({
    required this.line,
    required this.accounts,
    required this.currency,
    required this.onChanged,
    this.onRemove,
  });

  final BillLineDraft line;
  final List<Map<String, dynamic>> accounts;
  final NumberFormat currency;
  final VoidCallback onChanged;
  final VoidCallback? onRemove;

  String? _accountId(Map<String, dynamic> c) =>
      c['accountId']?.toString() ?? c['id']?.toString();

  String _accountLabel(Map<String, dynamic> c) =>
      c['name']?.toString() ?? c['categoryName']?.toString() ?? 'Account';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: line.expenseAccountId,
          decoration: const InputDecoration(
            labelText: 'Expense account *',
            border: OutlineInputBorder(),
          ),
          items: [
            for (final c in accounts)
              DropdownMenuItem(
                value: _accountId(c),
                child: Text(_accountLabel(c), overflow: TextOverflow.ellipsis),
              ),
          ],
          onChanged: (v) {
            line.expenseAccountId = v;
            onChanged();
          },
          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
        ),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: line.amount == 0 ? '' : '${line.amount}',
          decoration: const InputDecoration(
            labelText: 'Amount *',
            border: OutlineInputBorder(),
          ),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
          ],
          onChanged: (v) {
            line.amount = double.tryParse(v) ?? 0;
            onChanged();
          },
          validator: (v) {
            final n = double.tryParse(v ?? '') ?? 0;
            if (n <= 0) return 'Must be > 0';
            return null;
          },
        ),
        if (onRemove != null)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: onRemove,
              child: const Text('Remove', style: TextStyle(color: Colors.red)),
            ),
          ),
      ],
    );
  }
}
