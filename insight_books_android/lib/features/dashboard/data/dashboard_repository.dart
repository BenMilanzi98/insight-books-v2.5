import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:insightbooks_android/core/network/api_client.dart';
import 'package:insightbooks_android/features/dashboard/domain/dashboard_data.dart';

import 'package:dio/dio.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return DashboardRepository(dio);
});

class DashboardRepository {
  final Dio _dio;

  DashboardRepository(this._dio);

  Future<DashboardData> fetchDashboardData({
    String dateRange = 'thisMonth',
  }) async {
    try {
      final results = await Future.wait([
        _dio.get('/api/dashboard/metrics?dateRange=$dateRange'),
        _dio.get('/api/dashboard/daily-performance?dateRange=today'),
        _dio.get('/api/dashboard/receivables?dateRange=$dateRange'),
        _dio.get('/api/dashboard/payables?dateRange=$dateRange'),
        _dio.get('/api/dashboard/income-expenses?dateRange=$dateRange'),
        _dio.get('/api/dashboard/expenses-breakdown?dateRange=$dateRange'),
        _dio.get('/api/dashboard/stock-alerts?dateRange=$dateRange'),
        _dio.get('/api/dashboard/transactions?dateRange=$dateRange'),
      ]);

      return DashboardData.fromApi(
        metrics: results[0].data,
        dailyPerformance: results[1].data,
        receivablesData: results[2].data,
        payablesData: results[3].data,
        incomeExpenses: results[4].data,
        expensesBreakdownData: results[5].data,
        stockAlertsData: results[6].data,
        transactionsData: results[7].data,
      );
    } catch (e) {
      rethrow;
    }
  }
}
