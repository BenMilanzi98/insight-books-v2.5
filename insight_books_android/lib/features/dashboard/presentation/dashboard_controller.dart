import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/network_error_mapper.dart';
import 'package:insightbooks_android/features/dashboard/data/dashboard_repository.dart';
import 'package:insightbooks_android/features/dashboard/domain/dashboard_data.dart';

final dashboardControllerProvider =
    AsyncNotifierProvider<DashboardController, DashboardData>(() {
      return DashboardController();
    });

class DashboardController extends AsyncNotifier<DashboardData> {
  late final DashboardRepository _repository;
  String _dateRange = 'today';
  DashboardData? _lastGoodData;

  @override
  Future<DashboardData> build() async {
    _repository = ref.watch(dashboardRepositoryProvider);
    return _fetchData();
  }

  Future<DashboardData> _fetchData() async {
    try {
      final data = await _repository.fetchDashboardData(dateRange: _dateRange);
      _lastGoodData = data;
      return data;
    } catch (e) {
      if (_lastGoodData != null) rethrow;
      throw Exception(NetworkErrorMapper.toUserMessage(e));
    }
  }

  String get dateRange => _dateRange;

  Future<void> setDateRange(String range) async {
    _dateRange = range;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }

  /// Refresh data; if network fails, keep showing stale data with a warning.
  Future<void> refresh() async {
    final previous = _lastGoodData;
    state = const AsyncLoading();
    try {
      final data = await _fetchData();
      state = AsyncValue.data(data);
    } catch (e) {
      if (previous != null) {
        state = AsyncValue.data(previous);
      } else {
        state = AsyncValue.error(
          Exception(NetworkErrorMapper.toUserMessage(e)),
          StackTrace.current,
        );
      }
    }
  }
}
