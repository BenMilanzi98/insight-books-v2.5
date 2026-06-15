import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdf/pdf.dart' show PdfPageFormat;
import 'package:printing/printing.dart';

import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';
import 'package:insightbooks_android/features/pos/data/pos_repository.dart';

const _thermalReceiptPrintChannel =
    MethodChannel('com.insightbooksafrica.insightbooks/thermal_receipt_print');

/// Same receipt document as web `/pos`: HTML from `/api/sales/{id}/receipt` with
/// `autoPrint=0`, printed via Android [WebView] + [PrintDocumentAdapter].
/// iOS and fallback use the server PDF on the selected thermal roll width.
Future<void> openSaleReceiptThermalPrint(
  BuildContext context,
  WidgetRef ref,
  String saleId, {
  String? saleNumberForFilename,
  int paperWidthMm = 80,
}) async {
  if (saleId.isEmpty || saleId.startsWith('OFFLINE-')) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Receipt is available after the sale syncs online.'),
      ),
    );
    return;
  }

  var dialogOpen = false;
  try {
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
              Expanded(child: Text('Preparing printer…')),
            ],
          ),
        ),
      ),
    );
    dialogOpen = true;

    if (Platform.isAndroid) {
      final storage = ref.read(storageServiceProvider);
      final token = await storage.getToken();
      final cookie = await storage.getCookie();
      final uri = Uri.parse('$apiBaseUrl/api/sales/$saleId/receipt').replace(
        queryParameters: {
          'autoPrint': '0',
          'paperWidth': paperWidthMm.toString(),
        },
      );
      await _thermalReceiptPrintChannel.invokeMethod<void>(
        'printThermalReceipt',
        <String, dynamic>{
          'url': uri.toString(),
          'paperWidthMm': paperWidthMm,
          if (token != null && token.isNotEmpty)
            'authorization': 'Bearer $token',
          if (cookie != null && cookie.isNotEmpty) 'cookie': cookie,
        },
      );
    } else {
      final bytes = await ref
          .read(posRepositoryProvider)
          .downloadReceiptPdf(saleId, paperWidthMm: paperWidthMm);
      final name = _receiptFileName(saleNumberForFilename, saleId);
      final ok = await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => Uint8List.fromList(bytes),
        name: name,
        format: _rollFormatForWidth(paperWidthMm),
      );
      if (!context.mounted) return;
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Print was cancelled.')),
        );
      }
    }

    if (!context.mounted) return;
    Navigator.of(context, rootNavigator: true).pop();
    dialogOpen = false;
  } on PlatformException catch (e) {
    if (context.mounted && dialogOpen) {
      Navigator.of(context, rootNavigator: true).pop();
      dialogOpen = false;
    }
    await _printReceiptPdfFallback(
      context,
      ref,
      saleId,
      saleNumberForFilename,
      paperWidthMm: paperWidthMm,
      cause: e.message ?? e.code,
    );
  } on MissingPluginException catch (_) {
    if (context.mounted && dialogOpen) {
      Navigator.of(context, rootNavigator: true).pop();
      dialogOpen = false;
    }
    await _printReceiptPdfFallback(
      context,
      ref,
      saleId,
      saleNumberForFilename,
      paperWidthMm: paperWidthMm,
      cause: 'Native receipt print not available',
    );
  } catch (e) {
    if (context.mounted) {
      if (dialogOpen) {
        Navigator.of(context, rootNavigator: true).pop();
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not print receipt: $e')),
      );
    }
  }
}

Future<int?> chooseReceiptPaperWidthMm(BuildContext context) {
  return showDialog<int>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Printer paper width'),
      content: const Text('Choose the paper size loaded in the receipt printer.'),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(58),
          child: const Text('58mm'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(80),
          child: const Text('80mm'),
        ),
      ],
    ),
  );
}

PdfPageFormat _rollFormatForWidth(int paperWidthMm) {
  final width = (paperWidthMm == 58 ? 58 : 80) * PdfPageFormat.mm;
  return PdfPageFormat(width, 2000 * PdfPageFormat.mm, marginAll: 0);
}

String _receiptFileName(String? saleNumberForFilename, String saleId) {
  if (saleNumberForFilename != null && saleNumberForFilename.trim().isNotEmpty) {
    return 'receipt-${saleNumberForFilename.trim()}.pdf';
  }
  return 'receipt-$saleId.pdf';
}

Future<void> _printReceiptPdfFallback(
  BuildContext context,
  WidgetRef ref,
  String saleId,
  String? saleNumberForFilename, {
  int paperWidthMm = 80,
  String? cause,
}) async {
  if (!context.mounted) return;
  var dialogOpen = false;
  try {
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
              Expanded(child: Text('Trying PDF print…')),
            ],
          ),
        ),
      ),
    );
    dialogOpen = true;

    final bytes = await ref
        .read(posRepositoryProvider)
        .downloadReceiptPdf(saleId, paperWidthMm: paperWidthMm);

    if (!context.mounted) return;
    Navigator.of(context, rootNavigator: true).pop();
    dialogOpen = false;

    final name = _receiptFileName(saleNumberForFilename, saleId);
    final ok = await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => Uint8List.fromList(bytes),
      name: name,
      format: _rollFormatForWidth(paperWidthMm),
    );
    if (!context.mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Print was cancelled.')),
      );
    } else if (cause != null && cause.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'HTML receipt print failed ($cause). Printed PDF instead.',
          ),
        ),
      );
    }
  } catch (e2) {
    if (context.mounted) {
      if (dialogOpen) {
        Navigator.of(context, rootNavigator: true).pop();
      }
      final prefix =
          cause != null && cause.isNotEmpty ? 'HTML print failed ($cause). ' : '';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${prefix}Could not print PDF: $e2')),
      );
    }
  }
}
