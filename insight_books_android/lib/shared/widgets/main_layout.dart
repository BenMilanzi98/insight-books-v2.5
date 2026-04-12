import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:insightbooks_android/core/security/app_route_access.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';
import 'package:insightbooks_android/features/tenant/domain/tenant_models.dart';
import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/core/branding/app_branding.dart';

/// Bottom bar items (subset of drawer): filtered by [hasPermission].
class _BottomNavSpec {
  final String permission;
  final String path;
  final IconData icon;
  final String label;
  final String shortLabel;
  final int colorIndex;

  const _BottomNavSpec(
    this.permission,
    this.path,
    this.icon,
    this.label,
    this.shortLabel,
    this.colorIndex,
  );
}

const List<_BottomNavSpec> _kAllBottomNavSpecs = [
  _BottomNavSpec(
    'dashboard.view',
    '/dashboard',
    Icons.home_rounded,
    'Home',
    'Home',
    0,
  ),
  _BottomNavSpec(
    'sales.view',
    '/pos',
    Icons.point_of_sale_rounded,
    'POS',
    'POS',
    1,
  ),
  _BottomNavSpec(
    'invoices.view',
    '/invoice',
    Icons.receipt_long_rounded,
    'Invoicing',
    'Invc',
    2,
  ),
  _BottomNavSpec(
    'quotations.view',
    '/quotation',
    Icons.description_rounded,
    'Quotations',
    'Quotes',
    3,
  ),
];

bool _locationMatchesBottomPath(String location, String path) {
  if (path == '/dashboard') return location == '/dashboard';
  return location == path || location.startsWith('$path/');
}

class MainLayout extends ConsumerWidget {
  final Widget child;
  final String? title;

  const MainLayout({super.key, required this.child, this.title});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final isDesktop = MediaQuery.of(context).size.width > 800;
    final perms = ref.watch(userPermissionsProvider).asData?.value ?? <String>{};

    final visibleBottom = _kAllBottomNavSpecs
        .where((s) => hasPermission(perms, s.permission))
        .toList();

    int calculateSelectedIndex() {
      for (var i = 0; i < visibleBottom.length; i++) {
        if (_locationMatchesBottomPath(location, visibleBottom[i].path)) {
          return i;
        }
      }
      return 0;
    }

    void onNavTap(int index) {
      if (index < 0 || index >= visibleBottom.length) return;
      context.go(visibleBottom[index].path);
    }

