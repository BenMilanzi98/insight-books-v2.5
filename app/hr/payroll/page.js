"use client";

import { useState, useEffect, useMemo } from "react";
import { DollarSign, Calendar, Play, Download, Eye, CheckCircle, AlertCircle, Edit, FileText, Trash2, Receipt, FileBarChart, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatSalaryAmount } from "@/lib/currencyUtils";
import { calculatePayroll } from "@/lib/payrollCalculations";
import { effectiveNpsRatePercentForPayroll } from "@/lib/npsTenantRates";
import { toYmdLocal, todayYmdLocal } from "@/lib/dateUtils";
import { filterCoaAccountsForPostingPicker } from "@/lib/journalAccountSelect";
import StatCard from "@/components/ui/StatCard";
import PosStylePageHeader, { PosStyleHeaderButton } from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';

export default function PayrollProcessing() {
  const router = useRouter();
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [runFilter, setRunFilter] = useState('active'); // all | active | reversed
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewEntries, setViewEntries] = useState([]);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [editFormData, setEditFormData] = useState({
    basicSalary: 0,
    deductions: {},
    additions: 0,
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [payrollToDelete, setPayrollToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newDeductionName, setNewDeductionName] = useState('');
  const [newDeductionAmount, setNewDeductionAmount] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(false);
  const [paymentAccountsError, setPaymentAccountsError] = useState(null);
  const [formData, setFormData] = useState({
    payrollMonth: new Date().getMonth() + 1, // Current month (1-12)
    payrollYear: new Date().getFullYear(), // Current year
    paymentDate: todayYmdLocal(),
    expenseAccountId: '',
    paymentAccountId: '',
    sendEmails: false // Option to send payslips via email
  });
  const [sendingEmails, setSendingEmails] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseLoading, setReverseLoading] = useState(false);
  const [reversePreflight, setReversePreflight] = useState(null);
  const [npsDisplayRates, setNpsDisplayRates] = useState({
    npsEmployeeRatePercent: null,
    npsEmployerRatePercent: null,
  });

  // Month names for the selector
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  useEffect(() => {
    fetchPayrollRuns();
    loadAccounts();
    loadPaymentAccounts();
    (async () => {
      try {
        const res = await fetch("/api/pension/settings");
        const data = await res.json();
        if (!res.ok) return;
        setNpsDisplayRates({
          npsEmployeeRatePercent: data.npsEmployeeRatePercent ?? null,
          npsEmployerRatePercent: data.npsEmployerRatePercent ?? null,
        });
      } catch {
        setNpsDisplayRates({ npsEmployeeRatePercent: null, npsEmployerRatePercent: null });
      }
    })();
  }, []);

  useEffect(() => {
    if (accountsLoading || accounts.length === 0) return;
    
    setFormData((prev) => {
      const updates = { ...prev };
      // Always set to 5200 - Salaries & Wages (fixed, cannot be changed)
      const defaultExpense = getDefaultExpenseAccount();
      if (defaultExpense) {
        updates.expenseAccountId = defaultExpense.id;
      }
      return updates;
    });
  }, [accounts, accountsLoading]);

  useEffect(() => {
    if (paymentAccountsLoading || paymentAccounts.length === 0) return;
    setFormData((prev) => {
      const updates = { ...prev };
      if (!prev.paymentAccountId) {
        const defaultPayment = getDefaultPaymentAccount();
        if (defaultPayment) updates.paymentAccountId = defaultPayment.id;
      }
      return updates;
    });
  }, [paymentAccounts, paymentAccountsLoading]);
  const loadAccounts = async () => {
    try {
      setAccountsLoading(true);
      setAccountsError(null);
      const response = await fetch('/api/categories?type=expense');
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load accounts');
      }
      const data = await response.json();
      const categories = Array.isArray(data.categories) ? data.categories : [];
      setAccounts(filterCoaAccountsForPostingPicker(categories).filter((account) => {
        const code = account.accountCode || account.code;
        return String(code || '').trim() === '5200';
      }));
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAccounts([]);
      setAccountsError(error.message || 'Failed to load accounts');
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadPaymentAccounts = async () => {
    try {
      setPaymentAccountsLoading(true);
      setPaymentAccountsError(null);
      const response = await fetch('/api/payment-accounts/balances', { cache: 'no-store' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load payment accounts');
      }
      const data = await response.json();
      setPaymentAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error loading payment accounts:', error);
      setPaymentAccounts([]);
      setPaymentAccountsError(error.message || 'Failed to load payment accounts');
    } finally {
      setPaymentAccountsLoading(false);
    }
  };

  const normalizeAccountType = (account) => {
    return (account?.accountType || account?.type || '').toUpperCase();
  };

  const expenseAccountOptions = useMemo(() => {
    return accounts.filter((account) => {
      const type = normalizeAccountType(account);
      if (type !== 'EXPENSE') return false;
      
      const code = account.accountCode || account.code;
      return String(code || '').trim() === '5200';
    });
  }, [accounts]);

  const paymentAccountOptions = useMemo(() => {
    // Payroll modal should show exactly what exists in `/payments/management` (PaymentAccount model).
    // Keep Cash first, then all other active payment accounts.
    const defaultCash = paymentAccounts.find((acc) => {
      const name = (acc.name || '').toString().toLowerCase().trim();
      return acc.isSystem || name === 'cash' || acc.accountType === 'Cash';
    });

    const rest = paymentAccounts.filter((acc) => !defaultCash || acc.id !== defaultCash.id);
    return defaultCash ? [defaultCash, ...rest] : rest;
  }, [paymentAccounts]);

  const getDefaultExpenseAccount = () => {
    return expenseAccountOptions.find((account) => {
      const code = account.accountCode || account.code;
      return String(code || '').trim() === '5200';
    }) || null;
  };

  const getDefaultPaymentAccount = () => {
    // Prefer system Cash account; otherwise first available option.
    const defaultCash = paymentAccountOptions.find((acc) => {
      const name = (acc.name || '').toString().toLowerCase().trim();
      return acc.isSystem || acc.accountType === 'Cash' || name === 'cash';
    });
    return defaultCash || paymentAccountOptions[0] || null;
  };

  const formatAccountOption = (account) => {
    if (!account) return 'Unnamed Account';
    const code = account.accountCode || account.code || account.reference || '';
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
        // IMPORTANT:
        // A period can have both Reversed and newly-created payroll entries.
        // Never merge those into one "run", otherwise totals (net pay, PAYE, NPS) get double-counted.
        const groupKind = payroll.status === 'Reversed' ? 'reversed' : 'active';
        const key = `${payroll.periodStart}-${payroll.periodEnd}-${groupKind}`;
        if (!grouped[key]) {
          grouped[key] = {
            periodStart: payroll.periodStart,
            periodEnd: payroll.periodEnd,
            paymentDate: payroll.paymentDate,
            groupKind,
            employees: 0,
            totalGross: 0,
            totalNet: 0,
            totalPAYE: 0,
            totalNPS: 0,
            _statuses: [],
          };
        }
        grouped[key].employees++;
        grouped[key].totalGross += parseFloat(payroll.grossPay || 0);
        grouped[key].totalNet += parseFloat(payroll.netPay || 0);
        grouped[key].totalPAYE += parseFloat(payroll.payeAmount || 0);
        grouped[key].totalNPS += parseFloat(payroll.totalNpsAmount || 0);
        grouped[key]._statuses.push(payroll.status || 'Pending');
      });

      const computeRunStatus = (statuses = []) => {
        const s = statuses.filter(Boolean);
        if (s.length > 0 && s.every(x => x === 'Reversed')) return 'Reversed';
        if (s.includes('Processed')) return 'Processed';
        if (s.includes('Posted')) return 'Posted';
        if (s.includes('Draft')) return 'Draft';
        if (s.includes('Pending')) return 'Pending';
        return s[0] || 'Pending';
      };
      
      setPayrollRuns(
        Object.values(grouped).map((run) => ({
          ...run,
          status: computeRunStatus(run._statuses),
        }))
      );
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
      const start = toYmdLocal(run.periodStart);
      const end = toYmdLocal(run.periodEnd);
      const res = await fetch(`/api/payroll?start=${start}&end=${end}`);
      const data = await res.json();
      if (res.ok) {
        const rows = data.payrolls || [];
        // Keep the entry list consistent with how the run totals were grouped.
        setViewEntries(
          run.groupKind === 'reversed'
            ? rows.filter((p) => p.status === 'Reversed')
            : rows.filter((p) => p.status !== 'Reversed')
        );
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

  const payrollStatusBadge = (status) => {
    if (status === 'Reversed') return 'bg-gray-200 text-gray-800';
    if (status === 'Draft') return 'bg-yellow-100 text-yellow-800';
    if (status === 'Posted') return 'bg-green-100 text-green-800';
    if (status === 'Processed') return 'bg-emerald-100 text-emerald-800';
    return 'bg-blue-100 text-blue-800';
  };

  const filteredRuns = useMemo(() => {
    if (runFilter === 'all') return payrollRuns;
    if (runFilter === 'reversed') return payrollRuns.filter(r => r.status === 'Reversed');
    // active
    return payrollRuns.filter(r => r.status !== 'Reversed');
  }, [payrollRuns, runFilter]);

  /** PAYE/NPS/custom on basic salary only; additions (benefits) added to net after deductions. */
  const editPayrollPreview = useMemo(() => {
    const basicSalary = Number(editFormData.basicSalary) || 0;
    const additions = Number(editFormData.additions) || 0;
    if (basicSalary <= 0) {
      return { netPay: 0 };
    }
    const custom = Object.entries(editFormData.deductions || {}).map(([name, value]) => ({
      name,
      type: 'fixed',
      value: Number(value) || 0,
    }));
    const calc = calculatePayroll(
      basicSalary,
      [
        { name: 'PAYE', isStatutory: true },
        { name: 'NPS', isStatutory: true },
        ...custom,
      ],
      {
        npsEmployeeRatePercent: npsDisplayRates.npsEmployeeRatePercent,
        npsEmployerRatePercent: npsDisplayRates.npsEmployerRatePercent,
      }
    );
    return { netPay: Math.max(0, calc.netPay + additions) };
  }, [
    editFormData.basicSalary,
    editFormData.additions,
    editFormData.deductions,
    npsDisplayRates.npsEmployeeRatePercent,
    npsDisplayRates.npsEmployerRatePercent,
  ]);

  const canReversePayrollEntry = (entry) => {
    if (!entry?.id) return false;
    if (entry.status === 'Reversed') return false;
    return true;
  };

  const openReversePayroll = async (entry) => {
    setReverseTarget(entry);
    setReverseReason('');
    setReversePreflight({ pending: true });
    setShowReverseModal(true);
    try {
      const res = await fetch(`/api/payroll/reverse?payrollId=${encodeURIComponent(entry.id)}`);
      const data = await res.json().catch(() => ({}));
      setReversePreflight({ ...data, pending: false });
    } catch {
      setReversePreflight({ eligible: false, error: 'Failed to check reversal eligibility', pending: false });
    }
  };

  const handleReverseSubmit = async () => {
    if (!reverseTarget) return;
    const reason = reverseReason.trim();
    if (reason.length < 10) {
      setToast({ visible: true, type: 'error', message: 'Reversal reason must be at least 10 characters.' });
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4000);
      return;
    }
    const target = reverseTarget;
    setReverseLoading(true);
    try {
      const res = await fetch('/api/payroll/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollId: target.id, reversalReason: reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Payroll reversal failed');
      setToast({
        visible: true,
        type: 'success',
        message:
          data.message ||
          (data.softCancelled
            ? 'Payroll marked reversed (no GL journal to reverse).'
            : 'Payroll reversed successfully. GL and balances have been updated.'),
      });
      setShowReverseModal(false);
      setReverseTarget(null);
      setReversePreflight(null);
      if (showViewModal) {
        const start = toYmdLocal(target.periodStart);
        const end = toYmdLocal(target.periodEnd);
        const r = await fetch(`/api/payroll?start=${start}&end=${end}`);
        const d = await r.json();
        if (r.ok) setViewEntries(d.payrolls || []);
      }
      fetchPayrollRuns();
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e.message || 'Payroll reversal failed' });
    } finally {
      setReverseLoading(false);
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
    }
  };

  const handleDeleteClick = (run) => {
    setPayrollToDelete(run);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!payrollToDelete) return;

    try {
      setIsDeleting(true);
      
      // Fetch all payroll entries for this period
      const start = toYmdLocal(payrollToDelete.periodStart);
      const end = toYmdLocal(payrollToDelete.periodEnd);
      const res = await fetch(`/api/payroll?start=${start}&end=${end}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch payroll entries');
      }

      const payrollEntries = data.payrolls || [];
      
      if (payrollEntries.length === 0) {
        setToast({ visible: true, type: 'error', message: 'No payroll entries found to remove' });
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
        setShowDeleteModal(false);
        setPayrollToDelete(null);
        return;
      }

      const ids = payrollEntries.map((e) => e.id).filter(Boolean);
      const removeRes = await fetch('/api/payroll/remove-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ids,
          reason: `Remove payroll run (${formatDate(payrollToDelete.periodStart)} – ${formatDate(payrollToDelete.periodEnd)})`,
        }),
      });
      const removeData = await removeRes.json().catch(() => ({}));

      if (!removeRes.ok) {
        throw new Error(removeData.error || 'Failed to remove payroll entries');
      }

      const cancelled = removeData.cancelled ?? 0;
      const blocked = Array.isArray(removeData.blocked) ? removeData.blocked : [];

      if (cancelled > 0 && blocked.length === 0) {
        setToast({
          visible: true,
          type: 'success',
          message: removeData.message || `Removed ${cancelled} payroll ${cancelled === 1 ? 'entry' : 'entries'}.`,
        });
        fetchPayrollRuns();
      } else if (cancelled > 0 && blocked.length > 0) {
        setToast({
          visible: true,
          type: 'error',
          message: `${removeData.message || `Removed ${cancelled}.`} First issue: ${blocked[0]?.reason || 'see blocked list'}.`,
        });
        fetchPayrollRuns();
      } else {
        const skippedReversed = removeData.skippedReversed ?? 0;
        if (blocked.length > 0) {
          setToast({
            visible: true,
            type: 'error',
            message:
              blocked[0]?.reason ||
              removeData.message ||
              'No entries could be processed. Check blocked reasons or try again.',
          });
        } else if (skippedReversed > 0) {
          setToast({
            visible: true,
            type: 'success',
            message: `Nothing to do — ${skippedReversed} ${skippedReversed === 1 ? 'entry was' : 'entries were'} already reversed.`,
          });
          fetchPayrollRuns();
        } else {
          setToast({
            visible: true,
            type: 'error',
            message:
              removeData.message ||
              'No entries could be processed. Check blocked reasons or try again.',
          });
        }
      }

      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
      setShowDeleteModal(false);
      setPayrollToDelete(null);
    } catch (error) {
      console.error('Error removing payroll run:', error);
      setToast({
        visible: true,
        type: 'error',
        message: error.message || 'Failed to remove payroll run',
      });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditPayroll = async (entry) => {
    try {
      if (!entry || !entry.id) {
        throw new Error('Invalid payroll entry');
      }

      let additionalInfo = {};
      try {
        if (entry.notes && typeof entry.notes === 'string') {
          // Try to parse as JSON only if it looks like JSON
          const trimmedNotes = entry.notes.trim();
          if (trimmedNotes.startsWith('{') && trimmedNotes.endsWith('}')) {
            additionalInfo = JSON.parse(entry.notes);
          }
        }
      } catch (e) {
        // If notes is not valid JSON, use empty object
        console.warn('Could not parse notes as JSON:', e);
        additionalInfo = {};
      }

      setEditingPayroll(entry);
      setEditFormData({
        basicSalary: Number(entry.basicSalary) || 0,
        deductions: (additionalInfo.otherDeductions && typeof additionalInfo.otherDeductions === 'object' && !Array.isArray(additionalInfo.otherDeductions)) 
          ? additionalInfo.otherDeductions 
          : {},
        additions: Number(entry.additions) || 0,
        notes: (typeof entry.notes === 'string' && !entry.notes.trim().startsWith('{')) 
          ? entry.notes 
          : (additionalInfo.notes || '')
      });
      setShowEditModal(true);
      // Reset new deduction form
      setNewDeductionName('');
      setNewDeductionAmount('');
    } catch (error) {
      console.error('Error preparing edit:', error);
      setToast({ 
        visible: true, 
        type: 'error', 
        message: error.message || 'Failed to load payroll for editing' 
      });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
    }
  };

  const handleAddDeduction = () => {
    try {
      const trimmedName = newDeductionName.trim();
      const amount = parseFloat(newDeductionAmount);

      if (!trimmedName) {
        setToast({ visible: true, type: 'error', message: 'Please enter a deduction name' });
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
        return;
      }

      if (isNaN(amount) || amount <= 0) {
        setToast({ visible: true, type: 'error', message: 'Please enter a valid amount greater than 0' });
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
        return;
      }

      if (editFormData.deductions[trimmedName] !== undefined) {
        setToast({ visible: true, type: 'error', message: 'A deduction with this name already exists' });
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
        return;
      }

      const newDeductions = { ...editFormData.deductions, [trimmedName]: amount };
      setEditFormData({ ...editFormData, deductions: newDeductions });
      
      // Clear the form
      setNewDeductionName('');
      setNewDeductionAmount('');
    } catch (error) {
      console.error('Error adding deduction:', error);
      setToast({ visible: true, type: 'error', message: 'Failed to add deduction' });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPayroll) return;

    try {
      setIsSaving(true);
      const baseGross = Number(editFormData.basicSalary) || 0;
      const additions = Number(editFormData.additions) || 0;

      const response = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grossSalary: baseGross,
          deductionIds: [],
          customDeductions: [
            { name: 'PAYE', isStatutory: true },
            { name: 'NPS', isStatutory: true },
            ...Object.entries(editFormData.deductions).map(([name, value]) => ({
              name,
              type: 'fixed',
              value: Number(value) || 0,
            })),
          ],
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to recalculate payroll');
      }

      const data = await response.json();
      const calculation = data.calculation;
      
      const calculatedGrossPay = calculation.grossSalary ?? baseGross;
      const calculatedDeductions = calculation.totalDeductions ?? 0;
      const calculatedNetPay = Math.max(
        0,
        (calculation.netPay ?? 0) + additions
      );
      
      const updateResponse = await fetch(`/api/payroll/${editingPayroll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basicSalary: editFormData.basicSalary,
          grossPay: calculatedGrossPay,
          deductions: calculatedDeductions,
          additions: editFormData.additions || 0,
          netPay: calculatedNetPay,
          payeAmount: calculation.paye?.payeAmount || 0,
          notes: JSON.stringify({
            otherDeductions: editFormData.deductions,
            notes: editFormData.notes
          })
        })
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update payroll');
      }

      setToast({ visible: true, type: 'success', message: 'Payroll updated successfully' });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
      
      // Store periodStart before clearing editingPayroll
      const periodStartToRefresh = editingPayroll?.periodStart;
      
      setShowEditModal(false);
      setEditingPayroll(null);
      
      // Refresh payroll runs
      await fetchPayrollRuns();
      
      // If view modal is open, refresh it after a short delay to allow state to update
      if (showViewModal && periodStartToRefresh) {
        setTimeout(async () => {
          try {
            const response = await fetch('/api/payroll');
            const data = await response.json();
            const updatedRuns = (data.payrolls || []).reduce((grouped, payroll) => {
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
              return grouped;
            }, {});
            
            const run = Object.values(updatedRuns).find(r => 
              toYmdLocal(r.periodStart) === toYmdLocal(periodStartToRefresh)
            );
            if (run) {
              await handleViewRun(run);
            }
          } catch (err) {
            console.error('Error refreshing view after edit:', err);
          }
        }, 200);
      }
    } catch (error) {
      console.error('Error saving payroll edit:', error);
      setToast({ visible: true, type: 'error', message: error.message || 'Failed to update payroll' });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePayslip = async (payrollId) => {
    try {
      const response = await fetch(`/api/payroll/${payrollId}/payslip`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to generate payslip');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${payrollId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setToast({ visible: true, type: 'success', message: 'Payslip generated successfully' });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
    } catch (error) {
      console.error('Error generating payslip:', error);
      setToast({ visible: true, type: 'error', message: error.message || 'Failed to generate payslip' });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
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
      
      // Calculate period start and end dates from selected month/year
      const periodStart = new Date(formData.payrollYear, formData.payrollMonth - 1, 1);
      const periodEnd = new Date(formData.payrollYear, formData.payrollMonth, 0); // Last day of the month
      
      const payload = {
        ...formData,
        periodStart: toYmdLocal(periodStart),
        periodEnd: toYmdLocal(periodEnd),
      };
      
      const response = await fetch('/api/payroll/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

      // Send payslips via email if enabled
      if (formData.sendEmails) {
        try {
          setSendingEmails(true);
          const emailResponse = await fetch('/api/payroll/send-payslips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              periodStart: payload.periodStart,
              periodEnd: payload.periodEnd
            })
          });

          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            setToast({
              visible: true,
              type: 'success',
              message: `Payroll processed. Employees: ${totalEmployees}, Gross: MWK ${Number(totalGross).toLocaleString()}, Net: MWK ${Number(totalNet).toLocaleString()}. Payslips sent: ${emailData.emailsSent || 0}, Skipped: ${emailData.skipped || 0}`
            });
          } else {
            const emailError = await emailResponse.json().catch(() => ({}));
            setToast({
              visible: true,
              type: 'warning',
              message: `Payroll processed but email sending failed: ${emailError.error || 'Unknown error'}`
            });
          }
        } catch (emailError) {
          console.error('Error sending payslip emails:', emailError);
          setToast({
            visible: true,
            type: 'warning',
            message: `Payroll processed but email sending failed: ${emailError.message || 'Unknown error'}`
          });
        } finally {
          setSendingEmails(false);
        }
      } else {
        setToast({
          visible: true,
          type: 'success',
          message: `Payroll processed. Employees: ${totalEmployees}, Gross: MWK ${Number(totalGross).toLocaleString()}, Net: MWK ${Number(totalNet).toLocaleString()}`
        });
      }
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 6000);

      setShowProcessModal(false);
      fetchPayrollRuns();
      router.refresh();
    } catch (error) {
      console.error('Error processing payroll:', error);
      setToast({ visible: true, type: 'error', message: error.message || 'Failed to process payroll' });
      setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => formatSalaryAmount(amount || 0);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const totalStats = {
    totalRuns: filteredRuns.length,
    totalEmployees: filteredRuns.reduce((sum, run) => sum + run.employees, 0),
    totalGross: filteredRuns.reduce((sum, run) => sum + run.totalGross, 0),
    totalNet: filteredRuns.reduce((sum, run) => sum + run.totalNet, 0)
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
      <PosStylePageHeader
        title="Payroll Processing"
        description="Process payroll with Malawi tax compliance (PAYE & NPS)"
        actions={
          <>
            <PosStyleHeaderButton as={Link} href="/hr/payroll/paye-summary">
              <FileBarChart size={20} className="mr-2" />
              PAYE Summary
            </PosStyleHeaderButton>
            <button
              onClick={async () => {
                await loadAccounts();
                await loadPaymentAccounts();
                setShowProcessModal(true);
              }}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800 hover:shadow-md"
            >
              <Play size={20} className="mr-2" />
              Process Payroll
            </button>
          </>
        }
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Payroll Runs"
          value={totalStats.totalRuns}
          icon={Calendar}
          barClassName="from-blue-400 via-sky-500 to-blue-600"
          iconWrapClassName="bg-blue-100 text-blue-600"
        />
        <StatCard
          label="Total Processed"
          value={totalStats.totalEmployees}
          icon={CheckCircle}
          barClassName="from-emerald-400 via-green-500 to-teal-500"
          iconWrapClassName="bg-green-100 text-green-600"
        />
        <StatCard
          label="Total Gross"
          value={formatCurrency(totalStats.totalGross)}
          icon={DollarSign}
          barClassName="from-amber-400 via-yellow-500 to-orange-500"
          iconWrapClassName="bg-yellow-100 text-yellow-600"
        />
        <StatCard
          label="Total Net Pay"
          value={formatCurrency(totalStats.totalNet)}
          icon={DollarSign}
          barClassName="from-blue-500 via-sky-500 to-indigo-500"
          iconWrapClassName="bg-blue-100 text-blue-600"
        />
      </div>

      {/* Payroll Runs Table */}
      <PosStylePanel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b bg-white">
          <div className="text-sm font-medium text-gray-700">Runs</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRunFilter('active')}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                runFilter === 'active'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setRunFilter('reversed')}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                runFilter === 'reversed'
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Reversed
            </button>
            <button
              type="button"
              onClick={() => setRunFilter('all')}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                runFilter === 'all'
                  ? 'bg-white text-gray-900 border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
          </div>
        </div>
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
              {filteredRuns.map((run, index) => (
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
                    <span className={`px-2 py-1 rounded-full text-xs ${payrollStatusBadge(run.status)}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        className="text-blue-600 hover:text-blue-800" 
                        onClick={() => handleViewRun(run)}
                        title="View Payroll"
                      >
                        <Eye size={18} />
                      </button>
                      {run.status !== 'Reversed' && (
                        <button 
                          className="text-red-600 hover:text-red-800" 
                          onClick={() => handleDeleteClick(run)}
                          title="Remove payroll run (unposted rows only)"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredRuns.length === 0 && !loading && (
          <div className="text-center py-12">
            <DollarSign size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No payroll runs found</h3>
            <p className="text-gray-600 mb-4">Get started by processing your first payroll</p>
            <button
              onClick={async () => {
                await loadAccounts();
                await loadPaymentAccounts();
                setShowProcessModal(true);
              }}
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
      </PosStylePanel>

      {/* Process Payroll Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Process Payroll</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Month *</label>
                    <select
                      value={formData.payrollMonth}
                      onChange={(e) => setFormData({ ...formData, payrollMonth: parseInt(e.target.value) })}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                      required
                    >
                      {months.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                    <select
                      value={formData.payrollYear}
                      onChange={(e) => setFormData({ ...formData, payrollYear: parseInt(e.target.value) })}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() - 2 + i;
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </select>
                  </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary Cost Account</label>
                  {accountsLoading ? (
                    <div className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                      Loading accounts...
                    </div>
                  ) : formData.expenseAccountId ? (
                    <div className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                      {(() => {
                        const selectedAccount = accounts.find(acc => acc.id === formData.expenseAccountId);
                        return selectedAccount ? formatAccountOption(selectedAccount) : '5200 - Salaries & Wages';
                      })()}
                    </div>
                  ) : (
                    <div className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                      5200 - Salaries & Wages (required)
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Payroll salary cost is always posted to 5200 - Salaries & Wages.
                  </p>
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
                    disabled={paymentAccountsLoading || paymentAccountOptions.length === 0}
                  >
                    {paymentAccountsLoading && <option>Loading payment accounts...</option>}
                    {!paymentAccountsLoading && paymentAccountOptions.length === 0 && (
                      <option value="">No cash/bank accounts available</option>
                    )}
                    {!paymentAccountsLoading && paymentAccountOptions.length > 0 && (
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
                  {paymentAccountsError && (
                    <p className="text-xs text-red-500 mt-1">Failed to load payment accounts: {paymentAccountsError}</p>
                  )}
                </div>

                {/* Send Email Option */}
                <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="sendEmails"
                    checked={formData.sendEmails}
                    onChange={(e) => setFormData({ ...formData, sendEmails: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="sendEmails" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Send payslips via email to employees
                  </label>
                </div>
                {formData.sendEmails && (
                  <p className="text-xs text-gray-500 ml-7 -mt-2">
                    Payslips will be sent as PDF attachments. Employees without email addresses will be skipped.
                  </p>
                )}
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
                    !formData.payrollMonth ||
                    !formData.payrollYear ||
                    !formData.paymentDate ||
                    !formData.expenseAccountId ||
                    !formData.paymentAccountId
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(processing || sendingEmails) && (
                    <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  {sendingEmails ? 'Sending Emails...' : processing ? 'Processing...' : 'Process Payroll'}
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
                              <span className={`px-2 py-1 rounded-full text-xs ${payrollStatusBadge(entry.status)}`}>{entry.status}</span>
                            </td>
                            <td className="px-4 py-2 text-sm text-center">
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                {canReversePayrollEntry(entry) && (
                                  <button
                                    type="button"
                                    onClick={() => openReversePayroll(entry)}
                                    className="px-2 py-1 text-xs bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 text-amber-900 flex items-center gap-1"
                                    title="Reverse posted journal or mark unposted payroll reversed (requires reason)"
                                  >
                                    <Undo2 size={14} />
                                    Reverse / remove
                                  </button>
                                )}
                                {entry.status === 'Draft' && (
                                  <button 
                                    onClick={() => handleEditPayroll(entry)} 
                                    className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded border text-blue-700 flex items-center gap-1"
                                    title="Edit Payroll"
                                  >
                                    <Edit size={14} />
                                    Edit
                                  </button>
                                )}
                                {(entry.status === 'Processed' || entry.status === 'Posted') && (
                                  <button 
                                    onClick={() => handleGeneratePayslip(entry.id)} 
                                    className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 rounded-md text-white flex items-center gap-1.5 shadow-sm transition-colors"
                                    title="Generate Payslip"
                                  >
                                    <Receipt size={14} />
                                    Payslip
                                  </button>
                                )}
                                {entry.status === 'Processed' && (
                                  <button 
                                    onClick={() => markDraft(entry.id)} 
                                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
                                    title="Mark as Draft"
                                  >
                                    Draft
                                  </button>
                                )}
                                {entry.status !== 'Draft' && entry.status !== 'Processed' && entry.status !== 'Posted' && entry.status !== 'Reversed' && (
                                  <button type="button" onClick={() => markDraft(entry.id)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border">Mark Draft</button>
                                )}
                              </div>
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

      {/* Reverse payroll (GL + side effects) */}
      {showReverseModal && reverseTarget && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={() => !reverseLoading && setShowReverseModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Reverse or remove payroll</h2>
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-700"
                  disabled={reverseLoading}
                  onClick={() => setShowReverseModal(false)}
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">{reverseTarget.employee?.name || 'Employee'}</span>
                {' · '}
                {reversePreflight?.reversalMode === 'mark_reversed'
                  ? (reversePreflight?.message ||
                    'This row has no posted payroll journal. Submitting records a reversal reason and marks the payroll Reversed for audit (no offsetting GL).')
                  : 'When a journal is posted, this reverses it (salary expense, PAYE, liabilities, net pay/cash, etc.) and restores related balances.'}
              </p>
              {reversePreflight?.pending && (
                <div className="mb-4 text-sm text-gray-600">Checking eligibility…</div>
              )}
              {reversePreflight && !reversePreflight.pending && !reversePreflight.eligible && (
                <div className="mb-4 p-3 rounded-md bg-red-50 text-red-800 text-sm border border-red-200">
                  {reversePreflight.error || 'This payroll cannot be reversed.'}
                </div>
              )}
              {reversePreflight?.eligible && !reversePreflight?.pending && (
                <div className="mb-4 p-3 rounded-md bg-amber-50 text-amber-900 text-sm border border-amber-200">
                  {reversePreflight.reversalMode === 'mark_reversed'
                    ? 'You are cancelling this payroll row in the books of record: status becomes Reversed and your reason is stored; there is no GL journal to post against.'
                    : 'This action posts offsetting journal entries. It cannot be undone from this screen. The accounting period for the payroll date must be open.'}
                </div>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-1">Reversal reason (min. 10 characters)</label>
              <textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                disabled={reverseLoading || reversePreflight?.pending || !(reversePreflight?.eligible)}
                rows={4}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Incorrect overtime hours for this period — reversing to re-run payroll."
              />
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  disabled={reverseLoading}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReverseSubmit}
                  disabled={
                    reverseLoading ||
                    reversePreflight?.pending ||
                    !(reversePreflight?.eligible) ||
                    reverseReason.trim().length < 10
                  }
                  className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {reverseLoading && (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {reversePreflight?.pending
                    ? 'Confirm'
                    : reversePreflight?.reversalMode === 'mark_reversed'
                      ? 'Mark reversed'
                      : 'Confirm GL reversal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payroll Modal */}
      {showEditModal && editingPayroll && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => !isSaving && setShowEditModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Edit Payroll - {editingPayroll.employee?.name || 'Employee'}</h2>
                <button 
                  className="text-gray-500 hover:text-gray-700" 
                  onClick={() => !isSaving && setShowEditModal(false)}
                  disabled={isSaving}
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary (MWK) *</label>
                  <input
                    type="number"
                    value={editFormData.basicSalary}
                    onChange={(e) => setEditFormData({ ...editFormData, basicSalary: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additions (MWK)</label>
                  <input
                    type="number"
                    value={editFormData.additions}
                    onChange={(e) => setEditFormData({ ...editFormData, additions: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Other Deductions</label>
                  
                  {/* Add New Deduction Form */}
                  <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Deduction name (e.g., Loan, Advance)"
                        value={newDeductionName}
                        onChange={(e) => setNewDeductionName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isSaving}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDeduction();
                          }
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                        value={newDeductionAmount}
                        onChange={(e) => setNewDeductionAmount(e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isSaving}
                        min="0"
                        step="0.01"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDeduction();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddDeduction}
                        disabled={isSaving || !newDeductionName.trim() || !newDeductionAmount || parseFloat(newDeductionAmount) <= 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Existing Deductions List */}
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {Object.keys(editFormData.deductions).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No other deductions added yet</p>
                    ) : (
                      Object.entries(editFormData.deductions).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                          <span className="text-sm font-medium text-gray-700">{key}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">MWK</span>
                            <input
                              type="number"
                              value={value}
                              onChange={(e) => {
                                const newDeductions = { ...editFormData.deductions };
                                newDeductions[key] = parseFloat(e.target.value) || 0;
                                setEditFormData({ ...editFormData, deductions: newDeductions });
                              }}
                              className="w-32 p-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={isSaving}
                              min="0"
                              step="0.01"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newDeductions = { ...editFormData.deductions };
                                delete newDeductions[key];
                                setEditFormData({ ...editFormData, deductions: newDeductions });
                              }}
                              disabled={isSaving}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 text-lg font-bold px-2 py-1 rounded disabled:opacity-50 transition-colors"
                              title="Remove deduction"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    disabled={isSaving}
                  />
                </div>

                {/* Calculation Preview */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Calculation Preview</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Basic Salary:</span>
                      <span className="font-medium">MWK {editFormData.basicSalary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Additions (benefits, after tax):</span>
                      <span className="font-medium text-green-600">+ MWK {(editFormData.additions || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-700 font-medium">Gross salary (PAYE / NPS base):</span>
                      <span className="font-bold text-blue-600">MWK {editFormData.basicSalary.toLocaleString()}</span>
                    </div>
                    <div className="pt-2 space-y-1">
                      <div className="text-xs text-gray-500 font-medium mb-1">Deductions (will be calculated):</div>
                      <div className="text-xs text-gray-500 pl-2">
                        • PAYE (on gross salary after employee NPS / pension)
                      </div>
                      <div className="text-xs text-gray-500 pl-2">
                        • NPS Employee:{" "}
                        {effectiveNpsRatePercentForPayroll(
                          npsDisplayRates.npsEmployeeRatePercent,
                          true,
                        )}
                        % of gross salary (HR → Pension; statutory 5% when unset)
                      </div>
                      {Object.keys(editFormData.deductions || {}).length > 0 && (
                        <>
                          {Object.entries(editFormData.deductions || {}).map(([name, value]) => (
                            <div key={name} className="text-xs text-gray-500 pl-2">
                              • {name}: MWK {Number(value || 0).toLocaleString()}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="text-gray-700 font-medium">Net Pay:</span>
                      <span className="font-bold text-green-600">MWK {Math.max(0, editPayrollPreview.netPay).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 italic">
                      * Final calculation will be done when you save
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editFormData.basicSalary}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving && (
                    <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove payroll run confirmation */}
      {showDeleteModal && payrollToDelete && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-red-600">Remove payroll run</h2>
                <button 
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  disabled={isDeleting}
                >
                  ×
                </button>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Reverse or cancel every payroll row in this period in one step: rows without a posted journal are
                  marked <strong>Reversed</strong> (audited); rows with a posted payroll journal get a full GL reversal
                  (same as the dedicated payroll reversal flow).
                </p>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600">
                    <strong>Period:</strong> {formatDate(payrollToDelete.periodStart)} - {formatDate(payrollToDelete.periodEnd)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Employees:</strong> {payrollToDelete.employees}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Total Net Pay:</strong> {formatCurrency(payrollToDelete.totalNet)}
                  </p>
                </div>
                <p className="text-sm text-amber-700 mt-4 font-medium">
                  If a row cannot be processed (for example duplicate journals or a locked accounting period), you will
                  see a specific error for that employee after the run completes.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting && (
                    <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  {isDeleting ? 'Removing...' : 'Remove run'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
