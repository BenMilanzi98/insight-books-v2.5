import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:insightbooks_android/core/theme/theme_toggle_button.dart';
import 'package:insightbooks_android/shared/widgets/main_layout.dart';

import '../data/stock_repository.dart';
import 'providers/stock_details_provider.dart';
import 'providers/stock_provider.dart';

class CreateEditServiceScreen extends ConsumerStatefulWidget {
  final String? productId;

  const CreateEditServiceScreen({super.key, this.productId});

  @override
  ConsumerState<CreateEditServiceScreen> createState() =>
      _CreateEditServiceScreenState();
}

class _CreateEditServiceScreenState
    extends ConsumerState<CreateEditServiceScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  bool _isSubmitting = false;
  bool _isLoadingEdit = false;

  bool get _isEdit =>
      widget.productId != null && widget.productId!.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_isEdit) _loadForEdit();
  }

  Future<void> _loadForEdit() async {
    setState(() => _isLoadingEdit = true);
    try {
      final product =
          await ref.read(stockRepositoryProvider).fetchProduct(widget.productId!);
      if (!mounted) return;
      _nameCtrl.text = product.name;
      _priceCtrl.text = product.unitPrice.toString();
      _descriptionCtrl.text = product.description ?? '';
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load service: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoadingEdit = false);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _priceCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);
    final repo = ref.read(stockRepositoryProvider);
    final price = double.tryParse(_priceCtrl.text.trim()) ?? 0;
    final body = {
      'name': _nameCtrl.text.trim(),
      'unitPrice': price,
      'price': price,
      'description': _descriptionCtrl.text.trim().isEmpty
          ? null
          : _descriptionCtrl.text.trim(),
      'isService': true,
    };
    try {
      if (_isEdit) {
        await repo.updateProduct(widget.productId!, body);
      } else {
        await repo.createService(body);
      }
      ref.invalidate(stockControllerProvider);
      if (_isEdit) {
        ref.invalidate(stockDetailsProvider(widget.productId!));
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEdit ? 'Service updated' : 'Service created'),
        ),
      );
      context.pop();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: ${e.message ?? e}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Service' : 'Add Service'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: const [ThemeToggleButton()],
      ),
      body: _isLoadingEdit
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  TextFormField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(labelText: 'Name *'),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _priceCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Price'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _descriptionCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Description'),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _isSubmitting ? null : _save,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(_isEdit ? 'Save changes' : 'Create service'),
                  ),
                ],
              ),
            ),
    );
  }
}
