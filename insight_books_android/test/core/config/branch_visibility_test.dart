import 'package:flutter_test/flutter_test.dart';
import 'package:insightbooks_android/core/config/branch_visibility.dart';

void main() {
  group('BranchVisibility', () {
    test('never shows branch pickers', () {
      expect(BranchVisibility.showBranchPickerFromMaps([]), isFalse);
      expect(
        BranchVisibility.showBranchPickerFromMaps([
          {'id': 'b1', 'name': 'North', 'isActive': true},
          {'id': 'b2', 'name': 'South', 'isActive': true},
        ]),
        isFalse,
      );
      expect(BranchVisibility.showBranchPickerFromOptions([]), isFalse);
    });
  });
}
