import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';

class MainLayout extends StatelessWidget {
  final Widget child;
  final String? title;

  const MainLayout({super.key, required this.child, this.title});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final isDesktop = MediaQuery.of(context).size.width > 800;

    int calculateSelectedIndex() {
      if (location == '/dashboard') return 0;
      if (location == '/pos') return 1;
      if (location.startsWith('/invoice')) return 2;
      if (location.startsWith('/quotation')) return 3;
      return 0;
    }

    void onNavTap(int index) {
      switch (index) {
        case 0:
          context.go('/dashboard');
          break;
        case 1:
          context.go('/pos');
          break;
        case 2:
          context.go('/invoice');
          break;
        case 3:
          context.go('/quotation');
          break;
      }
    }

    return Scaffold(
      drawer: isDesktop ? null : const AppDrawer(),
      body: Row(
        children: [
          if (isDesktop) const AppDrawer(isPermanent: true),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: isDesktop
          ? null
          : _ModernBottomNav(
              currentIndex: calculateSelectedIndex(),
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
  final int currentIndex;
  final ValueChanged<int> onTap;

  const _ModernBottomNav({
    required this.currentIndex,
    required this.onTap,
  });

  static const List<_NavDestination> _destinations = [
    _NavDestination(icon: Icons.home_rounded, label: 'Home', shortLabel: 'Home'),
    _NavDestination(icon: Icons.point_of_sale_rounded, label: 'POS', shortLabel: 'POS'),
    _NavDestination(icon: Icons.receipt_long_rounded, label: 'Invoicing', shortLabel: 'Invc'),
    _NavDestination(icon: Icons.description_rounded, label: 'Quotations', shortLabel: 'Quotes'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLight = theme.brightness == Brightness.light;
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    final width = MediaQuery.sizeOf(context).width;

    final barColor = isLight ? Colors.white : const Color(0xFF1E293B);
    final surfaceColor = isLight ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A);
    final unselectedColor = isLight ? const Color(0xFF64748B) : const Color(0xFF94A3B8);

    // Use short labels on narrow screens to prevent overflow
    final useShortLabels = width < 380;

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
              color: _navColors[currentIndex].withValues(alpha: 0.12),
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
            children: List.generate(_destinations.length, (index) {
              final dest = _destinations[index];
              final selected = currentIndex == index;
              final label = useShortLabels ? dest.shortLabel : dest.label;
              return Expanded(
                child: _NavTile(
                  icon: dest.icon,
                  label: label,
                  selected: selected,
                  accentColor: _navColors[index],
                  accentTint: _navLightTints[index],
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

class _NavDestination {
  final IconData icon;
  final String label;
  final String shortLabel;

  const _NavDestination({
    required this.icon,
    required this.label,
    required this.shortLabel,
  });
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
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _activeBgColor,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.account_balance_rounded,
                      color: _activeTextColor,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Flexible(
                    child: Text(
                      'InsightBooks',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.3,
                          ),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Colors.white12),
            // Scrollable nav
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                shrinkWrap: true,
                children: [
                  _SectionLabel(label: 'CORE'),
                  _NavItem(
                    title: 'Dashboard',
                    icon: Icons.dashboard_rounded,
                    iconKey: 'dashboard',
                    route: '/dashboard',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'POS',
                    icon: Icons.point_of_sale_rounded,
                    iconKey: 'pos',
                    route: '/pos',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'Invoicing',
                    icon: Icons.receipt_long_rounded,
                    iconKey: 'invoicing',
                    route: '/invoice',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'Quotations',
                    icon: Icons.description_rounded,
                    iconKey: 'quotations',
                    route: '/quotation',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'Expenses',
                    icon: Icons.receipt_rounded,
                    iconKey: 'expenses',
                    route: '/expenses',
                    currentRoute: currentRoute,
                  ),
                  const SizedBox(height: 8),
                  _SectionLabel(label: 'ACCOUNT'),
                  _NavItem(
                    title: 'Switch Business',
                    icon: Icons.business_rounded,
                    iconKey: 'business',
                    route: '/switch-tenant',
                    currentRoute: currentRoute,
                  ),
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
                    padding: const EdgeInsets.fromLTRB(16, 12, 8, 16),
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
