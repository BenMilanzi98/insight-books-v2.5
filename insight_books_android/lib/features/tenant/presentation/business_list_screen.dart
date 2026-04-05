import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import '../../../core/security/permissions_provider.dart';
import '../../../shared/widgets/main_layout.dart';
import './providers/tenant_provider.dart';
import '../domain/tenant_models.dart';
import './widgets/add_business_dialog.dart';

class BusinessListScreen extends ConsumerWidget {
  const BusinessListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(tenantProvider);
    final notifier = ref.read(tenantProvider.notifier);
    final permissions = ref.watch(userPermissionsProvider).asData?.value ?? <String>{};
    final canCreateBusiness = hasPermission(permissions, 'system.create');
    final canDeleteBusiness = hasPermission(permissions, 'system.delete');
    final theme = Theme.of(context);

    if (state.error != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(state.error!),
            backgroundColor: AppTheme.errorColor(context),
            action: SnackBarAction(
              label: 'Clear',
              textColor: theme.colorScheme.onError,
              onPressed: notifier.clearError,
            ),
          ),
        );
        notifier.clearError();
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Businesses'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(LucideIcons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
      ),
      drawer: const AppDrawer(),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: notifier.loadData,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: theme.colorScheme.surface,
                                    borderRadius: BorderRadius.circular(12),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(
                                          alpha: 0.05,
                                        ),
                                        blurRadius: 10,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: TextField(
                                    onChanged: notifier.setSearchTerm,
                                    decoration: InputDecoration(
                                      hintText: 'Search businesses...',
                                      prefixIcon: const Icon(
                                        LucideIcons.search,
                                        size: 20,
                                      ),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: BorderSide.none,
                                      ),
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 16,
                                            vertical: 14,
                                          ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              ElevatedButton.icon(
                                onPressed: canCreateBusiness
                                    ? () => _showAddDialog(context)
                                    : null,
                                icon: const Icon(LucideIcons.plus, size: 18),
                                label: const Text('Add New'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (state.filteredTenants.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: _buildEmptyState(
                        context,
                        notifier,
                        state.searchTerm,
                        canCreateBusiness,
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate((context, index) {
                          final tenant = state.filteredTenants[index];
                          return _BusinessCard(
                            tenant: tenant,
                            isActive: tenant.id == state.currentTenantId,
                            isSwitching: state.isSwitching,
                            canDeleteBusiness: canDeleteBusiness,
                            onSelect: () async {
                              final success = await notifier.switchTenant(
                                tenant.id,
                              );
                              if (success && context.mounted) {
                                context.go('/dashboard');
                              }
                            },
                            onDelete: () =>
                                _confirmDelete(context, notifier, tenant),
                          );
                        }, childCount: state.filteredTenants.length),
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _buildEmptyState(
    BuildContext context,
    TenantNotifier notifier,
    String search,
    bool canCreateBusiness,
  ) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHigh,
              shape: BoxShape.circle,
            ),
            child: Icon(
              LucideIcons.building,
              size: 48,
              color: AppTheme.textSecondary(context),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            search.isNotEmpty ? 'No businesses found' : 'No businesses yet',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary(context),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            search.isNotEmpty
                ? 'Try adjusting your search terms'
                : 'Get started by creating your first business',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: AppTheme.textSecondary(context),
            ),
          ),
          if (search.isEmpty) ...[
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: canCreateBusiness
                  ? () => _showAddDialog(context)
                  : null,
              icon: const Icon(LucideIcons.plus),
              label: const Text('Create Your First Business'),
            ),
          ],
        ],
      ),
    );
  }

  void _showAddDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => const AddBusinessDialog(),
    );
  }

  void _confirmDelete(
    BuildContext context,
    TenantNotifier notifier,
    Tenant tenant,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Business'),
        content: Text(
          'Are you sure you want to delete ${tenant.name}? This action cannot be undone and will permanently remove all associated data.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final success = await notifier.deleteTenant(tenant.id);
              if (success && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Business deleted successfully'),
                  ),
                );
              }
            },
            style: TextButton.styleFrom(
              foregroundColor: AppTheme.errorColor(context),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _BusinessCard extends StatelessWidget {
  final Tenant tenant;
  final bool isActive;
  final bool isSwitching;
  final bool canDeleteBusiness;
  final VoidCallback onSelect;
  final VoidCallback onDelete;

  const _BusinessCard({
    required this.tenant,
    required this.isActive,
    required this.isSwitching,
    required this.canDeleteBusiness,
    required this.onSelect,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sub = tenant.subscription;
    final isExpired = sub.isExpired;
    final daysLeft = sub.daysRemaining;
    final isTrial = sub.isTrial;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppTheme.cardColor(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive
              ? theme.colorScheme.primary
              : AppTheme.borderColor(context),
          width: isActive ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isActive
                        ? AppTheme.infoBg(context)
                        : theme.colorScheme.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    LucideIcons.building,
                    color: isActive
                        ? theme.colorScheme.primary
                        : AppTheme.textSecondary(context),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tenant.name,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary(context),
                        ),
                      ),
                      Text(
                        'Business',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary(context),
                        ),
                      ),
                    ],
                  ),
                ),
                if (isActive)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.infoBg(context),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          LucideIcons.check,
                          size: 12,
                          color: theme.colorScheme.primary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Active',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: theme.colorScheme.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isExpired
                    ? AppTheme.errorBg(context)
                    : daysLeft <= 7
                    ? AppTheme.warningBg(context)
                    : AppTheme.successBg(context),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isExpired
                      ? AppTheme.errorColor(context).withValues(alpha: 0.4)
                      : daysLeft <= 7
                      ? AppTheme.warningColor(context).withValues(alpha: 0.4)
                      : AppTheme.successColor(context).withValues(alpha: 0.4),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        isExpired
                            ? LucideIcons.alertTriangle
                            : isTrial
                            ? LucideIcons.crown
                            : LucideIcons.zap,
                        size: 16,
                        color: isExpired
                            ? AppTheme.errorColor(context)
                            : isTrial
                            ? theme.colorScheme.secondary
                            : AppTheme.successColor(context),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isExpired
                            ? 'Expired'
                            : '$daysLeft ${daysLeft == 1 ? 'day' : 'days'} remaining',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: isExpired
                              ? AppTheme.errorColor(context)
                              : daysLeft <= 7
                              ? AppTheme.warningColor(context)
                              : AppTheme.successColor(context),
                        ),
                      ),
                    ],
                  ),
                  if (isTrial && !isExpired)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.secondary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'Trial',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.secondary,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: (isActive || isSwitching) ? null : onSelect,
                    child: isSwitching && !isActive
                        ? SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: theme.colorScheme.onPrimary,
                            ),
                          )
                        : Text(
                            isActive
                                ? 'Current Business'
                                : 'Switch To Business',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  onPressed: canDeleteBusiness ? onDelete : null,
                  icon: const Icon(LucideIcons.trash2, size: 20),
                  color: AppTheme.textSecondary(context),
                  tooltip: 'Delete Business',
                  style: IconButton.styleFrom(
                    hoverColor: AppTheme.errorBg(context),
                    highlightColor: AppTheme.errorBg(context),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
