import 'package:flutter/material.dart';

/// Product copy used on splash and marketing surfaces.
const kAppDisplayName = 'Insight Books';
const kAppTagline =
    'Financial management for growing businesses — invoicing, stock, payroll, accounting, and reporting in one secure platform.';

/// High-res raster logo (`assets/branding/app_logo.png` — export of the master artwork).
class InsightBooksLogo extends StatelessWidget {
  const InsightBooksLogo({
    super.key,
    this.size = 120,
    this.fit = BoxFit.contain,
  });

  final double size;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/branding/app_logo.png',
      width: size,
      height: size,
      fit: fit,
      filterQuality: FilterQuality.high,
      semanticLabel: '$kAppDisplayName logo',
      errorBuilder: (context, error, stackTrace) => Icon(
        Icons.account_balance_rounded,
        size: size * 0.5,
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }
}
