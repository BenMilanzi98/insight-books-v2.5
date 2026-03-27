import 'package:flutter/material.dart';

class AppTheme {
  // Main Colors
  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryDark = Color(0xFF2563EB);
  static const Color secondary = Color(0xFF6366F1);
  static const Color accent = Color(0xFF60A5FA);

  // Semantic Colors
  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error = Color(0xFFEF4444);
  static const Color info = Color(0xFF3B82F6);

  // Backgrounds & Surfaces (Light)
  static const Color backgroundLight = Color(0xFFF9FAFB);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color borderLight = Color(0xFFE5E7EB);
  static const Color textPrimaryLight = Color(0xFF111827);
  static const Color textSecondaryLight = Color(0xFF6B7280);

  // Backgrounds & Surfaces (Dark)
  static const Color backgroundDark = Color(0xFF111827);
  static const Color surfaceDark = Color(0xFF1F2937);
  static const Color borderDark = Color(0xFF374151);
  static const Color textPrimaryDark = Color(0xFFF9FAFB);
  static const Color textSecondaryDark = Color(0xFF9CA3AF);

  // Nav
  static const Color navBackground = Color(0xFF0F172A);
  static const Color navActiveText = Color(0xFF60A5FA);
  static const Color navItemText = Color(0xFFD1D5DB);

  static final ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    visualDensity: VisualDensity.adaptivePlatformDensity,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
      primary: primary,
      secondary: secondary,
      surface: surfaceLight,
      error: error,
      onPrimary: Colors.white,
      onSecondary: Colors.white,
      onSurface: textPrimaryLight,
      onError: Colors.white,
      outline: borderLight,
      surfaceContainerHighest: const Color(0xFFE5E7EB),
      surfaceContainerHigh: const Color(0xFFF1F5F9),
      surfaceContainer: const Color(0xFFF8FAFC),
    ),
    scaffoldBackgroundColor: backgroundLight,
    canvasColor: backgroundLight,
    appBarTheme: const AppBarTheme(
      backgroundColor: surfaceLight,
      foregroundColor: textPrimaryLight,
      elevation: 0,
      centerTitle: true,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0.5,
    ),
    cardTheme: CardThemeData(
      color: surfaceLight,
      elevation: 0.5,
      margin: EdgeInsets.zero,
      shadowColor: Colors.black.withValues(alpha: 0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: borderLight, width: 1),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: borderLight,
      thickness: 1,
      space: 1,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: const Color(0xFFBFDBFE),
        disabledForegroundColor: const Color(0xFF1E3A8A),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        minimumSize: const Size(0, 46),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: const Color(0xFFBFDBFE),
        disabledForegroundColor: const Color(0xFF1E3A8A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        minimumSize: const Size(0, 46),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: textPrimaryLight,
        side: const BorderSide(color: borderLight),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        minimumSize: const Size(0, 44),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: primaryDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: borderLight),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: borderLight),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: primary, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: error, width: 1.6),
      ),
      labelStyle: const TextStyle(color: textSecondaryLight, fontWeight: FontWeight.w500),
      hintStyle: const TextStyle(color: textSecondaryLight),
      helperStyle: const TextStyle(color: textSecondaryLight),
      errorStyle: const TextStyle(color: error),
      prefixIconColor: textSecondaryLight,
      suffixIconColor: textSecondaryLight,
    ),
    listTileTheme: const ListTileThemeData(
      textColor: textPrimaryLight,
      iconColor: textSecondaryLight,
      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 2),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: const Color(0xFFF1F5F9),
      selectedColor: primary.withValues(alpha: 0.14),
      checkmarkColor: primaryDark,
      labelStyle: const TextStyle(color: textPrimaryLight),
      secondaryLabelStyle: const TextStyle(color: textPrimaryLight),
      side: const BorderSide(color: borderLight),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Color(0xFF111827),
      contentTextStyle: TextStyle(color: Colors.white),
      behavior: SnackBarBehavior.floating,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: surfaceLight,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      titleTextStyle: const TextStyle(
        color: textPrimaryLight,
        fontSize: 20,
        fontWeight: FontWeight.w700,
      ),
      contentTextStyle: const TextStyle(color: textPrimaryLight),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: surfaceLight,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
    ),
    textSelectionTheme: const TextSelectionThemeData(
      cursorColor: primaryDark,
      selectionColor: Color(0x663B82F6),
      selectionHandleColor: primaryDark,
    ),
    textTheme: const TextTheme(
      displaySmall: TextStyle(color: textPrimaryLight, fontWeight: FontWeight.w700),
      headlineSmall: TextStyle(color: textPrimaryLight, fontWeight: FontWeight.w700),
      titleLarge: TextStyle(color: textPrimaryLight, fontWeight: FontWeight.w700),
      titleMedium: TextStyle(color: textPrimaryLight, fontWeight: FontWeight.w600),
      titleSmall: TextStyle(color: textPrimaryLight, fontWeight: FontWeight.w600),
      bodyLarge: TextStyle(color: textPrimaryLight),
      bodyMedium: TextStyle(color: textPrimaryLight),
      bodySmall: TextStyle(color: textSecondaryLight),
      labelLarge: TextStyle(color: textPrimaryLight, fontWeight: FontWeight.w600),
      labelMedium: TextStyle(color: textSecondaryLight),
      labelSmall: TextStyle(color: textSecondaryLight),
    ),
  );

  static final ThemeData darkTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    visualDensity: VisualDensity.adaptivePlatformDensity,
    colorScheme: ColorScheme.dark(
      primary: accent,
      secondary: secondary,
      surface: surfaceDark,
      error: error,
      onPrimary: Colors.white,
      onSecondary: Colors.white,
      onSurface: textPrimaryDark,
      onError: Colors.white,
      outline: borderDark,
      surfaceContainerHighest: const Color(0xFF374151),
    ),
    scaffoldBackgroundColor: backgroundDark,
    appBarTheme: const AppBarTheme(
      backgroundColor: surfaceDark,
      foregroundColor: textPrimaryDark,
      elevation: 0,
      centerTitle: true,
    ),
    cardTheme: CardThemeData(
      color: surfaceDark,
      elevation: 2,
      shadowColor: Colors.black.withValues(alpha: 0.3),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: borderDark, width: 1),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceDark,
      border: const OutlineInputBorder(),
      enabledBorder: const OutlineInputBorder(borderSide: BorderSide(color: borderDark)),
      focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: accent, width: 2)),
      labelStyle: const TextStyle(color: textSecondaryDark),
      hintStyle: const TextStyle(color: textSecondaryDark),
    ),
    dividerColor: borderDark,
    listTileTheme: const ListTileThemeData(
      textColor: textPrimaryDark,
      iconColor: textSecondaryDark,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: surfaceDark,
      selectedColor: primary.withValues(alpha: 0.3),
      labelStyle: const TextStyle(color: textPrimaryDark),
      secondaryLabelStyle: const TextStyle(color: textPrimaryDark),
      side: const BorderSide(color: borderDark),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: surfaceDark,
      contentTextStyle: const TextStyle(color: textPrimaryDark),
      behavior: SnackBarBehavior.floating,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: surfaceDark,
      titleTextStyle: const TextStyle(color: textPrimaryDark, fontSize: 20, fontWeight: FontWeight.w600),
      contentTextStyle: const TextStyle(color: textPrimaryDark),
    ),
    textTheme: const TextTheme(
      bodyLarge: TextStyle(color: textPrimaryDark),
      bodyMedium: TextStyle(color: textPrimaryDark),
    ),
  );
}
