import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import 'providers/suppliers_provider.dart';

class SupplierDetailsScreen extends ConsumerWidget {
  final String supplierId;

  const SupplierDetailsScreen({super.key, required this.supplierId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(supplierLedgerProvider(supplierId));
    final page = ref.watch(suppliersControllerProvider);
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);
    final dateFormat = DateFormat.yMMMd();

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Supplier details'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          const ThemeToggleButton(),
          if (page.canUpdate)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              onPressed: () =>
                  context.push('/purchases/suppliers/$supplierId/edit'),
            ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Failed to load: $e'),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () =>
                      ref.invalidate(supplierLedgerProvider(supplierId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (ledger) {
          final supplier = ledger.supplier;
          final tx = ledger.transactions;
          final summary = tx['summary'] is Map
              ? Map<String, dynamic>.from(tx['summary'] as Map)
              : <String, dynamic>{};
          final bills = _asMapList(tx['bills']);
          final expenses = _asMapList(tx['expenses']);
          final payments = _asMapList(tx['payments']);

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(supplierLedgerProvider(supplierId));
              await ref.read(supplierLedgerProvider(supplierId).future);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  supplier.supplierName,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (supplier.supplierCode != null &&
                    supplier.supplierCode!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      supplier.supplierCode!,
                      style: TextStyle(color: AppTheme.textSecondary(context)),
                    ),
                  ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    Chip(
                      label: Text(supplier.isActive ? 'Active' : 'Inactive'),
                      backgroundColor: supplier.isActive
                          ? Colors.green.withAlpha(40)
                          : theme.colorScheme.surfaceContainerHighest,
                    ),
                    Chip(
                      label: Text(
                        'Balance ${currency.format(supplier.currentBalance)}',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _sectionTitle(context, 'Profile'),
                _infoCard(context, [
                  if (supplier.contactPerson != null &&
                      supplier.contactPerson!.isNotEmpty)
                    _row('Contact', supplier.contactPerson!),
                  if (supplier.email != null && supplier.email!.isNotEmpty)
                    _row('Email', supplier.email!),
                  if (supplier.phone != null && supplier.phone!.isNotEmpty)
                    _row('Phone', supplier.phone!),
                  if (supplier.address != null &&
                      supplier.address!.isNotEmpty)
                    _row('Address', supplier.address!),
                  if (supplier.paymentTerms != null)
                    _row('Payment terms', '${supplier.paymentTerms} days'),
                  if (supplier.paymentPreference != null &&
                      supplier.paymentPreference!.isNotEmpty)
                    _row('Preference', supplier.paymentPreference!),
                  if (supplier.currency != null &&
                      supplier.currency!.isNotEmpty)
                    _row('Currency', supplier.currency!),
                  if (supplier.notes != null && supplier.notes!.isNotEmpty)
                    _row('Notes', supplier.notes!),
                ]),
                const SizedBox(height: 16),
                _sectionTitle(context, 'Ledger summary'),
                _infoCard(context, [
                  _row(
                    'Total owed',
                    currency.format(_num(summary['totalOwed'])),
                  ),
                  _row(
                    'Total billed',
                    currency.format(_num(summary['totalBilled'])),
                  ),
                  _row(
                    'Total paid',
                    currency.format(_num(summary['totalPaid'])),
                  ),
                  _row(
                    'Current balance',
                    currency.format(
                      _num(summary['currentBalance'] ?? supplier.currentBalance),
                    ),
                  ),
                ]),
                const SizedBox(height: 16),
                _sectionTitle(context, 'Bills (${bills.length})'),
                if (bills.isEmpty)
                  _emptyHint(context, 'No bills recorded')
                else
                  ...bills.take(20).map(
                        (b) => _transactionTile(
                          context,
                          title: '${b['billNumber'] ?? 'Bill'}',
                          subtitle: [
                            if (b['billDate'] != null)
                              dateFormat.format(DateTime.parse('${b['billDate']}')),
                            '${b['status'] ?? ''}',
                          ].where((e) => e.toString().isNotEmpty).join(' · '),
                          amount: currency.format(_num(b['totalAmount'])),
                        ),
                      ),
                const SizedBox(height: 16),
                _sectionTitle(context, 'Expenses (${expenses.length})'),
                if (expenses.isEmpty)
                  _emptyHint(context, 'No expenses recorded')
                else
                  ...expenses.take(20).map(
                        (e) => _transactionTile(
                          context,
                          title: '${e['description'] ?? 'Expense'}',
                          subtitle: [
                            if (e['date'] != null)
                              dateFormat.format(DateTime.parse('${e['date']}')),
                            '${e['paymentStatus'] ?? ''}',
                          ].where((s) => s.toString().isNotEmpty).join(' · '),
                          amount: currency.format(_num(e['amount'])),
                        ),
                      ),
                const SizedBox(height: 16),
                _sectionTitle(context, 'Payments (${payments.length})'),
                if (payments.isEmpty)
                  _emptyHint(context, 'No payments recorded')
                else
                  ...payments.take(20).map(
                        (p) => _transactionTile(
                          context,
                          title: '${p['paymentNumber'] ?? 'Payment'}',
                          subtitle: [
                            if (p['paymentDate'] != null)
                              dateFormat.format(
                                DateTime.parse('${p['paymentDate']}'),
                              ),
                            if (p['paymentMethod'] != null)
                              '${p['paymentMethod']}',
                          ].where((s) => s.toString().isNotEmpty).join(' · '),
                          amount: currency.format(_num(p['totalAmount'])),
                        ),
                      ),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }

  static List<Map<String, dynamic>> _asMapList(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  static double _num(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse('$v') ?? 0;
  }

  static Widget _sectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }

  static Widget _infoCard(BuildContext context, List<Widget> rows) {
    if (rows.isEmpty) {
      return _emptyHint(context, 'No profile details');
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(children: rows),
      ),
    );
  }

  static Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  static Widget _emptyHint(BuildContext context, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        text,
        style: TextStyle(color: AppTheme.textSecondary(context)),
      ),
    );
  }

  static Widget _transactionTile(
    BuildContext context, {
    required String title,
    required String subtitle,
    required String amount,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(
          subtitle,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppTheme.textSecondary(context),
            fontSize: 12,
          ),
        ),
        trailing: Text(
          amount,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
