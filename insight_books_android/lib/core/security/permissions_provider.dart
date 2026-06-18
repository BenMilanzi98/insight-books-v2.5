import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permission_parser.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';
import 'package:insightbooks_android/core/security/pos_implicit_permissions.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';

/// Last user-facing reason `/api/auth/me` could not populate permissions (shown on `/access-denied`).
final permissionProfileLoadHintProvider =
    NotifierProvider<PermissionProfileLoadHintNotifier, String?>(
  PermissionProfileLoadHintNotifier.new,
);

class PermissionProfileLoadHintNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void clear() => state = null;

  void setHint(String? value) => state = value;
}

/// True when the last failed profile load looked like a connectivity issue.
final permissionProfileLoadWasConnectionIssueProvider =
    NotifierProvider<PermissionProfileLoadWasConnectionNotifier, bool>(
  PermissionProfileLoadWasConnectionNotifier.new,
);

class PermissionProfileLoadWasConnectionNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void clear() => state = false;

  void setValue(bool value) => state = value;
}

void _clearProfileLoadDiagnostics(Ref ref) {
  ref.read(permissionProfileLoadHintProvider.notifier).clear();
  ref.read(permissionProfileLoadWasConnectionIssueProvider.notifier).clear();
}

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
    _clearProfileLoadDiagnostics(ref);
    return {};
  }

  _clearProfileLoadDiagnostics(ref);

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
        if (data is! Map) {
          ref.read(permissionProfileLoadHintProvider.notifier).setHint(
                'The server returned an unexpected response when loading your profile. '
                'Try again in a moment or sign out and log in again.',
              );
          ref.read(permissionProfileLoadWasConnectionIssueProvider.notifier).setValue(false);
          return {};
        }
        return parsePermissionsFromMeResponse(
          Map<String, dynamic>.from(data),
        );
      } catch (e) {
        lastError = e;
        debugPrint('[Permissions] /api/auth/me attempt ${attempt + 1}: $e');
      }
    }
    debugPrint('[Permissions] Failed after retries: $lastError');
    if (lastError != null) {
      ref.read(permissionProfileLoadWasConnectionIssueProvider.notifier).setValue(
            NetworkErrorMapper.isConnectionError(lastError),
          );
      ref.read(permissionProfileLoadHintProvider.notifier).setHint(
            NetworkErrorMapper.toUserMessage(
              lastError,
              fallback: 'Could not load your permissions. Please try again.',
            ),
          );
    }
    return {};
  } catch (e) {
    debugPrint('[Permissions] Failed to load /api/auth/me: $e');
    ref.read(permissionProfileLoadWasConnectionIssueProvider.notifier).setValue(
          NetworkErrorMapper.isConnectionError(e),
        );
    ref.read(permissionProfileLoadHintProvider.notifier).setHint(
          NetworkErrorMapper.toUserMessage(
            e,
            fallback: 'Could not load your permissions. Please try again.',
          ),
        );
    return {};
  }
});

bool hasPermission(Set<String> permissions, String requiredPermission) {
  if (permissions.contains('*') || permissions.contains('all')) return true;
  if (permissions.isEmpty) return false;
  return permissions.contains(requiredPermission);
}

/// Stored roles use `inventory.*`; newer UI checks may use `stock.*`. Treat as equivalent (no DB change).
/// Anyone with `sales.*` implicitly gets supporting POS permissions (mirrors web posPermissions.js).
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
  if (posGrantsPermission(permissions, requiredPermission)) return true;
  return false;
}
