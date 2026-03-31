import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/storage_service.dart';
import '../domain/tenant_models.dart';

final tenantRepositoryProvider = Provider<TenantRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final storage = ref.watch(storageServiceProvider);
  return TenantRepository(dio, storage);
});

class TenantRepository {
  final Dio _dio;
  final StorageService _storageService;

  TenantRepository(this._dio, this._storageService);

  Future<void> _persistSessionFromResponse(Response response) async {
    final data = response.data;
    if (data is Map && data['token'] != null) {
      final t = data['token'].toString();
      if (t.isNotEmpty) {
        await _storageService.saveToken(t);
      }
    }
    final cookies = response.headers['set-cookie'];
    if (cookies != null && cookies.isNotEmpty) {
      final sessionCookieStr = cookies.firstWhere(
        (c) => c.contains('session'),
        orElse: () => cookies.first,
      );
      await _storageService.saveCookie(sessionCookieStr.split(';').first);
    }
  }

  Future<Map<String, dynamic>> fetchTenants() async {
    try {
      final response = await _dio.get('/api/tenant/list');
      return response.data;
    } catch (e) {
      rethrow;
    }
  }

  Future<void> switchTenant(String tenantId) async {
    final response = await _dio.post(
      '/api/tenant/switch',
      data: {'tenantId': tenantId},
    );
    await _persistSessionFromResponse(response);
  }

  /// Updates session branch (same session token shape as login). [branchId] null = all branches.
  Future<void> switchBranch(String? branchId) async {
    final response = await _dio.post(
      '/api/branches/switch',
      data: {'branchId': branchId},
    );
    await _persistSessionFromResponse(response);
  }

  Future<Tenant> createTenant(String name) async {
    try {
      final response = await _dio.post('/api/tenant/add', data: {'name': name});
      return Tenant.fromJson(response.data['tenant']);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> deleteTenant(String tenantId) async {
    try {
      await _dio.post('/api/tenant/delete', data: {'tenantId': tenantId});
    } catch (e) {
      rethrow;
    }
  }
}
