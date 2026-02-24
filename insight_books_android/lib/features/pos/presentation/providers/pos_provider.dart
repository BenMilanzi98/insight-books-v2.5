import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../domain/pos_models.dart';
import '../../data/pos_repository.dart';

part 'pos_provider.g.dart';

class PosPageState {
  final List<PosProduct> products;
  final List<PosProduct> filteredProducts;
  final List<PosClient> clients;
  final List<PosClient> filteredClients;
  final List<Map<String, dynamic>> incomeAccounts;
  final List<CartItem> cart;
  final PosClient? selectedClient;
  final double globalDiscount; // Percentage
  final bool isLoading;
  final String? error;
  final bool isSubmitting;
  final String? lastSaleReceipt;
  final Map<String, dynamic>? lastSaleResponse;

  PosPageState({
    this.products = const [],
    this.filteredProducts = const [],
    this.clients = const [],
    this.filteredClients = const [],
    this.incomeAccounts = const [],
    this.cart = const [],
    this.selectedClient,
    this.globalDiscount = 0,
    this.isLoading = false,
    this.error,
    this.isSubmitting = false,
    this.lastSaleReceipt,
    this.lastSaleResponse,
  });

  PosPageState copyWith({
    List<PosProduct>? products,
    List<PosProduct>? filteredProducts,
    List<PosClient>? clients,
    List<PosClient>? filteredClients,
    List<Map<String, dynamic>>? incomeAccounts,
    List<CartItem>? cart,
    PosClient? selectedClient,
    double? globalDiscount,
    bool? isLoading,
    String? error,
    bool? isSubmitting,
    String? lastSaleReceipt,
    Map<String, dynamic>? lastSaleResponse,
    bool clearSelectedClient = false,
  }) {
    return PosPageState(
      products: products ?? this.products,
      filteredProducts: filteredProducts ?? this.filteredProducts,
      clients: clients ?? this.clients,
      filteredClients: filteredClients ?? this.filteredClients,
      incomeAccounts: incomeAccounts ?? this.incomeAccounts,
      cart: cart ?? this.cart,
      selectedClient: clearSelectedClient
          ? null
          : (selectedClient ?? this.selectedClient),
      globalDiscount: globalDiscount ?? this.globalDiscount,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      lastSaleReceipt: lastSaleReceipt ?? this.lastSaleReceipt,
      lastSaleResponse: lastSaleResponse ?? this.lastSaleResponse,
    );
  }

  // Computed values
  double get subtotal =>
      cart.fold(0, (sum, item) => sum + (item.product.price * item.quantity));

  double get totalDiscount {
    double itemDiscounts = cart.fold(
      0,
      (sum, item) => sum + item.discountAmount,
    );
    double gDiscount = (subtotal - itemDiscounts) * (globalDiscount / 100);
    return itemDiscounts + gDiscount;
  }

  double get totalTax => cart.fold(0, (sum, item) => sum + item.taxAmount);

  double get total => subtotal + totalTax - totalDiscount;
}

@riverpod
class Pos extends _$Pos {
  @override
  PosPageState build() {
    // We start loading data immediately
    _loadData();
    return PosPageState(isLoading: true);
  }

