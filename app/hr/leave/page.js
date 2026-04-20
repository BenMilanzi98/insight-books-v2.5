'use client';

import { useState, useEffect } from 'react';
import { toYmdLocal } from '@/lib/dateUtils';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function LeaveManagement() {
  const [activeTab, setActiveTab] = useState('policies');
  const [policies, setPolicies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);

  // Load data
  useEffect(() => {
    loadPolicies();
    loadRequests();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leave-policies');
      const data = await response.json();
      if (response.ok) {
        setPolicies(data.leavePolicies || []);
      } else {
        console.error('Error loading policies:', data.error);
      }
    } catch (error) {
      console.error('Error loading policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leave-requests');
      const data = await response.json();
      if (response.ok) {
        setRequests(data.requests || []);
      } else {
        console.error('Error loading requests:', data.error);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePolicySubmit = async (policyData) => {
    try {
      const url = editingPolicy ? `/api/leave-policies/${editingPolicy.id}` : '/api/leave-policies';
      const method = editingPolicy ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyData)
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadPolicies();
        setShowPolicyModal(false);
        setEditingPolicy(null);
      } else {
        alert(data.error || 'Failed to save policy');
      }
    } catch (error) {
      console.error('Error saving policy:', error);
      alert('Failed to save policy');
    }
  };

  const handleRequestSubmit = async (requestData) => {
    try {
      const url = editingRequest ? `/api/leave-requests/${editingRequest.id}` : '/api/leave-requests';
      const method = editingRequest ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadRequests();
        setShowRequestModal(false);
        setEditingRequest(null);
      } else {
        alert(data.error || 'Failed to save request');
      }
    } catch (error) {
      console.error('Error saving request:', error);
      alert('Failed to save request');
    }
  };

  const handleApproveReject = async (requestId, action) => {
    try {
      const response = await fetch(`/api/leave-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadRequests();
      } else {
        alert(data.error || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      alert(`Failed to ${action} request`);
    }
  };

  const handleDeletePolicy = async (policyId) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    
    try {
      const response = await fetch(`/api/leave-policies/${policyId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadPolicies();
      } else {
        alert(data.error || 'Failed to delete policy');
      }
    } catch (error) {
      console.error('Error deleting policy:', error);
      alert('Failed to delete policy');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
        <p className="text-gray-600">Manage leave policies and requests</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('policies')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'policies'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Leave Policies
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Leave Requests
            </button>
            <button
              onClick={() => setActiveTab('balances')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'balances'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Leave Balances
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calendar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Calendar
            </button>
          </nav>
        </div>
      </div>

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Leave Policies</h2>
            <button
              onClick={() => {
                setEditingPolicy(null);
                setShowPolicyModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Policy
            </button>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days/Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {policies.map((policy) => (
                  <tr key={policy.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {policy.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {policy.leaveType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {policy.maxDaysPerYear || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        policy.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {policy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingPolicy(policy);
                            setShowPolicyModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePolicy(policy.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Leave Requests</h2>
            <button
              onClick={() => {
                setEditingRequest(null);
                setShowRequestModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              New Request
            </button>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {request.employee?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {request.leavePolicy?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {request.totalDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {request.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApproveReject(request.id, 'approve')}
                              className="text-green-600 hover:text-green-900"
                              title="Approve"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleApproveReject(request.id, 'reject')}
                              className="text-red-600 hover:text-red-900"
                              title="Reject"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setEditingRequest(request);
                            setShowRequestModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Policy Modal */}
      {showPolicyModal && (
        <PolicyModal
          policy={editingPolicy}
          onClose={() => {
            setShowPolicyModal(false);
            setEditingPolicy(null);
          }}
          onSubmit={handlePolicySubmit}
        />
      )}

      {/* Balances Tab */}
      {activeTab === 'balances' && (
        <LeaveBalancesTab />
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <LeaveCalendarTab requests={requests} />
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <RequestModal
          request={editingRequest}
          policies={policies}
          onClose={() => {
            setShowRequestModal(false);
            setEditingRequest(null);
          }}
          onSubmit={handleRequestSubmit}
        />
      )}
    </div>
  );
}

// Leave Balances Tab Component
function LeaveBalancesTab() {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadBalances();
  }, [year]);

  const loadBalances = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/leave-balances?year=${year}`);
      const data = await response.json();
      if (response.ok) {
        setBalances(data.balances || []);
      }
    } catch (error) {
      console.error('Error loading balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leave-balances/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year })
      });
      const data = await response.json();
      if (response.ok) {
        await loadBalances();
        alert('Leave balances recalculated successfully');
      } else {
        alert(data.error || 'Failed to recalculate balances');
      }
    } catch (error) {
      console.error('Error recalculating balances:', error);
      alert('Failed to recalculate balances');
    } finally {
      setLoading(false);
    }
  };

  // Group balances by employee
  const balancesByEmployee = balances.reduce((acc, balance) => {
    const empId = balance.employeeId;
    if (!acc[empId]) {
      acc[empId] = {
        employee: balance.employee,
        policies: []
      };
    }
    acc[empId].policies.push(balance);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Leave Balances</h2>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Recalculating...' : 'Recalculate All Balances'}
        </button>
      </div>

      {loading && balances.length === 0 ? (
        <div className="text-center py-8">Loading balances...</div>
      ) : Object.keys(balancesByEmployee).length === 0 ? (
        <div className="text-center py-8 text-gray-500">No leave balances found</div>
      ) : (
        <div className="space-y-4">
          {Object.values(balancesByEmployee).map(({ employee, policies }) => (
            <div key={employee.id} className="bg-white shadow rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                {employee.name} {employee.employeeId && `(${employee.employeeId})`}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {policies.map((balance) => (
                  <div key={balance.id} className="border border-gray-200 rounded-md p-3">
                    <p className="text-sm font-medium text-gray-700">{balance.leavePolicy.name}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Available:</span>
                        <span className="ml-1 font-semibold text-green-600">{balance.availableDays?.toFixed(1) || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Used:</span>
                        <span className="ml-1 font-semibold text-blue-600">{balance.usedDays?.toFixed(1) || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Pending:</span>
                        <span className="ml-1 font-semibold text-yellow-600">{balance.pendingDays?.toFixed(1) || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Allocated:</span>
                        <span className="ml-1 font-semibold text-gray-900">{balance.allocatedDays?.toFixed(1) || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Leave Calendar Tab Component
function LeaveCalendarTab({ requests }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  // Get approved leave requests for the current month
  const monthRequests = requests.filter(req => {
    if (req.status !== 'approved') return false;
    const reqStart = new Date(req.startDate);
    const reqEnd = new Date(req.endDate);
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    return (reqStart <= monthEnd && reqEnd >= monthStart);
  });

  const getDayRequests = (day) => {
    const date = new Date(currentYear, currentMonth, day);
    return monthRequests.filter(req => {
      const reqStart = new Date(req.startDate);
      const reqEnd = new Date(req.endDate);
      return date >= reqStart && date <= reqEnd;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Leave Calendar</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(currentYear - 1);
              } else {
                setCurrentMonth(currentMonth - 1);
              }
            }}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="font-medium">{monthNames[currentMonth]} {currentYear}</span>
          <button
            onClick={() => {
              if (currentMonth === 11) {
                setCurrentMonth(0);
                setCurrentYear(currentYear + 1);
              } else {
                setCurrentMonth(currentMonth + 1);
              }
            }}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
          {Array(firstDayOfMonth).fill(null).map((_, i) => (
            <div key={`empty-${i}`} className="bg-white p-2 min-h-[100px]"></div>
          ))}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1;
            const dayRequests = getDayRequests(day);
            return (
              <div key={day} className="bg-white p-2 min-h-[100px] border-r border-b border-gray-200">
                <div className="text-sm font-medium text-gray-900 mb-1">{day}</div>
                <div className="space-y-1">
                  {dayRequests.slice(0, 2).map(req => (
                    <div
                      key={req.id}
                      className={`text-xs px-1 py-0.5 rounded ${getStatusColor(req.status)} truncate`}
                      title={`${req.employee?.name} - ${req.leavePolicy?.name}`}
                    >
                      {req.employee?.name}
                    </div>
                  ))}
                  {dayRequests.length > 2 && (
                    <div className="text-xs text-gray-500">+{dayRequests.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Policy Modal Component
function PolicyModal({ policy, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaveType: 'annual',
    maxDaysPerYear: '',
    maxDaysPerRequest: '',
    minDaysPerRequest: '',
    requiresApproval: true,
    requiresDocumentation: false,
    isPaid: true,
    accrualRate: '',
    carryOverLimit: '',
    isActive: true
  });

  useEffect(() => {
    if (policy) {
      setFormData({
        name: policy.name || '',
        description: policy.description || '',
        leaveType: policy.leaveType || 'annual',
        maxDaysPerYear: policy.maxDaysPerYear || '',
        maxDaysPerRequest: policy.maxDaysPerRequest || '',
        minDaysPerRequest: policy.minDaysPerRequest || '',
        requiresApproval: policy.requiresApproval !== false,
        requiresDocumentation: policy.requiresDocumentation || false,
        isPaid: policy.isPaid !== false,
        accrualRate: policy.accrualRate || '',
        carryOverLimit: policy.carryOverLimit || '',
        isActive: policy.isActive !== false
      });
    }
  }, [policy]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {policy ? 'Edit Leave Policy' : 'Add Leave Policy'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Leave Type</label>
              <select
                value={formData.leaveType}
                onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="paternity">Paternity Leave</option>
                <option value="emergency">Emergency Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Max Days Per Year</label>
              <input
                type="number"
                value={formData.maxDaysPerYear}
                onChange={(e) => setFormData({ ...formData, maxDaysPerYear: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.requiresApproval}
                onChange={(e) => setFormData({ ...formData, requiresApproval: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">Requires Approval</label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">Active</label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                {policy ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Request Modal Component
function RequestModal({ request, policies, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    leavePolicyId: '',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [employees, setEmployees] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    loadEmployees();
    if (request) {
      setFormData({
        employeeId: request.employeeId || '',
        leavePolicyId: request.leavePolicyId || '',
        startDate: request.startDate ? toYmdLocal(request.startDate) : '',
        endDate: request.endDate ? toYmdLocal(request.endDate) : '',
        reason: request.reason || ''
      });
    }
  }, [request]);

  useEffect(() => {
    if (formData.employeeId && formData.leavePolicyId && !request) {
      loadLeaveBalance(formData.employeeId, formData.leavePolicyId);
    } else {
      setLeaveBalance(null);
    }
  }, [formData.employeeId, formData.leavePolicyId]);

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/employees?limit=1000&isActive=true');
      const data = await response.json();
      if (response.ok) {
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadLeaveBalance = async (employeeId, leavePolicyId) => {
    try {
      setLoadingBalance(true);
      const year = new Date().getFullYear();
      const response = await fetch(`/api/leave-balances?employeeId=${employeeId}&year=${year}`);
      const data = await response.json();
      if (response.ok) {
        const balance = data.balances?.find(b => b.leavePolicyId === leavePolicyId);
        setLeaveBalance(balance);
      }
    } catch (error) {
      console.error('Error loading leave balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {request ? 'View Leave Request' : 'New Leave Request'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!request && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee *</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="">Select an employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} {employee.employeeId ? `(${employee.employeeId})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Leave Policy *</label>
              <select
                value={formData.leavePolicyId}
                onChange={(e) => setFormData({ ...formData, leavePolicyId: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!!request}
              >
                <option value="">Select a policy</option>
                {policies.filter(p => p.isActive).map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name} ({policy.leaveType})
                  </option>
                ))}
              </select>
            </div>

            {leaveBalance && !request && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm font-medium text-blue-900">Leave Balance</p>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-blue-700">Available:</span>
                    <span className="ml-1 font-semibold text-blue-900">{leaveBalance.availableDays?.toFixed(1) || 0}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Used:</span>
                    <span className="ml-1 font-semibold text-blue-900">{leaveBalance.usedDays?.toFixed(1) || 0}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Pending:</span>
                    <span className="ml-1 font-semibold text-blue-900">{leaveBalance.pendingDays?.toFixed(1) || 0}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!!request}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!!request}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Reason</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
                disabled={!!request}
              />
            </div>

            {request && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1 text-sm text-gray-900 capitalize">{request.status}</div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
              {!request && (
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Submit Request
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}