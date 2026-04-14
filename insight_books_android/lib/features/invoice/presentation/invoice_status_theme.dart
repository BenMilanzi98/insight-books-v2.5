import 'package:flutter/material.dart';

/// Semantic colors for invoice statuses (light/dark safe via [ColorScheme]).
class InvoiceStatusTheme {
  InvoiceStatusTheme._();

  static String normalize(String status) => status.trim().toLowerCase();

  static Color chipForeground(BuildContext context, String status) {
    final cs = Theme.of(context).colorScheme;
    switch (normalize(status)) {
      case 'paid':
        return cs.onSecondaryContainer;
      case 'pending':
      case 'sent':
        return cs.onTertiaryContainer;
      case 'overdue':
        return cs.onErrorContainer;
      case 'draft':
        return cs.onSurfaceVariant;
      case 'partial':
        return cs.onPrimaryContainer;
      case 'void':
      case 'refunded':
        return cs.onSurfaceVariant;
      case 'partially_refunded':
        return cs.onTertiaryContainer;
      default:
        return cs.onSurfaceVariant;
    }
  }

  static Color chipBackground(BuildContext context, String status) {
    final cs = Theme.of(context).colorScheme;
    switch (normalize(status)) {
      case 'paid':
        return cs.secondaryContainer;
      case 'pending':
      case 'sent':
        return cs.tertiaryContainer;
      case 'overdue':
        return cs.errorContainer;
      case 'draft':
        return cs.surfaceContainerHighest;
      case 'partial':
        return cs.primaryContainer;
      case 'void':
      case 'refunded':
        return cs.surfaceContainerHigh;
      case 'partially_refunded':
        return cs.tertiaryContainer;
      default:
        return cs.surfaceContainerHighest;
    }
  }

  static Color chipBorder(BuildContext context, String status) {
    final cs = Theme.of(context).colorScheme;
    return chipForeground(context, status).withValues(alpha: 0.35);
  }

  /// Strong accent for banners and icons (uses scheme hues).
  static Color accent(BuildContext context, String status) {
    final cs = Theme.of(context).colorScheme;
    switch (normalize(status)) {
      case 'paid':
        return cs.secondary;
      case 'pending':
      case 'sent':
        return cs.tertiary;
      case 'overdue':
        return cs.error;
      case 'draft':
        return cs.outline;
      case 'partial':
        return cs.primary;
      case 'void':
      case 'refunded':
        return cs.outline;
      case 'partially_refunded':
        return cs.tertiary;
      default:
        return cs.primary;
    }
  }

  static IconData iconFor(String status) {
    switch (normalize(status)) {
      case 'paid':
        return Icons.check_circle;
      case 'pending':
      case 'sent':
        return Icons.schedule;
      case 'overdue':
        return Icons.warning_amber;
      case 'draft':
        return Icons.edit_note;
      case 'partial':
        return Icons.pie_chart;
      case 'void':
        return Icons.block;
      case 'refunded':
      case 'partially_refunded':
        return Icons.undo;
      default:
        return Icons.receipt_long;
    }
  }

  static String displayLabel(String status) {
    final s = status.trim();
    if (s.isEmpty) return '—';
    if (s == 'void') return 'Void';
    return s[0].toUpperCase() + s.substring(1);
  }
}
