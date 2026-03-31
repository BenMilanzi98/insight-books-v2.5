import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:insightbooks_android/core/storage/app_preferences_clear.dart';

/// Provides the current ThemeMode (light, dark, or system) with persistence.
final themeModeProvider =
    NotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);

class ThemeModeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    Future.microtask(() => _loadFromPrefs());
    return ThemeMode.system;
  }

  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final index = prefs.getInt(kAppThemeModeKey);
    if (index != null && index >= 0 && index <= 2) {
      state = ThemeMode.values[index];
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    if (state == mode) return;
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(kAppThemeModeKey, mode.index);
  }

  /// Toggle between light and dark (skips system for a clear on/off).
  void toggleDark() {
    final next = state == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    setThemeMode(next);
  }

  bool get isDark => state == ThemeMode.dark;
  bool get isLight => state == ThemeMode.light;
  bool get isSystem => state == ThemeMode.system;
}
