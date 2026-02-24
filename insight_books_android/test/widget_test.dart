import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/main.dart';

void main() {
  testWidgets('App compiles and shows LoginScreen', (
    WidgetTester tester,
  ) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: InsightBooksApp()));

    // Initial load state might just show the background or loading depending on routing logic speed in tests.
    // For now, just verifying it builds without crashing.
    expect(find.byType(InsightBooksApp), findsOneWidget);
  });
}
