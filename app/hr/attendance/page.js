"use client";

import { useEffect, useState } from "react";
import { Plus, Search, X, Clock, CheckCircle, XCircle, Calendar, User, Edit, Trash2, FileText, Download, FileSpreadsheet } from "lucide-react";
import { downloadPDF, downloadExcel } from "@/lib/exportUtils";

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
  const [showReportSection, setShowReportSection] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]); // First day of current month
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEmployeeId, setReportEmployeeId] = useState("all");
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: "",
    status: "Present",
    clockIn: "",
    clockOut: "",
    hoursWorked: "",
    overtimeHours: "",
    notes: ""
  });

  // Calculate hours worked automatically when clockIn and clockOut are both set
  useEffect(() => {
    // Only calculate if both clockIn and clockOut are provided and not empty
    if (formData.clockIn && formData.clockIn.trim() !== '' && formData.clockOut && formData.clockOut.trim() !== '') {
      try {
        const clockInDate = new Date(formData.clockIn);
        const clockOutDate = new Date(formData.clockOut);
        
        if (!isNaN(clockInDate.getTime()) && !isNaN(clockOutDate.getTime())) {
          if (clockOutDate > clockInDate) {
            // Calculate difference in hours
            const diffMs = clockOutDate.getTime() - clockInDate.getTime();
            const diffHours = diffMs / (1000 * 60 * 60); // Convert milliseconds to hours
            
            // Round to 2 decimal places
            const totalHours = Math.round(diffHours * 100) / 100;
            
            // Calculate overtime (assuming 8 hours is standard work day)
            const standardHours = 8;
            let regularHours = totalHours;
            let overtimeHours = 0;
            
            if (totalHours > standardHours) {
              regularHours = standardHours;
              overtimeHours = Math.round((totalHours - standardHours) * 100) / 100;
            }
            
            // Always update when clock times change
            setFormData(prev => ({
              ...prev,
              hoursWorked: String(regularHours),
              overtimeHours: String(overtimeHours)
            }));
          } else {
            // Clock out must be after clock in - clear hours
            setFormData(prev => ({
              ...prev,
              hoursWorked: "",
              overtimeHours: ""
            }));
          }
        }
      } catch (e) {
        console.error('Error calculating hours:', e);
      }
    } else {
      // If either clockIn or clockOut is cleared, don't clear hours (user might have manually entered them)
      // Only auto-calculate when both are set
    }
  }, [formData.clockIn, formData.clockOut]);

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
      const res = await fetch(`/api/attendance?fromDate=${selectedDate}&toDate=${selectedDate}&limit=all`);
      const data = await res.json();
      if (res.ok) {
        const records = data.attendance || [];
        console.log('Loaded attendance records:', records.length, 'for date:', selectedDate);
        // Log records with clockIn to debug
        records.forEach(r => {
          if (r.clockIn) {
            console.log('Record with clockIn:', {
              employeeId: r.employeeId,
              date: r.date,
              clockIn: r.clockIn,
              status: r.status
            });
          }
        });
        setAttendanceRecords(records);
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

  const openModal = (record = null, preserveFormData = false) => {
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
    } else if (!preserveFormData) {
      // Only reset if formData is not being preserved (e.g., when clicking "Add Record" button)
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
    } else {
      // Preserve existing formData (e.g., when Clock button sets it)
      setEditingRecord(null);
    }
    setShowModal(true);
  };

  const quickMarkStatus = async (employeeId, status) => {
    try {
      // Get current time when button is clicked
      const currentTime = new Date().toISOString();
      
      // Helper to find existing record - check API first, then local state
      const findExistingRecord = async () => {
        // Always check API first (most reliable)
        try {
          const checkRes = await fetch(`/api/attendance?fromDate=${selectedDate}&toDate=${selectedDate}&employeeId=${employeeId}`);
          const checkData = await checkRes.json();
          console.log('API check result:', { 
            ok: checkRes.ok, 
            count: checkData.attendance?.length || 0,
            date: selectedDate,
            employeeId 
          });
          if (checkRes.ok && checkData.attendance && checkData.attendance.length > 0) {
            return checkData.attendance[0];
          }
        } catch (checkError) {
          console.warn('API check failed:', checkError);
        }
        
        // Fallback to local state
        return attendanceRecords.find(r => 
          r.employeeId === employeeId && 
          new Date(r.date).toISOString().split('T')[0] === selectedDate
        );
      };

      let existingRecord = await findExistingRecord();
      
      if (existingRecord) {
        // Update existing record - preserve clockIn/clockOut and other fields
        const updatePayload = {
          status,
          date: selectedDate,
          hoursWorked: existingRecord.hoursWorked || 0,
          overtimeHours: existingRecord.overtimeHours || 0,
          notes: existingRecord.notes || null
        };
        
        // If marking Present and no clockIn exists, set it to current time
        if (status === 'Present' && !existingRecord.clockIn) {
          updatePayload.clockIn = currentTime;
        } else if (existingRecord.clockIn) {
          // Preserve existing clockIn
          updatePayload.clockIn = new Date(existingRecord.clockIn).toISOString();
        }
        
        // Preserve clockOut if it exists
        if (existingRecord.clockOut) {
          updatePayload.clockOut = new Date(existingRecord.clockOut).toISOString();
        }
        
        const res = await fetch(`/api/attendance/${existingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update');
        showToast('success', status === 'Present' && !existingRecord.clockIn ? 'Present marked and clocked in' : 'Attendance updated');
      } else {
        // Try to create new record
        const createPayload = {
          employeeId,
          date: selectedDate,
          status,
          hoursWorked: 0,
          overtimeHours: 0
        };
        
        // If marking Present, set clockIn to current time
        if (status === 'Present') {
          createPayload.clockIn = currentTime;
        }
        
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload)
        });
        const data = await res.json();
        
        if (!res.ok) {
          // If record already exists error, try to find and update it
          if (res.status === 400 && data.error && data.error.includes('already exists')) {
            // Wait a bit for the record to be available, then try to find it
            await new Promise(resolve => setTimeout(resolve, 300));
            existingRecord = await findExistingRecord();
            
            if (existingRecord) {
              // Preserve all existing fields when updating
              const updatePayload = {
                status,
                date: selectedDate,
                hoursWorked: existingRecord.hoursWorked || 0,
                overtimeHours: existingRecord.overtimeHours || 0,
                notes: existingRecord.notes || null
              };
              
              // If marking Present and no clockIn exists, set it to current time
              if (status === 'Present' && !existingRecord.clockIn) {
                updatePayload.clockIn = currentTime;
              } else if (existingRecord.clockIn) {
                updatePayload.clockIn = new Date(existingRecord.clockIn).toISOString();
              }
              
              if (existingRecord.clockOut) {
                updatePayload.clockOut = new Date(existingRecord.clockOut).toISOString();
              }
              
              const updateRes = await fetch(`/api/attendance/${existingRecord.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
              });
              const updateData = await updateRes.json();
              if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update');
              showToast('success', status === 'Present' && !existingRecord.clockIn ? 'Present marked and clocked in' : 'Attendance updated');
            } else {
              // Last resort: try querying all records for this employee and find by date
              try {
                const allRes = await fetch(`/api/attendance?employeeId=${employeeId}&limit=100`);
                const allData = await allRes.json();
                if (allRes.ok && allData.attendance) {
                  const matchingRecord = allData.attendance.find(r => {
                    const recordDate = new Date(r.date).toISOString().split('T')[0];
                    return recordDate === selectedDate;
                  });
                  if (matchingRecord) {
                    const updatePayload = {
                      status,
                      date: selectedDate,
                      hoursWorked: matchingRecord.hoursWorked || 0,
                      overtimeHours: matchingRecord.overtimeHours || 0,
                      notes: matchingRecord.notes || null
                    };
                    
                    // If marking Present and no clockIn exists, set it to current time
                    if (status === 'Present' && !matchingRecord.clockIn) {
                      updatePayload.clockIn = currentTime;
                    } else if (matchingRecord.clockIn) {
                      updatePayload.clockIn = new Date(matchingRecord.clockIn).toISOString();
                    }
                    
                    if (matchingRecord.clockOut) {
                      updatePayload.clockOut = new Date(matchingRecord.clockOut).toISOString();
                    }
                    
                    const updateRes = await fetch(`/api/attendance/${matchingRecord.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(updatePayload)
                    });
                    const updateData = await updateRes.json();
                    if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update');
                    showToast('success', status === 'Present' && !matchingRecord.clockIn ? 'Present marked and clocked in' : 'Attendance updated');
                  } else {
                    throw new Error('Record exists but could not be found. Please refresh the page.');
                  }
                } else {
                  throw new Error('Record exists but could not be found. Please refresh the page.');
                }
              } catch (finalError) {
                throw new Error('Record exists but could not be found. Please refresh the page.');
              }
            }
          } else {
            throw new Error(data.error || 'Failed to create');
          }
        } else {
          showToast('success', status === 'Present' ? 'Present marked and clocked in' : 'Attendance recorded');
        }
      }
      // Small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadAttendance();
    } catch (e) {
      console.error('Error marking attendance:', e);
      showToast('error', e.message || 'Failed to mark attendance');
    }
  };

  const quickClockOut = async (employeeId) => {
    try {
      const currentTime = new Date().toISOString();
      
      // Helper to find existing record
      const findExistingRecord = async () => {
        try {
          const checkRes = await fetch(`/api/attendance?fromDate=${selectedDate}&toDate=${selectedDate}&employeeId=${employeeId}`);
          const checkData = await checkRes.json();
          if (checkRes.ok && checkData.attendance && checkData.attendance.length > 0) {
            return checkData.attendance[0];
          }
        } catch (checkError) {
          console.warn('API check failed:', checkError);
        }
        
        return attendanceRecords.find(r => 
          r.employeeId === employeeId && 
          new Date(r.date).toISOString().split('T')[0] === selectedDate
        );
      };

      const existingRecord = await findExistingRecord();
      
      if (!existingRecord) {
        showToast('error', 'No attendance record found. Please mark present first.');
        return;
      }

      if (existingRecord.clockOut) {
        showToast('error', 'Employee has already clocked out for this day.');
        return;
      }

      // Update with clock out time
      const updatePayload = {
        status: existingRecord.status || 'Present',
        date: selectedDate,
        clockIn: existingRecord.clockIn ? new Date(existingRecord.clockIn).toISOString() : currentTime, // Set clockIn if missing
        clockOut: currentTime,
        hoursWorked: existingRecord.hoursWorked || 0,
        overtimeHours: existingRecord.overtimeHours || 0,
        notes: existingRecord.notes || null
      };

      const res = await fetch(`/api/attendance/${existingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clock out');
      
      showToast('success', 'Clock out recorded');
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadAttendance();
    } catch (e) {
      console.error('Error clocking out:', e);
      showToast('error', e.message || 'Failed to clock out');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Helper function to find existing record
      const findExistingRecord = async () => {
        // First check if we're editing
        if (editingRecord) return editingRecord;
        
        // Check local state
        let record = attendanceRecords.find(r => 
          r.employeeId === formData.employeeId && 
          new Date(r.date).toISOString().split('T')[0] === selectedDate
        );
        
        // Always double-check with API
        try {
          const checkRes = await fetch(`/api/attendance?fromDate=${selectedDate}&toDate=${selectedDate}&employeeId=${formData.employeeId}`);
          const checkData = await checkRes.json();
          if (checkRes.ok && checkData.attendance && checkData.attendance.length > 0) {
            record = checkData.attendance[0];
          }
        } catch (e) {
          console.warn('API check failed, using local state:', e);
        }
        
        return record;
      };

      // Find existing record
      let existingRecord = await findExistingRecord();
      console.log('Found existing record:', existingRecord?.id, 'for employee:', formData.employeeId, 'date:', selectedDate);

      // Calculate hours if clockIn and clockOut are set but hoursWorked is not
      let finalHoursWorked = formData.hoursWorked ? parseFloat(formData.hoursWorked) : 0;
      let finalOvertimeHours = formData.overtimeHours ? parseFloat(formData.overtimeHours) : 0;
      
      if (formData.clockIn && formData.clockIn.trim() !== '' && formData.clockOut && formData.clockOut.trim() !== '') {
        try {
          const clockInDate = new Date(formData.clockIn);
          const clockOutDate = new Date(formData.clockOut);
          
          if (!isNaN(clockInDate.getTime()) && !isNaN(clockOutDate.getTime()) && clockOutDate > clockInDate) {
            const diffMs = clockOutDate.getTime() - clockInDate.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            const totalHours = Math.round(diffHours * 100) / 100;
            const standardHours = 8;
            
            if (totalHours > standardHours) {
              finalHoursWorked = standardHours;
              finalOvertimeHours = Math.round((totalHours - standardHours) * 100) / 100;
            } else {
              finalHoursWorked = totalHours;
              finalOvertimeHours = 0;
            }
            
          }
        } catch (e) {
          console.error('Error calculating hours before save:', e);
        }
      }

      const payload = {
        employeeId: formData.employeeId,
        date: selectedDate,
        status: formData.status,
        hoursWorked: finalHoursWorked,
        overtimeHours: finalOvertimeHours,
        notes: formData.notes || null
      };

      // Add clock in/out times - when updating, always include to preserve or update
      if (existingRecord) {
        // When updating, always include clockIn/clockOut to ensure they're preserved or updated
        if (formData.clockIn && formData.clockIn.trim() !== '') {
          payload.clockIn = new Date(formData.clockIn).toISOString();
        } else {
          // Preserve existing clockIn or set to null if it was cleared
          payload.clockIn = existingRecord.clockIn ? new Date(existingRecord.clockIn).toISOString() : null;
        }
        
        if (formData.clockOut && formData.clockOut.trim() !== '') {
          payload.clockOut = new Date(formData.clockOut).toISOString();
        } else {
          // Preserve existing clockOut or set to null if it was cleared
          payload.clockOut = existingRecord.clockOut ? new Date(existingRecord.clockOut).toISOString() : null;
        }
      } else {
        // When creating, only include if provided
        if (formData.clockIn && formData.clockIn.trim() !== '') {
          payload.clockIn = new Date(formData.clockIn).toISOString();
        }
        if (formData.clockOut && formData.clockOut.trim() !== '') {
          payload.clockOut = new Date(formData.clockOut).toISOString();
        }
      }

      // Determine method and URL
      let url, method;
      if (existingRecord) {
        url = `/api/attendance/${existingRecord.id}`;
        method = 'PUT';
      } else {
        url = '/api/attendance';
        method = 'POST';
      }


      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        // If it's a duplicate error and we tried to POST, find and update it
        if (data.error && data.error.includes('already exists') && method === 'POST') {
          // Wait a bit for the record to be available, then try multiple strategies
          await new Promise(resolve => setTimeout(resolve, 300));
          existingRecord = await findExistingRecord();
          
          // If still not found, try querying all records for this employee
          if (!existingRecord) {
            try {
              const allRes = await fetch(`/api/attendance?employeeId=${formData.employeeId}&limit=100`);
              const allData = await allRes.json();
              if (allRes.ok && allData.attendance) {
                existingRecord = allData.attendance.find(r => {
                  const recordDate = new Date(r.date).toISOString().split('T')[0];
                  return recordDate === selectedDate;
                });
              }
            } catch (e) {
              console.warn('Fallback query failed:', e);
            }
          }
          
          if (existingRecord) {
            // Update the existing record with all the data, preserving clockIn/clockOut
            const updatePayload = { ...payload };
            // If clockIn/clockOut weren't in original payload, preserve existing values
            if (!updatePayload.clockIn && existingRecord.clockIn) {
              updatePayload.clockIn = new Date(existingRecord.clockIn).toISOString();
            }
            if (!updatePayload.clockOut && existingRecord.clockOut) {
              updatePayload.clockOut = new Date(existingRecord.clockOut).toISOString();
            }
            
            const updateRes = await fetch(`/api/attendance/${existingRecord.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatePayload)
            });
            const updateData = await updateRes.json();
            if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update');
            showToast('success', 'Attendance updated');
            setShowModal(false);
            await new Promise(resolve => setTimeout(resolve, 150));
            await loadAttendance();
            return;
          } else {
            throw new Error('Record exists but could not be found. Please refresh the page and try again.');
          }
        }
        throw new Error(data.error || 'Failed to save');
      }

      showToast('success', existingRecord ? 'Attendance updated' : 'Attendance recorded');
      setShowModal(false);
      await new Promise(resolve => setTimeout(resolve, 150));
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
    // Find record for this employee and the selected date
    return attendanceRecords.find(r => {
      if (r.employeeId !== employeeId) return false;
      // Compare dates by converting to YYYY-MM-DD format
      const recordDate = r.date ? new Date(r.date).toISOString().split('T')[0] : null;
      return recordDate === selectedDate;
    });
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

  // Load attendance report data
  const loadAttendanceReport = async () => {
    setReportLoading(true);
    try {
      const startDate = new Date(reportStartDate);
      const endDate = new Date(reportEndDate);
      endDate.setHours(23, 59, 59, 999);

      const params = new URLSearchParams({
        fromDate: startDate.toISOString(),
        toDate: endDate.toISOString(),
        limit: 'all'
      });

      if (reportEmployeeId !== "all") {
        params.append('employeeId', reportEmployeeId);
      }

      const response = await fetch(`/api/attendance?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load attendance report');
      }

      const data = await response.json();
      const records = data.attendance || [];

      const enrichedRecords = records.map(record => {
        const employee = employees.find(emp => emp.id === record.employeeId);
        return {
          ...record,
          employeeName: employee?.name || 'Unknown',
          employeeId: employee?.employeeId || 'N/A',
          department: employee?.department || 'N/A'
        };
      });

      enrichedRecords.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.employeeName.localeCompare(b.employeeName);
      });

      setReportData(enrichedRecords);
    } catch (error) {
      console.error('Error loading attendance report:', error);
      showToast('error', error.message || 'Failed to load attendance report');
      setReportData([]);
    } finally {
      setReportLoading(false);
    }
  };

  // Export report as PDF
  const exportReportPDF = () => {
    if (reportData.length === 0) {
      showToast('error', 'No data to export');
      return;
    }

    const selectedEmployee = reportEmployeeId !== "all" 
      ? employees.find(e => e.id === reportEmployeeId)
      : null;

    const title = selectedEmployee 
      ? `Attendance Report - ${selectedEmployee.name}`
      : 'Attendance Report - All Employees';
    
    const subtitle = `Period: ${new Date(reportStartDate).toLocaleDateString()} - ${new Date(reportEndDate).toLocaleDateString()}`;

    const headers = [
      { key: 'date', label: 'Date' },
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'department', label: 'Department' },
      { key: 'status', label: 'Status' },
      { key: 'clockIn', label: 'Clock In' },
      { key: 'clockOut', label: 'Clock Out' },
      { key: 'hoursWorked', label: 'Hours Worked' },
      { key: 'overtimeHours', label: 'Overtime Hours' }
    ];

    const exportData = reportData.map(record => ({
      date: new Date(record.date).toLocaleDateString(),
      employeeName: record.employeeName,
      employeeId: record.employeeId,
      department: record.department,
      status: record.status || 'N/A',
      clockIn: record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : 'N/A',
      clockOut: record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : 'N/A',
      hoursWorked: record.hoursWorked ? `${record.hoursWorked}h` : '0h',
      overtimeHours: record.overtimeHours ? `${record.overtimeHours}h` : '0h'
    }));

    const totalRecords = exportData.length;
    const presentCount = exportData.filter(r => r.status === 'Present').length;
    const absentCount = exportData.filter(r => r.status === 'Absent').length;
    const totalHours = exportData.reduce((sum, r) => {
      const hours = parseFloat(r.hoursWorked) || 0;
      return sum + hours;
    }, 0);
    const totalOvertime = exportData.reduce((sum, r) => {
      const hours = parseFloat(r.overtimeHours) || 0;
      return sum + hours;
    }, 0);

    const summaryData = [
      { label: 'Total Records', value: totalRecords },
      { label: 'Present', value: presentCount },
      { label: 'Absent', value: absentCount },
      { label: 'Total Hours Worked', value: `${totalHours.toFixed(2)}h` },
      { label: 'Total Overtime', value: `${totalOvertime.toFixed(2)}h` }
    ];

    downloadPDF({
      title,
      subtitle,
      data: exportData,
      headers,
      summaryData
    }, `attendance-report-${reportStartDate}-${reportEndDate}.pdf`);

    showToast('success', 'PDF exported successfully');
  };

  // Export report as Excel
  const exportReportExcel = async () => {
    if (reportData.length === 0) {
      showToast('error', 'No data to export');
      return;
    }

    const selectedEmployee = reportEmployeeId !== "all" 
      ? employees.find(e => e.id === reportEmployeeId)
      : null;

    const sheetName = selectedEmployee 
      ? `${selectedEmployee.name} Attendance`
      : 'All Employees Attendance';

    const headers = [
      { key: 'date', label: 'Date' },
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'department', label: 'Department' },
      { key: 'status', label: 'Status' },
      { key: 'clockIn', label: 'Clock In' },
      { key: 'clockOut', label: 'Clock Out' },
      { key: 'hoursWorked', label: 'Hours Worked' },
      { key: 'overtimeHours', label: 'Overtime Hours' }
    ];

    const exportData = reportData.map(record => ({
      date: new Date(record.date).toLocaleDateString(),
      employeeName: record.employeeName,
      employeeId: record.employeeId,
      department: record.department,
      status: record.status || 'N/A',
      clockIn: record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : 'N/A',
      clockOut: record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : 'N/A',
      hoursWorked: record.hoursWorked || 0,
      overtimeHours: record.overtimeHours || 0
    }));

    const filename = `attendance-report-${reportStartDate}-${reportEndDate}.xlsx`;

    await downloadExcel(exportData, headers, sheetName, filename);
    showToast('success', 'Excel file exported successfully');
  };

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
            onClick={() => setShowReportSection(!showReportSection)}
            className="px-4 py-2 bg-green-600 text-white rounded-md flex items-center gap-2 hover:bg-green-700"
          >
            <FileText size={18} />
            {showReportSection ? 'Hide Report' : 'View Report'}
          </button>
          <button
            onClick={() => openModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Record
          </button>
        </div>
      </div>

      {/* Attendance Report Section */}
      {showReportSection && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Attendance Report</h2>
            <button
              onClick={() => setShowReportSection(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Report Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select
                value={reportEmployeeId}
                onChange={(e) => setReportEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadAttendanceReport}
                disabled={reportLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {reportLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Export Buttons */}
          {reportData.length > 0 && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={exportReportPDF}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
              >
                <FileText size={18} />
                Export PDF
              </button>
              <button
                onClick={exportReportExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
              >
                <FileSpreadsheet size={18} />
                Export Excel
              </button>
            </div>
          )}

          {/* Report Data Table */}
          {reportData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((record, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.employeeName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {record.employeeId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {record.department}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === 'Present' ? 'bg-green-100 text-green-800' :
                          record.status === 'Absent' ? 'bg-red-100 text-red-800' :
                          record.status === 'Late' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {record.hoursWorked ? `${record.hoursWorked}h` : '0h'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                        {record.overtimeHours ? `${record.overtimeHours}h` : '0h'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : reportLoading ? (
            <div className="text-center py-12 text-gray-600">Loading report data...</div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Click "Generate Report" to view attendance data
            </div>
          )}
        </div>
      )}

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
                          {record?.clockIn ? (() => {
                            try {
                              const clockInDate = new Date(record.clockIn);
                              if (isNaN(clockInDate.getTime())) return '-';
                              return clockInDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            } catch (e) {
                              console.error('Error formatting clockIn:', e, record.clockIn);
                              return '-';
                            }
                          })() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {record?.clockOut ? (() => {
                            try {
                              const clockOutDate = new Date(record.clockOut);
                              if (isNaN(clockOutDate.getTime())) return '-';
                              return clockOutDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            } catch (e) {
                              console.error('Error formatting clockOut:', e, record.clockOut);
                              return '-';
                            }
                          })() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {record ? (
                            <div>
                              <div>{record.hoursWorked ? Number(record.hoursWorked).toFixed(2) + 'h' : '0h'}</div>
                              {record.overtimeHours && Number(record.overtimeHours) > 0 && (
                                <div className="text-xs text-orange-600">+{Number(record.overtimeHours).toFixed(2)}h OT</div>
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
                                  title="Mark Present (Records Clock In Time)"
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
                                {record.status === 'Present' && !record.clockOut && (
                                  <button
                                    onClick={() => quickClockOut(employee.id)}
                                    className="text-orange-600 hover:text-orange-900"
                                    title="Clock Out"
                                  >
                                    <Clock size={18} />
                                  </button>
                                )}
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
                                  // Auto-fill clockIn with current time when clicking Clock button
                                  const now = new Date();
                                  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                  setFormData({ 
                                    employeeId: employee.id,
                                    status: "Present",
                                    clockIn: localDateTime,
                                    clockOut: "",
                                    hoursWorked: "",
                                    overtimeHours: "",
                                    notes: ""
                                  });
                                  openModal(null, true); // Preserve the formData we just set
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="Clock In Now"
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
                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={formData.clockIn}
                        onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                          setFormData({ ...formData, clockIn: localDateTime });
                        }}
                        className="px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-100 text-sm whitespace-nowrap"
                        title="Set to current time"
                      >
                        Now
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clock Out
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={formData.clockOut}
                        onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                          setFormData({ ...formData, clockOut: localDateTime });
                        }}
                        className="px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-100 text-sm whitespace-nowrap"
                        title="Set to current time"
                      >
                        Now
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hours Worked
                      {formData.clockIn && formData.clockOut && (
                        <span className="text-xs text-gray-500 ml-2">(Auto-calculated)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.hoursWorked}
                      onChange={(e) => setFormData({ ...formData, hoursWorked: e.target.value })}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                        formData.clockIn && formData.clockOut ? 'bg-gray-50' : ''
                      }`}
                      placeholder="8.0"
                      title={formData.clockIn && formData.clockOut ? 'Auto-calculated from Clock In/Out times. You can manually override if needed.' : 'Enter hours worked or set Clock In/Out to auto-calculate'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Overtime Hours
                      {formData.clockIn && formData.clockOut && (
                        <span className="text-xs text-gray-500 ml-2">(Auto-calculated)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.overtimeHours}
                      onChange={(e) => setFormData({ ...formData, overtimeHours: e.target.value })}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                        formData.clockIn && formData.clockOut ? 'bg-gray-50' : ''
                      }`}
                      placeholder="0.0"
                      title={formData.clockIn && formData.clockOut ? 'Auto-calculated from Clock In/Out times. You can manually override if needed.' : 'Enter overtime hours or set Clock In/Out to auto-calculate'}
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
