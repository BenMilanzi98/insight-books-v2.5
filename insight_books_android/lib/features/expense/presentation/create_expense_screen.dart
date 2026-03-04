import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../domain/expense_model.dart';
import 'providers/expense_details_provider.dart';
import 'providers/expense_provider.dart';

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
  String _status = 'Approved';
  String _paymentStatus = 'Fully paid';
  bool _isSubmitting = false;
  bool _isLoadingEdit = false;

  bool get _isEdit => widget.expenseId != null && widget.expenseId!.isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      _loadExpenseForEdit();
    } else {
      ref.read(expenseControllerProvider.notifier).loadPaymentAccounts();
    }
  }

  Future<void> _loadExpenseForEdit() async {
    setState(() => _isLoadingEdit = true);
    try {
      await ref.read(expenseControllerProvider.notifier).loadPaymentAccounts();
      if (!mounted) return;
      final expense = await ref.read(expenseDetailsProvider(widget.expenseId!).future);
      if (!mounted) return;
      final paymentAccounts = ref.read(expenseControllerProvider).paymentAccounts;
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
    final paidAmountVal = _paymentStatus == 'Partially'
        ? double.tryParse(_paidAmountCtrl.text.replaceAll(',', ''))
        : null;
    if (_paymentStatus == 'Partially' && (paidAmountVal == null || paidAmountVal <= 0)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Amount paid is required for partial payments')),
      );
      return;
    }
    if (_paymentStatus == 'Partially' && paidAmountVal != null && paidAmountVal >= amount) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Paid amount must be less than the total amount')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_date);
      final taxAmount = double.tryParse(_taxAmountCtrl.text.replaceAll(',', ''));
      final taxRate = double.tryParse(_taxRateCtrl.text.replaceAll(',', ''));

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
          taxRate: taxRate != null && taxRate > 0 ? taxRate : null,
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
          notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
          merchant: _merchantCtrl.text.trim().isEmpty ? null : _merchantCtrl.text.trim(),
          taxAmount: taxAmount != null && taxAmount > 0 ? taxAmount : null,
          taxRate: taxRate != null && taxRate > 0 ? taxRate : null,
          paidAmount: _paymentStatus == 'Partially' ? paidAmountVal : null,
          paymentReference: _paymentStatus == 'Partially'
              ? (_paymentReferenceCtrl.text.trim().isEmpty ? null : _paymentReferenceCtrl.text.trim())
              : null,
        );
        await ref.read(expenseControllerProvider.notifier).createExpense(request);
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
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', '')) ?? 0;
    final taxAmount = double.tryParse(_taxAmountCtrl.text.replaceAll(',', '')) ?? 0;
    final totalInclTax = amount + taxAmount;

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Expense' : 'Create New Expense'),
        actions: [
          TextButton(
            onPressed: _isSubmitting || _isLoadingEdit ? null : _submit,
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
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
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
                DropdownButtonFormField<ExpenseCategoryOption?>(
                  initialValue: _selectedCategory,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  hint: const Text('Select expense category'),
                  items: [
                    const DropdownMenuItem<ExpenseCategoryOption?>(value: null, child: Text('Select category')),
                    ...categories.map((c) => DropdownMenuItem<ExpenseCategoryOption?>(
                          value: c,
                          child: Text(c.name, overflow: TextOverflow.ellipsis),
                        )),
                    if (_selectedCategory != null && !categories.any((c) => c.id == _selectedCategory!.id))
                      DropdownMenuItem<ExpenseCategoryOption?>(
                        value: _selectedCategory,
                        child: Text(_selectedCategory!.name, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() => _selectedCategory = v),
                ),
                const SizedBox(height: 16),

                // ── Supplier (optional) ──
                const Text('Supplier (optional)'),
                const SizedBox(height: 6),
                DropdownButtonFormField<String?>(
                  initialValue: null,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  hint: const Text('None'),
                  items: const [
                    DropdownMenuItem<String?>(value: null, child: Text('None')),
                  ],
                  onChanged: (_) {},
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
                      onPressed: _isSubmitting ? null : _submit,
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
