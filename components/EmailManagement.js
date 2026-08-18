"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Users, 
  Filter, 
  Search, 
  CheckSquare, 
  Square, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Eye,
  EyeOff,
  FileText,
  User,
  Building,
  Calendar,
  Loader2
} from 'lucide-react';
import EmailComposer from './EmailComposer';

const EmailManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: '',
    message: '',
    htmlContent: '',
    template: 'rich-email',
    priority: 'normal'
  });
  const [attachments, setAttachments] = useState([]);
  const [emailHistory, setEmailHistory] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    selectedCount: 0
  });

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
    fetchEmailHistory();
  }, []);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.tenant.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Tenant filter
    if (tenantFilter !== 'all') {
      filtered = filtered.filter(user => user.tenant === tenantFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, statusFilter, roleFilter, tenantFilter]);

  // Update stats when users or selection changes
  useEffect(() => {
    const activeUsers = users.filter(user => user.status === 'active').length;
    setStats({
      totalUsers: users.length,
      activeUsers,
      selectedCount: selectedUsers.length
    });
  }, [users, selectedUsers]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users?limit=1000');
      const data = await response.json();
      
      if (response.ok) {
        setUsers(data.users || []);
      } else {
        console.error('Error fetching users:', data.error);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailHistory = async () => {
    try {
      const response = await fetch('/api/admin/email-history');
      const data = await response.json();
      
      if (response.ok) {
        setEmailHistory(data.emails || []);
      }
    } catch (error) {
      console.error('Error fetching email history:', error);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const handleSendEmail = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one user to send email to.');
      return;
    }

    if (!emailData.subject.trim() || (!emailData.message.trim() && !emailData.htmlContent.trim())) {
      alert('Please fill in both subject and message.');
      return;
    }

    try {
      setSending(true);
      
      // Upload attachments if any
      const uploadedAttachments = [];
      for (const attachment of attachments) {
        if (attachment.file) {
          const formData = new FormData();
          formData.append('file', attachment.file);
          
          const uploadResponse = await fetch('/api/admin/upload-attachment', {
            method: 'POST',
            body: formData
          });
          
          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            uploadedAttachments.push({
              name: uploadData.file.name,
              url: uploadData.file.url,
              type: uploadData.file.type,
              size: uploadData.file.size
            });
          }
        }
      }

      const response = await fetch('/api/admin/send-bulk-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: selectedUsers,
          subject: emailData.subject,
          message: emailData.message,
          htmlContent: emailData.htmlContent,
          template: emailData.template,
          priority: emailData.priority,
          attachments: uploadedAttachments
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Email sent successfully to ${data.sentCount} users!`);
        setShowEmailForm(false);
        setEmailData({ subject: '', message: '', htmlContent: '', template: 'rich-email', priority: 'normal' });
        setAttachments([]);
        setSelectedUsers([]);
        fetchEmailHistory();
      } else {
        alert(`Error sending email: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Error sending email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <X className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="h-6 w-6" />
            {tt('Email Management')}
          </h2>
          <p className="text-gray-600">{tt('Send emails to users across all tenants')}</p>
        </div>
        <button
          onClick={() => setShowEmailForm(true)}
          disabled={selectedUsers.length === 0}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send className="h-4 w-4" />
          Send Email ({selectedUsers.length})
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">{tt('Total Users')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">{tt('Active Users')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <CheckSquare className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">{tt('Selected')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.selectedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-orange-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">{tt('Emails Sent')}</p>
              <p className="text-2xl font-bold text-gray-900">{emailHistory.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Search')}</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={tt('Search users...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{tt('All Status')}</option>
              <option value="active">{tt('Active')}</option>
              <option value="inactive">{tt('Inactive')}</option>
              <option value="pending">{tt('Pending')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Role')}</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{tt('All Roles')}</option>
              <option value="admin">{tt('Admin')}</option>
              <option value="manager">{tt('Manager')}</option>
              <option value="user">{tt('User')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Tenant')}</label>
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{tt('All Tenants')}</option>
              {Array.from(new Set(users.map(user => user.tenant))).map(tenant => (
                <option key={tenant} value={tenant}>{tenant}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setRoleFilter('all');
                setTenantFilter('all');
              }}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              {tt('Clear Filters')}
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Users ({filteredUsers.length})</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                {selectedUsers.length === filteredUsers.length ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {selectedUsers.length === filteredUsers.length ? tt('Deselect All') : tt('Select All')}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">{tt('Loading users...')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tt('Select')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tt('User')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tt('Role')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tt('Tenant')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tt('Status')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tt('Last Login')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSelectUser(user.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {selectedUsers.includes(user.id) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                          {user.avatar}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{user.role}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{user.tenant}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                        {getStatusIcon(user.status)}
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Form Modal */}
      {showEmailForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{tt('Send Email')}</h3>
              <button
                onClick={() => setShowEmailForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{tt('Recipients:')}</strong> {selectedUsers.length} user(s) selected
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Subject')}</label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={tt('Enter email subject')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Message')}</label>
                <textarea
                  value={emailData.message}
                  onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={tt('Enter your message here...')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Template')}</label>
                  <select
                    value={emailData.template}
                    onChange={(e) => setEmailData({ ...emailData, template: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="custom">{tt('Custom Message')}</option>
                    <option value="announcement">{tt('Announcement')}</option>
                    <option value="maintenance">{tt('Maintenance Notice')}</option>
                    <option value="update">{tt('System Update')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Priority')}</label>
                  <select
                    value={emailData.priority}
                    onChange={(e) => setEmailData({ ...emailData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="normal">{tt('Normal')}</option>
                    <option value="high">{tt('High')}</option>
                    <option value="urgent">{tt('Urgent')}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showPreview ? tt('Hide Preview') : tt('Show Preview')}
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEmailForm(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    {tt('Cancel')}
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {sending ? tt('Sending...') : tt('Send Email')}
                  </button>
                </div>
              </div>

              {showPreview && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-2">{tt('Email Preview')}</h4>
                  <div className="text-sm text-gray-600">
                    <p><strong>{tt('To:')}</strong> {selectedUsers.length} selected users</p>
                    <p><strong>{tt('Subject:')}</strong> {emailData.subject || '(No subject)'}</p>
                    <div className="mt-2 p-3 bg-white rounded border">
                      <div dangerouslySetInnerHTML={{ __html: emailData.message.replace(/\n/g, '<br>') }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailManagement;
