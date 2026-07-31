import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/core/security/permissions_provider.dart'
    show satisfiesPermission, userPermissionsProvider;

import '../../data/stock_repository.dart';
import '../../domain/bulk_stock_csv_parser.dart';
import '../../domain/stock_models.dart';
import 'stock_provider.dart';

class BulkImportProgress {
  const BulkImportProgress({
    required this.total,
    required this.processed,
    this.created = 0,
    this.restored = 0,
    this.failed = 0,
    this.currentLabel,
  });

  final int total;
  final int processed;
  final int created;
  final int restored;
  final int failed;
  final String? currentLabel;

  double get fraction => total == 0 ? 0 : processed / total;
}

class BulkImportItemError {
  const BulkImportItemError({
    required this.sku,
    required this.name,
    required this.message,
  });

  final String sku;
  final String name;
  final String message;
}

class BulkStockState {
  const BulkStockState({
    this.isOffline = false,
    this.canCreate = false,
    this.canExport = false,
    this.canDelete = false,
    this.isExporting = false,
    this.isImporting = false,
    this.isDeleting = false,
    this.isLoadingProducts = false,
    this.previewRows = const [],
    this.parseErrors = const [],
    this.importProgress,
    this.importErrors = const [],
    this.deleteCandidates = const [],
    this.selectedDeleteIds = const [],
    this.deleteSearch = '',
    this.error,
  });

  final bool isOffline;
  final bool canCreate;
  final bool canExport;
  final bool canDelete;
  final bool isExporting;
  final bool isImporting;
  final bool isDeleting;
  final bool isLoadingProducts;
  final List<BulkStockImportRow> previewRows;
  final List<String> parseErrors;
  final BulkImportProgress? importProgress;
  final List<BulkImportItemError> importErrors;
  final List<StockProduct> deleteCandidates;
  final List<String> selectedDeleteIds;
  final String deleteSearch;
  final String? error;

  BulkStockState copyWith({
    bool? isOffline,
    bool? canCreate,
    bool? canExport,
    bool? canDelete,
    bool? isExporting,
    bool? isImporting,
    bool? isDeleting,
    bool? isLoadingProducts,
    List<BulkStockImportRow>? previewRows,
    List<String>? parseErrors,
    BulkImportProgress? importProgress,
    List<BulkImportItemError>? importErrors,
    List<StockProduct>? deleteCandidates,
    List<String>? selectedDeleteIds,
    String? deleteSearch,
    String? error,
    bool clearImportProgress = false,
    bool clearPreview = false,
  }) {
    return BulkStockState(
      isOffline: isOffline ?? this.isOffline,
      canCreate: canCreate ?? this.canCreate,
      canExport: canExport ?? this.canExport,
      canDelete: canDelete ?? this.canDelete,
      isExporting: isExporting ?? this.isExporting,
      isImporting: isImporting ?? this.isImporting,
      isDeleting: isDeleting ?? this.isDeleting,
      isLoadingProducts: isLoadingProducts ?? this.isLoadingProducts,
      previewRows: clearPreview ? const [] : (previewRows ?? this.previewRows),
      parseErrors: parseErrors ?? this.parseErrors,
      importProgress:
          clearImportProgress ? null : (importProgress ?? this.importProgress),
      importErrors: importErrors ?? this.importErrors,
      deleteCandidates: deleteCandidates ?? this.deleteCandidates,
      selectedDeleteIds: selectedDeleteIds ?? this.selectedDeleteIds,
      deleteSearch: deleteSearch ?? this.deleteSearch,
      error: error,
    );
  }
}

class BulkStockController extends Notifier<BulkStockState> {
  @override
  BulkStockState build() => const BulkStockState();

