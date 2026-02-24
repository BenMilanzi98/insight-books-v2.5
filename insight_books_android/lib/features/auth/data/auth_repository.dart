import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final storageService = ref.watch(storageServiceProvider);
  return AuthRepository(dio, storageService);
});

class AuthRepository {
  final Dio _dio;
  final StorageService _storageService;

  AuthRepository(this._dio, this._storageService);

  Future<bool> login(String email, String password) async {
    try {
      final response = await _dio.post(
        '/api/auth/login',
        data: {'email': email, 'password': password},
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Try to handle both tokens or cookies based on the web API's implementation

        // 1. Look for token in response body
        if (response.data != null && response.data['token'] != null) {
          await _storageService.saveToken(response.data['token']);
        }

        // 2. Look for Set-Cookie header
        final List<String>? cookies = response.headers['set-cookie'];
        if (cookies != null && cookies.isNotEmpty) {
          // Find the session cookie or simply store the first one
          // E.g., next-auth.session-token
          final sessionCookieStr = cookies.firstWhere(
            (c) => c.contains('session'),
            orElse: () => cookies.first,
          );
          await _storageService.saveCookie(sessionCookieStr.split(';').first);
        }

        return true;
      }
      return false;
    } catch (e) {
      // Typically, DioException handled here
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post('/api/auth/logout');
    } finally {
      await _storageService.clearAuth();
    }
  }

  Future<bool> isAuthenticated() async {
    final token = await _storageService.getToken();
    final cookie = await _storageService.getCookie();
    return token != null || cookie != null;
  }
}
