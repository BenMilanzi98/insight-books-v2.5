import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Offline create actions for purchases module.
enum PurchasesOfflineAction {
  createSupplier('create_supplier'),
  createOrder('create_order'),
  createBill('create_bill'),
  createReceipt('create_receipt'),
  createPayment('create_payment');

  const PurchasesOfflineAction(this.value);

  final String value;
}

class PurchasesOfflineQueue {
  static const _queueKey = 'purchases_offline_queue_v1';
  static const int defaultMaxRetries = 3;

  final int maxRetries;

  PurchasesOfflineQueue({this.maxRetries = defaultMaxRetries});

  Future<List<Map<String, dynamic>>> _readQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_queueKey);
    if (raw == null || raw.isEmpty) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> _writeQueue(List<Map<String, dynamic>> queue) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_queueKey, jsonEncode(queue));
  }

  Future<Map<String, dynamic>> enqueue({
    required String tenantId,
    required PurchasesOfflineAction action,
    required Map<String, dynamic> payload,
  }) async {
    final queue = await _readQueue();
    final id = DateTime.now().microsecondsSinceEpoch.toString();
    final createdAt = DateTime.now().toIso8601String();

    queue.add({
      'id': id,
      'tenantId': tenantId,
      'action': action.value,
      'payload': payload,
      'status': 'pending',
      'createdAt': createdAt,
      'attempts': 0,
    });
    await _writeQueue(queue);
    return {'queued': true, 'id': id};
  }

  Future<int> pendingCount() async {
    final queue = await _readQueue();
    return queue.where((e) => e['status'] == 'pending').length;
  }

  Future<List<Map<String, dynamic>>> listFailed() async {
    final queue = await _readQueue();
    return queue.where((e) => e['status'] == 'failed').toList();
  }

  Future<void> retry(String id) async {
    final queue = await _readQueue();
    for (final item in queue) {
      if (item['id'] == id && item['status'] == 'failed') {
        item['status'] = 'pending';
        item['attempts'] = 0;
        item['createdAt'] = DateTime.now().toIso8601String();
      }
    }
    await _writeQueue(queue);
  }

  Future<void> discard(String id) async {
    final queue = await _readQueue();
    queue.removeWhere((e) => e['id'] == id && e['status'] == 'failed');
    await _writeQueue(queue);
  }

  Future<void> _pruneOldSynced() async {
    final queue = await _readQueue();
    final cutoff = DateTime.now().subtract(const Duration(hours: 24));
    queue.removeWhere((e) {
      if (e['status'] != 'synced') return false;
      final syncedAt = DateTime.tryParse((e['syncedAt'] ?? '').toString());
      return syncedAt != null && syncedAt.isBefore(cutoff);
    });
    await _writeQueue(queue);
  }

  Map<String, dynamic> _entryPayload(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'tenantId': item['tenantId'],
      'action': item['action'],
      'payload': item['payload'],
      'status': item['status'],
      'createdAt': item['createdAt'],
      'attempts': item['attempts'],
    };
  }

  Future<Map<String, int>> syncPending(
    Future<void> Function(Map<String, dynamic> entry) poster,
  ) async {
    final queue = await _readQueue();
    int synced = 0;
    int failed = 0;

    for (final item in queue.where((e) => e['status'] == 'pending')) {
      try {
        await poster(_entryPayload(item));
        item['status'] = 'synced';
        item['syncedAt'] = DateTime.now().toIso8601String();
        synced++;
      } catch (_) {
        item['attempts'] = ((item['attempts'] as int?) ?? 0) + 1;
        if ((item['attempts'] as int) >= maxRetries) {
          item['status'] = 'failed';
        }
        failed++;
      }
    }

    await _writeQueue(queue);
    await _pruneOldSynced();
    return {'synced': synced, 'failed': failed};
  }
}
