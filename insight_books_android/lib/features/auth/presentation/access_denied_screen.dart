import 'dart:io' show exit;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';

/// Shown when the session is valid but no module permissions were resolved
/// (e.g. `/api/auth/me` failed or returned an unexpected shape after a host change).
/// Not listed in [kRoutePermissionRules], so the router does not redirect-loop here.
class AccessDeniedScreen extends ConsumerWidget {
  const AccessDeniedScreen({super.key});

  static void _restartApp() {
    if (kIsWeb) return;
    exit(0);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final hint = ref.watch(permissionProfileLoadHintProvider);
    final looksLikeNetwork =
        ref.watch(permissionProfileLoadWasConnectionIssueProvider);

    final message = (hint != null && hint.trim().isNotEmpty)
        ? hint.trim()
        : looksLikeNetwork
            ? NetworkErrorMapper.internetConnectionMessage
            : 'Network error. Please check your connection and try again.';

    return Scaffold(
      appBar: AppBar(title: const Text('InsightBooks')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    Icons.wifi_find_rounded,
                    size: 48,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Could not load your access profile',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 32),
                  FilledButton.icon(
                    onPressed: () {
                      ref.invalidate(userPermissionsProvider);
                      if (context.mounted) context.go('/splash');
                    },
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Try again'),
                  ),
                  const SizedBox(height: 10),
                  if (!kIsWeb)
                    OutlinedButton.icon(
                      onPressed: _restartApp,
                      icon: const Icon(Icons.restart_alt_rounded),
                      label: const Text('Restart app'),
                    ),
                  const SizedBox(height: 12),
                  TextButton.icon(
                    onPressed: () async {
                      await ref.read(authStateProvider.notifier).logout();
                      if (context.mounted) context.go('/login');
                    },
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Sign out'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
