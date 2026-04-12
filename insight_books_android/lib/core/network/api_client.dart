import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/storage/app_preferences_clear.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';

const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://development.insightbooksafrica.com',
);

/// True when the app is pointed at the development server (default or explicit).
bool get isDevEnvironment => apiBaseUrl.contains('development.');

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    ),
  );

  dio.interceptors.add(AuthInterceptor(ref));
  dio.interceptors.add(RetryInterceptor(dio));

  if (kDebugMode) {
    dio.interceptors.add(LogInterceptor(
      requestBody: false,
      responseBody: false,
      requestHeader: false,
      responseHeader: false,
      logPrint: (o) => debugPrint('[DIO] $o'),
    ));
  }

  return dio;
});

class AuthInterceptor extends QueuedInterceptor {
  final Ref ref;
  bool _loggingOut = false;

  AuthInterceptor(this.ref);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    try {
      final storageService = ref.read(storageServiceProvider);
      final token = storageService.tokenSync ?? await storageService.getToken();
      final cookie =
          storageService.cookieSync ?? await storageService.getCookie();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      if (cookie != null) {
        options.headers['Cookie'] = cookie;
      }
    } catch (e) {
      debugPrint('[AuthInterceptor] Failed to attach credentials: $e');
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401 && !_loggingOut) {
      final authNotifier = ref.read(authStateProvider.notifier);
      if (authNotifier.loginInProgress) {
        handler.next(err);
        return;
      }
      _loggingOut = true;
      try {
        await ref.read(storageServiceProvider).clearAuth();
        await clearSharedPreferencesExceptTheme();
        authNotifier.forceLogout();
      } catch (e) {
        debugPrint('[AuthInterceptor] Logout cleanup failed: $e');
      } finally {
        _loggingOut = false;
      }
    }
    handler.next(err);
  }
}

/// Retries idempotent requests on transient network failures.
class RetryInterceptor extends Interceptor {
  final Dio _dio;
  static const _maxRetries = 2;
  static const _retryableStatuses = {502, 503, 504};

  RetryInterceptor(this._dio);

  bool _shouldRetry(DioException err) {
    if (err.requestOptions.method.toUpperCase() == 'POST') return false;
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.connectionError) {
      return true;
    }
    if (err.error is SocketException) return true;
    if (err.response != null &&
        _retryableStatuses.contains(err.response!.statusCode)) {
      return true;
    }
    return false;
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final extra = err.requestOptions.extra;
    final attempt = (extra['_retryCount'] as int?) ?? 0;

    if (attempt < _maxRetries && _shouldRetry(err)) {
      final delay = Duration(milliseconds: 500 * (attempt + 1));
      await Future<void>.delayed(delay);
      err.requestOptions.extra['_retryCount'] = attempt + 1;
      try {
        final response = await _dio.fetch(err.requestOptions);
        handler.resolve(response);
        return;
      } on DioException catch (e) {
        handler.next(e);
        return;
      }
    }
    handler.next(err);
  }
}
