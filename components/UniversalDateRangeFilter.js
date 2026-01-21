"use client";

import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, X, RefreshCw, Loader2, Clock } from 'lucide-react';
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
  const dropdownRef = useRef(null);

  const timeframes = getAvailableTimeframes();

  // Initialize custom dates if timeframe is custom
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
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
      setIsDropdownOpen(false);
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
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* Main Date Range Selector */}
      <div className="relative" ref={dropdownRef}>
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
            className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-sm z-50">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 uppercase mb-2 px-2">Quick Select</div>
              
              {/* Predefined timeframes */}
              <div className="space-y-1">
                {timeframes.map((tf) => (
                  <button
                    key={tf.value}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors ${
                      timeframe === tf.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                    onClick={() => handleTimeframeSelect(tf.value)}
                  >
                    <div className="font-medium">{tf.label}</div>
                    <div className="text-xs text-gray-500">{tf.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Date Range Input */}
      {showCustomRange && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setValidationError('');
              }}
              className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${sizeClasses[size]}`}
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
              className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${sizeClasses[size]}`}
              min={customStartDate}
            />
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={handleCustomDateApply}
              className={`px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${sizeClasses[size]}`}
            >
              Apply
            </button>
            <button
              onClick={handleCustomDateReset}
              className={`px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 ${sizeClasses[size]}`}
            >
              Reset
            </button>
            <button
              onClick={() => setShowCustomRange(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Validation Error */}
      {validationError && (
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