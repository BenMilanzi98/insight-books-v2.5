import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/stock_repository.dart';
import '../../domain/stock_models.dart';

final stockDetailsProvider =
    FutureProvider.family<StockProduct, String>((ref, productId) async {
  final repo = ref.watch(stockRepositoryProvider);
  return repo.fetchProduct(productId);
});

final stockMovementHistoryProvider =
    FutureProvider.family<List<StockTransaction>, String>((ref, productId) async {
  final repo = ref.watch(stockRepositoryProvider);
  return repo.fetchMovementHistory(productId: productId);
});
