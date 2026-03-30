import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final dio = ref.watch(dioProvider);
  final storageService = ref.watch(storageServiceProvider);
  return AuthRepository(dio, storageService);
});

/// Result of a login attempt — success only when credentials are valid and a session was stored.
class LoginResult {
  final bool success;
  final String? message;

  const LoginResult({required this.success, this.message});
}

class AuthRepository {
  final Dio _dio;
  final StorageService _storageService;

  AuthRepository(this._dio, this._storageService);

  Future<LoginResult> login(String email, String password) async {
    try {
      final response = await _dio.post(
        '/api/auth/login',
        data: {'email': email, 'password': password},
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        await _storageService.clearAuth();
        return LoginResult(
          success: false,
          message: _messageFromResponseData(response.data),
        );
      }

      final data = response.data;
      if (data is! Map) {
        await _storageService.clearAuth();
        return const LoginResult(
          success: false,
          message: 'Unexpected response from server.',
        );
      }

      if (data['success'] == false) {
        await _storageService.clearAuth();
        return LoginResult(
          success: false,
          message: _messageFromMap(data) ?? 'Login failed.',
        );
      }

      final user = data['user'];
      if (user is Map && user['isEmailVerified'] == false) {
        await _storageService.clearAuth();
        return const LoginResult(
          success: false,
          message: 'Please verify your email before signing in.',
        );
      }

      var savedSomething = false;

      final token = data['token'];
      if (token != null && token.toString().isNotEmpty) {
        await _storageService.saveToken(token.toString());
        savedSomething = true;
      }

      final cookies = response.headers['set-cookie'];
      if (cookies != null && cookies.isNotEmpty) {
        final sessionCookieStr = cookies.firstWhere(
          (c) => c.contains('session'),
          orElse: () => cookies.first,
        );
        await _storageService.saveCookie(sessionCookieStr.split(';').first);
        savedSomething = true;
      }

      if (!savedSomething) {
        await _storageService.clearAuth();
        return const LoginResult(
          success: false,
          message: 'Login did not complete. Please try again.',
        );
      }

      return const LoginResult(success: true);
    } on DioException catch (e) {
      await _storageService.clearAuth();
      return LoginResult(
        success: false,
        message: _messageFromDio(e),
      );
    } catch (e) {
      await _storageService.clearAuth();
      return LoginResult(
        success: false,
        message: e.toString(),
      );
    }
  }

  static String? _messageFromResponseData(dynamic data) {
    if (data is Map && data['error'] != null) {
      return data['error'].toString();
    }
    return null;
  }

  static String? _messageFromMap(Map<dynamic, dynamic> data) {
    final err = data['error'];
    if (err != null) return err.toString();
    return null;
  }

  static String _messageFromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] != null) {
      return data['error'].toString();
    }
    if (e.message != null && e.message!.isNotEmpty) {
      return e.message!;
    }
    return 'Login failed. Please check your credentials.';
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
