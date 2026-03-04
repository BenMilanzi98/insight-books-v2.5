import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/features/account/domain/user_model.dart';
import 'package:insightbooks_android/features/account/domain/business_settings.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(accountProvider);
    final notifier = ref.read(accountProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Account & Settings'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(LucideIcons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Profile', icon: Icon(LucideIcons.user, size: 20)),
            Tab(text: 'Business', icon: Icon(LucideIcons.building, size: 20)),
            Tab(text: 'Address', icon: Icon(LucideIcons.mapPin, size: 20)),
            Tab(text: 'Settings', icon: Icon(LucideIcons.settings, size: 20)),
            Tab(
              text: 'Subscription',
              icon: Icon(LucideIcons.creditCard, size: 20),
            ),
            Tab(text: 'Notifications', icon: Icon(LucideIcons.bell, size: 20)),
          ],
        ),
      ),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          if (state.error != null)
            Container(
              padding: const EdgeInsets.all(8.0),
              color: Colors.red[50],
              width: double.infinity,
              child: Row(
                children: [
                  const Icon(
                    LucideIcons.alertTriangle,
                    color: Colors.red,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      state.error!,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.x, size: 16),
                    onPressed: notifier.clearMessages,
                  ),
                ],
              ),
            ),
          Expanded(
            child: state.isLoading && state.user == null
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _ProfileTab(
                        user: state.user,
                        onSave: notifier.updateProfile,
                      ),
                      _BusinessTab(
                        settings: state.settings,
                        onSave: notifier.updateBusinessSettings,
                      ),
                      _AddressTab(
                        settings: state.settings,
                        onSave: notifier.updateBusinessSettings,
                      ),
                      _SettingsTab(
                        settings: state.settings,
                        onSave: notifier.updateBusinessSettings,
                      ),
                      _SubscriptionTab(
                        settings: state.settings,
                        onSave: notifier.updateBusinessSettings,
                      ),
                      _NotificationsTab(
                        settings: state.settings,
                        onSave: notifier.updateBusinessSettings,
                      ),
                    ],
                  ),
          ),
        ],
      ),
      floatingActionButton: state.isSaving
          ? const FloatingActionButton(
              onPressed: null,
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              ),
            )
          : null,
    );
  }
}

class _ProfileTab extends ConsumerStatefulWidget {
  final User? user;
  final Function(User) onSave;

  const _ProfileTab({this.user, required this.onSave});

  @override
  ConsumerState<_ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends ConsumerState<_ProfileTab> {
  late TextEditingController _nameController;
  late TextEditingController _phoneController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.user?.name);
    _phoneController = TextEditingController(text: widget.user?.phone);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.user == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.userX, size: 48, color: Colors.grey),
            SizedBox(height: 16),
            Text('No profile data available'),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildInfoCard('Personal Information', LucideIcons.user, [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Full Name'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: TextEditingController(text: widget.user?.email),
              decoration: const InputDecoration(labelText: 'Email (Read-only)'),
              enabled: false,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _phoneController,
              decoration: const InputDecoration(labelText: 'Phone Number'),
              keyboardType: TextInputType.phone,
            ),
          ]),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                if (widget.user != null) {
                  widget.onSave(
                    widget.user!.copyWith(
                      name: _nameController.text,
                      phone: _phoneController.text,
                    ),
                  );
                }
              },
              child: const Text('Save Profile'),
            ),
          ),
          const SizedBox(height: 32),
          _buildInfoCard('Security', LucideIcons.shield, [
            const Text(
              'Change Password',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text('Update your password to keep your account secure.'),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => ChangePasswordDialog(
                    onConfirm: (current, newPass, confirm) {
                      ref
                          .read(accountProvider.notifier)
                          .updatePassword(
                            currentPassword: current,
                            newPassword: newPass,
                            confirmPassword: confirm,
                          );
                    },
                  ),
                );
              },
              child: const Text('Change Password'),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _buildInfoCard(String title, IconData icon, List<Widget> children) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: Colors.blue),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            ...children,
          ],
        ),
      ),
    );
  }
}