  Future<void> _loadData() async {
    try {
      final repository = ref.read(posRepositoryProvider);
      final products = await repository.fetchProducts();
      if (!ref.mounted) {
        return;
      }
      final clients = await repository.fetchClients();
      if (!ref.mounted) {
        return;
      }
      final incomeAccounts = await repository.fetchIncomeAccounts();
      if (!ref.mounted) {
        return;
      }

      state = state.copyWith(
        products: products,
        filteredProducts: products,
        clients: clients,
        filteredClients: clients,
        incomeAccounts: incomeAccounts,
        isLoading: false,
      );
    } catch (e) {
      if (!ref.mounted) {
        return;
      }
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void searchProducts(String query) {
    if (query.isEmpty) {
      state = state.copyWith(filteredProducts: state.products);
    } else {
      final filtered = state.products.where((p) {
        final nameMatch = p.name.toLowerCase().contains(query.toLowerCase());
        final skuMatch =
            p.sku?.toLowerCase().contains(query.toLowerCase()) ?? false;
        return nameMatch || skuMatch;
      }).toList();
      state = state.copyWith(filteredProducts: filtered);
    }
  }

  void filterByCategory(String category) {
    if (category == 'all') {
      state = state.copyWith(filteredProducts: state.products);
    } else {
      final filtered = state.products
          .where((p) => p.category == category)
          .toList();
      state = state.copyWith(filteredProducts: filtered);
    }
  }

  void addToCart(PosProduct product) {
    final existingIndex = state.cart.indexWhere(
      (item) => item.product.id == product.id,
    );

    if (existingIndex != -1) {
      final item = state.cart[existingIndex];
      updateQuantity(product.id, item.quantity + 1);
    } else {
      final newItem = CartItem(
        product: product,
        quantity: 1,
        taxAmount: _calculateItemTax(product, 1, 0),
      );
      state = state.copyWith(cart: [...state.cart, newItem]);
    }
  }

  void removeFromCart(String productId) {
    state = state.copyWith(
      cart: state.cart.where((item) => item.product.id != productId).toList(),
    );
  }

  void updateQuantity(String productId, double quantity) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    state = state.copyWith(
      cart: state.cart.map((item) {
        if (item.product.id == productId) {
          return item.copyWith(
            quantity: quantity,
            taxAmount: _calculateItemTax(item.product, quantity, item.discount),
            discountAmount: item.discount * quantity,
          );
        }
        return item;
      }).toList(),
    );
  }

  void updateItemDiscount(String productId, double discountPerUnit) {
    state = state.copyWith(
      cart: state.cart.map((item) {
        if (item.product.id == productId) {
          return item.copyWith(
            discount: discountPerUnit,
            discountAmount: discountPerUnit * item.quantity,
            taxAmount: _calculateItemTax(
              item.product,
              item.quantity,
              discountPerUnit,
            ),
          );
        }
        return item;
      }).toList(),
    );
  }

  void setGlobalDiscount(double percentage) {
    state = state.copyWith(globalDiscount: percentage);
  }

  void selectClient(PosClient? client) {
    state = state.copyWith(
      selectedClient: client,
      clearSelectedClient: client == null,
    );
  }

  double _calculateItemTax(
    PosProduct product,
    double quantity,
    double discountPerUnit,
  ) {
    final itemSubtotal =
        (product.price * quantity) - (discountPerUnit * quantity);
    double totalTax = 0;
    for (var tax in product.taxes) {
      totalTax += itemSubtotal * (tax.taxRate / 100);
    }
    return totalTax;
  }

  Future<bool> checkout({
    List<PaymentAllocation>? allocations,
    String? paymentMethod,
  }) async {
    if (state.cart.isEmpty) return false;

    state = state.copyWith(isSubmitting: true, error: null);

    try {
      final repository = ref.read(posRepositoryProvider);

      final saleRequest = SaleRequest(
        clientId: state.selectedClient?.id,
        items: state.cart
            .map(
              (item) => SaleItemRequest(
                productId: item.product.id,
                description: item.product.name,
                quantity: item.quantity,
                unitPrice: item.product.price,
                taxRate: item.product.taxes.fold(
                  0,
                  (sum, tax) => sum + tax.taxRate,
                ),
                taxAmount: item.taxAmount,
                taxDescription: item.product.taxes
                    .map((t) => t.taxName)
                    .join(', '),
                discount: item.discount,
                discountAmount: item.discountAmount,
                accountId:
                    item.product.accountId ??
                    (state.incomeAccounts.isNotEmpty
                        ? state.incomeAccounts.first['id']
                        : null),
              ),
            )
            .toList(),
        subtotal: state.subtotal,
        totalTaxAmount: state.totalTax,
        totalDiscountAmount: state.totalDiscount,
        globalDiscount: state.globalDiscount,
        total: state.total,
        paymentAllocations: allocations,
        paymentMethod: paymentMethod,
      );

      final result = await repository.createSale(saleRequest);
      if (!ref.mounted) {
        return true; // Still returned true because the sale was created
      }

      state = state.copyWith(
        isSubmitting: false,
        cart: [],
        selectedClient: null,
        clearSelectedClient: true,
        globalDiscount: 0,
        lastSaleReceipt: result['id'],
        lastSaleResponse: result,
      );
      return true;
    } catch (e) {
      if (!ref.mounted) {
        return false;
      }
      state = state.copyWith(isSubmitting: false, error: e.toString());
      return false;
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}
