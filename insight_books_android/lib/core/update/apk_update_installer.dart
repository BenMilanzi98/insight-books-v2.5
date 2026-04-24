import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/update/mobile_app_telemetry.dart';
import 'package:insightbooks_android/core/update/mobile_device_id.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

/// Normalized download progress in the range [0, 1].
double downloadProgressRatio(int received, int total) {
  if (total <= 0) return 0;
  if (received <= 0) return 0;
  if (received >= total) return 1;
  return received / total;
}

String _dioErrorMessage(DioException e) {
  final parts = <String>[e.message ?? 'Download failed'];
  final sc = e.response?.statusCode;
  if (sc != null) parts.add('HTTP $sc');
  return parts.join(' · ');
}

enum ApkDownloadPhase {
  idle,
  queued,
  downloading,
  openingInstaller,
  error,
}

class ApkDownloadUiState {
  final ApkDownloadPhase phase;
  final double progress;
  final String? statusLabel;
  final String? errorMessage;

  const ApkDownloadUiState({
    this.phase = ApkDownloadPhase.idle,
    this.progress = 0,
    this.statusLabel,
    this.errorMessage,
  });

  ApkDownloadUiState copyWith({
    ApkDownloadPhase? phase,
    double? progress,
    String? statusLabel,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ApkDownloadUiState(
      phase: phase ?? this.phase,
      progress: progress ?? this.progress,
      statusLabel: statusLabel ?? this.statusLabel,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  static const idle = ApkDownloadUiState();
}

final apkUpdateInstallerProvider =
    NotifierProvider<ApkUpdateInstaller, ApkDownloadUiState>(
  ApkUpdateInstaller.new,
);

class ApkUpdateInstaller extends Notifier<ApkDownloadUiState> {
  Dio? _downloadDio;

  @override
  ApkDownloadUiState build() => ApkDownloadUiState.idle;

  void reset() {
    state = ApkDownloadUiState.idle;
  }

  String _resolveUrl(String url) {
    final u = url.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    final base =
        apiBaseUrl.endsWith('/') ? apiBaseUrl.substring(0, apiBaseUrl.length - 1) : apiBaseUrl;
    return u.startsWith('/') ? '$base$u' : '$base/$u';
  }

  void _emitTelemetry(
    String eventType, {
    required int versionCode,
    required String versionName,
    int? targetVersionCode,
    int? bytesReceived,
    int? bytesTotal,
    String? error,
  }) {
    unawaited(() async {
      try {
        final deviceId = await ref.read(mobileDeviceIdProvider.future);
        await postMobileAppTelemetry(
          deviceId: deviceId,
          eventType: eventType,
          versionCode: versionCode,
          versionName: versionName,
          targetVersionCode: targetVersionCode,
          bytesReceived: bytesReceived,
          bytesTotal: bytesTotal,
          error: error,
        );
      } catch (_) {}
    }());
  }

  Future<void> downloadAndInstall({
    required String apkUrl,
    required int versionCode,
    required String versionName,
    int? targetVersionCode,
  }) async {
    if (state.phase == ApkDownloadPhase.downloading ||
        state.phase == ApkDownloadPhase.openingInstaller ||
        state.phase == ApkDownloadPhase.queued) {
      return;
    }

    final resolved = _resolveUrl(apkUrl);
    // Do not use a separate "queued" phase before network work — awaiting telemetry
    // or device id here left the UI stuck on "Queued" while the download had not started.
    state = const ApkDownloadUiState(
      phase: ApkDownloadPhase.downloading,
      progress: 0,
      statusLabel: 'Preparing download',
    );

    _emitTelemetry(
      'download_started',
      versionCode: versionCode,
      versionName: versionName,
      targetVersionCode: targetVersionCode,
    );

    File? outFile;
    try {
      final dir = await getTemporaryDirectory();
      outFile = File('${dir.path}/insightbooks-update.apk');
      if (await outFile.exists()) {
        await outFile.delete();
      }

      state = state.copyWith(
        progress: 0,
        statusLabel: 'Downloading',
        clearError: true,
      );

      _downloadDio ??= Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 45),
          receiveTimeout: const Duration(minutes: 30),
          followRedirects: true,
          headers: {
            HttpHeaders.userAgentHeader:
                'InsightBooks-Android/$versionName (build $versionCode)',
          },
        ),
      );

      await _downloadDio!.download(
        resolved,
        outFile.path,
        deleteOnError: true,
        onReceiveProgress: (received, total) {
          if (total > 0) {
            state = state.copyWith(
              progress: downloadProgressRatio(received.toInt(), total.toInt()),
              statusLabel: 'Downloading',
            );
          } else if (received > 0) {
            final mb = received / (1024 * 1024);
            state = state.copyWith(
              progress: 0,
              statusLabel: 'Downloading ${mb.toStringAsFixed(1)} MB…',
            );
          }
        },
      );

      final len = await outFile.length();
      _emitTelemetry(
        'download_completed',
        versionCode: versionCode,
        versionName: versionName,
        targetVersionCode: targetVersionCode,
        bytesReceived: len,
        bytesTotal: len,
      );

      state = state.copyWith(
        phase: ApkDownloadPhase.openingInstaller,
        progress: 1,
        statusLabel: 'Opening installer',
      );

      final open = await OpenFilex.open(outFile.path);
      if (open.type == ResultType.done) {
        _emitTelemetry(
          'install_prompted',
          versionCode: versionCode,
          versionName: versionName,
          targetVersionCode: targetVersionCode,
        );
        state = const ApkDownloadUiState(
          phase: ApkDownloadPhase.idle,
          progress: 1,
          statusLabel: 'Install prompted — complete update in the system screen',
        );
      } else {
        final msg = open.message.isNotEmpty ? open.message : 'Could not open installer';
        _emitTelemetry(
          'install_failed',
          versionCode: versionCode,
          versionName: versionName,
          targetVersionCode: targetVersionCode,
          error: msg,
        );
        state = ApkDownloadUiState(
          phase: ApkDownloadPhase.error,
          progress: state.progress,
          statusLabel: 'Error',
          errorMessage: msg,
        );
      }
    } catch (e, st) {
      final msg = e is DioException ? _dioErrorMessage(e) : e.toString();
      _emitTelemetry(
        'download_failed',
        versionCode: versionCode,
        versionName: versionName,
        targetVersionCode: targetVersionCode,
        error: msg,
      );
      debugPrint('[ApkUpdateInstaller] $e\n$st');
      state = ApkDownloadUiState(
        phase: ApkDownloadPhase.error,
        progress: state.progress,
        statusLabel: 'Error',
        errorMessage: msg,
      );
    }
  }
}
