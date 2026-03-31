import 'package:insightbooks_android/core/network/api_client.dart';

/// Same host as the API — matches web routes `/terms` and `/privacy`.
Uri uriTermsOfService() {
  return Uri.parse(apiBaseUrl).resolve('/terms');
}

Uri uriPrivacyPolicy() {
  return Uri.parse(apiBaseUrl).resolve('/privacy');
}

/// Resolves logo or asset URLs that may be relative (e.g. `uploads/...`), mirroring web account page.
String? resolveAppAssetUrl(String? url) {
  if (url == null || url.trim().isEmpty) return null;
  final t = url.trim();
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('blob:')) return null;
  final base = apiBaseUrl.replaceAll(RegExp(r'/$'), '');
  var path = t.replaceFirst(RegExp(r'^/+'), '');
  if (path.startsWith('uploads/')) {
    path = path.substring('uploads/'.length);
  }
  return '$base/api/uploads/$path';
}
