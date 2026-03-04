import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/theme/theme_mode_provider.dart';

/// Icon button that toggles between light and dark theme. Use in AppBar actions or drawer.
/// [iconColor] overrides icon color (e.g. for drawer on dark background).
class ThemeToggleButton extends ConsumerWidget {
  const ThemeToggleButton({super.key, this.iconColor});

  final Color? iconColor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;
    final color = iconColor ?? Theme.of(context).colorScheme.onSurface;

    return IconButton(
      icon: Icon(
        isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
        color: color,
      ),
      tooltip: isDark ? 'Switch to light theme' : 'Switch to dark theme',
      onPressed: () => ref.read(themeModeProvider.notifier).toggleDark(),
    );
  }
}
