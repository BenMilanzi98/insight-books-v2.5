// components/dashboard/MetricCard.jsx
import React from 'react';
import { PercentageChange } from '../FinancialReportComponents';
import { formatCurrency } from '@/lib/currencyUtils';

/**
 * Metric Card Component
 * Displays a single financial metric with optional comparison
 */
export const MetricCard = ({
  title,
  value,
  previousValue,
  percentChange,
  format = 'number',
  icon,
  iconColor,
  subtitle,
  loading = false,
  className = '',
  onClick
}) => {
  // Format the value based on the specified format
  const formatValue = (val) => {
    if (val === undefined || val === null) return '-';
    
    switch (format) {
      case 'currency':
        return formatCurrency(val);
      case 'percentage':
        return `${parseFloat(val).toFixed(2)}%`;
      case 'integer':
        return parseInt(val).toLocaleString();
      default:
        return typeof val === 'number' 
          ? val.toLocaleString(undefined, { maximumFractionDigits: 2 })
          : val;
    }
  };
  
  // Calculate percent change if not provided but previous value is available
  const calculatedPercentChange = percentChange === undefined && previousValue !== undefined
    ? previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : value > 0 ? 100 : value < 0 ? -100 : 0
    : percentChange;
  
  // Determine if the card is clickable
  const isClickable = typeof onClick === 'function';
  
  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 shadow-sm p-5 ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
      onClick={isClickable ? onClick : undefined}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
        {icon && (
          <div className={`${iconColor || 'text-blue-600'}`}>
            {icon}
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="animate-pulse h-8 bg-gray-200 rounded w-3/4 mb-1"></div>
      ) : (
        <div className="text-2xl font-bold text-gray-800">
          {formatValue(value)}
        </div>
      )}
      
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
      
      {calculatedPercentChange !== undefined && !loading && (
        <div className="mt-2">
          <PercentageChange value={calculatedPercentChange} />
          <span className="text-xs text-gray-500 ml-1">vs previous period</span>
        </div>
      )}
    </div>
  );
};

// components/dashboard/MetricsGrid.jsx
import React from 'react';
import { MetricCard } from './MetricCard';

/**
 * Metrics Grid Component
 * Displays a grid of metric cards
 */
export const MetricsGrid = ({
  metrics,
  loading = false,
  columns = 4,
  className = ''
}) => {
  const gridColsClass = `grid-cols-1 md:grid-cols-${columns}`;
  
  return (
    <div className={`grid ${gridColsClass} gap-5 ${className}`}>
      {metrics.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          previousValue={metric.previousValue}
          percentChange={metric.percentChange}
          format={metric.format}
          icon={metric.icon}
          iconColor={metric.iconColor}
          subtitle={metric.subtitle}
          loading={loading}
          onClick={metric.onClick}
        />
      ))}
    </div>
  );
};

// components/dashboard/FinancialSummaryPanel.jsx
import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, AlertCircle, ShoppingBag, Users } from 'lucide-react';
import { MetricsGrid } from './MetricsGrid';
import { SalesTrendChart } from '../charts/SalesChart';
import { ExpenseByCategoryChart } from '../charts/ExpenseChart';

/**
 * Financial Summary Panel Component
 * Displays a comprehensive financial summary dashboard
 */
