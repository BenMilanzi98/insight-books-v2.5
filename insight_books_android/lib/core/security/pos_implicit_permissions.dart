/// Mirrors web [lib/posPermissions.js] — sales.* grants supporting read/write for POS workflows.
const _salesPrefix = 'sales.';

const _implicitRead = <String>{
  'clients.view',
  'inventory.view',
  'tax.view',
  'payments.view',
  'settings.view',
  'system.view',
  'system.switchTenant',
  'tenants.switch',
};

const _implicitBySalesAction = <String, Set<String>>{
  'view': {},
  'create': {'clients.create', 'clients.update'},
  'update': {'clients.update'},
  'void': {},
  'refund': {},
  'export': {},
  'delete': {},
};

bool hasAnySalesPermission(Set<String> permissions) {
  for (final p in permissions) {
    if (p.startsWith(_salesPrefix)) return true;
  }
  return false;
}

Set<String> _salesActions(Set<String> permissions) {
  final actions = <String>{};
  for (final p in permissions) {
    if (!p.startsWith(_salesPrefix)) continue;
    final action = p.substring(_salesPrefix.length);
    if (action.isNotEmpty) actions.add(action);
  }
  return actions;
}

Set<String> getPosImplicitPermissions(Set<String> permissions) {
  if (!hasAnySalesPermission(permissions)) return {};
  final implicit = {..._implicitRead};
  for (final action in _salesActions(permissions)) {
    implicit.addAll(_implicitBySalesAction[action] ?? const {});
  }
  return implicit;
}

List<String> _permissionAliases(String permission) {
  final keys = <String>[permission];
  if (permission.startsWith('stock.')) {
    keys.add('inventory.${permission.substring(6)}');
  }
  if (permission.startsWith('inventory.')) {
    keys.add('stock.${permission.substring(10)}');
  }
  if (permission == 'tenants.switch') {
    keys.add('system.switchTenant');
  }
  if (permission == 'system.switchTenant') {
    keys.add('tenants.switch');
  }
  return keys;
}

bool posGrantsPermission(Set<String> permissions, String requestedPermission) {
  if (!hasAnySalesPermission(permissions)) return false;
  final implicit = getPosImplicitPermissions(permissions);
  for (final candidate in _permissionAliases(requestedPermission)) {
    if (implicit.contains(candidate)) return true;
  }
  return false;
}
