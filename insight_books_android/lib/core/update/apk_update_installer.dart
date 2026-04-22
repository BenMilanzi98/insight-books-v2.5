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

  Future<void> downloadAndInstall({
    required String apkUrl,
    required int versionCode,
    required String versionName,
    int? targetVersionCode,
  }) async {
    if (state.phase == ApkDownloadPhase.downloading ||
        state.phase == ApkDownloadPhase.openingInstaller) {
      return;
    }

    final resolved = _resolveUrl(apkUrl);
    state = const ApkDownloadUiState(
      phase: ApkDownloadPhase.queued,
      progress: 0,
      statusLabel: 'Queued',
    );

    final deviceId = await ref.read(mobileDeviceIdProvider.future);
    Future<void> tel(String type, {String? err, int? br, int? bt}) => postMobileAppTelemetry(
          deviceId: deviceId,
          eventType: type,
          versionCode: versionCode,
          versionName: versionName,
          targetVersionCode: targetVersionCode,
          bytesReceived: br,
          bytesTotal: bt,
          error: err,
        );

    await tel('download_started');

    File? outFile;
    try {
      final dir = await getTemporaryDirectory();
      outFile = File('${dir.path}/insightbooks-update.apk');
      if (await outFile.exists()) {
        await outFile.delete();
      }

      state = state.copyWith(
        phase: ApkDownloadPhase.downloading,
        progress: 0,
        statusLabel: 'Downloading',
        clearError: true,
      );

      _downloadDio ??= Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 45),
          receiveTimeout: const Duration(minutes: 15),
          followRedirects: true,
        ),
      );

      await _downloadDio!.download(
        resolved,
        outFile.path,
        deleteOnError: true,
        onReceiveProgress: (received, total) {
          if (total <= 0) return;
          state = state.copyWith(
            progress: downloadProgressRatio(received.toInt(), total.toInt()),
            statusLabel: 'Downloading',
          );
        },
      );

      final len = await outFile.length();
      await tel('download_completed', br: len, bt: len);

      state = state.copyWith(
        phase: ApkDownloadPhase.openingInstaller,
        progress: 1,
        statusLabel: 'Opening installer',
      );

      final open = await OpenFilex.open(outFile.path);
      if (open.type == ResultType.done) {
        await tel('install_prompted');
        state = const ApkDownloadUiState(
          phase: ApkDownloadPhase.idle,
          progress: 1,
          statusLabel: 'Install prompted — complete update in the system screen',
        );
      } else {
        final msg = open.message.isNotEmpty ? open.message : 'Could not open installer';
        await tel('install_failed', err: msg);
        state = ApkDownloadUiState(
          phase: ApkDownloadPhase.error,
          progress: state.progress,
          statusLabel: 'Error',
          errorMessage: msg,
        );
      }
    } catch (e, st) {
      final msg = e is DioException
          ? (e.message ?? 'Download failed')
          : e.toString();
      await tel('download_failed', err: msg);
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
