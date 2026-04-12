import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show hasPermission, satisfiesPermission;
class RoutePermissionRule {
  final String prefix;
  final String permission;
  const RoutePermissionRule(this.prefix, this.permission);
}

/// Route prefix → permission required for ShellRoute children.
const List<RoutePermissionRule> kRoutePermissionRules = [
  RoutePermissionRule('/dashboard', 'dashboard.view'),
  RoutePermissionRule('/pos', 'sales.view'),
  RoutePermissionRule('/invoice', 'invoices.view'),
  RoutePermissionRule('/quotation', 'quotations.view'),
  RoutePermissionRule('/expenses', 'expenses.view'),
  RoutePermissionRule('/stock', 'stock.view'),
  RoutePermissionRule('/reports', 'reports.view'),
  RoutePermissionRule('/account', 'system.view'),
  RoutePermissionRule('/payments', 'payments.view'),
];

/// Whether the user may open Switch Business (multi-tenant only).
bool canAccessSwitchTenant({
  required Set<String> permissions,
  required int tenantCount,
}) {
  if (tenantCount <= 1) return false;
  return hasPermission(permissions, 'tenants.switch') ||
      hasPermission(permissions, 'system.view') ||
      hasPermission(permissions, 'users.view');
}

/// First screen a user should see (most common default: dashboard, then POS, etc.).
///
/// [tenantCount] when known (not loading): used to offer `/switch-tenant` only when
/// switching is allowed. When null, `/switch-tenant` is not chosen as a default.
String firstAccessibleRoute(
  Set<String> permissions, {
  int? tenantCount,
}) {
  // Fully implemented screens first.
  if (hasPermission(permissions, 'dashboard.view')) return '/dashboard';
  if (hasPermission(permissions, 'sales.view')) return '/pos';
  if (hasPermission(permissions, 'invoices.view')) return '/invoice';
  if (hasPermission(permissions, 'quotations.view')) return '/quotation';
  if (hasPermission(permissions, 'expenses.view')) return '/expenses';
  if (hasPermission(permissions, 'system.view')) return '/account';
  if (tenantCount != null &&
      tenantCount > 1 &&
      canAccessSwitchTenant(permissions: permissions, tenantCount: tenantCount)) {
    return '/switch-tenant';
  }
  // Partially implemented ("Coming Soon") screens as last resort.
  if (satisfiesPermission(permissions, 'stock.view')) return '/stock';
  if (hasPermission(permissions, 'reports.view')) return '/reports';
  if (hasPermission(permissions, 'payments.view')) return '/payments';
  // Do not send users to `/pos` (or any guarded shell route) without the matching
  // permission — that causes an infinite GoRouter redirect and a blank screen.
  return '/access-denied';
}

/// Returns the permission key for the current path, or null if no rule / open.
String? requiredPermissionForLocation(String matchedLocation) {
  for (final rule in kRoutePermissionRules) {
    if (rule.permission.isEmpty) continue;
    if (matchedLocation == rule.prefix ||
        matchedLocation.startsWith('${rule.prefix}/')) {
      return rule.permission;
    }
  }
  return null;
}
