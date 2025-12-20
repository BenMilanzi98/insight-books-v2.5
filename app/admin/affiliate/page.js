"use client";

import React, { useState, useEffect } from "react";
import { 
  Users,
  DollarSign,
  TrendingUp,
  BarChart3,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  User,
  RefreshCw,
  Link,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Lock
} from "lucide-react";

const AffiliatePage = () => {
  const [affiliates, setAffiliates] = useState([]);
  const [affiliateStats, setAffiliateStats] = useState({
    totalAffiliates: 0,
    activeAffiliates: 0,
    totalCommissions: 0,
    pendingPayouts: 0,
    monthlyRevenue: 0,
    conversionRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Utility function to clear messages
  const clearMessages = () => {
    setError("");
    setSuccess("");
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
    notifyAffiliate: true
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Add/Edit form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    commissionRate: 20,
    status: "active",
    paymentMethod: "bank",
    bankDetails: {
      accountName: "",
      accountNumber: "",
      bankName: "",
      swiftCode: ""
    }
  });

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, searchTerm]);

  const fetchAffiliateData = async () => {
    try {
      setIsLoading(true);
      const [affiliatesResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/affiliate'),
        fetch('/api/admin/affiliate/stats')
      ]);

      if (affiliatesResponse.ok) {
        const affiliatesData = await affiliatesResponse.json();
        setAffiliates(affiliatesData.affiliates || []);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setAffiliateStats(statsData.stats || affiliateStats);
      }
    } catch (error) {
      setError('Failed to fetch affiliate data');
      console.error('Affiliate fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAffiliate = async (e) => {
    e.preventDefault();
    try {
      clearMessages(); // Clear any existing messages
      setIsLoading(true);
      const response = await fetch('/api/admin/affiliate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        setAffiliates(prev => [result.affiliate, ...prev]);
        setShowAddModal(false);
        setFormData({
          name: "",
          email: "",
          commissionRate: 20,
          status: "active",
          paymentMethod: "bank",
          bankDetails: {
            accountName: "",
            accountNumber: "",
            bankName: "",
            swiftCode: ""
          }
        });
        fetchAffiliateData(); // Refresh data
        setSuccess('Affiliate added successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add affiliate');
      }
    } catch (error) {
      setError('Failed to add affiliate');
      console.error('Add affiliate error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAffiliate = async (affiliateId, updates) => {
    try {
      clearMessages(); // Clear any existing messages
      const response = await fetch(`/api/admin/affiliate/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          affiliateId,
          ...updates
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAffiliates(prev => prev.map(aff => 
            aff.id === affiliateId ? { ...aff, ...updates } : aff
          ));
          setShowDetailsModal(false);
          fetchAffiliateData(); // Refresh data
          setSuccess('Affiliate updated successfully!');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setError(result.error || 'Failed to update affiliate');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update affiliate');
      }
    } catch (error) {
      setError('Failed to update affiliate');
      console.error('Update affiliate error:', error);
    }
  };

  const handleDeleteAffiliate = async (affiliateId) => {
    if (window.confirm('Are you sure you want to delete this affiliate?')) {
      try {
        clearMessages(); // Clear any existing messages
        console.log('Attempting to delete affiliate:', affiliateId);
        const response = await fetch(`/api/admin/affiliate/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ affiliateId }),
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response not ok. Status:', response.status, 'Body:', errorText);
          setError(`Server error: ${response.status} - ${errorText}`);
          return;
        }

        const responseText = await response.text();
        console.log('Raw response text:', responseText);
        
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.error('Response that failed to parse:', responseText);
          setError('Invalid response from server. Check console for details.');
          return;
        }

        console.log('Parsed result:', result);
        
        if (result.success) {
          fetchAffiliateData();
          setSuccess('Affiliate deleted successfully!');
          // Clear success message after 3 seconds
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setError(result.error || 'Failed to delete affiliate');
        }
      } catch (error) {
        console.error('Delete error:', error);
        setError('Network error. Please try again.');
      }
    }
  };

  const handleSetPassword = (affiliate) => {
    setSelectedAffiliate(affiliate);
    setPasswordData({
      password: '',
      confirmPassword: '',
      notifyAffiliate: true
    });
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.password !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      const response = await fetch('/api/admin/affiliate/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          affiliateId: selectedAffiliate.id,
          password: passwordData.password,
          notifyAffiliate: passwordData.notifyAffiliate
        }),
      });

      if (response.ok) {
        setShowPasswordModal(false);
        setSelectedAffiliate(null);
        setPasswordData({ password: '', confirmPassword: '', notifyAffiliate: true });
        // You could show a success message here
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to set password');
      }
    } catch (error) {
      setError('Failed to set password');
      console.error('Password set error:', error);
    }
  };

  const copyAffiliateLink = (affiliateCode) => {
    const link = `${window.location.origin}/ref/${affiliateCode}`;
    navigator.clipboard.writeText(link);
    // You could add a toast notification here
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'active': 'bg-green-100 text-green-800',
      'inactive': 'bg-gray-100 text-gray-800',
      'suspended': 'bg-red-100 text-red-800',
      'pending': 'bg-yellow-100 text-yellow-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCommissionBadge = (rate) => {
    if (rate >= 15) return 'bg-purple-100 text-purple-800';
    if (rate >= 10) return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  // Filter and pagination logic
  const filteredAffiliates = affiliates.filter(affiliate => {
    const matchesStatus = selectedStatus === "all" || affiliate.status === selectedStatus;
    const matchesSearch = searchTerm === "" || 
      affiliate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affiliate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affiliate.affiliateCode.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const totalItems = filteredAffiliates.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageData = filteredAffiliates.slice(startIndex, endIndex);

  // Update total pages when filtered data changes
  useEffect(() => {
    const newTotalPages = Math.ceil(filteredAffiliates.length / pageSize);
    setTotalPages(newTotalPages);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredAffiliates.length, pageSize, currentPage]);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const exportAffiliateData = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Email,Status,Commission Rate,Total Sales (MWK),Total Commissions (MWK),Pending Payouts (MWK),Join Date\n" +
      filteredAffiliates.map(aff => 
        `${aff.name},${aff.email},${aff.status},${aff.commissionRate}%,${aff.totalSales || 0},${aff.totalCommissions || 0},${aff.pendingPayouts || 0},${new Date(aff.createdAt).toLocaleDateString()}`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `affiliates_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Affiliate Management</h1>
          <p className="text-sm text-gray-500">Manage affiliates, track commissions, and monitor performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportAffiliateData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Affiliate
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Affiliates</p>
              <p className="text-2xl font-bold text-gray-900">{affiliateStats.totalAffiliates}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">{affiliateStats.activeAffiliates}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Commissions</p>
              <p className="text-2xl font-bold text-purple-600">MWK {affiliateStats.totalCommissions.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Payouts</p>
              <p className="text-2xl font-bold text-yellow-600">MWK {affiliateStats.pendingPayouts.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-indigo-600">MWK {affiliateStats.monthlyRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-orange-600">{affiliateStats.conversionRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Total Referrals</p>
            <p className="text-2xl font-bold text-gray-900">{affiliateStats.totalReferrals || 0}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{affiliateStats.completedReferrals || 0}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{affiliateStats.pendingReferrals || 0}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Avg Commission</p>
            <p className="text-2xl font-bold text-blue-600">MWK {(affiliateStats.avgCommissionPerReferral || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search affiliates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm w-64"
            />
          </div>
        </div>
      </div>

      {/* Affiliates Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Affiliates</h3>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} results
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Affiliate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commission
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentPageData.length > 0 ? (
                currentPageData.map((affiliate) => (
                  <tr key={affiliate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-indigo-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{affiliate.name}</div>
                          <div className="text-sm text-gray-500">{affiliate.email}</div>
                          <div className="text-xs text-gray-400">Code: {affiliate.affiliateCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(affiliate.status)}`}>
                        {affiliate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCommissionBadge(affiliate.commissionRate)}`}>
                        {affiliate.commissionRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div>Sales: MWK {(affiliate.totalSales || 0).toLocaleString()}</div>
                        <div>Commissions: MWK {(affiliate.totalCommissions || 0).toLocaleString()}</div>
                        <div className="text-xs text-gray-500">
                          Pending: MWK {(affiliate.pendingPayouts || 0).toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(affiliate.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => copyAffiliateLink(affiliate.affiliateCode)}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          title="Copy affiliate link"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAffiliate(affiliate);
                            setShowDetailsModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAffiliate(affiliate);
                            setFormData({
                              name: affiliate.name,
                              email: affiliate.email,
                              commissionRate: affiliate.commissionRate || 20,
                              status: affiliate.status,
                              paymentMethod: affiliate.paymentMethod || "bank",
                              bankDetails: affiliate.bankDetails || {
                                accountName: "",
                                accountNumber: "",
                                bankName: "",
                                swiftCode: ""
                              }
                            });
                            setShowAddModal(true);
                          }}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Edit affiliate"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleSetPassword(affiliate)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Set password"
                        >
                          <Lock className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAffiliate(affiliate.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete affiliate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    {searchTerm || selectedStatus !== 'all' 
                      ? 'No affiliates match your filters' 
                      : 'No affiliates found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, totalItems)}</span> of{' '}
                <span className="font-medium">{totalItems}</span> results
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                {getPageNumbers().map((page, index) => (
                  <button
                    key={index}
                    onClick={() => typeof page === 'number' && goToPage(page)}
                    disabled={page === '...'}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      page === currentPage
                        ? 'bg-indigo-600 text-white'
                        : page === '...'
                        ? 'text-gray-400 cursor-default'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Affiliate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedAffiliate ? 'Edit Affiliate' : 'Add New Affiliate'}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleAddAffiliate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Rate (%) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formData.commissionRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Saving...' : (selectedAffiliate ? 'Update' : 'Add')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Affiliate Details Modal */}
      {showDetailsModal && selectedAffiliate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Affiliate Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">{selectedAffiliate.name}</h4>
                  <p className="text-sm text-gray-500">{selectedAffiliate.email}</p>
                  <p className="text-sm text-gray-500">Code: {selectedAffiliate.affiliateCode}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Status</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedAffiliate.status)}`}>
                      {selectedAffiliate.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Commission</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCommissionBadge(selectedAffiliate.commissionRate)}`}>
                      {selectedAffiliate.commissionRate}%
                    </span>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h5 className="font-medium text-gray-900 mb-2">Performance</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Total Sales:</span>
                      <p className="font-medium">MWK {(selectedAffiliate.totalSales || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Commissions:</span>
                      <p className="font-medium">MWK {(selectedAffiliate.totalCommissions || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Pending Payouts:</span>
                      <p className="font-medium">MWK {(selectedAffiliate.pendingPayouts || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Join Date:</span>
                      <p className="font-medium">{new Date(selectedAffiliate.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h5 className="font-medium text-gray-900 mb-2">Affiliate Link</h5>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/ref/${selectedAffiliate.affiliateCode}`}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50"
                    />
                    <button
                      onClick={() => copyAffiliateLink(selectedAffiliate.affiliateCode)}
                      className="p-2 text-indigo-600 hover:text-indigo-900"
                      title="Copy link"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Set Password for {selectedAffiliate?.name}
                </h3>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handlePasswordSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                    <input
                      type="password"
                      value={passwordData.password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, password: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter new password"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Password must be at least 8 characters long</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="notifyAffiliate"
                      type="checkbox"
                      checked={passwordData.notifyAffiliate}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, notifyAffiliate: e.target.checked }))}
                      className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="notifyAffiliate" className="ml-2 text-sm text-gray-700">
                      Notify affiliate via email
                    </label>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Set Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-2 text-sm text-green-700">{success}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliatePage; 