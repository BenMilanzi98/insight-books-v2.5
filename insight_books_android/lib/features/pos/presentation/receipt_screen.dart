import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/features/pos/data/pos_repository.dart';
import 'package:insightbooks_android/shared/pdf_share_sheet.dart';

class ReceiptScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> saleData;

  const ReceiptScreen({super.key, required this.saleData});

  @override
  ConsumerState<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends ConsumerState<ReceiptScreen> {
  Map<String, dynamic>? _detail;
  Object? _loadError;
  var _loadingDetail = true;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  String? get _saleId {
    final sale = widget.saleData['sale'];
    if (sale is Map && sale['id'] != null) return sale['id'].toString();
    return widget.saleData['id']?.toString();
  }

  Future<void> _loadDetail() async {
    final id = _saleId;
    if (id == null || id.isEmpty || id.startsWith('OFFLINE-')) {
      if (mounted) setState(() => _loadingDetail = false);
      return;
    }
    try {
      final map = await ref.read(posRepositoryProvider).fetchSaleById(id);
      if (!mounted) return;
      setState(() {
        _detail = map;
        _loadingDetail = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e;
        _loadingDetail = false;
      });
    }
  }

  double _num(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    final s = v.toString().replaceAll(',', '').replaceAll(RegExp(r'[^\d.]'), '');
    return double.tryParse(s) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 2,
    );
    final sale = _detail ?? (widget.saleData['sale'] as Map<String, dynamic>? ?? {});
    final total = _num(sale['rawTotal'] ?? sale['total_amount'] ?? sale['total']);
    final subtotal = _num(sale['rawSubtotal'] ?? sale['subtotal']);
    final taxTotal = _num(sale['rawTaxAmount'] ?? sale['totalTaxAmount'] ?? sale['taxAmount']);
    final discount = _num(sale['totalDiscountAmount'] ?? sale['discount']);

    final client = sale['client'];
    String clientName = 'Walk-in Customer';
    if (client is Map) {
      clientName = (client['name'] ?? '').toString().isEmpty
          ? 'Walk-in Customer'
          : (client['name'] ?? '').toString();
    } else if (client is String && client.isNotEmpty) {
      clientName = client;
    }

    final items = (sale['items'] is List) ? (sale['items'] as List) : const [];
    final colorScheme = Theme.of(context).colorScheme;
    final saleNumber = (sale['saleNumber'] ?? '').toString();
    final receiptLabel = saleNumber.isNotEmpty ? saleNumber : (sale['id'] ?? 'N/A').toString();

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            onPressed: () =>
                Navigator.of(context).popUntil((route) => route.isFirst),
            icon: Icon(Icons.close, color: colorScheme.onSurface),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 80),
            const SizedBox(height: 16),
            Text(
              'Sale Successful',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Receipt #$receiptLabel',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: colorScheme.onSurfaceVariant),
            ),
            if (_loadingDetail)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Loading line items…',
                      style: TextStyle(color: colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            if (_loadError != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Could not load full receipt: $_loadError',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: colorScheme.error, fontSize: 13),
                ),
              ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: colorScheme.outline.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  _buildRow(context, 'Subtotal', currencyFormat.format(subtotal)),
                  if (discount > 0.001)
                    _buildRow(
                      context,
                      'Discount',
                      '- ${currencyFormat.format(discount)}',
                    ),
                  _buildRow(context, 'Tax', currencyFormat.format(taxTotal)),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Divider(color: colorScheme.outline),
                  ),
                  _buildRow(
                    context,
                    'Total',
                    currencyFormat.format(total),
                    isBold: true,
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Divider(color: colorScheme.outline),
                  ),
                  _buildRow(context, 'Customer', clientName),
                  const SizedBox(height: 8),
                  _buildRow(
                    context,
                    'Date',
                    _formatSaleDate(sale),
                  ),
                  const SizedBox(height: 8),
                  _buildRow(
                    context,
                    'Status',
                    (sale['status'] ?? 'completed').toString().toUpperCase(),
                    color: Colors.green,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'Items sold',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 12),
            if (items.isEmpty)
              Text(
                _loadingDetail
                    ? '…'
                    : 'No line items returned. Use Share receipt to open the full receipt.',
                style: TextStyle(color: colorScheme.onSurfaceVariant),
              )
            else
              ...items.map((raw) {
                final item = raw is Map<String, dynamic>
                    ? raw
                    : Map<String, dynamic>.from(raw as Map);
                final desc = _lineDescription(item);
                final qty = _num(item['quantity']);
                final unit = _num(item['rawUnitPrice'] ?? item['unitPrice']);
                var lineAmt = _num(item['rawAmount'] ?? item['amount']);
                if (lineAmt <= 0) {
                  lineAmt = _num(item['quantity']) * _num(item['unitPrice']);
                }
                final lineTax = _num(item['taxAmount']);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${qty.toStringAsFixed(qty == qty.roundToDouble() ? 0 : 2)}×',
                            style: TextStyle(
                              color: colorScheme.onSurfaceVariant,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              desc,
                              style: TextStyle(
                                color: colorScheme.onSurface,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          Text(
                            currencyFormat.format(lineAmt),
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: colorScheme.onSurface,
                            ),
                          ),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.only(left: 28, top: 4),
                        child: Text(
                          '${currencyFormat.format(unit)} each'
                          '${lineTax > 0 ? ' · Tax ${currencyFormat.format(lineTax)}' : ''}',
                          style: TextStyle(
                            fontSize: 12,
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: () => _shareReceipt(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorScheme.primary,
                  foregroundColor: colorScheme.onPrimary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.share_outlined, color: colorScheme.onPrimary),
                    const SizedBox(width: 12),
                    Text(
                      'Share receipt',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Share downloads a PDF receipt from your server.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: OutlinedButton(
                onPressed: () =>
                    Navigator.of(context).popUntil((route) => route.isFirst),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: colorScheme.primary),
                  foregroundColor: colorScheme.primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Back to Dashboard',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _lineDescription(Map<String, dynamic> item) {
    final p = item['product'];
    if (p is Map && (p['name'] ?? '').toString().trim().isNotEmpty) {
      return (p['name'] ?? '').toString();
    }
    return (item['description'] ?? 'Item').toString();
  }

  String _formatSaleDate(Map<String, dynamic> sale) {
    final raw = sale['createdAt'] ?? sale['saleDate'];
    if (raw == null) {
      return DateFormat('MMM dd, yyyy HH:mm').format(DateTime.now());
    }
    try {
      final dt = DateTime.tryParse(raw.toString());
      if (dt != null) {
        return DateFormat('MMM dd, yyyy HH:mm').format(dt.toLocal());
      }
    } catch (_) {}
    return raw.toString();
  }

  Future<void> _shareReceipt(BuildContext context) async {
    final sale = _detail ?? (widget.saleData['sale'] as Map<String, dynamic>? ?? {});
    final saleNumber = (sale['saleNumber'] ?? '').toString();
    final receiptLabel =
        saleNumber.isNotEmpty ? saleNumber : (sale['id'] ?? 'N/A').toString();
    final saleId = _saleId;
    if (saleId == null || saleId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Missing sale ID')),
      );
      return;
    }
    if (saleId.startsWith('OFFLINE-')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Receipt is not available until the sale syncs online.'),
        ),
      );
      return;
    }
    try {
      final repo = ref.read(posRepositoryProvider);
      final x = await repo.prepareSaleReceiptXFile(saleId);
      if (!context.mounted) return;
      await showPdfShareSheet(
        context,
        file: x,
        title: 'Receipt $receiptLabel',
        body:
            saleNumber.isNotEmpty ? 'Sale receipt $saleNumber' : 'Sale receipt $saleId',
      );
    } catch (e) {
      if (!context.mounted) return;
      final msg = e.toString().toLowerCase();
      final looksNetwork =
          msg.contains('socket') ||
          msg.contains('network') ||
          msg.contains('timeout') ||
          msg.contains('failed to connect') ||
          msg.contains('connection refused') ||
          msg.contains('dns');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            looksNetwork
                ? 'Failed to connect to the internet, please check your internet connection.'
                : 'Failed to share receipt. Please try again.',
          ),
        ),
      );
    }
  }

  Widget _buildRow(
    BuildContext context,
    String label,
    String value, {
    bool isBold = false,
    Color? color,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 15),
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
                fontSize: isBold ? 18 : 15,
                color: color ?? colorScheme.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
