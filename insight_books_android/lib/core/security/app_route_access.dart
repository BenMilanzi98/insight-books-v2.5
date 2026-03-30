import 'package:insightbooks_android/core/security/permissions_provider.dart';

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
  RoutePermissionRule('/stock', 'inventory.view'),
  RoutePermissionRule('/reports', 'reports.view'),
  RoutePermissionRule('/account', 'system.view'),
  RoutePermissionRule('/payments', 'payments.view'),
  RoutePermissionRule('/switch-tenant', ''),
];

/// First screen a user should see (most common default: dashboard, then POS, etc.).
String firstAccessibleRoute(Set<String> permissions) {
  if (hasPermission(permissions, 'dashboard.view')) return '/dashboard';
  if (hasPermission(permissions, 'sales.view')) return '/pos';
  if (hasPermission(permissions, 'invoices.view')) return '/invoice';
  if (hasPermission(permissions, 'quotations.view')) return '/quotation';
  if (hasPermission(permissions, 'expenses.view')) return '/expenses';
  if (hasPermission(permissions, 'inventory.view')) return '/stock';
  if (hasPermission(permissions, 'reports.view')) return '/reports';
  if (hasPermission(permissions, 'payments.view')) return '/payments';
  if (hasPermission(permissions, 'system.view')) return '/account';
  return '/switch-tenant';
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
