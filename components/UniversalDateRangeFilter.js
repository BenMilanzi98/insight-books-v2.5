"use client";

import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, X, RefreshCw, Loader2, Clock, X as XIcon } from 'lucide-react';
import { 
  getAvailableTimeframes, 
  getTimeframeLabel, 
  validateDateRange, 
  getDefaultCustomRange,
  formatDate 
} from '@/lib/dateUtils';

/**
 * Universal Date Range Filter Component
 * A comprehensive date range selector that can be used across all reports and dashboard
 * Supports predefined timeframes, custom date ranges, and comparison functionality
 */
export const UniversalDateRangeFilter = ({
  timeframe = 'thisMonth',
  onTimeframeChange,
  onCustomDateChange,
  onRefresh,
  loading = false,
  showComparison = false,
  comparisonEnabled = false,
  onComparisonToggle,
  showRefresh = true,
  className = '',
  disabled = false,
  size = 'default', // 'small', 'default', 'large'
  variant = 'default' // 'default', 'compact', 'minimal'
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [validationError, setValidationError] = useState('');
  const containerRef = useRef(null);

  const timeframes = getAvailableTimeframes();

  // Initialize custom dates when switching to custom (sync with parent timeframe)
  /* eslint-disable react-hooks/set-state-in-effect -- intentional one-time fill when parent sets timeframe to custom */
  useEffect(() => {
    if (timeframe === 'custom' && (!customStartDate || !customEndDate)) {
      const defaultRange = getDefaultCustomRange();
      setCustomStartDate(defaultRange.startDate);
      setCustomEndDate(defaultRange.endDate);

      if (onCustomDateChange) {
        onCustomDateChange(defaultRange);
      }
    }
  }, [timeframe, customStartDate, customEndDate, onCustomDateChange]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setShowCustomRange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle timeframe selection
  const handleTimeframeSelect = (selectedTimeframe) => {
    if (selectedTimeframe === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      if (onTimeframeChange) {
        onTimeframeChange(selectedTimeframe);
      }
      setIsDropdownOpen(false);
    }
  };

  // Handle custom date range apply
  const handleCustomDateApply = () => {
    const validation = validateDateRange(customStartDate, customEndDate);
    
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    setValidationError('');
    
    if (onCustomDateChange) {
      onCustomDateChange({
        startDate: customStartDate,
        endDate: customEndDate
      });
    }
    if (onTimeframeChange) {
      onTimeframeChange('custom');
    }
    setShowCustomRange(false);
    setIsDropdownOpen(false);
  };

  // Handle custom date range reset
  const handleCustomDateReset = () => {
    const defaultRange = getDefaultCustomRange();
    setCustomStartDate(defaultRange.startDate);
    setCustomEndDate(defaultRange.endDate);
    setValidationError('');
  };

  // Get current timeframe label
  const getCurrentTimeframeLabel = () => {
    if (timeframe === 'custom') {
      return `${formatDate(customStartDate, 'short')} - ${formatDate(customEndDate, 'short')}`;
    }
    return getTimeframeLabel(timeframe);
  };

  // Get current timeframe description
  const getCurrentTimeframeDescription = () => {
    if (timeframe === 'custom') {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return `${daysDiff} day${daysDiff !== 1 ? 's' : ''}`;
    }
    const selected = timeframes.find(t => t.value === timeframe);
    return selected ? selected.description : '';
  };

  // Size classes
  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    default: 'px-3 py-2 text-sm',
    large: 'px-4 py-3 text-base'
  };

  // Variant classes
  const variantClasses = {
    default: 'bg-white border border-gray-300',
    compact: 'bg-gray-50 border border-gray-200',
    minimal: 'bg-transparent border-none'
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} ref={containerRef}>
      {/* Main Date Range Selector */}
      <div className="relative">
        <button
          className={`flex items-center justify-between rounded-md transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]}`}
          onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
          disabled={disabled || loading}
        >
          <div className="flex items-center">
            <Calendar size={size === 'small' ? 14 : 16} className="text-gray-500 mr-2" />
            <div className="text-left">
              <div className="font-medium text-gray-900">{getCurrentTimeframeLabel()}</div>
              {variant !== 'minimal' && (
                <div className="text-xs text-gray-500">{getCurrentTimeframeDescription()}</div>
              )}
            </div>
          </div>
          <ChevronDown 
            size={size === 'small' ? 12 : 14} 
            className={`text-gray-400 ml-2 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {/* Horizontal Dropdown Panel - Just Below Selector */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 min-w-[400px] max-w-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[99999] animate-in slide-in-from-top-2 duration-200">
            {/* Gradient Top Border */}
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500" />
            
            {/* Content */}
            <div className="p-4 bg-gradient-to-br from-gray-50/50 to-white">
              {showCustomRange ? (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setValidationError('');
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      max={customEndDate}
                    />
                  </div>
                  <ChevronDown size={16} className="text-gray-400 mb-2 rotate-[-90deg]" />
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        setValidationError('');
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      min={customStartDate}
                    />
                  </div>
                  <div className="flex gap-2 pb-0.5">
                    <button
                      onClick={handleCustomDateReset}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleCustomDateApply}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 text-sm font-medium transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {timeframes.map((tf) => (
                    <button
                      key={tf.value}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                        timeframe === tf.value 
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md' 
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:shadow-sm'
                      }`}
                      onClick={() => handleTimeframeSelect(tf.value)}
                    >
                      <span className={`text-sm font-medium ${timeframe === tf.value ? 'text-white' : 'text-gray-900'}`}>
                        {tf.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              {validationError && (
                <p className="text-red-500 text-xs mt-2">{validationError}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Date Range Input (when shown inline) */}
      {showCustomRange && !isDropdownOpen && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => {
              setCustomStartDate(e.target.value);
              setValidationError('');
            }}
            className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 ${sizeClasses[size]}`}
            max={customEndDate}
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => {
              setCustomEndDate(e.target.value);
              setValidationError('');
            }}
            className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 ${sizeClasses[size]}`}
            min={customStartDate}
          />
        </div>
      )}

      {/* Validation Error */}
      {validationError && !isDropdownOpen && (
        <div className="text-red-500 text-xs mt-1">{validationError}</div>
      )}

      {/* Comparison Toggle */}
      {showComparison && (
        <button
          className={`flex items-center px-3 py-2 border rounded-md text-sm transition-colors ${sizeClasses[size]} ${
            comparisonEnabled 
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
          onClick={() => onComparisonToggle && onComparisonToggle(!comparisonEnabled)}
        >
          <Clock size={size === 'small' ? 14 : 16} className="mr-2" />
          Compare
        </button>
      )}
      
      {/* Refresh Button */}
      {showRefresh && onRefresh && (
        <button 
          className={`flex items-center border border-gray-300 bg-white rounded-md hover:bg-gray-50 text-gray-700 transition-colors disabled:opacity-50 ${sizeClasses[size]}`}
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={size === 'small' ? 14 : 16} className="mr-2 animate-spin" />
          ) : (
            <RefreshCw size={size === 'small' ? 14 : 16} className="mr-2" />
          )}
          Refresh
        </button>
      )}
    </div>
  );
};

export default UniversalDateRangeFilter;
