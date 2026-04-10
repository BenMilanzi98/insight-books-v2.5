import 'package:flutter/material.dart';

class AppTheme {
  // ─── Brand palette ──────────────────────────────────────────
  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryDark = Color(0xFF2563EB);
  static const Color secondary = Color(0xFF6366F1);
  static const Color accent = Color(0xFF60A5FA);

  // ─── Semantic colors (used via helpers below, not raw) ──────
  static const Color success = Color(0xFF22C55E);
  static const Color successDark = Color(0xFF4ADE80);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningDark = Color(0xFFFBBF24);
  static const Color error = Color(0xFFEF4444);
  static const Color errorDark = Color(0xFFF87171);
  static const Color info = Color(0xFF3B82F6);
  static const Color infoDark = Color(0xFF60A5FA);

  // ─── Light surfaces ─────────────────────────────────────────
  static const Color backgroundLight = Color(0xFFF9FAFB);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color borderLight = Color(0xFFE5E7EB);
  static const Color textPrimaryLight = Color(0xFF111827);
  static const Color textSecondaryLight = Color(0xFF6B7280);

  // ─── Dark surfaces ──────────────────────────────────────────
  static const Color backgroundDark = Color(0xFF111827);
  static const Color surfaceDark = Color(0xFF1F2937);
  static const Color surfaceElevatedDark = Color(0xFF283548);
  static const Color borderDark = Color(0xFF374151);
  static const Color textPrimaryDark = Color(0xFFF9FAFB);
  static const Color textSecondaryDark = Color(0xFF9CA3AF);

  // ─── Nav chrome ─────────────────────────────────────────────
  static const Color navBackground = Color(0xFF0F172A);
  static const Color navActiveText = Color(0xFF60A5FA);
  static const Color navItemText = Color(0xFFD1D5DB);

  // ─── Semantic‑color helpers (use in widgets instead of raw Colors.*) ──
  static Color successColor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? successDark : success;
  static Color warningColor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? warningDark : warning;
  static Color errorColor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? errorDark : error;
  static Color infoColor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? infoDark : info;

