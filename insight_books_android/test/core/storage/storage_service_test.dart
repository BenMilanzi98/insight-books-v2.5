import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:insightbooks_android/core/storage/storage_service.dart';

/// Minimal fake for FlutterSecureStorage that stores values in-memory.
class FakeSecureStorage extends Fake implements FlutterSecureStorage {
  final _store = <String, String>{};

  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (value != null) {
      _store[key] = value;
    } else {
      _store.remove(key);
    }
  }

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    return _store[key];
  }

  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    _store.remove(key);
  }
}

void main() {
  group('StorageService', () {
    late FakeSecureStorage fakeStorage;
    late StorageService service;

    setUp(() {
      fakeStorage = FakeSecureStorage();
      service = StorageService(fakeStorage);
    });

    test('hasCredentials is false initially', () {
      expect(service.hasCredentials, isFalse);
    });

    test('saveToken and getToken work', () async {
      await service.saveToken('jwt-123');
      expect(await service.getToken(), 'jwt-123');
      expect(service.tokenSync, 'jwt-123');
      expect(service.hasCredentials, isTrue);
    });

    test('saveCookie and getCookie work', () async {
      await service.saveCookie('session=abc');
      expect(await service.getCookie(), 'session=abc');
      expect(service.cookieSync, 'session=abc');
      expect(service.hasCredentials, isTrue);
    });

    test('clearAuth wipes everything', () async {
      await service.saveToken('tok');
      await service.saveCookie('sess');
      service.cacheMeData({'role': 'admin'});
      expect(service.hasCredentials, isTrue);

      await service.clearAuth();
      expect(service.hasCredentials, isFalse);
      expect(service.tokenSync, isNull);
      expect(service.cookieSync, isNull);
      expect(service.cachedMeData, isNull);
    });

    test('hydrate pre-loads from secure storage', () async {
      await fakeStorage.write(key: 'auth_token', value: 'hydrated-tok');
      await fakeStorage.write(key: 'auth_cookie', value: 'hydrated-cookie');

      await service.hydrate();
      expect(service.tokenSync, 'hydrated-tok');
      expect(service.cookieSync, 'hydrated-cookie');
      expect(service.hasCredentials, isTrue);
    });

    test('hydrate is idempotent', () async {
      await fakeStorage.write(key: 'auth_token', value: 'tok1');
      await service.hydrate();
      await fakeStorage.write(key: 'auth_token', value: 'tok2');
      await service.hydrate();
      expect(service.tokenSync, 'tok1');
    });

    test('cacheMeData and clearMeData work', () {
      expect(service.cachedMeData, isNull);
      service.cacheMeData({'role': {'name': 'Admin'}});
      expect(service.cachedMeData, isNotNull);
      expect(service.cachedMeData!['role'], isA<Map>());
      service.clearMeData();
      expect(service.cachedMeData, isNull);
    });
  });
}
