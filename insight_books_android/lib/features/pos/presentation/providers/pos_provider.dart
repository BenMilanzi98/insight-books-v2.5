import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:dio/dio.dart';
import 'dart:async';
import 'dart:io';
import 'package:insightbooks_android/core/security/permissions_provider.dart';
import '../../domain/pos_models.dart';
import '../../data/pos_repository.dart';
import '../../data/offline_pos_queue.dart';

part 'pos_provider.g.dart';

class PosPageState {
  final List<PosProduct> products;
  final List<PosProduct> filteredProducts;
  final List<PosClient> clients;
  final List<PosClient> filteredClients;
  final List<Map<String, dynamic>> incomeAccounts;
  final List<Map<String, dynamic>> paymentAccounts;
  final List<Map<String, dynamic>> branches;
  final List<CartItem> cart;
  final PosClient? selectedClient;
  final String? selectedBranchId;
  final double globalDiscount; // Percentage
  final bool isLoading;
  final String? error;
  final bool isSubmitting;
  final String? lastSaleReceipt;
  final Map<String, dynamic>? lastSaleResponse;
  final String activeTab;
  final List<Map<String, dynamic>> recentSales;
  final Map<String, dynamic>? salesStatistics;
  final String historySearchQuery;
  final String historyStatusFilter;
  final String historySortBy;
  final String historySortOrder;
  final String? historyDateFrom;
  final String? historyDateTo;
  final String dailyReportDate;
  final Map<String, dynamic>? dailyReport;
  final Map<String, dynamic>? posCashDayState;
  final bool posCashActionLoading;
  final String? posCashMessage;
  final String historicalBatchName;
  final String? historicalUploadResult;
  final int offlineSalesCount;
  final String? offlineBlockedMessage;
  final bool eisEnabled;
  final bool eisTerminalBlocked;
  final String transactionType;
  final String buyerTpin;
  final String buyerAuthCode;
  final bool isReliefSupply;
  final String vat5CertificateNumber;
  final bool vat5Validated;
  final List<Map<String, dynamic>> taxTypes;
  final List<Map<String, dynamic>> taxAccounts;
  final String? defaultTaxTypeId;
  final bool isOnline;
  final String? serverTime;
  final String serverTimeSource;
  final bool canViewSales;
  final bool canCreateSales;
  final bool canVoidSales;
  final bool canRefundSales;
  final bool canExportSales;
  final bool canUpdateSales;

  PosPageState({
    this.products = const [],
    this.filteredProducts = const [],
    this.clients = const [],
    this.filteredClients = const [],
    this.incomeAccounts = const [],
    this.paymentAccounts = const [],
    this.branches = const [],
    this.cart = const [],
    this.selectedClient,
    this.selectedBranchId,
    this.globalDiscount = 0,
    this.isLoading = false,
    this.error,
    this.isSubmitting = false,
    this.lastSaleReceipt,
    this.lastSaleResponse,
    this.activeTab = 'sell',
    this.recentSales = const [],
    this.salesStatistics,
    this.historySearchQuery = '',
    this.historyStatusFilter = 'all',
    this.historySortBy = 'date',
    this.historySortOrder = 'desc',
    this.historyDateFrom,
    this.historyDateTo,
    this.dailyReportDate = '',
    this.dailyReport,
    this.posCashDayState,
    this.posCashActionLoading = false,
    this.posCashMessage,
    this.historicalBatchName = '',
    this.historicalUploadResult,
    this.offlineSalesCount = 0,
    this.offlineBlockedMessage,
    this.eisEnabled = false,
    this.eisTerminalBlocked = false,
    this.transactionType = 'B2C',
    this.buyerTpin = '',
    this.buyerAuthCode = '',
    this.isReliefSupply = false,
    this.vat5CertificateNumber = '',
    this.vat5Validated = false,
    this.taxTypes = const [],
    this.taxAccounts = const [],
    this.defaultTaxTypeId,
    this.isOnline = true,
    this.serverTime,
    this.serverTimeSource = 'local',
    this.canViewSales = true,
    this.canCreateSales = true,
    this.canVoidSales = true,
    this.canRefundSales = true,
    this.canExportSales = true,
    this.canUpdateSales = true,
  });

