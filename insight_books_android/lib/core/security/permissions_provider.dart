import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/security/permission_parser.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';

/// Effective permissions from `/api/auth/me` (flattened `role.permissions`).
/// Refreshes when [authStateProvider] becomes authenticated.
final userPermissionsProvider = FutureProvider<Set<String>>((ref) async {
  final auth = ref.watch(authStateProvider);
  if (auth.value != true) {
    return {};
  }

  try {
    final dio = ref.watch(dioProvider);
    final response = await dio.get('/api/auth/me');
    final data = response.data;
    if (data is! Map) return {};
    return parsePermissionsFromMeResponse(Map<String, dynamic>.from(data));
  } catch (_) {
    return {};
  }
});

bool hasPermission(Set<String> permissions, String requiredPermission) {
  if (permissions.contains('*') || permissions.contains('all')) return true;
  if (permissions.isEmpty) return false;
  return permissions.contains(requiredPermission);
}

/// Stored roles use `inventory.*`; newer UI checks may use `stock.*`. Treat as equivalent (no DB change).
bool satisfiesPermission(Set<String> permissions, String requiredPermission) {
  if (hasPermission(permissions, requiredPermission)) return true;
  if (requiredPermission.startsWith('stock.')) {
    final legacy = 'inventory.${requiredPermission.substring(6)}';
    if (hasPermission(permissions, legacy)) return true;
  }
  if (requiredPermission.startsWith('inventory.')) {
    final modern = 'stock.${requiredPermission.substring(10)}';
    if (hasPermission(permissions, modern)) return true;
  }
  return false;
}
