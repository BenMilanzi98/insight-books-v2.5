import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/core/security/app_route_access.dart';

void main() {
  group('firstAccessibleRoute', () {
    test('returns /dashboard for dashboard.view permission', () {
      expect(firstAccessibleRoute({'dashboard.view'}), '/dashboard');
    });

    test('returns /pos for sales-only user', () {
      expect(firstAccessibleRoute({'sales.view', 'sales.create'}), '/pos');
    });

    test('returns /invoice for invoices-only user', () {
      expect(firstAccessibleRoute({'invoices.view'}), '/invoice');
    });

    test('returns /account for system.view user', () {
      expect(firstAccessibleRoute({'system.view'}), '/account');
    });

    test('prefers real screens over coming-soon screens', () {
      final route = firstAccessibleRoute({
        'stock.view',
        'system.view',
      });
      expect(route, '/account');
    });

    test('falls back to coming-soon screen when no real screens', () {
      expect(firstAccessibleRoute({'stock.view'}), '/stock');
    });

    test('falls back to access denied with empty permissions', () {
      expect(firstAccessibleRoute({}), '/access-denied');
    });

    test('offers switch-tenant when multiple tenants', () {
      final route = firstAccessibleRoute(
        {'tenants.switch'},
        tenantCount: 3,
      );
      expect(route, '/switch-tenant');
    });

    test('does not offer switch-tenant for single tenant', () {
      final route = firstAccessibleRoute(
        {'tenants.switch'},
        tenantCount: 1,
      );
      expect(route, '/access-denied');
    });
  });

  group('requiredPermissionForLocation', () {
    test('returns permission for /dashboard', () {
      expect(requiredPermissionForLocation('/dashboard'), 'dashboard.view');
    });

    test('returns permission for /pos', () {
      expect(requiredPermissionForLocation('/pos'), 'sales.view');
    });

    test('returns permission for nested invoice route', () {
      expect(requiredPermissionForLocation('/invoice/123'), 'invoices.view');
    });

    test('returns null for unknown route', () {
      expect(requiredPermissionForLocation('/unknown'), isNull);
    });

    test('returns null for /splash', () {
      expect(requiredPermissionForLocation('/splash'), isNull);
    });
  });

  group('canAccessSwitchTenant', () {
    test('returns false with 1 tenant', () {
      expect(
        canAccessSwitchTenant(
          permissions: {'tenants.switch'},
          tenantCount: 1,
        ),
        isFalse,
      );
    });

    test('returns true with 2+ tenants and proper permission', () {
      expect(
        canAccessSwitchTenant(
          permissions: {'tenants.switch'},
          tenantCount: 2,
        ),
        isTrue,
      );
    });

    test('returns true for system.view users with multiple tenants', () {
      expect(
        canAccessSwitchTenant(
          permissions: {'system.view'},
          tenantCount: 3,
        ),
        isTrue,
      );
    });
  });
}
