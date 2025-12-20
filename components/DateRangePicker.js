"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";

const DateRangePicker = ({
  timeframe,
  onTimeframeChange,
  onCustomRangeChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(timeframe === 'custom');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Update start and end dates when timeframe changes
  useEffect(() => {
    setShowCustomRange(timeframe === 'custom');
    
    // If we're switching to a preset timeframe, we don't need to update the custom dates
    if (timeframe !== 'custom') {
      return;
    }
  }, [timeframe]);
  
  // Handle timeframe selection
  const handleTimeframeSelect = (newTimeframe) => {
    if (newTimeframe === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      onTimeframeChange(newTimeframe);
    }
    setIsOpen(false);
  };
  
  // Handle custom range apply
  const handleApplyCustomRange = () => {
    if (startDate && endDate) {
      onCustomRangeChange(startDate, endDate);
      setIsOpen(false);
    }
  };
  
  // Get display label for the current timeframe
  const getTimeframeLabel = () => {
    switch (timeframe) {
      case 'thisMonth':
        return 'This Month';
      case 'lastMonth':
        return 'Last Month';
      case 'thisQuarter':
        return 'This Quarter';
      case 'lastQuarter':
        return 'Last Quarter';
      case 'thisYear':
        return 'This Year';
      case 'lastYear':
        return 'Last Year';
      case 'custom':
        return `${startDate} - ${endDate}`;
      default:
        return 'Select Date Range';
    }
  };
  
  return (
    <div className="relative">
      <div
        className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer text-gray-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar size={16} className="mr-2 text-gray-500" />
        <span className="mr-3">{getTimeframeLabel()}</span>
        <ChevronDown size={16} className="ml-auto text-gray-500" />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="p-2">
            <button
              className={`w-full text-left px-3 py-2 rounded-md ${timeframe === 'thisMonth' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
              onClick={() => handleTimeframeSelect('thisMonth')}
            >
              This Month
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded-md ${timeframe === 'lastMonth' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
              onClick={() => handleTimeframeSelect('lastMonth')}
            >
              Last Month
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded-md ${timeframe === 'thisQuarter' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
              onClick={() => handleTimeframeSelect('thisQuarter')}
            >
              This Quarter
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded-md ${timeframe === 'lastQuarter' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
              onClick={() => handleTimeframeSelect('lastQuarter')}
            >
              Last Quarter
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded-md ${timeframe === 'thisYear' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
              onClick={() => handleTimeframeSelect('thisYear')}
            >
              This Year
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded-md ${timeframe === 'lastYear' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
              onClick={() => handleTimeframeSelect('lastYear')}
            >
              Last Year
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded-md ${timeframe === 'custom' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}
              onClick={() => handleTimeframeSelect('custom')}
            >
              Custom Range...
            </button>
          </div>
          
          {showCustomRange && (
            <div className="p-2 border-t border-gray-200">
              <div className="mb-2">
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
              <button
                className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                onClick={handleApplyCustomRange}
              >
                Apply Range
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;