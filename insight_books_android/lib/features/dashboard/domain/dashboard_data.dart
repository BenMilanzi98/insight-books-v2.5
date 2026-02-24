class DashboardData {
  final FinancialSummary summary;
  final TodayPerformance today;
  final AgingReport receivables;
  final AgingReport payables;
  final List<ExpenseCategory> expensesBreakdown;
  final List<StockAlert> stockAlerts;
  final List<Transaction> recentTransactions;
  final List<ChartPoint> incomeData;
  final List<ChartPoint> expenseData;
  final List<String> months;

  DashboardData({
    required this.summary,
    required this.today,
    required this.receivables,
    required this.payables,
    required this.expensesBreakdown,
    required this.stockAlerts,
    required this.recentTransactions,
    required this.incomeData,
    required this.expenseData,
    required this.months,
  });

  factory DashboardData.fromApi({
    required Map<String, dynamic> metrics,
    required Map<String, dynamic> dailyPerformance,
    required Map<String, dynamic> receivablesData,
    required Map<String, dynamic> payablesData,
    required Map<String, dynamic> incomeExpenses,
    required Map<String, dynamic> expensesBreakdownData,
    required Map<String, dynamic> stockAlertsData,
    required Map<String, dynamic> transactionsData,
  }) {
    final financialSummary = metrics['financialSummary'] ?? {};

    // Performance
    final performance = dailyPerformance['dailyMetrics'] ?? {};
    final todayRev = _toDouble(performance['today']?['revenue']);
    final todayExp = _toDouble(performance['today']?['expenses']);
    final yesterdayRev = _toDouble(performance['yesterday']?['revenue']);
    final yesterdayExp = _toDouble(performance['yesterday']?['expenses']);

    final revChange = yesterdayRev > 0
        ? ((todayRev - yesterdayRev) / yesterdayRev * 100)
        : 0.0;
    final expChange = yesterdayExp > 0
        ? ((todayExp - yesterdayExp) / yesterdayExp * 100)
        : 0.0;

    // Income & Expenses for Chart
    final chartData = incomeExpenses['incomeExpenses'] ?? {};
    final monthLabels = List<String>.from(chartData['months'] ?? []);
    final incomeList = (chartData['income'] as List? ?? [])
        .map((e) => _toDouble(e))
        .toList();
    final expenseList = (chartData['expenses'] as List? ?? [])
        .map((e) => _toDouble(e))
        .toList();

    return DashboardData(
      summary: FinancialSummary.fromJson(financialSummary),
      today: TodayPerformance(
        revenue: todayRev,
        expenses: todayExp,
        transactions: _toInt(performance['today']?['transactions']),
        revenueChange: revChange,
        expensesChange: expChange,
        revenueTrend: (performance['weeklyTrend']?['revenue'] as List? ?? [])
            .map((e) => _toDouble(e))
            .toList(),
        expensesTrend: (performance['weeklyTrend']?['expenses'] as List? ?? [])
            .map((e) => _toDouble(e))
            .toList(),
      ),
      receivables: AgingReport.fromJson(
        receivablesData['accountsReceivable'] ?? {},
      ),
      payables: AgingReport.fromJson(payablesData['accountsPayable'] ?? {}),
      expensesBreakdown:
          (expensesBreakdownData['expensesBreakdown'] as List? ?? [])
              .map((e) => ExpenseCategory.fromJson(e))
              .toList(),
      stockAlerts: (stockAlertsData['alerts'] as List? ?? [])
          .map((e) => StockAlert.fromJson(e))
          .toList(),
      recentTransactions: (transactionsData['transactions'] as List? ?? [])
          .map((tx) => Transaction.fromJson(tx))
          .toList(),
      incomeData: List.generate(
        incomeList.length,
        (i) => ChartPoint(day: i, amount: incomeList[i]),
      ),
      expenseData: List.generate(
        expenseList.length,
        (i) => ChartPoint(day: i, amount: expenseList[i]),
      ),
      months: monthLabels,
    );
  }

  factory DashboardData.mock() {
    return DashboardData(
      summary: FinancialSummary.mock(),
      today: TodayPerformance(
        revenue: 45000,
        expenses: 12000,
        transactions: 15,
        revenueChange: 12.5,
        expensesChange: -5.2,
        revenueTrend: [10, 15, 8, 20, 18, 25, 30],
        expensesTrend: [5, 8, 12, 10, 15, 12, 9],
      ),
      receivables: AgingReport.mock('Receivables'),
      payables: AgingReport.mock('Payables'),
      expensesBreakdown: [
        ExpenseCategory(category: 'Rent', amount: 5000, percentage: 40),
        ExpenseCategory(category: 'Salary', amount: 4000, percentage: 32),
        ExpenseCategory(category: 'Utilities', amount: 2000, percentage: 16),
        ExpenseCategory(category: 'Other', amount: 1500, percentage: 12),
      ],
      stockAlerts: [
        StockAlert(
          id: '1',
          product: 'Paper A4',
          message: 'Low Stock',
          currentStock: 5,
          reorderPoint: 10,
          type: 'low_stock',
        ),
      ],
      recentTransactions: [],
      incomeData: [],
      expenseData: [],
      months: [],
    );
  }
  static double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }

  static int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }
}

class FinancialSummary {
  final ComparisonMetric revenue;
  final ComparisonMetric expenses;
  final ComparisonMetric profit;
  final ComparisonMetric outstandingInvoices;

  FinancialSummary({
    required this.revenue,
    required this.expenses,
    required this.profit,
    required this.outstandingInvoices,
  });