export const FinancialSummaryPanel = ({
  data,
  timeframe,
  loading = false,
  onViewReport
}) => {
  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No financial data available</p>
      </div>
    );
  }
  
  // Prepare metrics for the dashboard
  const metrics = [
    {
      title: 'Total Revenue',
      value: data.revenue,
      format: 'currency',
      icon: <TrendingUp size={16} />,
      iconColor: 'text-green-600',
      subtitle: timeframe,
      onClick: () => onViewReport?.('profit-loss')
    },
    {
      title: 'Total Expenses',
      value: data.expenses,
      format: 'currency',
      icon: <TrendingDown size={16} />,
      iconColor: 'text-red-600',
      subtitle: timeframe,
      onClick: () => onViewReport?.('expense-report')
    },
    {
      title: 'Net Profit',
      value: data.profit,
      format: 'currency',
      icon: <DollarSign size={16} />,
      iconColor: data.profit >= 0 ? 'text-green-600' : 'text-red-600',
      subtitle: data.profitMargin ? `${data.profitMargin}% margin` : 'Profit margin',
      onClick: () => onViewReport?.('profit-loss')
    },
    {
      title: 'Outstanding Invoices',
      value: data.outstandingInvoices?.total,
      format: 'currency',
      icon: <CreditCard size={16} />,
      iconColor: 'text-orange-500',
      subtitle: `${data.outstandingInvoices?.count || 0} unpaid invoice(s)`,
      onClick: () => onViewReport?.('accounts-receivable')
    }
  ];
  
  // Additional metrics if available
  if (data.recentSales !== undefined) {
    metrics.push({
      title: 'Recent Sales',
      value: data.recentSales,
      format: 'integer',
      icon: <ShoppingBag size={16} />,
      iconColor: 'text-blue-600',
      subtitle: 'In the last 7 days',
      onClick: () => onViewReport?.('sales-report')
    });
  }
  
  if (data.activeClients !== undefined) {
    metrics.push({
      title: 'Active Clients',
      value: data.activeClients,
      format: 'integer',
      icon: <Users size={16} />,
      iconColor: 'text-purple-600',
      subtitle: 'With recent activity',
      onClick: () => onViewReport?.('customer-report')
    });
  }
  
  if (data.lowStockProducts !== undefined) {
    metrics.push({
      title: 'Low Stock Items',
      value: data.lowStockProducts,
      format: 'integer',
      icon: <AlertCircle size={16} />,
      iconColor: 'text-amber-500',
      subtitle: 'Below reorder point',
      onClick: () => onViewReport?.('inventory-valuation')
    });
  }
  
  return (
    <div className="space-y-6">
      <MetricsGrid 
        metrics={metrics} 
        loading={loading}
        columns={4}
      />
      
      {/* Charts row */}
      {data.salesTrend && data.expensesByCategory && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <SalesTrendChart data={data.salesTrend} />
          <ExpenseByCategoryChart data={data.expensesByCategory} />
        </div>
      )}
      
      {/* KPI row - conditionally shown if data exists */}
      {data.keyPerformanceIndicators && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mt-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Key Performance Indicators</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.keyPerformanceIndicators.map((kpi, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-600 mb-1">{kpi.name}</h4>
                <p className="text-xl font-semibold text-gray-800">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-1">{kpi.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// components/dashboard/PerformanceSnapshot.jsx
import React from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  ArrowRight,
  Share2,
  TrendingDown,
  BarChart
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { formatDate } from '@/lib/dateUtils';

/**
 * Performance Snapshot Component
 * Shows a quick view of current financial performance with links to detailed reports
 */
export const PerformanceSnapshot = ({
  data,
  timeframe,
  loading = false,
  onViewReport
}) => {
  if (!data || (loading && !data)) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-5 bg-gray-200 rounded w-full"></div>
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
          <div className="h-5 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }
  
  const { revenue, expenses, profit } = data;
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-800">Performance Snapshot</h3>
        <div className="flex items-center text-sm text-gray-500">
          <Calendar size={14} className="mr-1" />
          <span>{timeframe}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-blue-100 text-blue-600 mr-3">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Revenue</p>
            <p className="text-xl font-semibold text-gray-800">{formatCurrency(revenue)}</p>
          </div>
        </div>
        
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-red-100 text-red-600 mr-3">
            <TrendingDown size={20} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Expenses</p>
            <p className="text-xl font-semibold text-gray-800">{formatCurrency(expenses)}</p>
          </div>
        </div>
        
        <div className="flex items-center">
          <div className={`p-2 rounded-full ${profit >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} mr-3`}>
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Profit</p>
            <p className="text-xl font-semibold text-gray-800">{formatCurrency(profit)}</p>
            <p className="text-xs text-gray-500">{profitMargin.toFixed(2)}% margin</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-3 mt-4">
        <div 
          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
          onClick={() => onViewReport?.('profit-loss')}
        >
          <div className="flex items-center">
            <BarChart size={16} className="text-blue-600 mr-2" />
            <span className="text-gray-700">View Profit & Loss Report</span>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </div>
        
        <div 
          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
          onClick={() => onViewReport?.('expense-report')}
        >
          <div className="flex items-center">
            <TrendingDown size={16} className="text-red-600 mr-2" />
            <span className="text-gray-700">Analyze Expenses</span>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </div>
        
        <div 
          className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
          onClick={() => onViewReport?.('financial-ratios')}
        >
          <div className="flex items-center">
            <Share2 size={16} className="text-purple-600 mr-2" />
            <span className="text-gray-700">View Financial Ratios</span>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
};