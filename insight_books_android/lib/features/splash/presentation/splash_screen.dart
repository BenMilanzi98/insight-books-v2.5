import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:insightbooks_android/core/branding/app_branding.dart';
import 'package:insightbooks_android/core/security/app_route_access.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';
import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  var _navigated = false;

  static const _minSplash = Duration(milliseconds: 1800);

  // ── Animation controllers ──────────────────────────────────────────────
  late final AnimationController _logoCtrl;
  late final AnimationController _taglineCtrl;
  late final AnimationController _glowCtrl;
  late final AnimationController _progressCtrl;

  // ── Derived animations ─────────────────────────────────────────────────
  late final Animation<double> _logoScale;
  late final Animation<double> _logoFade;
  late final Animation<double> _taglineFade;
  late final Animation<double> _glowPulse;
  late final Animation<double> _progress;

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _startAnimations();
    WidgetsBinding.instance.addPostFrameCallback((_) => _runSequence());
  }

  void _initAnimations() {
    _logoCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _logoScale = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _logoCtrl, curve: Curves.elasticOut),
    );
    _logoFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logoCtrl, curve: Curves.easeOut),
    );

    _taglineCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _taglineFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _taglineCtrl, curve: Curves.easeIn),
    );

    _glowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    );
    _glowPulse = Tween<double>(begin: 0.35, end: 1.0).animate(
      CurvedAnimation(parent: _glowCtrl, curve: Curves.easeInOut),
    );

    _progressCtrl = AnimationController(
      vsync: this,
      duration: _minSplash,
    );
    _progress = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _progressCtrl, curve: Curves.easeInOut),
    );
  }

  void _startAnimations() {
    _logoCtrl.forward();

    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) _taglineCtrl.forward();
    });

    _glowCtrl.repeat(reverse: true);
    _progressCtrl.forward();
  }

  @override
  void dispose() {
    _logoCtrl.dispose();
    _taglineCtrl.dispose();
    _glowCtrl.dispose();
    _progressCtrl.dispose();
    super.dispose();
  }

  // ── Auth / navigation sequence (unchanged) ─────────────────────────────

  Future<void> _runSequence() async {
    final stopwatch = Stopwatch()..start();

    for (var i = 0; i < 40 && mounted; i++) {
      final auth = ref.read(authStateProvider);
      if (!auth.isLoading) break;
      await Future<void>.delayed(const Duration(milliseconds: 200));
    }

    final elapsed = stopwatch.elapsed;
    if (elapsed < _minSplash) {
      await Future<void>.delayed(_minSplash - elapsed);
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
      await Future.wait([
        ref.read(userPermissionsProvider.future),
        ref.read(tenantProvider.notifier).loadData(),
      ]);
    } catch (_) {}

    if (!mounted) return;

    final perms = ref.read(userPermissionsProvider).asData?.value ?? {};
    final tenantState = ref.read(tenantProvider);
    final tenantCount =
        tenantState.isLoading ? null : tenantState.tenants.length;

    _navigated = true;
    context.go(firstAccessibleRoute(perms, tenantCount: tenantCount));
  }

  // ── UI ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final screenWidth = MediaQuery.sizeOf(context).width;

    final accentColor =
        isDark ? const Color(0xFF009dd7) : const Color(0xFF0075be);

    return Scaffold(
      body: Stack(
        children: [
          // Layer 1 — rich gradient background
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.0, 0.35, 0.7, 1.0],
                  colors: isDark
                      ? const [
                          Color(0xFF040b16),
                          Color(0xFF081b33),
                          Color(0xFF0d2a4a),
                          Color(0xFF06111f),
                        ]
                      : const [
                          Color(0xFFeaf2fb),
                          Color(0xFFF2F7FF),
                          Color(0xFFF8FBFF),
                          Color(0xFFe0edfa),
                        ],
                ),
              ),
            ),
          ),

          // Layer 2 — ambient radial glow (pulsing)
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _glowCtrl,
              builder: (context, _) => Center(
                child: Container(
                  width: 340,
                  height: 340,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        accentColor.withValues(
                          alpha: (isDark ? 0.12 : 0.10) * _glowPulse.value,
                        ),
                        accentColor.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Layer 3 — main content
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildLogo(isDark, accentColor),
                    const SizedBox(height: 24),
                    _buildTagline(theme, isDark),
                  ],
                ),
              ),
            ),
          ),

          // Layer 4 — thin horizontal progress line
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SafeArea(
              top: false,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 48, vertical: 28),
                child: AnimatedBuilder(
                  animation: _progressCtrl,
                  builder: (context, _) {
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(1.5),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          height: 3,
                          width:
                              (screenWidth - 96) * _progress.value,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(1.5),
                            gradient: LinearGradient(
                              colors: isDark
                                  ? [
                                      const Color(0xFF0075be),
                                      const Color(0xFF009dd7),
                                    ]
                                  : [
                                      const Color(0xFF009dd7),
                                      const Color(0xFF0075be),
                                    ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Widget helpers ─────────────────────────────────────────────────────

  Widget _buildLogo(bool isDark, Color accent) {
    return AnimatedBuilder(
      animation: Listenable.merge([_logoCtrl, _glowCtrl]),
      builder: (context, _) {
        return Opacity(
          opacity: _logoFade.value,
          child: Transform.scale(
            scale: _logoScale.value,
            child: Image.asset(
              'assets/branding/splash_logo.png',
              width: 280,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.high,
              errorBuilder: (context, error, stackTrace) =>
                  const InsightBooksLogo(size: 120),
            ),
          ),
        );
      },
    );
  }

  Widget _buildTagline(ThemeData theme, bool isDark) {
    return AnimatedBuilder(
      animation: _taglineCtrl,
      builder: (context, _) {
        return Opacity(
          opacity: _taglineFade.value,
          child: Text(
            kAppTagline,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyLarge?.copyWith(
              height: 1.45,
              color: isDark
                  ? Colors.white.withValues(alpha: 0.88)
                  : const Color(0xFF334155),
            ),
          ),
        );
      },
    );
  }
}