  factory FinancialSummary.fromJson(Map<String, dynamic> json) {
    return FinancialSummary(
      revenue: ComparisonMetric.fromJson(json['revenue'] ?? {}),
      expenses: ComparisonMetric.fromJson(json['expenses'] ?? {}),
      profit: ComparisonMetric.fromJson(json['profit'] ?? {}),
      outstandingInvoices: ComparisonMetric.fromJson(
        json['outstandingInvoices'] ?? {},
      ),
    );
  }

  factory FinancialSummary.mock() {
    return FinancialSummary(
      revenue: ComparisonMetric(current: 120000, previous: 100000, change: 20),
      expenses: ComparisonMetric(current: 45000, previous: 50000, change: -10),
      profit: ComparisonMetric(current: 75000, previous: 50000, change: 50),
      outstandingInvoices: ComparisonMetric(
        current: 30000,
        previous: 35000,
        change: -14,
      ),
    );
  }
}

class ComparisonMetric {
  final double current;
  final double previous;
  final double change;

  ComparisonMetric({
    required this.current,
    required this.previous,
    required this.change,
  });

  factory ComparisonMetric.fromJson(Map<String, dynamic> json) {
    return ComparisonMetric(
      current: DashboardData._toDouble(json['current']),
      previous: DashboardData._toDouble(json['previous']),
      change: DashboardData._toDouble(json['change']),
    );
  }
}

class TodayPerformance {
  final double revenue;
  final double expenses;
  final int transactions;
  final double revenueChange;
  final double expensesChange;
  final List<double> revenueTrend;
  final List<double> expensesTrend;

  TodayPerformance({
    required this.revenue,
    required this.expenses,
    required this.transactions,
    required this.revenueChange,
    required this.expensesChange,
    required this.revenueTrend,
    required this.expensesTrend,
  });
}

class AgingReport {
  final double current;
  final double notDue;
  final double overdue;
  final List<AgingPeriod> aging;

  AgingReport({
    required this.current,
    required this.notDue,
    required this.overdue,
    required this.aging,
  });

  factory AgingReport.fromJson(Map<String, dynamic> json) {
    return AgingReport(
      current: DashboardData._toDouble(json['current']),
      notDue: DashboardData._toDouble(json['notDue']),
      overdue: DashboardData._toDouble(json['overdue']),
      aging: (json['aging'] as List? ?? [])
          .map((e) => AgingPeriod.fromJson(e))
          .toList(),
    );
  }

  factory AgingReport.mock(String type) {
    return AgingReport(
      current: 50000,
      notDue: 35000,
      overdue: 15000,
      aging: [
        AgingPeriod(range: '0-30', amount: 35000),
        AgingPeriod(range: '31-60', amount: 8000),
        AgingPeriod(range: '61-90', amount: 4000),
        AgingPeriod(range: '90+', amount: 3000),
      ],
    );
  }
}

class AgingPeriod {
  final String range;
  final double amount;

  AgingPeriod({required this.range, required this.amount});

  factory AgingPeriod.fromJson(Map<String, dynamic> json) {
    return AgingPeriod(
      range: json['range'] ?? '',
      amount: DashboardData._toDouble(json['amount']),
    );
  }
}

class ExpenseCategory {
  final String category;
  final double amount;
  final double percentage;

  ExpenseCategory({
    required this.category,
    required this.amount,
    required this.percentage,
  });

  factory ExpenseCategory.fromJson(Map<String, dynamic> json) {
    return ExpenseCategory(
      category: json['category'] ?? '',
      amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      percentage: double.tryParse(json['percentage']?.toString() ?? '0') ?? 0.0,
    );
  }
}

class StockAlert {
  final String id;
  final String product;
  final String message;
  final int currentStock;
  final int? reorderPoint;
  final String type;

  StockAlert({
    required this.id,
    required this.product,
    required this.message,
    required this.currentStock,
    this.reorderPoint,
    required this.type,
  });

  factory StockAlert.fromJson(Map<String, dynamic> json) {
    return StockAlert(
      id: json['id']?.toString() ?? '',
      product: json['product'] ?? '',
      message: json['message'] ?? '',
      currentStock: DashboardData._toInt(json['currentStock']),
      reorderPoint: json['reorderPoint'] != null
          ? DashboardData._toInt(json['reorderPoint'])
          : null,
      type: json['type'] ?? '',
    );
  }
}

class ChartPoint {
  final int day;
  final double amount;

  ChartPoint({required this.day, required this.amount});
}

enum TransactionType { income, expense }

enum TransactionStatus { pending, completed, failed }

class Transaction {
  final String id;
  final DateTime date;
  final String description;
  final double amount;
  final TransactionType type;
  final TransactionStatus status;

  Transaction({
    required this.id,
    required this.date,
    required this.description,
    required this.amount,
    required this.type,
    required this.status,
  });

  factory Transaction.fromJson(Map<String, dynamic> tx) {
    return Transaction(
      id: tx['id']?.toString() ?? '',
      date: DateTime.tryParse(tx['date'] ?? '') ?? DateTime.now(),
      description: tx['description'] ?? '',
      amount: DashboardData._toDouble(tx['amount']),
      type: tx['type'] == 'income'
          ? TransactionType.income
          : TransactionType.expense,
      status: _parseStatus(tx['status']),
    );
  }

  static TransactionStatus _parseStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'completed':
        return TransactionStatus.completed;
      case 'pending':
        return TransactionStatus.pending;
      case 'failed':
        return TransactionStatus.failed;
      default:
        return TransactionStatus.pending;
    }
  }
}
