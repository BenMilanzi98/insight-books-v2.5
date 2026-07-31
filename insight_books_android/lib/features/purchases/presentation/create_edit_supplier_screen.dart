import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../data/purchases_offline_helpers.dart';
import '../data/purchases_repository.dart';
import 'providers/suppliers_provider.dart';

const _paymentPreferences = [
  '',
  'Cash',
  'Bank transfer',
  'Card',
  'Mobile Money',
  'Cheque',
  'Other',
];

class CreateEditSupplierScreen extends ConsumerStatefulWidget {
  final String? supplierId;

  const CreateEditSupplierScreen({super.key, this.supplierId});

  @override
  ConsumerState<CreateEditSupplierScreen> createState() =>
      _CreateEditSupplierScreenState();
}

class _CreateEditSupplierScreenState
    extends ConsumerState<CreateEditSupplierScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _paymentTermsCtrl = TextEditingController(text: '30');
  final _currencyCtrl = TextEditingController(text: 'MWK');
  final _notesCtrl = TextEditingController();

  String _paymentPreference = '';
  bool _isActive = true;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _loadError;

  bool get _isEdit =>
      widget.supplierId != null && widget.supplierId!.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      _loadSupplier();
    } else {
      _isLoading = false;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _contactCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _paymentTermsCtrl.dispose();
    _currencyCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSupplier() async {
    setState(() {
      _isLoading = true;
      _loadError = null;
    });
    try {
      final repo = ref.read(purchasesRepositoryProvider);
      final supplier = await repo.fetchSupplier(widget.supplierId!);
      if (!mounted) return;
      _nameCtrl.text = supplier.supplierName;
      _contactCtrl.text = supplier.contactPerson ?? '';
      _emailCtrl.text = supplier.email ?? '';
      _phoneCtrl.text = supplier.phone ?? '';
      _addressCtrl.text = supplier.address ?? '';
      _paymentTermsCtrl.text = '${supplier.paymentTerms ?? 30}';
      _paymentPreference = supplier.paymentPreference ?? '';
      _currencyCtrl.text = supplier.currency ?? 'MWK';
      _notesCtrl.text = supplier.notes ?? '';
      _isActive = supplier.isActive;
      setState(() => _isLoading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _loadError = NetworkErrorMapper.toUserMessage(e);
      });
    }
  }

  Map<String, dynamic> _buildBody() {
    final paymentTerms = int.tryParse(_paymentTermsCtrl.text.trim()) ?? 30;
    return {
      'supplierName': _nameCtrl.text.trim(),
      'contactPerson': _nullIfEmpty(_contactCtrl.text),
      'email': _nullIfEmpty(_emailCtrl.text),
      'phone': _nullIfEmpty(_phoneCtrl.text),
      'address': _nullIfEmpty(_addressCtrl.text),
      'paymentTerms': paymentTerms,
      'paymentPreference': _paymentPreference.isEmpty ? null : _paymentPreference,
      'currency': _nullIfEmpty(_currencyCtrl.text) ?? 'MWK',
      'notes': _nullIfEmpty(_notesCtrl.text),
      'isActive': _isActive,
    };
  }

  String? _nullIfEmpty(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  bool _validateEmail(String? value) {
    if (value == null || value.trim().isEmpty) return true;
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value.trim());
  }

  bool _validatePhone(String? value) {
    if (value == null || value.trim().isEmpty) return true;
    final phoneRegex = RegExp(
      r'^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$',
    );
    return phoneRegex.hasMatch(value.replaceAll(' ', ''));
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    final body = _buildBody();
    final notifier = ref.read(suppliersControllerProvider.notifier);

    try {
      if (_isEdit) {
        await notifier.updateSupplier(widget.supplierId!, body);
      } else {
        await notifier.createSupplier(body);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEdit ? 'Supplier updated' : 'Supplier created'),
        ),
      );
      context.pop();
    } on PurchasesQueuedException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Queued for sync')),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(NetworkErrorMapper.toUserMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final page = ref.watch(suppliersControllerProvider);
    final canSave = _isEdit ? page.canUpdate : page.canCreate;

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit supplier' : 'New supplier'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: const [ThemeToggleButton()],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_loadError!),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: _loadSupplier,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : SafeArea(
                  child: Form(
                    key: _formKey,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        TextFormField(
                          controller: _nameCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Supplier name *',
                            border: OutlineInputBorder(),
                          ),
                          textCapitalization: TextCapitalization.words,
                          validator: (v) =>
                              v == null || v.trim().isEmpty
                                  ? 'Supplier name is required'
                                  : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _contactCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Contact person',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _emailCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Email',
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.emailAddress,
                          validator: (v) =>
                              _validateEmail(v) ? null : 'Invalid email',
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _phoneCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Phone',
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.phone,
                          validator: (v) =>
                              _validatePhone(v) ? null : 'Invalid phone number',
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _addressCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Address',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _paymentTermsCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Payment terms (days)',
                            border: OutlineInputBorder(),
                            helperText: 'Default: 30 days',
                          ),
                          keyboardType: TextInputType.number,
                        ),
                        const SizedBox(height: 12),
                        InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'Payment preference',
                            border: OutlineInputBorder(),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              isExpanded: true,
                              value: _paymentPreference.isEmpty
                                  ? ''
                                  : _paymentPreference,
                              items: _paymentPreferences
                                  .map(
                                    (p) => DropdownMenuItem(
                                      value: p,
                                      child: Text(
                                        p.isEmpty ? 'Select preference…' : p,
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) => setState(
                                () => _paymentPreference = v ?? '',
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _currencyCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Currency',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _notesCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Notes',
                            border: OutlineInputBorder(),
                          ),
                          minLines: 3,
                          maxLines: 5,
                        ),
                        const SizedBox(height: 12),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Active supplier'),
                          subtitle: const Text(
                            'Inactive suppliers are hidden from selection lists',
                          ),
                          value: _isActive,
                          onChanged: (v) => setState(() => _isActive = v),
                        ),
                        const SizedBox(height: 24),
                        FilledButton(
                          onPressed:
                              canSave && !_isSubmitting ? _save : null,
                          child: _isSubmitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(_isEdit ? 'Save changes' : 'Create supplier'),
                        ),
                      ],
                    ),
                  ),
                ),
    );
  }
}
