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
  static const int defaultTimeThresholdMs = 5 * 60 * 60 * 1000;
  static const double defaultAmountThreshold = 5000000;
  static const int defaultMaxRetries = 3;

  /// Configurable thresholds — can be set from tenant/server settings.
  final int timeThresholdMs;
  final double amountThreshold;
  final int maxRetries;

  OfflinePosQueue({
    this.timeThresholdMs = defaultTimeThresholdMs,
    this.amountThreshold = defaultAmountThreshold,
    this.maxRetries = defaultMaxRetries,
  });

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
      'clientId': saleData['clientId'],
      'paymentMethod': saleData['paymentMethod'],
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

  /// Returns items that are expired but not yet synced — for user review.
  Future<List<Map<String, dynamic>>> expiredItems() async {
    final queue = await _readQueue();
    return queue.where((e) => e['status'] == 'expired').toList();
  }

  /// Returns items that permanently failed (3+ attempts).
  Future<List<Map<String, dynamic>>> failedItems() async {
    final queue = await _readQueue();
    return queue.where((e) => e['status'] == 'failed').toList();
  }

  /// Reset an expired or failed item back to pending so it can be retried.
  Future<void> retryItem(String id) async {
    final queue = await _readQueue();
    for (final item in queue) {
      if (item['id'] == id &&
          (item['status'] == 'expired' || item['status'] == 'failed')) {
        item['status'] = 'pending';
        item['attempts'] = 0;
        item['createdAt'] = DateTime.now().toIso8601String();
      }
    }
    await _writeQueue(queue);
  }

  /// Permanently dismiss an expired/failed item after user acknowledgment.
  Future<void> dismissItem(String id) async {
    final queue = await _readQueue();
    queue.removeWhere(
        (e) => e['id'] == id && (e['status'] == 'expired' || e['status'] == 'failed'));
    await _writeQueue(queue);
  }

  /// Remove all synced items older than 24 hours to keep storage lean.
  Future<void> pruneOldSynced() async {
    final queue = await _readQueue();
    final cutoff = DateTime.now().subtract(const Duration(hours: 24));
    queue.removeWhere((e) {
      if (e['status'] != 'synced') return false;
      final syncedAt = DateTime.tryParse((e['syncedAt'] ?? '').toString());
      return syncedAt != null && syncedAt.isBefore(cutoff);
    });
    await _writeQueue(queue);
  }

  Future<OfflineThresholdResult> checkThresholds() async {
    final queue = await _readQueue();
    final pending = queue.where((e) => e['status'] == 'pending').toList();
    if (pending.isNotEmpty) {
      pending.sort((a, b) => (a['createdAt'] ?? '').toString().compareTo((b['createdAt'] ?? '').toString()));
      final oldest = DateTime.tryParse((pending.first['createdAt'] ?? '').toString());
      if (oldest != null) {
        final offlineMs = DateTime.now().difference(oldest).inMilliseconds;
        if (offlineMs >= timeThresholdMs) {
          return OfflineThresholdResult(
            blocked: true,
            message:
                'Offline queue limit reached (5 hours). Please reconnect to sync pending sales.',
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
    final now = DateTime.now();
    int expired = 0;

    // Mark (not delete) entries older than the offline storage policy as expired.
    for (final e in queue) {
      if (e['status'] != 'pending') continue;
      final createdAtStr = (e['createdAt'] ?? '').toString();
      final createdAt = DateTime.tryParse(createdAtStr);
      if (createdAt == null) continue;
      final ageMs = now.difference(createdAt).inMilliseconds;
      if (ageMs >= timeThresholdMs) {
        e['status'] = 'expired';
        e['expiredAt'] = now.toIso8601String();
        expired++;
      }
    }

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
        if ((item['attempts'] as int) >= maxRetries) {
          item['status'] = 'failed';
        }
        failed++;
      }
    }

    await pruneOldSynced();
    await _writeQueue(queue);
    return {'synced': synced, 'failed': failed, 'expired': expired};
  }
}
