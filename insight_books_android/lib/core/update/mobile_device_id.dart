import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _prefsKey = 'insightbooks_mobile_device_id_v1';

final _uuidRe = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  caseSensitive: false,
);

String _uuidV4() {
  final r = Random.secure();
  final b = List<int>.generate(16, r.nextInt);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = '0123456789abcdef';
  String two(int v) => '${hex[v >> 4]}${hex[v & 15]}';
  return '${two(b[0])}${two(b[1])}${two(b[2])}${two(b[3])}-'
      '${two(b[4])}${two(b[5])}-'
      '${two(b[6])}${two(b[7])}-'
      '${two(b[8])}${two(b[9])}-'
      '${two(b[10])}${two(b[11])}${two(b[12])}${two(b[13])}${two(b[14])}${two(b[15])}';
}

/// Stable random UUID stored in SharedPreferences (anonymous device id for telemetry).
final mobileDeviceIdProvider = FutureProvider<String>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  final existing = prefs.getString(_prefsKey);
  if (existing != null && _uuidRe.hasMatch(existing)) {
    return existing;
  }
  final id = _uuidV4();
  await prefs.setString(_prefsKey, id);
  return id;
});
