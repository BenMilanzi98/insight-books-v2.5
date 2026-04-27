import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/core/update/mobile_app_telemetry.dart';
import 'package:package_info_plus/package_info_plus.dart';

class AppUpdateState {
  final bool mustLock;
  final bool updateAvailable;
  final bool showGraceBanner;
  /// Matches server: site-hosted `/api/mobile-app/download` is allowed (not admin-locked).
  final bool websiteDownloadAvailable;
  final String? apkUrl;
  final String? graceEndsAt;
  final String? releaseNotes;
  final String? broadcastMessage;
  final bool maintenance;
  final String? maintenanceMessage;
  final int? latestVersionCode;
  /// From [PackageInfo.buildNumber] — must be >= server [latestVersionCode] (pubspec `+` value).
  final int? clientVersionCode;
  final String? clientVersionName;

  const AppUpdateState({
    this.mustLock = false,
    this.updateAvailable = false,
    this.showGraceBanner = false,
    this.websiteDownloadAvailable = true,
    this.apkUrl,
    this.graceEndsAt,
    this.releaseNotes,
    this.broadcastMessage,
    this.maintenance = false,
    this.maintenanceMessage,
    this.latestVersionCode,
    this.clientVersionCode,
    this.clientVersionName,
  });

  AppUpdateState copyWith({
    bool? mustLock,
    bool? updateAvailable,
    bool? showGraceBanner,
    bool? websiteDownloadAvailable,
    String? apkUrl,
    String? graceEndsAt,
    String? releaseNotes,
    String? broadcastMessage,
    bool? maintenance,
    String? maintenanceMessage,
    int? latestVersionCode,
    int? clientVersionCode,
    String? clientVersionName,
  }) {
    return AppUpdateState(
      mustLock: mustLock ?? this.mustLock,
      updateAvailable: updateAvailable ?? this.updateAvailable,
      showGraceBanner: showGraceBanner ?? this.showGraceBanner,
      websiteDownloadAvailable:
          websiteDownloadAvailable ?? this.websiteDownloadAvailable,
      apkUrl: apkUrl ?? this.apkUrl,
      graceEndsAt: graceEndsAt ?? this.graceEndsAt,
      releaseNotes: releaseNotes ?? this.releaseNotes,
      broadcastMessage: broadcastMessage ?? this.broadcastMessage,
      maintenance: maintenance ?? this.maintenance,
      maintenanceMessage: maintenanceMessage ?? this.maintenanceMessage,
      latestVersionCode: latestVersionCode ?? this.latestVersionCode,
      clientVersionCode: clientVersionCode ?? this.clientVersionCode,
      clientVersionName: clientVersionName ?? this.clientVersionName,
    );
  }
}

final appUpdateProvider =
    NotifierProvider<AppUpdateNotifier, AppUpdateState>(AppUpdateNotifier.new);

class AppUpdateNotifier extends Notifier<AppUpdateState> {
  Timer? _pollTimer;
  Timer? _graceDeadlineTimer;
  bool _refreshInFlight = false;

  @override
  AppUpdateState build() {
    ref.onDispose(() {
      _pollTimer?.cancel();
      _graceDeadlineTimer?.cancel();
    });
    Future.microtask(refresh);
    return const AppUpdateState();
  }

  /// When the server omits `apkDownloadUrl` but allows site download, use the same
  /// base URL as the API client so grace / update-lock screens still offer a link.
  static String? _fallbackApkUrl(bool websiteDownloadAllowed) {
    if (!websiteDownloadAllowed) return null;
    final base = apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    if (base.isEmpty) return null;
    return '$base/api/mobile-app/download';
  }

  void _armGraceDeadlineRefresh({
    required bool updateAvailable,
    required bool mustLock,
    required String? graceEndsAtIso,
  }) {
    _graceDeadlineTimer?.cancel();
    _graceDeadlineTimer = null;
    if (!updateAvailable || mustLock) return;
    final raw = graceEndsAtIso?.trim();
    if (raw == null || raw.isEmpty) return;
    try {
      final end = DateTime.parse(raw).toLocal();
      final ms = end.difference(DateTime.now()).inMilliseconds + 750;
      if (ms <= 0) return;
      if (ms > const Duration(days: 2).inMilliseconds) return;
      _graceDeadlineTimer = Timer(Duration(milliseconds: ms), () {
        refresh();
      });
    } catch (_) {}
  }

