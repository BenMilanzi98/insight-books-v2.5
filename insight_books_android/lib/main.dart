import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/router/app_router.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';

void main() {
  runApp(const ProviderScope(child: InsightBooksApp()));
}

class InsightBooksApp extends ConsumerWidget {
  const InsightBooksApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'InsightBooks Africa',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system, // Respect system settings
      routerConfig: router,
    );
  }
}
