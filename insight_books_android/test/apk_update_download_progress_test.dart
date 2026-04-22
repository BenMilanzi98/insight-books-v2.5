import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/core/update/apk_update_installer.dart';

void main() {
  test('downloadProgressRatio clamps and handles edge cases', () {
    expect(downloadProgressRatio(0, 100), 0);
    expect(downloadProgressRatio(50, 100), 0.5);
    expect(downloadProgressRatio(100, 100), 1);
    expect(downloadProgressRatio(200, 100), 1);
    expect(downloadProgressRatio(10, 0), 0);
    expect(downloadProgressRatio(-1, 100), 0);
  });
}
