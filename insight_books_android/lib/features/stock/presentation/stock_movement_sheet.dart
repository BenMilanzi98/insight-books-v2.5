import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

import '../data/stock_movement_offline_queue.dart';
import '../data/stock_repository.dart';
import 'providers/stock_details_provider.dart';
import 'providers/stock_provider.dart';

Future<bool> showStockMovementSheet({
  required BuildContext context,
  required WidgetRef ref,
  required String productId,
  required String productName,
  required double currentQty,
  required StockMovementType type,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => _StockMovementSheet(
      productId: productId,
      productName: productName,
      currentQty: currentQty,
      type: type,
    ),
  );
  return result == true;
}

class _StockMovementSheet extends ConsumerStatefulWidget {
  const _StockMovementSheet({
    required this.productId,
    required this.productName,
    required this.currentQty,
    required this.type,
  });

  final String productId;
  final String productName;
  final double currentQty;
  final StockMovementType type;

  @override
  ConsumerState<_StockMovementSheet> createState() =>
      _StockMovementSheetState();
}

class _StockMovementSheetState extends ConsumerState<_StockMovementSheet> {
  final _qtyCtrl = TextEditingController();
  final _unitCostCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _unitCostCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  String get _title {
    switch (widget.type) {
      case StockMovementType.stockIn:
        return 'Stock In';
      case StockMovementType.stockOut:
        return 'Stock Out';
      case StockMovementType.adjustment:
        return 'Adjust Stock';
    }
  }

  String get _qtyLabel {
    if (widget.type == StockMovementType.adjustment) {
      return 'New quantity';
    }
    return 'Quantity';
  }

  Future<void> _submit() async {
    final qtyText = _qtyCtrl.text.trim();
    final quantity = double.tryParse(qtyText);
    if (quantity == null || quantity <= 0) {
      setState(() => _error = 'Enter a quantity greater than zero.');
      return;
    }

    if (widget.type == StockMovementType.stockOut &&
        quantity > widget.currentQty) {
      setState(() => _error = 'Cannot remove more than available stock.');
      return;
    }

    final unitCostText = _unitCostCtrl.text.trim();
    final unitCost =
        unitCostText.isEmpty ? null : double.tryParse(unitCostText);
    final notes = _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim();

    setState(() {
      _submitting = true;
      _error = null;
    });

    final repo = ref.read(stockRepositoryProvider);
    final stockNotifier = ref.read(stockControllerProvider.notifier);

    try {
      await repo.postTransaction(
        productId: widget.productId,
        type: widget.type.label,
        quantity: quantity,
        unitCost: unitCost,
        notes: notes,
      );

      stockNotifier.applyOptimisticMovement(
        productId: widget.productId,
        type: widget.type,
        quantity: quantity,
        currentQty: widget.currentQty,
      );
      ref.invalidate(stockDetailsProvider(widget.productId));
      ref.invalidate(stockMovementHistoryProvider(widget.productId));

      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$_title recorded')),
      );
    } catch (e) {
      if (NetworkErrorMapper.isConnectionError(e)) {
        final tenantId = ref.read(tenantProvider).currentTenantId;
        if (tenantId == null || tenantId.isEmpty) {
          setState(() {
            _submitting = false;
            _error = 'Business context missing. Cannot queue offline.';
          });
          return;
        }

        final queue = StockMovementOfflineQueue();
        await queue.enqueue(
          tenantId: tenantId,
          productId: widget.productId,
          type: widget.type,
          quantity: quantity,
          unitCost: unitCost,
          notes: notes,
        );
        await stockNotifier.refreshPendingMovementCount();

        // Keep details provider warm offline — invalidating would refetch and
        // replace the screen with an error. Optimistic qty comes from the list.
        stockNotifier.applyOptimisticMovement(
          productId: widget.productId,
          type: widget.type,
          quantity: quantity,
          currentQty: widget.currentQty,
        );

        if (!mounted) return;
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Queued for sync')),
        );
        return;
      }

      setState(() {
        _submitting = false;
        _error = NetworkErrorMapper.toUserMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottomInset),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    _title,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: _submitting ? null : () => Navigator.pop(context),
                ),
              ],
            ),
            Text(
              widget.productName,
              style: theme.textTheme.bodyMedium,
            ),
            if (widget.type != StockMovementType.adjustment)
              Text(
                'Current stock: ${widget.currentQty}',
                style: theme.textTheme.bodySmall,
              ),
            const SizedBox(height: 16),
            TextField(
              controller: _qtyCtrl,
              enabled: !_submitting,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: _qtyLabel,
                border: const OutlineInputBorder(),
              ),
              autofocus: true,
            ),
            if (widget.type == StockMovementType.stockIn) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _unitCostCtrl,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Unit cost (optional)',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              enabled: !_submitting,
              decoration: const InputDecoration(
                labelText: 'Notes (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text('Save $_title'),
            ),
          ],
        ),
      ),
    );
  }
}
