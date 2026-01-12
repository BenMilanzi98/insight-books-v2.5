"use client";
import React, { useState, useEffect } from 'react';
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
import UltimateEmailComposer from './UltimateEmailComposer';

const EnhancedEmailManagement = () => {
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
    priority: 'normal',
    showPriority: false,
    selectedTemplate: 'custom'
  });
  const [attachments, setAttachments] = useState([]);
  const [emailHistory, setEmailHistory] = useState([]);
  const [emailStats, setEmailStats] = useState({ totalEmails: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    selectedCount: 0
  });

  // Email templates
  const emailTemplates = {
    'custom': { subject: '', content: '' },
    'subscription-reminder': {
      subject: 'Subscription Renewal Reminder',
      content: '<p>Dear Valued Customer,</p><p>This is a friendly reminder that your subscription will be expiring soon. To continue enjoying uninterrupted service, please renew your subscription before the expiration date.</p><p>If you have any questions or need assistance, please don\'t hesitate to contact our support team.</p><p>Thank you for being a valued member!</p><p>Best regards,<br>InsightBooks Team</p>'
    },
    'announcement': {
      subject: 'Important Announcement',
      content: '<p>Dear Team,</p><p>We have an important announcement to share with you.</p><p>Please review the details below and let us know if you have any questions.</p><p>Thank you for your attention.</p><p>Best regards,<br>Management</p>'
    },
    'welcome': {
      subject: 'Welcome to InsightBooks!',
      content: '<p>Dear New User,</p><p>Welcome to InsightBooks! We\'re excited to have you on board.</p><p>Your account has been successfully created and you can now start using our platform. Here are some quick tips to get you started:</p><ul><li>Explore the dashboard to see your overview</li><li>Set up your profile and preferences</li><li>Check out our help documentation</li></ul><p>If you need any assistance, our support team is here to help.</p><p>Welcome aboard!</p><p>Best regards,<br>InsightBooks Team</p>'
    },
    'maintenance-notice': {
      subject: 'Scheduled Maintenance Notice',
      content: '<p>Dear Users,</p><p>We would like to inform you that we will be performing scheduled maintenance on our system.</p><p><strong>Maintenance Window:</strong> [Date and Time]</p><p>During this time, the system may be temporarily unavailable. We apologize for any inconvenience this may cause.</p><p>Thank you for your understanding.</p><p>Best regards,<br>Technical Team</p>'
    },
    'feature-update': {
      subject: 'New Feature Available!',
      content: '<p>Dear Users,</p><p>We\'re excited to announce a new feature that we\'ve added to improve your experience!</p><p><strong>New Feature:</strong> [Feature Name]</p><p>This feature will help you [benefit]. To learn more, please check out our documentation or contact support.</p><p>We hope you enjoy this new addition!</p><p>Best regards,<br>Product Team</p>'
    },
    'password-reset': {
      subject: 'Password Reset Request',
      content: '<p>Dear User,</p><p>We received a request to reset your password. If you made this request, please click the link below to reset your password:</p><p><a href="#">Reset Password</a></p><p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p><p>This link will expire in 24 hours for security reasons.</p><p>Best regards,<br>Security Team</p>'
    }
  };

  // Apply template to email data
  const applyTemplate = (templateKey, setEmailData) => {
    const template = emailTemplates[templateKey];
    if (template) {
      setEmailData(prev => ({
        ...prev,
        subject: template.subject,
        htmlContent: template.content
      }));
    }
  };

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
    fetchEmailHistory();
  }, []);

  // Filter users when search term or filters change
  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (tenantFilter !== 'all') {
      filtered = filtered.filter(user => user.tenant === tenantFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, statusFilter, roleFilter, tenantFilter]);

  // Update stats when users or selected users change
  useEffect(() => {
    setStats({
      totalUsers: users.length,
      activeUsers: users.filter(user => user.status === 'active').length,
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
      // Fetch with a high limit to get all emails, or get total count
      const response = await fetch('/api/admin/email-history?limit=10000');
      const data = await response.json();
      
      if (response.ok) {
        setEmailHistory(data.emails || []);
        // Use total count from pagination if available, otherwise use array length
        setEmailStats({
          totalEmails: data.pagination?.totalEmails || data.emails?.length || 0
        });
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
          priority: emailData.showPriority ? emailData.priority : null,
          showPriority: emailData.showPriority,
          attachments: uploadedAttachments
        })
      });

      const data = await response.json();

      if (response.ok) {
        const message = data.failedCount > 0
          ? `Email sent to ${data.sentCount} users. ${data.failedCount} failed.${data.invalidEmails > 0 ? ` ${data.invalidEmails} users have invalid emails.` : ''}`
          : `Email sent successfully to ${data.sentCount} users!`;
        
        if (data.failedCount > 0 && data.results?.failed) {
          const failedEmails = data.results.failed.slice(0, 5).map(f => f.email).join(', ');
          const moreCount = data.results.failed.length > 5 ? ` and ${data.results.failed.length - 5} more` : '';
          console.warn('Failed emails:', data.results.failed);
          alert(`${message}\n\nFailed emails: ${failedEmails}${moreCount}\n\nCheck console for full details.`);
        } else {
          alert(message);
        }
        
        setShowEmailForm(false);
        setEmailData({ subject: '', message: '', htmlContent: '', template: 'rich-email', priority: 'normal', showPriority: false, selectedTemplate: 'custom' });
        setAttachments([]);
        setSelectedUsers([]);
        fetchEmailHistory();
      } else {
        alert(`Error sending email: ${data.error || data.message || 'Unknown error'}`);
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
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Management</h1>
          <p className="text-gray-600 mt-1">Send rich emails with attachments to users</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {stats.totalUsers} total users • {stats.activeUsers} active • {stats.selectedCount} selected
          </div>
          <button
            onClick={() => setShowEmailForm(true)}
            disabled={selectedUsers.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Mail className="h-4 w-4" />
            <span>Send Email</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Users</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Emails Sent</p>
              <p className="text-2xl font-semibold text-gray-900">{emailStats.totalEmails || emailHistory.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Send className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Selected</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.selectedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search users..."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tenant</label>
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tenants</option>
              {Array.from(new Set(users.map(user => user.tenant))).map(tenant => (
                <option key={tenant} value={tenant}>{tenant}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Users</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
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
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Send Rich Email</h3>
              <button
                onClick={() => setShowEmailForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Recipients:</strong> {selectedUsers.length} user(s) selected
                </p>
              </div>

              <UltimateEmailComposer
                subject={emailData.subject}
                setSubject={(value) => setEmailData({...emailData, subject: value})}
                message={emailData.htmlContent}
                setMessage={(value) => setEmailData({...emailData, htmlContent: value})}
                attachments={attachments}
                setAttachments={setAttachments}
                onSend={handleSendEmail}
                isSending={sending}
                priority={emailData.priority}
                setPriority={(value) => setEmailData({...emailData, priority: value})}
                showPriority={emailData.showPriority}
                setShowPriority={(value) => setEmailData({...emailData, showPriority: value})}
                selectedTemplate={emailData.selectedTemplate}
                setSelectedTemplate={(value) => {
                  const newData = {...emailData, selectedTemplate: value};
                  // Apply template content if template is selected
                  if (value !== 'custom') {
                    const template = emailTemplates[value];
                    if (template) {
                      newData.subject = template.subject;
                      newData.htmlContent = template.content;
                    }
                  }
                  setEmailData(newData);
                }}
              />
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default EnhancedEmailManagement;
