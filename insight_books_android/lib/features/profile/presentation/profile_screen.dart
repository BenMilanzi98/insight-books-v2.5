import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/features/account/data/account_repository.dart';
import 'package:insightbooks_android/features/account/domain/user_model.dart';
import 'package:insightbooks_android/features/account/presentation/account_screen.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/features/auth/presentation/auth_controller.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

/// Personal profile: same capabilities as web `/profile` (editable name & phone,
/// password). Read-only fields (email, role) are omitted. Includes self-service
/// account deactivation via `/api/profile/deactivate`.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  User? _user;
  bool _loading = true;
  String? _loadError;
  bool _saving = false;
  String? _bannerError;
  String? _bannerSuccess;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final user = await ref.read(accountRepositoryProvider).fetchProfile();
      if (!mounted) return;
      setState(() {
        _user = user;
        _nameController.text = user.name;
        _phoneController.text = user.phone ?? '';
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = NetworkErrorMapper.toUserMessage(
          e,
          fallback: 'Could not load your profile.',
        );
      });
    }
  }

  Future<void> _saveProfile() async {
    final u = _user;
    if (u == null) return;
    setState(() {
      _saving = true;
      _bannerError = null;
      _bannerSuccess = null;
    });
    try {
      final updated = u.copyWith(
        name: _nameController.text.trim(),
        phone: _phoneController.text.trim().isEmpty
            ? null
            : _phoneController.text.trim(),
      );
      await ref.read(accountRepositoryProvider).updateProfile(updated);
      ref.invalidate(accountProvider);
      if (!mounted) return;
      setState(() {
        _user = updated;
        _saving = false;
        _bannerSuccess = 'Profile updated successfully';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _bannerError = NetworkErrorMapper.toUserMessage(
          e,
          fallback: 'Could not save profile.',
        );
      });
    }
  }

  Future<void> _changePassword(
    String currentPassword,
    String newPassword,
    String confirmPassword,
  ) async {
    setState(() {
      _bannerError = null;
      _bannerSuccess = null;
    });
    try {
      await ref.read(accountRepositoryProvider).updatePassword(
            currentPassword: currentPassword,
            newPassword: newPassword,
            confirmPassword: confirmPassword,
          );
      ref.invalidate(accountProvider);
      if (!mounted) return;
      setState(() {
        _bannerSuccess = 'Password updated successfully';
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            NetworkErrorMapper.toUserMessage(
              e,
              fallback: 'Could not update password.',
            ),
          ),
        ),
      );
    }
  }

  Future<void> _confirmDeleteAccount() async {
    final passwordController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Delete account'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Your account will be deactivated immediately. You will not be able to sign in again on web or mobile.',
                  style: TextStyle(
                    color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Current password',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => Navigator.of(ctx).pop(true),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error,
                foregroundColor: Theme.of(ctx).colorScheme.onError,
              ),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Deactivate account'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      passwordController.dispose();
      return;
    }

    final password = passwordController.text;
    passwordController.dispose();
    if (password.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password is required.')),
        );
      }
      return;
    }

    setState(() {
      _saving = true;
      _bannerError = null;
      _bannerSuccess = null;
    });

    try {
      await ref.read(accountRepositoryProvider).deactivateOwnAccount(
            password: password,
          );
      if (!mounted) return;
      await ref.read(authStateProvider.notifier).logout();
      if (!mounted) return;
      context.go('/login');
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _bannerError = NetworkErrorMapper.toUserMessage(
          e,
          fallback: 'Could not deactivate account.',
        );
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _bannerError = NetworkErrorMapper.toUserMessage(
          e,
          fallback: 'Could not deactivate account.',
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('My Profile'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(LucideIcons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _loadError!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: theme.colorScheme.error),
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _loadProfile,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : Stack(
                  children: [
                    ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_bannerSuccess != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Material(
                              color: AppTheme.successBg(context),
                              borderRadius: BorderRadius.circular(8),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Row(
                                  children: [
                                    Icon(
                                      LucideIcons.checkCircle2,
                                      color: AppTheme.successColor(context),
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        _bannerSuccess!,
                                        style: TextStyle(
                                          color: AppTheme.successColor(context),
                                          fontSize: 14,
                                        ),
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(LucideIcons.x, size: 18),
                                      onPressed: () =>
                                          setState(() => _bannerSuccess = null),
                                      color: AppTheme.successColor(context),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        if (_bannerError != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Material(
                              color: AppTheme.errorBg(context),
                              borderRadius: BorderRadius.circular(8),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Row(
                                  children: [
                                    Icon(
                                      LucideIcons.alertTriangle,
                                      color: AppTheme.errorColor(context),
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        _bannerError!,
                                        style: TextStyle(
                                          color: AppTheme.errorColor(context),
                                          fontSize: 14,
                                        ),
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(LucideIcons.x, size: 18),
                                      onPressed: () =>
                                          setState(() => _bannerError = null),
                                      color: AppTheme.errorColor(context),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  'Profile',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Update the name and phone number used in your workspace.',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                TextField(
                                  controller: _nameController,
                                  decoration: const InputDecoration(
                                    labelText: 'Name',
                                    border: OutlineInputBorder(),
                                  ),
                                  textCapitalization: TextCapitalization.words,
                                ),
                                const SizedBox(height: 12),
                                TextField(
                                  controller: _phoneController,
                                  decoration: const InputDecoration(
                                    labelText: 'Phone',
                                    border: OutlineInputBorder(),
                                  ),
                                  keyboardType: TextInputType.phone,
                                ),
                                const SizedBox(height: 16),
                                FilledButton(
                                  onPressed: _saving ? null : _saveProfile,
                                  child: const Text('Save profile'),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  'Security',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                OutlinedButton.icon(
                                  onPressed: _saving
                                      ? null
                                      : () {
                                          showDialog(
                                            context: context,
                                            builder: (context) =>
                                                ChangePasswordDialog(
                                              onConfirm: _changePassword,
                                            ),
                                          );
                                        },
                                  icon: const Icon(Icons.lock_outline_rounded),
                                  label: const Text('Change password'),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Card(
                          color: theme.colorScheme.errorContainer
                              .withValues(alpha: 0.35),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  'Delete account',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                    color: theme.colorScheme.error,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Deactivates your user immediately. You will be signed out and cannot access InsightBooks with this account until an administrator restores it.',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                OutlinedButton.icon(
                                  onPressed: _saving ? null : _confirmDeleteAccount,
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: theme.colorScheme.error,
                                    side: BorderSide(color: theme.colorScheme.error),
                                  ),
                                  icon: const Icon(Icons.person_off_outlined),
                                  label: const Text('Delete my account'),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (_saving)
                      const Positioned.fill(
                        child: ColoredBox(
                          color: Color(0x33000000),
                          child: Center(child: CircularProgressIndicator()),
                        ),
                      ),
                  ],
                ),
    );
  }
}
