import 'dart:io';
import 'package:dio/dio.dart';

class NetworkErrorMapper {
  static const String internetConnectionMessage =
      'Failed to connect to the internet, please check your internet connection.';

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

  static String toUserMessage(Object error, {String? fallback}) {
    if (isConnectionError(error)) return internetConnectionMessage;
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['error'] != null) {
        return data['error'].toString();
      }
      if (error.message != null && error.message!.trim().isNotEmpty) {
        return error.message!.trim();
      }
    }
    if (fallback != null && fallback.trim().isNotEmpty) return fallback.trim();
    return 'Something went wrong. Please try again.';
  }
}

