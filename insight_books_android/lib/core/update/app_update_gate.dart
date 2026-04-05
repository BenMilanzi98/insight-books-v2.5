import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/core/update/app_update_provider.dart';
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

  Future<void> _openApk(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(appUpdateProvider);
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
                      if (s.apkUrl != null)
                        TextButton(
                          onPressed: () => _openApk(s.apkUrl!),
                          child: Text(
                            'Update',
                            style: TextStyle(
                              color: warningFg,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
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
                        const Icon(Icons.lock_outline,
                            size: 48, color: Colors.white),
                        const SizedBox(height: 16),
                        const Text(
                          'Update required',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          s.apkUrl != null
                              ? 'This version is no longer supported. Download and install the latest APK to continue.'
                              : !s.websiteDownloadAvailable
                                  ? 'This version is no longer supported. The public app download is disabled on the server. Ask your administrator for an update link or to enable download.'
                                  : 'This version is no longer supported. Contact your administrator — no download URL is configured.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white70),
                        ),
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
                          FilledButton(
                            onPressed: () => _openApk(s.apkUrl!),
                            child: const Text('Download update'),
                          ),
                        ],
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () =>
                              ref.read(appUpdateProvider.notifier).refresh(),
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
