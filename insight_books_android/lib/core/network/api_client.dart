import 'package:dio/dio.dart';
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

  // Add Auth Interceptor
  dio.interceptors.add(AuthInterceptor(ref));

  // Add logging interceptor for development
  dio.interceptors.add(LogInterceptor(requestBody: true, responseBody: true));

  return dio;
});

class AuthInterceptor extends Interceptor {
  final Ref ref;

  AuthInterceptor(this.ref);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final storageService = ref.read(storageServiceProvider);

    // We send both token and cookie (whichever is retrieved successfully from login)
    // The web API might rely on the `cookie` header.
    final token = await storageService.getToken();
    final cookie = await storageService.getCookie();

    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    if (cookie != null) {
      options.headers['Cookie'] = cookie;
    }

    super.onRequest(options, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Handle Unauthorized (Token expired, etc.)
      final storageService = ref.read(storageServiceProvider);
      await storageService.clearAuth();

      // Trigger a redirect to login here via Riverpod
      ref.read(authStateProvider.notifier).forceLogout();
    }
    super.onError(err, handler);
  }
}
