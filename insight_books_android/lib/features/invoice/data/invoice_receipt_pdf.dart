import 'dart:typed_data';

import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

/// Builds a simple payment receipt PDF from the JSON payload returned by
/// `POST /api/payments/receipt` (same shape the web `ReceiptTemplateCapture` consumes).
class InvoiceReceiptPdf {
  InvoiceReceiptPdf._();

  static Future<Uint8List> build(Map<String, dynamic> receipt) async {
    final doc = pw.Document();
    final currency = NumberFormat.currency(symbol: 'MK ', decimalDigits: 2);
    final type = receipt['type']?.toString() ?? 'individual';
    final branding = receipt['branding'] is Map
        ? Map<String, dynamic>.from(receipt['branding'] as Map)
        : <String, dynamic>{};
    final tenantName = branding['name']?.toString() ?? 'InsightBooks';
    final client = receipt['client'] is Map
        ? Map<String, dynamic>.from(receipt['client'] as Map)
        : <String, dynamic>{};
    final invoice = receipt['invoice'] is Map
        ? Map<String, dynamic>.from(receipt['invoice'] as Map)
        : <String, dynamic>{};

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        build: (context) => [
          pw.Header(
            level: 0,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  tenantName,
                  style: pw.TextStyle(
                    fontSize: 18,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  'Payment receipt',
                  style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey700),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 16),
          pw.Text('Client: ${client['name'] ?? 'N/A'}'),
          if (invoice.isNotEmpty)
            pw.Text('Invoice: ${invoice['invoiceNumber'] ?? invoice['id'] ?? ''}'),
          pw.Divider(),
          if (type == 'individual') ..._individualSection(receipt, currency),
          if (type == 'combined') ..._combinedSection(receipt, currency),
          pw.SizedBox(height: 24),
          pw.Text(
            'Generated from InsightBooks',
            style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey600),
          ),
        ],
      ),
    );
    return doc.save();
  }

  static List<pw.Widget> _individualSection(
    Map<String, dynamic> receipt,
    NumberFormat currency,
  ) {
    final payment = receipt['payment'] is Map
        ? Map<String, dynamic>.from(receipt['payment'] as Map)
        : <String, dynamic>{};
    final amount = (payment['amount'] as num?)?.toDouble() ?? 0;
    final method = payment['paymentMethod']?.toString() ?? '';
    final dateStr = payment['paymentDate']?.toString() ?? '';
    final ref = payment['reference']?.toString();
    return [
      pw.Text('Type: Individual payment', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 8),
      pw.Text('Amount: ${currency.format(amount)}'),
      pw.Text('Method: $method'),
      pw.Text('Date: $dateStr'),
      if (ref != null && ref.isNotEmpty) pw.Text('Reference: $ref'),
    ];
  }

  static List<pw.Widget> _combinedSection(
    Map<String, dynamic> receipt,
    NumberFormat currency,
  ) {
    final payments = receipt['payments'];
    final list = payments is List ? payments : const [];
    final totalPaid = (receipt['totalPaid'] as num?)?.toDouble() ?? 0;
    final rows = <pw.TableRow>[
      pw.TableRow(
        children: [
          pw.Padding(
            padding: const pw.EdgeInsets.all(4),
            child: pw.Text('Date', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          ),
          pw.Padding(
            padding: const pw.EdgeInsets.all(4),
            child: pw.Text('Method', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          ),
          pw.Padding(
            padding: const pw.EdgeInsets.all(4),
            child: pw.Text('Amount', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          ),
        ],
      ),
    ];
    for (final p in list) {
      if (p is! Map) continue;
      final m = Map<String, dynamic>.from(p);
      final amt = (m['amount'] as num?)?.toDouble() ?? 0;
      rows.add(
        pw.TableRow(
          children: [
            pw.Padding(
              padding: const pw.EdgeInsets.all(4),
              child: pw.Text(m['paymentDate']?.toString() ?? ''),
            ),
            pw.Padding(
              padding: const pw.EdgeInsets.all(4),
              child: pw.Text(m['paymentMethod']?.toString() ?? ''),
            ),
            pw.Padding(
              padding: const pw.EdgeInsets.all(4),
              child: pw.Text(currency.format(amt)),
            ),
          ],
        ),
      );
    }
    return [
      pw.Text('Type: Combined payments', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 8),
      pw.Table(
        border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
        children: rows,
      ),
      pw.SizedBox(height: 12),
      pw.Text(
        'Total paid: ${currency.format(totalPaid)}',
        style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold),
      ),
    ];
  }
}