    return Scaffold(
      drawer: isDesktop ? null : const AppDrawer(),
      body: Row(
        children: [
          if (isDesktop) const AppDrawer(isPermanent: true),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeIn,
              transitionBuilder: (child, animation) {
                return FadeTransition(opacity: animation, child: child);
              },
              child: KeyedSubtree(
                key: ValueKey(location),
                child: child,
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: isDesktop || visibleBottom.isEmpty
          ? null
          : _ModernBottomNav(
              destinations: visibleBottom,
              currentIndex: calculateSelectedIndex().clamp(0, visibleBottom.length - 1),
              onTap: onNavTap,
            ),
    );
  }
}

// Per-tab accent colors (colorful nav)
const _navColors = [
  Color(0xFF3B82F6), // Home – blue
  Color(0xFF10B981), // POS – emerald
  Color(0xFFF59E0B), // Invoicing – amber
  Color(0xFF8B5CF6), // Quotations – violet
];

const _navLightTints = [
  Color(0xFFEFF6FF), // blue tint
  Color(0xFFECFDF5), // emerald tint
  Color(0xFFFFFBEB), // amber tint
  Color(0xFFF5F3FF), // violet tint
];

/// Modern bottom navigation: floating pill, per-tab colors, overflow-safe, responsive.
class _ModernBottomNav extends StatelessWidget {
  final List<_BottomNavSpec> destinations;
  final int currentIndex;
  final ValueChanged<int> onTap;

  const _ModernBottomNav({
    required this.destinations,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLight = theme.brightness == Brightness.light;
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    final width = MediaQuery.sizeOf(context).width;

    final barColor = isLight
        ? theme.colorScheme.surface
        : const Color(0xFF1E293B);
    final surfaceColor = isLight
        ? theme.colorScheme.surfaceContainer
        : const Color(0xFF0F172A);
    final unselectedColor = isLight ? const Color(0xFF64748B) : const Color(0xFF94A3B8);

    final useShortLabels = width < 380;
    final safeIndex = currentIndex.clamp(0, destinations.length - 1);
    final accentIdx = destinations.isEmpty
        ? 0
        : destinations[safeIndex].colorIndex.clamp(0, _navColors.length - 1);

    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        top: 10,
        bottom: safeBottom + 10,
      ),
      decoration: BoxDecoration(
        color: surfaceColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isLight ? 0.06 : 0.3),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Container(
        height: 62,
        decoration: BoxDecoration(
          color: barColor,
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: _navColors[accentIdx].withValues(alpha: 0.12),
              blurRadius: 14,
              offset: const Offset(0, 2),
            ),
            if (isLight)
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 1),
              ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: Row(
            children: List.generate(destinations.length, (index) {
              final dest = destinations[index];
              final selected = currentIndex == index;
              final label = useShortLabels ? dest.shortLabel : dest.label;
              final cIdx = dest.colorIndex.clamp(0, _navColors.length - 1);
              return Expanded(
                child: _NavTile(
                  icon: dest.icon,
                  label: label,
                  selected: selected,
                  accentColor: _navColors[cIdx],
                  accentTint: _navLightTints[cIdx],
                  unselectedColor: unselectedColor,
                  onTap: () => onTap(index),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class _NavTile extends StatefulWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final Color accentColor;
  final Color accentTint;
  final Color unselectedColor;
  final VoidCallback onTap;

  const _NavTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.accentColor,
    required this.accentTint,
    required this.unselectedColor,
    required this.onTap,
  });

  @override
  State<_NavTile> createState() => _NavTileState();
}

class _NavTileState extends State<_NavTile> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 100),
      vsync: this,
    );
    _scale = Tween<double>(begin: 1, end: 0.88).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.selected ? widget.accentColor : widget.unselectedColor;

    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) => _controller.reverse(),
      onTapCancel: () => _controller.reverse(),
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: ScaleTransition(
        scale: _scale,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            decoration: BoxDecoration(
              color: widget.selected ? widget.accentTint : Colors.transparent,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.max,
              children: [
                Icon(
                  widget.icon,
                  size: 22,
                  color: color,
                ),
                const SizedBox(height: 3),
                Flexible(
                  child: LayoutBuilder(
                    builder: (_, constraints) {
                      return FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.center,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            maxWidth: constraints.maxWidth > 0
                                ? constraints.maxWidth
                                : 80,
                          ),
                          child: Text(
                            widget.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: widget.selected
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                              color: color,
                              letterSpacing: 0.15,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Side nav theme (aligned with web Sidebar.js)
const _drawerBackgroundStart = Color(0xFF0F172A);
const _drawerBackgroundEnd = Color(0xFF111827);
const _drawerBorder = Color(0x14FFFFFF);
const _sectionLabelColor = Color(0x80FFFFFF);
const _defaultTextColor = Color(0xFFD1D5DB); // drawer text/icon (always on dark)
const _activeTextColor = Color(0xFF60A5FA);
const _activeBorderColor = Color(0xFF3182CE);
const _activeBgColor = Color(0x333182CE);
const _hoverBgColor = Color(0x263182CE);

// Per-item icon colors (from web Sidebar iconMap / colorfulIcons)
const _iconColors = {
  'dashboard': Color(0xFF3B82F6),   // blue
  'pos': Color(0xFF6366F1),          // indigo
  'invoicing': Color(0xFFA855F7),     // violet
  'quotations': Color(0xFF14B8A6),    // teal
  'expenses': Color(0xFFF43F5E),      // rose
  'business': Color(0xFF10B981),     // emerald
  'account': Color(0xFFF59E0B),      // amber
};

class AppDrawer extends ConsumerWidget {
  final bool isPermanent;

  const AppDrawer({super.key, this.isPermanent = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentRoute = GoRouterState.of(context).matchedLocation;
    final perms = ref.watch(userPermissionsProvider).asData?.value ?? <String>{};
    final tenantState = ref.watch(tenantProvider);
    final showSwitchTenant = !tenantState.isLoading &&
        canAccessSwitchTenant(
          permissions: perms,
          tenantCount: tenantState.tenants.length,
        );
    final drawerWidth = isPermanent ? 280.0 : null;

    Widget content = Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_drawerBackgroundStart, _drawerBackgroundEnd],
        ),
        border: BorderDirectional(
          end: BorderSide(color: _drawerBorder, width: 1),
        ),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
              child: Image.asset(
                'assets/branding/splash_logo.png',
                height: 44,
                fit: BoxFit.contain,
                filterQuality: FilterQuality.high,
                errorBuilder: (_, __, ___) => const InsightBooksLogo(size: 36),
              ),
            ),
            const Divider(height: 1, color: Colors.white12),
            const _BusinessSwitcherSection(),
            // Scrollable nav
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                shrinkWrap: true,
                children: [
                  _SectionLabel(label: 'CORE'),
                  if (hasPermission(perms, 'dashboard.view'))
                    _NavItem(
                      title: 'Dashboard',
                      icon: Icons.dashboard_rounded,
                      iconKey: 'dashboard',
                      route: '/dashboard',
                      currentRoute: currentRoute,
                    ),
                  if (hasPermission(perms, 'sales.view'))
                    _NavItem(
                      title: 'POS',
                      icon: Icons.point_of_sale_rounded,
                      iconKey: 'pos',
                      route: '/pos',
                      currentRoute: currentRoute,
                    ),
                  if (hasPermission(perms, 'invoices.view'))
                    _NavItem(
                      title: 'Invoicing',
                      icon: Icons.receipt_long_rounded,
                      iconKey: 'invoicing',
                      route: '/invoice',
                      currentRoute: currentRoute,
                    ),
                  if (hasPermission(perms, 'quotations.view'))
                    _NavItem(
                      title: 'Quotations',
                      icon: Icons.description_rounded,
                      iconKey: 'quotations',
                      route: '/quotation',
                      currentRoute: currentRoute,
                    ),
                  if (hasPermission(perms, 'expenses.view'))
                    _NavItem(
                      title: 'Expenses',
                      icon: Icons.receipt_rounded,
                      iconKey: 'expenses',
                      route: '/expenses',
                      currentRoute: currentRoute,
                    ),
                  const SizedBox(height: 8),
                  if (showSwitchTenant || hasPermission(perms, 'system.view'))
                    _SectionLabel(label: 'ACCOUNT'),
                  if (showSwitchTenant)
                    _NavItem(
                      title: 'Switch Business',
                      icon: Icons.business_rounded,
                      iconKey: 'business',
                      route: '/switch-tenant',
                      currentRoute: currentRoute,
                    ),
                  if (hasPermission(perms, 'system.view'))
                    _NavItem(
                      title: 'Account Settings',
                      icon: Icons.person_rounded,
                      iconKey: 'account',
                      route: '/account',
                      currentRoute: currentRoute,
                    ),
                  const SizedBox(height: 8),
                  const Divider(height: 1, color: Colors.white12),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
                    child: Row(
                      children: [
                        Icon(Icons.dark_mode_rounded, color: _defaultTextColor, size: 22),
                        const SizedBox(width: 12),
                        Text('Theme', style: TextStyle(color: _defaultTextColor, fontSize: 14)),
                        const Spacer(),
                        const ThemeToggleButton(iconColor: _defaultTextColor),
                      ],
                    ),
                  ),
                  if (ref.watch(authStateProvider).value == true) ...[
                    const Divider(height: 1, color: Colors.white12),
                    ListTile(
                      leading: const Icon(Icons.logout_rounded, color: _defaultTextColor),
                      title: const Text(
                        'Log out',
                        style: TextStyle(color: _defaultTextColor, fontSize: 15),
                      ),
                      onTap: () async {
                        if (Scaffold.maybeOf(context)?.isDrawerOpen ?? false) {
                          Scaffold.of(context).closeDrawer();
                        }
                        await ref.read(authStateProvider.notifier).logout();
                      },
                    ),
                    const SizedBox(height: 8),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );

    if (isPermanent) {
      return SizedBox(
        width: drawerWidth,
        child: content,
      );
    }

    return Drawer(
      width: 280,
      backgroundColor: Colors.transparent,
      child: content,
    );
  }
}

class _BusinessSwitcherSection extends ConsumerStatefulWidget {
  const _BusinessSwitcherSection();

  @override
  ConsumerState<_BusinessSwitcherSection> createState() =>
      _BusinessSwitcherSectionState();
}

class _BusinessSwitcherSectionState extends ConsumerState<_BusinessSwitcherSection> {
  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authStateProvider);
    if (auth.value != true) return const SizedBox.shrink();

    final tenantState = ref.watch(tenantProvider);
    final perms = ref.watch(userPermissionsProvider).asData?.value ?? <String>{};
    final showManageNav = !tenantState.isLoading &&
        canAccessSwitchTenant(
          permissions: perms,
          tenantCount: tenantState.tenants.length,
        );

    if (tenantState.isLoading && tenantState.tenants.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Row(
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: _activeTextColor,
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Loading businesses…',
                  style: TextStyle(color: _defaultTextColor, fontSize: 13),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (tenantState.error != null && tenantState.tenants.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Text(
          'Branches/Businesses: unavailable',
          style: TextStyle(color: Colors.red.shade200, fontSize: 12),
        ),
      );
    }

    if (tenantState.tenants.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
        child: Text(
          'No businesses assigned',
          style: TextStyle(color: _defaultTextColor.withValues(alpha: 0.85), fontSize: 12),
        ),
      );
    }

    Tenant? current;
    for (final t in tenantState.tenants) {
      if (t.id == tenantState.currentTenantId) {
        current = t;
        break;
      }
    }
    current ??= tenantState.tenants.first;

    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
      child: Material(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: tenantState.isSwitching
              ? null
              : () => _openBusinessSheet(context, ref, showManageNav),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            child: Row(
              children: [
                const Icon(Icons.business_rounded, color: _activeTextColor, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'BRANCHES / BUSINESSES',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                          color: _sectionLabelColor,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        current.name,
                        style: const TextStyle(
                          color: _defaultTextColor,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (tenantState.isSwitching)
                  const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: _activeTextColor,
                    ),
                  )
                else
                  const Icon(Icons.expand_more_rounded, color: _defaultTextColor),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openBusinessSheet(
    BuildContext context,
    WidgetRef ref,
    bool showManageNav,
  ) async {
    final notifier = ref.read(tenantProvider.notifier);
    final state = ref.read(tenantProvider);
    if (state.tenants.isEmpty) return;

    final picked = await showModalBottomSheet<Tenant?>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Switch business',
                    style: Theme.of(ctx).textTheme.titleMedium,
                  ),
                ),
                const Divider(height: 1),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      ...state.tenants.map((t) {
                        final selected = t.id == state.currentTenantId;
                        return ListTile(
                          leading: Icon(
                            selected
                                ? Icons.check_circle_rounded
                                : Icons.circle_outlined,
                            color: selected
                                ? Theme.of(ctx).colorScheme.primary
                                : Theme.of(ctx).colorScheme.onSurface.withAlpha(150),
                          ),
                          title: Text(t.name),
                          onTap: () => Navigator.pop(ctx, t),
                        );
                      }),
                    ],
                  ),
                ),
                if (showManageNav)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                    child: TextButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        context.go('/switch-tenant');
                      },
                      child: const Text('Manage businesses'),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );

    if (!context.mounted || picked == null) return;
    if (picked.id == state.currentTenantId) return;

    final ok = await notifier.switchTenant(picked.id);
    if (!context.mounted) return;
    if (ok) {
      context.go('/dashboard');
    } else {
      final err = ref.read(tenantProvider).error;
      if (err != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err)),
        );
      }
    }
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;

  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.8,
          color: _sectionLabelColor,
        ),
      ),
    );
  }
}

