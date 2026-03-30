import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:insightbooks_android/shared/pdf_share_sheet.dart';
import '../data/quotation_repository.dart';
import '../domain/quotation_model.dart';
import 'providers/quotation_details_provider.dart';
import 'providers/quotation_provider.dart';

class QuotationDetailsScreen extends ConsumerWidget {
  final String quotationId;

  const QuotationDetailsScreen({super.key, required this.quotationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quotationAsync = ref.watch(quotationDetailsProvider(quotationId));
    final quotationState = ref.watch(quotationControllerProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Quotation Details'),
        actions: [
          quotationAsync.whenOrNull(
            data: (quotation) => PopupMenuButton<String>(
              onSelected: (action) =>
                  _handleAction(context, ref, quotation, action, quotationState),
              itemBuilder: (ctx) => _buildMenuItems(quotation, quotationState),
              icon: const Icon(Icons.more_vert),
            ),
          ) ?? const SizedBox.shrink(),
        ],
      ),
      body: quotationAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline,
                size: 48,
                color: theme.colorScheme.error,
              ),
              const SizedBox(height: 12),
              Text(
                'Failed to load quotation',
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              FilledButton.tonalIcon(
                onPressed: () =>
                    ref.invalidate(quotationDetailsProvider(quotationId)),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (quotation) => _QuotationDetailsBody(
          quotation: quotation,
          quotationId: quotationId,
          onSharePdf: quotationState.canExportQuotations
              ? () => _downloadQuotationPdf(context, ref, quotation)
              : null,
        ),
      ),
    );
  }

