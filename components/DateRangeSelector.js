// components/DateRangeSelector.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { getTimeframeLabel, getDateRange } from '@/lib/dateUtils';

/**
 * Date Range Selector Component
 * Allows selecting predefined timeframes or a custom date range
 */
export const DateRangeSelector = ({ 
  timeframe, 
  onTimeframeChange,
  onCustomDateChange,
  disabled = false 
}) => {
  const [showCustomRange, setShowCustomRange] = useState(timeframe === 'custom');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Set initial custom dates if timeframe is 'custom'
  useEffect(() => {
    if (timeframe === 'custom' && (!customStartDate || !customEndDate)) {
      // Default to last 30 days if no custom range is set
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      setCustomStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      setCustomEndDate(today.toISOString().split('T')[0]);
      
      if (onCustomDateChange) {
        onCustomDateChange({
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        });
      }
    }
  }, [timeframe, customStartDate, customEndDate, onCustomDateChange]);

  // Listen for clicks outside the dropdown to close it
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
  const handleTimeframeSelect = (newTimeframe) => {
    if (newTimeframe === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      onTimeframeChange(newTimeframe);
    }
    setIsDropdownOpen(false);
  };

  // Handle custom date range change
  const handleCustomDateChange = () => {
    if (customStartDate && customEndDate) {
      onTimeframeChange('custom');
      if (onCustomDateChange) {
        onCustomDateChange({
          startDate: customStartDate,
          endDate: customEndDate
        });
      }
    }
  };

  // Handle dropdown toggle
  const toggleDropdown = () => {
    if (!disabled) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        className="px-3 py-2 border border-gray-300 rounded-md bg-white flex items-center shadow-sm hover:bg-gray-50 text-gray-700 transition-all disabled:opacity-50"
        onClick={toggleDropdown}
        disabled={disabled}
      >
        <Calendar size={16} className="mr-2" />
        {timeframe === 'custom' 
          ? `${customStartDate} to ${customEndDate}`
          : getTimeframeLabel(timeframe)
        }
        <ChevronDown size={15} className="ml-2" />
      </button>
      
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
          <div className="py-2">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Timeframe</div>
            {['thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'thisYear', 'lastYear', 'custom'].map((option) => (
              <button 
                key={option}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${timeframe === option ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                onClick={() => handleTimeframeSelect(option)}
              >
                {getTimeframeLabel(option)}
              </button>
            ))}
          </div>
          
          {showCustomRange && (
            <div className="border-t border-gray-200 p-3">
              <div className="text-xs font-medium text-gray-500 uppercase mb-2">Custom Range</div>
              
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate}
                  />
                </div>
                
                <button 
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                  onClick={handleCustomDateChange}
                  disabled={!customStartDate || !customEndDate}
                >
                  Apply Range
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// components/ReportDateFilter.jsx
import React, { useState } from 'react';
import { DateRangeSelector } from './DateRangeSelector';
import { Calendar, ChevronDown, RefreshCw, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';

/**
 * Report Date Filter
 * Combines date range selection with period comparison and refresh functionality
 */
export const ReportDateFilter = ({
  timeframe,
  onTimeframeChange,
  onRefresh,
  loading = false,
  showComparison = false,
  comparisonEnabled = false,
  onComparisonToggle,
  dateRange,
  className = ''
}) => {
  const [customDateRange, setCustomDateRange] = useState(dateRange);
  
  // Handle custom date range changes
  const handleCustomDateChange = (range) => {
    setCustomDateRange(range);
    if (onTimeframeChange) {
      onTimeframeChange('custom');
    }
  };
  
  // Handle comparison toggle
  const handleComparisonToggle = () => {
    if (onComparisonToggle) {
      onComparisonToggle(!comparisonEnabled);
    }
  };
  
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <DateRangeSelector 
        timeframe={timeframe}
        onTimeframeChange={onTimeframeChange}
        onCustomDateChange={handleCustomDateChange}
        disabled={loading}
      />
      
      {showComparison && (
        <button
          className={`px-3 py-2 border rounded-md flex items-center text-sm shadow-sm transition-all ${
            comparisonEnabled 
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
          onClick={handleComparisonToggle}
        >
          Compare with Previous
        </button>
      )}
      
      {onRefresh && (
        <button 
          className="px-3 py-2 border border-gray-300 bg-white rounded-md flex items-center text-sm shadow-sm hover:bg-gray-50 text-gray-700 transition-all disabled:opacity-50"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={16} className="mr-2 animate-spin" />
          ) : (
            <RefreshCw size={16} className="mr-2" />
          )}
          Refresh
        </button>
      )}
    </div>
  );
};