"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Filter, X, Edit, Trash2, CheckCircle, AlertTriangle } from "lucide-react";

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalPages: 1, totalCount: 0 });

  const [filters, setFilters] = useState({
    search: "",
    fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    employeeId: "",
    department: "All"
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterEmployees, setRosterEmployees] = useState([]);
  const [rosterSearch, setRosterSearch] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: "",
    date: new Date().toISOString().split('T')[0],
    hoursWorked: 0,
    overtimeHours: 0,
    status: 'Present',
    notes: ''
  });

  const [absentForm, setAbsentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    employeeIdsText: '',
    reason: ''
  });
  const [finalizeInfo, setFinalizeInfo] = useState(null);
  const [finalizeList, setFinalizeList] = useState([]);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [finalizePagination, setFinalizePagination] = useState({ page: 1, limit: 10, totalPages: 1, totalCount: 0 });
  const [finalizeFilters, setFinalizeFilters] = useState({
    quick: 'this_month',
    year: '',
    month: '',
    fromDate: '',
    toDate: ''
  });

  const filteredRoster = useMemo(() => {
    if (!rosterSearch) return rosterEmployees;
    const q = rosterSearch.toLowerCase();
    return rosterEmployees.filter(e =>
      e.name?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q)
    );
  }, [rosterEmployees, rosterSearch]);

  async function openProcessAttendance() {
    try {
      setRosterLoading(true);
      setShowProcessModal(true);
      
      // Load employees and their attendance for the selected date
      const [employeesRes, attendanceRes] = await Promise.all([
        fetch('/api/employees'),
        fetch(`/api/attendance?fromDate=${absentForm.date}&toDate=${absentForm.date}`)
      ]);
      
      const employeesData = await employeesRes.json();
      const attendanceData = await attendanceRes.json();
      
      const emps = (employeesData.employees || []).map(e => ({ 
        id: e.id, 
        name: e.name, 
        employeeId: e.employeeId, 
        department: e.department 
      }));
      
      // Create a map of attendance records for this date
      const attendanceMap = new Map();
      (attendanceData.attendance || []).forEach(record => {
        attendanceMap.set(record.employeeId, record);
      });
      
      // Add attendance status to each employee
      const empsWithStatus = emps.map(emp => {
        const attendance = attendanceMap.get(emp.id);
        return {
          ...emp,
          attendanceStatus: attendance ? attendance.status : 'Absent',
          hoursWorked: attendance ? attendance.hoursWorked : 0,
          overtimeHours: attendance ? attendance.overtimeHours : 0,
          notes: attendance ? attendance.notes : ''
        };
      });
      
      setRosterEmployees(empsWithStatus);
      
      // Load finalize status
      const statusRes = await fetch(`/api/attendance/finalize/status?date=${absentForm.date}`);
      const statusData = await statusRes.json();
      if (statusRes.ok && statusData.finalized) setFinalizeInfo(statusData); else setFinalizeInfo(null);
    } catch (e) {
      showToast('error', 'Failed to load employees');
      setShowProcessModal(false);
    } finally {
      setRosterLoading(false);
    }
  }

  // Load finalized registers
  useEffect(() => {
    loadFinalized();
  }, [finalizePagination.page, finalizeFilters.quick, finalizeFilters.year, finalizeFilters.month, finalizeFilters.fromDate, finalizeFilters.toDate]);

  async function loadFinalized() {
    try {
      setFinalizeLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(finalizePagination.page));
      params.set('limit', String(finalizePagination.limit));
      // Quick presets
      const now = new Date();
      if (finalizeFilters.quick === 'today') {
        const d = now.toISOString().slice(0,10);
        params.set('fromDate', d);
        params.set('toDate', d);
      } else if (finalizeFilters.quick === 'this_month') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
        const last = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
        params.set('fromDate', first);
        params.set('toDate', last);
      } else if (finalizeFilters.quick === 'this_year') {
        params.set('year', String(now.getFullYear()));
      }
      // Specific filters override presets
      if (finalizeFilters.year && !finalizeFilters.month && !finalizeFilters.fromDate && !finalizeFilters.toDate) {
        params.set('year', finalizeFilters.year);
      }
      if (finalizeFilters.year && finalizeFilters.month) {
        params.set('year', finalizeFilters.year);
        params.set('month', finalizeFilters.month);
      }
      if (finalizeFilters.fromDate) params.set('fromDate', finalizeFilters.fromDate);
      if (finalizeFilters.toDate) params.set('toDate', finalizeFilters.toDate);

      const res = await fetch(`/api/attendance/report/list?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load attendance report');
      setFinalizeList(data.registries || []);
      setFinalizePagination(p => ({ ...p, totalPages: data.pagination?.totalPages || 1, totalCount: data.pagination?.totalCount || 0 }));
    } catch (e) {
      showToast('error', e.message || 'Failed to load finalized');
    } finally {
      setFinalizeLoading(false);
    }
  }

  const departments = useMemo(() => {
    const set = new Set((records || []).map(r => r.employee?.department).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [records]);

  useEffect(() => {
    loadAttendance();
  }, [pagination.page, filters.fromDate, filters.toDate, filters.employeeId, filters.department]);

  const showToast = (type, message) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
  };

  async function loadAttendance() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('fromDate', filters.fromDate);
      params.set('toDate', filters.toDate);
      if (filters.employeeId) params.set('employeeId', filters.employeeId);
      if (filters.department && filters.department !== 'All') params.set('department', filters.department);
      params.set('page', String(pagination.page));
      params.set('limit', String(pagination.limit));

      const res = await fetch(`/api/attendance?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load attendance');

      setRecords(data.attendance || []);
      const pg = data.pagination || { page: 1, limit: 20, totalPages: 1, totalCount: (data.attendance || []).length };
      setPagination(prev => ({ ...prev, ...pg }));
    } catch (e) {
      console.error('Attendance load error:', e);
      setError(e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = useMemo(() => {
    if (!filters.search) return records;
    const q = filters.search.toLowerCase();
    return records.filter(r =>
      r.employee?.name?.toLowerCase().includes(q) ||
      r.employee?.employeeId?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  }, [records, filters.search]);

  const openCreate = () => {
    setEditingRecord(null);
    setFormData({ employeeId: "", date: new Date().toISOString().split('T')[0], hoursWorked: 0, overtimeHours: 0, status: 'Present', notes: '' });
    setIsFormOpen(true);
  };

  const openEdit = (rec) => {
    setEditingRecord(rec);
    setFormData({
      employeeId: rec.employeeId,
      date: rec.date ? new Date(rec.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      hoursWorked: rec.hoursWorked ?? 0,
      overtimeHours: rec.overtimeHours ?? 0,
      status: rec.status || 'Present',
      notes: rec.notes || ''
    });
    setIsFormOpen(true);
  };

  const saveRecord = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, hoursWorked: Number(formData.hoursWorked || 0), overtimeHours: Number(formData.overtimeHours || 0) };
      const res = await fetch(editingRecord ? `/api/attendance/${editingRecord.id}` : '/api/attendance', {
        method: editingRecord ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setIsFormOpen(false);
      showToast('success', editingRecord ? 'Attendance updated' : 'Attendance created');
      setPagination(p => ({ ...p, page: 1 }));
      await loadAttendance();
    } catch (e2) {
      console.error('Save error:', e2);
      showToast('error', e2.message || 'Failed to save');
    }
  };

  const deleteRecord = async (rec) => {
    if (!confirm('Delete this attendance record?')) return;
    try {
      const res = await fetch(`/api/attendance/${rec.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      showToast('success', 'Attendance deleted');
      await loadAttendance();
    } catch (e) {
      console.error('Delete error:', e);
      showToast('error', e.message || 'Failed to delete');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="p-6">
      {toast.visible && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-md shadow-lg px-4 py-3 border text-sm ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-gray-600">Track employee attendance and hours</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700" onClick={openProcessAttendance}>
          <span>Process Attendance</span>
        </button>
      </div>

      

      {/* Finalized Registers Section */}
      <div className="mt-8 bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Finalized Registers</h2>
            <p className="text-sm text-gray-600">Attendance registers you have finalized</p>
          </div>
        </div>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Quick</label>
            <select
              value={finalizeFilters.quick}
              onChange={(e) => { setFinalizeFilters({ ...finalizeFilters, quick: e.target.value }); setFinalizePagination(p => ({ ...p, page: 1 })); }}
              className="w-full p-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="today">Today</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Year</label>
            <input type="number" placeholder="YYYY" value={finalizeFilters.year} onChange={(e) => { setFinalizeFilters({ ...finalizeFilters, year: e.target.value }); setFinalizePagination(p => ({ ...p, page: 1 })); }} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Month</label>
            <select value={finalizeFilters.month} onChange={(e) => { setFinalizeFilters({ ...finalizeFilters, month: e.target.value }); setFinalizePagination(p => ({ ...p, page: 1 })); }} className="w-full p-2 border border-gray-300 rounded-md bg-white">
              <option value="">--</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i+1} value={String(i+1)}>{String(i+1).padStart(2,'0')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input type="date" value={finalizeFilters.fromDate} onChange={(e) => { setFinalizeFilters({ ...finalizeFilters, fromDate: e.target.value }); setFinalizePagination(p => ({ ...p, page: 1 })); }} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input type="date" value={finalizeFilters.toDate} onChange={(e) => { setFinalizeFilters({ ...finalizeFilters, toDate: e.target.value }); setFinalizePagination(p => ({ ...p, page: 1 })); }} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Present</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Absent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {finalizeLoading ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-600">Loading...</td></tr>
              ) : finalizeList.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                  <div className="space-y-2">
                    <div>No finalized registers found</div>
                    <div className="text-xs text-gray-400">
                      Try changing the filter above (Today, This Month, This Year, or Custom date range)
                    </div>
                  </div>
                </td></tr>
              ) : (
                finalizeList.map((r, idx) => (
                  <tr key={`${r.date}-${idx}`}>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.date}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{r.present}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{r.absent}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{r.total}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
                        onClick={async () => {
                          const d = r.date;
                          setAbsentForm(prev => ({ ...prev, date: d }));
                          
                          // Load attendance data for this date
                          try {
                            const [employeesRes, attendanceRes] = await Promise.all([
                              fetch('/api/employees'),
                              fetch(`/api/attendance?fromDate=${d}&toDate=${d}`)
                            ]);
                            
                            const employeesData = await employeesRes.json();
                            const attendanceData = await attendanceRes.json();
                            
                            const emps = (employeesData.employees || []).map(e => ({ 
                              id: e.id, 
                              name: e.name, 
                              employeeId: e.employeeId, 
                              department: e.department 
                            }));
                            
                            const attendanceMap = new Map();
                            (attendanceData.attendance || []).forEach(record => {
                              attendanceMap.set(record.employeeId, record);
                            });
                            
                            const empsWithStatus = emps.map(emp => {
                              const attendance = attendanceMap.get(emp.id);
                              return {
                                ...emp,
                                attendanceStatus: attendance ? attendance.status : 'Absent',
                                hoursWorked: attendance ? attendance.hoursWorked : 0,
                                overtimeHours: attendance ? attendance.overtimeHours : 0,
                                notes: attendance ? attendance.notes : ''
                              };
                            });
                            
                            setRosterEmployees(empsWithStatus);
                            
                            // Set finalized info
                            setFinalizeInfo({ finalized: true, date: d, present: r.present, absent: r.absent, total: r.total });
                            setShowViewModal(true);
                          } catch (error) {
                            console.error('Error loading attendance data:', error);
                            showToast('error', 'Failed to load attendance data');
                          }
                        }}
                        title="View register"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
          <div>Page {finalizePagination.page} of {finalizePagination.totalPages} • {finalizePagination.totalCount} records</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={finalizePagination.page <= 1} onClick={() => setFinalizePagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}>Previous</button>
            <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={finalizePagination.page >= finalizePagination.totalPages} onClick={() => setFinalizePagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}>Next</button>
          </div>
        </div>
      </div>
      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{editingRecord ? 'Edit Attendance' : 'Add Attendance'}</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setIsFormOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={saveRecord} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="EMP0001"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md bg-white"
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Leave">Leave</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hours Worked</label>
                    <input
                      type="number"
                      value={formData.hoursWorked}
                      onChange={(e) => setFormData({ ...formData, hoursWorked: e.target.value })}
                      min="0"
                      step="0.25"
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Hours</label>
                    <input
                      type="number"
                      value={formData.overtimeHours}
                      onChange={(e) => setFormData({ ...formData, overtimeHours: e.target.value })}
                      min="0"
                      step="0.25"
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Optional notes"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="px-4 py-2 border border-gray-300 rounded-md" onClick={() => setIsFormOpen(false)}>Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{editingRecord ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Record Absentees Modal */}
      {showAbsentModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Record Absentees</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowAbsentModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={absentForm.date} onChange={(e) => setAbsentForm({ ...absentForm, date: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                    <input type="text" value={absentForm.reason} onChange={(e) => setAbsentForm({ ...absentForm, reason: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" placeholder="e.g., Company holiday" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee IDs (one per line)</label>
                  <textarea
                    rows={8}
                    value={absentForm.employeeIdsText}
                    onChange={(e) => setAbsentForm({ ...absentForm, employeeIdsText: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm"
                    placeholder={"EMP0001\nEMP0002\nEMP0003"}
                  />
                  <p className="text-xs text-gray-500 mt-1">Tip: paste up to 50,000 IDs; existing attendance for the date is skipped.</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button className="px-4 py-2 border border-gray-300 rounded-md" onClick={() => {
                    setShowAbsentModal(false);
                    setShowProcessModal(true);
                  }}>Cancel</button>
                  <button className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900" onClick={async () => {
                    try {
                      const ids = absentForm.employeeIdsText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                      if (ids.length === 0) {
                        showToast('error', 'Please enter at least one Employee ID');
                        return;
                      }
                      // Map IDs to internal employee IDs via API
                      const lookupRes = await fetch('/api/employees');
                      const lookupData = await lookupRes.json();
                      const mapByCode = new Map((lookupData.employees || []).map(e => [e.employeeId, e.id]));
                      const internalIds = ids.map(code => mapByCode.get(code)).filter(Boolean);
                      if (internalIds.length === 0) {
                        showToast('error', 'No matching employees found');
                        return;
                      }
                      const res = await fetch('/api/attendance/absences/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: absentForm.date, employeeIds: internalIds, reason: absentForm.reason })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to record absences');
                      showToast('success', `Recorded absences • Created: ${data.created}, Skipped: ${data.skipped}`);
                      setShowAbsentModal(false);
                      setShowProcessModal(true);
                      await loadAttendance();
                      
                      // Refresh the roster data in Process Attendance modal
                      try {
                        const attendanceRes = await fetch(`/api/attendance?fromDate=${absentForm.date}&toDate=${absentForm.date}`);
                        const attendanceData = await attendanceRes.json();
                        
                        const attendanceMap = new Map();
                        (attendanceData.attendance || []).forEach(record => {
                          attendanceMap.set(record.employeeId, record);
                        });
                        
                        const empsWithStatus = rosterEmployees.map(emp => {
                          const attendance = attendanceMap.get(emp.id);
                          return {
                            ...emp,
                            attendanceStatus: attendance ? attendance.status : 'Absent',
                            hoursWorked: attendance ? attendance.hoursWorked : 0,
                            overtimeHours: attendance ? attendance.overtimeHours : 0,
                            notes: attendance ? attendance.notes : ''
                          };
                        });
                        
                        setRosterEmployees(empsWithStatus);
                      } catch (error) {
                        console.error('Error refreshing attendance data:', error);
                      }
                    } catch (e) {
                      showToast('error', e.message || 'Failed to record absences');
                    }
                  }}>Record</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Process Attendance Modal (Professional Roster View) */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Process Attendance</h2>
                  <p className="text-sm text-gray-600">All employees are assumed Present by default. Record absentees separately.</p>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowProcessModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date</label>
                  <input type="date" value={absentForm.date} onChange={async (e) => {
                    const newDate = e.target.value;
                    setAbsentForm({ ...absentForm, date: newDate });
                    // Refresh attendance data for the new date
                    try {
                      const [employeesRes, attendanceRes] = await Promise.all([
                        fetch('/api/employees'),
                        fetch(`/api/attendance?fromDate=${newDate}&toDate=${newDate}`)
                      ]);
                      
                      const employeesData = await employeesRes.json();
                      const attendanceData = await attendanceRes.json();
                      
                      const emps = (employeesData.employees || []).map(e => ({ 
                        id: e.id, 
                        name: e.name, 
                        employeeId: e.employeeId, 
                        department: e.department 
                      }));
                      
                      const attendanceMap = new Map();
                      (attendanceData.attendance || []).forEach(record => {
                        attendanceMap.set(record.employeeId, record);
                      });
                      
                      const empsWithStatus = emps.map(emp => {
                        const attendance = attendanceMap.get(emp.id);
                        return {
                          ...emp,
                          attendanceStatus: attendance ? attendance.status : 'Absent',
                          hoursWorked: attendance ? attendance.hoursWorked : 0,
                          overtimeHours: attendance ? attendance.overtimeHours : 0,
                          notes: attendance ? attendance.notes : ''
                        };
                      });
                      
                      setRosterEmployees(empsWithStatus);
                      
                      // Update finalize status
                      const statusRes = await fetch(`/api/attendance/finalize/status?date=${newDate}`);
                      const statusData = await statusRes.json();
                      if (statusRes.ok && statusData.finalized) setFinalizeInfo(statusData); else setFinalizeInfo(null);
                    } catch (error) {
                      console.error('Error refreshing attendance data:', error);
                    }
                  }} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Search employees</label>
                  <input type="text" value={rosterSearch} onChange={(e) => setRosterSearch(e.target.value)} placeholder="Search by name, ID, department" className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
              </div>

              {finalizeInfo && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                  <div className="font-medium">Register finalized</div>
                  <div>Date: {finalizeInfo.date} • Present: {finalizeInfo.present} • Absent: {finalizeInfo.absent} • Total: {finalizeInfo.total}</div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Employees: <span className="font-semibold">{filteredRoster.length}</span>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-2 text-sm border rounded" onClick={() => setShowProcessModal(false)}>Close</button>
                  <button className="px-3 py-2 text-sm bg-white border rounded" onClick={() => {
                    setShowAbsentModal(true);
                    setShowProcessModal(false);
                  }}>Record Absentees</button>
                  <button className={`px-3 py-2 text-sm rounded ${finalizeInfo ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`} disabled={!!finalizeInfo} onClick={async () => {
                    try {
                      if (finalizeInfo) return;
                      const res = await fetch('/api/attendance/finalize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: absentForm.date })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to finalize');
                      showToast('success', `Register finalized for ${data.date} • Present: ${data.totals.present}, Absent: ${data.totals.absent}`);
                      setShowProcessModal(false);
                      await loadAttendance();
                      await loadFinalized();
                    } catch (e) {
                      showToast('error', e.message || 'Failed to finalize');
                    }
                  }}>
                    {finalizeInfo ? 'Already Finalized' : 'Finalize Register'}
                  </button>
                </div>
              </div>

              {rosterLoading ? (
                <div className="py-12 text-center text-gray-600">Loading employees...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredRoster.map(emp => (
                        <tr key={emp.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{emp.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{emp.employeeId || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{emp.department || '-'}</td>
                          <td className="px-4 py-2 text-sm">
                            {emp.attendanceStatus === 'Present' ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Present</span>
                            ) : emp.attendanceStatus === 'Absent' ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Absent</span>
                            ) : emp.attendanceStatus === 'Leave' ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">Leave</span>
                            ) : emp.attendanceStatus === 'Late' ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">Late</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">Present (default)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRoster.length === 0 && (
                    <div className="py-10 text-center text-gray-500">No employees found.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Register Modal (Read-Only) */}
      {showViewModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">View Attendance Register</h2>
                  <p className="text-sm text-gray-600">Finalized attendance register for {finalizeInfo?.date}</p>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowViewModal(false)}>
                  <X size={18} />
                </button>
              </div>

              {finalizeInfo && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                  <div className="font-medium">Register finalized</div>
                  <div>Date: {finalizeInfo.date} • Present: {finalizeInfo.present} • Absent: {finalizeInfo.absent} • Total: {finalizeInfo.total}</div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Employees: <span className="font-semibold">{filteredRoster.length}</span>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-2 text-sm border rounded" onClick={() => setShowViewModal(false)}>Close</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Overtime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredRoster.map(emp => (
                      <tr key={emp.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{emp.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{emp.employeeId || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{emp.department || '-'}</td>
                        <td className="px-4 py-2 text-sm">
                          {emp.attendanceStatus === 'Present' ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Present</span>
                          ) : emp.attendanceStatus === 'Absent' ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Absent</span>
                          ) : emp.attendanceStatus === 'Leave' ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">Leave</span>
                          ) : emp.attendanceStatus === 'Late' ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">Late</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">Present (default)</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">{emp.hoursWorked ?? 0}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{emp.overtimeHours ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredRoster.length === 0 && (
                  <div className="py-10 text-center text-gray-500">No employees found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

