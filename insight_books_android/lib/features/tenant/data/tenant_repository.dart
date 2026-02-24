import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../domain/tenant_models.dart';

final tenantRepositoryProvider = Provider<TenantRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return TenantRepository(dio);
});

class TenantRepository {
  final Dio _dio;

  TenantRepository(this._dio);

  Future<Map<String, dynamic>> fetchTenants() async {
    try {
      final response = await _dio.get('/api/tenant/list');
      return response.data;
    } catch (e) {
      rethrow;
    }
  }

  Future<void> switchTenant(String tenantId) async {
    try {
      await _dio.post('/api/tenant/switch', data: {'tenantId': tenantId});
    } catch (e) {
      rethrow;
    }
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
