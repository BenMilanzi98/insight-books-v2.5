import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../pos/domain/pos_models.dart';
import '../../pos/data/pos_repository.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/network_error_mapper.dart';
import '../data/invoice_repository.dart';
import 'providers/invoice_provider.dart';
import 'providers/invoice_details_provider.dart';
import '../../../shared/widgets/main_layout.dart';

class CreateInvoiceScreen extends ConsumerStatefulWidget {
  final String? invoiceId;
  const CreateInvoiceScreen({super.key, this.invoiceId});

  @override
  ConsumerState<CreateInvoiceScreen> createState() =>
      _CreateInvoiceScreenState();
}

class _CreateInvoiceScreenState extends ConsumerState<CreateInvoiceScreen> {
  PosClient? _selectedClient;
  final List<_InvoiceLineItem> _items = [];
  DateTime _issueDate = DateTime.now();
  DateTime _dueDate = DateTime.now().add(const Duration(days: 30));
  final _notesCtrl = TextEditingController();
  final _termsCtrl = TextEditingController();
  final _discountCtrl = TextEditingController();
  final _titleCtrl = TextEditingController();
  final _orderNumberCtrl = TextEditingController();
  bool _orderNumberAutogenerate = false;
  String _status = 'Pending';
  bool _isSubmitting = false;
  late final bool _isEditMode;

  List<PosProduct> _products = [];
  List<PosClient> _clients = [];
  List<_InvoiceTemplate> _templates = const [];
  String? _selectedTemplateId;
  bool _isLoadingData = true;