  PosPageState copyWith({
    List<PosProduct>? products,
    List<PosProduct>? filteredProducts,
    List<PosClient>? clients,
    List<PosClient>? filteredClients,
    List<Map<String, dynamic>>? incomeAccounts,
    List<Map<String, dynamic>>? paymentAccounts,
    List<Map<String, dynamic>>? branches,
    List<CartItem>? cart,
    PosClient? selectedClient,
    String? selectedBranchId,
    double? globalDiscount,
    bool? isLoading,
    String? error,
    bool? isSubmitting,
    String? lastSaleReceipt,
    Map<String, dynamic>? lastSaleResponse,
    String? activeTab,
    List<Map<String, dynamic>>? recentSales,
    Map<String, dynamic>? salesStatistics,
    String? historySearchQuery,
    String? historyStatusFilter,
    String? historySortBy,
    String? historySortOrder,
    String? historyDateFrom,
    String? historyDateTo,
    String? dailyReportDate,
    Map<String, dynamic>? dailyReport,
    Map<String, dynamic>? posCashDayState,
    bool? posCashActionLoading,
    String? posCashMessage,
    String? historicalBatchName,
    String? historicalUploadResult,
    int? offlineSalesCount,
    String? offlineBlockedMessage,
    bool? eisEnabled,
    bool? eisTerminalBlocked,
    String? transactionType,
    String? buyerTpin,
    String? buyerAuthCode,
    bool? isReliefSupply,
    String? vat5CertificateNumber,
    bool? vat5Validated,
    List<Map<String, dynamic>>? taxTypes,
    List<Map<String, dynamic>>? taxAccounts,
    String? defaultTaxTypeId,
    bool? isOnline,
    String? serverTime,
    String? serverTimeSource,
    bool? canViewSales,
    bool? canCreateSales,
    bool? canVoidSales,
    bool? canRefundSales,
    bool? canExportSales,
    bool? canUpdateSales,
    bool clearSelectedClient = false,
  }) {
    return PosPageState(
      products: products ?? this.products,
      filteredProducts: filteredProducts ?? this.filteredProducts,
      clients: clients ?? this.clients,
      filteredClients: filteredClients ?? this.filteredClients,
      incomeAccounts: incomeAccounts ?? this.incomeAccounts,
      paymentAccounts: paymentAccounts ?? this.paymentAccounts,
      branches: branches ?? this.branches,
      cart: cart ?? this.cart,
      selectedClient: clearSelectedClient
          ? null
          : (selectedClient ?? this.selectedClient),
      selectedBranchId: selectedBranchId ?? this.selectedBranchId,
      globalDiscount: globalDiscount ?? this.globalDiscount,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      lastSaleReceipt: lastSaleReceipt ?? this.lastSaleReceipt,
      lastSaleResponse: lastSaleResponse ?? this.lastSaleResponse,
      activeTab: activeTab ?? this.activeTab,
      recentSales: recentSales ?? this.recentSales,
      salesStatistics: salesStatistics ?? this.salesStatistics,
      historySearchQuery: historySearchQuery ?? this.historySearchQuery,
      historyStatusFilter: historyStatusFilter ?? this.historyStatusFilter,
      historySortBy: historySortBy ?? this.historySortBy,
      historySortOrder: historySortOrder ?? this.historySortOrder,
      historyDateFrom: historyDateFrom ?? this.historyDateFrom,
      historyDateTo: historyDateTo ?? this.historyDateTo,
      dailyReportDate: dailyReportDate ?? this.dailyReportDate,
      dailyReport: dailyReport ?? this.dailyReport,
      posCashDayState: posCashDayState ?? this.posCashDayState,
      posCashActionLoading: posCashActionLoading ?? this.posCashActionLoading,
      posCashMessage: posCashMessage ?? this.posCashMessage,
      historicalBatchName: historicalBatchName ?? this.historicalBatchName,
      historicalUploadResult: historicalUploadResult ?? this.historicalUploadResult,
      offlineSalesCount: offlineSalesCount ?? this.offlineSalesCount,
      offlineBlockedMessage: offlineBlockedMessage ?? this.offlineBlockedMessage,
      eisEnabled: eisEnabled ?? this.eisEnabled,
      eisTerminalBlocked: eisTerminalBlocked ?? this.eisTerminalBlocked,
      transactionType: transactionType ?? this.transactionType,
      buyerTpin: buyerTpin ?? this.buyerTpin,
      buyerAuthCode: buyerAuthCode ?? this.buyerAuthCode,
      isReliefSupply: isReliefSupply ?? this.isReliefSupply,
      vat5CertificateNumber: vat5CertificateNumber ?? this.vat5CertificateNumber,
      vat5Validated: vat5Validated ?? this.vat5Validated,
      taxTypes: taxTypes ?? this.taxTypes,
      taxAccounts: taxAccounts ?? this.taxAccounts,
      defaultTaxTypeId: defaultTaxTypeId ?? this.defaultTaxTypeId,
      isOnline: isOnline ?? this.isOnline,
      serverTime: serverTime ?? this.serverTime,
      serverTimeSource: serverTimeSource ?? this.serverTimeSource,
      canViewSales: canViewSales ?? this.canViewSales,
      canCreateSales: canCreateSales ?? this.canCreateSales,
      canVoidSales: canVoidSales ?? this.canVoidSales,
      canRefundSales: canRefundSales ?? this.canRefundSales,
      canExportSales: canExportSales ?? this.canExportSales,
      canUpdateSales: canUpdateSales ?? this.canUpdateSales,
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

String? _pickDefaultBranchId(List<Map<String, dynamic>> branches) {
  if (branches.isEmpty) return null;
  for (final b in branches) {
    final id = b['id']?.toString();
    if (id == null || id.isEmpty) continue;
    if (b['isDefault'] == true ||
        b['defaultForTenant'] == true ||
        b['default'] == true) {
      return id;
    }
  }
  return branches.first['id']?.toString();
}

@riverpod
class Pos extends _$Pos {
  final OfflinePosQueue _offlineQueue = OfflinePosQueue();
  Timer? _networkTimer;

  bool _isNetworkError(Object e) {
    if (e is SocketException) return true;
    if (e is DioException) {
      // Connection / timeout errors are typically handled as offline.
      return e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.unknown ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout;
    }
    final msg = e.toString().toLowerCase();
    return msg.contains('socket') ||
        msg.contains('network') ||
        msg.contains('timeout') ||
        msg.contains('failed to connect') ||
        msg.contains('connection refused') ||
        msg.contains('dns');
  }

  String _networkFriendlyError() {
    return 'Failed to connect to the internet, please check your internet connection.';
  }

  String _safeErrorMessage(Object e) {
    if (_isNetworkError(e)) return _networkFriendlyError();
    return _apiErrorMessage(e);
  }
  @override
  PosPageState build() {
    // We start loading data immediately
    _loadData();
    _startNetworkMonitor();
    ref.onDispose(() {
      _networkTimer?.cancel();
    });
    return PosPageState(isLoading: true);
  }

  Future<void> _loadData() async {
    try {
      final online = await _checkOnline();
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
      final paymentAccounts = await repository.fetchPaymentAccounts();
      if (!ref.mounted) {
        return;
      }
      final branches = await repository.fetchBranches();
      if (!ref.mounted) {
        return;
      }

      final taxTypes = await repository.fetchTaxTypes();
      final taxAccounts = await repository.fetchTaxAccounts();
      final taxDefaults = await repository.fetchTaxDefaults();
      final threshold = await _offlineQueue.checkThresholds();
      final perms = await ref.read(userPermissionsProvider.future);
      final canView = satisfiesPermission(perms, 'sales.view');
      final canCreate = satisfiesPermission(perms, 'sales.create');
      final canVoid = satisfiesPermission(perms, 'sales.void');
      final canRefund = satisfiesPermission(perms, 'sales.refund');
      final canExport = satisfiesPermission(perms, 'sales.export');
      final canUpdate = satisfiesPermission(perms, 'sales.update');

      state = state.copyWith(
        products: products,
        filteredProducts: products,
        clients: clients,
        filteredClients: clients,
        incomeAccounts: incomeAccounts,
        paymentAccounts: paymentAccounts,
        branches: branches,
        selectedBranchId: _pickDefaultBranchId(branches),
        dailyReportDate: DateTime.now().toIso8601String().split('T').first,
        taxTypes: taxTypes,
        taxAccounts: taxAccounts,
        defaultTaxTypeId: (taxDefaults?['inflowTaxTypeId'] ??
                taxDefaults?['defaultInflowTaxTypeId'])
            ?.toString(),
        offlineSalesCount: threshold.pendingCount,
        offlineBlockedMessage: threshold.blocked ? threshold.message : null,
        isOnline: online,
        canViewSales: canView,
        canCreateSales: canCreate,
        canVoidSales: canVoid,
        canRefundSales: canRefund,
        canExportSales: canExport,
        canUpdateSales: canUpdate,
        isLoading: false,
      );
      await loadEisStatus();
      await loadDailyReport();
      await loadPosCashDayState();
      await loadSalesHistory();
      if (online) {
        await syncOfflineSales();
      } else {
        await refreshOfflineStatus();
      }
    } catch (e) {
      if (!ref.mounted) {
        return;
      }
      state = state.copyWith(
        isLoading: false,
        error: _safeErrorMessage(e),
        isOnline: false,
      );
    }
  }

  void setActiveTab(String tab) {
    state = state.copyWith(activeTab: tab);
    if (tab == 'history') {
      loadSalesHistory();
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
    if (!state.canCreateSales) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
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

  /// Returns the product name when added, or `null` if not found / not allowed.
  Future<String?> addToCartByBarcode(String code) async {
    if (!state.canCreateSales) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return null;
    }
    final trimmed = code.trim();
    if (trimmed.isEmpty) return null;
    final probe = trimmed.toLowerCase();
    PosProduct? product;
    for (final p in state.products) {
      if ((p.sku ?? '').toLowerCase() == probe) {
        product = p;
        break;
      }
    }
    product ??= await ref.read(posRepositoryProvider).findProductByBarcodeOrSku(trimmed);
    if (product == null) {
      return null;
    }
    PosProduct? existingLocal;
    for (final p in state.products) {
      if (p.id == product.id) {
        existingLocal = p;
        break;
      }
    }
    final toAdd = existingLocal ?? product;
    addToCart(toAdd);
    return toAdd.name;
  }

  void removeFromCart(String productId) {
    state = state.copyWith(
      cart: state.cart.where((item) => item.product.id != productId).toList(),
    );
  }

  void updateQuantity(String productId, double quantity) {
    if (!state.canUpdateSales) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
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
    if (!state.canUpdateSales) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
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
    if (!state.canUpdateSales) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
    state = state.copyWith(globalDiscount: percentage);
  }

  void selectClient(PosClient? client) {
    state = state.copyWith(
      selectedClient: client,
      clearSelectedClient: client == null,
    );
  }

  void setSelectedBranch(String? branchId) {
    state = state.copyWith(selectedBranchId: branchId);
  }

  void setTransactionType(String value) {
    state = state.copyWith(transactionType: value);
  }

  void setBuyerTpin(String value) {
    state = state.copyWith(buyerTpin: value);
  }

  void setBuyerAuthCode(String value) {
    state = state.copyWith(buyerAuthCode: value);
  }

  void setReliefSupply(bool value) {
    state = state.copyWith(isReliefSupply: value, vat5Validated: false);
  }

  void setVat5Certificate(String value) {
    state = state.copyWith(vat5CertificateNumber: value, vat5Validated: false);
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
    String? notes,
    String status = 'completed',
  }) async {
    if (state.cart.isEmpty) return false;
    if (!state.canCreateSales) {
      state = state.copyWith(
        error: 'You do not have permission to perform this action.',
        isSubmitting: false,
      );
      return false;
    }
    if (state.transactionType == 'B2B' && !state.isOnline) {
      state = state.copyWith(
        error: 'B2B transactions must be processed online.',
        isSubmitting: false,
      );
      return false;
    }

    state = state.copyWith(isSubmitting: true, error: null);

    try {
      final repository = ref.read(posRepositoryProvider);
      final payload = _buildSalePayload(
        allocations: allocations,
        paymentMethod: paymentMethod,
        notes: notes,
        status: status,
      );
      final result = await repository.createSaleFromPayload(payload);
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
      await loadSalesHistory();
      await refreshOfflineStatus();
      return true;
    } on Exception catch (e) {
      if (_isNetworkError(e)) {
        final threshold = await _offlineQueue.checkThresholds();
        if (threshold.blocked) {
          state = state.copyWith(
            isSubmitting: false,
            error: threshold.message,
            offlineBlockedMessage: threshold.message,
            offlineSalesCount: threshold.pendingCount,
          );
          return false;
        }
        final payload = _buildSalePayload(
          allocations: allocations,
          paymentMethod: paymentMethod,
          notes: notes,
          status: status,
        );
        final queued = await _offlineQueue.queueSale(payload);
        final pendingCount = await _offlineQueue.pendingCount();
        if (!ref.mounted) return true;
        state = state.copyWith(
          isSubmitting: false,
          cart: [],
          selectedClient: null,
          clearSelectedClient: true,
          globalDiscount: 0,
          lastSaleReceipt: 'OFFLINE-${queued['offlineSequence']}',
          lastSaleResponse: {
            'sale': {
              'id': 'OFFLINE-${queued['offlineSequence']}',
              'total_amount': state.total,
              'items': payload['items'],
              'client': {'name': state.selectedClient?.name ?? 'Walk-in Customer'},
              'offlineSignature': queued['signature'],
            },
          },
          offlineSalesCount: pendingCount,
          error: null,
        );
        return true;
      }
      if (!ref.mounted) {
        return false;
      }
      state = state.copyWith(isSubmitting: false, error: _safeErrorMessage(e));
      return false;
    }
  }

  Future<bool> saveDraft({
    List<PaymentAllocation>? allocations,
    String? paymentMethod,
    String? notes,
  }) async {
    return checkout(
      allocations: allocations,
      paymentMethod: paymentMethod,
      notes: notes,
      status: 'draft',
    );
  }

  Future<void> loadSalesHistory() async {
    try {
      final repository = ref.read(posRepositoryProvider);
      final result = await repository.fetchSales(
        limit: 20,
        search: state.historySearchQuery.isEmpty ? null : state.historySearchQuery,
        status: state.historyStatusFilter == 'all' ? null : state.historyStatusFilter,
        sortBy: state.historySortBy,
        sortOrder: state.historySortOrder,
        dateFrom: state.historyDateFrom,
        dateTo: state.historyDateTo,
      );
      final stats = await repository.fetchSalesStatistics(
        dateFrom: state.historyDateFrom,
        dateTo: state.historyDateTo,
      );
      if (!ref.mounted) return;
      state = state.copyWith(recentSales: result.sales, salesStatistics: stats);
    } catch (_) {}
  }

  void setHistorySearchQuery(String query) {
    state = state.copyWith(historySearchQuery: query);
    loadSalesHistory();
  }

  void setHistoryStatusFilter(String status) {
    state = state.copyWith(historyStatusFilter: status);
    loadSalesHistory();
  }

  void setHistorySortBy(String sortBy) {
    final isSame = state.historySortBy == sortBy;
    state = state.copyWith(
      historySortBy: sortBy,
      historySortOrder: isSame
          ? (state.historySortOrder == 'asc' ? 'desc' : 'asc')
          : 'desc',
    );
    loadSalesHistory();
  }

  void setHistoryDateRange(String? from, String? to) {
    state = state.copyWith(historyDateFrom: from, historyDateTo: to);
    loadSalesHistory();
  }

  Future<void> exportSalesCsv() async {
    if (!state.canExportSales) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
    await ref.read(posRepositoryProvider).exportSalesCsv(
      search: state.historySearchQuery,
      status: state.historyStatusFilter,
      dateFrom: state.historyDateFrom,
      dateTo: state.historyDateTo,
    );
  }

  Future<void> loadDailyReport() async {
    if (state.dailyReportDate.isEmpty) return;
    try {
      final report = await ref
          .read(posRepositoryProvider)
          .fetchDailyPosReport(state.dailyReportDate);
      if (!ref.mounted) return;
      state = state.copyWith(dailyReport: report);
    } catch (_) {}
  }

  Future<void> loadPosCashDayState() async {
    try {
      final stateMap = await ref
          .read(posRepositoryProvider)
          .fetchPosCashDayState(date: state.dailyReportDate);
      if (!ref.mounted) return;
      state = state.copyWith(posCashDayState: stateMap);
    } catch (_) {}
  }

  void setDailyReportDate(String date) {
    state = state.copyWith(dailyReportDate: date);
    loadDailyReport();
    loadPosCashDayState();
  }

  Future<String?> openPosCashDay() async {
    state = state.copyWith(posCashActionLoading: true, posCashMessage: null);
    try {
      await ref
          .read(posRepositoryProvider)
          .openPosCashDay(businessDate: state.dailyReportDate);
      await loadPosCashDayState();
      if (!ref.mounted) return null;
      state = state.copyWith(
        posCashActionLoading: false,
        posCashMessage: 'Day opened successfully.',
      );
      return null;
    } catch (e) {
      if (!ref.mounted) return _safeErrorMessage(e);
      final err = _safeErrorMessage(e);
      state = state.copyWith(posCashActionLoading: false, posCashMessage: err);
      return err;
    }
  }

  Future<String?> closePosCashDay() async {
    state = state.copyWith(posCashActionLoading: true, posCashMessage: null);
    try {
      await ref
          .read(posRepositoryProvider)
          .closePosCashDay(businessDate: state.dailyReportDate);
      await loadPosCashDayState();
      if (!ref.mounted) return null;
      state = state.copyWith(
        posCashActionLoading: false,
        posCashMessage: 'Day closed successfully.',
      );
      return null;
    } catch (e) {
      if (!ref.mounted) return _safeErrorMessage(e);
      final err = _safeErrorMessage(e);
      state = state.copyWith(posCashActionLoading: false, posCashMessage: err);
      return err;
    }
  }

  Future<String?> depositPosCashDay({
    required String toAccountId,
    required double amount,
    String? notes,
  }) async {
    state = state.copyWith(posCashActionLoading: true, posCashMessage: null);
    try {
      await ref.read(posRepositoryProvider).depositPosCashDay(
        businessDate: state.dailyReportDate,
        lines: [
          {
            'toAccountId': toAccountId,
            'amount': amount,
            if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
          },
        ],
      );
      await loadPosCashDayState();
      if (!ref.mounted) return null;
      state = state.copyWith(
        posCashActionLoading: false,
        posCashMessage: 'Deposit recorded.',
      );
      return null;
    } catch (e) {
      if (!ref.mounted) return _safeErrorMessage(e);
      final err = _safeErrorMessage(e);
      state = state.copyWith(posCashActionLoading: false, posCashMessage: err);
      return err;
    }
  }

  void setHistoricalBatchName(String value) {
    state = state.copyWith(historicalBatchName: value);
  }

  Future<void> refreshOfflineStatus() async {
    final threshold = await _offlineQueue.checkThresholds();
    if (!ref.mounted) return;
    state = state.copyWith(
      offlineSalesCount: threshold.pendingCount,
      offlineBlockedMessage: threshold.blocked ? threshold.message : null,
    );
  }

  Future<Map<String, int>> syncOfflineSales() async {
    final repo = ref.read(posRepositoryProvider);
    final result = await _offlineQueue.syncPending(
      (saleData) async => repo.createSaleFromPayload(saleData),
    );
    await refreshOfflineStatus();
    return result;
  }

  Future<void> loadEisStatus() async {
    final repo = ref.read(posRepositoryProvider);
    try {
      final health = await repo.fetchEisHealth();
      final enabled = health['configured'] == true;
      bool blocked = false;
      String? serverTime;
      String source = 'local';
      if (enabled) {
        try {
          final timeData = await repo.fetchEisServerTime();
          serverTime = timeData['serverTime']?.toString();
          source = serverTime == null ? 'local' : 'mra';
        } catch (_) {}
        final status = await repo.fetchEisTerminalStatus();
        blocked = status['blocked'] == true;
      }
      if (!ref.mounted) return;
      state = state.copyWith(
        eisEnabled: enabled,
        eisTerminalBlocked: blocked,
        serverTime: serverTime,
        serverTimeSource: source,
      );
    } catch (_) {}
  }

  void _startNetworkMonitor() {
    _networkTimer?.cancel();
    _networkTimer = Timer.periodic(const Duration(seconds: 8), (_) async {
      final online = await _checkOnline();
      if (!ref.mounted) return;
      final wasOnline = state.isOnline;
      state = state.copyWith(isOnline: online);
      if (online && !wasOnline) {
        await syncOfflineSales();
        await loadEisStatus();
      }
    });
  }

  Future<bool> _checkOnline() async {
    try {
      final result = await InternetAddress.lookup('example.com');
      return result.isNotEmpty && result.first.rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<bool> validateVat5() async {
    if (state.vat5CertificateNumber.trim().isEmpty) return false;
    try {
      final result = await ref
          .read(posRepositoryProvider)
          .validateVat5(state.vat5CertificateNumber.trim());
      final ok = result['valid'] == true || result['success'] == true;
      state = state.copyWith(vat5Validated: ok);
      return ok;
    } catch (_) {
      state = state.copyWith(vat5Validated: false);
      return false;
    }
  }

  void addCustomProduct({
    required String name,
    required double unitPrice,
    double quantity = 1,
  }) {
    if (!state.canUpdateSales) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
    final custom = PosProduct(
      id: 'custom-${DateTime.now().microsecondsSinceEpoch}',
      name: name,
      price: unitPrice,
      stockLevel: null,
      category: 'Custom',
      accountId: state.incomeAccounts.isNotEmpty
          ? state.incomeAccounts.first['id']?.toString()
          : null,
      taxes: const [],
      units: const [],
    );
    state = state.copyWith(
      cart: [
        ...state.cart,
        CartItem(product: custom, quantity: quantity),
      ],
    );
  }

  void setUnitQuantities(String productId, Map<String, double> unitQuantities) {
    if (!state.canUpdateSales) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
    state = state.copyWith(
      cart: state.cart.map((item) {
        if (item.product.id != productId) return item;
        double qty = 0;
        for (final unit in item.product.units) {
          final q = unitQuantities[unit.id] ?? 0;
          qty += q * unit.conversionRate;
        }
        final effectiveQty = qty > 0 ? qty : item.quantity;
        return item.copyWith(
          quantity: effectiveQty,
          unitQuantities: unitQuantities,
          taxAmount: _calculateItemTax(item.product, effectiveQty, item.discount),
          discountAmount: item.discount * effectiveQty,
        );
      }).toList(),
    );
  }

  void applyTaxToCartItem(String productId, Map<String, dynamic> taxType) {
    if (!state.canUpdateSales) {
      state = state.copyWith(error: 'You do not have permission to perform this action.');
      return;
    }
    final tax = ProductTax(
      id: (taxType['id'] ?? '').toString(),
      taxName: (taxType['taxName'] ?? taxType['name'] ?? 'Tax').toString(),
      taxRate: double.tryParse('${taxType['taxRate'] ?? 0}') ?? 0,
    );
    state = state.copyWith(
      cart: state.cart.map((item) {
        if (item.product.id != productId) return item;
        final updatedProduct = item.product.copyWith(
          taxes: [...item.product.taxes.where((t) => t.id != tax.id), tax],
        );
        return item.copyWith(
          product: updatedProduct,
          taxAmount: _calculateItemTax(updatedProduct, item.quantity, item.discount),
        );
      }).toList(),
    );
  }

  Future<Map<String, dynamic>> createAndAddTaxType({
    required String taxName,
    required double taxRate,
    required String accountId,
  }) async {
    if (!state.canUpdateSales) {
      throw Exception('You do not have permission to perform this action.');
    }
    final created = await ref.read(posRepositoryProvider).createTaxType(
          taxName: taxName,
          taxRate: taxRate,
          accountId: accountId,
        );
    final tax = (created['taxType'] is Map)
        ? Map<String, dynamic>.from(created['taxType'] as Map)
        : created;
    state = state.copyWith(taxTypes: [...state.taxTypes, tax]);
    return tax;
  }

  Map<String, dynamic> _buildSalePayload({
    List<PaymentAllocation>? allocations,
    String? paymentMethod,
    String? notes,
    required String status,
  }) {
    return {
      'clientId': state.selectedClient?.id,
      'branchId': state.selectedBranchId,
      'items': state.cart
          .map(
            (item) => {
              'productId': item.product.id.startsWith('custom-')
                  ? null
                  : item.product.id,
              'description': item.product.name,
              'quantity': item.quantity,
              'unitPrice': item.product.price,
              'taxRate': item.product.taxes.fold<double>(
                0,
                (sum, tax) => sum + tax.taxRate,
              ),
              'taxAmount': item.taxAmount,
              'taxDescription': item.product.taxes.map((t) => t.taxName).join(', '),
              'discount': item.discount,
              'discountAmount': item.discountAmount,
              'isCustom': item.product.id.startsWith('custom-'),
              'accountId': item.product.accountId ??
                  (state.incomeAccounts.isNotEmpty
                      ? state.incomeAccounts.first['id']
                      : null),
              if (item.unitQuantities != null) 'unitQuantities': item.unitQuantities,
            },
          )
          .toList(),
      'subtotal': state.subtotal,
      'totalTaxAmount': state.totalTax,
      'totalDiscountAmount': state.totalDiscount,
      'globalDiscount': state.globalDiscount,
      'total': state.total,
      'paymentAllocations': allocations?.map((e) => e.toJson()).toList(),
      'paymentMethod': paymentMethod,
      'notes': notes,
      'status': status,
      'transactionType': state.transactionType,
      'customerTPIN': state.transactionType == 'B2B' ? state.buyerTpin.trim() : '',
      'buyerAuthorizationCode': state.buyerAuthCode.trim().isEmpty
          ? null
          : state.buyerAuthCode.trim(),
      'isReliefSupply': state.isReliefSupply,
      'vat5CertificateNumber': state.isReliefSupply
          ? state.vat5CertificateNumber.trim()
          : null,
      if (state.serverTime != null) 'saleDate': state.serverTime,
    };
  }

  Future<List<int>> downloadHistoricalTemplate() async {
    if (!state.canExportSales) {
      throw Exception('You do not have permission to perform this action.');
    }
    return ref.read(posRepositoryProvider).downloadHistoricalTemplate();
  }

  Future<void> uploadHistoricalBatch(String filePath) async {
    if (!state.canUpdateSales) {
      throw Exception('You do not have permission to perform this action.');
    }
    final result = await ref.read(posRepositoryProvider).uploadHistoricalBatch(
          batchName: state.historicalBatchName,
          filePath: filePath,
        );
    state = state.copyWith(
      historicalUploadResult: (result['message'] ?? 'Upload complete').toString(),
    );
  }

  /// Returns `null` on success, or an error message (show in UI).
  Future<String?> voidSale(String saleId, String reason) async {
    if (!state.canVoidSales) {
      return 'You do not have permission to void sales.';
    }
    try {
      await ref.read(posRepositoryProvider).voidSale(saleId, reason);
      await loadSalesHistory();
      return null;
    } catch (e) {
      return _apiErrorMessage(e);
    }
  }

  /// Same contract as web [refundSale]: completed sales only; reason required.
  Future<String?> refundSale(
    String saleId,
    String reason, {
    String? refundMethod,
  }) async {
    if (!state.canRefundSales) {
      return 'You do not have permission to refund sales.';
    }
    try {
      await ref.read(posRepositoryProvider).refundSale(
            saleId,
            reason,
            refundMethod: refundMethod,
          );
      await loadSalesHistory();
      return null;
    } catch (e) {
      return _apiErrorMessage(e);
    }
  }

  String _apiErrorMessage(Object e) {
    if (_isNetworkError(e)) return _networkFriendlyError();
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] != null) {
        return data['error'].toString();
      }
      return e.message ?? e.toString();
    }
    return e.toString();
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}
