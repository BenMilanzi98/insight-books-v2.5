import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/security/permission_parser.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';

/// Effective permissions from `/api/auth/me` (flattened `role.permissions`).
/// Refreshes when [authStateProvider] becomes authenticated.
/// Reuses the cached /api/auth/me response from session validation to avoid
/// a duplicate network call on startup.
final userPermissionsProvider = FutureProvider<Set<String>>((ref) async {
  // While auth is [loading] (e.g. mid-login), [auth.value] is null — do not treat
  // that as "logged out" or we emit {} and the router sends users to /access-denied
  // before /api/auth/me runs with the new token.
  var auth = ref.watch(authStateProvider);
  for (var i = 0; i < 500 && auth.isLoading; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 20));
    auth = ref.read(authStateProvider);
  }
  final authed = auth.maybeWhen(
    data: (v) => v == true,
    orElse: () => false,
  );
  if (!authed) {
    return {};
  }

  try {
    final storage = ref.read(storageServiceProvider);
    final cached = storage.cachedMeData;
    if (cached != null) {
      storage.clearMeData();
      return parsePermissionsFromMeResponse(cached);
    }

    final dio = ref.watch(dioProvider);
    Object? lastError;
    for (var attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        await Future<void>.delayed(Duration(milliseconds: 120 * attempt));
      }
      try {
        final response = await dio.get('/api/auth/me');
        final data = response.data;
        if (data is! Map) return {};
        return parsePermissionsFromMeResponse(
          Map<String, dynamic>.from(data),
        );
      } catch (e) {
        lastError = e;
        debugPrint('[Permissions] /api/auth/me attempt ${attempt + 1}: $e');
      }
    }
    debugPrint('[Permissions] Failed after retries: $lastError');
    return {};
  } catch (e) {
    debugPrint('[Permissions] Failed to load /api/auth/me: $e');
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
