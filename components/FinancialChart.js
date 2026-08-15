"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronDown } from "lucide-react";

const COLORS = ['#4f46e5', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const FinancialChart = ({
  title,
  data,
  type = "line",
  height = 300,
  showLegend = true,
  showTooltip = true,
  isLoading = false,
  timeframe = null,
  onTimeframeChange = null
}) => {
  const [activeTimeframe, setActiveTimeframe] = useState(timeframe || 'thisMonth');
  
  // Handle timeframe change
  const handleTimeframeChange = (e) => {
    const newTimeframe = e.target.value;
    setActiveTimeframe(newTimeframe);
    
    if (onTimeframeChange) {
      onTimeframeChange(newTimeframe);
    }
  };
  
  // Format numbers for display
  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    
    // Convert to number if string
    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check if it's a valid number
    if (isNaN(num)) return value;
    
    // Format based on magnitude
    if (Math.abs(num) >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (Math.abs(num) >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return num.toFixed(0);
    }
  };
  
  // Custom tooltip formatter
  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
          <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <div key={`tooltip-${index}`} className="flex items-center text-sm">
              <div 
                className="w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: entry.color }}
              ></div>
              <span className="text-gray-600 mr-1">{entry.name}:</span>
              <span className="font-medium text-gray-900">
                {entry.name.toLowerCase().includes('percentage') ? `${entry.value}%` : `MWK ${formatNumber(entry.value)}`}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
  
  // Render different chart types
  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <p className="text-gray-500">{tt('No data available')}</p>
        </div>
      );
    }
    
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis 
                tickFormatter={formatNumber} 
                tick={{ fontSize: 12 }} 
              />
              {showTooltip && <Tooltip content={customTooltip} />}
              {showLegend && <Legend />}
              
              {/* Dynamically render lines based on data structure */}
              {data && data.length > 0 && Object.keys(data[0])
                .filter(key => key !== 'name')
                .map((key, index) => (
                  <Line 
                    key={key}
                    type="monotone" 
                    dataKey={key} 
                    name={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')} 
                    stroke={COLORS[index % COLORS.length]}
                    dot={{ strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))
              }
            </LineChart>
          </ResponsiveContainer>
        );
        
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis 
                tickFormatter={formatNumber} 
                tick={{ fontSize: 12 }} 
              />
              {showTooltip && <Tooltip content={customTooltip} />}
              {showLegend && <Legend />}
              
              {/* Dynamically render bars based on data structure */}
              {data && data.length > 0 && Object.keys(data[0])
                .filter(key => key !== 'name')
                .map((key, index) => (
                  <Bar 
                    key={key}
                    dataKey={key} 
                    name={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')} 
                    fill={COLORS[index % COLORS.length]}
                  />
                ))
              }
            </BarChart>
          </ResponsiveContainer>
        );
        
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              {showTooltip && <Tooltip formatter={(value) => `MWK ${formatNumber(value)}`} />}
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );
        
      // Add more chart types as needed
      
      default:
        return (
          <div className="h-full w-full flex items-center justify-center">
            <p className="text-gray-500">{tt('Unsupported chart type')}</p>
          </div>
        );
    }
  };
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-800">{title}</h3>
        
        {onTimeframeChange && (
          <div className="relative">
            <select 
              className="appearance-none px-3 py-1.5 border border-gray-300 rounded-md bg-white pr-8 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={activeTimeframe}
              onChange={handleTimeframeChange}
            >
              <option value="thisMonth">{tt('This Month')}</option>
              <option value="lastMonth">{tt('Last Month')}</option>
              <option value="thisQuarter">{tt('This Quarter')}</option>
              <option value="lastQuarter">{tt('Last Quarter')}</option>
              <option value="thisYear">{tt('This Year')}</option>
              <option value="lastYear">{tt('Last Year')}</option>
            </select>
            <div className="absolute right-2 top-2 pointer-events-none">
              <ChevronDown size={14} className="text-gray-500" />
            </div>
          </div>
        )}
      </div>
      
      <div style={{ height: `${height}px` }}>
        {renderChart()}
      </div>
    </div>
  );
};

export default FinancialChart;