/// Branches are server-managed — never show branch pickers in the app.
class BranchVisibility {
  BranchVisibility._();

  static bool showBranchPickerFromMaps(Iterable<Map<String, dynamic>> branches) =>
      false;

  static bool showBranchPickerFromOptions(Iterable<dynamic> branches) => false;
}
