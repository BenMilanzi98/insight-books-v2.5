import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/router/app_router.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/theme/theme_mode_provider.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/update/app_update_gate.dart';

void main() {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);

    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      debugPrint('[FlutterError] ${details.exceptionAsString()}');
    };

    runApp(const ProviderScope(child: InsightBooksApp()));
  }, (error, stack) {
    debugPrint('[Unhandled] $error\n$stack');
  });
}

class InsightBooksApp extends ConsumerWidget {
  const InsightBooksApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    Widget app = MaterialApp.router(
      title: 'InsightBooks',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      routerConfig: router,
      builder: (context, child) {
        // GoRouter can pass null briefly; an empty [SizedBox] yields a blank screen.
        final content = child ??
            const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
        return AppUpdateGate(child: content);
      },
    );

    // [Banner] calls [Directionality.of]; it must sit *under* a [Directionality].
    // [MaterialApp] only inserts directionality inside itself, so wrapping the app
    // in [Banner] above [MaterialApp] crashed release builds on startup.
    if (isDevEnvironment) {
      app = Directionality(
        textDirection: TextDirection.ltr,
        child: Banner(
          message: 'DEV',
          location: BannerLocation.topEnd,
          child: app,
        ),
      );
    }

    return app;
  }
}
