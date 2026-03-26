import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';

class OfflineThresholdResult {
  final bool blocked;
  final String? message;
  final int pendingCount;
  final double pendingAmount;

  const OfflineThresholdResult({
    required this.blocked,
    this.message,
    this.pendingCount = 0,
    this.pendingAmount = 0,
  });
}

class OfflinePosQueue {
  static const _queueKey = 'pos_offline_queue_v1';
  static const int defaultTimeThresholdMs = 48 * 60 * 60 * 1000;
  static const double defaultAmountThreshold = 5000000;

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

  Future<Map<String, dynamic>> queueSale(Map<String, dynamic> saleData) async {
    final queue = await _readQueue();
    final offlineSequence = queue.where((e) => e['status'] == 'pending').length + 1;
    final offlineTimestamp = DateTime.now().toIso8601String();
    final payload = {
      'items': saleData['items'],
      'total': saleData['total'],
      'timestamp': offlineTimestamp,
      'seq': offlineSequence,
    };
    final signature = sha256.convert(utf8.encode(jsonEncode(payload))).toString();

    queue.add({
      'id': DateTime.now().microsecondsSinceEpoch.toString(),
      'saleData': {
        ...saleData,
        'offlineTimestamp': offlineTimestamp,
        'offlineSequence': offlineSequence,
        'offlineSignature': signature,
      },
      'status': 'pending',
      'createdAt': offlineTimestamp,
      'attempts': 0,
    });
    await _writeQueue(queue);
    return {
      'queued': true,
      'offlineSequence': offlineSequence,
      'signature': signature,
    };
  }

  Future<int> pendingCount() async {
    final queue = await _readQueue();
    return queue.where((e) => e['status'] == 'pending').length;
  }

  Future<OfflineThresholdResult> checkThresholds({
    int timeThresholdMs = defaultTimeThresholdMs,
    double amountThreshold = defaultAmountThreshold,
  }) async {
    final queue = await _readQueue();
    final pending = queue.where((e) => e['status'] == 'pending').toList();
    if (pending.isNotEmpty) {
      pending.sort((a, b) => (a['createdAt'] ?? '').toString().compareTo((b['createdAt'] ?? '').toString()));
      final oldest = DateTime.tryParse((pending.first['createdAt'] ?? '').toString());
      if (oldest != null) {
        final offlineMs = DateTime.now().difference(oldest).inMilliseconds;
        if (offlineMs > timeThresholdMs) {
          return OfflineThresholdResult(
            blocked: true,
            message:
                'Offline time threshold exceeded. Reconnect to continue selling.',
            pendingCount: pending.length,
          );
        }
      }
    }
    final amount = pending.fold<double>(
      0,
      (sum, e) => sum + (double.tryParse('${(e['saleData'] as Map?)?['total'] ?? 0}') ?? 0),
    );
    if (amount > amountThreshold) {
      return OfflineThresholdResult(
        blocked: true,
        message:
            'Offline amount threshold exceeded. Reconnect to sync transactions.',
        pendingCount: pending.length,
        pendingAmount: amount,
      );
    }
    return OfflineThresholdResult(
      blocked: false,
      pendingCount: pending.length,
      pendingAmount: amount,
    );
  }

  Future<Map<String, int>> syncPending(
    Future<void> Function(Map<String, dynamic> saleData) send,
  ) async {
    final queue = await _readQueue();
    int synced = 0;
    int failed = 0;
    for (final item in queue.where((e) => e['status'] == 'pending')) {
      try {
        await send(Map<String, dynamic>.from(item['saleData'] as Map));
        item['status'] = 'synced';
        item['syncedAt'] = DateTime.now().toIso8601String();
        synced++;
      } catch (_) {
        item['attempts'] = ((item['attempts'] as int?) ?? 0) + 1;
        if ((item['attempts'] as int) >= 3) {
          item['status'] = 'failed';
        }
        failed++;
      }
    }
    await _writeQueue(queue);
    return {'synced': synced, 'failed': failed};
  }
}

