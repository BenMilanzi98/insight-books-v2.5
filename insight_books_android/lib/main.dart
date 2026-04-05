import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/router/app_router.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_mode_provider.dart';
import 'package:insightbooks_android/core/update/app_update_gate.dart';

void main() {
  runApp(const ProviderScope(child: InsightBooksApp()));
}

class InsightBooksApp extends ConsumerWidget {
  const InsightBooksApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'Insight Books',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      routerConfig: router,
      builder: (context, child) =>
          AppUpdateGate(child: child ?? const SizedBox.shrink()),
    );
  }
}
