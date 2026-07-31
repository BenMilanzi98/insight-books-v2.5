import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/features/purchases/data/purchases_offline_queue.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('PurchasesOfflineQueue', () {
    late PurchasesOfflineQueue queue;

    setUp(() {
      queue = PurchasesOfflineQueue();
    });

    test('starts with zero pending', () async {
      expect(await queue.pendingCount(), 0);
    });

    test('enqueue adds a pending entry and increases count', () async {
      final result = await queue.enqueue(
        tenantId: 'tenant-1',
        action: PurchasesOfflineAction.createSupplier,
        payload: {'supplierName': 'Acme'},
      );

      expect(result['queued'], isTrue);
      expect(result['id'], isNotEmpty);
      expect(await queue.pendingCount(), 1);
    });

    test('enqueue stores all required fields', () async {
      await queue.enqueue(
        tenantId: 'tenant-1',
        action: PurchasesOfflineAction.createOrder,
        payload: {'supplierId': 's1', 'items': []},
      );

      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('purchases_offline_queue_v1');
      expect(raw, isNotNull);

      final result = await queue.syncPending((entry) async {
        expect(entry['tenantId'], 'tenant-1');
        expect(entry['action'], 'create_order');
        expect(entry['payload'], {'supplierId': 's1', 'items': []});
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
        action: PurchasesOfflineAction.createBill,
        payload: {'supplierId': 's1', 'totalAmount': 500},
      );

      final posted = <Map<String, dynamic>>[];
      final result = await queue.syncPending((entry) async {
        posted.add(Map<String, dynamic>.from(entry));
      });

      expect(result['synced'], 1);
      expect(result['failed'], 0);
      expect(posted.length, 1);
      expect(posted.first['action'], 'create_bill');
      expect(await queue.pendingCount(), 0);
    });

    test('syncPending marks entries failed after maxRetries', () async {
      final q = PurchasesOfflineQueue(maxRetries: 1);
      await q.enqueue(
        tenantId: 'tenant-1',
        action: PurchasesOfflineAction.createReceipt,
        payload: {'supplierId': 's1'},
      );

      final r1 = await q.syncPending((_) async => throw Exception('network'));
      expect(r1['failed'], 1);
      expect(await q.pendingCount(), 0);

      final failed = await q.listFailed();
      expect(failed.length, 1);
      expect(failed.first['action'], 'create_receipt');
    });

    test('retry resets a failed entry to pending', () async {
      final q = PurchasesOfflineQueue(maxRetries: 1);
      await q.enqueue(
        tenantId: 'tenant-1',
        action: PurchasesOfflineAction.createPayment,
        payload: {'supplierId': 's1', 'amount': 100},
      );
      await q.syncPending((_) async => throw Exception('network'));
      final failed = await q.listFailed();
      expect(failed.length, 1);

      await q.retry(failed.first['id'] as String);
      expect(await q.listFailed(), isEmpty);
      expect(await q.pendingCount(), 1);
    });

    test('discard permanently removes a failed entry', () async {
      final q = PurchasesOfflineQueue(maxRetries: 1);
      await q.enqueue(
        tenantId: 'tenant-1',
        action: PurchasesOfflineAction.createSupplier,
        payload: {'supplierName': 'Offline Co'},
      );
      await q.syncPending((_) async => throw Exception('network'));
      final failed = await q.listFailed();
      expect(failed.length, 1);

      await q.discard(failed.first['id'] as String);
      expect(await q.listFailed(), isEmpty);
      expect(await q.pendingCount(), 0);
    });

    test('supports all five action types', () async {
      const actions = PurchasesOfflineAction.values;
      expect(actions.length, 5);

      for (final action in actions) {
        await queue.enqueue(
          tenantId: 'tenant-1',
          action: action,
          payload: {'test': action.name},
        );
      }

      expect(await queue.pendingCount(), 5);
    });
  });
}
