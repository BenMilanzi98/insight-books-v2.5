import 'dart:io';
import 'package:dio/dio.dart';

class NetworkErrorMapper {
  static const String internetConnectionMessage =
      'No internet connection. Please check your network and try again.';

  static const String serverErrorMessage =
      'Server is temporarily unavailable. Please try again shortly.';

  static const String timeoutMessage =
      'Request timed out. Please check your connection and try again.';

  static bool isConnectionError(Object error) {
    if (error is SocketException) return true;
    if (error is DioException) {
      return error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.unknown ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout;
    }
    final msg = error.toString().toLowerCase();
    return msg.contains('socket') ||
        msg.contains('network') ||
        msg.contains('timeout') ||
        msg.contains('failed to connect') ||
        msg.contains('connection refused') ||
        msg.contains('dns') ||
        msg.contains('host lookup');
  }

  static bool isTimeout(Object error) {
    if (error is DioException) {
      return error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout;
    }
    return false;
  }

  static bool isServerError(Object error) {
    if (error is DioException && error.response != null) {
      final code = error.response!.statusCode ?? 0;
      return code >= 500 && code < 600;
    }
    return false;
  }

  static String toUserMessage(Object error, {String? fallback}) {
    if (isTimeout(error)) return timeoutMessage;
    if (isServerError(error)) return serverErrorMessage;
    if (isConnectionError(error)) return internetConnectionMessage;
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map) {
        final details = data['details'];
        if (details is Map && details['code'] == 'PERIOD_LOCKED') {
          final msg = data['error'];
          if (msg != null && msg.toString().trim().isNotEmpty) {
            return msg.toString();
          }
        }
        if (data['error'] != null) {
          return data['error'].toString();
        }
      }
      if (error.message != null && error.message!.trim().isNotEmpty) {
        return error.message!.trim();
      }
    }
    if (fallback != null && fallback.trim().isNotEmpty) return fallback.trim();
    return 'Something went wrong. Please try again.';
  }
}
