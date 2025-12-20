"use client";

import React,{ useState } from "react";
import { ArrowUpDown, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

export default function TaxPaidTable({ paidTaxes, searchTerm = "" }) {
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Safety check for paidTaxes data
  if (!paidTaxes || !paidTaxes.expenses || !Array.isArray(paidTaxes.expenses)) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Tax Data Available</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Loading tax expense data...
        </p>
      </div>
    );
  }

  // Filter expenses by search term
  const filteredExpenses = paidTaxes.expenses.filter(expense => {
    if (!searchTerm) return true;
    
    return (
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Sort expenses
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === "date") {
      comparison = new Date(a.date) - new Date(b.date);
    } else if (sortField === "amount") {
      comparison = a.amount - b.amount;
    } else if (sortField === "description") {
      comparison = a.description.localeCompare(b.description);
    } else if (sortField === "id") {
      comparison = a.id.localeCompare(b.id);
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (filteredExpenses.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Tax Data Found</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          {searchTerm 
            ? `No paid taxes match "${searchTerm}". Try a different search term.`
            : "No paid taxes available for the selected period."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium mb-4">Paid Taxes (Expense Tax)</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("id")}
              >
                <div className="flex items-center">
                  Reference
                  <ArrowUpDown 
                    className={`h-4 w-4 ml-1 ${sortField === "id" ? "text-blue-500" : "text-gray-400"}`} 
                  />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center">
                  Date
                  <ArrowUpDown 
                    className={`h-4 w-4 ml-1 ${sortField === "date" ? "text-blue-500" : "text-gray-400"}`} 
                  />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("description")}
              >
                <div className="flex items-center">
                  Description
                  <ArrowUpDown 
                    className={`h-4 w-4 ml-1 ${sortField === "description" ? "text-blue-500" : "text-gray-400"}`} 
                  />
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end">
                  Tax Amount
                  <ArrowUpDown 
                    className={`h-4 w-4 ml-1 ${sortField === "amount" ? "text-blue-500" : "text-gray-400"}`} 
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedExpenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                  {expense.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(expense.date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {expense.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {formatCurrency(expense.amount)}
                </td>
              </tr>
            ))}
            
            {/* Total row */}
            <tr className="bg-gray-100 font-medium">
              <td colSpan="3" className="px-6 py-4 whitespace-nowrap">
                Total Paid Tax
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-red-600">
                {formatCurrency(paidTaxes.totalTaxPaid)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}