class _NavItem extends StatefulWidget {
  final String title;
  final IconData icon;
  final String iconKey;
  final String route;
  final String currentRoute;

  const _NavItem({
    required this.title,
    required this.icon,
    required this.iconKey,
    required this.route,
    required this.currentRoute,
  });

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final isActive = widget.currentRoute.startsWith(widget.route);
    final iconColor = _iconColors[widget.iconKey] ?? _defaultTextColor;
    final effectiveIconColor = isActive ? _activeTextColor : iconColor;
    final bgColor = isActive
        ? _activeBgColor
        : (_hover ? _hoverBgColor : Colors.transparent);
    final leftBorder = isActive ? _activeBorderColor : Colors.transparent;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      child: MouseRegion(
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = false),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              if (Scaffold.maybeOf(context)?.isDrawerOpen ?? false) {
                Scaffold.of(context).closeDrawer();
              }
              context.go(widget.route);
            },
            borderRadius: BorderRadius.circular(10),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutCubic,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(10),
                border: BorderDirectional(
                  start: BorderSide(color: leftBorder, width: 3),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    widget.icon,
                    size: 22,
                    color: effectiveIconColor,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      widget.title,
                      style: TextStyle(
                        color: isActive ? _activeTextColor : _defaultTextColor,
                        fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                        fontSize: 14,
                      ),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
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
