import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../data/purchases_offline_helpers.dart';
import 'providers/purchases_hub_provider.dart';

class PurchasesHubScreen extends ConsumerStatefulWidget {
  const PurchasesHubScreen({super.key});

  @override
  ConsumerState<PurchasesHubScreen> createState() => _PurchasesHubScreenState();
}

class _PurchasesHubScreenState extends ConsumerState<PurchasesHubScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshAndMaybeShowFailed();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncAndMaybeShowFailed();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _refreshAndMaybeShowFailed() async {
    final notifier = ref.read(purchasesHubProvider.notifier);
    await notifier.refresh();
    if (!mounted) return;
    await _maybeShowFailedDialog();
  }

  Future<void> _syncAndMaybeShowFailed() async {
    final notifier = ref.read(purchasesHubProvider.notifier);
    await notifier.syncPending();
    if (!mounted) return;
    await _maybeShowFailedDialog();
  }

  Future<void> _maybeShowFailedDialog() async {
    final failed = await ref.read(purchasesHubProvider.notifier).listFailed();
    if (!mounted || failed.isEmpty) return;
    await _showFailedSyncDialog(failed);
  }

  Future<void> _showFailedSyncDialog(
    List<Map<String, dynamic>> failed,
  ) async {
    if (!mounted) return;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Sync failed'),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: failed.length,
              separatorBuilder: (_, _) => const Divider(height: 16),
              itemBuilder: (context, index) {
                final item = failed[index];
                final action = '${item['action']}';
                final createdAt = '${item['createdAt'] ?? ''}';
                final id = '${item['id']}';

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      offlineActionLabel(action),
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    if (createdAt.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          createdAt,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        TextButton(
                          onPressed: () async {
                            Navigator.of(dialogContext).pop();
                            await ref
                                .read(purchasesHubProvider.notifier)
                                .retryFailed(id);
                            if (!mounted) return;
                            await _maybeShowFailedDialog();
                          },
                          child: const Text('Retry'),
                        ),
                        TextButton(
                          onPressed: () async {
                            Navigator.of(dialogContext).pop();
                            await ref
                                .read(purchasesHubProvider.notifier)
                                .discardFailed(id);
                            if (!mounted) return;
                            await _maybeShowFailedDialog();
                          },
                          child: const Text('Discard'),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final hub = ref.watch(purchasesHubProvider);
    final theme = Theme.of(context);

    if (!hub.canAccessHub) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(
          title: const Text('Purchase & Supplier Management'),
        ),
        body: const Center(
          child: Text(
            'You do not have permission to view purchase & supplier management.',
          ),
        ),
      );
    }

    final tiles = <_HubTileSpec>[
      if (hub.showSuppliersTile)
        const _HubTileSpec(
          title: 'Suppliers',
          subtitle: 'Manage supplier profiles',
          icon: Icons.storefront_rounded,
          color: Color(0xFFEF4444),
          route: '/purchases/suppliers',
        ),
      if (hub.showOrdersTile)
        const _HubTileSpec(
          title: 'Orders',
          subtitle: 'Purchase orders',
          icon: Icons.receipt_long_rounded,
          color: Color(0xFFF97316),
          route: '/purchases/orders',
        ),
      if (hub.showReceiptsTile)
        const _HubTileSpec(
          title: 'Receipts',
          subtitle: 'Goods & service receipts',
          icon: Icons.inventory_rounded,
          color: Color(0xFF0EA5E9),
          route: '/purchases/receipts',
        ),
      if (hub.showBillsTile)
        const _HubTileSpec(
          title: 'Bills',
          subtitle: 'Supplier bills',
          icon: Icons.request_quote_rounded,
          color: Color(0xFF8B5CF6),
          route: '/purchases/bills',
        ),
      if (hub.showPaymentsTile)
        const _HubTileSpec(
          title: 'Payments',
          subtitle: 'Record supplier payments',
          icon: Icons.payments_rounded,
          color: Color(0xFF10B981),
          route: '/purchases/payments',
        ),
    ];

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Purchase & Supplier Management'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: [
          if (hub.failedOfflineCount > 0)
            IconButton(
              icon: const Icon(Icons.error_outline),
              tooltip: '${hub.failedOfflineCount} failed sync item(s)',
              onPressed: () async {
                final failed =
                    await ref.read(purchasesHubProvider.notifier).listFailed();
                if (!mounted || failed.isEmpty) return;
                await _showFailedSyncDialog(failed);
              },
            ),
          if (hub.pendingOfflineCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: Badge(
                  label: Text('${hub.pendingOfflineCount}'),
                  child: IconButton(
                    icon: hub.isSyncing
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.cloud_upload_outlined),
                    tooltip:
                        '${hub.pendingOfflineCount} item(s) pending sync',
                    onPressed: hub.isSyncing
                        ? null
                        : () => _syncAndMaybeShowFailed(),
                  ),
                ),
              ),
            ),
          const ThemeToggleButton(),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refreshAndMaybeShowFailed(),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: Text(
                    'Choose a module',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.05,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final tile = tiles[index];
                      return _HubTile(
                        spec: tile,
                        onTap: () => context.push(tile.route),
                      );
                    },
                    childCount: tiles.length,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HubTileSpec {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String route;

  const _HubTileSpec({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.route,
  });
}

class _HubTile extends StatelessWidget {
  final _HubTileSpec spec;
  final VoidCallback onTap;

  const _HubTile({
    required this.spec,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLight = theme.brightness == Brightness.light;

    return Material(
      color: isLight
          ? theme.colorScheme.surface
          : theme.colorScheme.surfaceContainerHighest,
      elevation: isLight ? 1 : 0,
      shadowColor: Colors.black.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: spec.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(spec.icon, color: spec.color, size: 24),
              ),
              const Spacer(),
              Text(
                spec.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                spec.subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  height: 1.25,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