class ChangePasswordDialog extends StatefulWidget {
  final void Function(String current, String newPass, String confirm) onConfirm;

  const ChangePasswordDialog({super.key, required this.onConfirm});

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Change Password'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _currentController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Current password',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _newController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'New password',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirmController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Confirm new password',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            final current = _currentController.text;
            final newPass = _newController.text;
            final confirm = _confirmController.text;
            if (newPass != confirm) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('New password and confirm do not match')),
              );
              return;
            }
            if (current.isEmpty || newPass.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Please fill all fields')),
              );
              return;
            }
            widget.onConfirm(current, newPass, confirm);
            if (context.mounted) Navigator.of(context).pop();
          },
          child: const Text('Change Password'),
        ),
      ],
    );
  }
}

class _BusinessTab extends ConsumerStatefulWidget {
  final BusinessSettings? settings;
  final Function(BusinessSettings) onSave;

  const _BusinessTab({this.settings, required this.onSave});

  @override
  ConsumerState<_BusinessTab> createState() => _BusinessTabState();
}

class _BusinessTabState extends ConsumerState<_BusinessTab> {
  late TextEditingController _nameController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.settings?.name);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadImage(BuildContext context, {required bool isLogo}) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery);
    if (file == null || !mounted) return;
    final path = file.path;
    if (path.isEmpty) return;
    final settings = widget.settings;
    if (settings == null) return;
    final notifier = ref.read(accountProvider.notifier);
    if (isLogo) {
      await notifier.updateBusinessSettings(settings, logoPath: path);
    } else {
      await notifier.updateBusinessSettings(settings, faviconPath: path);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.settings == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.building, size: 48, color: Colors.grey),
            SizedBox(height: 16),
            Text('No business settings available'),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(LucideIcons.building, size: 20, color: Colors.blue),
                      SizedBox(width: 8),
                      Text(
                        'Business Details',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  TextField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Business Name',
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: TextEditingController(
                      text: widget.settings?.subdomain,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Subdomain (Read-only)',
                    ),
                    enabled: false,
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Business Logo',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    height: 100,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.grey[100],
                      border: Border.all(color: Colors.grey[300]!),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: widget.settings?.logoUrl != null
                        ? Image.network(widget.settings!.logoUrl!) // Simplified
                        : const Center(
                            child: Icon(
                              LucideIcons.image,
                              size: 40,
                              color: Colors.grey,
                            ),
                          ),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () => _pickAndUploadImage(context, isLogo: true),
                    icon: const Icon(LucideIcons.upload),
                    label: const Text('Upload New Logo'),
                  ),
                  const Divider(height: 32),
                  const Text(
                    'Favicon',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    height: 64,
                    width: 64,
                    decoration: BoxDecoration(
                      color: Colors.grey[100],
                      border: Border.all(color: Colors.grey[300]!),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: widget.settings?.faviconUrl != null
                        ? Image.network(widget.settings!.faviconUrl!)
                        : const Center(
                            child: Icon(
                              LucideIcons.image,
                              size: 24,
                              color: Colors.grey,
                            ),
                          ),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () =>
                        _pickAndUploadImage(context, isLogo: false),
                    icon: const Icon(LucideIcons.upload),
                    label: const Text('Upload New Favicon'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                widget.onSave(
                  widget.settings!.copyWith(name: _nameController.text),
                );
              },
              child: const Text('Save Business Info'),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddressTab extends StatefulWidget {
  final BusinessSettings? settings;
  final Function(BusinessSettings) onSave;

  const _AddressTab({this.settings, required this.onSave});

  @override
  State<_AddressTab> createState() => _AddressTabState();
}

class _AddressTabState extends State<_AddressTab> {
  late TextEditingController _buildingController;
  late TextEditingController _streetController;
  late TextEditingController _cityController;
  late TextEditingController _phoneController;
  late TextEditingController _emailController;

  @override
  void initState() {
    super.initState();
    _buildingController = TextEditingController(
      text: widget.settings?.buildingName,
    );
    _streetController = TextEditingController(
      text: widget.settings?.businessAddress,
    );
    _cityController = TextEditingController(
      text: widget.settings?.businessCity,
    );
    _phoneController = TextEditingController(
      text: widget.settings?.businessPhone,
    );
    _emailController = TextEditingController(
      text: widget.settings?.businessEmail,
    );
  }

  @override
  void dispose() {
    _buildingController.dispose();
    _streetController.dispose();
    _cityController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.settings == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.mapPin, size: 48, color: Colors.grey),
            SizedBox(height: 16),
            Text('No address data available'),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(LucideIcons.mapPin, size: 20, color: Colors.green),
                      SizedBox(width: 8),
                      Text(
                        'Business Address',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  TextField(
                    controller: _buildingController,
                    decoration: const InputDecoration(
                      labelText: 'Building/Location Name',
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _streetController,
                    decoration: const InputDecoration(
                      labelText: 'Street Address',
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _cityController,
                    decoration: const InputDecoration(labelText: 'City/Town'),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _phoneController,
                    decoration: const InputDecoration(
                      labelText: 'Contact Phone',
                    ),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(
                      labelText: 'Public Email',
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                widget.onSave(
                  widget.settings!.copyWith(
                    buildingName: _buildingController.text,
                    businessAddress: _streetController.text,
                    businessCity: _cityController.text,
                    businessPhone: _phoneController.text,
                    businessEmail: _emailController.text,
                  ),
                );
              },
              child: const Text('Save Address'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsTab extends StatefulWidget {
  final BusinessSettings? settings;
  final Function(BusinessSettings) onSave;

  const _SettingsTab({this.settings, required this.onSave});

  @override
  State<_SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<_SettingsTab> {
  late TextEditingController _taxRateController;
  late TextEditingController _receiptFooterController;

  @override
  void initState() {
    super.initState();
    _taxRateController = TextEditingController(
      text: widget.settings?.defaultTaxRate.toString(),
    );
    _receiptFooterController = TextEditingController(
      text: widget.settings?.receiptFooter,
    );
  }

  @override
  void dispose() {
    _taxRateController.dispose();
    _receiptFooterController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.settings == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.settings, size: 48, color: Colors.grey),
            SizedBox(height: 16),
            Text('No system settings available'),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(LucideIcons.settings, size: 20, color: Colors.grey),
                      SizedBox(width: 8),
                      Text(
                        'System Settings',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  DropdownButtonFormField<String>(
                    initialValue: widget.settings?.currencyCode,
                    decoration: const InputDecoration(labelText: 'Currency'),
                    items: const [
                      DropdownMenuItem(
                        value: 'MWK',
                        child: Text('MWK - Malawian Kwacha'),
                      ),
                      DropdownMenuItem(
                        value: 'USD',
                        child: Text('USD - US Dollar'),
                      ),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        widget.onSave(
                          widget.settings!.copyWith(currencyCode: val),
                        );
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  SwitchListTile(
                    title: const Text('Tax Enabled'),
                    value: widget.settings?.taxEnabled ?? true,
                    onChanged: (val) {
                      widget.onSave(widget.settings!.copyWith(taxEnabled: val));
                    },
                    contentPadding: EdgeInsets.zero,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _taxRateController,
                    decoration: const InputDecoration(
                      labelText: 'Default Tax Rate (%)',
                    ),
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Receipt Settings',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _receiptFooterController,
                    decoration: const InputDecoration(
                      labelText: 'Receipt Footer Message',
                    ),
                    maxLines: 3,
                  ),
                  const Divider(height: 32),
                  const Row(
                    children: [
                      Icon(LucideIcons.palette, size: 20, color: Colors.grey),
                      SizedBox(width: 8),
                      Text(
                        'Branding & Emails',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: TextEditingController(
                      text: widget.settings?.primaryColor,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Primary Color (HEX)',
                      prefixIcon: Icon(LucideIcons.paintBucket),
                    ),
                    onChanged: (val) {
                      // Note: In a real app, we'd use a color picker or debounced save
                    },
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: TextEditingController(
                      text: widget.settings?.secondaryColor,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Secondary Color (HEX)',
                      prefixIcon: Icon(LucideIcons.paintBucket),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: TextEditingController(
                      text: widget.settings?.emailFooter,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Email Footer Message',
                    ),
                    maxLines: 2,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                widget.onSave(
                  widget.settings!.copyWith(
                    defaultTaxRate:
                        double.tryParse(_taxRateController.text) ?? 16.5,
                    receiptFooter: _receiptFooterController.text,
                  ),
                );
              },
              child: const Text('Save Settings'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SubscriptionTab extends StatelessWidget {
  final BusinessSettings? settings;
  final Function(BusinessSettings) onSave;

  const _SubscriptionTab({this.settings, required this.onSave});

  @override
  Widget build(BuildContext context) {
    if (settings == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(
                        LucideIcons.creditCard,
                        size: 20,
                        color: Colors.blue,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Subscription Details',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  _buildDetailRow(
                    'Current Plan',
                    settings?.subscriptionPlan ?? 'Basic',
                  ),
                  const SizedBox(height: 16),
                  _buildDetailRow('Status', 'Active', color: Colors.green),
                  const Divider(height: 32),
                  const Text(
                    'Domain Management',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: TextEditingController(
                      text: settings?.subdomain,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Built-in Subdomain',
                      helperText: 'example.insightbooksafrica.com',
                    ),
                    enabled: false,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: TextEditingController(
                      text: settings?.customDomain,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Custom Domain',
                      hintText: 'books.yourcompany.com',
                    ),
                    onSubmitted: (val) {
                      onSave(settings!.copyWith(customDomain: val));
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () async {
              final url = Uri.parse('https://insightbooksafrica.com/billing');
              if (await canLaunchUrl(url)) {
                await launchUrl(url, mode: LaunchMode.externalApplication);
              } else {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Could not open billing page'),
                    ),
                  );
                }
              }
            },
            icon: const Icon(LucideIcons.externalLink),
            label: const Text('Manage Billing on Web'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey)),
        Text(
          value,
          style: TextStyle(fontWeight: FontWeight.bold, color: color),
        ),
      ],
    );
  }
}

class _NotificationsTab extends StatelessWidget {
  final BusinessSettings? settings;
  final Function(BusinessSettings) onSave;

  const _NotificationsTab({this.settings, required this.onSave});

  @override
  Widget build(BuildContext context) {
    if (settings == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return ListView(
      padding: const EdgeInsets.all(16.0),
      children: [
        Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Icon(LucideIcons.bell, size: 20, color: Colors.orange),
                    SizedBox(width: 8),
                    Text(
                      'Global Notifications',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('Email Notifications'),
                subtitle: const Text('Receive reports and alerts via email'),
                value: settings?.emailNotifications ?? true,
                onChanged: (val) {
                  onSave(settings!.copyWith(emailNotifications: val));
                },
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('SMS Notifications'),
                subtitle: const Text('Get critical alerts on your phone'),
                value: settings?.smsNotifications ?? false,
                onChanged: (val) {
                  onSave(settings!.copyWith(smsNotifications: val));
                },
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('In-App Notifications'),
                subtitle: const Text('Show badges and popups in the app'),
                value: settings?.inAppNotifications ?? true,
                onChanged: (val) {
                  onSave(settings!.copyWith(inAppNotifications: val));
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16.0),
          child: Text(
            'Individual notification preferences can be tuned on the web dashboard.',
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        ),
      ],
    );
  }
}
