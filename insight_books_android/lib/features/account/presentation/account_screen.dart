import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/features/account/data/account_repository.dart';
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

    if (!state.canViewSystem) {
      return Scaffold(
        appBar: AppBar(title: const Text('Account & Settings')),
        drawer: const AppDrawer(),
        body: const Center(
          child: Text('You do not have permission to view this page.'),
        ),
      );
    }

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
            Tab(text: 'Business', icon: Icon(LucideIcons.building, size: 20)),
            Tab(text: 'Receipt', icon: Icon(LucideIcons.fileText, size: 20)),
            Tab(text: 'Settings', icon: Icon(LucideIcons.settings, size: 20)),
            Tab(text: 'Templates', icon: Icon(LucideIcons.layoutTemplate, size: 20)),
            Tab(text: 'Notifications', icon: Icon(LucideIcons.bell, size: 20)),
            Tab(text: 'Legal', icon: Icon(LucideIcons.shield, size: 20)),
          ],
        ),
      ),
      drawer: const AppDrawer(),
      body: Column(
        children: [
          if (state.successMessage != null)
            Container(
              padding: const EdgeInsets.all(8.0),
              color: Colors.green[50],
              width: double.infinity,
              child: Row(
                children: [
                  const Icon(
                    LucideIcons.checkCircle2,
                    color: Colors.green,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      state.successMessage!,
                      style: const TextStyle(color: Colors.green, fontSize: 13),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(LucideIcons.x, size: 16),
                    onPressed: notifier.clearMessages,
                  ),
                ],
              ),
            ),
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
          if (!state.canUpdateSystem)
            Container(
              padding: const EdgeInsets.all(8.0),
              color: Colors.orange[50],
              width: double.infinity,
              child: const Text(
                'Read-only mode: you do not have permission to update system settings.',
                style: TextStyle(color: Colors.orange, fontSize: 13),
              ),
            ),
          Expanded(
            child: state.isLoading && state.user == null
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _BusinessTab(
                        settings: state.settings,
                        onSave: notifier.updateBusinessSettings,
                      ),
                      _ReceiptTab(
                        settings: state.settings,
                        onSave: notifier.updateBusinessSettings,
                      ),
                      _SettingsTab(
                        user: state.user,
                        settings: state.settings,
                        onSave: notifier.updateBusinessSettings,
                      ),
                      _InvoiceTemplatesTab(
                        templates: state.invoiceTemplates,
                      ),
                      _NotificationsTab(
                        settings: state.settings,
                        onSave: notifier.updateBusinessSettings,
                      ),
                      const _LegalTab(),
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
  late TextEditingController _buildingController;
  late TextEditingController _streetController;
  late TextEditingController _cityController;
  late TextEditingController _phoneController;
  late TextEditingController _emailController;
  late TextEditingController _tpinController;
  late TextEditingController _bankDetailsController;
  late TextEditingController _primaryColorController;
  late TextEditingController _secondaryColorController;
  String? _defaultBranchId;
  List<Map<String, dynamic>> _branches = const [];
  List<Map<String, dynamic>> _accounts = const [];
  String? _taxOutflowAccountId;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.settings?.name);
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
    _tpinController = TextEditingController(text: widget.settings?.tpin);
    _bankDetailsController = TextEditingController(
      text: widget.settings?.defaultBankDetails,
    );
    _primaryColorController = TextEditingController(
      text: widget.settings?.primaryColor ?? '#4f46e5',
    );
    _secondaryColorController = TextEditingController(
      text: widget.settings?.secondaryColor ?? '#7c3aed',
    );
    _defaultBranchId = widget.settings?.defaultBranchId;
    _taxOutflowAccountId = widget.settings?.taxOutflowAccountId;
    _loadBranches();
    _loadAccounts();
  }

  Future<void> _loadBranches() async {
    try {
      final rows = await ref.read(accountRepositoryProvider).fetchBranches();
      if (!mounted) return;
      setState(() {
        _branches = rows;
      });
    } catch (_) {}
  }

  Future<void> _loadAccounts() async {
    try {
      final rows = await ref.read(accountRepositoryProvider).fetchChartAccounts();
      if (!mounted) return;
      setState(() {
        _accounts = rows;
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _nameController.dispose();
    _buildingController.dispose();
    _streetController.dispose();
    _cityController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _tpinController.dispose();
    _bankDetailsController.dispose();
    _primaryColorController.dispose();
    _secondaryColorController.dispose();
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
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: _defaultBranchId,
                    decoration: const InputDecoration(
                      labelText: 'Default Branch',
                    ),
                    items: [
                      const DropdownMenuItem<String>(
                        value: '',
                        child: Text('None (user default / all branches)'),
                      ),
                      ..._branches
                          .where((b) => (b['isActive'] ?? true) == true)
                          .map(
                            (b) => DropdownMenuItem<String>(
                              value: (b['id'] ?? '').toString(),
                              child: Text(
                                '${b['name'] ?? 'Branch'}${(b['code'] ?? '').toString().isNotEmpty ? ' (${b['code']})' : ''}',
                              ),
                            ),
                          ),
                    ],
                    onChanged: (v) => setState(() => _defaultBranchId = v),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _tpinController,
                    decoration: const InputDecoration(
                      labelText: 'TPIN (8 digits)',
                    ),
                    keyboardType: TextInputType.number,
                    maxLength: 8,
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
                  const SizedBox(height: 12),
                  TextField(
                    controller: _primaryColorController,
                    decoration: const InputDecoration(
                      labelText: 'Primary Color (HEX)',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _secondaryColorController,
                    decoration: const InputDecoration(
                      labelText: 'Secondary Color (HEX)',
                    ),
                  ),
                  const Divider(height: 32),
                  const Text(
                    'Business Address',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _buildingController,
                    decoration: const InputDecoration(
                      labelText: 'Building/Location Name',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _streetController,
                    decoration: const InputDecoration(labelText: 'Street Address'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _cityController,
                    decoration: const InputDecoration(labelText: 'City/Town'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _phoneController,
                    decoration: const InputDecoration(labelText: 'Contact Numbers'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(labelText: 'Business Email'),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const Divider(height: 32),
                  const Text(
                    'Default Bank Account Details',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _bankDetailsController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Bank details footer block',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _taxOutflowAccountId,
                    decoration: const InputDecoration(
                      labelText: 'Tax Outflow Account (optional)',
                    ),
                    items: [
                      const DropdownMenuItem<String>(
                        value: '',
                        child: Text('Use default tax account'),
                      ),
                      ..._accounts.map(
                        (a) => DropdownMenuItem<String>(
                          value: (a['id'] ?? '').toString(),
                          child: Text(
                            '${a['accountCode'] ?? ''} - ${a['accountName'] ?? a['name'] ?? 'Account'}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _taxOutflowAccountId = v),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _nameController.text = widget.settings?.name ?? '';
                      _buildingController.text = widget.settings?.buildingName ?? '';
                      _streetController.text = widget.settings?.businessAddress ?? '';
                      _cityController.text = widget.settings?.businessCity ?? '';
                      _phoneController.text = widget.settings?.businessPhone ?? '';
                      _emailController.text = widget.settings?.businessEmail ?? '';
                      _tpinController.text = widget.settings?.tpin ?? '';
                      _bankDetailsController.text = widget.settings?.defaultBankDetails ?? '';
                      _defaultBranchId = widget.settings?.defaultBranchId;
                      _taxOutflowAccountId = widget.settings?.taxOutflowAccountId;
                      _primaryColorController.text = widget.settings?.primaryColor ?? '#4f46e5';
                      _secondaryColorController.text = widget.settings?.secondaryColor ?? '#7c3aed';
                    });
                  },
                  child: const Text('Discard'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    widget.onSave(
                      widget.settings!.copyWith(
                        name: _nameController.text,
                        defaultBranchId: (_defaultBranchId ?? '').isEmpty
                            ? null
                            : _defaultBranchId,
                        tpin: _tpinController.text.trim().isEmpty
                            ? null
                            : _tpinController.text.trim(),
                        buildingName: _buildingController.text,
                        businessAddress: _streetController.text,
                        businessCity: _cityController.text,
                        businessPhone: _phoneController.text,
                        businessEmail: _emailController.text,
                        defaultBankDetails: _bankDetailsController.text,
                        taxOutflowAccountId:
                            (_taxOutflowAccountId ?? '').isEmpty ? null : _taxOutflowAccountId,
                        primaryColor: _primaryColorController.text.trim().isEmpty
                            ? (widget.settings?.primaryColor ?? '#4f46e5')
                            : _primaryColorController.text.trim(),
                        secondaryColor:
                            _secondaryColorController.text.trim().isEmpty
                            ? (widget.settings?.secondaryColor ?? '#7c3aed')
                            : _secondaryColorController.text.trim(),
                      ),
                    );
                  },
                  child: const Text('Save Business Info'),
                ),
              ),
            ],
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

class _ReceiptTab extends StatefulWidget {
  final BusinessSettings? settings;
  final Function(BusinessSettings) onSave;

  const _ReceiptTab({this.settings, required this.onSave});

  @override
  State<_ReceiptTab> createState() => _ReceiptTabState();
}

class _ReceiptTabState extends State<_ReceiptTab> {
  late TextEditingController _receiptFooterController;
  late TextEditingController _taxRateController;
  String _currencyCode = 'MWK';
  bool _taxEnabled = true;

  @override
  void initState() {
    super.initState();
    _receiptFooterController = TextEditingController(
      text: widget.settings?.receiptFooter,
    );
    _taxRateController = TextEditingController(
      text: (widget.settings?.defaultTaxRate ?? 16.5).toString(),
    );
    _currencyCode = widget.settings?.currencyCode ?? 'MWK';
    _taxEnabled = widget.settings?.taxEnabled ?? true;
  }

  @override
  void dispose() {
    _receiptFooterController.dispose();
    _taxRateController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.settings == null) {
      return const Center(child: CircularProgressIndicator());
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Receipt Customization',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _receiptFooterController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Receipt Footer Message',
                  ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _currencyCode,
                  decoration: const InputDecoration(labelText: 'Currency'),
                  items: const [
                    DropdownMenuItem(value: 'MWK', child: Text('MWK - Malawian Kwacha')),
                    DropdownMenuItem(value: 'USD', child: Text('USD - US Dollar')),
                    DropdownMenuItem(value: 'EUR', child: Text('EUR - Euro')),
                    DropdownMenuItem(value: 'GBP', child: Text('GBP - British Pound')),
                    DropdownMenuItem(value: 'ZAR', child: Text('ZAR - South African Rand')),
                  ],
                  onChanged: (v) => setState(() => _currencyCode = v ?? 'MWK'),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _taxRateController,
                  decoration: const InputDecoration(labelText: 'Default Tax Rate (%)'),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Tax Enabled'),
                  value: _taxEnabled,
                  onChanged: (v) => setState(() => _taxEnabled = v),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () {
                  setState(() {
                    _receiptFooterController.text = widget.settings?.receiptFooter ?? '';
                    _taxRateController.text = (widget.settings?.defaultTaxRate ?? 16.5).toString();
                    _currencyCode = widget.settings?.currencyCode ?? 'MWK';
                    _taxEnabled = widget.settings?.taxEnabled ?? true;
                  });
                },
                child: const Text('Discard'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: () {
                  widget.onSave(
                    widget.settings!.copyWith(
                      receiptFooter: _receiptFooterController.text,
                      currencyCode: _currencyCode,
                      defaultTaxRate: double.tryParse(_taxRateController.text) ?? 16.5,
                      taxEnabled: _taxEnabled,
                    ),
                  );
                },
                child: const Text('Save Receipt Settings'),
              ),
            ),
          ],
        ),
      ],
    );
  }
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

class _SettingsTab extends ConsumerStatefulWidget {
  final User? user;
  final BusinessSettings? settings;
  final Function(BusinessSettings) onSave;

  const _SettingsTab({
    this.user,
    this.settings,
    required this.onSave,
  });

  @override
  ConsumerState<_SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends ConsumerState<_SettingsTab> {
  late TextEditingController _customDomainController;
  late TextEditingController _emailFooterController;

  @override
  void initState() {
    super.initState();
    _customDomainController = TextEditingController(
      text: widget.settings?.customDomain,
    );
    _emailFooterController = TextEditingController(
      text: widget.settings?.emailFooter,
    );
  }

  @override
  void dispose() {
    _customDomainController.dispose();
    _emailFooterController.dispose();
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
                      Icon(LucideIcons.user, size: 20, color: Colors.blue),
                      SizedBox(width: 8),
                      Text(
                        'Account Information',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  TextField(
                    controller: TextEditingController(
                      text: widget.settings?.subscriptionPlan ?? '',
                    ),
                    decoration: const InputDecoration(labelText: 'Subscription Plan'),
                    enabled: false,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _customDomainController,
                    decoration: const InputDecoration(
                      labelText: 'Custom Domain',
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _emailFooterController,
                    decoration: const InputDecoration(
                      labelText: 'Email Footer',
                    ),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 24),
                  const Row(
                    children: [
                      Icon(LucideIcons.shield, size: 20, color: Colors.grey),
                      SizedBox(width: 8),
                      Text(
                        'Security',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
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
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _customDomainController.text = widget.settings?.customDomain ?? '';
                      _emailFooterController.text = widget.settings?.emailFooter ?? '';
                    });
                  },
                  child: const Text('Discard'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    widget.onSave(
                      widget.settings!.copyWith(
                        customDomain: _customDomainController.text,
                        emailFooter: _emailFooterController.text,
                      ),
                    );
                  },
                  child: const Text('Save Account'),
                ),
              ),
            ],
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

class _NotificationsTab extends StatefulWidget {
  final BusinessSettings? settings;
  final Function(BusinessSettings) onSave;

  const _NotificationsTab({this.settings, required this.onSave});

  @override
  State<_NotificationsTab> createState() => _NotificationsTabState();
}

class _NotificationsTabState extends State<_NotificationsTab> {
  late BusinessSettings _draft;

  @override
  void initState() {
    super.initState();
    _draft = widget.settings ??
        const BusinessSettings(
          name: '',
        );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.settings == null) {
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
                value: _draft.emailNotifications,
                onChanged: (val) {
                  setState(() => _draft = _draft.copyWith(emailNotifications: val));
                },
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('SMS Notifications'),
                subtitle: const Text('Get critical alerts on your phone'),
                value: _draft.smsNotifications,
                onChanged: (val) {
                  setState(() => _draft = _draft.copyWith(smsNotifications: val));
                },
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('In-App Notifications'),
                subtitle: const Text('Show badges and popups in the app'),
                value: _draft.inAppNotifications,
                onChanged: (val) {
                  setState(() => _draft = _draft.copyWith(inAppNotifications: val));
                },
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('Invoice Reminders'),
                subtitle: const Text('Alerts for due and overdue invoices'),
                value: _draft.invoiceReminders,
                onChanged: (val) =>
                    setState(() => _draft = _draft.copyWith(invoiceReminders: val)),
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('Low Stock Alerts'),
                subtitle: const Text('Notify when stock levels are low'),
                value: _draft.lowStockAlerts,
                onChanged: (val) =>
                    setState(() => _draft = _draft.copyWith(lowStockAlerts: val)),
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('Payment Receipts'),
                subtitle: const Text('Notify when payment receipts are issued'),
                value: _draft.paymentReceipts,
                onChanged: (val) =>
                    setState(() => _draft = _draft.copyWith(paymentReceipts: val)),
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('Daily Reports'),
                subtitle: const Text('Sent each day'),
                value: _draft.dailyReports,
                onChanged: (val) =>
                    setState(() => _draft = _draft.copyWith(dailyReports: val)),
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('Weekly Reports'),
                subtitle: const Text('Sent weekly'),
                value: _draft.weeklyReports,
                onChanged: (val) =>
                    setState(() => _draft = _draft.copyWith(weeklyReports: val)),
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('Monthly Reports'),
                subtitle: const Text('Sent monthly'),
                value: _draft.monthlyReports,
                onChanged: (val) =>
                    setState(() => _draft = _draft.copyWith(monthlyReports: val)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () {
                  setState(() {
                    _draft = widget.settings!;
                  });
                },
                child: const Text('Discard'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: () => widget.onSave(_draft),
                child: const Text('Save Notifications'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
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

class _LegalTab extends StatelessWidget {
  const _LegalTab();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(LucideIcons.shield, size: 20, color: Colors.grey),
                    SizedBox(width: 8),
                    Text(
                      'Legal Information',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(LucideIcons.fileText),
                  title: const Text('Terms of Service'),
                  subtitle: const Text('Read our terms and conditions'),
                  onTap: () async {
                    final uri = Uri.parse('https://insightbooksafrica.com/terms');
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    }
                  },
                ),
                const Divider(),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(LucideIcons.shieldCheck),
                  title: const Text('Privacy Policy'),
                  subtitle: const Text('Learn about data protection'),
                  onTap: () async {
                    final uri = Uri.parse('https://insightbooksafrica.com/privacy');
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    }
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _InvoiceTemplatesTab extends ConsumerStatefulWidget {
  final List<Map<String, dynamic>> templates;
  const _InvoiceTemplatesTab({required this.templates});

  @override
  ConsumerState<_InvoiceTemplatesTab> createState() => _InvoiceTemplatesTabState();
}

class _InvoiceTemplatesTabState extends ConsumerState<_InvoiceTemplatesTab> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(accountProvider.notifier).loadInvoiceTemplates());
  }

  Future<void> _createTemplate() async {
    final ctrl = TextEditingController(text: 'New Template');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create Template'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(labelText: 'Template name'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(accountProvider.notifier).createInvoiceTemplate(
            name: ctrl.text.trim().isEmpty ? 'New Template' : ctrl.text.trim(),
            content: '{}',
          );
    }
  }

  Future<void> _editTemplate(Map<String, dynamic> t) async {
    final nameCtrl = TextEditingController(text: '${t['name'] ?? ''}');
    final contentCtrl = TextEditingController(text: '${t['content'] ?? '{}'}');
    final snapshotName = nameCtrl.text;
    final snapshotContent = contentCtrl.text;
    bool dirty = false;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (_, setDialog) => AlertDialog(
          title: const Text('Edit Template'),
          content: SizedBox(
            width: 520,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Template name'),
                  onChanged: (_) => setDialog(() => dirty = true),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: contentCtrl,
                  minLines: 5,
                  maxLines: 10,
                  decoration: const InputDecoration(labelText: 'Template content (JSON/raw)'),
                  onChanged: (_) => setDialog(() => dirty = true),
                ),
              ],
            ),
          ),
          actions: [
            if (dirty)
              TextButton(
                onPressed: () {
                  nameCtrl.text = snapshotName;
                  contentCtrl.text = snapshotContent;
                  setDialog(() => dirty = false);
                },
                child: const Text('Discard'),
              ),
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
            FilledButton(
              onPressed: () async {
                await ref.read(accountProvider.notifier).updateInvoiceTemplate(
                      id: '${t['id']}',
                      name: nameCtrl.text.trim().isEmpty ? '${t['name'] ?? 'Template'}' : nameCtrl.text.trim(),
                      content: contentCtrl.text.trim().isEmpty ? '{}' : contentCtrl.text.trim(),
                      isDefault: (t['isDefault'] ?? false) == true,
                    );
                if (ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(accountProvider);
    final templates = state.invoiceTemplates;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Invoice Template Management',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            OutlinedButton.icon(
              onPressed: state.canUpdateSystem ? _createTemplate : null,
              icon: const Icon(LucideIcons.plus, size: 16),
              label: const Text('Add'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (templates.isEmpty)
          const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('No templates found')))
        else
          ...templates.map((t) {
            final isDefault = (t['isDefault'] ?? false) == true;
            return Card(
              child: ListTile(
                title: Text('${t['name'] ?? 'Template'}'),
                subtitle: Text(isDefault ? 'Default template' : 'Custom template'),
                trailing: Wrap(
                  spacing: 6,
                  children: [
                    if (!isDefault)
                      TextButton(
                        onPressed: state.canUpdateSystem
                            ? () => ref.read(accountProvider.notifier).setDefaultInvoiceTemplate('${t['id']}')
                            : null,
                        child: const Text('Set default'),
                      ),
                    IconButton(
                      tooltip: 'Preview',
                      onPressed: () => _showTemplatePreview(t),
                      icon: const Icon(LucideIcons.eye, size: 18),
                    ),
                    IconButton(
                      tooltip: 'Edit',
                      onPressed: state.canUpdateSystem ? () => _editTemplate(t) : null,
                      icon: const Icon(LucideIcons.pencil, size: 18),
                    ),
                    if (!isDefault)
                      IconButton(
                        tooltip: 'Delete',
                        onPressed: state.canUpdateSystem
                            ? () => ref.read(accountProvider.notifier).deleteInvoiceTemplate('${t['id']}')
                            : null,
                        icon: const Icon(LucideIcons.trash2, size: 18),
                      ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }

  Future<void> _showTemplatePreview(Map<String, dynamic> t) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${t['name'] ?? 'Template'} Preview'),
        content: SizedBox(
          width: 520,
          child: SingleChildScrollView(
            child: Text('${t['content'] ?? '{}'}'),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }
}
