import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';

import '../domain/expense_model.dart';
import '../data/expense_repository.dart';
import 'providers/expense_details_provider.dart';
import 'providers/expense_provider.dart';

Map<String, dynamic>? _taxMapById(List<Map<String, dynamic>> types, String? id) {
  if (id == null) return null;
  for (final t in types) {
    if ('${t['id']}' == id) return t;
  }
  return null;
}

List<Map<String, dynamic>> _uniqueTaxTypes(List<Map<String, dynamic>> raw) {
  final seen = <String>{};
  final out = <Map<String, dynamic>>[];
  for (final t in raw) {
    final id = '${t['id'] ?? ''}';
    if (id.isEmpty || seen.contains(id)) continue;
    seen.add(id);
    out.add(t);
  }
  return out;
}

List<ExpenseCategoryOption> _uniqueCategories(List<ExpenseCategoryOption> raw) {
  final seen = <String>{};
  final out = <ExpenseCategoryOption>[];
  for (final c in raw) {
    if (c.id.isEmpty || seen.contains(c.id)) continue;
    seen.add(c.id);
    out.add(c);
  }
  return out;
}

class CreateExpenseScreen extends ConsumerStatefulWidget {
  final String? expenseId;

  const CreateExpenseScreen({super.key, this.expenseId});

  @override
  ConsumerState<CreateExpenseScreen> createState() => _CreateExpenseScreenState();
}

class _CreateExpenseScreenState extends ConsumerState<CreateExpenseScreen> {
  final _descriptionCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _taxAmountCtrl = TextEditingController();
  final _taxRateCtrl = TextEditingController();
  final _merchantCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _paidAmountCtrl = TextEditingController();
  final _paymentReferenceCtrl = TextEditingController();

  DateTime _date = DateTime.now();
  ExpenseCategoryOption? _selectedCategory;
  PaymentAccountOption? _selectedPaymentAccount;
  SupplierOption? _selectedSupplier;
  BranchOption? _selectedBranch;
  String? _selectedTaxTypeId;
  bool _isHistoricalEntry = false;
  final _migrationBatchCtrl = TextEditingController();
  String _status = 'Approved';
  String _paymentStatus = 'Fully paid';
  bool _isSubmitting = false;
  bool _isLoadingEdit = false;
  final List<File> _attachments = [];

