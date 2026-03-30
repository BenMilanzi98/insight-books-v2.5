import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/features/auth/presentation/login_screen.dart';

void main() {
  testWidgets('LoginScreen builds under ProviderScope', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: LoginScreen(),
        ),
      ),
    );
    await tester.pump();
    expect(find.byType(LoginScreen), findsOneWidget);
  });
}
