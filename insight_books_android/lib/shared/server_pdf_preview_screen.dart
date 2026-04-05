import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:pdfx/pdfx.dart';

/// Full-screen preview of PDF bytes (same file as server `/download/pdf` routes).
class ServerPdfPreviewScreen extends StatefulWidget {
  final String title;
  final Uint8List pdfBytes;

  const ServerPdfPreviewScreen({
    super.key,
    required this.title,
    required this.pdfBytes,
  });

  @override
  State<ServerPdfPreviewScreen> createState() => _ServerPdfPreviewScreenState();
}

class _ServerPdfPreviewScreenState extends State<ServerPdfPreviewScreen> {
  PdfControllerPinch? _controller;
  Object? _error;

  @override
  void initState() {
    super.initState();
    try {
      _controller = PdfControllerPinch(
        document: PdfDocument.openData(widget.pdfBytes),
      );
    } catch (e) {
      _error = e;
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
                    const SizedBox(height: 12),
                    Text(
                      'Could not open PDF',
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _error.toString(),
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            )
          : _controller == null
              ? const Center(child: CircularProgressIndicator())
              : PdfViewPinch(controller: _controller!),
    );
  }
}
