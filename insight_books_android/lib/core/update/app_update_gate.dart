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
    final buf = StringBuffer(
      s.lockReason?.isNotEmpty == true
          ? s.lockReason!
          : 'A new version is available.',
    );
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

  String _lockTitle(AppUpdateState s) {
    if (s.updateStatus == 'revoked') return 'Access revoked';
    if (s.maintenance) return 'Maintenance';
    if (s.updateStatus == 'locked') return 'App temporarily locked';
    return 'Update required';
  }

  IconData _lockIcon(AppUpdateState s) {
    if (s.updateStatus == 'revoked') return Icons.person_off_outlined;
    if (s.maintenance) return Icons.build_circle_outlined;
    if (s.updateStatus == 'locked') return Icons.security_outlined;
    return Icons.lock_outline;
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
    await ref
        .read(apkUpdateInstallerProvider.notifier)
        .downloadAndInstall(
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
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
                        Icon(_lockIcon(s), size: 48, color: Colors.white),
                        const SizedBox(height: 16),
                        Text(
                          _lockTitle(s),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (s.maintenance ||
                            s.updateStatus == 'revoked' ||
                            s.updateStatus == 'locked') ...[
                          Text(
                            s.maintenanceMessage ??
                                s.lockReason ??
                                'The app is temporarily unavailable. Please try again later.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 15,
                            ),
                          ),
                        ] else ...[
                          Text(
                            s.lockReason ??
                                'This version is no longer supported. Download and install the latest APK to continue.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 15,
                              height: 1.35,
                            ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Installed: build ${s.clientVersionCode ?? "—"}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Latest: ${s.latestVersionName ?? "—"} (build ${s.latestVersionCode ?? "—"})',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (s.apkUrl == null) ...[
                            const SizedBox(height: 16),
                            Text(
                              !s.websiteDownloadAvailable
                                  ? 'Download is not available from the app. Ask your administrator for an update.'
                                  : 'No download link is configured. Ask your administrator.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white54,
                                fontSize: 14,
                              ),
                            ),
                          ],
                          if (s.apkUrl != null) ...[
                            const SizedBox(height: 20),
                            if (dl.phase == ApkDownloadPhase.downloading ||
                                dl.phase == ApkDownloadPhase.queued ||
                                dl.phase ==
                                    ApkDownloadPhase.openingInstaller) ...[
                              Text(
                                dl.phase == ApkDownloadPhase.openingInstaller
                                    ? 'Opening installer…'
                                    : 'Downloading…',
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 8),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value:
                                      dl.phase == ApkDownloadPhase.downloading
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
                              const SizedBox(height: 12),
                              Text(
                                dl.errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Colors.redAccent,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed:
                                    (dl.phase == ApkDownloadPhase.downloading ||
                                        dl.phase ==
                                            ApkDownloadPhase.openingInstaller)
                                    ? null
                                    : () => _startInAppDownload(s),
                                child: Text(
                                  dl.phase == ApkDownloadPhase.downloading
                                      ? 'Downloading…'
                                      : 'Download',
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            SizedBox(
                              width: double.infinity,
                              child: TextButton(
                                onPressed: () => _openApkInBrowser(s.apkUrl!),
                                child: const Text(
                                  'Open in browser',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: 15,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () {
                            ref
                                .read(apkUpdateInstallerProvider.notifier)
                                .reset();
                            ref.read(appUpdateProvider.notifier).refresh();
                          },
                          child: const Text(
                            'Check again',
                            style: TextStyle(color: Colors.white, fontSize: 15),
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
