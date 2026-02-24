import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/features/dashboard/data/dashboard_repository.dart';
import 'package:insightbooks_android/features/dashboard/domain/dashboard_data.dart';

final dashboardControllerProvider =
    AsyncNotifierProvider<DashboardController, DashboardData>(() {
      return DashboardController();
    });

class DashboardController extends AsyncNotifier<DashboardData> {
  late final DashboardRepository _repository;
  String _dateRange = 'thisMonth';

  @override
  Future<DashboardData> build() async {
    _repository = ref.watch(dashboardRepositoryProvider);
    return _fetchData();
  }

  Future<DashboardData> _fetchData() async {
    return _repository.fetchDashboardData(dateRange: _dateRange);
  }

  String get dateRange => _dateRange;

  Future<void> setDateRange(String range) async {
    _dateRange = range;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}