  @override
  void initState() {
    super.initState();
    _isEditMode = widget.invoiceId != null;
    // Avoid using [ref] synchronously in [initState]; first frame is fine for providers.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadData();
    });
  }

  Future<void> _loadData() async {
    try {
      final posRepo = ref.read(posRepositoryProvider);
      final results = await Future.wait([
        posRepo.fetchProducts(),
        posRepo.fetchClients(),
      ]);
      final templateResponse = await ref.read(dioProvider).get(
        '/api/invoice/templates',
      );
      final rawTemplates = templateResponse.data['templates'] as List? ?? const [];
      final templates = rawTemplates
          .whereType<Map>()
          .map((e) => _InvoiceTemplate.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      final isEdit = widget.invoiceId != null && widget.invoiceId!.isNotEmpty;
      if (mounted) {
        setState(() {
          _products = results[0] as List<PosProduct>;
          _clients = results[1] as List<PosClient>;
          _templates = templates;
          _selectedTemplateId = templates
              .firstWhere(
                (t) => t.isDefault,
                orElse: () => templates.isNotEmpty
                    ? templates.first
                    : const _InvoiceTemplate(id: '', name: ''),
              )
              .id;
          if (_selectedTemplateId != null && _selectedTemplateId!.isEmpty) {
            _selectedTemplateId = null;
          }
          if (!isEdit) _isLoadingData = false;
        });
      }
      if (mounted && isEdit) {
        await _loadInvoiceForEdit();
        if (mounted) setState(() => _isLoadingData = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingData = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to load data: $e')));
      }
    }
  }

  Future<void> _loadInvoiceForEdit() async {
    final id = widget.invoiceId;
    if (id == null || id.isEmpty) return;
    try {
      final inv = await ref.read(invoiceRepositoryProvider).fetchInvoiceById(id);
      if (!mounted) return;
      final st = inv.status.toLowerCase();
      // Match web `/invoice`: edit is only offered for Draft.
      if (st != 'draft') {
        if (mounted) {
          setState(() => _isLoadingData = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Only draft invoices can be edited.'),
            ),
          );
          context.pop();
        }
        return;
      }
      for (final line in _items) {
        line.dispose();
      }
      _items.clear();
      PosClient? clientMatch;
      for (final c in _clients) {
        if (c.id == inv.client.id) {
          clientMatch = c;
          break;
        }
      }
      _selectedClient = clientMatch ??
          PosClient(
            id: inv.client.id,
            name: inv.client.name,
            email: inv.client.email,
            phone: inv.client.phone,
          );
      _issueDate = inv.issueDate ?? inv.createdAt;
      _dueDate = inv.dueDate;
      _notesCtrl.text = inv.notes ?? '';
      _termsCtrl.text = inv.terms ?? '';
      _discountCtrl.text = inv.totalDiscount > 0 ? inv.totalDiscount.toStringAsFixed(2) : '';
      _titleCtrl.text = inv.title ?? '';
      _orderNumberCtrl.text = inv.orderNumber ?? '';
      _orderNumberAutogenerate = false;
      _status = 'Draft';
      final tid = inv.templateId?.trim();
      if (tid != null &&
          tid.isNotEmpty &&
          _templates.any((t) => t.id == tid)) {
        _selectedTemplateId = tid;
      }
      for (final it in inv.items) {
        _items.add(
          _InvoiceLineItem(
            productId: it.product.id,
            name: (it.description != null && it.description!.trim().isNotEmpty)
                ? it.description!
                : it.product.name,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            taxRate: it.taxRate,
            discountAmount: it.discount,
            accountId: null,
          ),
        );
      }
      setState(() {});
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingData = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load invoice: $e')),
        );
        context.pop();
      }
    }
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    _termsCtrl.dispose();
    _discountCtrl.dispose();
    _titleCtrl.dispose();
    _orderNumberCtrl.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  double get _subtotal => _items.fold(0, (sum, e) => sum + e.lineTotal);
  double get _totalTax => _items.fold(0, (sum, e) => sum + e.lineTax);
  double get _globalDiscount {
    final discount = double.tryParse(_discountCtrl.text) ?? 0;
    if (discount <= 0) return 0;
    return discount > _subtotal ? _subtotal : discount;
  }

  double get _total => (_subtotal - _globalDiscount) + _totalTax;

  @override
  Widget build(BuildContext context) {
    final invoiceState = ref.watch(invoiceControllerProvider);
    final canSubmit = _isEditMode
        ? invoiceState.canUpdateInvoices
        : invoiceState.canCreateInvoices;
    final theme = Theme.of(context);
    final currencyFormat = NumberFormat.currency(
      symbol: 'MK ',
      decimalDigits: 2,
    );

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(_isEditMode ? 'Edit Invoice' : 'Create Invoice'),
        actions: [
          TextButton(
            onPressed: _isSubmitting || !canSubmit ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: _isLoadingData
          ? const Center(child: CircularProgressIndicator())
          : !canSubmit
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: const Text(
                  'You do not have permission to perform this action.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // ── Client selector ──
                Text(
                  'Client',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: _pickClient,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: theme.colorScheme.outline.withValues(alpha: 0.4),
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.person_outline,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _selectedClient?.name ?? 'Select a client',
                            style: TextStyle(
                              color: _selectedClient != null
                                  ? null
                                  : theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // ── Invoice title (matches web InvoiceModal) ──
                Text(
                  'Invoice title',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _titleCtrl,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Consulting services, Project XYZ',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

                // ── Invoice number (server-assigned, same as web) ──
                if (!_isEditMode) ...[
                  Text(
                    'Invoice number',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerHighest
                          .withValues(alpha: 0.65),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: theme.colorScheme.outline.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.auto_awesome,
                              size: 18,
                              color: theme.colorScheme.primary,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Auto-generate',
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Your invoice number is assigned when you save (e.g. INV-DDMMYYYY-00001), matching the website.',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Order number ──
                Text(
                  'Order number',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _orderNumberCtrl,
                  readOnly: _orderNumberAutogenerate,
                  decoration: InputDecoration(
                    hintText: _orderNumberAutogenerate
                        ? 'Auto-generated'
                        : 'Enter order number',
                    border: const OutlineInputBorder(),
                    filled: _orderNumberAutogenerate,
                    fillColor: _orderNumberAutogenerate
                        ? theme.colorScheme.surfaceContainerHighest.withValues(
                            alpha: 0.6,
                          )
                        : null,
                  ),
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Autogenerate order number'),
                  value: _orderNumberAutogenerate,
                  onChanged: (v) {
                    setState(() {
                      _orderNumberAutogenerate = v ?? false;
                      if (_orderNumberAutogenerate) {
                        _orderNumberCtrl.text = _generateOrderNumber();
                      }
                    });
                  },
                ),
                const SizedBox(height: 8),

                // ── Issue Date ──
                Text(
                  'Issue Date',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: _pickIssueDate,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: theme.colorScheme.outline.withValues(alpha: 0.4),
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.event_outlined,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 10),
                        Text(DateFormat('d MMM y').format(_issueDate)),
                        const Spacer(),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // ── Due Date ──
                Text(
                  'Due Date',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: _pickDueDate,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: theme.colorScheme.outline.withValues(alpha: 0.4),
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.calendar_month_outlined,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 10),
                        Text(DateFormat('d MMM y').format(_dueDate)),
                        const Spacer(),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // ── Status toggle ──
                Text(
                  'Status',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: 'Draft',
                      label: Text('Draft'),
                      icon: Icon(Icons.edit_note),
                    ),
                    ButtonSegment(
                      value: 'Pending',
                      label: Text('Send'),
                      icon: Icon(Icons.send_outlined),
                    ),
                  ],
                  selected: {_status},
                  onSelectionChanged: (s) => setState(() => _status = s.first),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String?>(
                  key: ValueKey<String?>('inv_tpl_${_selectedTemplateId ?? 'none'}'),
                  initialValue: _selectedTemplateId != null &&
                          _templates.any((t) => t.id == _selectedTemplateId)
                      ? _selectedTemplateId
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Invoice Template',
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Default Template'),
                    ),
                    ..._templates.map(
                      (t) => DropdownMenuItem<String?>(
                        value: t.id,
                        child: Text(
                          t.isDefault ? '${t.name} (Default)' : t.name,
                        ),
                      ),
                    ),
                  ],
                  onChanged: (value) => setState(() => _selectedTemplateId = value),
                ),
                const SizedBox(height: 20),

                // ── Items Header ──
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Items',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: _addItem,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add Item'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                if (_items.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(24),
                    alignment: Alignment.center,
                    child: Column(
                      children: [
                        Icon(
                          Icons.inventory_2_outlined,
                          size: 40,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'No items added yet',
                          style: TextStyle(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  ..._items.asMap().entries.map((entry) {
                    final i = entry.key;
                    final item = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: theme.colorScheme.outlineVariant.withValues(
                              alpha: 0.3,
                            ),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item.name,
                                      style: theme.textTheme.bodyMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ),
                                  IconButton(
                                    icon: Icon(
                                      Icons.delete_outline,
                                      color: theme.colorScheme.error,
                                      size: 20,
                                    ),
                                    onPressed: () => setState(() {
                                      _items[i].dispose();
                                      _items.removeAt(i);
                                    }),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  // Quantity
                                  SizedBox(
                                    width: 80,
                                    child: TextField(
                                      controller: item.qtyCtrl,
                                      keyboardType:
                                          const TextInputType.numberWithOptions(
                                            decimal: true,
                                          ),
                                      decoration: const InputDecoration(
                                        labelText: 'Qty',
                                        border: OutlineInputBorder(),
                                        isDense: true,
                                        contentPadding: EdgeInsets.symmetric(
                                          horizontal: 10,
                                          vertical: 8,
                                        ),
                                      ),
                                      onChanged: (_) => setState(() {}),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text('×'),
                                  const SizedBox(width: 8),
                                  // Unit price
                                  Expanded(
                                    child: TextField(
                                      controller: item.priceCtrl,
                                      keyboardType:
                                          const TextInputType.numberWithOptions(
                                            decimal: true,
                                          ),
                                      decoration: const InputDecoration(
                                        labelText: 'Price',
                                        prefixText: 'MK ',
                                        border: OutlineInputBorder(),
                                        isDense: true,
                                        contentPadding: EdgeInsets.symmetric(
                                          horizontal: 10,
                                          vertical: 8,
                                        ),
                                      ),
                                      onChanged: (_) => setState(() {}),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  SizedBox(
                                    width: 90,
                                    child: TextField(
                                      controller: item.discountCtrl,
                                      keyboardType:
                                          const TextInputType.numberWithOptions(
                                            decimal: true,
                                          ),
                                      decoration: const InputDecoration(
                                        labelText: 'Disc',
                                        prefixText: 'MK ',
                                        border: OutlineInputBorder(),
                                        isDense: true,
                                        contentPadding: EdgeInsets.symmetric(
                                          horizontal: 10,
                                          vertical: 8,
                                        ),
                                      ),
                                      onChanged: (_) => setState(() {}),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    currencyFormat.format(item.lineTotal),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: item.taxCtrl,
                                keyboardType: const TextInputType.numberWithOptions(
                                  decimal: true,
                                ),
                                decoration: InputDecoration(
                                  labelText:
                                      'Tax % (${currencyFormat.format(item.lineTax)})',
                                  border: const OutlineInputBorder(),
                                  isDense: true,
                                ),
                                onChanged: (_) => setState(() {}),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),

                const SizedBox(height: 16),

                // ── Summary ──
                if (_items.isNotEmpty)
                  Card(
                    elevation: 0,
                    color: theme.colorScheme.surfaceContainerLow,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _SummaryRow(
                            'Subtotal',
                            currencyFormat.format(_subtotal),
                          ),
                          if (_globalDiscount > 0)
                            _SummaryRow(
                              'Discount',
                              '-${currencyFormat.format(_globalDiscount)}',
                            ),
                          if (_totalTax > 0)
                            _SummaryRow(
                              'Tax',
                              currencyFormat.format(_totalTax),
                            ),
                          const Divider(height: 16),
                          _SummaryRow(
                            'Total',
                            currencyFormat.format(_total),
                            bold: true,
                          ),
                        ],
                      ),
                    ),
                  ),

                const SizedBox(height: 16),
                TextField(
                  controller: _discountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Global discount (optional)',
                    prefixText: 'MK ',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _termsCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Terms (optional)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 12),

                // ── Notes ──
                TextField(
                  controller: _notesCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Notes (optional)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 80),
              ],
            ),
    );
  }

  void _pickClient() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        String query = '';
        return StatefulBuilder(
          builder: (ctx, setState2) {
            final filtered = _clients
                .where(
                  (c) => c.name.toLowerCase().contains(query.toLowerCase()),
                )
                .toList();
            return DraggableScrollableSheet(
              initialChildSize: 0.6,
              minChildSize: 0.3,
              maxChildSize: 0.85,
              expand: false,
              builder: (ctx, scrollCtrl) => Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: 'Search clients…',
                        prefixIcon: const Icon(Icons.search),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        filled: true,
                      ),
                      onChanged: (v) => setState2(() => query = v),
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      controller: scrollCtrl,
                      itemCount: filtered.length,
                      itemBuilder: (ctx, i) {
                        final c = filtered[i];
                        return ListTile(
                          leading: CircleAvatar(
                            child: Text(c.name[0].toUpperCase()),
                          ),
                          title: Text(c.name),
                          subtitle: Text(c.email ?? ''),
                          onTap: () {
                            setState(() => _selectedClient = c);
                            Navigator.pop(ctx);
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _pickDueDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate,
      firstDate: _issueDate,
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  Future<void> _pickIssueDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _issueDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _issueDate = picked;
        if (_dueDate.isBefore(_issueDate)) {
          _dueDate = _issueDate.add(const Duration(days: 30));
        }
      });
    }
  }

  void _addItem() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        String query = '';
        return StatefulBuilder(
          builder: (ctx, setState2) {
            final filtered = _products
                .where(
                  (p) => p.name.toLowerCase().contains(query.toLowerCase()),
                )
                .toList();
            return DraggableScrollableSheet(
              initialChildSize: 0.6,
              minChildSize: 0.3,
              maxChildSize: 0.85,
              expand: false,
              builder: (ctx, scrollCtrl) => Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: 'Search products…',
                        prefixIcon: const Icon(Icons.search),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        filled: true,
                      ),
                      onChanged: (v) => setState2(() => query = v),
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      controller: scrollCtrl,
                      itemCount: filtered.length,
                      itemBuilder: (ctx, i) {
                        final p = filtered[i];
                        final currFormat = NumberFormat.currency(
                          symbol: 'MK ',
                          decimalDigits: 2,
                        );
                        return ListTile(
                          title: Text(p.name),
                          subtitle: Text(currFormat.format(p.price)),
                          trailing: const Icon(Icons.add_circle_outline),
                          onTap: () {
                            // Use actual tax rate from product
                            double taxRate = 0;
                            if (p.taxes.isNotEmpty) {
                              taxRate = p.taxes.first.taxRate;
                            }
                            setState(() {
                              _items.add(
                                _InvoiceLineItem(
                                  productId: p.id,
                                  name: p.name,
                                  unitPrice: p.price,
                                  quantity: 1,
                                  taxRate: taxRate,
                                  discountAmount: 0,
                                  accountId: p.accountId,
                                ),
                              );
                            });
                            Navigator.pop(ctx);
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _submit() async {
    if (_selectedClient == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please select a client')));
      return;
    }
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one item')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final payload = <String, dynamic>{
        'clientId': _selectedClient!.id,
        'issueDate': _issueDate.toIso8601String().split('T').first,
        'dueDate': _dueDate.toIso8601String().split('T').first,
        if (_titleCtrl.text.trim().isNotEmpty) 'title': _titleCtrl.text.trim(),
        if (_orderNumberCtrl.text.trim().isNotEmpty)
          'orderNumber': _orderNumberCtrl.text.trim(),
        'notes': _notesCtrl.text.isNotEmpty ? _notesCtrl.text : null,
        'terms': _termsCtrl.text.isNotEmpty ? _termsCtrl.text : null,
        'status': _status == 'Draft' ? 'Draft' : 'Pending',
        'templateId': _selectedTemplateId,
        'discount': _globalDiscount,
        'items': _items
            .map(
              (e) => <String, dynamic>{
                'productId': e.productId,
                'quantity': e.quantity,
                'unitPrice': e.unitPrice,
                'description': e.name,
                'taxRate': e.taxRate,
                'discountAmount': e.discountAmount,
                'accountId': e.accountId,
              },
            )
            .toList(),
      };

      final repo = ref.read(invoiceRepositoryProvider);
      if (_isEditMode &&
          widget.invoiceId != null &&
          widget.invoiceId!.isNotEmpty) {
        await repo.updateInvoiceFromPayload(widget.invoiceId!, payload);
        ref.invalidate(invoiceDetailsProvider(widget.invoiceId!));
      } else {
        await repo.createInvoiceFromPayload(payload);
      }
      if (_isEditMode) {
        await ref
            .read(invoiceControllerProvider.notifier)
            .reloadPreservingPagination();
      } else {
        await ref.read(invoiceControllerProvider.notifier).refresh();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isEditMode ? 'Invoice updated' : 'Invoice created'),
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(
          SnackBar(
            content: Text(
              NetworkErrorMapper.toUserMessage(
                e,
                fallback: _isEditMode
                    ? 'Failed to save invoice'
                    : 'Failed to create invoice',
              ),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// Same pattern as web: ORD-YYYY-MM-DD-RANDOM
  String _generateOrderNumber() {
    final d = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final r = math.Random();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final suffix = List.generate(
      6,
      (_) => chars[r.nextInt(chars.length)],
    ).join();
    return 'ORD-$d-$suffix';
  }
}

// ═════════════════════════════════════════════════
//  Helpers
// ═════════════════════════════════════════════════

class _InvoiceLineItem {
  final String productId;
  final String name;
  final String? accountId;
  final TextEditingController qtyCtrl;
  final TextEditingController priceCtrl;
  final TextEditingController taxCtrl;
  final TextEditingController discountCtrl;

  _InvoiceLineItem({
    required this.productId,
    required this.name,
    required double unitPrice,
    required double quantity,
    required double taxRate,
    required double discountAmount,
    this.accountId,
  }) : qtyCtrl = TextEditingController(text: quantity.toString()),
       priceCtrl = TextEditingController(text: unitPrice.toStringAsFixed(2)),
       taxCtrl = TextEditingController(text: taxRate.toStringAsFixed(2)),
       discountCtrl = TextEditingController(
         text: discountAmount.toStringAsFixed(2),
       );

  double get unitPrice => double.tryParse(priceCtrl.text) ?? 0;
  double get quantity => double.tryParse(qtyCtrl.text) ?? 0;
  double get taxRate => double.tryParse(taxCtrl.text) ?? 0;
  double get discountAmount => double.tryParse(discountCtrl.text) ?? 0;
  double get lineTotal => (quantity * unitPrice) - (quantity * discountAmount);
  double get lineTax => lineTotal * (taxRate / 100);

  void dispose() {
    qtyCtrl.dispose();
    priceCtrl.dispose();
    taxCtrl.dispose();
    discountCtrl.dispose();
  }
}

class _InvoiceTemplate {
  final String id;
  final String name;
  final bool isDefault;

  const _InvoiceTemplate({
    required this.id,
    required this.name,
    this.isDefault = false,
  });

  factory _InvoiceTemplate.fromJson(Map<String, dynamic> json) {
    return _InvoiceTemplate(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? 'Template').toString(),
      isDefault: json['isDefault'] == true,
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;

  const _SummaryRow(this.label, this.value, {this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(fontWeight: bold ? FontWeight.bold : null),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
