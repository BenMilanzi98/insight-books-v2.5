import 'package:flutter/material.dart';

/// Placeholder for features not yet available in the mobile app.
/// Shows a polished "Coming Soon" message instead of an empty stub.
class ComingSoonScreen extends StatelessWidget {
  final String title;
  final IconData icon;
  final String? description;

  const ComingSoonScreen({
    super.key,
    required this.title,
    required this.icon,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(icon, size: 40, color: colorScheme.primary),
              ),
              const SizedBox(height: 24),
              Text(
                'Coming Soon',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                description ??
                    '$title is not yet available in the mobile app. '
                        'Use the web version to access this feature.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
