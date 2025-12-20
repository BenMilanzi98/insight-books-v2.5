"use client";

import { useState, useEffect } from "react";
import { DollarSign, Calculator, Plus, Trash2, Save, Eye, AlertCircle, CheckCircle } from "lucide-react";

export default function PayrollCreation() {
  const [employees, setEmployees] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [payrollData, setPayrollData] = useState({
    grossSalary: 0,
    allowances: {},
    selectedDeductions: [],
    customDeductions: []
  });
  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [newDeduction, setNewDeduction] = useState({
    name: '',
    description: '',
    type: 'percentage',
    value: 0,
    isStatutory: false
  });

  useEffect(() => {
    fetchEmployees();
    fetchDeductions();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDeductions = async () => {
    try {
      const response = await fetch('/api/deductions');
      const data = await response.json();
      setDeductions(data.deductions || []);
    } catch (error) {
      console.error('Error fetching deductions:', error);
    }
  };

  const calculatePayroll = async () => {
    if (!payrollData.grossSalary || payrollData.grossSalary <= 0) {
      alert('Please enter a valid gross salary');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grossSalary: payrollData.grossSalary,
          deductionIds: payrollData.selectedDeductions.map(d => d.id),
          customDeductions: payrollData.customDeductions
        }),
      });

      const data = await response.json();
      setCalculation(data.calculation);
    } catch (error) {
      console.error('Error calculating payroll:', error);
      alert('Failed to calculate payroll');
    } finally {
      setLoading(false);
    }
  };

  const addCustomDeduction = () => {
    if (!newDeduction.name || newDeduction.value <= 0) {
      alert('Please fill in all deduction fields');
      return;
    }

    const deduction = {
      id: `custom_${Date.now()}`,
      name: newDeduction.name,
      type: newDeduction.type,
      value: parseFloat(newDeduction.value),
      isStatutory: newDeduction.isStatutory
    };

    setPayrollData(prev => ({
      ...prev,
      customDeductions: [...prev.customDeductions, deduction]
    }));

    setNewDeduction({
      name: '',
      description: '',
      type: 'percentage',
      value: 0,
      isStatutory: false
    });
    setShowDeductionModal(false);
  };

  const removeCustomDeduction = (id) => {
    setPayrollData(prev => ({
      ...prev,
      customDeductions: prev.customDeductions.filter(d => d.id !== id)
    }));
  };

  const toggleDeduction = (deduction) => {
    setPayrollData(prev => {
      const isSelected = prev.selectedDeductions.some(d => d.id === deduction.id);
      if (isSelected) {
        return {
          ...prev,
          selectedDeductions: prev.selectedDeductions.filter(d => d.id !== deduction.id)
        };
      } else {
        return {
          ...prev,
          selectedDeductions: [...prev.selectedDeductions, deduction]
        };
      }
    });
  };

  const savePayroll = async () => {
    if (!selectedEmployee || !calculation) {
      alert('Please select an employee and calculate payroll first');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/payroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          basicSalary: payrollData.grossSalary,
          allowances: payrollData.allowances,
          deductions: [...payrollData.selectedDeductions, ...payrollData.customDeductions],
          grossPay: calculation.grossSalary,
          payeAmount: calculation.paye.payeAmount,
          npsEmployeeAmount: calculation.nps.employeeAmount,
          npsEmployerAmount: calculation.nps.employerAmount,
          totalNpsAmount: calculation.nps.totalAmount,
          netPay: calculation.netPay,
          status: 'Processed'
        }),
      });

      if (response.ok) {
        alert('Payroll saved successfully!');
        // Reset form
        setSelectedEmployee(null);
        setPayrollData({
          grossSalary: 0,
          allowances: {},
          selectedDeductions: [],
          customDeductions: []
        });
        setCalculation(null);
      } else {
        const error = await response.json();
        alert(`Failed to save payroll: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving payroll:', error);
      alert('Failed to save payroll');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payroll Creation</h1>
          <p className="text-gray-600">Create payroll with Malawi PAYE calculation and custom deductions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Select Employee</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {employees.map(employee => (
                  <div
                    key={employee.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedEmployee?.id === employee.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setPayrollData(prev => ({
                        ...prev,
                        grossSalary: employee.salary || 0
                      }));
                    }}
                  >
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-sm text-gray-600">{employee.jobTitle || employee.position}</div>
                    <div className="text-sm text-gray-500">MWK {employee.salary?.toLocaleString() || '0'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payroll Configuration */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Payroll Configuration</h2>
              
              {selectedEmployee && (
                <div className="space-y-6">
                  {/* Basic Salary */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gross Salary (MWK)
                    </label>
                    <input
                      type="number"
                      value={payrollData.grossSalary}
                      onChange={(e) => setPayrollData(prev => ({
                        ...prev,
                        grossSalary: parseFloat(e.target.value) || 0
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter gross salary"
                    />
                  </div>

                  {/* Deductions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-md font-medium text-gray-700">Deductions</h3>
                      <button
                        onClick={() => setShowDeductionModal(true)}
                        className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        <Plus size={16} className="mr-1" />
                        Add Custom
                      </button>
                    </div>

                    {/* Available Deductions */}
                    <div className="space-y-2 mb-4">
                      {deductions.map(deduction => (
                        <div
                          key={deduction.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            payrollData.selectedDeductions.some(d => d.id === deduction.id)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => toggleDeduction(deduction)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{deduction.name}</div>
                              <div className="text-sm text-gray-600">
                                {deduction.type === 'percentage' 
                                  ? `${deduction.value}%` 
                                  : `MWK ${deduction.value.toLocaleString()}`
                                }
                              </div>
                            </div>
                            {deduction.isStatutory && (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                                Statutory
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Custom Deductions */}
                    {payrollData.customDeductions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">Custom Deductions</h4>
                        {payrollData.customDeductions.map(deduction => (
                          <div key={deduction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium">{deduction.name}</div>
                              <div className="text-sm text-gray-600">
                                {deduction.type === 'percentage' 
                                  ? `${deduction.value}%` 
                                  : `MWK ${deduction.value.toLocaleString()}`
                                }
                              </div>
                            </div>
                            <button
                              onClick={() => removeCustomDeduction(deduction.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Calculate Button */}
                  <button
                    onClick={calculatePayroll}
                    disabled={loading || !payrollData.grossSalary}
                    className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calculator size={20} className="mr-2" />
                    {loading ? 'Calculating...' : 'Calculate Payroll'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Calculation Results */}
        {calculation && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Payroll Calculation Results</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Gross Salary</div>
                <div className="text-2xl font-bold text-blue-900">
                  MWK {calculation.grossSalary.toLocaleString()}
                </div>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-sm text-red-600 font-medium">PAYE Tax</div>
                <div className="text-2xl font-bold text-red-900">
                  MWK {calculation.paye.payeAmount.toLocaleString()}
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-sm text-yellow-600 font-medium">NPS Employee</div>
                <div className="text-2xl font-bold text-yellow-900">
                  MWK {calculation.nps.employeeAmount.toLocaleString()}
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Net Pay</div>
                <div className="text-2xl font-bold text-green-900">
                  MWK {calculation.netPay.toLocaleString()}
                </div>
              </div>
            </div>

            {/* PAYE Breakdown */}
            <div className="mb-6">
              <h3 className="text-md font-semibold mb-3">PAYE Tax Breakdown</h3>
              <div className="space-y-2">
                {calculation.paye.breakdown.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">{item.bracket}</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        MWK {item.taxableAmount.toLocaleString()} × {item.rate}%
                      </div>
                      <div className="text-sm text-gray-600">
                        MWK {item.tax.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={savePayroll}
              disabled={saving}
              className="flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              <Save size={20} className="mr-2" />
              {saving ? 'Saving...' : 'Save Payroll'}
            </button>
          </div>
        )}

        {/* Custom Deduction Modal */}
        {showDeductionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Add Custom Deduction</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newDeduction.name}
                    onChange={(e) => setNewDeduction(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Medical Aid, Loan Repayment"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newDeduction.type}
                    onChange={(e) => setNewDeduction(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {newDeduction.type === 'percentage' ? 'Percentage (%)' : 'Amount (MWK)'}
                  </label>
                  <input
                    type="number"
                    value={newDeduction.value}
                    onChange={(e) => setNewDeduction(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={newDeduction.type === 'percentage' ? '5' : '10000'}
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isStatutory"
                    checked={newDeduction.isStatutory}
                    onChange={(e) => setNewDeduction(prev => ({ ...prev, isStatutory: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="isStatutory" className="text-sm text-gray-700">
                    Statutory deduction (PAYE, NPS, etc.)
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowDeductionModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addCustomDeduction}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Deduction
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


