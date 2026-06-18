import 'dart:convert';

/// Mirrors web [permissionModules] — flatten nested role.permissions to "module.action" strings.
const Map<String, List<String>> _kPermissionModules = {
  'dashboard': ['view'],
  'users': ['create', 'view', 'update', 'delete', 'export'],
  'roles': ['create', 'view', 'update', 'delete', 'assign'],
  'system': ['view', 'update', 'switchTenant'],
  'clients': ['create', 'view', 'update', 'delete', 'export'],
  'sales': ['create', 'view', 'update', 'delete', 'void', 'refund', 'export'],
  'quotations': ['create', 'view', 'update', 'delete', 'convert', 'approve', 'export'],
  'invoices': ['create', 'view', 'update', 'delete', 'send', 'markAsPaid', 'export'],
  'expenses': ['create', 'view', 'update', 'delete', 'approve', 'export'],
  'payments': ['create', 'view', 'update', 'delete', 'export'],
  'budgets': ['create', 'view', 'update', 'delete', 'approve', 'export'],
  'branches': ['create', 'view', 'update', 'delete'],
  'reports': ['view', 'export'],
  'inventory': ['create', 'view', 'update', 'delete', 'adjust', 'export'],
  'hr': ['create', 'view', 'update', 'delete', 'export'],
  'payroll': ['create', 'view', 'update', 'delete', 'process', 'export'],
  'tax': ['view', 'update', 'export', 'settle'],
  'generalLedger': ['view', 'export'],
  'journalEntries': ['create', 'view', 'update', 'delete', 'post', 'export'],
  'accounts': ['create', 'view', 'update', 'delete', 'export'],
  'trialBalance': ['view', 'export'],
  'assets': ['create', 'view', 'update', 'delete', 'export'],
  'tenants': ['switch'],
};

Set<String> get fullPermissionSet {
  final out = <String>{};
  for (final e in _kPermissionModules.entries) {
    for (final a in e.value) {
      out.add('${e.key}.$a');
    }
  }
  return out;
}

/// API / DB may use `true`, `1`, or string "true" for granted actions.
bool _truthyPermissionValue(dynamic v) {
  if (v == true) return true;
  if (v == 1) return true;
  if (v is num && v != 0) return true;
  if (v is String) {
    final s = v.trim().toLowerCase();
    return s == 'true' || s == '1' || s == 'yes';
  }
  return false;
}

void _flattenPermissionsDynamic(dynamic raw, Set<String> out) {
  if (raw == null) return;

  if (raw is String) {
    final t = raw.trim();
    if (t.isEmpty) return;
    try {
      _flattenPermissionsDynamic(jsonDecode(t), out);
    } catch (_) {}
    return;
  }

  if (raw is List) {
    for (final el in raw) {
      if (el is String && el.contains('.')) {
        out.add(el);
      }
    }
    return;
  }

  if (raw is Map) {
    final m = Map<String, dynamic>.from(raw);
    for (final moduleEntry in m.entries) {
      final k = moduleEntry.key.toString();
      final v = moduleEntry.value;

      // Web "Users → Roles" UI stores custom roles as flat keys: { "sales.view": true, ... }.
      if (k.contains('.') && v is! Map && v is! List) {
        if (_truthyPermissionValue(v)) {
          out.add(k);
        }
        continue;
      }

      final module = k;
      final actions = v;
      if (actions is Map) {
        final actionMap = Map<String, dynamic>.from(actions);
        for (final a in actionMap.entries) {
          if (_truthyPermissionValue(a.value)) {
            out.add('$module.${a.key}');
          }
        }
      } else if (actions is List) {
        for (final el in actions) {
          if (el is String) {
            out.add('$module.$el');
          }
        }
      }
    }
  }
}

String _normalizedRoleKey(String? name) {
  if (name == null || name.isEmpty) return '';
  return name.trim().toLowerCase().replaceAll(RegExp(r'[\s-]+'), '_');
}

bool _isFullAccessRole(String roleDisplayName) {
  final key = _normalizedRoleKey(roleDisplayName);
  if (key == 'owner' ||
      key == 'admin' ||
      key == 'administrator' ||
      key == 'master_admin' ||
      key == 'masteradmin' ||
      key == 'super_admin' ||
      key == 'superadmin') {
    return true;
  }
  return false;
}

bool _isFinanceRole(String roleDisplayName, String nameUpper) {
  final key = _normalizedRoleKey(roleDisplayName);
  return nameUpper.contains('FINANCE') || key.contains('finance');
}

/// Roles that should get the default POS bundle when the parsed permission set is empty
/// (legacy DB rows, odd JSON, or membership role names like "Sales Assistant").
bool _shouldApplySalesDefaultWhenEmpty(String roleDisplayName) {
  final nameUpper = roleDisplayName.toUpperCase();
  if (nameUpper == 'MASTER_ADMIN') return false;
  if (_isFullAccessRole(roleDisplayName)) return false;
  if (_isFinanceRole(roleDisplayName, nameUpper)) return false;

  final key = _normalizedRoleKey(roleDisplayName);
  if (key.isEmpty) return false;

  const exact = {
    'sales',
    'cashier',
    'pos',
    'clerk',
    'retail',
    'shop',
    'salesperson',
    'sales_person',
    'sales_representative',
    'sales_rep',
    'sales_executive',
    'point_of_sale',
  };
  if (exact.contains(key)) return true;
  if (key.startsWith('sales')) return true;
  if (key.contains('cashier')) return true;
  return false;
}

Set<String> _defaultSalesBundle() => {
      'sales.view',
      'sales.create',
      'sales.update',
      'sales.void',
      'sales.refund',
      'sales.export',
    };

/// Flattens API `/api/auth/me` JSON: `role.permissions` is nested maps, not a string list.
Set<String> parsePermissionsFromMeResponse(Map<String, dynamic> data) {
  final roleRaw = data['role'];
  if (roleRaw is! Map) return {};
  final role = Map<String, dynamic>.from(roleRaw);

  final name = (role['name'] ?? '').toString().toUpperCase();
  if (name == 'MASTER_ADMIN') {
    return {...fullPermissionSet, '*', 'all'};
  }

  final roleDisplayName = (role['name'] ?? '').toString();
  final out = <String>{};
  _flattenPermissionsDynamic(role['permissions'], out);

  if (_shouldApplySalesDefaultWhenEmpty(roleDisplayName)) {
    if (out.isEmpty) {
      return _defaultSalesBundle();
    }
  }

  return out;
}
