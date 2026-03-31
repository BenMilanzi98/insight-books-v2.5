import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/storage/app_preferences_clear.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';

/// Collects all [Set-Cookie] header lines (Dio may expose multiple values).
List<String> _collectSetCookieLines(Headers headers) {
  final out = <String>[];
  headers.forEach((name, values) {
    if (name.toLowerCase() == 'set-cookie') {
      out.addAll(values);
    }
  });
  return out;
}

/// Extracts `session=...` (value only, before first `;`) from a Set-Cookie line.
String? _sessionCookiePair(String line) {
  final trimmed = line.trim();
  if (!trimmed.toLowerCase().startsWith('session=')) return null;
  final rest = trimmed.substring('session='.length);
  final semi = rest.indexOf(';');
  final value = semi >= 0 ? rest.substring(0, semi) : rest;
  if (value.isEmpty) return null;
  return 'session=$value';
}

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

      var savedSomething = false;

      final token = data['token'];
      if (token != null && token.toString().isNotEmpty) {
        await _storageService.saveToken(token.toString());
        savedSomething = true;
      }

      final setCookieLines = _collectSetCookieLines(response.headers);
      for (final line in setCookieLines) {
        final pair = _sessionCookiePair(line);
        if (pair != null) {
          await _storageService.saveCookie(pair);
          savedSomething = true;
          break;
        }
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
    } catch (_) {
      // Still wipe local session if the server call fails.
    } finally {
      await _storageService.clearAuth();
      await clearSharedPreferencesExceptTheme();
    }
  }

  Future<bool> isAuthenticated() async {
    final token = await _storageService.getToken();
    final cookie = await _storageService.getCookie();
    return token != null || cookie != null;
  }

  /// Confirms stored credentials with the server. Clears storage on 401.
  /// On network failure, returns true if credentials exist (offline-friendly).
  Future<bool> validateSession() async {
    final token = await _storageService.getToken();
    final cookie = await _storageService.getCookie();
    if (token == null && cookie == null) return false;

    try {
      final response = await _dio.get('/api/auth/me');
      return response.statusCode == 200;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await _storageService.clearAuth();
        await clearSharedPreferencesExceptTheme();
        return false;
      }
      if (e.response == null) {
        return true;
      }
      return true;
    } catch (_) {
      return true;
    }
  }
}
