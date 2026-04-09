import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:insightbooks_android/core/theme/app_theme.dart';
import 'package:insightbooks_android/features/account/presentation/providers/account_provider.dart';
import 'package:insightbooks_android/features/account/data/account_repository.dart';
import 'package:insightbooks_android/features/account/domain/user_model.dart';
import 'package:insightbooks_android/features/account/domain/business_settings.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';
import 'package:insightbooks_android/core/config/app_public_urls.dart';
import 'package:insightbooks_android/shared/legal/legal_document_screen.dart';
import 'package:image_picker/image_picker.dart';

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
        appBar: AppBar(title: const Text('Account Settings')),
        drawer: const AppDrawer(),
        body: const Center(
          child: Text('You do not have permission to view this page.'),
        ),
      );
    }

    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Account Settings', style: theme.textTheme.titleLarge),
            Text(
              'Manage business information, receipts, and account preferences.',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.normal,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
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
            Tab(text: 'Business Info', icon: Icon(LucideIcons.building, size: 20)),
            Tab(text: 'Receipt', icon: Icon(LucideIcons.fileText, size: 20)),
            Tab(text: 'Account', icon: Icon(LucideIcons.user, size: 20)),
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
              color: AppTheme.successBg(context),
              width: double.infinity,
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
                      state.successMessage!,
                      style: TextStyle(
                        color: AppTheme.successColor(context),
                        fontSize: 13,
                      ),
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
              color: AppTheme.errorBg(context),
              width: double.infinity,
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
                      state.error!,
                      style: TextStyle(
                        color: AppTheme.errorColor(context),
                        fontSize: 13,
                      ),
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
              color: AppTheme.warningBg(context),
              width: double.infinity,
              child: Text(
                'Read-only mode: you do not have permission to update system settings.',
                style: TextStyle(
                  color: AppTheme.warningColor(context),
                  fontSize: 13,
                ),
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
          ? FloatingActionButton(
              onPressed: null,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: CircularProgressIndicator(
                  color: theme.colorScheme.onPrimary,
                  strokeWidth: 2,
                ),
              ),
            )
          : null,
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
  late TextEditingController _subdomainController;
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
    _subdomainController = TextEditingController(
      text: widget.settings?.subdomain,
    );
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

  String? _loadError;

  Future<void> _loadBranches() async {
    try {
      final rows = await ref.read(accountRepositoryProvider).fetchBranches();
      if (!mounted) return;
      setState(() => _branches = rows);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadError = 'Could not load branches');
      debugPrint('[AccountScreen] branches load failed: $e');
    }
  }

  Future<void> _loadAccounts() async {
    try {
      final rows = await ref.read(accountRepositoryProvider).fetchChartAccounts();
      if (!mounted) return;
      setState(() => _accounts = rows);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadError = 'Could not load accounts');
      debugPrint('[AccountScreen] accounts load failed: $e');
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _subdomainController.dispose();
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
    final theme = Theme.of(context);

    if (widget.settings == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.building, size: 48, color: AppTheme.textSecondary(context)),
            const SizedBox(height: 16),
            const Text('No business settings available'),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          if (_loadError != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                color: theme.colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded,
                          color: theme.colorScheme.onErrorContainer, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _loadError!,
                          style: TextStyle(
                              color: theme.colorScheme.onErrorContainer,
                              fontSize: 13),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          setState(() => _loadError = null);
                          _loadBranches();
                          _loadAccounts();
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(LucideIcons.building, size: 20, color: AppTheme.infoColor(context)),
                      const SizedBox(width: 8),
                      const Text(
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
                    controller: _subdomainController,
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
                      labelText: 'Taxpayer Identification Number (TPIN)',
                      helperText:
                          '8-digit TPIN from Malawi Revenue Authority (MRA EIS)',
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
                      color: theme.colorScheme.surfaceContainerHigh,
                      border: Border.all(color: AppTheme.borderColor(context)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: resolveAppAssetUrl(widget.settings?.logoUrl) != null
                        ? Image.network(
                            resolveAppAssetUrl(widget.settings!.logoUrl)!,
                            fit: BoxFit.contain,
                          )
                        : Center(
                            child: Icon(
                              LucideIcons.image,
                              size: 40,
                              color: AppTheme.textSecondary(context),
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
                      color: theme.colorScheme.surfaceContainerHigh,
                      border: Border.all(color: AppTheme.borderColor(context)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: resolveAppAssetUrl(widget.settings?.faviconUrl) != null
                        ? Image.network(
                            resolveAppAssetUrl(widget.settings!.faviconUrl)!,
                            fit: BoxFit.contain,
                          )
                        : Center(
                            child: Icon(
                              LucideIcons.image,
                              size: 24,
                              color: AppTheme.textSecondary(context),
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
                    'Banking & tax',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Default bank details and default tax accounts (inflow & outflow). Shown in invoice, quotation and receipt footers where applicable.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary(context),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _bankDetailsController,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'Default bank account details',
                      hintText:
                          'Bank: …\nAccount name: …\nAccount number: …\nBranch: …',
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Default tax accounts (fixed)',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Tax is always recorded to these system accounts. They cannot be changed by tenants.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary(context),
                    ),
                  ),
                  const SizedBox(height: 10),
                  _TaxAccountInfoTile(
                    label: 'Tax inflow (collected)',
                    accountLine: '2041 – Tax Inflow (Collected)',
                    hint: 'Tax from sales, invoices and POS',
                  ),
                  const SizedBox(height: 8),
                  _TaxAccountInfoTile(
                    label: 'Tax outflow (paid)',
                    accountLine: '2045 – Tax Outflow (Paid)',
                    hint: 'Tax on expenses and supplier bills',
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Optional: link a chart account for tax outflow overrides (tenant default).',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppTheme.textSecondary(context),
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: _taxOutflowAccountId,
                    decoration: const InputDecoration(
                      labelText: 'Tax outflow account (optional)',
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
                      _subdomainController.text = widget.settings?.subdomain ?? '';
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
                const SizedBox(height: 8),
                Text(
                  'Customize the footer message that appears on your receipts.',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppTheme.textSecondary(context),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _receiptFooterController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Receipt Footer Message',
                    helperText:
                        'Appears at the bottom of receipts. Leave empty to use the default.',
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Business settings',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _currencyCode,
                  decoration: const InputDecoration(labelText: 'Currency Code'),
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
  late TextEditingController _subscriptionPlanController;
  late TextEditingController _customDomainController;
  late TextEditingController _emailFooterController;

  @override
  void initState() {
    super.initState();
    _subscriptionPlanController = TextEditingController(
      text: widget.settings?.subscriptionPlan ?? '',
    );
    _customDomainController = TextEditingController(
      text: widget.settings?.customDomain,
    );
    _emailFooterController = TextEditingController(
      text: widget.settings?.emailFooter,
    );
  }

  @override
  void dispose() {
    _subscriptionPlanController.dispose();
    _customDomainController.dispose();
    _emailFooterController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.settings == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.settings, size: 48, color: AppTheme.textSecondary(context)),
            const SizedBox(height: 16),
            const Text('No system settings available'),
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
                  Row(
                    children: [
                      Icon(LucideIcons.user, size: 20, color: AppTheme.infoColor(context)),
                      const SizedBox(width: 8),
                      const Text(
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
                    controller: _subscriptionPlanController,
                    decoration: const InputDecoration(labelText: 'Subscription Plan'),
                    enabled: false,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _customDomainController,
                    decoration: const InputDecoration(
                      labelText: 'Custom Domain',
                      hintText: 'yourbusiness.com',
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _emailFooterController,
                    decoration: const InputDecoration(
                      labelText: 'Email Footer',
                      hintText: 'Custom footer for email communications…',
                    ),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Icon(
                        LucideIcons.shield,
                        size: 20,
                        color: AppTheme.textSecondary(context),
                      ),
                      const SizedBox(width: 8),
                      const Text(
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
                      _subscriptionPlanController.text =
                          widget.settings?.subscriptionPlan ?? '';
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
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          LucideIcons.bell,
                          size: 20,
                          color: AppTheme.warningColor(context),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'Notification Preferences',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Choose how you want to receive notifications about your business.',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppTheme.textSecondary(context),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('Email Notifications'),
                subtitle: const Text('Receive important updates via email'),
                value: _draft.emailNotifications,
                onChanged: (val) {
                  setState(() => _draft = _draft.copyWith(emailNotifications: val));
                },
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('SMS Notifications'),
                subtitle: const Text('Receive urgent alerts via SMS'),
                value: _draft.smsNotifications,
                onChanged: (val) {
                  setState(() => _draft = _draft.copyWith(smsNotifications: val));
                },
              ),
              const Divider(height: 1),
              SwitchListTile(
                title: const Text('In-App Notifications'),
                subtitle: const Text('Receive notifications within the application'),
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
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Text(
            'Individual notification preferences can be tuned on the web dashboard.',
            style: TextStyle(
              color: AppTheme.textSecondary(context),
              fontSize: 12,
            ),
          ),
        ),
      ],
    );
  }
}

/// Read-only info matching web account "Default tax accounts (fixed)".
class _TaxAccountInfoTile extends StatelessWidget {
  final String label;
  final String accountLine;
  final String hint;

  const _TaxAccountInfoTile({
    required this.label,
    required this.accountLine,
    required this.hint,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.borderColor(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: AppTheme.textSecondary(context),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            accountLine,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            hint,
            style: TextStyle(
              fontSize: 12,
              color: AppTheme.textSecondary(context),
            ),
          ),
        ],
      ),
    );
  }
}

/// Same content as web `/account?tab=legal`: Terms (`/terms`) and Privacy (`/privacy`) on the app host.
class _LegalTab extends StatelessWidget {
  const _LegalTab();

  void _openInApp(BuildContext context, {required Uri uri, required String title}) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => LegalDocumentScreen(uri: uri, title: title),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final termsUri = uriTermsOfService();
    final privacyUri = uriPrivacyPolicy();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      LucideIcons.shield,
                      size: 22,
                      color: AppTheme.textSecondary(context),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Legal Information',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Important legal documents and policies for your business.',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.textSecondary(context),
                  ),
                ),
                const SizedBox(height: 16),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final wide = constraints.maxWidth >= 520;
                    final termsCard = _LegalLinkCard(
                      icon: LucideIcons.fileText,
                      iconColor: AppTheme.infoColor(context),
                      title: 'Terms of Service',
                      subtitle: 'Read our terms and conditions',
                      onTap: () => _openInApp(
                        context,
                        uri: termsUri,
                        title: 'Terms of Service',
                      ),
                    );
                    final privacyCard = _LegalLinkCard(
                      icon: LucideIcons.shield,
                      iconColor: AppTheme.successColor(context),
                      title: 'Privacy Policy',
                      subtitle: 'Learn about data protection',
                      onTap: () => _openInApp(
                        context,
                        uri: privacyUri,
                        title: 'Privacy Policy',
                      ),
                    );
                    if (wide) {
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: termsCard),
                          const SizedBox(width: 12),
                          Expanded(child: privacyCard),
                        ],
                      );
                    }
                    return Column(
                      children: [
                        termsCard,
                        const SizedBox(height: 12),
                        privacyCard,
                      ],
                    );
                  },
                ),
                const SizedBox(height: 12),
                Text(
                  'Same content as the website; shown inside the app.',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppTheme.textSecondary(context),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _LegalLinkCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _LegalLinkCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(color: AppTheme.borderColor(context)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Icon(icon, size: 22, color: iconColor),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 13,
                        color: AppTheme.textSecondary(context),
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.open_in_new,
                size: 18,
                color: AppTheme.textSecondary(context),
              ),
            ],
          ),
        ),
      ),
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
