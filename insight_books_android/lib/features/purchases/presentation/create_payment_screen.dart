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
import 'providers/payments_provider.dart';

class CreatePaymentScreen extends ConsumerStatefulWidget {
  const CreatePaymentScreen({super.key});

  @override
  ConsumerState<CreatePaymentScreen> createState() =>
      _CreatePaymentScreenState();
}

class _CreatePaymentScreenState extends ConsumerState<CreatePaymentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _referenceCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  String? _supplierId;
  String? _paymentMethodId;
  DateTime _paymentDate = DateTime.now();
  List<PaymentAllocationDraft> _allocations = const [];
  bool _isSubmitting = false;
  bool _defaultsApplied = false;

  @override
  void dispose() {
    _referenceCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  double get _totalAllocations => totalAllocationsAmount(_allocations);

  void _onSupplierChanged(String? supplierId, PaymentFormSupportData support) {
    setState(() {
      _supplierId = supplierId;
      _allocations = supplierId == null || supplierId.isEmpty
          ? const []
          : draftsForSupplierBills(support.unpaidBills, supplierId);
    });
  }

  void _applyDefaults(PaymentFormSupportData support) {
    if (_defaultsApplied) return;
    final defaultAccount = defaultPaymentAccountId(support.paymentAccounts);
    if (defaultAccount != null) {
      _paymentMethodId = defaultAccount;
    }
    _defaultsApplied = true;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _paymentDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() => _paymentDate = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_supplierId == null || _supplierId!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a supplier')),
      );
      return;
    }

    final validationError = validatePaymentAllocations(_allocations);
    if (validationError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(validationError)),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final dateFmt = DateFormat('yyyy-MM-dd');
      final payload = buildPaymentPayload(
        supplierId: _supplierId!,
        paymentDate: dateFmt.format(_paymentDate),
        paymentMethod: _paymentMethodId,
        referenceNumber: _referenceCtrl.text,
        notes: _notesCtrl.text,
        allocations: _allocations,
      );
      final created = await ref
          .read(paymentsControllerProvider.notifier)
          .createPayment(payload);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Payment ${created.paymentNumber ?? created.id} recorded',
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
    final supportAsync = ref.watch(paymentFormSupportProvider);
    final page = ref.watch(paymentsControllerProvider);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);
    final dateFormat = DateFormat.yMMMd();

    if (!page.canCreate) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Record supplier payment')),
        body: const Center(
          child: Text(
            'You do not have permission to record supplier payments.',
          ),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Record supplier payment'),
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
          _applyDefaults(support);

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _Section(
                  title: 'Payment details',
                  description: 'Who is being paid and how.',
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
                        onChanged: (v) => _onSupplierChanged(v, support),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null,
                      ),
                      const SizedBox(height: 12),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Payment date *'),
                        subtitle: Text(dateFormat.format(_paymentDate)),
                        trailing: const Icon(Icons.calendar_today),
                        onTap: _pickDate,
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _paymentMethodId,
                        decoration: const InputDecoration(
                          labelText: 'Payment method',
                          border: OutlineInputBorder(),
                        ),
                        items: [
                          for (final account in support.paymentAccounts)
                            DropdownMenuItem(
                              value: account['id']?.toString(),
                              child: Text(
                                paymentAccountLabel(account),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: (v) =>
                            setState(() => _paymentMethodId = v),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _referenceCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Reference',
                          hintText: 'Optional',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _Section(
                  title: 'Allocate to bills',
                  description:
                      'Distribute the payment across outstanding supplier bills.',
                  child: _supplierId == null || _supplierId!.isEmpty
                      ? Text(
                          'Select a supplier to allocate payments.',
                          style: TextStyle(
                            color: AppTheme.textSecondary(context),
                          ),
                        )
                      : _allocations.isEmpty
                          ? Text(
                              'No outstanding bills for this supplier.',
                              style: TextStyle(
                                color: AppTheme.textSecondary(context),
                              ),
                            )
                          : Column(
                              children: [
                                for (var i = 0; i < _allocations.length; i++)
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 12),
                                    child: _AllocationRow(
                                      draft: _allocations[i],
                                      currency: currency,
                                      dateFormat: dateFormat,
                                      onChanged: (amount) {
                                        setState(() {
                                          _allocations[i].amount = amount;
                                        });
                                      },
                                    ),
                                  ),
                              ],
                            ),
                ),
                const SizedBox(height: 16),
                _Section(
                  title: 'Notes & total',
                  description: 'Optional memo plus total payment amount.',
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _notesCtrl,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Notes',
                          hintText:
                              'Payment memo, cheque details, bank confirmation code…',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Colors.green.withValues(alpha: 0.35),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'TOTAL PAYMENT',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.green,
                                  ),
                                ),
                                Text('Sum of bill allocations'),
                              ],
                            ),
                            Text(
                              currency.format(_totalAllocations),
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
                        onPressed: _isSubmitting ? null : () => context.pop(),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: _isSubmitting || _totalAllocations <= 0
                            ? null
                            : _submit,
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text('Record payment'),
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

class _AllocationRow extends StatelessWidget {
  const _AllocationRow({
    required this.draft,
    required this.currency,
    required this.dateFormat,
    required this.onChanged,
  });

  final PaymentAllocationDraft draft;
  final NumberFormat currency;
  final DateFormat dateFormat;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final billLabel = displayAllocationBillNumber(
      SupplierPaymentAllocation(
        id: '',
        billId: draft.billId,
        billNumber: draft.billNumber,
        receiptNumber: draft.receiptNumber,
      ),
    );

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest
            .withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: 0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            billLabel,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          if (draft.dueDate != null)
            Text(
              'Due ${dateFormat.format(draft.dueDate!)}',
              style: TextStyle(
                fontSize: 12,
                color: AppTheme.textSecondary(context),
              ),
            ),
          Text(
            'Balance ${currency.format(draft.balanceDue)}',
            style: TextStyle(
              fontSize: 12,
              color: AppTheme.textSecondary(context),
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            initialValue: draft.amount == 0 ? '' : '${draft.amount}',
            decoration: const InputDecoration(
              labelText: 'Allocation amount',
              border: OutlineInputBorder(),
              isDense: true,
            ),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
            ],
            onChanged: (v) {
              final amount = double.tryParse(v) ?? 0;
              onChanged(amount.clamp(0, draft.balanceDue));
            },
            validator: (v) {
              final amount = double.tryParse(v ?? '') ?? 0;
              if (amount < 0) return 'Invalid amount';
              if (amount > draft.balanceDue + 0.001) {
                return 'Exceeds balance';
              }
              return null;
            },
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    this.description,
    required this.child,
  });

  final String title;
  final String? description;
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
            if (description != null) ...[
              const SizedBox(height: 4),
              Text(
                description!,
                style: TextStyle(
                  fontSize: 12,
                  color: AppTheme.textSecondary(context),
                ),
              ),
            ],
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}
