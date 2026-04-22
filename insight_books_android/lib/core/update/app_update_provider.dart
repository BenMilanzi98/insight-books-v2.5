import 'dart:async';

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
    );
  }
}

final appUpdateProvider =
    NotifierProvider<AppUpdateNotifier, AppUpdateState>(AppUpdateNotifier.new);

class AppUpdateNotifier extends Notifier<AppUpdateState> {
  Timer? _timer;

  @override
  AppUpdateState build() {
    _timer = Timer.periodic(const Duration(minutes: 10), (_) => refresh());
    ref.onDispose(() {
      _timer?.cancel();
    });
    Future.microtask(refresh);
    return const AppUpdateState();
  }

  Future<void> refresh() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final code = int.tryParse(info.buildNumber) ?? 0;
      final dio = ref.read(dioProvider);
      final res = await dio.get<Map<String, dynamic>>(
        '/api/mobile-app/version',
        queryParameters: {'versionCode': code},
      );
      final d = res.data ?? {};
      final mustLock = d['mustLock'] == true;
      final updateAvailable = d['updateAvailable'] == true;
      final websiteDl =
          d['websiteDownloadAvailable'] == true || d['websiteDownloadAvailable'] == null;
      final apkRaw = (d['apkDownloadUrl'] as String?)?.trim();
      final apkUrl = apkRaw != null && apkRaw.isNotEmpty ? apkRaw : null;
      final graceEnds = d['graceEndsAt'] as String?;
      final broadcastRaw = d['broadcastMessage'] as String?;
      final broadcast =
          broadcastRaw != null && broadcastRaw.isNotEmpty ? broadcastRaw : null;
      final maintenance = d['maintenance'] == true;
      final maintMsgRaw = d['maintenanceMessage'] as String?;
      final maintenanceMessage =
          maintMsgRaw != null && maintMsgRaw.trim().isNotEmpty ? maintMsgRaw : null;
      final latestVc = (d['latestVersionCode'] as num?)?.toInt();

      state = AppUpdateState(
        mustLock: mustLock,
        updateAvailable: updateAvailable,
        showGraceBanner: updateAvailable && !mustLock,
        websiteDownloadAvailable: websiteDl,
        apkUrl: apkUrl,
        graceEndsAt: graceEnds,
        releaseNotes: d['releaseNotes'] as String?,
        broadcastMessage: broadcast,
        maintenance: maintenance,
        maintenanceMessage: maintenanceMessage,
        latestVersionCode: latestVc,
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
    }
  }
}
