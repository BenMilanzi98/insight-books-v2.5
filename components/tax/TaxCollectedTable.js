"use client";
import { tt } from '@/lib/i18n/runtime';
import React from 'react';
import { useState} from "react";
import { ChevronDown, ChevronRight, Search, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

export default function TaxCollectedTable({ collectedTaxes, searchTerm = "" }) {
  const [expandedRates, setExpandedRates] = useState({});

  // Toggle rate expansion
  const toggleRate = (rateIndex) => {
    setExpandedRates({
      ...expandedRates,
      [rateIndex]: !expandedRates[rateIndex]
    });
  };

  // Filter items by search term
  const filterItems = (items) => {
    if (!searchTerm) return items;
    
    return items.filter(item => 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Get filtered rates
  const getFilteredRates = () => {
    if (!searchTerm) return collectedTaxes.byRate;
    
    return collectedTaxes.byRate.map(rate => ({
      ...rate,
      items: filterItems(rate.items)
    })).filter(rate => rate.items.length > 0);
  };

  const filteredRates = getFilteredRates();

  if (filteredRates.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{tt('No Tax Data Found')}</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          {searchTerm 
            ? `No collected taxes match "${searchTerm}". Try a different search term.`
            : "No collected taxes available for the selected period."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium mb-4">{tt('Collected Taxes')}</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {tt('Tax Rate')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {tt('Taxable Amount')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {tt('Tax Amount')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {tt('Items')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRates.map((rate, rateIndex) => (
              <React.Fragment key={rateIndex}>
                {/* Rate summary row */}
                <tr className="bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => toggleRate(rateIndex)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {expandedRates[rateIndex] ? (
                        <ChevronDown className="h-5 w-5 text-gray-400 mr-2" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400 mr-2" />
                      )}
                      <span className="font-medium">{rate.rate}% Tax Rate</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {formatCurrency(rate.taxableAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-blue-600">
                    {formatCurrency(rate.taxAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    {filterItems(rate.items).length} items
                  </td>
                </tr>
                
                {/* Expanded detail rows */}
                {expandedRates[rateIndex] && filterItems(rate.items).map((item, itemIndex) => (
                  <tr key={`${rateIndex}-${itemIndex}`} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap pl-12 text-sm">
                      <div className="flex items-center">
                        <span className="text-gray-900">
                          {item.type === 'invoice' ? 'Invoice' : 'Sale'}: {item.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-500">
                      {formatCurrency(item.taxableAmount)}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatCurrency(item.taxAmount)}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                      {item.description}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            
            {/* Total row */}
            <tr className="bg-gray-100 font-medium">
              <td className="px-6 py-4 whitespace-nowrap">
                {tt('Total Collected Tax')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                {formatCurrency(collectedTaxes.totalTaxableAmount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-blue-600">
                {formatCurrency(collectedTaxes.totalCollectedTax)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                {/* Sum of all filtered items */}
                {filteredRates.reduce((sum, rate) => sum + filterItems(rate.items).length, 0)} items
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}