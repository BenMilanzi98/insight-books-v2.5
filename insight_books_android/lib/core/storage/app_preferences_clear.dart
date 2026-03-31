import 'package:shared_preferences/shared_preferences.dart';

/// Persists across logout; all other SharedPreferences keys are treated as cache.
const String kAppThemeModeKey = 'app_theme_mode';

/// Clears POS caches, offline queue, and any other prefs except theme mode.
Future<void> clearSharedPreferencesExceptTheme() async {
  final prefs = await SharedPreferences.getInstance();
  final keys = prefs.getKeys().toList();
  for (final k in keys) {
    if (k == kAppThemeModeKey) continue;
    await prefs.remove(k);
  }
}
