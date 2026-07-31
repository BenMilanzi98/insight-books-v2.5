import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/shared/widgets/stat_card.dart';

import '../domain/stock_models.dart';
import 'providers/stock_transfers_provider.dart';

class StockTransfersScreen extends ConsumerStatefulWidget {
  const StockTransfersScreen({super.key});

  @override
  ConsumerState<StockTransfersScreen> createState() =>
      _StockTransfersScreenState();
}

class _StockTransfersScreenState extends ConsumerState<StockTransfersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(stockTransfersControllerProvider.notifier).load();
    });
  }

  Future<void> _confirmReject(StockTransfer transfer) async {
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject transfer'),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(
            labelText: 'Reason (optional)',
            border: OutlineInputBorder(),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, reasonCtrl.text.trim()),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    reasonCtrl.dispose();
    if (reason == null || !mounted) return;

    final err = await ref
        .read(stockTransfersControllerProvider.notifier)
        .rejectTransfer(transfer.id, reason);
    if (!mounted) return;
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Transfer rejected')),
      );
    }
  }

  Future<void> _runAction(
    String label,
    Future<String?> Function() action,
  ) async {
    final err = await action();
    if (!mounted) return;
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Transfer $label')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(stockTransfersControllerProvider);
    final notifier = ref.read(stockTransfersControllerProvider.notifier);
    final theme = Theme.of(context);
    final dateFmt = DateFormat.yMMMd();

    if (!state.canView) {
      return const Center(
        child: Text('You do not have permission to view transfers.'),
      );
    }

    if (state.isOffline) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off, size: 48, color: AppTheme.textSecondary(context)),
              const SizedBox(height: 12),
              Text(
                'Transfers require an internet connection',
                style: TextStyle(color: AppTheme.textSecondary(context)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: notifier.refresh,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: notifier.refresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          if (state.stockByBranch.isNotEmpty)
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                    child: Text(
                      'Stock by business',
                      style: theme.textTheme.titleSmall,
                    ),
                  ),
                  SizedBox(
                    height: 96,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      itemCount: state.stockByBranch.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 8),
                      itemBuilder: (_, i) {
                        final row = state.stockByBranch[i];
                        return SizedBox(
                          width: 150,
                          child: StatCard(
                            label: row.name,
                            value: row.totalQuantity.toStringAsFixed(0),
                            count: row.productCount,
                            color: Colors.indigo,
                            subtitle: 'Value ${row.totalValue.toStringAsFixed(0)}',
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          SliverToBoxAdapter(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Row(
                children: [
                  for (final filter in const [
                    ('all', 'All'),
                    ('pending', 'Pending'),
                    ('approved', 'Approved'),
                    ('received', 'Received'),
                    ('rejected', 'Rejected'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(filter.$2),
                        selected: state.statusFilter == filter.$1,
                        onSelected: state.isLoading
                            ? null
                            : (_) => notifier.setStatusFilter(filter.$1),
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (state.isLoading && state.transfers.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: CircularProgressIndicator()),
            )
          else if (state.error != null && state.transfers.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(state.error!),
                ),
              ),
            )
          else if (state.transfers.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.swap_horiz_rounded,
                      size: 48,
                      color: AppTheme.textSecondary(context),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'No transfers yet',
                      style: TextStyle(color: AppTheme.textSecondary(context)),
                    ),
                    if (state.canManage) ...[
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: state.isActionInProgress
                            ? null
                            : () => context.push('/stock/transfers/create'),
                        icon: const Icon(Icons.add),
                        label: const Text('Create transfer'),
                      ),
                    ],
                  ],
                ),
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final transfer = state.transfers[index];
                  return _TransferCard(
                    transfer: transfer,
                    dateFmt: dateFmt,
                    canManage: state.canManage,
                    busy: state.isActionInProgress,
                    onApprove: () => _runAction(
                      'approved',
                      () => notifier.approveTransfer(transfer.id),
                    ),
                    onReceive: () => _runAction(
                      'received',
                      () => notifier.receiveTransfer(transfer.id),
                    ),
                    onReject: () => _confirmReject(transfer),
                  );
                },
                childCount: state.transfers.length,
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

class _TransferCard extends StatelessWidget {
  const _TransferCard({
    required this.transfer,
    required this.dateFmt,
    required this.canManage,
    required this.busy,
    required this.onApprove,
    required this.onReceive,
    required this.onReject,
  });

  final StockTransfer transfer;
  final DateFormat dateFmt;
  final bool canManage;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReceive;
  final VoidCallback onReject;

  Color _statusColor(BuildContext context) {
    switch (transfer.status.toLowerCase()) {
      case 'pending':
        return Colors.orange;
      case 'approved':
        return Colors.blue;
      case 'received':
        return Colors.green;
      case 'rejected':
        return Theme.of(context).colorScheme.error;
      default:
        return AppTheme.textSecondary(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fromLabel = transfer.fromBranch?.tenantName ??
        transfer.fromBranch?.name ??
        'Source';
    final toLabel =
        transfer.toBranch?.tenantName ?? transfer.toBranch?.name ?? 'Destination';
    final when = transfer.receivedAt ??
        transfer.approvedAt ??
        transfer.createdAt;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    transfer.productName ?? 'Product',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _statusColor(context).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    transfer.status,
                    style: TextStyle(
                      color: _statusColor(context),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            if (transfer.productSku != null && transfer.productSku!.isNotEmpty)
              Text(
                transfer.productSku!,
                style: TextStyle(
                  color: AppTheme.textSecondary(context),
                  fontSize: 12,
                ),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.arrow_forward, size: 16),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '$fromLabel → $toLabel',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Qty: ${transfer.quantity}${when != null ? ' · ${dateFmt.format(when)}' : ''}',
              style: TextStyle(
                color: AppTheme.textSecondary(context),
                fontSize: 12,
              ),
            ),
            if (transfer.notes != null && transfer.notes!.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  transfer.notes!,
                  style: TextStyle(
                    color: AppTheme.textSecondary(context),
                    fontSize: 12,
                  ),
                ),
              ),
            if (canManage &&
                (transfer.isPending || transfer.isApproved)) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  if (transfer.isPending) ...[
                    OutlinedButton(
                      onPressed: busy ? null : onApprove,
                      child: const Text('Approve'),
                    ),
                    OutlinedButton(
                      onPressed: busy ? null : onReject,
                      child: const Text('Reject'),
                    ),
                  ],
                  if (transfer.isApproved)
                    FilledButton(
                      onPressed: busy ? null : onReceive,
                      child: const Text('Receive'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
