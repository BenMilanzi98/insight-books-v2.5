import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:insightbooks_android/features/pos/data/pos_repository.dart';

class ReceiptScreen extends ConsumerWidget {
  final Map<String, dynamic> saleData;

  const ReceiptScreen({super.key, required this.saleData});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currencyFormat = NumberFormat.currency(
      symbol: 'UGX ',
      decimalDigits: 0,
    );
    final sale = saleData['sale'] ?? {};
    final total = sale['total_amount'] ?? 0;
    final client = sale['client'] ?? {};
    final items = (sale['items'] as List?) ?? [];
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
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 80),
            const SizedBox(height: 16),
            Text(
              'Sale Successful',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Receipt #${sale['id'] ?? 'N/A'}',
              style: TextStyle(fontSize: 16, color: colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: colorScheme.outline.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  _buildRow(context, 'Total Amount', currencyFormat.format(total), isBold: true),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Divider(color: colorScheme.outline),
                  ),
                  _buildRow(context, 'Customer', client['name'] ?? 'Walk-in Customer'),
                  const SizedBox(height: 12),
                  _buildRow(
                    context,
                    'Date',
                    DateFormat('MMM dd, yyyy HH:mm').format(DateTime.now()),
                  ),
                  const SizedBox(height: 12),
                  _buildRow(context, 'Payment Status', 'Paid', color: Colors.green),
                ],
              ),
            ),
            const SizedBox(height: 32),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Items',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
            ),
            const SizedBox(height: 16),
            ...items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Text(
                      '${item['quantity'] ?? 1}x',
                      style: TextStyle(
                        color: colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        item['product_name'] ?? 'Product',
                        style: TextStyle(color: colorScheme.onSurface),
                      ),
                    ),
                    Text(
                      currencyFormat.format(item['total'] ?? 0),
                      style: TextStyle(fontWeight: FontWeight.w500, color: colorScheme.onSurface),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 48),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: () async {
                  try {
                    final saleId = (sale['id'] ?? '').toString();
                    if (saleId.isEmpty) {
                      throw Exception('Missing sale ID');
                    }
                    final bytes = await ref
                        .read(posRepositoryProvider)
                        .downloadReceiptPdf(saleId);
                    final dir = await getTemporaryDirectory();
                    final file = File('${dir.path}/receipt-$saleId.pdf');
                    await file.writeAsBytes(bytes);
                    await SharePlus.instance.share(
                      ShareParams(files: [XFile(file.path)]),
                    );
                  } catch (e) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to open receipt: $e')),
                    );
                  }
                },
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
                    Icon(Icons.picture_as_pdf, color: colorScheme.onPrimary),
                    const SizedBox(width: 12),
                    Text(
                      'View PDF Receipt',
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

  Widget _buildRow(
    BuildContext context,
    String label,
    String value, {
    bool isBold = false,
    Color? color,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 15)),
        Text(
          value,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            fontSize: isBold ? 18 : 15,
            color: color ?? colorScheme.onSurface,
          ),
        ),
      ],
    );
  }
}
