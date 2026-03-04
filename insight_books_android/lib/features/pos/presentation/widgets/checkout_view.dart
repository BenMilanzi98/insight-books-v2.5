import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/features/pos/presentation/providers/pos_provider.dart';
import 'package:insightbooks_android/features/pos/presentation/receipt_screen.dart';

class CheckoutView extends ConsumerStatefulWidget {
  const CheckoutView({super.key});

  @override
  ConsumerState<CheckoutView> createState() => _CheckoutViewState();
}

class _CheckoutViewState extends ConsumerState<CheckoutView> {
  String _paymentMethod = 'cash';
  final TextEditingController _notesController = TextEditingController();

  @override
  void dispose() {
    _notesController.dispose();
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

                const SizedBox(height: 32),

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
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: posState.isSubmitting
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
                          ? CircularProgressIndicator(color: colorScheme.onPrimary)
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
    final success = await notifier.checkout(paymentMethod: _paymentMethod);

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
}
