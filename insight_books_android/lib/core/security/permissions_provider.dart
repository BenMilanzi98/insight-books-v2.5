import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';

final userPermissionsProvider = FutureProvider<Set<String>>((ref) async {
  try {
    final dio = ref.watch(dioProvider);
    final response = await dio.get('/api/auth/me');
    final data = response.data;
    final user = data is Map ? (data['user'] ?? data) : data;
    final raw = user is Map ? (user['permissions'] ?? const []) : const [];
    final permissions = <String>{};
    if (raw is List) {
      for (final p in raw) {
        if (p != null) permissions.add(p.toString());
      }
    }
    return permissions;
  } catch (_) {
    return <String>{};
  }
});

bool hasPermission(Set<String> permissions, String requiredPermission) {
  if (permissions.isEmpty) return true;
  if (permissions.contains('all') || permissions.contains('*')) return true;
  return permissions.contains(requiredPermission);
}
