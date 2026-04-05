import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:insightbooks_android/core/branding/app_branding.dart';
import 'package:insightbooks_android/core/security/app_route_access.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';
import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

/// First route after cold start: brand moment, then login or main shell.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  var _navigated = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _runSequence());
  }

  Future<void> _runSequence() async {
    await Future<void>.delayed(const Duration(milliseconds: 1400));
    if (!mounted || _navigated) return;

    // Wait for session probe (secure storage / validateSession).
    const step = Duration(milliseconds: 120);
    for (var i = 0; i < 40 && mounted; i++) {
      final auth = ref.read(authStateProvider);
      if (!auth.isLoading) break;
      await Future<void>.delayed(step);
    }
    if (!mounted || _navigated) return;

    final auth = ref.read(authStateProvider);
    final isAuthed = auth.value == true;

    if (!isAuthed) {
      _navigated = true;
      context.go('/login');
      return;
    }

    try {
      final perms = await ref.read(userPermissionsProvider.future);
      await ref.read(tenantProvider.notifier).loadData();
      if (!mounted) return;
      final tenantState = ref.read(tenantProvider);
      final tenantCount =
          tenantState.isLoading ? null : tenantState.tenants.length;
      _navigated = true;
      context.go(firstAccessibleRoute(perms, tenantCount: tenantCount));
    } catch (_) {
      if (!mounted) return;
      _navigated = true;
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? const [
                    Color(0xFF0c1929),
                    Color(0xFF132f4c),
                    Color(0xFF0d2137),
                  ]
                : const [
                    Color(0xFFe8f4fc),
                    Color(0xFFf5f9ff),
                    Color(0xFFdff0fa),
                  ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const InsightBooksLogo(size: 140),
                  const SizedBox(height: 28),
                  Text(
                    kAppDisplayName,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: isDark
                          ? Colors.white
                          : const Color(0xFF005ba1),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    kAppTagline,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      height: 1.45,
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.88)
                          : const Color(0xFF334155),
                    ),
                  ),
                  const SizedBox(height: 40),
                  SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: isDark
                          ? const Color(0xFF009dd7)
                          : const Color(0xFF0075be),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
