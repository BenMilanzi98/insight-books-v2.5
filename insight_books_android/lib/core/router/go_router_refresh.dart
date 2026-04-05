import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';
import 'package:insightbooks_android/features/tenant/presentation/providers/tenant_provider.dart';

/// Drives [GoRouter.redirect] re-evaluation without creating a new [GoRouter].
///
/// **Why:** [Provider]<[GoRouter]> that `ref.watch`s auth/permissions/tenant rebuilds
/// whenever those change, producing a **new** router. [MaterialApp.router] then
/// replaces the entire nav tree — login [TextField]s are disposed and the
/// keyboard closes immediately (especially noticeable in **release** builds where
/// async resolves faster).
class GoRouterRefreshNotifier extends ChangeNotifier {
  void ping() => notifyListeners();
}

/// Keeps listeners attached so auth / permissions / tenant updates refresh redirects only.
final goRouterRefreshNotifierProvider = Provider<GoRouterRefreshNotifier>((ref) {
  final notifier = GoRouterRefreshNotifier();
  ref.onDispose(notifier.dispose);

  ref.listen(authStateProvider, (_, __) => notifier.ping());
  ref.listen(userPermissionsProvider, (_, __) => notifier.ping());
  ref.listen(tenantProvider, (_, __) => notifier.ping());

  return notifier;
});
