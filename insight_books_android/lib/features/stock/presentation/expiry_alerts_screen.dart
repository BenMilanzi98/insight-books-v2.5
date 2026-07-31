import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import 'package:insightbooks_android/shared/widgets/stat_card.dart';

import '../domain/stock_models.dart';
import 'providers/expiry_alerts_provider.dart';

class ExpiryAlertsScreen extends ConsumerStatefulWidget {
  const ExpiryAlertsScreen({super.key});

  @override
  ConsumerState<ExpiryAlertsScreen> createState() => _ExpiryAlertsScreenState();
}

class _ExpiryAlertsScreenState extends ConsumerState<ExpiryAlertsScreen> {
  final _currencyFormat = NumberFormat.currency(symbol: 'MK ', decimalDigits: 0);
  final _dateFormat = DateFormat('d MMM yyyy');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(expiryAlertsControllerProvider.notifier).load();
    });
  }

  Future<void> _showWriteOffDialog(ExpiryAlert alert) async {
    final qtyCtrl = TextEditingController(
      text: alert.qtyRemaining > 0 ? '${alert.qtyRemaining}' : '',
    );
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Write off batch'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              alert.productName,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Qty remaining: ${alert.qtyRemaining}',
              style: TextStyle(color: AppTheme.textSecondary(ctx)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: qtyCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Quantity (leave full amount to write off all)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Write off'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      qtyCtrl.dispose();
      return;
    }

    final rawQty = qtyCtrl.text.trim();
    qtyCtrl.dispose();
    double? qty;
    if (rawQty.isNotEmpty) {
      qty = double.tryParse(rawQty);
      if (qty == null || qty <= 0) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Enter a valid quantity')),
          );
        }
        return;
      }
    }

    final err = await ref
        .read(expiryAlertsControllerProvider.notifier)
        .writeOff(alert: alert, quantity: qty);
    if (!mounted) return;
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Batch written off')),
      );
    }
  }

  Future<void> _showRestockDialog(ExpiryAlert alert) async {
    final qtyCtrl = TextEditingController();
    final costCtrl = TextEditingController(
      text: alert.unitCost > 0 ? '${alert.unitCost}' : '',
    );
    final expiryCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    DateTime? pickedExpiry;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Restock product'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert.productName,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: qtyCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Quantity *',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: costCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Unit cost *',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    pickedExpiry == null
                        ? 'Expiry date (optional)'
                        : 'Expiry: ${_dateFormat.format(pickedExpiry!)}',
                  ),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () async {
                    final now = DateTime.now();
                    final date = await showDatePicker(
                      context: ctx,
                      initialDate: now,
                      firstDate: now,
                      lastDate: now.add(const Duration(days: 365 * 5)),
                    );
                    if (date != null) {
                      setDialogState(() {
                        pickedExpiry = date;
                        expiryCtrl.text =
                            '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
                      });
                    }
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Notes (optional)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Restock'),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !mounted) {
      qtyCtrl.dispose();
      costCtrl.dispose();
      expiryCtrl.dispose();
      notesCtrl.dispose();
      return;
    }

    final qty = double.tryParse(qtyCtrl.text.trim());
    final cost = double.tryParse(costCtrl.text.trim());
    final notes = notesCtrl.text.trim();
    final expiryDate = expiryCtrl.text.trim();
    qtyCtrl.dispose();
    costCtrl.dispose();
    expiryCtrl.dispose();
    notesCtrl.dispose();

    if (qty == null || qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a positive quantity')),
      );
      return;
    }
    if (cost == null || cost < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid unit cost')),
      );
      return;
    }

    final err = await ref.read(expiryAlertsControllerProvider.notifier).restock(
          alert: alert,
          quantity: qty,
          unitCost: cost,
          expiryDate: expiryDate.isEmpty ? null : expiryDate,
          notes: notes.isEmpty ? null : notes,
        );
    if (!mounted) return;
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Restock recorded')),
      );
    }
  }

  Color _statusColor(BuildContext context, String status) {
    switch (status) {
      case 'expired':
        return AppTheme.errorColor(context);
      case 'urgent':
        return AppTheme.warningColor(context);
      case 'early':
        return const Color(0xFFF59E0B);
      default:
        return AppTheme.textSecondary(context);
    }
  }

  String _statusLabel(ExpiryAlert alert, ExpiryAlertThresholds thresholds) {
    switch (alert.status) {
      case 'expired':
        return 'Expired';
      case 'urgent':
        return 'Urgent (≤${thresholds.urgentDays}d)';
      case 'early':
        return 'Early (≤${thresholds.earlyDays}d)';
      default:
        return alert.status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(expiryAlertsControllerProvider);
    final notifier = ref.read(expiryAlertsControllerProvider.notifier);

    if (!state.canView) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Expiry alerts')),
        body: const Center(
          child: Text('You do not have permission to view expiry alerts.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Expiry alerts'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: [
          IconButton(
            icon: state.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: state.isLoading ? null : () => notifier.refresh(),
          ),
          const ThemeToggleButton(),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: notifier.refresh,
        child: state.isLoading && state.rows.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 200),
                  Center(child: CircularProgressIndicator()),
                ],
              )
            : _buildBody(context, state, notifier),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ExpiryAlertsState state,
    ExpiryAlertsController notifier,
  ) {
    if (state.error != null && state.rows.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          Icon(Icons.cloud_off, size: 48, color: AppTheme.errorColor(context)),
          const SizedBox(height: 16),
          Text(
            state.error!,
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary(context)),
          ),
          const SizedBox(height: 16),
          Center(
            child: FilledButton(
              onPressed: () => notifier.refresh(),
              child: const Text('Retry'),
            ),
          ),
        ],
      );
    }

    final rows = state.filteredRows;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        if (state.migrationPending)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.warningBg(context),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppTheme.warningColor(context).withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              'Expiry tracking migration is pending on the server. Alerts will appear once applied.',
              style: TextStyle(color: AppTheme.textSecondary(context)),
            ),
          ),
        Row(
          children: [
            Expanded(
              child: StatCard(
                label: 'Expired',
                value: '${state.summary.expired}',
                count: state.summary.expired,
                color: AppTheme.errorColor(context),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatCard(
                label: 'Urgent',
                value: '${state.summary.urgent}',
                count: state.summary.urgent,
                color: AppTheme.warningColor(context),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatCard(
                label: 'Early',
                value: '${state.summary.early}',
                count: state.summary.early,
                color: const Color(0xFFF59E0B),
              ),
            ),
          ],
        ),
        if (state.summary.totalLineValue > 0) ...[
          const SizedBox(height: 12),
          Text(
            'At-risk value: ${_currencyFormat.format(state.summary.totalLineValue)}',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: AppTheme.textSecondary(context),
            ),
          ),
        ],
        const SizedBox(height: 16),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _FilterChip(
                label: 'All',
                selected: state.statusFilter == 'all',
                onSelected: () => notifier.setStatusFilter('all'),
              ),
              _FilterChip(
                label: 'Expired',
                selected: state.statusFilter == 'expired',
                onSelected: () => notifier.setStatusFilter('expired'),
              ),
              _FilterChip(
                label: 'Urgent',
                selected: state.statusFilter == 'urgent',
                onSelected: () => notifier.setStatusFilter('urgent'),
              ),
              _FilterChip(
                label: 'Early',
                selected: state.statusFilter == 'early',
                onSelected: () => notifier.setStatusFilter('early'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 48),
            child: Column(
              children: [
                Icon(
                  Icons.check_circle_outline,
                  size: 48,
                  color: AppTheme.successColor(context),
                ),
                const SizedBox(height: 12),
                Text(
                  state.statusFilter == 'all'
                      ? 'No expiry alerts'
                      : 'No ${state.statusFilter} alerts',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary(context),
                  ),
                ),
                Text(
                  'Perishable batches within warning windows appear here.',
                  style: TextStyle(color: AppTheme.textSecondary(context)),
                ),
              ],
            ),
          )
        else
          ...rows.map((alert) => _buildAlertCard(context, state, alert)),
        if (state.isActionInProgress)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildAlertCard(
    BuildContext context,
    ExpiryAlertsState state,
    ExpiryAlert alert,
  ) {
    final color = _statusColor(context, alert.status);
    final expiryLabel = alert.expiryDate != null
        ? _dateFormat.format(alert.expiryDate!)
        : '—';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        alert.productName,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: AppTheme.textPrimary(context),
                        ),
                      ),
                      if (alert.sku != null && alert.sku!.isNotEmpty)
                        Text(
                          alert.sku!,
                          style: TextStyle(
                            color: AppTheme.textSecondary(context),
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: color.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    _statusLabel(alert, state.thresholds),
                    style: TextStyle(
                      color: color,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Qty ${alert.qtyRemaining} • Expiry $expiryLabel • ${alert.daysRemaining} day(s)',
              style: TextStyle(
                color: AppTheme.textSecondary(context),
                fontSize: 13,
              ),
            ),
            // Branch pickers are disabled in v2.5 (BranchVisibility); omit branch labels.
            const SizedBox(height: 4),
            Text(
              'Line value: ${_currencyFormat.format(alert.lineValue)}',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: AppTheme.textPrimary(context),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (alert.productId.isNotEmpty)
                  OutlinedButton.icon(
                    icon: const Icon(Icons.inventory_2_outlined, size: 18),
                    label: const Text('Product'),
                    onPressed: () =>
                        context.push('/stock/products/${alert.productId}'),
                  ),
                if (state.canAdjust) ...[
                  OutlinedButton.icon(
                    icon: const Icon(Icons.delete_outline, size: 18),
                    label: const Text('Write off'),
                    onPressed: state.isOffline
                        ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Write-off requires an internet connection.',
                                ),
                              ),
                            );
                          }
                        : state.isActionInProgress
                            ? null
                            : () => _showWriteOffDialog(alert),
                  ),
                  FilledButton.icon(
                    icon: const Icon(Icons.add_shopping_cart, size: 18),
                    label: const Text('Restock'),
                    onPressed: state.isOffline
                        ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Restock requires an internet connection.',
                                ),
                              ),
                            );
                          }
                        : state.isActionInProgress
                            ? null
                            : () => _showRestockDialog(alert),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onSelected(),
      ),
    );
  }
}
