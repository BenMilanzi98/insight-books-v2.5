"use client";

import { useEffect, useState } from "react";
import { Plus, Search, X, Clock, CheckCircle, XCircle, Calendar, User, Edit, Trash2 } from "lucide-react";

export default function AttendancePage() {
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: "",
    status: "Present",
    clockIn: "",
    clockOut: "",
    hoursWorked: "",
    overtimeHours: "",
    notes: ""
  });

  useEffect(() => {
    loadEmployees();
    loadAttendance();
  }, [selectedDate]);

  const showToast = (type, message) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast({ visible: false, type, message }), 3500);
  };

  async function loadEmployees() {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (res.ok) {
        setEmployees((data.employees || []).filter(e => e.isActive !== false));
      }
    } catch (e) {
      console.error('Error loading employees:', e);
    }
  }

  async function loadAttendance() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/attendance?fromDate=${selectedDate}&toDate=${selectedDate}`);
      const data = await res.json();
      if (res.ok) {
        setAttendanceRecords(data.attendance || []);
      } else {
        setError(data.error || 'Failed to load attendance');
      }
    } catch (e) {
      console.error('Error loading attendance:', e);
      setError(e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }

  const openModal = (record = null) => {
    if (record) {
      setEditingRecord(record);
      const clockIn = record.clockIn ? new Date(record.clockIn).toISOString().slice(0, 16) : "";
      const clockOut = record.clockOut ? new Date(record.clockOut).toISOString().slice(0, 16) : "";
      setFormData({
        employeeId: record.employeeId,
        status: record.status || "Present",
        clockIn: clockIn,
        clockOut: clockOut,
        hoursWorked: record.hoursWorked || "",
        overtimeHours: record.overtimeHours || "",
        notes: record.notes || ""
      });
    } else {
      setEditingRecord(null);
      setFormData({
        employeeId: "",
        status: "Present",
        clockIn: "",
        clockOut: "",
        hoursWorked: "",
        overtimeHours: "",
        notes: ""
      });
    }
    setShowModal(true);
  };

  const quickMarkStatus = async (employeeId, status) => {
    try {
      // Check if record exists for this date in current state
      const existingRecord = attendanceRecords.find(r => 
        r.employeeId === employeeId && 
        new Date(r.date).toISOString().split('T')[0] === selectedDate
      );
      
      if (existingRecord) {
        // Update existing record
        const res = await fetch(`/api/attendance/${existingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            date: selectedDate
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update');
        showToast('success', 'Attendance updated');
      } else {
        // Try to create new record
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId,
            date: selectedDate,
            status,
            hoursWorked: 0,
            overtimeHours: 0
          })
        });
        const data = await res.json();
        
        if (!res.ok) {
          // If record already exists error, fetch and update it
          if (res.status === 400 && data.error && data.error.includes('already exists')) {
            // Fetch the existing record and update it
            const fetchRes = await fetch(`/api/attendance?fromDate=${selectedDate}&toDate=${selectedDate}&employeeId=${employeeId}`);
            const fetchData = await fetchRes.json();
            
            if (fetchRes.ok && fetchData.attendance && fetchData.attendance.length > 0) {
              const record = fetchData.attendance[0];
              const updateRes = await fetch(`/api/attendance/${record.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  status,
                  date: selectedDate
                })
              });
              const updateData = await updateRes.json();
              if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update');
              showToast('success', 'Attendance updated');
            } else {
              throw new Error(data.error || 'Failed to create attendance');
            }
          } else {
            throw new Error(data.error || 'Failed to create');
          }
        } else {
          showToast('success', 'Attendance recorded');
        }
      }
      await loadAttendance();
    } catch (e) {
      console.error('Error marking attendance:', e);
      showToast('error', e.message || 'Failed to mark attendance');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        employeeId: formData.employeeId,
        date: selectedDate,
        status: formData.status,
        hoursWorked: formData.hoursWorked ? parseFloat(formData.hoursWorked) : 0,
        overtimeHours: formData.overtimeHours ? parseFloat(formData.overtimeHours) : 0,
        notes: formData.notes || null
      };

      // Add clock in/out times if provided
      if (formData.clockIn) {
        payload.clockIn = new Date(formData.clockIn).toISOString();
      }
      if (formData.clockOut) {
        payload.clockOut = new Date(formData.clockOut).toISOString();
      }

      // Check if record already exists for this employee and date
      const existingRecord = attendanceRecords.find(r => 
        r.employeeId === formData.employeeId && 
        new Date(r.date).toISOString().split('T')[0] === selectedDate
      );

      const url = (editingRecord || existingRecord) 
        ? `/api/attendance/${(editingRecord || existingRecord).id}` 
        : '/api/attendance';
      const method = (editingRecord || existingRecord) ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        // If it's a duplicate error, try to update instead
        if (data.error && data.error.includes('already exists') && !existingRecord) {
          // Find the existing record and update it
          const checkRes = await fetch(`/api/attendance?fromDate=${selectedDate}&toDate=${selectedDate}&employeeId=${formData.employeeId}`);
          const checkData = await checkRes.json();
          if (checkRes.ok && checkData.attendance && checkData.attendance.length > 0) {
            const updateRes = await fetch(`/api/attendance/${checkData.attendance[0].id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const updateData = await updateRes.json();
            if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update');
            showToast('success', 'Attendance updated');
            setShowModal(false);
            await loadAttendance();
            return;
          }
        }
        throw new Error(data.error || 'Failed to save');
      }

      showToast('success', (editingRecord || existingRecord) ? 'Attendance updated' : 'Attendance recorded');
      setShowModal(false);
      await loadAttendance();
    } catch (e) {
      console.error('Error saving attendance:', e);
      showToast('error', e.message || 'Failed to save attendance');
    }
  };

  const deleteRecord = async (record) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      const res = await fetch(`/api/attendance/${record.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      showToast('success', 'Attendance record deleted');
      await loadAttendance();
    } catch (e) {
      console.error('Error deleting attendance:', e);
      showToast('error', e.message || 'Failed to delete');
    }
  };

  const getAttendanceForEmployee = (employeeId) => {
    return attendanceRecords.find(r => r.employeeId === employeeId);
  };

  const filteredEmployees = employees.filter(emp => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(search) ||
      emp.employeeId?.toLowerCase().includes(search) ||
      emp.department?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-6">
      {toast.visible && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-md shadow-lg px-4 py-3 border text-sm ${
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Attendance Management</h1>
          <p className="text-gray-600">Mark employee attendance and record time</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={() => openModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Record
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search employees by name, ID, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Attendance List */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading attendance...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">{error}</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => {
                    const record = getAttendanceForEmployee(employee.id);
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="mr-2 text-gray-400" size={18} />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                              <div className="text-sm text-gray-500">{employee.employeeId || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {record ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              record.status === 'Present' ? 'bg-green-100 text-green-800' :
                              record.status === 'Absent' ? 'bg-red-100 text-red-800' :
                              record.status === 'Late' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {record.status}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              Not Recorded
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {record?.clockIn ? new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {record?.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {record ? (
                            <div>
                              <div>{record.hoursWorked || 0}h</div>
                              {record.overtimeHours > 0 && (
                                <div className="text-xs text-orange-600">+{record.overtimeHours}h OT</div>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center gap-2">
                            {!record && (
                              <>
                                <button
                                  onClick={() => quickMarkStatus(employee.id, 'Present')}
                                  className="text-green-600 hover:text-green-900"
                                  title="Mark Present"
                                >
                                  <CheckCircle size={18} />
                                </button>
                                <button
                                  onClick={() => quickMarkStatus(employee.id, 'Absent')}
                                  className="text-red-600 hover:text-red-900"
                                  title="Mark Absent"
                                >
                                  <XCircle size={18} />
                                </button>
                              </>
                            )}
                            {record && (
                              <>
                                <button
                                  onClick={() => openModal(record)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Edit"
                                >
                                  <Edit size={18} />
                                </button>
                                <button
                                  onClick={() => deleteRecord(record)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                            {!record && (
                              <button
                                onClick={() => {
                                  setFormData({ ...formData, employeeId: employee.id });
                                  openModal();
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="Add Details"
                              >
                                <Clock size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {editingRecord ? 'Edit Attendance' : 'Add Attendance Record'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={!!editingRecord}
                  >
                    <option value="">Select employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Late">Late</option>
                      <option value="Leave">Leave</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clock In
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.clockIn}
                      onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clock Out
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.clockOut}
                      onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hours Worked
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.hoursWorked}
                      onChange={(e) => setFormData({ ...formData, hoursWorked: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="8.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Overtime Hours
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.overtimeHours}
                      onChange={(e) => setFormData({ ...formData, overtimeHours: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Optional notes..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {editingRecord ? 'Update' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