  bool get _isEdit => widget.expenseId != null && widget.expenseId!.isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      _loadExpenseForEdit();
    } else {
      final notifier = ref.read(expenseControllerProvider.notifier);
      notifier.loadPaymentAccounts();
      notifier.loadSuppliers();
      notifier.loadBranches();
      Future(() async {
        await notifier.loadTaxData();
        if (!mounted) return;
        final s = ref.read(expenseControllerProvider);
        final defaultId = s.defaultOutflowTaxTypeId;
        if (_selectedTaxTypeId == null && defaultId != null) {
          final match = s.taxTypes.where((t) => '${t['id']}' == defaultId);
          if (match.isNotEmpty) {
            setState(() {
              _selectedTaxTypeId = defaultId;
              _taxRateCtrl.text = '${match.first['taxRate'] ?? ''}';
              _applyTaxDerivedFields();
            });
          }
        }
      });
    }
  }

  Future<void> _loadExpenseForEdit() async {
    setState(() => _isLoadingEdit = true);
    try {
      final notifier = ref.read(expenseControllerProvider.notifier);
      await notifier.loadPaymentAccounts();
      await notifier.loadSuppliers();
      await notifier.loadBranches();
      await notifier.loadTaxData();
      if (!mounted) return;
      final expense = await ref.read(expenseDetailsProvider(widget.expenseId!).future);
      if (!mounted) return;
      final paymentAccounts = ref.read(expenseControllerProvider).paymentAccounts;
      final suppliers = ref.read(expenseControllerProvider).suppliers;
      final branches = ref.read(expenseControllerProvider).branches;
      final taxTypes = ref.read(expenseControllerProvider).taxTypes;
      final defaultTaxTypeId = ref.read(expenseControllerProvider).defaultOutflowTaxTypeId;
      _descriptionCtrl.text = expense.description;
      _amountCtrl.text = expense.amount.toStringAsFixed(2);
      _taxAmountCtrl.text = expense.taxAmount > 0 ? expense.taxAmount.toStringAsFixed(2) : '';
      _taxRateCtrl.text = expense.taxRate > 0 ? expense.taxRate.toStringAsFixed(1) : '';
      _merchantCtrl.text = expense.merchant ?? '';
      _notesCtrl.text = expense.notes ?? '';
      _paidAmountCtrl.text = expense.paidAmount > 0 ? expense.paidAmount.toStringAsFixed(2) : '';
      _paymentReferenceCtrl.text = expense.paymentReference ?? '';
      _date = DateTime.tryParse(expense.date) ?? DateTime.now();
      _status = expense.status;
      _paymentStatus = expense.paymentStatus;
      if (expense.expenseAccount != null) {
        _selectedCategory = ExpenseCategoryOption(
          id: expense.expenseAccount!.id,
          name: expense.expenseAccount!.displayName,
          code: expense.expenseAccount!.accountCode,
        );
      }
      final sourceId = expense.sourceAccountId ?? expense.sourceAccount?.id;
      if (sourceId != null && sourceId.isNotEmpty) {
        final match = paymentAccounts.where((a) => a.id == sourceId);
        _selectedPaymentAccount = match.isEmpty ? null : match.first;
      } else if (expense.payments.isNotEmpty) {
        final firstPaymentMethod = expense.payments.first.paymentMethod;
        final match = paymentAccounts.where((a) => a.id == firstPaymentMethod || a.name == firstPaymentMethod);
        _selectedPaymentAccount = match.isEmpty ? null : match.first;
      }
      final supplierId = expense.supplierId;
      if (supplierId != null && supplierId.isNotEmpty) {
        final supplierMatch = suppliers.where((s) => s.id == supplierId);
        _selectedSupplier = supplierMatch.isEmpty ? null : supplierMatch.first;
      }
      final branchId = expense.branchId;
      if (branchId != null && branchId.isNotEmpty) {
        final branchMatch = branches.where((b) => b.id == branchId);
        _selectedBranch = branchMatch.isEmpty ? null : branchMatch.first;
      }
      final existingTaxTypeId = expense.taxTypeId;
      if (existingTaxTypeId != null && existingTaxTypeId.isNotEmpty) {
        _selectedTaxTypeId = existingTaxTypeId;
      }
      if (_selectedTaxTypeId == null && defaultTaxTypeId != null) {
        final match = taxTypes.where((t) => '${t['id']}' == defaultTaxTypeId);
        if (match.isNotEmpty) {
          _selectedTaxTypeId = defaultTaxTypeId;
          _taxRateCtrl.text = '${match.first['taxRate'] ?? ''}';
        }
      }
      if (expense.taxRate > 0 && _selectedTaxTypeId == null) {
        for (final t in taxTypes) {
          final tr = double.tryParse('${t['taxRate'] ?? 0}') ?? 0;
          if ((tr - expense.taxRate).abs() < 0.001) {
            _selectedTaxTypeId = '${t['id']}';
            break;
          }
        }
      }
      if (_selectedTaxTypeId != null && expense.taxAmount <= 0) {
        _applyTaxDerivedFields();
      }
      setState(() {});
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to load expense')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoadingEdit = false);
    }
  }

  Future<void> _showCreateCategoryDialog(BuildContext context) async {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final created = await showDialog<ExpenseCategoryOption>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create Category'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty) return;
              final category = await ref.read(expenseControllerProvider.notifier).createExpenseCategory(
                    name: nameCtrl.text.trim(),
                    description: descCtrl.text.trim().isEmpty ? null : descCtrl.text.trim(),
                  );
              if (ctx.mounted) Navigator.pop(ctx, category);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (created != null && mounted) {
      setState(() => _selectedCategory = created);
    }
  }

  Future<void> _showCreateTaxTypeDialog(BuildContext context) async {
    final nameCtrl = TextEditingController();
    final rateCtrl = TextEditingController();
    String? selectedAccountId = ref.read(expenseControllerProvider).taxAccounts.isNotEmpty
        ? '${ref.read(expenseControllerProvider).taxAccounts.first['id']}'
        : null;
    final created = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) {
        final accounts = ref.read(expenseControllerProvider).taxAccounts;
        return StatefulBuilder(
          builder: (_, setModal) => AlertDialog(
            title: const Text('Create Tax Type'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Tax Name',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: rateCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Tax Rate (%)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: selectedAccountId,
                  items: accounts
                      .map(
                        (a) => DropdownMenuItem<String>(
                          value: '${a['id']}',
                          child: Text('${a['name'] ?? a['accountName'] ?? 'Account'}'),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setModal(() => selectedAccountId = v),
                  decoration: const InputDecoration(
                    labelText: 'Tax Account',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              FilledButton(
                onPressed: () async {
                  final rate = double.tryParse(rateCtrl.text.trim());
                  if (nameCtrl.text.trim().isEmpty || rate == null || selectedAccountId == null) return;
                  final tax = await ref.read(expenseControllerProvider.notifier).createTaxType(
                        taxName: nameCtrl.text.trim(),
                        taxRate: rate,
                        accountId: selectedAccountId!,
                      );
                  if (ctx.mounted) Navigator.pop(ctx, tax);
                },
                child: const Text('Create'),
              ),
            ],
          ),
        );
      },
    );
    if (created != null && mounted) {
      setState(() {
        _selectedTaxTypeId = '${created['id']}';
        _taxRateCtrl.text = '${created['taxRate'] ?? ''}';
        _applyTaxDerivedFields();
      });
    }
  }

  void _applyTaxDerivedFields() {
    final id = _selectedTaxTypeId;
    if (id == null) return;
    final types = ref.read(expenseControllerProvider).taxTypes;
    final t = _taxMapById(types, id);
    if (t == null) return;
    final rate = double.tryParse('${t['taxRate'] ?? 0}') ?? 0;
    _taxRateCtrl.text = rate > 0 ? rate.toString() : '';
    final calcType = '${t['calculationType'] ?? 'Percentage'}'.toLowerCase();
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', '')) ?? 0;
    if (amount <= 0) {
      _taxAmountCtrl.text = '';
      return;
    }
    if (calcType.contains('percent')) {
      // Match web ExpenseForm: Math.round((base * rate / 100) * 100) / 100
      final rounded = (amount * rate / 100 * 100).round() / 100;
      _taxAmountCtrl.text = rounded.toStringAsFixed(2);
    } else {
      _taxAmountCtrl.text = rate.toStringAsFixed(2);
    }
  }

  Future<void> _scanReceiptAndVerify() async {
    final picked = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    );
    if (!context.mounted) return;
    if (picked == null || picked.files.isEmpty || picked.files.first.path == null) return;
    final file = File(picked.files.first.path!);
    Map<String, dynamic> scanned = {};
    String? scanError;
    try {
      scanned = await ref.read(expenseRepositoryProvider).scanExpenseReceipt(file.path);
    } catch (e) {
      scanError = e.toString();
    }
    if (!mounted) return;
    if (scanError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('OCR scan failed, please fill manually: $scanError')),
      );
    }
    final amountGuess = '${scanned['amount'] ?? ''}'.trim();
    final dateGuess = '${scanned['date'] ?? ''}'.trim();
    final descriptionGuess = '${scanned['description'] ?? ''}'.trim();
    final notesGuess = '${scanned['notes'] ?? ''}'.trim();

    final amountCtrl = TextEditingController(text: amountGuess);
    final descriptionCtrl = TextEditingController(
      text: descriptionGuess.isNotEmpty
          ? descriptionGuess
          : (_descriptionCtrl.text.isEmpty ? 'New expense from receipt' : _descriptionCtrl.text),
    );
    DateTime localDate = dateGuess.isNotEmpty ? (DateTime.tryParse(dateGuess) ?? _date) : _date;

    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (_, setModal) => AlertDialog(
          title: const Text('Verify Scanned Receipt'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: descriptionCtrl,
                decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder(), prefixText: 'MK '),
              ),
              const SizedBox(height: 10),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(DateFormat.yMd().format(localDate)),
                trailing: const Icon(Icons.calendar_today),
                onTap: () async {
                  final pickedDate = await showDatePicker(
                    context: ctx,
                    initialDate: localDate,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (pickedDate != null) setModal(() => localDate = pickedDate);
                },
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Apply')),
          ],
        ),
      ),
    );
    if (confirmed == true && mounted) {
      setState(() {
        _descriptionCtrl.text = descriptionCtrl.text.trim();
        if (amountCtrl.text.trim().isNotEmpty) _amountCtrl.text = amountCtrl.text.trim();
        _date = localDate;
        if (notesGuess.isNotEmpty && _notesCtrl.text.trim().isEmpty) {
          _notesCtrl.text = notesGuess;
        }
        _attachments.add(file);
      });
    }
  }

  @override
  void dispose() {
    _descriptionCtrl.dispose();
    _amountCtrl.dispose();
    _taxAmountCtrl.dispose();
    _taxRateCtrl.dispose();
    _merchantCtrl.dispose();
    _notesCtrl.dispose();
    _paidAmountCtrl.dispose();
    _paymentReferenceCtrl.dispose();
    _migrationBatchCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final description = _descriptionCtrl.text.trim();
    if (description.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Description is required')),
      );
      return;
    }
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', ''));
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Amount is required and must be greater than zero')),
      );
      return;
    }
    if (!_isEdit && _selectedCategory == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Expense category is required')),
      );
      return;
    }
    if (_paymentStatus != 'Pending' && _selectedPaymentAccount == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Source of Funds is required')),
      );
      return;
    }
    final taxForValidation = double.tryParse(_taxAmountCtrl.text.replaceAll(',', ''));
    if (taxForValidation != null &&
        taxForValidation > 0 &&
        taxForValidation >= amount) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tax amount must be less than the expense amount')),
      );
      return;
    }
    final totalPayable =
        amount + (taxForValidation != null && taxForValidation > 0 ? taxForValidation : 0);
    final paidAmountVal = _paymentStatus == 'Partially'
        ? double.tryParse(_paidAmountCtrl.text.replaceAll(',', ''))
        : null;
    if (_paymentStatus == 'Partially' && (paidAmountVal == null || paidAmountVal <= 0)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Amount paid is required for partial payments')),
      );
      return;
    }
    if (_paymentStatus == 'Partially' &&
        paidAmountVal != null &&
        paidAmountVal >= totalPayable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Paid amount must be less than the total (amount + tax)',
          ),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_date);
      final taxAmount = double.tryParse(_taxAmountCtrl.text.replaceAll(',', ''));
      final taxRate = double.tryParse(_taxRateCtrl.text.replaceAll(',', ''));
      final taxMap = _selectedTaxTypeId != null
          ? _taxMapById(ref.read(expenseControllerProvider).taxTypes, _selectedTaxTypeId)
          : null;
      final effectiveTaxRate = taxRate ??
          (taxMap != null ? double.tryParse('${taxMap['taxRate'] ?? 0}') : null);

      if (_isEdit) {
        final request = UpdateExpenseRequest(
          description: description,
          amount: amount,
          date: dateStr,
          expenseAccountId: _selectedCategory?.id,
          category: _selectedCategory?.name,
          paymentMethod: _paymentStatus == 'Pending' ? null : _selectedPaymentAccount?.id,
          paymentStatus: _paymentStatus,
          status: _status,
          notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
          merchant: _merchantCtrl.text.trim().isEmpty ? null : _merchantCtrl.text.trim(),
          paidAmount: _paymentStatus == 'Partially' ? paidAmountVal : null,
          paymentReference: _paymentStatus == 'Partially'
              ? (_paymentReferenceCtrl.text.trim().isEmpty ? null : _paymentReferenceCtrl.text.trim())
              : null,
          taxAmount: taxAmount != null && taxAmount > 0 ? taxAmount : null,
          taxRate: effectiveTaxRate != null && effectiveTaxRate > 0 ? effectiveTaxRate : null,
          supplierId: _selectedSupplier?.id,
          branchId: _selectedBranch?.id,
          taxTypeId: _selectedTaxTypeId,
        );
        await ref.read(expenseControllerProvider.notifier).updateExpense(widget.expenseId!, request);
      } else {
        final request = CreateExpenseRequest(
          description: description,
          amount: amount,
          date: dateStr,
          expenseAccountId: _selectedCategory?.id,
          category: _selectedCategory?.name,
          paymentMethod: _paymentStatus == 'Pending' ? null : _selectedPaymentAccount?.id,
          paymentStatus: _paymentStatus,
          status: _status,
          notes: [
            if (_notesCtrl.text.trim().isNotEmpty) _notesCtrl.text.trim(),
            if (_isHistoricalEntry)
              'Historical entry${_migrationBatchCtrl.text.trim().isNotEmpty ? ' · Batch: ${_migrationBatchCtrl.text.trim()}' : ''}',
          ].join(_notesCtrl.text.trim().isNotEmpty && _isHistoricalEntry ? '\n' : ''),
          merchant: _merchantCtrl.text.trim().isEmpty ? null : _merchantCtrl.text.trim(),
          taxAmount: taxAmount != null && taxAmount > 0 ? taxAmount : null,
          taxRate: effectiveTaxRate != null && effectiveTaxRate > 0 ? effectiveTaxRate : null,
          supplierId: _selectedSupplier?.id,
          branchId: _selectedBranch?.id,
          paidAmount: _paymentStatus == 'Partially' ? paidAmountVal : null,
          paymentReference: _paymentStatus == 'Partially'
              ? (_paymentReferenceCtrl.text.trim().isEmpty ? null : _paymentReferenceCtrl.text.trim())
              : null,
          taxTypeId: _selectedTaxTypeId,
          isHistorical: _isHistoricalEntry ? true : null,
          migrationBatch: _migrationBatchCtrl.text.trim().isEmpty
              ? null
              : _migrationBatchCtrl.text.trim(),
        );
        await ref.read(expenseControllerProvider.notifier).createExpense(
          request,
          attachments: _attachments,
        );
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_isEdit ? 'Expense updated' : 'Expense created')),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(expenseControllerProvider);
    final theme = Theme.of(context);
    final categories = state.categories;
    final paymentAccounts = state.paymentAccounts;
    final suppliers = state.suppliers;
    final branches = state.branches;
    final taxTypes = state.taxTypes;
    final uniqueTax = _uniqueTaxTypes(taxTypes);
    final uniqueCat = _uniqueCategories(categories);
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', '')) ?? 0;
    final taxAmount = double.tryParse(_taxAmountCtrl.text.replaceAll(',', '')) ?? 0;
    final totalInclTax = amount + taxAmount;
    final canSubmit = _isEdit ? state.canUpdateExpenses : state.canCreateExpenses;

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Expense' : 'Create New Expense'),
        actions: [
          TextButton(
            onPressed: _isSubmitting || _isLoadingEdit || !canSubmit ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(_isEdit ? 'Update Expense' : 'Create Expense'),
          ),
        ],
      ),
      body: _isLoadingEdit
          ? const Center(child: CircularProgressIndicator())
          : !canSubmit
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: const Text(
                  'You do not have permission to perform this action.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // ── Description * (full width) ──
                const Text('Description *'),
                const SizedBox(height: 6),
                TextField(
                  controller: _descriptionCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Description *',
                    border: OutlineInputBorder(),
                    hintText: 'Brief description of expense',
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 16),

                // ── Amount (MK) * ──
                const Text('Amount (MK) *'),
                const SizedBox(height: 6),
                TextField(
                  controller: _amountCtrl,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    prefixText: 'MK ',
                    hintText: '0.00',
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) {
                    setState(() {
                      if (_selectedTaxTypeId != null) _applyTaxDerivedFields();
                    });
                  },
                ),
                const SizedBox(height: 16),

                // ── Tax amount (MK) optional ──
                const Text('Tax amount (MK)'),
                const SizedBox(height: 6),
                TextField(
                  controller: _taxAmountCtrl,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    prefixText: 'MK ',
                    hintText: '0.00',
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) => setState(() {}),
                ),
                Text(
                  'Total (incl. tax): MK ${NumberFormat('#,##0.00').format(totalInclTax)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),

                // ── Tax rate (%) optional ──
                const Text('Tax rate (%)'),
                const SizedBox(height: 6),
                TextField(
                  controller: _taxRateCtrl,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    hintText: 'Select or enter %',
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String?>(
                        key: ValueKey<String>('tax_dd_${_selectedTaxTypeId ?? 'none'}'),
                        initialValue: _selectedTaxTypeId != null &&
                                uniqueTax.any((t) => '${t['id']}' == _selectedTaxTypeId)
                            ? _selectedTaxTypeId
                            : null,
                        decoration: const InputDecoration(
                          labelText: 'Tax Type (optional)',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('No tax type'),
                          ),
                          ...uniqueTax.map(
                            (t) => DropdownMenuItem<String?>(
                              value: '${t['id']}',
                              child: Text(
                                '${(t['taxName'] ?? t['name'] ?? 'Tax')} (${t['taxRate'] ?? 0}%)',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                        ],
                        onChanged: (id) {
                          setState(() {
                            _selectedTaxTypeId = id;
                            if (id != null) {
                              _applyTaxDerivedFields();
                            } else {
                              _taxRateCtrl.text = '';
                              _taxAmountCtrl.text = '';
                            }
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: 'Create tax type',
                      onPressed: canSubmit ? () => _showCreateTaxTypeDialog(context) : null,
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // ── Date * ──
                const Text('Date *'),
                const SizedBox(height: 6),
                ListTile(
                  title: Text(DateFormat.yMd().format(_date)),
                  trailing: const Icon(Icons.calendar_today),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: BorderSide(color: theme.colorScheme.outline.withValues(alpha: 0.5)),
                  ),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _date,
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
                    );
                    if (date != null) setState(() => _date = date);
                  },
                ),
                const SizedBox(height: 16),

                // ── Expense Category * ──
                const Text('Expense Category *'),
                const SizedBox(height: 6),
                DropdownButtonFormField<String?>(
                  key: ValueKey<String>('cat_dd_${_selectedCategory?.id ?? 'none'}'),
                  initialValue: _selectedCategory?.id,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  hint: const Text('Select expense category'),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('Select category')),
                    ...uniqueCat.map(
                      (c) => DropdownMenuItem<String?>(
                        value: c.id,
                        child: Text(c.name, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                    if (_selectedCategory != null && !uniqueCat.any((c) => c.id == _selectedCategory!.id))
                      DropdownMenuItem<String?>(
                        value: _selectedCategory!.id,
                        child: Text(_selectedCategory!.name, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (id) {
                    setState(() {
                      if (id == null) {
                        _selectedCategory = null;
                        return;
                      }
                      ExpenseCategoryOption? resolved;
                      for (final c in uniqueCat) {
                        if (c.id == id) {
                          resolved = c;
                          break;
                        }
                      }
                      _selectedCategory = resolved ??
                          (_selectedCategory?.id == id ? _selectedCategory : null);
                    });
                  },
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: canSubmit ? () => _showCreateCategoryDialog(context) : null,
                    icon: const Icon(Icons.add),
                    label: const Text('Create category'),
                  ),
                ),
                const SizedBox(height: 16),

                // ── Supplier (optional) ──
                const Text('Supplier (optional)'),
                const SizedBox(height: 6),
                DropdownButtonFormField<SupplierOption?>(
                  initialValue: _selectedSupplier,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  hint: const Text('None'),
                  items: [
                    const DropdownMenuItem<SupplierOption?>(
                      value: null,
                      child: Text('None'),
                    ),
                    ...suppliers.map(
                      (s) => DropdownMenuItem<SupplierOption?>(
                        value: s,
                        child: Text(s.name, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                  ],
                  onChanged: (v) => setState(() => _selectedSupplier = v),
                ),
                const SizedBox(height: 16),

                const Text('Branch (optional)'),
                const SizedBox(height: 6),
                DropdownButtonFormField<BranchOption?>(
                  initialValue: _selectedBranch,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  hint: const Text('Default branch'),
                  items: [
                    const DropdownMenuItem<BranchOption?>(
                      value: null,
                      child: Text('Default branch'),
                    ),
                    ...branches.map(
                      (b) => DropdownMenuItem<BranchOption?>(
                        value: b,
                        child: Text(b.name, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                  ],
                  onChanged: (v) => setState(() => _selectedBranch = v),
                ),
                const SizedBox(height: 16),

                // ── Source of Funds * (only when not Pending) ──
                if (_paymentStatus != 'Pending') ...[
                  const Text('Source of Funds *'),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<PaymentAccountOption?>(
                    initialValue: _selectedPaymentAccount,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    hint: Text(paymentAccounts.isEmpty ? 'Loading accounts...' : 'Select an account'),
                    items: [
                      const DropdownMenuItem<PaymentAccountOption?>(value: null, child: Text('Select an account')),
                      ...paymentAccounts.map((acc) => DropdownMenuItem<PaymentAccountOption?>(
                            value: acc,
                            child: Text(
                              '${acc.name}${acc.accountType != null ? ' (${acc.accountType})' : ''}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          )),
                      if (_selectedPaymentAccount != null && !paymentAccounts.any((a) => a.id == _selectedPaymentAccount!.id))
                        DropdownMenuItem<PaymentAccountOption?>(
                          value: _selectedPaymentAccount,
                          child: Text(
                            _selectedPaymentAccount!.name,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (v) => setState(() => _selectedPaymentAccount = v),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Payment Status ──
                const Text('Payment Status'),
                const SizedBox(height: 6),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'Fully paid', label: Text('Fully paid')),
                    ButtonSegment(value: 'Partially', label: Text('Partially')),
                    ButtonSegment(value: 'Pending', label: Text('Pending')),
                  ],
                  selected: {_paymentStatus},
                  onSelectionChanged: (s) => setState(() => _paymentStatus = s.first),
                ),
                const SizedBox(height: 16),

                // ── Amount Paid & Payment Reference (only when Partially) ──
                if (_paymentStatus == 'Partially') ...[
                  const Text('Amount Paid *'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _paidAmountCtrl,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      prefixText: 'MK ',
                      hintText: 'Enter amount paid',
                    ),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  ),
                  const SizedBox(height: 12),
                  const Text('Payment Reference'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _paymentReferenceCtrl,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      hintText: 'e.g. check number, transaction ID',
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Status (Approved / Pending / Rejected) ──
                const Text('Status'),
                const SizedBox(height: 6),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'Pending', label: Text('Pending'), icon: Icon(Icons.schedule)),
                    ButtonSegment(value: 'Approved', label: Text('Approved'), icon: Icon(Icons.check_circle_outline)),
                    ButtonSegment(value: 'Rejected', label: Text('Rejected'), icon: Icon(Icons.cancel_outlined)),
                  ],
                  selected: {_status},
                  onSelectionChanged: (s) => setState(() => _status = s.first),
                ),
                const SizedBox(height: 16),

                // ── Merchant (optional) ──
                TextField(
                  controller: _merchantCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Merchant (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

                // ── Notes (optional) ──
                TextField(
                  controller: _notesCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Notes (optional)',
                    border: OutlineInputBorder(),
                    hintText: 'Additional details or notes about this expense',
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 24),

                Row(
                  children: [
                    Expanded(
                      child: SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Historical Entry'),
                        value: _isHistoricalEntry,
                        onChanged: (v) => setState(() => _isHistoricalEntry = v),
                      ),
                    ),
                  ],
                ),
                if (_isHistoricalEntry) ...[
                  TextField(
                    controller: _migrationBatchCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Migration Batch',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                if (!_isEdit) ...[
                  Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: canSubmit ? _scanReceiptAndVerify : null,
                        icon: const Icon(Icons.document_scanner_outlined),
                        label: const Text('Scan receipt'),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: !canSubmit ? null : () async {
                          final picked = await FilePicker.platform.pickFiles(
                            allowMultiple: true,
                            type: FileType.custom,
                            allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
                          );
                          if (picked == null) return;
                          final files = picked.files
                              .where((f) => f.path != null)
                              .map((f) => File(f.path!))
                              .toList();
                          setState(() => _attachments.addAll(files));
                        },
                        icon: const Icon(Icons.attach_file),
                        label: const Text('Add attachments'),
                      ),
                    ],
                  ),
                  if (_attachments.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: _attachments
                          .map(
                            (f) => Chip(
                              label: Text(f.path.split(RegExp(r'[/\\]')).last),
                              onDeleted: () => setState(() => _attachments.remove(f)),
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: 12),
                  ],
                ],

                // ── Actions ──
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: _isSubmitting ? null : () => context.pop(),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 12),
                    FilledButton(
                      onPressed: _isSubmitting || !canSubmit ? null : _submit,
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 24,
                              width: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(_isEdit ? 'Update Expense' : 'Create Expense'),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}
