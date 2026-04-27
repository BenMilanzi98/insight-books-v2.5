import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/update/apk_update_installer.dart';
import 'package:insightbooks_android/core/update/app_update_provider.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// Polls [appUpdateProvider], shows a grace-period banner, then a full-screen lock
/// when the server reports [AppUpdateState.mustLock].
class AppUpdateGate extends ConsumerStatefulWidget {
  final Widget child;

  const AppUpdateGate({super.key, required this.child});

  @override
  ConsumerState<AppUpdateGate> createState() => _AppUpdateGateState();
}

class _AppUpdateGateState extends ConsumerState<AppUpdateGate>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(appUpdateProvider.notifier).refresh();
    }
  }

  String _bannerText(AppUpdateState s) {
    final buf = StringBuffer('A new version is available.');
    if (s.graceEndsAt != null) {
      try {
        final end = DateTime.parse(s.graceEndsAt!).toLocal();
        buf.write(
          ' Please update by ${end.year}-${end.month.toString().padLeft(2, '0')}-${end.day.toString().padLeft(2, '0')} ${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')} or the app will lock.',
        );
      } catch (_) {}
    }
    if (s.broadcastMessage != null && s.broadcastMessage!.isNotEmpty) {
      buf.write(' ${s.broadcastMessage}');
    }
    if (s.apkUrl == null && !s.websiteDownloadAvailable) {
      buf.write(
        ' The public download page is disabled — contact your administrator for an update link.',
      );
    }
    return buf.toString();
  }

  Future<void> _openApkInBrowser(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _startInAppDownload(AppUpdateState s) async {
    if (s.apkUrl == null) return;
    final info = await PackageInfo.fromPlatform();
    final code = int.tryParse(info.buildNumber) ?? 0;
    await ref.read(apkUpdateInstallerProvider.notifier).downloadAndInstall(
          apkUrl: s.apkUrl!,
          versionCode: code,
          versionName: info.version,
          targetVersionCode: s.latestVersionCode,
        );
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(appUpdateProvider);
    final dl = ref.watch(apkUpdateInstallerProvider);
    final warningFg = AppTheme.warningColor(context);
    final warningBg = AppTheme.warningBg(context);

    return Stack(
      clipBehavior: Clip.none,
      children: [
        widget.child,
        if (s.showGraceBanner && !s.mustLock)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Material(
                color: warningBg,
                elevation: 6,
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline, color: warningFg, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _bannerText(s),
                          style: TextStyle(color: warningFg, fontSize: 13),
                        ),
                      ),
                      if (s.apkUrl != null) ...[
                        TextButton(
                          onPressed: () => _startInAppDownload(s),
                          child: Text(
                            'Download in app',
                            style: TextStyle(
                              color: warningFg,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () => _openApkInBrowser(s.apkUrl!),
                          child: Text(
                            'Browser',
                            style: TextStyle(color: warningFg),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        if (s.mustLock)
          Positioned.fill(
            child: Material(
              color: Colors.black.withValues(alpha: 0.94),
              child: SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          s.maintenance ? Icons.build_circle_outlined : Icons.lock_outline,
                          size: 48,
                          color: Colors.white,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          s.maintenance ? 'Maintenance' : 'Update required',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          s.maintenance
                              ? (s.maintenanceMessage ??
                                  'The app is temporarily unavailable. Please try again later.')
                              : s.apkUrl != null
                                  ? 'This version is no longer supported. Download and install the latest APK to continue.'
                                  : !s.websiteDownloadAvailable
                                      ? 'This version is no longer supported. The public app download is disabled on the server. Ask your administrator for an update link or to enable download.'
                                      : 'This version is no longer supported. Contact your administrator — no download URL is configured.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white70),
                        ),
                        if (!s.maintenance &&
                            (s.clientVersionCode != null || s.latestVersionCode != null)) ...[
                          const SizedBox(height: 12),
                          Text(
                            'Installed: build ${s.clientVersionCode ?? "?"}\n'
                            '(${s.clientVersionName ?? "—"}) · Server requires build ${s.latestVersionCode ?? "?"} or newer.\n'
                            'The install "build" is pubspec +N, not the version label. Rebuild with a higher +N or lower Latest build in admin (Mobile app).',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white54, fontSize: 12),
                          ),
                        ],
                        if (s.releaseNotes != null &&
                            s.releaseNotes!.trim().isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Text(
                            s.releaseNotes!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white54, fontSize: 13),
                          ),
                        ],
                        if (s.apkUrl != null) ...[
                          const SizedBox(height: 20),
                          if (dl.phase == ApkDownloadPhase.downloading ||
                              dl.phase == ApkDownloadPhase.queued ||
                              dl.phase == ApkDownloadPhase.openingInstaller) ...[
                            Text(
                              dl.statusLabel ?? '',
                              style: const TextStyle(color: Colors.white70, fontSize: 13),
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: dl.phase == ApkDownloadPhase.downloading
                                    ? dl.progress.clamp(0.0, 1.0)
                                    : null,
                                minHeight: 6,
                                backgroundColor: Colors.white24,
                                color: Colors.white,
                              ),
                            ),
                          ],
                          if (dl.phase == ApkDownloadPhase.error &&
                              (dl.errorMessage ?? '').isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(
                              dl.errorMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                            ),
                          ],
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: (dl.phase == ApkDownloadPhase.downloading ||
                                    dl.phase == ApkDownloadPhase.openingInstaller)
                                ? null
                                : () => _startInAppDownload(s),
                            child: Text(
                              dl.phase == ApkDownloadPhase.downloading
                                  ? 'Downloading…'
                                  : 'Download update',
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: s.apkUrl == null
                                ? null
                                : () => _openApkInBrowser(s.apkUrl!),
                            child: const Text(
                              'Open in browser',
                              style: TextStyle(color: Colors.white70),
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () {
                            ref.read(apkUpdateInstallerProvider.notifier).reset();
                            ref.read(appUpdateProvider.notifier).refresh();
                          },
                          child: const Text(
                            'Check again',
                            style: TextStyle(color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
