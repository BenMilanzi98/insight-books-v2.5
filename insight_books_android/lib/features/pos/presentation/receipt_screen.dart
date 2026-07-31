import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/features/pos/data/pos_repository.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/features/pos/presentation/sale_receipt_print.dart';
import 'package:insightbooks_android/shared/pdf_share_sheet.dart';
import 'package:insightbooks_android/shared/server_pdf_preview_screen.dart';
import 'package:webview_flutter/webview_flutter.dart';

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

  WebViewController? _webController;
  var _webLoading = true;
  Object? _webError;

  @override
  void initState() {
    super.initState();
    if (_showServerReceipt) {
      final baseHost = Uri.parse(apiBaseUrl).host;
      _webController = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(Colors.white)
        ..setNavigationDelegate(
          NavigationDelegate(
            onNavigationRequest: (req) {
              final uri = Uri.tryParse(req.url);
              if (uri != null &&
                  uri.host.isNotEmpty &&
                  uri.host != baseHost) {
                return NavigationDecision.prevent;
              }
              return NavigationDecision.navigate;
            },
            onPageFinished: (_) {
              if (mounted) setState(() => _webLoading = false);
            },
            onWebResourceError: (err) {
              if (mounted) {
                setState(() {
                  _webError = err.description;
                  _webLoading = false;
                });
              }
            },
          ),
        );
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadWebReceipt());
    }
    _loadDetail();
  }

  String? get _saleId {
    final sale = widget.saleData['sale'];
    if (sale is Map && sale['id'] != null) return sale['id'].toString();
    return widget.saleData['id']?.toString();
  }

  bool get _showServerReceipt {
    final id = _saleId;
    return id != null && id.isNotEmpty && !id.startsWith('OFFLINE-');
  }

  Future<void> _loadWebReceipt() async {
    final id = _saleId;
    final controller = _webController;
    if (id == null || controller == null) return;
    setState(() {
      _webError = null;
      _webLoading = true;
    });
    try {
      final storage = ref.read(storageServiceProvider);
      final token = await storage.getToken();
      final cookie = await storage.getCookie();
      final uri = Uri.parse('$apiBaseUrl/api/sales/$id/receipt').replace(
        queryParameters: {'autoPrint': '0'},
      );
      final headers = <String, String>{};
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
      if (cookie != null && cookie.isNotEmpty) {
        headers['Cookie'] = cookie;
      }
      await controller.loadRequest(uri, headers: headers);
    } catch (e) {
      if (mounted) {
        setState(() {
          _webError = e;
          _webLoading = false;
        });
      }
    }
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

  double _lineDiscount(Map<String, dynamic> item) {
    final discountAmount = _num(item['rawDiscountAmount'] ?? item['discountAmount']);
    if (discountAmount > 0) return discountAmount;
    return _num(item['discount']) * _num(item['quantity']);
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(
      symbol: 'MWK ',
      decimalDigits: 2,
    );
    final colorScheme = Theme.of(context).colorScheme;

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
      body: _showServerReceipt
          ? _buildServerReceiptBody(context, colorScheme)
          : _buildOfflineReceiptBody(context, colorScheme, currencyFormat),
    );
  }

  Widget _buildServerReceiptBody(
    BuildContext context,
    ColorScheme colorScheme,
  ) {
    final controller = _webController;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
          child: Row(
            children: [
              Icon(Icons.check_circle, color: AppTheme.successColor(context), size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Sale successful',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    Text(
                      'Receipt matches POS / web print view',
                      style: TextStyle(fontSize: 13, color: colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (_webError != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Material(
              color: colorScheme.errorContainer.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Could not load receipt preview',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: colorScheme.onErrorContainer,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _webError.toString(),
                      style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
                    ),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: _loadWebReceipt,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        Expanded(
          child: Stack(
            children: [
              if (controller != null && _webError == null)
                WebViewWidget(controller: controller),
              if (_webLoading && _webError == null)
                Container(
                  color: colorScheme.surface,
                  alignment: Alignment.center,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(color: colorScheme.primary),
                      const SizedBox(height: 12),
                      Text(
                        'Loading receipt…',
                        style: TextStyle(color: colorScheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        _buildBottomActions(context, colorScheme),
      ],
    );
  }

  Widget _buildOfflineReceiptBody(
    BuildContext context,
    ColorScheme colorScheme,
    NumberFormat currencyFormat,
  ) {
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
    final saleNumber = (sale['saleNumber'] ?? '').toString();
    final receiptLabel = saleNumber.isNotEmpty ? saleNumber : (sale['id'] ?? 'N/A').toString();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(Icons.check_circle, color: AppTheme.successColor(context), size: 80),
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
                  color: AppTheme.successColor(context),
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
                  : 'No line items returned. Sync when online for the full server receipt.',
              style: TextStyle(color: colorScheme.onSurfaceVariant),
            )
          else
            ...items.map((raw) {
              final item = raw is Map<String, dynamic>
                  ? raw
                  : Map<String, dynamic>.from(raw as Map);
              final desc = _lineDescription(item);
              final qty = _num(item['quantity']);
              final unit = _num(
                item['rawEffectiveUnitPrice'] ??
                    item['effectiveUnitPrice'] ??
                    item['rawUnitPrice'] ??
                    item['unitPrice'],
              );
              final lineDiscount = _lineDiscount(item);
              var lineAmt = _num(
                item['rawLineNetAmount'] ??
                    item['lineNetAmount'] ??
                    item['rawAmount'] ??
                    item['amount'],
              );
              if (lineAmt <= 0) {
                lineAmt = (_num(item['quantity']) * _num(item['unitPrice'])) - lineDiscount;
              }
              lineAmt = lineAmt.clamp(0, double.infinity).toDouble();
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
                        '${lineDiscount > 0 ? ' · Discount ${currencyFormat.format(lineDiscount)}' : ''}'
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
          const SizedBox(height: 24),
          _buildBottomActions(context, colorScheme),
        ],
      ),
    );
  }

  Widget _buildBottomActions(
    BuildContext context,
    ColorScheme colorScheme,
  ) {
    final sale = _detail ?? (widget.saleData['sale'] as Map<String, dynamic>? ?? {});
    final saleNo = (sale['saleNumber'] ?? '').toString().trim();

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton.icon(
              onPressed: () async {
                final id = _saleId;
                if (id == null || id.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Missing sale ID')),
                  );
                  return;
                }
                final preferred = normalizeReceiptPaperWidthMm(
                  ref.read(accountProvider).settings?.receiptPaperWidthMm,
                );
                final paperWidthMm = await chooseReceiptPaperWidthMm(
                  context,
                  preferredWidthMm: preferred,
                );
                if (paperWidthMm == null) return;
                if (!context.mounted) return;
                openSaleReceiptThermalPrint(
                  context,
                  ref,
                  id,
                  saleNumberForFilename: saleNo.isNotEmpty ? saleNo : null,
                  paperWidthMm: paperWidthMm,
                );
              },
              style: FilledButton.styleFrom(
                backgroundColor: colorScheme.primary,
                foregroundColor: colorScheme.onPrimary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              icon: Icon(Icons.print_rounded, color: colorScheme.onPrimary),
              label: const Text(
                'Print receipt',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: () => _viewReceiptPdf(context),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: colorScheme.primary),
                foregroundColor: colorScheme.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.picture_as_pdf_outlined),
              label: const Text(
                'View receipt PDF',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(height: 10),
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
                    'Share receipt PDF',
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
            'Print supports 80mm and 58mm thermal layouts. View/Share use the receipt PDF.',
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

  Future<void> _viewReceiptPdf(BuildContext context) async {
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
          content: Text('Receipt PDF is not available until the sale syncs online.'),
        ),
      );
      return;
    }
    final sale = _detail ?? (widget.saleData['sale'] as Map<String, dynamic>? ?? {});
    final saleNumber = (sale['saleNumber'] ?? '').toString();
    final receiptLabel =
        saleNumber.isNotEmpty ? saleNumber : (sale['id'] ?? 'N/A').toString();
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const PopScope(
        canPop: false,
        child: AlertDialog(
          content: Row(
            children: [
              CircularProgressIndicator(),
              SizedBox(width: 20),
              Expanded(child: Text('Loading PDF…')),
            ],
          ),
        ),
      ),
    );
    try {
      final bytes = await ref.read(posRepositoryProvider).downloadReceiptPdf(saleId);
      if (!context.mounted) return;
      Navigator.of(context, rootNavigator: true).pop();
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ServerPdfPreviewScreen(
            title: 'Receipt $receiptLabel',
            pdfBytes: Uint8List.fromList(bytes),
          ),
        ),
      );
    } catch (e) {
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load PDF: $e')),
        );
      }
    }
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
