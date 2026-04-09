import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/core/network/network_error_mapper.dart';

void main() {
  group('NetworkErrorMapper', () {
    group('isConnectionError', () {
      test('returns true for SocketException', () {
        expect(
          NetworkErrorMapper.isConnectionError(
              const SocketException('No route')),
          isTrue,
        );
      });

      test('returns true for DioException connectionTimeout', () {
        final err = DioException(
          type: DioExceptionType.connectionTimeout,
          requestOptions: RequestOptions(path: '/test'),
        );
        expect(NetworkErrorMapper.isConnectionError(err), isTrue);
      });

      test('returns true for DioException connectionError', () {
        final err = DioException(
          type: DioExceptionType.connectionError,
          requestOptions: RequestOptions(path: '/test'),
        );
        expect(NetworkErrorMapper.isConnectionError(err), isTrue);
      });

      test('returns false for regular Exception', () {
        expect(
          NetworkErrorMapper.isConnectionError(Exception('something')),
          isFalse,
        );
      });
    });

    group('isTimeout', () {
      test('returns true for receiveTimeout', () {
        final err = DioException(
          type: DioExceptionType.receiveTimeout,
          requestOptions: RequestOptions(path: '/test'),
        );
        expect(NetworkErrorMapper.isTimeout(err), isTrue);
      });

      test('returns false for badResponse', () {
        final err = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: RequestOptions(path: '/test'),
        );
        expect(NetworkErrorMapper.isTimeout(err), isFalse);
      });
    });

    group('isServerError', () {
      test('returns true for 500', () {
        final err = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: RequestOptions(path: '/test'),
          response: Response(
            statusCode: 500,
            requestOptions: RequestOptions(path: '/test'),
          ),
        );
        expect(NetworkErrorMapper.isServerError(err), isTrue);
      });

      test('returns false for 404', () {
        final err = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: RequestOptions(path: '/test'),
          response: Response(
            statusCode: 404,
            requestOptions: RequestOptions(path: '/test'),
          ),
        );
        expect(NetworkErrorMapper.isServerError(err), isFalse);
      });
    });

    group('toUserMessage', () {
      test('returns timeout message for timeout errors', () {
        final err = DioException(
          type: DioExceptionType.connectionTimeout,
          requestOptions: RequestOptions(path: '/test'),
        );
        expect(
          NetworkErrorMapper.toUserMessage(err),
          NetworkErrorMapper.timeoutMessage,
        );
      });

      test('returns server message for 503', () {
        final err = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: RequestOptions(path: '/test'),
          response: Response(
            statusCode: 503,
            requestOptions: RequestOptions(path: '/test'),
          ),
        );
        expect(
          NetworkErrorMapper.toUserMessage(err),
          NetworkErrorMapper.serverErrorMessage,
        );
      });

      test('extracts error field from response data', () {
        final err = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: RequestOptions(path: '/test'),
          response: Response(
            statusCode: 400,
            data: {'error': 'Invalid email'},
            requestOptions: RequestOptions(path: '/test'),
          ),
        );
        expect(NetworkErrorMapper.toUserMessage(err), 'Invalid email');
      });

      test('uses fallback when no useful info', () {
        expect(
          NetworkErrorMapper.toUserMessage(
            Exception('?'),
            fallback: 'Custom fallback',
          ),
          'Custom fallback',
        );
      });

      test('uses generic message when no fallback', () {
        expect(
          NetworkErrorMapper.toUserMessage(Exception('?')),
          'Something went wrong. Please try again.',
        );
      });
    });
  });
}
