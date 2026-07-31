import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/features/stock/data/stock_movement_offline_queue.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('StockMovementOfflineQueue', () {
    late StockMovementOfflineQueue queue;

    setUp(() {
      queue = StockMovementOfflineQueue();
    });

    test('starts with zero pending', () async {
      expect(await queue.pendingCount(), 0);
    });

    test('enqueue adds a pending entry and increases count', () async {
      final result = await queue.enqueue(
        tenantId: 'tenant-1',
        productId: 'product-1',
        type: StockMovementType.stockIn,
        quantity: 5,
        unitCost: 10,
        notes: 'Restock',
      );

      expect(result['queued'], isTrue);
      expect(result['id'], isNotEmpty);
      expect(await queue.pendingCount(), 1);
    });

    test('enqueue stores all required fields', () async {
      await queue.enqueue(
        tenantId: 'tenant-1',
        productId: 'product-1',
        type: StockMovementType.stockOut,
        quantity: 2,
        unitCost: 15,
        notes: 'Sold offline',
      );

      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('stock_movement_offline_queue_v1');
      expect(raw, isNotNull);

      final result = await queue.syncPending((entry) async {
        expect(entry['tenantId'], 'tenant-1');
        expect(entry['productId'], 'product-1');
        expect(entry['type'], 'Stock Out');
        expect(entry['quantity'], 2);
        expect(entry['unitCost'], 15);
        expect(entry['notes'], 'Sold offline');
        expect(entry['status'], 'pending');
        expect(entry['attempts'], 0);
        expect(entry['createdAt'], isNotEmpty);
        expect(entry['id'], isNotEmpty);
      });

      expect(result['synced'], 1);
    });

    test('syncPending syncs entries and marks them synced', () async {
      await queue.enqueue(
        tenantId: 'tenant-1',
        productId: 'product-1',
        type: StockMovementType.adjustment,
        quantity: 1,
      );

      final posted = <Map<String, dynamic>>[];
      final result = await queue.syncPending((entry) async {
        posted.add(Map<String, dynamic>.from(entry));
      });

      expect(result['synced'], 1);
      expect(result['failed'], 0);
      expect(posted.length, 1);
      expect(posted.first['type'], 'Adjustment');
      expect(await queue.pendingCount(), 0);
    });

    test('syncPending marks entries failed after maxRetries', () async {
      final q = StockMovementOfflineQueue(maxRetries: 1);
      await q.enqueue(
        tenantId: 'tenant-1',
        productId: 'product-1',
        type: StockMovementType.stockIn,
        quantity: 3,
      );

      final r1 = await q.syncPending((_) async => throw Exception('network'));
      expect(r1['failed'], 1);
      expect(await q.pendingCount(), 0);

      final failed = await q.listFailed();
      expect(failed.length, 1);
      expect(failed.first['type'], 'Stock In');
    });

    test('retry resets a failed entry to pending', () async {
      final q = StockMovementOfflineQueue(maxRetries: 1);
      await q.enqueue(
        tenantId: 'tenant-1',
        productId: 'product-1',
        type: StockMovementType.stockOut,
        quantity: 1,
      );
      await q.syncPending((_) async => throw Exception('network'));
      final failed = await q.listFailed();
      expect(failed.length, 1);

      await q.retry(failed.first['id'] as String);
      expect(await q.listFailed(), isEmpty);
      expect(await q.pendingCount(), 1);
    });

    test('discard permanently removes a failed entry', () async {
      final q = StockMovementOfflineQueue(maxRetries: 1);
      await q.enqueue(
        tenantId: 'tenant-1',
        productId: 'product-1',
        type: StockMovementType.adjustment,
        quantity: 4,
      );
      await q.syncPending((_) async => throw Exception('network'));
      final failed = await q.listFailed();
      expect(failed.length, 1);

      await q.discard(failed.first['id'] as String);
      expect(await q.listFailed(), isEmpty);
      expect(await q.pendingCount(), 0);
    });
  });
}
