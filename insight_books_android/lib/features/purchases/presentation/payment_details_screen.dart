import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../domain/purchases_models.dart';
import 'providers/payments_provider.dart';

class PaymentDetailsScreen extends ConsumerWidget {
  final String paymentId;

  const PaymentDetailsScreen({super.key, required this.paymentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(paymentDetailProvider(paymentId));
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);
    final dateFormat = DateFormat.yMMMd();

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Supplier payment'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: const [ThemeToggleButton()],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(NetworkErrorMapper.toUserMessage(e)),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () =>
                      ref.invalidate(paymentDetailProvider(paymentId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (payment) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      payment.paymentNumber ?? payment.id,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        payment.supplierName ?? '—',
                        if (payment.paymentDate != null)
                          dateFormat.format(payment.paymentDate!),
                      ].join(' · '),
                      style: TextStyle(
                        color: AppTheme.textSecondary(context),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Payment summary',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _DetailRow(
                      label: 'Payment method',
                      value: displayPaymentMethod(payment),
                    ),
                    _DetailRow(
                      label: 'Reference',
                      value: payment.reference ?? '—',
                    ),
                    _DetailRow(
                      label: 'Total amount',
                      value: currency.format(payment.amount),
                      emphasize: true,
                    ),
                    _DetailRow(
                      label: 'Allocations',
                      value: '${payment.allocations.length}',
                    ),
                    if (payment.notes != null && payment.notes!.isNotEmpty)
                      _DetailRow(label: 'Notes', value: payment.notes!),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bill allocations',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (payment.allocations.isEmpty)
                      Text(
                        'No allocations recorded.',
                        style: TextStyle(
                          color: AppTheme.textSecondary(context),
                        ),
                      )
                    else
                      for (final allocation in payment.allocations)
                        _AllocationTile(
                          allocation: allocation,
                          currency: currency,
                        ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _AllocationTile extends StatelessWidget {
  const _AllocationTile({
    required this.allocation,
    required this.currency,
  });

  final SupplierPaymentAllocation allocation;
  final NumberFormat currency;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              displayAllocationBillNumber(allocation),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Text(currency.format(allocation.amount)),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(color: AppTheme.textSecondary(context)),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: emphasize
                  ? const TextStyle(fontWeight: FontWeight.bold)
                  : null,
            ),
          ),
        ],
      ),
    );
  }
}
