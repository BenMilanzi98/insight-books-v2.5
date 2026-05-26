import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';
import 'package:insightbooks_android/core/update/mobile_app_telemetry.dart';
import 'package:insightbooks_android/core/update/mobile_device_id.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';
import 'package:package_info_plus/package_info_plus.dart';

const String appCenterBaseUrl = String.fromEnvironment(
  'APP_CENTER_BASE_URL',
  defaultValue: 'https://app.insightinnovationsltd.com',
);

class AppUpdateState {
  final bool mustLock;
  final bool updateAvailable;
  final bool showGraceBanner;

  /// True when the App Center public APK download is available.
  final bool websiteDownloadAvailable;
  final String? apkUrl;
  final String? graceEndsAt;
  final String? releaseNotes;
  final String? broadcastMessage;
  final bool maintenance;
  final String? maintenanceMessage;
  final String? lockReason;
  final String? updateStatus;
  final int? latestVersionCode;
  final String? latestVersionName;

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
    this.lockReason,
    this.updateStatus,
    this.latestVersionCode,
    this.latestVersionName,
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
    String? lockReason,
    String? updateStatus,
    int? latestVersionCode,
    String? latestVersionName,
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
      lockReason: lockReason ?? this.lockReason,
      updateStatus: updateStatus ?? this.updateStatus,
      latestVersionCode: latestVersionCode ?? this.latestVersionCode,
      latestVersionName: latestVersionName ?? this.latestVersionName,
      clientVersionCode: clientVersionCode ?? this.clientVersionCode,
      clientVersionName: clientVersionName ?? this.clientVersionName,
    );
  }
}

