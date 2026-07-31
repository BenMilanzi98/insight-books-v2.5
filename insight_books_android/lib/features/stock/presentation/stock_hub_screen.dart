import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import 'providers/stock_provider.dart';
import 'providers/stock_transfers_provider.dart';
import 'stock_list_screen.dart';
import 'stock_transfers_screen.dart';

class StockHubScreen extends ConsumerStatefulWidget {
  const StockHubScreen({super.key});

  @override
  ConsumerState<StockHubScreen> createState() => _StockHubScreenState();
}

class _StockHubScreenState extends ConsumerState<StockHubScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(_onTabChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(stockControllerProvider.notifier).load();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(stockControllerProvider.notifier).syncPendingMovements();
    }
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    final notifier = ref.read(stockControllerProvider.notifier);
    switch (_tabController.index) {
      case 0:
        notifier.setCatalog('products');
        break;
      case 1:
        notifier.setCatalog('services');
        break;
      case 2:
        ref.read(stockTransfersControllerProvider.notifier).load();
        break;
      default:
        break;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(stockControllerProvider);
    final transfersState = ref.watch(stockTransfersControllerProvider);
    final notifier = ref.read(stockControllerProvider.notifier);
    final onTransfersTab = _tabController.index == 2;

    if (!state.canView) {
      return Scaffold(
        drawer: const AppDrawer(),
        appBar: AppBar(title: const Text('Stock')),
        body: const Center(
          child: Text('You do not have permission to view stock.'),
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Stock'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        actions: [
          if (state.pendingMovementCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: Badge(
                  label: Text('${state.pendingMovementCount}'),
                  child: IconButton(
                    icon: state.isSyncingMovements
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.cloud_upload_outlined),
                    tooltip:
                        '${state.pendingMovementCount} movement(s) pending sync',
                    onPressed: state.isSyncingMovements
                        ? null
                        : () => notifier.syncPendingMovements(),
                  ),
                ),
              ),
            ),
          const ThemeToggleButton(),
          if (state.canCreate && !onTransfersTab)
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: 'Add',
              onPressed: () {
                final isServices = _tabController.index == 1;
                context.push(
                  isServices
                      ? '/stock/services/create'
                      : '/stock/products/create',
                );
              },
            ),
          if (onTransfersTab && transfersState.canManage)
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: 'Create transfer',
              onPressed: transfersState.isOffline
                  ? () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Transfers require an internet connection.',
                          ),
                        ),
                      );
                    }
                  : () => context.push('/stock/transfers/create'),
            ),
          IconButton(
            icon: const Icon(Icons.event_busy_outlined),
            tooltip: 'Expiry alerts',
            onPressed: () => context.push('/stock/expiry'),
          ),
          IconButton(
            icon: const Icon(Icons.local_shipping_outlined),
            tooltip: 'Receiving',
            onPressed: () => context.push('/stock/receiving'),
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'bulk') {
                context.push('/stock/bulk');
              } else if (value == 'basic') {
                context.push('/stock/basic-import');
              } else if (value == 'deleted') {
                notifier.setShowDeleted(!state.showDeleted);
              } else if (value == 'expiry') {
                context.push('/stock/expiry');
              } else if (value == 'receiving') {
                context.push('/stock/receiving');
              }
            },
            itemBuilder: (_) => [
              if (state.canExport || state.canCreate || state.canDelete)
                const PopupMenuItem(
                  value: 'bulk',
                  child: Text('Bulk operations'),
                ),
              if (state.canExport || state.canCreate)
                const PopupMenuItem(
                  value: 'basic',
                  child: Text('Basic import / export'),
                ),
              const PopupMenuItem(
                value: 'expiry',
                child: Text('Expiry alerts'),
              ),
              const PopupMenuItem(
                value: 'receiving',
                child: Text('Receiving'),
              ),
              PopupMenuItem(
                value: 'deleted',
                child: Text(
                  state.showDeleted ? 'Show active items' : 'Show deleted',
                ),
              ),
            ],
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Products'),
            Tab(text: 'Services'),
            Tab(text: 'Transfers'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          const StockListScreen(catalog: 'products'),
          const StockListScreen(catalog: 'services'),
          const StockTransfersScreen(),
        ],
      ),
    );
  }
}
