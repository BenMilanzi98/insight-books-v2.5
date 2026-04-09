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
