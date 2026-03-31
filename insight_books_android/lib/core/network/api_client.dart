import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/storage/app_preferences_clear.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';

const String apiBaseUrl = 'https://development.insightbooksafrica.com';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 60),
      sendTimeout: const Duration(seconds: 60),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    ),
  );

  dio.interceptors.add(AuthInterceptor(ref));

  if (kDebugMode) {
    dio.interceptors.add(LogInterceptor(
      requestBody: true,
      responseBody: false,
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
      final token = await storageService.getToken();
      final cookie = await storageService.getCookie();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      if (cookie != null) {
        options.headers['Cookie'] = cookie;
      }
    } catch (_) {}
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401 && !_loggingOut) {
      _loggingOut = true;
      try {
        await ref.read(storageServiceProvider).clearAuth();
        await clearSharedPreferencesExceptTheme();
        ref.read(authStateProvider.notifier).forceLogout();
      } catch (_) {
      } finally {
        _loggingOut = false;
      }
    }
    handler.next(err);
  }
}
