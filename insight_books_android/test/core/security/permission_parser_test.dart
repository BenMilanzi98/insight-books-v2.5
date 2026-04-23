import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/core/security/permission_parser.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';

void main() {
  group('parsePermissionsFromMeResponse', () {
    test('MASTER_ADMIN gets all permissions plus wildcard', () {
      final perms = parsePermissionsFromMeResponse({
        'role': {'name': 'MASTER_ADMIN', 'permissions': {}},
      });
      expect(perms.contains('*'), isTrue);
      expect(perms.contains('all'), isTrue);
      expect(perms.contains('dashboard.view'), isTrue);
      expect(perms.contains('invoices.create'), isTrue);
    });

    test('parses nested permission map correctly', () {
      final perms = parsePermissionsFromMeResponse({
        'role': {
          'name': 'Accountant',
          'permissions': {
            'dashboard': {'view': true},
            'invoices': {'create': true, 'view': true, 'delete': false},
            'expenses': {'view': true, 'create': false},
          },
        },
      });
      expect(perms.contains('dashboard.view'), isTrue);
      expect(perms.contains('invoices.create'), isTrue);
      expect(perms.contains('invoices.view'), isTrue);
      expect(perms.contains('invoices.delete'), isFalse);
      expect(perms.contains('expenses.view'), isTrue);
      expect(perms.contains('expenses.create'), isFalse);
    });

    test('returns empty set when role is missing', () {
      final perms = parsePermissionsFromMeResponse({'user': 'data'});
      expect(perms, isEmpty);
    });

    test('cashier role gets default sales permissions', () {
      final perms = parsePermissionsFromMeResponse({
        'role': {'name': 'Cashier', 'permissions': {}},
      });
      expect(perms.contains('sales.view'), isTrue);
      expect(perms.contains('sales.create'), isTrue);
      expect(perms.contains('tenants.switch'), isTrue);
    });

    test('Sales Assistant with empty map gets default sales permissions', () {
      final perms = parsePermissionsFromMeResponse({
        'role': {'name': 'Sales Assistant', 'permissions': {}},
      });
      expect(perms.contains('sales.view'), isTrue);
      expect(perms.contains('clients.view'), isTrue);
    });

    test('parses numeric 1 as granted permission', () {
      final perms = parsePermissionsFromMeResponse({
        'role': {
          'name': 'Sales',
          'permissions': {
            'sales': {'view': 1, 'create': 0, 'delete': false},
          },
        },
      });
      expect(perms.contains('sales.view'), isTrue);
      expect(perms.contains('sales.create'), isFalse);
    });

    test('parses permissions JSON string', () {
      final perms = parsePermissionsFromMeResponse({
        'role': {
          'name': 'Sales',
          'permissions':
              '{"sales":{"view":true,"create":true},"clients":{"view":true}}',
        },
      });
      expect(perms.contains('sales.view'), isTrue);
      expect(perms.contains('sales.create'), isTrue);
      expect(perms.contains('clients.view'), isTrue);
    });

    test('parses module with list of action strings', () {
      final perms = parsePermissionsFromMeResponse({
        'role': {
          'name': 'Sales',
          'permissions': {
            'sales': ['view', 'create'],
            'clients': ['view'],
          },
        },
      });
      expect(perms.contains('sales.view'), isTrue);
      expect(perms.contains('sales.create'), isTrue);
      expect(perms.contains('clients.view'), isTrue);
    });

    test('parses web custom role flat module.action keys', () {
      final perms = parsePermissionsFromMeResponse({
        'role': {
          'name': 'Store Lead',
          'permissions': {
            'sales.view': true,
            'sales.create': true,
            'dashboard.view': 1,
            'invoices.view': false,
            'quotations.view': 'true',
          },
        },
      });
      expect(perms.contains('sales.view'), isTrue);
      expect(perms.contains('sales.create'), isTrue);
      expect(perms.contains('dashboard.view'), isTrue);
      expect(perms.contains('invoices.view'), isFalse);
      expect(perms.contains('quotations.view'), isTrue);
    });
  });

  group('hasPermission', () {
    test('returns true when permission present', () {
      expect(hasPermission({'dashboard.view', 'sales.view'}, 'sales.view'),
          isTrue);
    });

    test('returns true for wildcard *', () {
      expect(hasPermission({'*'}, 'anything.here'), isTrue);
    });

    test('returns true for wildcard all', () {
      expect(hasPermission({'all'}, 'anything.here'), isTrue);
    });

    test('returns false when empty', () {
      expect(hasPermission({}, 'sales.view'), isFalse);
    });

    test('returns false when permission absent', () {
      expect(hasPermission({'dashboard.view'}, 'sales.view'), isFalse);
    });
  });

  group('satisfiesPermission', () {
    test('stock and inventory are interchangeable', () {
      expect(
        satisfiesPermission({'inventory.view'}, 'stock.view'),
        isTrue,
      );
      expect(
        satisfiesPermission({'stock.view'}, 'inventory.view'),
        isTrue,
      );
    });

    test('non-inventory permissions are not interchangeable', () {
      expect(
        satisfiesPermission({'sales.view'}, 'invoices.view'),
        isFalse,
      );
    });
  });
}