  static Color successBg(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? successDark.withValues(alpha: 0.15)
          : const Color(0xFFDCFCE7);
  static Color warningBg(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? warningDark.withValues(alpha: 0.15)
          : const Color(0xFFFEF3C7);
  static Color errorBg(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? errorDark.withValues(alpha: 0.15)
          : const Color(0xFFFEE2E2);
  static Color infoBg(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? infoDark.withValues(alpha: 0.15)
          : const Color(0xFFDBEAFE);

  static Color cardColor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? surfaceDark
          : surfaceLight;
  static Color borderColor(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? borderDark
          : borderLight;
  static Color textPrimary(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? textPrimaryDark
          : textPrimaryLight;
  static Color textSecondary(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? textSecondaryDark
          : textSecondaryLight;

  // ═══════════════════════════════════════════════════════════
  //  L I G H T   T H E M E
  // ═══════════════════════════════════════════════════════════
  static final ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    visualDensity: VisualDensity.adaptivePlatformDensity,
    splashFactory: InkSparkle.splashFactory,
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
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
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surfaceLight,
      indicatorColor: primary.withValues(alpha: 0.12),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: primary);
        }
        return const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: textSecondaryLight);
      }),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: primary,
      foregroundColor: Colors.white,
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: primary,
      linearTrackColor: Color(0xFFE5E7EB),
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

  // ═══════════════════════════════════════════════════════════
  //  D A R K   T H E M E   (fully specified — no fallback gaps)
  // ═══════════════════════════════════════════════════════════
  static final ThemeData darkTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    visualDensity: VisualDensity.adaptivePlatformDensity,
    splashFactory: InkSparkle.splashFactory,
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
    colorScheme: ColorScheme.dark(
      primary: accent,
      secondary: secondary,
      surface: surfaceDark,
      error: errorDark,
      onPrimary: const Color(0xFF0F172A),
      onSecondary: Colors.white,
      onSurface: textPrimaryDark,
      onError: Colors.white,
      outline: borderDark,
      surfaceContainerHighest: const Color(0xFF374151),
      surfaceContainerHigh: const Color(0xFF283548),
      surfaceContainer: surfaceDark,
    ),
    scaffoldBackgroundColor: backgroundDark,
    appBarTheme: const AppBarTheme(
      backgroundColor: surfaceDark,
      foregroundColor: textPrimaryDark,
      elevation: 0,
      centerTitle: true,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0.5,
    ),
    cardTheme: CardThemeData(
      color: surfaceDark,
      elevation: 2,
      margin: EdgeInsets.zero,
      shadowColor: Colors.black.withValues(alpha: 0.3),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: borderDark, width: 1),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: borderDark,
      thickness: 1,
      space: 1,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: primary.withValues(alpha: 0.3),
        disabledForegroundColor: Colors.white54,
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
        disabledBackgroundColor: primary.withValues(alpha: 0.3),
        disabledForegroundColor: Colors.white54,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        minimumSize: const Size(0, 46),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: textPrimaryDark,
        side: const BorderSide(color: borderDark),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        minimumSize: const Size(0, 44),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: accent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceElevatedDark,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: borderDark),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: borderDark),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: accent, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: errorDark),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: errorDark, width: 1.6),
      ),
      labelStyle: const TextStyle(color: textSecondaryDark, fontWeight: FontWeight.w500),
      hintStyle: const TextStyle(color: textSecondaryDark),
      helperStyle: const TextStyle(color: textSecondaryDark),
      errorStyle: TextStyle(color: errorDark),
      prefixIconColor: textSecondaryDark,
      suffixIconColor: textSecondaryDark,
    ),
    listTileTheme: const ListTileThemeData(
      textColor: textPrimaryDark,
      iconColor: textSecondaryDark,
      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 2),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: surfaceElevatedDark,
      selectedColor: primary.withValues(alpha: 0.3),
      checkmarkColor: accent,
      labelStyle: const TextStyle(color: textPrimaryDark),
      secondaryLabelStyle: const TextStyle(color: textPrimaryDark),
      side: const BorderSide(color: borderDark),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: surfaceElevatedDark,
      contentTextStyle: const TextStyle(color: textPrimaryDark),
      behavior: SnackBarBehavior.floating,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: surfaceDark,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      titleTextStyle: const TextStyle(
        color: textPrimaryDark,
        fontSize: 20,
        fontWeight: FontWeight.w700,
      ),
      contentTextStyle: const TextStyle(color: textPrimaryDark),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: surfaceDark,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surfaceDark,
      indicatorColor: accent.withValues(alpha: 0.12),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: accent);
        }
        return const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: textSecondaryDark);
      }),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: accent,
      foregroundColor: const Color(0xFF0F172A),
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: accent,
      linearTrackColor: borderDark,
    ),
    textSelectionTheme: const TextSelectionThemeData(
      cursorColor: accent,
      selectionColor: Color(0x6660A5FA),
      selectionHandleColor: accent,
    ),
    textTheme: const TextTheme(
      displaySmall: TextStyle(color: textPrimaryDark, fontWeight: FontWeight.w700),
      headlineSmall: TextStyle(color: textPrimaryDark, fontWeight: FontWeight.w700),
      titleLarge: TextStyle(color: textPrimaryDark, fontWeight: FontWeight.w700),
      titleMedium: TextStyle(color: textPrimaryDark, fontWeight: FontWeight.w600),
      titleSmall: TextStyle(color: textPrimaryDark, fontWeight: FontWeight.w600),
      bodyLarge: TextStyle(color: textPrimaryDark),
      bodyMedium: TextStyle(color: textPrimaryDark),
      bodySmall: TextStyle(color: textSecondaryDark),
      labelLarge: TextStyle(color: textPrimaryDark, fontWeight: FontWeight.w600),
      labelMedium: TextStyle(color: textSecondaryDark),
      labelSmall: TextStyle(color: textSecondaryDark),
    ),
  );
}
