import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class MainLayout extends StatelessWidget {
  final Widget child;
  final String? title;

  const MainLayout({super.key, required this.child, this.title});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final isDesktop = MediaQuery.of(context).size.width > 800;

    // Map routes to bottom nav indices
    int calculateSelectedIndex() {
      if (location == '/dashboard') return 0;
      if (location == '/invoice') return 1;
      if (location == '/pos') return 2;
      if (location == '/switch-tenant') return 3;
      if (location == '/account') return 4;
      return 0;
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
          : BottomNavigationBar(
              currentIndex: calculateSelectedIndex(),
              onTap: (index) {
                switch (index) {
                  case 0:
                    context.go('/dashboard');
                    break;
                  case 1:
                    context.go('/invoice');
                    break;
                  case 2:
                    context.go('/pos');
                    break;
                  case 3:
                    context.go('/switch-tenant');
                    break;
                  case 4:
                    context.go('/account');
                    break;
                }
              },
              type: BottomNavigationBarType.fixed,
              selectedItemColor: const Color(0xFF3B82F6),
              unselectedItemColor: Colors.grey,
              items: const [
                BottomNavigationBarItem(
                  icon: Icon(Icons.dashboard),
                  label: 'Home',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.receipt),
                  label: 'Invoicing',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.point_of_sale),
                  label: 'POS',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.business_center),
                  label: 'Businesses',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.person),
                  label: 'Account',
                ),
              ],
            ),
    );
  }
}

class AppDrawer extends StatelessWidget {
  final bool isPermanent;

  const AppDrawer({super.key, this.isPermanent = false});

  @override
  Widget build(BuildContext context) {
    final currentRoute = GoRouterState.of(context).matchedLocation;

    return Drawer(
      backgroundColor: const Color(0xFF0F172A), // Nav Background
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                vertical: 24.0,
                horizontal: 16.0,
              ),
              // Placeholder for actual Logo
              child: Row(
                children: [
                  const Icon(
                    Icons.account_balance_wallet,
                    color: Colors.white,
                    size: 32,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'InsightBooks',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(color: Colors.white24, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 16),
                children: [
                  _NavItem(
                    title: 'Dashboard',
                    icon: Icons.dashboard,
                    route: '/dashboard',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'POS',
                    icon: Icons.point_of_sale,
                    route: '/pos',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'Invoicing',
                    icon: Icons.receipt,
                    route: '/invoice',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'Expenses',
                    icon: Icons.money_off,
                    route: '/expenses',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'Payments',
                    icon: Icons.payment,
                    route: '/payments',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'Reports',
                    icon: Icons.bar_chart,
                    route: '/reports',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'Stock',
                    icon: Icons.inventory_2,
                    route: '/stock',
                    currentRoute: currentRoute,
                  ),
                  const Divider(color: Colors.white24),
                  _NavItem(
                    title: 'Switch Business',
                    icon: Icons.business_center,
                    route: '/switch-tenant',
                    currentRoute: currentRoute,
                  ),
                  _NavItem(
                    title: 'Account Settings',
                    icon: Icons.person,
                    route: '/account',
                    currentRoute: currentRoute,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final String title;
  final IconData icon;
  final String route;
  final String currentRoute;

  const _NavItem({
    required this.title,
    required this.icon,
    required this.route,
    required this.currentRoute,
  });

  @override
  Widget build(BuildContext context) {
    final isActive = currentRoute.startsWith(route);

    // Active Colors from specs
    const activeText = Color(0xFF60A5FA);
    const activeBorder = Color(0xFF3182CE);
    const defaultText = Color(0xFFD1D5DB);

    return ListTile(
      leading: Icon(icon, color: isActive ? activeText : defaultText),
      title: Text(
        title,
        style: TextStyle(
          color: isActive ? activeText : defaultText,
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      selected: isActive,
      onTap: () {
        // If on mobile, close drawer before navigation
        if (Scaffold.of(context).isDrawerOpen) {
          Scaffold.of(context).closeDrawer();
        }
        context.go(route);
      },
      contentPadding: const EdgeInsets.symmetric(horizontal: 24),
      shape: isActive
          ? const Border(left: BorderSide(color: activeBorder, width: 4))
          : null,
    );
  }
}
