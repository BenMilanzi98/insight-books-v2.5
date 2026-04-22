import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/update/mobile_device_id.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _versionCheckThrottleKey = 'insightbooks_telemetry_version_check_ms';

Dio? _telemetryDio;

Dio _telemetryClient() {
  return _telemetryDio ??= Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: const {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );
}

Future<void> postMobileAppTelemetry({
  required String deviceId,
  required String eventType,
  required int versionCode,
  String? versionName,
  int? targetVersionCode,
  int? bytesReceived,
  int? bytesTotal,
  String? error,
}) async {
  try {
    final body = <String, dynamic>{
      'deviceId': deviceId,
      'eventType': eventType,
      'versionCode': versionCode,
    };
    if (versionName != null && versionName.isNotEmpty) {
      body['versionName'] = versionName;
    }
    if (targetVersionCode != null) body['targetVersionCode'] = targetVersionCode;
    if (bytesReceived != null) body['bytesReceived'] = bytesReceived;
    if (bytesTotal != null) body['bytesTotal'] = bytesTotal;
    if (error != null && error.isNotEmpty) body['error'] = error;

    await _telemetryClient().post<Map<String, dynamic>>(
      '/api/mobile-app/telemetry',
      data: body,
    );
  } catch (_) {}
}

/// At most one `version_check` event per device per wall-clock hour (reduces noise).
Future<void> maybeEmitVersionCheckTelemetry(
  Ref ref, {
  required int versionCode,
  required String versionName,
  int? targetVersionCode,
}) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final last = prefs.getInt(_versionCheckThrottleKey) ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - last < const Duration(hours: 1).inMilliseconds) return;

    final deviceId = await ref.read(mobileDeviceIdProvider.future);
    await postMobileAppTelemetry(
      deviceId: deviceId,
      eventType: 'version_check',
      versionCode: versionCode,
      versionName: versionName,
      targetVersionCode: targetVersionCode,
    );
    await prefs.setInt(_versionCheckThrottleKey, now);
  } catch (_) {}
}