final appUpdateProvider = NotifierProvider<AppUpdateNotifier, AppUpdateState>(
  AppUpdateNotifier.new,
);

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

  /// When the server omits a direct APK URL but allows downloads, use the PHP
  /// App Center download endpoint. The in-app installer needs APK bytes, not
  /// the HTML landing page.
  static String? _fallbackApkUrl(bool websiteDownloadAllowed) {
    if (!websiteDownloadAllowed) return null;
    final base = appCenterBaseUrl.replaceAll(RegExp(r'/+$'), '');
    if (base.isEmpty) return null;
    return '$base/download.php';
  }

  static String? _stringValue(Map<String, dynamic> d, List<String> keys) {
    for (final key in keys) {
      final raw = d[key];
      if (raw == null) continue;
      final value = raw is String ? raw.trim() : raw.toString().trim();
      if (value.isNotEmpty) return value;
    }
    return null;
  }

  static int? _intValue(Map<String, dynamic> d, List<String> keys) {
    for (final key in keys) {
      final raw = d[key];
      if (raw is num) return raw.toInt();
      if (raw is String) {
        final parsed = int.tryParse(raw);
        if (parsed != null) return parsed;
      }
    }
    return null;
  }

  static bool _boolValue(Map<String, dynamic> d, List<String> keys) {
    for (final key in keys) {
      final raw = d[key];
      if (raw is bool) return raw;
      if (raw is num) return raw != 0;
      if (raw is String) {
        final normalized = raw.trim().toLowerCase();
        if (normalized == 'true' || normalized == '1' || normalized == 'yes') {
          return true;
        }
        if (normalized == 'false' || normalized == '0' || normalized == 'no') {
          return false;
        }
      }
    }
    return false;
  }

  static void _putIfNotBlank(
    Map<String, dynamic> target,
    String key,
    String? value,
  ) {
    final trimmed = value?.trim();
    if (trimmed != null && trimmed.isNotEmpty) {
      target[key] = trimmed;
    }
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
      final deviceId = await ref.read(mobileDeviceIdProvider.future);
      final account = ref.read(accountProvider);
      final tenant = ref.read(tenantProvider);
      final cachedMe = ref.read(storageServiceProvider).cachedMeData;
      final userFromCache = cachedMe?['user'];
      final userMap = userFromCache is Map ? userFromCache : cachedMe;
      final user = account.user;
      final query = <String, dynamic>{
        'version_code': code,
        'version_name': info.version,
        'device_id': deviceId,
        'platform': 'android',
        // Legacy aliases keep older receiver code or proxies harmless.
        'versionCode': code,
        'current_version_code': code,
        // Bust misbehaving HTTP caches so "Update required" clears right after install.
        '_': DateTime.now().millisecondsSinceEpoch.toString(),
      };
      _putIfNotBlank(query, 'user_id', user?.id ?? userMap?['id']?.toString());
      _putIfNotBlank(
        query,
        'email',
        user?.email ?? userMap?['email']?.toString(),
      );
      _putIfNotBlank(
        query,
        'phone',
        user?.phone ?? userMap?['phone']?.toString(),
      );
      _putIfNotBlank(query, 'tenant_id', tenant.currentTenantId);
      _putIfNotBlank(query, 'business_id', tenant.currentTenantId);
      final dio = Dio(
        BaseOptions(
          baseUrl: appCenterBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          sendTimeout: const Duration(seconds: 30),
          headers: const {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        ),
      );
      final res = await dio.get<Map<String, dynamic>>(
        '/api/check-update.php',
        queryParameters: query,
        options: Options(
          headers: <String, dynamic>{
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        ),
      );
      final d = res.data ?? {};
      final status = _stringValue(d, ['status']);
      final mustLock =
          _boolValue(d, ['app_locked', 'mustLock']) ||
          status == 'locked' ||
          status == 'update_required' ||
          status == 'maintenance' ||
          status == 'revoked';
      final updateAvailable =
          _boolValue(d, ['updateAvailable']) ||
          status == 'optional_update' ||
          status == 'update_required';
      final downloadLocked = _boolValue(d, ['website_download_locked']);
      final websiteDl = downloadLocked
          ? false
          : (_boolValue(d, [
                  'website_download_available',
                  'websiteDownloadAvailable',
                ]) ||
                d['website_download_available'] == null &&
                    d['websiteDownloadAvailable'] == null);
      String? apkUrl = _stringValue(d, ['download_url', 'apkDownloadUrl']);
      apkUrl ??= _fallbackApkUrl(websiteDl);
      final graceEnds = _stringValue(d, ['graceEndsAt', 'grace_ends_at']);
      final broadcast = _stringValue(d, [
        'broadcast_message',
        'broadcastMessage',
      ]);
      final maintenance =
          _boolValue(d, ['maintenance_mode', 'maintenance']) ||
          status == 'maintenance';
      final maintenanceMessage = _stringValue(d, [
        'maintenance_message',
        'maintenanceMessage',
      ]);
      final lockReason = _stringValue(d, ['lock_reason', 'lockReason']);
      final latestVc = _intValue(d, [
        'latest_version_code',
        'latestVersionCode',
      ]);
      final latestVersionName = _stringValue(d, [
        'latest_version_name',
        'latestVersionName',
      ]);

      // Version update prompts are only for outdated builds, but administrative
      // locks/maintenance/revocations must apply even when the build is current.
      final outdated = latestVc != null ? code < latestVc : updateAvailable;
      final isAdministrativeLock =
          status == 'locked' || status == 'maintenance' || status == 'revoked';
      final effectiveUpdateAvailable = maintenance
          ? updateAvailable
          : (updateAvailable && outdated);
      final effectiveMustLock = isAdministrativeLock || maintenance
          ? mustLock
          : (mustLock && (outdated || status == 'update_required'));

      state = AppUpdateState(
        mustLock: effectiveMustLock,
        updateAvailable: effectiveUpdateAvailable,
        showGraceBanner: effectiveUpdateAvailable && !effectiveMustLock,
        websiteDownloadAvailable: websiteDl,
        apkUrl: apkUrl,
        graceEndsAt: graceEnds,
        releaseNotes: switch (d['releaseNotes']) {
          final String s when s.trim().isNotEmpty => s,
          _
              when d['release_notes'] is String &&
                  (d['release_notes'] as String).trim().isNotEmpty =>
            d['release_notes'] as String,
          _ => null,
        },
        broadcastMessage: broadcast,
        maintenance: maintenance,
        maintenanceMessage: maintenanceMessage,
        lockReason: lockReason,
        updateStatus: status,
        latestVersionCode: latestVc,
        latestVersionName: latestVersionName,
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
