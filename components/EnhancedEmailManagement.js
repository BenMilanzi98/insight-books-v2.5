"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, 
  Send, 
  Users, 
  CheckSquare, 
  Square, 
  CheckCircle,
} from 'lucide-react';
import UltimateEmailComposer from './UltimateEmailComposer';
import {
  AdminSummaryCard,
  AdminFilterBar,
  AdminField,
  AdminDataTable,
  AdminStatusBadge,
  AdminLoadingState,
  AdminEmptyState,
  AdminModal,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';

function userStatusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'inactive') return 'danger';
  return 'neutral';
}

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

  const columns = useMemo(
    () => [
      {
        key: 'select',
        header: 'Select',
        render: (user) => (
          <button
            type="button"
            onClick={() => handleSelectUser(user.id)}
            className="text-[var(--action-primary)]"
            aria-label={selectedUsers.includes(user.id) ? 'Deselect user' : 'Select user'}
          >
            {selectedUsers.includes(user.id) ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        ),
      },
      {
        key: 'user',
        header: 'User',
        render: (user) => (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-muted)] text-sm font-medium text-[var(--admin-text)]">
              {user.avatar}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-[var(--admin-text)]">{user.name}</div>
              <div className="truncate text-xs text-[var(--admin-text-muted)]">{user.email}</div>
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        render: (user) => user.role || '—',
      },
      {
        key: 'tenant',
        header: 'Tenant',
        render: (user) => user.tenant || '—',
      },
      {
        key: 'status',
        header: 'Status',
        render: (user) => (
          <AdminStatusBadge tone={userStatusTone(user.status)}>{user.status}</AdminStatusBadge>
        ),
      },
      {
        key: 'lastLogin',
        header: 'Last Login',
        render: (user) =>
          user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never',
      },
    ],
    [selectedUsers]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--admin-text-muted)]">
          {stats.totalUsers} total users · {stats.activeUsers} active · {stats.selectedCount} selected
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleSelectAll} className={btnGhost} disabled={filteredUsers.length === 0}>
            {selectedUsers.length === filteredUsers.length && filteredUsers.length > 0
              ? 'Deselect all'
              : 'Select all'}
          </button>
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            disabled={selectedUsers.length === 0}
            className={btnPrimary}
          >
            <Mail className="h-4 w-4" aria-hidden />
            Send email
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Total Users" value={stats.totalUsers} icon={Users} />
        <AdminSummaryCard label="Active Users" value={stats.activeUsers} tone="success" icon={CheckCircle} />
        <AdminSummaryCard
          label="Emails Sent"
          value={emailStats.totalEmails || emailHistory.length}
          icon={Mail}
        />
        <AdminSummaryCard label="Selected" value={stats.selectedCount} icon={Send} tone="warning" />
      </div>

      <AdminFilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search users…"
      >
        <AdminField label="Status" htmlFor="email-status-filter">
          <AdminField.Select
            id="email-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </AdminField.Select>
        </AdminField>
        <AdminField label="Role" htmlFor="email-role-filter">
          <AdminField.Select
            id="email-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="manager">Manager</option>
          </AdminField.Select>
        </AdminField>
        <AdminField label="Tenant" htmlFor="email-tenant-filter">
          <AdminField.Select
            id="email-tenant-filter"
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
          >
            <option value="all">All Tenants</option>
            {Array.from(new Set(users.map((user) => user.tenant).filter(Boolean))).map((tenant) => (
              <option key={tenant} value={tenant}>
                {tenant}
              </option>
            ))}
          </AdminField.Select>
        </AdminField>
      </AdminFilterBar>

      {loading ? <AdminLoadingState label="Loading users" /> : null}
      {!loading && filteredUsers.length === 0 ? (
        <AdminEmptyState title="No users match" description="Adjust filters to find recipients." />
      ) : null}
      {!loading && filteredUsers.length > 0 ? (
        <AdminDataTable columns={columns} rows={filteredUsers} rowKey="id" />
      ) : null}

      <AdminModal
        open={showEmailForm}
        onClose={() => setShowEmailForm(false)}
        title="Send Rich Email"
        size="lg"
        className="max-w-4xl"
      >
        <div className="mb-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-sm text-[var(--admin-text)]">
          <strong>Recipients:</strong> {selectedUsers.length} user(s) selected
        </div>
        <UltimateEmailComposer
          subject={emailData.subject}
          setSubject={(value) => setEmailData({ ...emailData, subject: value })}
          message={emailData.htmlContent}
          setMessage={(value) => setEmailData({ ...emailData, htmlContent: value })}
          attachments={attachments}
          setAttachments={setAttachments}
          onSend={handleSendEmail}
          isSending={sending}
          priority={emailData.priority}
          setPriority={(value) => setEmailData({ ...emailData, priority: value })}
          showPriority={emailData.showPriority}
          setShowPriority={(value) => setEmailData({ ...emailData, showPriority: value })}
          selectedTemplate={emailData.selectedTemplate}
          setSelectedTemplate={(value) => {
            const newData = { ...emailData, selectedTemplate: value };
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
      </AdminModal>
    </div>
  );
};

export default EnhancedEmailManagement;
