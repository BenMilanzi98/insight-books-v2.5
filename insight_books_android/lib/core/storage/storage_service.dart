import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

class StorageService {
  final FlutterSecureStorage _storage;

  StorageService(this._storage);

  static const _tokenKey = 'auth_token';
  static const _cookieKey = 'auth_cookie';

  String? _cachedToken;
  String? _cachedCookie;
  bool _hydrated = false;

  /// Pre-load credentials from secure storage into memory.
  /// Call once at startup so subsequent reads are instant.
  Future<void> hydrate() async {
    if (_hydrated) return;
    _cachedToken = await _storage.read(key: _tokenKey);
    _cachedCookie = await _storage.read(key: _cookieKey);
    _hydrated = true;
  }

  Future<void> saveToken(String token) async {
    _cachedToken = token;
    await _storage.write(key: _tokenKey, value: token);
  }

  Future<String?> getToken() async {
    if (_hydrated) return _cachedToken;
    _cachedToken ??= await _storage.read(key: _tokenKey);
    return _cachedToken;
  }

  String? get tokenSync => _cachedToken;

  Future<void> saveCookie(String cookie) async {
    _cachedCookie = cookie;
    await _storage.write(key: _cookieKey, value: cookie);
  }

  Future<String?> getCookie() async {
    if (_hydrated) return _cachedCookie;
    _cachedCookie ??= await _storage.read(key: _cookieKey);
    return _cachedCookie;
  }

  String? get cookieSync => _cachedCookie;

  bool get hasCredentials => _cachedToken != null || _cachedCookie != null;

  /// Cached /api/auth/me response to avoid duplicate network calls during startup.
  Map<String, dynamic>? _meData;
  Map<String, dynamic>? get cachedMeData => _meData;
  void cacheMeData(Map<String, dynamic> data) => _meData = data;
  void clearMeData() => _meData = null;

  Future<void> clearAuth() async {
    _meData = null;
    _cachedToken = null;
    _cachedCookie = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _cookieKey);
  }
}

final storageServiceProvider = Provider<StorageService>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return StorageService(storage);
});