  void _schedulePeriodicPoll() {
    _pollTimer?.cancel();
    final s = state;
    final Duration interval;
    if (s.maintenance) {
      interval = const Duration(seconds: 20);
    } else if (s.updateAvailable && !s.mustLock) {
      interval = const Duration(seconds: 20);
    } else if (s.mustLock) {
      interval = const Duration(seconds: 45);
    } else {
      interval = const Duration(minutes: 10);
    }
    _pollTimer = Timer.periodic(interval, (_) => refresh());
  }

  Future<void> refresh() async {
    if (_refreshInFlight) return;
    _refreshInFlight = true;
    try {
      final info = await PackageInfo.fromPlatform();
      final code = int.tryParse(info.buildNumber) ?? 0;
      final dio = ref.read(dioProvider);
      final res = await dio.get<Map<String, dynamic>>(
        '/api/mobile-app/version',
        queryParameters: {
          'versionCode': code,
          // Bust misbehaving HTTP caches so "Update required" clears right after install.
          '_': DateTime.now().millisecondsSinceEpoch.toString(),
        },
        options: Options(
          headers: <String, dynamic>{
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        ),
      );
      final d = res.data ?? {};
      final mustLock = d['mustLock'] == true;
      final updateAvailable = d['updateAvailable'] == true;
      final websiteDl =
          d['websiteDownloadAvailable'] == true || d['websiteDownloadAvailable'] == null;
      final apkRaw = d['apkDownloadUrl'];
      final apkStr = apkRaw is String
          ? apkRaw.trim()
          : (apkRaw != null ? apkRaw.toString().trim() : '');
      String? apkUrl = apkStr.isNotEmpty ? apkStr : null;
      apkUrl ??= _fallbackApkUrl(websiteDl);
      final graceRaw = d['graceEndsAt'];
      final graceEnds =
          graceRaw is String ? graceRaw : (graceRaw != null ? '$graceRaw' : null);
      final broadcastRaw = d['broadcastMessage'];
      final broadcast = broadcastRaw is String && broadcastRaw.trim().isNotEmpty
          ? broadcastRaw.trim()
          : (broadcastRaw != null && '$broadcastRaw'.trim().isNotEmpty
              ? '$broadcastRaw'.trim()
              : null);
      final maintenance = d['maintenance'] == true;
      final maintMsgRaw = d['maintenanceMessage'];
      final maintenanceMessage = maintMsgRaw is String && maintMsgRaw.trim().isNotEmpty
          ? maintMsgRaw.trim()
          : null;
      final latestVc = (d['latestVersionCode'] as num?)?.toInt();

      // Server compares versionCode query param to latestVersionCode. Use the same rule here so
      // we never stay on "Update required" after installing an APK whose build matches or beats
      // the server (handles stale responses and fixes label/code mismatches from Gradle).
      final outdated = latestVc != null ? code < latestVc : updateAvailable;
      final effectiveUpdateAvailable =
          maintenance ? updateAvailable : (updateAvailable && outdated);
      final effectiveMustLock =
          maintenance ? mustLock : (mustLock && outdated);

      state = AppUpdateState(
        mustLock: effectiveMustLock,
        updateAvailable: effectiveUpdateAvailable,
        showGraceBanner: effectiveUpdateAvailable && !effectiveMustLock,
        websiteDownloadAvailable: websiteDl,
        apkUrl: apkUrl,
        graceEndsAt: graceEnds,
        releaseNotes: switch (d['releaseNotes']) {
          final String s when s.trim().isNotEmpty => s,
          _ => null,
        },
        broadcastMessage: broadcast,
        maintenance: maintenance,
        maintenanceMessage: maintenanceMessage,
        latestVersionCode: latestVc,
        clientVersionCode: code,
        clientVersionName: info.version,
      );

      _pollTimer?.cancel();
      _schedulePeriodicPoll();
      _armGraceDeadlineRefresh(
        updateAvailable: effectiveUpdateAvailable,
        mustLock: effectiveMustLock,
        graceEndsAtIso: graceEnds,
      );

      unawaited(
        maybeEmitVersionCheckTelemetry(
          ref,
          versionCode: code,
          versionName: info.version,
          targetVersionCode: latestVc,
        ),
      );
    } catch (_) {
      // Fail open: never block the app when the policy endpoint is unreachable.
      _pollTimer?.cancel();
      _schedulePeriodicPoll();
    } finally {
      _refreshInFlight = false;
    }
  }
}