  Future<bool> _checkOnline() async {
    try {
      final result = await InternetAddress.lookup('example.com');
      return result.isNotEmpty && result.first.rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<void> initialize() async {
    final online = await _checkOnline();
    if (!online) {
      state = state.copyWith(isOffline: true);
      return;
    }

    final perms = await ref.read(userPermissionsProvider.future);
    state = state.copyWith(
      isOffline: false,
      canCreate: satisfiesPermission(perms, 'stock.create'),
      canExport: satisfiesPermission(perms, 'stock.export'),
      canDelete: satisfiesPermission(perms, 'stock.delete'),
    );
    await loadDeleteCandidates();
  }

  void clearPreview() {
    state = state.copyWith(clearPreview: true, parseErrors: const []);
  }

  void parseCsvContent(String content) {
    final result = parseBulkStockCsv(content);
    state = state.copyWith(
      previewRows: result.rows,
      parseErrors: result.errors,
      importErrors: const [],
      clearImportProgress: true,
      error: null,
    );
  }

  Future<StockExportResult> exportCsv({
    String? search,
    String? category,
    String? status,
  }) async {
    if (!state.canExport) {
      throw Exception('You do not have permission to export stock.');
    }
    state = state.copyWith(isExporting: true, error: null);
    try {
      final repo = ref.read(stockRepositoryProvider);
      return await repo.exportStockCsv(
        search: search,
        category: category,
        status: status,
      );
    } finally {
      state = state.copyWith(isExporting: false);
    }
  }

  Future<Map<String, int>> importPreviewRows() async {
    if (!state.canCreate) {
      throw Exception('You do not have permission to import stock.');
    }
    if (state.previewRows.isEmpty || state.parseErrors.isNotEmpty) {
      throw Exception('Fix validation errors before importing.');
    }

    final rows = state.previewRows;
    state = state.copyWith(
      isImporting: true,
      importErrors: const [],
      importProgress: BulkImportProgress(total: rows.length, processed: 0),
      error: null,
    );

    final repo = ref.read(stockRepositoryProvider);
    var created = 0;
    var restored = 0;
    var failed = 0;
    final itemErrors = <BulkImportItemError>[];

    for (var i = 0; i < rows.length; i++) {
      final row = rows[i];
      state = state.copyWith(
        importProgress: BulkImportProgress(
          total: rows.length,
          processed: i,
          created: created,
          restored: restored,
          failed: failed,
          currentLabel: row.name,
        ),
      );

      try {
        await repo.createProduct(row.toCreateBody());
        created++;
      } on DioException catch (e) {
        if (e.response?.statusCode == 409) {
          final handled = await _tryRestoreDeletedProduct(repo, row, e);
          if (handled) {
            restored++;
          } else {
            failed++;
            itemErrors.add(
              BulkImportItemError(
                sku: row.sku,
                name: row.name,
                message: _messageFromDio(e),
              ),
            );
          }
        } else {
          failed++;
          itemErrors.add(
            BulkImportItemError(
              sku: row.sku,
              name: row.name,
              message: _messageFromDio(e),
            ),
          );
        }
      } catch (e) {
        failed++;
        itemErrors.add(
          BulkImportItemError(
            sku: row.sku,
            name: row.name,
            message: NetworkErrorMapper.toUserMessage(e),
          ),
        );
      }
    }

    state = state.copyWith(
      isImporting: false,
      importProgress: BulkImportProgress(
        total: rows.length,
        processed: rows.length,
        created: created,
        restored: restored,
        failed: failed,
      ),
      importErrors: itemErrors,
      clearPreview: failed == 0,
    );

    ref.invalidate(stockControllerProvider);
    return {'created': created, 'restored': restored, 'failed': failed};
  }

  Future<bool> _tryRestoreDeletedProduct(
    StockRepository repo,
    BulkStockImportRow row,
    DioException error,
  ) async {
    final data = error.response?.data;
    if (data is! Map) return false;

    final map = Map<String, dynamic>.from(data);
    if (map['conflictType'] != 'deleted_product') return false;

    final deleted = map['deletedProduct'];
    final deletedId = deleted is Map
        ? (deleted['id'] ?? deleted['productId'])?.toString()
        : null;
    if (deletedId == null || deletedId.isEmpty) return false;

    await repo.restoreProducts([deletedId]);
    await Future<void>.delayed(const Duration(milliseconds: 300));

    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await repo.updateProduct(deletedId, row.toRestoreUpdateBody());
        return true;
      } catch (_) {
        if (attempt < 2) {
          await Future<void>.delayed(Duration(milliseconds: 300 * (attempt + 1)));
        }
      }
    }
    return false;
  }

  String _messageFromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] != null) {
      return data['error'].toString();
    }
    return NetworkErrorMapper.toUserMessage(e);
  }

  Future<void> loadDeleteCandidates() async {
    if (!state.canDelete) return;
    state = state.copyWith(isLoadingProducts: true, error: null);
    try {
      final repo = ref.read(stockRepositoryProvider);
      final response = await repo.fetchProducts(
        page: 1,
        limit: 500,
        catalog: 'products',
        search: state.deleteSearch.isEmpty ? null : state.deleteSearch,
      );
      state = state.copyWith(
        deleteCandidates: response.products.where((p) => !p.isService).toList(),
        isLoadingProducts: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingProducts: false,
        error: NetworkErrorMapper.toUserMessage(e),
      );
    }
  }

  void setDeleteSearch(String query) {
    state = state.copyWith(deleteSearch: query);
  }

  void toggleDeleteSelection(String id) {
    final current = List<String>.from(state.selectedDeleteIds);
    if (current.contains(id)) {
      current.remove(id);
    } else {
      current.add(id);
    }
    state = state.copyWith(selectedDeleteIds: current);
  }

  void clearDeleteSelection() {
    state = state.copyWith(selectedDeleteIds: const []);
  }

  Future<int> batchDeleteSelected({String? reason}) async {
    if (!state.canDelete) {
      throw Exception('You do not have permission to delete stock.');
    }
    final ids = state.selectedDeleteIds;
    if (ids.isEmpty) {
      throw Exception('Select at least one product to delete.');
    }

    state = state.copyWith(isDeleting: true, error: null);
    try {
      final repo = ref.read(stockRepositoryProvider);
      final result = await repo.batchDeleteProducts(ids, reason: reason);
      state = state.copyWith(
        isDeleting: false,
        selectedDeleteIds: const [],
      );
      ref.invalidate(stockControllerProvider);
      await loadDeleteCandidates();
      return result.deletedCount;
    } catch (e) {
      state = state.copyWith(
        isDeleting: false,
        error: NetworkErrorMapper.toUserMessage(e),
      );
      rethrow;
    }
  }
}

final bulkStockControllerProvider =
    NotifierProvider<BulkStockController, BulkStockState>(
  BulkStockController.new,
);
