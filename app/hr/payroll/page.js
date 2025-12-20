"use client";

import { useState, useEffect, useMemo } from "react";
import { DollarSign, Calendar, Play, Download, Eye, CheckCircle, AlertCircle } from "lucide-react";

export default function PayrollProcessing() {
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewEntries, setViewEntries] = useState([]);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [formData, setFormData] = useState({
    periodStart: '',
    periodEnd: '',
    paymentDate: new Date().toISOString().split('T')[0],
    expenseAccountId: '',
    paymentAccountId: ''
  });

  useEffect(() => {
    fetchPayrollRuns();
    loadAccounts();
  }, []);

  useEffect(() => {
    if (accountsLoading || accounts.length === 0) return;
    
    setFormData((prev) => {
      const updates = { ...prev };
      if (!prev.expenseAccountId) {
        const defaultExpense = getDefaultExpenseAccount();
        if (defaultExpense) updates.expenseAccountId = defaultExpense.id;
      }
      if (!prev.paymentAccountId) {
        const defaultPayment = getDefaultPaymentAccount();
        if (defaultPayment) updates.paymentAccountId = defaultPayment.id;
      }
      return updates;
    });
  }, [accounts, accountsLoading]);
  const loadAccounts = async () => {
    try {
      setAccountsLoading(true);
      setAccountsError(null);
      const response = await fetch('/api/accounts?limit=500');
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load accounts');
      }
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAccounts([]);
      setAccountsError(error.message || 'Failed to load accounts');
    } finally {
      setAccountsLoading(false);
    }
  };

  const normalizeAccountType = (account) => {
    return (account?.accountType || account?.type || '').toUpperCase();
  };

  const expenseAccountOptions = useMemo(() => {
    return accounts.filter((account) => normalizeAccountType(account) === 'EXPENSE');
  }, [accounts]);

  const paymentAccountOptions = useMemo(() => {
    return accounts.filter((account) => {
      const type = normalizeAccountType(account);
      if (type !== 'ASSET') return false;
      const name = (account.accountName || account.name || '').toLowerCase();
      const subtype = (account.accountSubtype || '').toLowerCase();
      return (
        name.includes('cash') ||
        name.includes('bank') ||
        name.includes('mpamba') ||
        name.includes('airtel') ||
        name.includes('wallet') ||
        subtype.includes('cash') ||
        subtype.includes('bank')
      );
    });
  }, [accounts]);

  const getDefaultExpenseAccount = () => {
    return (
      expenseAccountOptions.find((account) =>
        (account.accountName || account.name || '').toLowerCase().includes('salar')
      ) || expenseAccountOptions[0]
    );
  };

  const getDefaultPaymentAccount = () => {
    return (
      paymentAccountOptions.find((account) =>
        (account.accountName || account.name || '').toLowerCase().includes('cash')
      ) || paymentAccountOptions[0]
    );
  };

  const formatAccountOption = (account) => {
    if (!account) return 'Unnamed Account';
    const code = account.accountCode || account.code || '';
    const name = account.accountName || account.name || 'Unnamed Account';
    return code ? `${code} — ${name}` : name;
  };

  const fetchPayrollRuns = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payroll');
      const data = await response.json();
      
      // Group payroll by period
      const grouped = {};
      (data.payrolls || []).forEach(payroll => {
        const key = `${payroll.periodStart}-${payroll.periodEnd}`;
        if (!grouped[key]) {
          grouped[key] = {
            periodStart: payroll.periodStart,
            periodEnd: payroll.periodEnd,
            paymentDate: payroll.paymentDate,
            employees: 0,
            totalGross: 0,
            totalNet: 0,
            totalPAYE: 0,
            totalNPS: 0,
            status: payroll.status
          };
        }
        grouped[key].employees++;
        grouped[key].totalGross += parseFloat(payroll.grossPay || 0);
        grouped[key].totalNet += parseFloat(payroll.netPay || 0);
        grouped[key].totalPAYE += parseFloat(payroll.payeAmount || 0);
        grouped[key].totalNPS += parseFloat(payroll.totalNpsAmount || 0);
      });
      
      setPayrollRuns(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching payroll runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRun = async (run) => {
    try {
      setViewLoading(true);
      setShowViewModal(true);
      const start = new Date(run.periodStart).toISOString().split('T')[0];
      const end = new Date(run.periodEnd).toISOString().split('T')[0];
      const res = await fetch(`/api/payroll?start=${start}&end=${end}`);
      const data = await res.json();
      if (res.ok) {
        setViewEntries(data.payrolls || []);
      } else {
        setViewEntries([]);
        setToast({ visible: true, type: 'error', message: data.error || 'Failed to load payroll entries' });
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
      }
    } catch (e) {
      setViewEntries([]);
      setToast({ visible: true, type: 'error', message: 'Failed to load payroll entries' });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
    } finally {
      setViewLoading(false);
    }
  };

  const markDraft = async (id) => {
    try {
      const res = await fetch(`/api/payroll/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Draft' })
      });
      const data = await res.json();
      if (res.ok) {
        setViewEntries(prev => prev.map(p => p.id === id ? { ...p, status: data.payroll.status } : p));
        setToast({ visible: true, type: 'success', message: 'Status updated to Draft' });
      } else {
        setToast({ visible: true, type: 'error', message: data.error || 'Failed to update status' });
      }
    } catch (e) {
      setToast({ visible: true, type: 'error', message: 'Failed to update status' });
    } finally {
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
    }
  };

  const handleProcessPayroll = async () => {
    try {
      setProcessing(true);
      const response = await fetch('/api/payroll/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setToast({ visible: true, type: 'error', message: error.error || 'Failed to process payroll' });
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
        return;
      }

      const data = await response.json();
      const summary = data.payroll || data.payrollRun || {};
      const totalEmployees = summary.employeeCount || summary.totalEmployees || 0;
      const totalGross = summary.totalGrossPay || 0;
      const totalNet = summary.totalNetPay || 0;

      setToast({
        visible: true,
        type: 'success',
        message: `Payroll processed. Employees: ${totalEmployees}, Gross: MWK ${Number(totalGross).toLocaleString()}, Net: MWK ${Number(totalNet).toLocaleString()}`
      });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);

      setShowProcessModal(false);
      fetchPayrollRuns();
    } catch (error) {
      console.error('Error processing payroll:', error);
      setToast({ visible: true, type: 'error', message: error.message || 'Failed to process payroll' });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-MW', { 
      style: 'currency', 
      currency: 'MWK',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const totalStats = {
    totalRuns: payrollRuns.length,
    totalEmployees: payrollRuns.reduce((sum, run) => sum + run.employees, 0),
    totalGross: payrollRuns.reduce((sum, run) => sum + run.totalGross, 0),
    totalNet: payrollRuns.reduce((sum, run) => sum + run.totalNet, 0)
  };

  return (
    <div className="p-6">
      {/* Toast */}
      {toast.visible && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-md shadow-lg px-4 py-3 border text-sm ${
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          {toast.message}
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payroll Processing</h1>
          <p className="text-gray-600">Process payroll with Malawi tax compliance (PAYE & NPS)</p>
        </div>
        <button
          onClick={() => setShowProcessModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Play size={20} />
          Process Payroll
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-blue-100 p-3 rounded-full mr-4">
            <Calendar size={20} className="text-blue-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{totalStats.totalRuns}</span>
            <span className="text-gray-600 text-sm">Payroll Runs</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-green-100 p-3 rounded-full mr-4">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{totalStats.totalEmployees}</span>
            <span className="text-gray-600 text-sm">Total Processed</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-yellow-100 p-3 rounded-full mr-4">
            <DollarSign size={20} className="text-yellow-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{formatCurrency(totalStats.totalGross)}</span>
            <span className="text-gray-600 text-sm">Total Gross</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-purple-100 p-3 rounded-full mr-4">
            <DollarSign size={20} className="text-purple-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{formatCurrency(totalStats.totalNet)}</span>
            <span className="text-gray-600 text-sm">Total Net Pay</span>
          </div>
        </div>
      </div>

      {/* Payroll Runs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employees</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Pay</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">PAYE</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">NPS</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payrollRuns.map((run, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatDate(run.paymentDate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{run.employees}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(run.totalGross)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(run.totalPAYE)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(run.totalNPS)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{formatCurrency(run.totalNet)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      {run.status || 'Processed'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <button className="text-blue-600 hover:text-blue-800" onClick={() => handleViewRun(run)}>
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {payrollRuns.length === 0 && !loading && (
          <div className="text-center py-12">
            <DollarSign size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No payroll runs found</h3>
            <p className="text-gray-600 mb-4">Get started by processing your first payroll</p>
            <button
              onClick={() => setShowProcessModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Process First Payroll
            </button>
          </div>
        )}
        
        {loading && (
          <div className="text-center py-12">
            <div className="h-10 w-10 border-4 border-t-blue-600 border-r-transparent border-l-transparent border-b-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payroll runs...</p>
          </div>
        )}
      </div>

      {/* Process Payroll Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Process Payroll</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period Start Date *</label>
                  <input
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period End Date *</label>
                  <input
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary Expense Account</label>
                  <select
                    value={formData.expenseAccountId || ''}
                    onChange={(e) => setFormData({ ...formData, expenseAccountId: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    disabled={accountsLoading || expenseAccountOptions.length === 0}
                  >
                    {accountsLoading && <option>Loading accounts...</option>}
                    {!accountsLoading && expenseAccountOptions.length === 0 && (
                      <option value="">No expense accounts available</option>
                    )}
                    {!accountsLoading && expenseAccountOptions.length > 0 && (
                      <>
                        <option value="">Select expense account</option>
                        {expenseAccountOptions.map((account) => (
                          <option key={account.id} value={account.id}>
                            {formatAccountOption(account)}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {accountsError && (
                    <p className="text-xs text-red-500 mt-1">Failed to load accounts: {accountsError}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cash / Bank Account for Net Pay</label>
                  <select
                    value={formData.paymentAccountId || ''}
                    onChange={(e) => setFormData({ ...formData, paymentAccountId: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    disabled={accountsLoading || paymentAccountOptions.length === 0}
                  >
                    {accountsLoading && <option>Loading accounts...</option>}
                    {!accountsLoading && paymentAccountOptions.length === 0 && (
                      <option value="">No cash/bank accounts available</option>
                    )}
                    {!accountsLoading && paymentAccountOptions.length > 0 && (
                      <>
                        <option value="">Select payment account</option>
                        {paymentAccountOptions.map((account) => (
                          <option key={account.id} value={account.id}>
                            {formatAccountOption(account)}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowProcessModal(false)}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessPayroll}
                  disabled={
                    processing ||
                    !formData.periodStart ||
                    !formData.periodEnd ||
                    !formData.paymentDate ||
                    !formData.expenseAccountId ||
                    !formData.paymentAccountId
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing && (
                    <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  {processing ? 'Processing...' : 'Process Payroll'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Payroll Modal */}
      {showViewModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Payroll Entries</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowViewModal(false)}>×</button>
              </div>
              {viewLoading ? (
                <div className="py-12 text-center text-gray-600">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gross</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">PAYE</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">NPS</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {viewEntries.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-gray-500" colSpan="7">No entries for this period.</td>
                        </tr>
                      ) : (
                        viewEntries.map(entry => (
                          <tr key={entry.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{entry.employee?.name || entry.employeeId}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(entry.grossPay)}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(entry.payeAmount)}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(entry.totalNpsAmount)}</td>
                            <td className="px-4 py-2 text-sm text-right">{formatCurrency(entry.netPay)}</td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs ${entry.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{entry.status}</span>
                            </td>
                            <td className="px-4 py-2 text-sm text-center">
                              {entry.status !== 'Draft' && (
                                <button onClick={() => markDraft(entry.id)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border">Mark Draft</button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
