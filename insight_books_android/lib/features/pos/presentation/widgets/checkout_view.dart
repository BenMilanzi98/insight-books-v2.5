import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/features/pos/presentation/providers/pos_provider.dart';
import 'package:insightbooks_android/features/pos/domain/pos_models.dart';
import 'package:insightbooks_android/features/pos/presentation/receipt_screen.dart';

class CheckoutView extends ConsumerStatefulWidget {
  const CheckoutView({super.key});

  @override
  ConsumerState<CheckoutView> createState() => _CheckoutViewState();
}

class _CheckoutViewState extends ConsumerState<CheckoutView> {
  String _paymentMethod = 'cash';
  bool _useSplitPayments = false;
  final TextEditingController _notesController = TextEditingController();
  final List<_AllocationDraft> _allocations = [];

  @override
  void dispose() {
    _notesController.dispose();
    for (final allocation in _allocations) {
      allocation.amountController.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final posState = ref.watch(posProvider);
    final posNotifier = ref.read(posProvider.notifier);
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 2,
    );
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Checkout',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                // Customer Selection
                Text(
                  'Customer',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: () =>
                      _showCustomerPicker(context, posState, posNotifier),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      border: Border.all(color: colorScheme.outline.withValues(alpha: 0.5)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.person_outline, color: colorScheme.primary),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            posState.selectedClient?.name ?? 'Walk-in Customer',
                            style: TextStyle(fontWeight: FontWeight.w500, color: colorScheme.onSurface),
                          ),
                        ),
                        Icon(Icons.chevron_right, color: colorScheme.onSurfaceVariant),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // Payment Method
                Text(
                  'Payment Method',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                ),
                const SizedBox(height: 12),
                _buildPaymentMethodTile(
                  'cash',
                  'Cash',
                  Icons.payments_outlined,
                ),
                _buildPaymentMethodTile(
                  'card',
                  'Card',
                  Icons.credit_card_outlined,
                ),
                _buildPaymentMethodTile(
                  'bank_transfer',
                  'Bank Transfer',
                  Icons.account_balance_outlined,
                ),
                _buildPaymentMethodTile(
                  'mobile_money',
                  'Mobile Money',
                  Icons.smartphone_outlined,
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    'Use split payment',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  subtitle: Text(
                    'Allocate total across multiple payment accounts',
                    style: TextStyle(color: colorScheme.onSurfaceVariant),
                  ),
                  value: _useSplitPayments,
                  onChanged: (value) {
                    setState(() {
                      _useSplitPayments = value;
                      if (value && _allocations.isEmpty) {
                        _allocations.add(_AllocationDraft());
                      }
                    });
                  },
                ),
                if (_useSplitPayments) ...[
                  const SizedBox(height: 8),
                  ..._allocations.asMap().entries.map((entry) {
                    final index = entry.key;
                    final allocation = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: DropdownButtonFormField<String>(
                              value: allocation.paymentAccountId,
                              decoration: const InputDecoration(
                                labelText: 'Account',
                                border: OutlineInputBorder(),
                                isDense: true,
                              ),
                              items: posState.paymentAccounts
                                  .map(
                                    (acc) => DropdownMenuItem<String>(
                                      value: (acc['id'] ?? '').toString(),
                                      child: Text(
                                        (acc['accountName'] ??
                                                acc['name'] ??
                                                'Payment Account')
                                            .toString(),
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) {
                                setState(() {
                                  allocation.paymentAccountId = value;
                                });
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 2,
                            child: TextField(
                              controller: allocation.amountController,
                              keyboardType: const TextInputType.numberWithOptions(
                                decimal: true,
                              ),
                              decoration: const InputDecoration(
                                labelText: 'Amount',
                                prefixText: 'MWK ',
                                border: OutlineInputBorder(),
                                isDense: true,
                              ),
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                          IconButton(
                            onPressed: _allocations.length == 1
                                ? null
                                : () {
                                    setState(() {
                                      _allocations[index]
                                          .amountController
                                          .dispose();
                                      _allocations.removeAt(index);
                                    });
                                  },
                            icon: const Icon(Icons.delete_outline),
                          ),
                        ],
                      ),
                    );
                  }),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () {
                        setState(() {
                          _allocations.add(_AllocationDraft());
                        });
                      },
                      icon: const Icon(Icons.add),
                      label: const Text('Add allocation'),
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Allocated: ${currencyFormat.format(_allocatedTotal)} / ${currencyFormat.format(posState.total)}',
                      style: TextStyle(
                        color: _isAllocationValid(posState.total)
                            ? Colors.green
                            : colorScheme.error,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 32),
                if (posState.eisEnabled) ...[
                  Text(
                    'EIS Compliance',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'B2C', label: Text('B2C')),
                      ButtonSegment(value: 'B2B', label: Text('B2B')),
                    ],
                    selected: {posState.transactionType},
                    onSelectionChanged: (set) =>
                        posNotifier.setTransactionType(set.first),
                  ),
                  const SizedBox(height: 12),
                  if (posState.transactionType == 'B2B') ...[
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Buyer TPIN (8 digits)',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                      onChanged: posNotifier.setBuyerTpin,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Buyer Authorization Code (optional)',
                        border: OutlineInputBorder(),
                      ),
                      onChanged: posNotifier.setBuyerAuthCode,
                    ),
                    const SizedBox(height: 8),
                  ],
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Relief Supply (VAT 5)'),
                    value: posState.isReliefSupply,
                    onChanged: posNotifier.setReliefSupply,
                  ),
                  if (posState.isReliefSupply) ...[
                    TextField(
                      decoration: InputDecoration(
                        labelText: 'VAT 5 Certificate Number',
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.verified_user_outlined),
                          onPressed: () async {
                            final ok = await posNotifier.validateVat5();
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  ok
                                      ? 'VAT 5 certificate validated'
                                      : 'VAT 5 validation failed',
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      onChanged: posNotifier.setVat5Certificate,
                    ),
                  ],
                  const SizedBox(height: 20),
                ],

                // Notes
                Text(
                  'Sale Notes (Optional)',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colorScheme.onSurface),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _notesController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Add any additional information...',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: colorScheme.outline),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: colorScheme.outline),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Total & Pay Button
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: colorScheme.surface,
              boxShadow: [
                BoxShadow(
                  color: colorScheme.shadow.withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total Payable',
                        style: TextStyle(fontSize: 16, color: colorScheme.onSurfaceVariant),
                      ),
                      Text(
                        currencyFormat.format(posState.total),
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: posState.isSubmitting || !posState.canUpdateSales
                              ? null
                              : () => _saveDraft(context, posNotifier),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(56),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: const Text('Save Draft'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: SizedBox(
                          height: 56,
                          child: ElevatedButton(
                            onPressed: posState.isSubmitting || !posState.canCreateSales
                                ? null
                                : () => _processPayment(context, posNotifier),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: colorScheme.primary,
                              foregroundColor: colorScheme.onPrimary,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              elevation: 0,
                            ),
                            child: posState.isSubmitting
                                ? CircularProgressIndicator(
                                    color: colorScheme.onPrimary,
                                  )
                                : Text(
                                    'Complete Sale',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: colorScheme.onPrimary,
                                    ),
                                  ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodTile(String id, String label, IconData icon) {
    final isSelected = _paymentMethod == id;
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: InkWell(
        onTap: () => setState(() => _paymentMethod = id),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isSelected
                ? colorScheme.primary.withValues(alpha: 0.15)
                : colorScheme.surface,
            border: Border.all(
              color: isSelected ? colorScheme.primary : colorScheme.outline.withValues(alpha: 0.5),
              width: isSelected ? 2 : 1,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                color: isSelected ? colorScheme.primary : colorScheme.onSurfaceVariant,
              ),
              const SizedBox(width: 12),
              Text(
                label,
                style: TextStyle(
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? colorScheme.primary : colorScheme.onSurface,
                ),
              ),
              const Spacer(),
              if (isSelected)
                Icon(Icons.check_circle, color: colorScheme.primary),
            ],
          ),
        ),
      ),
    );
  }

  void _showCustomerPicker(
    BuildContext context,
    PosPageState state,
    Pos notifier,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        final cs = Theme.of(sheetContext).colorScheme;
        return Container(
          height: MediaQuery.of(sheetContext).size.height * 0.7,
          decoration: BoxDecoration(
            color: cs.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Select Customer',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: cs.onSurface),
                    ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: Icon(Icons.close, color: cs.onSurface),
                  ),
                ],
              ),
            ),
            Divider(color: cs.outline),
            ListTile(
              leading: Icon(Icons.person_add_disabled, color: cs.onSurfaceVariant),
              title: Text('Walk-in Customer', style: TextStyle(color: cs.onSurface)),
              onTap: () {
                notifier.selectClient(null);
                Navigator.pop(context);
              },
            ),
            Expanded(
              child: ListView.builder(
                itemCount: state.clients.length,
                itemBuilder: (ctx, index) {
                  final client = state.clients[index];
                  return ListTile(
                    leading: CircleAvatar(child: Icon(Icons.person, color: cs.onSurface)),
                    title: Text(client.name, style: TextStyle(color: cs.onSurface)),
                    subtitle: Text(client.phone ?? client.email ?? '', style: TextStyle(color: cs.onSurfaceVariant)),
                    onTap: () {
                      notifier.selectClient(client);
                      Navigator.pop(context);
                    },
                  );
                },
              ),
            ),
          ],
        ),
        );
      },
    );
  }

  Future<void> _processPayment(BuildContext context, Pos notifier) async {
    final posState = ref.read(posProvider);
    if (posState.offlineBlockedMessage != null &&
        posState.offlineBlockedMessage!.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(posState.offlineBlockedMessage!)),
      );
      return;
    }
    if (posState.eisEnabled && posState.eisTerminalBlocked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('EIS terminal is blocked.')),
      );
      return;
    }
    if (posState.transactionType == 'B2B' &&
        !RegExp(r'^\d{8}$').hasMatch(posState.buyerTpin.trim())) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('B2B requires a valid 8-digit TPIN')),
      );
      return;
    }
    if (posState.isReliefSupply &&
        (posState.vat5CertificateNumber.trim().isEmpty ||
            !posState.vat5Validated)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Validate VAT 5 certificate first')),
      );
      return;
    }

    List<PaymentAllocation>? allocations;
    if (_useSplitPayments) {
      if (!_isAllocationValid(ref.read(posProvider).total)) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Split allocations must match total and include accounts'),
            ),
          );
        }
        return;
      }
      allocations = _allocations
          .map(
            (a) => PaymentAllocation(
              paymentAccountId: a.paymentAccountId!,
              amount: double.tryParse(a.amountController.text.trim()) ?? 0,
            ),
          )
          .toList();
    }

    final success = await notifier.checkout(
      paymentMethod: _paymentMethod,
      allocations: allocations,
      notes: _notesController.text.trim().isEmpty
          ? null
          : _notesController.text.trim(),
    );

    if (!context.mounted) return;

    if (success) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => ReceiptScreen(
            saleData: ref.read(posProvider).lastSaleResponse ?? {},
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to complete sale. Please try again.'),
        ),
      );
    }
  }

  Future<void> _saveDraft(BuildContext context, Pos notifier) async {
    List<PaymentAllocation>? allocations;
    if (_useSplitPayments) {
      if (!_isAllocationValid(ref.read(posProvider).total)) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Split allocations must match total and include accounts'),
            ),
          );
        }
        return;
      }
      allocations = _allocations
          .map(
            (a) => PaymentAllocation(
              paymentAccountId: a.paymentAccountId!,
              amount: double.tryParse(a.amountController.text.trim()) ?? 0,
            ),
          )
          .toList();
    }

    final success = await notifier.saveDraft(
      paymentMethod: _paymentMethod,
      allocations: allocations,
      notes: _notesController.text.trim().isEmpty
          ? null
          : _notesController.text.trim(),
    );
    if (!context.mounted) return;
    if (success) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Draft saved successfully')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save draft')),
      );
    }
  }

  double get _allocatedTotal {
    return _allocations.fold<double>(0, (sum, allocation) {
      return sum + (double.tryParse(allocation.amountController.text.trim()) ?? 0);
    });
  }

  bool _isAllocationValid(double total) {
    if (!_useSplitPayments) return true;
    if (_allocations.isEmpty) return false;
    final allAccountsSelected = _allocations.every(
      (a) => a.paymentAccountId != null && a.paymentAccountId!.isNotEmpty,
    );
    if (!allAccountsSelected) return false;
    final diff = (_allocatedTotal - total).abs();
    return diff < 0.01;
  }
}

class _AllocationDraft {
  String? paymentAccountId;
  final TextEditingController amountController = TextEditingController();
}