  List<PopupMenuEntry<String>> _buildMenuItems(
    Quotation quotation,
    QuotationPageState permissions,
  ) {
    final items = <PopupMenuEntry<String>>[];
    final status = quotation.status;

    if (status != 'Converted' && permissions.canSendQuotations) {
      items.add(
        const PopupMenuItem(
          value: 'send',
          child: ListTile(
            leading: Icon(Icons.send_outlined, color: Colors.blue),
            title: Text('Send to Client'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }

    if (permissions.canExportQuotations) {
      items.add(
        const PopupMenuItem(
          value: 'download',
          child: ListTile(
            leading: Icon(Icons.picture_as_pdf_outlined, color: Colors.redAccent),
            title: Text('Download PDF'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }

    if (status == 'Approved' && permissions.canConvertQuotations) {
      items.add(
        const PopupMenuItem(
          value: 'convert',
          child: ListTile(
            leading: Icon(Icons.call_made, color: Colors.green),
            title: Text('Convert to Invoice'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }

    if (status != 'Converted' && permissions.canCreateQuotations) {
      items.add(
        const PopupMenuItem(
          value: 'duplicate',
          child: ListTile(
            leading: Icon(Icons.copy, color: Colors.purple),
            title: Text('Duplicate'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }
    if (status != 'Converted' && permissions.canUpdateQuotations) {
      items.add(
        const PopupMenuItem(
          value: 'edit',
          child: ListTile(
            leading: Icon(Icons.edit_outlined, color: Colors.orange),
            title: Text('Edit'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }

    if (status == 'Draft' && permissions.canDeleteQuotations) {
      items.add(
        const PopupMenuItem(
          value: 'delete',
          child: ListTile(
            leading: Icon(Icons.delete_outline, color: Colors.red),
            title: Text('Delete'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      );
    }

    return items;
  }

  Future<void> _handleAction(
    BuildContext context,
    WidgetRef ref,
    Quotation quotation,
    String action,
    QuotationPageState permissions,
  ) async {
    if (action == 'send' && !permissions.canSendQuotations) {
      _showPermissionDenied(context);
      return;
    }
    if (action == 'download' && !permissions.canExportQuotations) {
      _showPermissionDenied(context);
      return;
    }
    if (action == 'convert' && !permissions.canConvertQuotations) {
      _showPermissionDenied(context);
      return;
    }
    if (action == 'duplicate' && !permissions.canCreateQuotations) {
      _showPermissionDenied(context);
      return;
    }
    if (action == 'edit' && !permissions.canUpdateQuotations) {
      _showPermissionDenied(context);
      return;
    }
    if (action == 'delete' && !permissions.canDeleteQuotations) {
      _showPermissionDenied(context);
      return;
    }
    switch (action) {
      case 'send':
        await _showSendDialog(context, ref, quotation);
        break;
      case 'convert':
        await _showConvertDialog(context, ref, quotation);
        break;
      case 'download':
        await _downloadQuotationPdf(context, ref, quotation);
        break;
      case 'duplicate':
        await _duplicateQuotation(context, ref, quotation);
        break;
      case 'edit':
        if (context.mounted) {
          context.push('/quotation/${quotation.id}/edit');
        }
        break;
      case 'delete':
        await _showDeleteDialog(context, ref, quotation);
        break;
    }
  }

  Future<void> _showSendDialog(
    BuildContext context,
    WidgetRef ref,
    Quotation quotation,
  ) async {
    final messageCtrl = TextEditingController();
    final emailsCtrl = TextEditingController();
    final attachments = <String>[];
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Send Quotation'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Send quotation ${quotation.quotationNumber} to ${quotation.client}?',
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: messageCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Message (optional)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: emailsCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Other emails (comma separated)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: attachments
                      .map(
                        (p) => Chip(
                          label: Text(p.split(Platform.pathSeparator).last),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () async {
                    final result = await FilePicker.platform.pickFiles(
                      allowMultiple: true,
                    );
                    if (result != null) {
                      setDialogState(() {
                        attachments.addAll(
                          result.files
                              .where((f) => f.path != null)
                              .map((f) => f.path!)
                              .toList(),
                        );
                      });
                    }
                  },
                  icon: const Icon(Icons.attach_file),
                  label: const Text('Add attachments'),
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
              child: const Text('Send'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && context.mounted) {
      try {
        final otherEmails = emailsCtrl.text
            .split(',')
            .map((e) => e.trim())
            .where((e) => e.isNotEmpty)
            .toList();
        await ref.read(quotationRepositoryProvider).sendQuotationAdvanced(
              quotation.id,
              message: messageCtrl.text.trim().isEmpty
                  ? null
                  : messageCtrl.text.trim(),
              otherEmails: otherEmails,
              attachmentPaths: attachments,
            );
        ref.invalidate(quotationDetailsProvider(quotationId));
        ref.invalidate(quotationControllerProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Quotation sent')),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                e.toString().contains('PDF')
                    ? 'PDF not ready. Generate from web app first.'
                    : 'Failed to send: $e',
              ),
            ),
          );
        }
      }
    }
    emailsCtrl.dispose();
    messageCtrl.dispose();
  }

  Future<void> _downloadQuotationPdf(
    BuildContext context,
    WidgetRef ref,
    Quotation quotation,
  ) async {
    try {
      final bytes = await ref
          .read(quotationRepositoryProvider)
          .downloadQuotationPdf(quotation.id);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/quotation-${quotation.quotationNumber}.pdf');
      await file.writeAsBytes(bytes);
      final xfile = XFile(file.path, mimeType: 'application/pdf');
      if (!context.mounted) return;
      await showPdfShareSheet(
        context,
        file: xfile,
        title: 'Quotation ${quotation.quotationNumber}',
        body: 'Quotation ${quotation.quotationNumber}',
      );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to download PDF: $e')));
      }
    }
  }

  Future<void> _showConvertDialog(
    BuildContext context,
    WidgetRef ref,
    Quotation quotation,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Convert to Invoice'),
        content: Text(
          'Convert quotation ${quotation.quotationNumber} to an invoice? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Convert'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      try {
        final result = await ref
            .read(quotationRepositoryProvider)
            .convertToInvoice(quotation.id);
        ref.invalidate(quotationDetailsProvider(quotationId));
        ref.invalidate(quotationControllerProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Converted to invoice ${result.invoiceNumber}',
              ),
            ),
          );
          context.go('/invoice/${result.invoiceId}');
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e')),
          );
        }
      }
    }
  }

  Future<void> _duplicateQuotation(
    BuildContext context,
    WidgetRef ref,
    Quotation quotation,
  ) async {
    try {
      final duplicated = await ref
          .read(quotationControllerProvider.notifier)
          .duplicateQuotation(quotation.id);
      if (context.mounted && duplicated != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Quotation duplicated')),
        );
        context.go('/quotation/${duplicated.id}');
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }

  Future<void> _showDeleteDialog(
    BuildContext context,
    WidgetRef ref,
    Quotation quotation,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Quotation'),
        content: Text(
          'Delete quotation ${quotation.quotationNumber}? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      try {
        await ref
            .read(quotationControllerProvider.notifier)
            .deleteQuotation(quotation.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Quotation deleted')),
          );
          context.go('/quotation');
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e')),
          );
        }
      }
    }
  }

  void _showPermissionDenied(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('You do not have permission to perform this action.')),
    );
  }
}

class _QuotationDetailsBody extends StatelessWidget {
  final Quotation quotation;
  final String quotationId;
  final VoidCallback? onSharePdf;

  const _QuotationDetailsBody({
    required this.quotation,
    required this.quotationId,
    this.onSharePdf,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currencyFormat = NumberFormat.currency(
      symbol: 'MK ',
      decimalDigits: 2,
    );
    final statusColor = _statusColor(quotation.status);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (onSharePdf != null) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Icon(Icons.picture_as_pdf_outlined, color: theme.colorScheme.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Quotation PDF',
                        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: onSharePdf,
                      icon: const Icon(Icons.share_outlined, size: 20),
                      label: const Text('Share'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(
                color: theme.colorScheme.outlineVariant.withValues(alpha: 0.4),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          quotation.quotationNumber,
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          quotation.status,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: statusColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    quotation.title,
                    style: theme.textTheme.titleMedium,
                  ),
                  const Divider(height: 24),
                  _DetailRow(
                    label: 'Client',
                    value: quotation.client,
                    icon: Icons.person_outline,
                  ),
                  if (quotation.clientEmail != null &&
                      quotation.clientEmail!.isNotEmpty)
                    _DetailRow(
                      label: 'Email',
                      value: quotation.clientEmail!,
                      icon: Icons.email_outlined,
                    ),
                  if (quotation.clientPhone != null &&
                      quotation.clientPhone!.isNotEmpty)
                    _DetailRow(
                      label: 'Phone',
                      value: quotation.clientPhone!,
                      icon: Icons.phone_outlined,
                    ),
                  _DetailRow(
                    label: 'Date',
                    value: quotation.date,
                    icon: Icons.calendar_today_outlined,
                  ),
                  _DetailRow(
                    label: 'Valid until',
                    value: quotation.validUntil,
                    icon: Icons.event_outlined,
                  ),
                  if (quotation.preparedBy != null)
                    _DetailRow(
                      label: 'Prepared by',
                      value: quotation.preparedBy!,
                      icon: Icons.badge_outlined,
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Items',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          ...quotation.items.map((item) => Card(
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: theme.colorScheme.outlineVariant
                        .withValues(alpha: 0.3),
                  ),
                ),
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
                              item.description,
                              style:
                                  theme.textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w500,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${item.quantity} × ${currencyFormat.format(item.unitPrice)}'
                              '${item.taxRate > 0 ? ' + ${item.taxRate}% tax' : ''}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.outline,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        currencyFormat.format(item.amount),
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              )),
          const SizedBox(height: 16),
          Card(
            elevation: 0,
            color: theme.colorScheme.surfaceContainerLow,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _SummaryRow('Subtotal', currencyFormat.format(quotation.subtotal)),
                  if (quotation.taxAmount > 0)
                    _SummaryRow('Tax', currencyFormat.format(quotation.taxAmount)),
                  if (quotation.discount > 0)
                    _SummaryRow(
                      'Discount',
                      '-${currencyFormat.format(quotation.discount)}',
                    ),
                  const Divider(height: 16),
                  _SummaryRow(
                    'Total',
                    currencyFormat.format(quotation.amount),
                    bold: true,
                  ),
                ],
              ),
            ),
          ),
          if (quotation.notes != null && quotation.notes!.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'Notes',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              quotation.notes!,
              style: theme.textTheme.bodyMedium,
            ),
          ],
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'draft':
        return Colors.grey;
      case 'converted':
        return Colors.blue;
      case 'expired':
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _DetailRow({
    required this.label,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.outline),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
                Text(value, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;

  const _SummaryRow(this.label, this.value, {this.bold = false});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: bold
                ? theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  )
                : theme.textTheme.bodyMedium,
          ),
          Text(
            value,
            style: bold
                ? theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  )
                : theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
