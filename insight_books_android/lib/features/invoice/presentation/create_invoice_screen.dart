import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../pos/domain/pos_models.dart';
import '../../pos/data/pos_repository.dart';
import '../domain/invoice_model.dart';
import 'providers/invoice_provider.dart';

class CreateInvoiceScreen extends ConsumerStatefulWidget {
  const CreateInvoiceScreen({super.key});

  @override
  ConsumerState<CreateInvoiceScreen> createState() =>
      _CreateInvoiceScreenState();
}

class _CreateInvoiceScreenState extends ConsumerState<CreateInvoiceScreen> {
  PosClient? _selectedClient;
  final List<CreateInvoiceItemRequest> _items = [];
  DateTime _dueDate = DateTime.now().add(const Duration(days: 7));
  final TextEditingController _notesController = TextEditingController();
  final TextEditingController _termsController = TextEditingController();

  List<PosProduct> _availableProducts = [];
  List<PosClient> _availableClients = [];
  bool _isLoadingData = true;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    try {
      final posRepo = ref.read(posRepositoryProvider);
      final products = await posRepo.fetchProducts();
      final clients = await posRepo.fetchClients();

      setState(() {
        _availableProducts = products;
        _availableClients = clients;
        _isLoadingData = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingData = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error loading data: $e')));
      }
    }
  }

  double get _subtotal =>
      _items.fold(0, (sum, item) => sum + (item.unitPrice * item.quantity));

  // For simplicity in the creation form, we'll assume a fixed/simplified tax calculation
  // In a real app, this would use the product's actual tax configurations
  double get _totalTax => _subtotal * 0.15; // 15% VAT placeholder
  double get _total => _subtotal + _totalTax;

  @override
  Widget build(BuildContext context) {
    if (_isLoadingData) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final currencyFormat = NumberFormat.currency(symbol: 'MWK ');

    return Scaffold(
      appBar: AppBar(title: const Text('Create Invoice')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Client Selection
            const Text(
              'Customer',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: _showClientPicker,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.user, color: Colors.blue),
                    const SizedBox(width: 12),
                    Text(_selectedClient?.name ?? 'Select a customer'),
                    const Spacer(),
                    const Icon(LucideIcons.chevronDown, size: 16),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Due Date
            const Text(
              'Due Date',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: _selectDueDate,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.calendar, color: Colors.orange),
                    const SizedBox(width: 12),
                    Text(DateFormat('MMM dd, yyyy').format(_dueDate)),
                    const Spacer(),
                    const Icon(LucideIcons.calendarPlus, size: 16),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Items Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Items',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
                TextButton.icon(
                  onPressed: _showProductPicker,
                  icon: const Icon(LucideIcons.plusCircle, size: 18),
                  label: const Text('Add Item'),
                ),
              ],
            ),
            const Divider(),

            if (_items.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 32.0),
                  child: Text(
                    'No items added yet',
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _items.length,
                separatorBuilder: (_, _) => const Divider(),
                itemBuilder: (context, index) {
                  final item = _items[index];
                  final product = _availableProducts.firstWhere(
                    (p) => p.id == item.productId,
                  );
                  return ListTile(
                    title: Text(product.name),
                    subtitle: Text(
                      '${item.quantity} x ${currencyFormat.format(item.unitPrice)}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          currencyFormat.format(item.unitPrice * item.quantity),
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        IconButton(
                          icon: const Icon(
                            LucideIcons.trash2,
                            color: Colors.red,
                            size: 20,
                          ),
                          onPressed: () =>
                              setState(() => _items.removeAt(index)),
                        ),
                      ],
                    ),
                  );
                },
              ),

            const Divider(thickness: 2),

            // Totals
            Align(
              alignment: Alignment.centerRight,
              child: SizedBox(
                width: 200,
                child: Column(
                  children: [
                    _buildTotalRow(
                      'Subtotal',
                      currencyFormat.format(_subtotal),
                    ),
                    _buildTotalRow(
                      'Tax (15%)',
                      currencyFormat.format(_totalTax),
                    ),
                    const Divider(),
                    _buildTotalRow(
                      'Total',
                      currencyFormat.format(_total),
                      isBold: true,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 32),

            // Notes & Terms
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(
                labelText: 'Notes',
                hintText: 'Internal notes...',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _termsController,
              decoration: const InputDecoration(
                labelText: 'Terms & Conditions',
                hintText: 'Payment terms...',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),

            const SizedBox(height: 48),

            // Create Button
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                onPressed: _items.isEmpty || _selectedClient == null
                    ? null
                    : _createInvoice,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B82F6),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Create Invoice',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTotalRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(color: isBold ? Colors.black : Colors.grey),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }

  void _showClientPicker() {
    showModalBottomSheet(
      context: context,
      builder: (context) => ListView.builder(
        itemCount: _availableClients.length,
        itemBuilder: (context, index) {
          final client = _availableClients[index];
          return ListTile(
            title: Text(client.name),
            onTap: () {
              setState(() => _selectedClient = client);
              Navigator.pop(context);
            },
          );
        },
      ),
    );
  }

  void _showProductPicker() {
    showModalBottomSheet(
      context: context,
      builder: (context) => ListView.builder(
        itemCount: _availableProducts.length,
        itemBuilder: (context, index) {
          final product = _availableProducts[index];
          return ListTile(
            title: Text(product.name),
            subtitle: Text('Price: ${product.price}'),
            onTap: () {
              _addItem(product);
              Navigator.pop(context);
            },
          );
        },
      ),
    );
  }

  void _addItem(PosProduct product) {
    setState(() {
      _items.add(
        CreateInvoiceItemRequest(
          productId: product.id,
          quantity: 1,
          unitPrice: product.price,
        ),
      );
    });
  }

  Future<void> _selectDueDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _dueDate = picked);
    }
  }

  Future<void> _createInvoice() async {
    final request = CreateInvoiceRequest(
      clientId: _selectedClient!.id,
      items: _items,
      dueDate: _dueDate,
      notes: _notesController.text,
      terms: _termsController.text,
    );

    final success = await ref
        .read(invoiceControllerProvider.notifier)
        .createInvoice(request);

    if (mounted) {
      if (success) {
        context.pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invoice created successfully')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to create invoice')),
        );
      }
    }
  }
}
