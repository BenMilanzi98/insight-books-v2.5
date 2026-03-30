import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';

// Update this to match the production domain later
const String apiBaseUrl = 'https://development.insightbooksafrica.com';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    ),
  );

  dio.interceptors.add(AuthInterceptor(ref));

  if (kDebugMode) {
    dio.interceptors.add(LogInterceptor(requestBody: true, responseBody: true));
  }

  return dio;
});

class AuthInterceptor extends QueuedInterceptor {
  final Ref ref;

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
    } catch (_) {
      // Still send request; server may return 401
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      ref.read(storageServiceProvider).clearAuth().then((_) {
        ref.read(authStateProvider.notifier).forceLogout();
      });
    }
    handler.next(err);
  }
}
