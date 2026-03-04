import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../pos/domain/pos_models.dart';
import '../../pos/data/pos_repository.dart';
import '../domain/quotation_model.dart';
import 'providers/quotation_provider.dart';
import 'providers/quotation_details_provider.dart';

class CreateQuotationScreen extends ConsumerStatefulWidget {
  final String? quotationId; // If set, we're in edit mode.

  const CreateQuotationScreen({super.key, this.quotationId});

  @override
  ConsumerState<CreateQuotationScreen> createState() =>
      _CreateQuotationScreenState();
}

class _CreateQuotationScreenState extends ConsumerState<CreateQuotationScreen> {
  PosClient? _selectedClient;
  final _titleCtrl = TextEditingController(text: 'Quotation');
  final _orderNumberCtrl = TextEditingController();
  DateTime _issueDate = DateTime.now();
  DateTime _validUntil = DateTime.now().add(const Duration(days: 30));
  final _notesCtrl = TextEditingController();
  final _discountCtrl = TextEditingController(text: '0');
  String _status = 'Draft';
  bool _isSubmitting = false;
  bool _isLoadingData = true;
  bool _isEditMode = false;
  List<PosProduct> _products = [];
  List<PosClient> _clients = [];
  final List<_QuotationLineItem> _items = [];

  @override
  void initState() {
    super.initState();
    _isEditMode = widget.quotationId != null;
    _loadData();
    if (_isEditMode) {
      _loadQuotationForEdit();
    }
  }

  Future<void> _loadQuotationForEdit() async {
    if (widget.quotationId == null) return;
    try {
      final quotation = await ref.read(
        quotationDetailsProvider(widget.quotationId!).future,
      );
      if (!mounted) return;
      setState(() {
        _titleCtrl.text = quotation.title;
        _orderNumberCtrl.text = quotation.orderNumber ?? '';
        _issueDate = DateTime.tryParse(quotation.date) ?? DateTime.now();
        _validUntil =
            DateTime.tryParse(quotation.validUntil) ??
            DateTime.now().add(const Duration(days: 30));
        _notesCtrl.text = quotation.notes ?? '';
        _discountCtrl.text = quotation.discount.toStringAsFixed(2);
        _status = quotation.status;
        for (final item in quotation.items) {
          _items.add(_QuotationLineItem(
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            discountAmount: item.discountAmount,
            productId: item.productId,
          ));
        }
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to load quotation')),
        );
      }
    }
  }

