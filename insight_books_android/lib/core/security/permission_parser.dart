/// Mirrors web [permissionModules] — flatten nested role.permissions to "module.action" strings.
const Map<String, List<String>> _kPermissionModules = {
  'dashboard': ['view'],
  'users': ['create', 'view', 'update', 'delete', 'export'],
  'roles': ['create', 'view', 'update', 'delete', 'assign'],
  'system': ['view', 'update'],
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
  final raw = role['permissions'];
  final out = <String>{};
  if (raw is Map) {
    final rawMap = Map<String, dynamic>.from(raw);
    for (final moduleEntry in rawMap.entries) {
      final module = moduleEntry.key.toString();
      final actions = moduleEntry.value;
      if (actions is Map) {
        final actionMap = Map<String, dynamic>.from(actions);
        for (final a in actionMap.entries) {
          if (a.value == true) {
            out.add('$module.${a.key}');
          }
        }
      }
    }
  }

  // Sales / cashier roles: if permissions are missing or empty, POS + client lookup only.
  if (out.isEmpty && _isSalesOnlyRole(roleDisplayName, name)) {
    return {
      'sales.view',
      'sales.create',
      'sales.update',
      'clients.view',
    };
  }

  return out;
}

bool _isSalesOnlyRole(String displayName, String nameUpper) {
  if (nameUpper == 'MASTER_ADMIN' ||
      nameUpper == 'ADMIN' ||
      nameUpper.contains('FINANCE')) {
    return false;
  }
  final n = displayName.trim().toLowerCase();
  if (n == 'cashier' || n == 'pos') return true;
  if (n == 'sales' || n.startsWith('sales ')) return true;
  return false;
}
