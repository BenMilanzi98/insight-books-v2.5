import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:insightbooks_android/features/pos/data/offline_pos_queue.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('OfflinePosQueue', () {
    late OfflinePosQueue queue;

    setUp(() {
      queue = OfflinePosQueue();
    });

    test('starts with zero pending', () async {
      expect(await queue.pendingCount(), 0);
    });

    test('queueSale adds a pending entry', () async {
      final result = await queue.queueSale({
        'items': [
          {'name': 'Widget', 'quantity': 1, 'price': 100}
        ],
        'total': 100,
        'clientId': null,
        'paymentMethod': 'cash',
      });
      expect(result['queued'], isTrue);
      expect(result['offlineSequence'], 1);
      expect(result['signature'], isNotEmpty);
      expect(await queue.pendingCount(), 1);
    });

    test('queueSale generates sequential offlineSequence', () async {
      final sale = {
        'items': [],
        'total': 50,
        'clientId': null,
        'paymentMethod': 'cash',
      };
      final r1 = await queue.queueSale(sale);
      final r2 = await queue.queueSale(sale);
      expect(r1['offlineSequence'], 1);
      expect(r2['offlineSequence'], 2);
      expect(await queue.pendingCount(), 2);
    });

    test('syncPending syncs entries and marks them synced', () async {
      await queue.queueSale({
        'items': [],
        'total': 100,
        'clientId': null,
        'paymentMethod': 'cash',
      });

      final result = await queue.syncPending((_) async {});
      expect(result['synced'], 1);
      expect(result['failed'], 0);
      expect(result['expired'], 0);
      expect(await queue.pendingCount(), 0);
    });

    test('syncPending marks entries failed after maxRetries', () async {
      final q = OfflinePosQueue(maxRetries: 1);
      await q.queueSale({
        'items': [],
        'total': 100,
        'clientId': null,
        'paymentMethod': 'cash',
      });

      final r1 = await q.syncPending((_) async => throw Exception('network'));
      expect(r1['failed'], 1);
      expect(await q.pendingCount(), 0);
      final failedItems = await q.failedItems();
      expect(failedItems.length, 1);
    });

    test('syncPending marks old entries as expired instead of deleting', () async {
      final q = OfflinePosQueue(timeThresholdMs: 0);
      await q.queueSale({
        'items': [],
        'total': 100,
        'clientId': null,
        'paymentMethod': 'cash',
      });

      // With timeThresholdMs=0, any entry is immediately "expired".
      final result = await q.syncPending((_) async {});
      expect(result['expired'], 1);
      expect(result['synced'], 0);
      expect(await q.pendingCount(), 0);
      final expired = await q.expiredItems();
      expect(expired.length, 1);
    });

    test('retryItem resets an expired entry to pending', () async {
      final q = OfflinePosQueue(timeThresholdMs: 0);
      await q.queueSale({
        'items': [],
        'total': 200,
        'clientId': null,
        'paymentMethod': 'cash',
      });
      await q.syncPending((_) async {});
      final expired = await q.expiredItems();
      expect(expired.length, 1);

      await q.retryItem(expired.first['id'] as String);
      expect(await q.expiredItems(), isEmpty);
      expect(await q.pendingCount(), 1);
    });

    test('dismissItem permanently removes an expired entry', () async {
      final q = OfflinePosQueue(timeThresholdMs: 0);
      await q.queueSale({
        'items': [],
        'total': 300,
        'clientId': null,
        'paymentMethod': 'cash',
      });
      await q.syncPending((_) async {});
      final expired = await q.expiredItems();
      await q.dismissItem(expired.first['id'] as String);
      expect(await q.expiredItems(), isEmpty);
    });

    group('checkThresholds', () {
      test('not blocked for low amounts', () async {
        await queue.queueSale({
          'items': [],
          'total': 100,
          'clientId': null,
          'paymentMethod': 'cash',
        });
        final result = await queue.checkThresholds();
        expect(result.blocked, isFalse);
        expect(result.pendingCount, 1);
        expect(result.pendingAmount, 100);
      });

      test('blocked when amount exceeds threshold', () async {
        final q = OfflinePosQueue(amountThreshold: 50);
        await q.queueSale({
          'items': [],
          'total': 100,
          'clientId': null,
          'paymentMethod': 'cash',
        });
        final result = await q.checkThresholds();
        expect(result.blocked, isTrue);
        expect(result.message, contains('amount'));
      });

      test('blocked when time exceeds threshold', () async {
        final q = OfflinePosQueue(timeThresholdMs: 0);
        await q.queueSale({
          'items': [],
          'total': 10,
          'clientId': null,
          'paymentMethod': 'cash',
        });
        final result = await q.checkThresholds();
        expect(result.blocked, isTrue);
        expect(result.message, contains('5 hours'));
      });
    });
  });
}