  Future<void> _loadData() async {
    try {
      final posRepo = ref.read(posRepositoryProvider);
      final results = await Future.wait([
        posRepo.fetchProducts(),
        posRepo.fetchClients(),
      ]);
      if (mounted) {
        setState(() {
          _products = results[0] as List<PosProduct>;
          _clients = results[1] as List<PosClient>;
          _isLoadingData = false;
        });
        if (_isEditMode && _items.isEmpty) {
          _loadQuotationForEdit();
        }
        if (_isEditMode && widget.quotationId != null) {
          ref
              .read(quotationDetailsProvider(widget.quotationId!).future)
              .then((q) {
            if (mounted) {
              setState(() {
                final client = _clients.cast<PosClient?>().firstWhere(
                      (c) => c?.id == q.clientId,
                      orElse: () => null,
                    );
                if (client != null) _selectedClient = client;
              });
            }
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingData = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load data: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _orderNumberCtrl.dispose();
    _notesCtrl.dispose();
    _discountCtrl.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  double get _subtotal =>
      _items.fold(0, (sum, e) => sum + (e.quantity * e.unitPrice));
  double get _totalDiscount =>
      _items.fold(0, (sum, e) => sum + (e.discountAmount * e.quantity));
  double get _globalDiscount =>
      double.tryParse(_discountCtrl.text.replaceAll(',', '')) ?? 0;
  double get _totalTax => _items.fold(
        0,
        (sum, e) {
          final lineTotal = e.quantity * e.unitPrice - e.discountAmount * e.quantity;
          return sum + (lineTotal * (e.taxRate / 100));
        },
      );
  double get _total =>
      _subtotal - _totalDiscount - _globalDiscount + _totalTax;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currencyFormat = NumberFormat.currency(
      symbol: 'MK ',
      decimalDigits: 2,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditMode ? 'Edit Quotation' : 'Create Quotation'),
        actions: [
          TextButton(
            onPressed: _isSubmitting ? null : _submit,
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
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _sectionLabel(theme, 'Client'),
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
                        color: theme.colorScheme.outline
                            .withValues(alpha: 0.4),
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.person_outline,
                          color: theme.colorScheme.outline,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _selectedClient?.name ?? 'Select a client',
                            style: TextStyle(
                              color: _selectedClient != null
                                  ? null
                                  : theme.colorScheme.outline,
                            ),
                          ),
                        ),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _sectionLabel(theme, 'Title'),
                const SizedBox(height: 8),
                TextField(
                  controller: _titleCtrl,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Consulting services',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                _sectionLabel(theme, 'Order number (optional)'),
                const SizedBox(height: 8),
                TextField(
                  controller: _orderNumberCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Order number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                _sectionLabel(theme, 'Issue date'),
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
                        color: theme.colorScheme.outline
                            .withValues(alpha: 0.4),
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.calendar_month_outlined,
                          color: theme.colorScheme.outline,
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
                _sectionLabel(theme, 'Valid until'),
                const SizedBox(height: 8),
                InkWell(
                  onTap: _pickValidUntil,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: theme.colorScheme.outline
                            .withValues(alpha: 0.4),
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.event_outlined,
                          color: theme.colorScheme.outline,
                        ),
                        const SizedBox(width: 10),
                        Text(DateFormat('d MMM y').format(_validUntil)),
                        const Spacer(),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _sectionLabel(theme, 'Status'),
                const SizedBox(height: 8),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: 'Draft',
                      label: Text('Draft'),
                      icon: Icon(Icons.edit_note),
                    ),
                    ButtonSegment(
                      value: 'Approved',
                      label: Text('Approved'),
                      icon: Icon(Icons.check_circle_outline),
                    ),
                  ],
                  selected: {_status},
                  onSelectionChanged: (s) => setState(() => _status = s.first),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: _sectionLabel(theme, 'Items'),
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
                          color: theme.colorScheme.outline,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'No items added yet',
                          style: TextStyle(color: theme.colorScheme.outline),
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
                            color: theme.colorScheme.outlineVariant
                                .withValues(alpha: 0.3),
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
                                      item.description,
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
                                    onPressed: () =>
                                        setState(() => _items.removeAt(i)),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  SizedBox(
                                    width: 70,
                                    child: TextField(
                                      controller: item.qtyCtrl,
                                      keyboardType: const TextInputType
                                          .numberWithOptions(decimal: true),
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
                                  Expanded(
                                    child: TextField(
                                      controller: item.priceCtrl,
                                      keyboardType: const TextInputType
                                          .numberWithOptions(decimal: true),
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
                                    width: 60,
                                    child: TextField(
                                      controller: item.taxCtrl,
                                      keyboardType: const TextInputType
                                          .numberWithOptions(decimal: true),
                                      decoration: const InputDecoration(
                                        labelText: 'Tax%',
                                        border: OutlineInputBorder(),
                                        isDense: true,
                                        contentPadding: EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 8,
                                        ),
                                      ),
                                      onChanged: (_) => setState(() {}),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  SizedBox(
                                    width: 70,
                                    child: TextField(
                                      controller: item.discountCtrl,
                                      keyboardType: const TextInputType
                                          .numberWithOptions(decimal: true),
                                      decoration: const InputDecoration(
                                        labelText: 'Disc',
                                        border: OutlineInputBorder(),
                                        isDense: true,
                                        contentPadding: EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 8,
                                        ),
                                      ),
                                      onChanged: (_) => setState(() {}),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    currencyFormat.format(item.lineAmount),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 16),
                _sectionLabel(theme, 'Global discount (MK)'),
                const SizedBox(height: 8),
                TextField(
                  controller: _discountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    prefixText: 'MK ',
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 16),
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
                          if (_totalDiscount > 0)
                            _SummaryRow(
                              'Line discounts',
                              '-${currencyFormat.format(_totalDiscount)}',
                            ),
                          if (_globalDiscount > 0)
                            _SummaryRow(
                              'Global discount',
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
                _sectionLabel(theme, 'Notes (optional)'),
                const SizedBox(height: 8),
                TextField(
                  controller: _notesCtrl,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 80),
              ],
            ),
    );
  }

  Widget _sectionLabel(ThemeData theme, String label) {
    return Text(
      label,
      style: theme.textTheme.titleSmall?.copyWith(
        fontWeight: FontWeight.w600,
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
                  (c) =>
                      c.name
                          .toLowerCase()
                          .contains(query.toLowerCase()),
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

  Future<void> _pickIssueDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _issueDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _issueDate = picked);
  }

  Future<void> _pickValidUntil() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _validUntil,
      firstDate: _issueDate,
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (picked != null) setState(() => _validUntil = picked);
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
                  (p) =>
                      p.name
                          .toLowerCase()
                          .contains(query.toLowerCase()),
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
                        double taxRate = 0;
                        if (p.taxes.isNotEmpty) {
                          taxRate = p.taxes.first.taxRate;
                        }
                        final currFormat = NumberFormat.currency(
                          symbol: 'MK ',
                          decimalDigits: 2,
                        );
                        return ListTile(
                          title: Text(p.name),
                          subtitle: Text(currFormat.format(p.price)),
                          trailing: const Icon(Icons.add_circle_outline),
                          onTap: () {
                            setState(() {
                              _items.add(_QuotationLineItem(
                                description: p.name,
                                quantity: 1,
                                unitPrice: p.price,
                                taxRate: taxRate,
                                productId: p.id,
                              ));
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a client')),
      );
      return;
    }
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a title')),
      );
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
      final request = CreateQuotationRequest(
        clientId: _selectedClient!.id,
        title: _titleCtrl.text.trim(),
        orderNumber: _orderNumberCtrl.text.trim().isEmpty
            ? null
            : _orderNumberCtrl.text.trim(),
        issueDate: DateFormat('yyyy-MM-dd').format(_issueDate),
        validUntil: DateFormat('yyyy-MM-dd').format(_validUntil),
        discount: _globalDiscount,
        status: _status,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
        items: _items
            .map(
              (e) => CreateQuotationItemRequest(
                description: e.description,
                quantity: e.quantity,
                unitPrice: e.unitPrice,
                taxRate: e.taxRate,
                discountAmount: e.discountAmount,
                productId: e.productId,
              ),
            )
            .toList(),
      );

      if (_isEditMode && widget.quotationId != null) {
        await ref
            .read(quotationControllerProvider.notifier)
            .updateQuotation(widget.quotationId!, request);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Quotation updated')),
          );
          context.pop();
        }
      } else {
        await ref
            .read(quotationControllerProvider.notifier)
            .createQuotation(request);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Quotation created')),
          );
          context.pop();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}

class _QuotationLineItem {
  final String description;
  final String? productId;
  final TextEditingController qtyCtrl;
  final TextEditingController priceCtrl;
  final TextEditingController taxCtrl;
  final TextEditingController discountCtrl;

  _QuotationLineItem({
    required this.description,
    required double quantity,
    required double unitPrice,
    double taxRate = 0,
    double discountAmount = 0,
    this.productId,
  })  : qtyCtrl = TextEditingController(text: quantity.toString()),
        priceCtrl =
            TextEditingController(text: unitPrice.toStringAsFixed(2)),
        taxCtrl = TextEditingController(text: taxRate.toStringAsFixed(1)),
        discountCtrl =
            TextEditingController(text: discountAmount.toStringAsFixed(2));

  double get quantity => double.tryParse(qtyCtrl.text) ?? 0;
  double get unitPrice => double.tryParse(priceCtrl.text) ?? 0;
  double get taxRate => double.tryParse(taxCtrl.text) ?? 0;
  double get discountAmount => double.tryParse(discountCtrl.text) ?? 0;
  double get lineAmount {
    final lineTotal = quantity * unitPrice - discountAmount * quantity;
    final tax = lineTotal * (taxRate / 100);
    return lineTotal + tax;
  }

  void dispose() {
    qtyCtrl.dispose();
    priceCtrl.dispose();
    taxCtrl.dispose();
    discountCtrl.dispose();
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
