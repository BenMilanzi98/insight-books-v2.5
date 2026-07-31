import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../domain/stock_models.dart';
import 'providers/receiving_provider.dart';

/// In-app routes for purchases deep links from Stock Receiving.
const _androidPurchasesRoutes = <String>{
  '/purchases/receipts',
  '/purchases/orders',
};

class ReceivingScreen extends ConsumerStatefulWidget {
  const ReceivingScreen({super.key});

  @override
  ConsumerState<ReceivingScreen> createState() => _ReceivingScreenState();
}

class _ReceivingScreenState extends ConsumerState<ReceivingScreen> {
  final _dateFormat = DateFormat('d MMM yyyy');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(receivingControllerProvider.notifier).load();
    });
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '—';
    return _dateFormat.format(date);
  }

  Future<void> _openPurchasesPath(String appPath) async {
    if (_androidPurchasesRoutes.contains(appPath)) {
      if (mounted) context.push(appPath);
      return;
    }

    final uri = Uri.parse(apiBaseUrl).resolve(appPath);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text(
          'Receive goods and purchase orders are available in the Insight Books web app.',
        ),
        action: SnackBarAction(
          label: 'Open web',
          onPressed: () async {
            if (await canLaunchUrl(uri)) {
              await launchUrl(uri, mode: LaunchMode.externalApplication);
            }
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(receivingControllerProvider);
    final notifier = ref.read(receivingControllerProvider.notifier);

    if (!state.canView) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Receiving')),
        body: const Center(
          child: Text('You do not have permission to view receiving data.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Receiving'),
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
        child: state.isLoading && state.data.orderedPoCount == 0 &&
                state.data.pendingReceiptCount == 0 &&
                state.data.receivedReceiptCount == 0 &&
                state.error == null
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
    ReceivingState state,
    ReceivingController notifier,
  ) {
    if (state.error != null &&
        state.data.orderedPoCount == 0 &&
        state.data.pendingReceiptCount == 0 &&
        state.data.receivedReceiptCount == 0) {
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

    final data = state.data;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton.icon(
              icon: const Icon(Icons.inbox_outlined, size: 18),
              label: const Text('Receive goods'),
              onPressed: () => _openPurchasesPath('/purchases/receipts'),
            ),
            OutlinedButton.icon(
              icon: const Icon(Icons.list_alt_outlined, size: 18),
              label: const Text('All purchase orders'),
              onPressed: () => _openPurchasesPath('/purchases/orders'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _OrderedGoodsSection(
          purchaseOrders: data.orderedGoodsOutstanding,
          formatDate: _formatDate,
          onReceive: () => _openPurchasesPath('/purchases/receipts'),
        ),
        const SizedBox(height: 16),
        _PostedInventoryPendingSection(
          receipts: data.postedInventoryPending,
          formatDate: _formatDate,
          onView: () => _openPurchasesPath('/purchases/receipts'),
        ),
        const SizedBox(height: 16),
        _GoodsReceivedSection(
          receipts: data.goodsReceivedPosted,
          formatDate: _formatDate,
          onView: () => _openPurchasesPath('/purchases/receipts'),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _OrderedGoodsSection extends StatelessWidget {
  const _OrderedGoodsSection({
    required this.purchaseOrders,
    required this.formatDate,
    required this.onReceive,
  });

  final List<ReceivingPurchaseOrder> purchaseOrders;
  final String Function(DateTime?) formatDate;
  final VoidCallback onReceive;

  @override
  Widget build(BuildContext context) {
    return _ReceivingSectionCard(
      title: 'Ordered goods',
      subtitle:
          'Goods still to receive on approved / in-flight purchase orders.',
      icon: Icons.inventory_2_outlined,
      badge: '${purchaseOrders.length} PO${purchaseOrders.length == 1 ? '' : 's'}',
      accentColor: const Color(0xFFD97706),
      backgroundColor: const Color(0xFFFFFBEB),
      borderColor: const Color(0xFFFDE68A),
      emptyMessage: 'No outstanding goods on purchase orders.',
      child: purchaseOrders.isEmpty
          ? null
          : Column(
              children: purchaseOrders
                  .map(
                    (po) => _PoCard(
                      po: po,
                      formatDate: formatDate,
                      onReceive: onReceive,
                    ),
                  )
                  .toList(),
            ),
    );
  }
}

class _PostedInventoryPendingSection extends StatelessWidget {
  const _PostedInventoryPendingSection({
    required this.receipts,
    required this.formatDate,
    required this.onView,
  });

  final List<ReceivingGoodsReceipt> receipts;
  final String Function(DateTime?) formatDate;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    return _ReceivingSectionCard(
      title: 'Stock posting pending',
      subtitle:
          'Posted receipts whose inventory has not been applied yet (e.g. future receipt date).',
      icon: Icons.inbox_outlined,
      badge:
          '${receipts.length} receipt${receipts.length == 1 ? '' : 's'}',
      accentColor: const Color(0xFF0D9488),
      backgroundColor: const Color(0xFFF0FDFA),
      borderColor: const Color(0xFF99F6E4),
      emptyMessage: 'No receipts awaiting stock posting.',
      child: receipts.isEmpty
          ? null
          : Column(
              children: receipts
                  .map(
                    (r) => _ReceiptCard(
                      receipt: r,
                      formatDate: formatDate,
                      onView: onView,
                      actionLabel: 'View',
                    ),
                  )
                  .toList(),
            ),
    );
  }
}

class _GoodsReceivedSection extends StatelessWidget {
  const _GoodsReceivedSection({
    required this.receipts,
    required this.formatDate,
    required this.onView,
  });

  final List<ReceivingGoodsReceipt> receipts;
  final String Function(DateTime?) formatDate;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    return _ReceivingSectionCard(
      title: 'Goods received',
      subtitle: 'Posted receipts with stock applied to inventory.',
      icon: Icons.check_circle_outline,
      badge: '${receipts.length} recent',
      accentColor: const Color(0xFF059669),
      backgroundColor: const Color(0xFFECFDF5),
      borderColor: const Color(0xFFA7F3D0),
      emptyMessage: 'No recent completed receipts.',
      child: receipts.isEmpty
          ? null
          : Column(
              children: receipts
                  .map(
                    (r) => _ReceiptCard(
                      receipt: r,
                      formatDate: formatDate,
                      onView: onView,
                      actionLabel: 'View',
                    ),
                  )
                  .toList(),
            ),
    );
  }
}

class _ReceivingSectionCard extends StatelessWidget {
  const _ReceivingSectionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.badge,
    required this.accentColor,
    required this.backgroundColor,
    required this.borderColor,
    required this.emptyMessage,
    this.child,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String badge;
  final Color accentColor;
  final Color backgroundColor;
  final Color borderColor;
  final String emptyMessage;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: borderColor)),
            ),
            child: Row(
              children: [
                Icon(icon, size: 18, color: accentColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary(context),
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    badge,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: accentColor,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Text(
              subtitle,
              style: TextStyle(
                fontSize: 12,
                color: AppTheme.textSecondary(context),
              ),
            ),
          ),
          if (child == null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text(
                emptyMessage,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppTheme.textSecondary(context),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: child!,
            ),
        ],
      ),
    );
  }
}

class _PoCard extends StatelessWidget {
  const _PoCard({
    required this.po,
    required this.formatDate,
    required this.onReceive,
  });

  final ReceivingPurchaseOrder po;
  final String Function(DateTime?) formatDate;
  final VoidCallback onReceive;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
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
                        po.poNumber,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary(context),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${po.supplierName ?? ''} · ${formatDate(po.poDate)} · ${po.status ?? ''}',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary(context),
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: onReceive,
                  child: const Text('Receive'),
                ),
              ],
            ),
            const Divider(height: 16),
            ...po.lines.map(
              (line) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        line.sku != null && line.sku!.isNotEmpty
                            ? '${line.productName} (${line.sku})'
                            : line.productName,
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.textPrimary(context),
                        ),
                      ),
                    ),
                    Text(
                      '${line.quantityRemaining} left / ${line.quantityOrdered} ordered',
                      style: const TextStyle(
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: Color(0xFF92400E),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  const _ReceiptCard({
    required this.receipt,
    required this.formatDate,
    required this.onView,
    required this.actionLabel,
  });

  final ReceivingGoodsReceipt receipt;
  final String Function(DateTime?) formatDate;
  final VoidCallback onView;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    final poLabel = receipt.poNumber != null && receipt.poNumber!.isNotEmpty
        ? ' · PO ${receipt.poNumber}'
        : '';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    receipt.receiptNumber,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary(context),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${receipt.supplierName ?? ''}$poLabel · ${formatDate(receipt.receiptDate)} · ${receipt.itemCount} line${receipt.itemCount == 1 ? '' : 's'}',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary(context),
                    ),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: onView,
              child: Text(actionLabel),
            ),
          ],
        ),
      ),
    );
  }
}
