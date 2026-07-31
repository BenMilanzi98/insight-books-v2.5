"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  MoreVertical, 
  Mail, 
  Phone, 
  AlertCircle, 
  CheckCircle, 
  User, 
  Briefcase, 
  MapPin, 
  DollarSign,
  Calendar,
  FileText,
  Edit,
  Trash2,
  X,
  ExternalLink,
  Upload
} from "lucide-react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import BulkClientUpload from "@/components/Clients/BulkClientUpload";
import InvoiceModal from "@/components/InvoiceModal";
import PaymentModal from "@/components/PaymentModal";
import PageHeader from "@/components/shell/PageHeader";
import Button from "@/components/ui/Button";


// Client service functions for API interaction
const clientService = {
  // Fetch clients with optional filtering and pagination
  fetchClients: async (params = {}) => {
    try {
      const { search, status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = params;
      
      // Build query string
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);
      queryParams.append('page', page);
      queryParams.append('limit', limit);
      queryParams.append('sortBy', sortBy);
      queryParams.append('sortOrder', sortOrder);
      
      const queryString = queryParams.toString();
      const url = `/api/clients?${queryString}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        let detail = response.statusText;
        try {
          const body = await response.json();
          detail = body.detail || body.error || detail;
        } catch (_) {
          /* ignore non-JSON error bodies */
        }
        throw new Error(`Error fetching clients: ${detail}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }
  },

  // Get client stats
  getClientStatistics: async () => {
    try {
      const response = await fetch('/api/clients/statistics');
      if (!response.ok) {
        let detail = response.statusText;
        try {
          const body = await response.json();
          detail = body.detail || body.error || detail;
        } catch (_) {
          /* ignore non-JSON error bodies */
        }
        throw new Error(`Error fetching client statistics: ${detail}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching client statistics:', error);
      throw error;
    }
  },

  // Create a new client
  createClient: async (clientData) => {
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });
      
      if (!response.ok) {
        throw new Error(`Error creating client: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  },

  // Update existing client
  updateClient: async (clientId, clientData) => {
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });
      
      if (!response.ok) {
        throw new Error(`Error updating client: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating client ${clientId}:`, error);
      throw error;
    }
  },

  // Delete a client
  deleteClient: async (clientId) => {
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting client: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting client ${clientId}:`, error);
      throw error;
    }
  },

  // Get client invoices
  getClientInvoices: async (clientId) => {
    try {
      const response = await fetch(`/api/clients/${clientId}/invoices`);
      
      if (!response.ok) {
        throw new Error(`Error fetching client invoices: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching invoices for client ${clientId}:`, error);
      throw error;
    }
  },

  // Balance reminder template
  getBalanceReminderTemplate: async () => {
    const res = await fetch('/api/clients/balance-reminder-template');
    if (!res.ok) throw new Error('Failed to fetch template');
    return res.json();
  },
  updateBalanceReminderTemplate: async (data) => {
    const res = await fetch('/api/clients/balance-reminder-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update template');
    return res.json();
  },
  downloadBalanceReminderPdf: async (clientId) => {
    const res = await fetch(`/api/clients/${clientId}/balance-reminder-pdf`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to download');
    return { blob: await res.blob() };
  },
  sendBalanceReminder: async (clientId) => {
    const res = await fetch(`/api/clients/${clientId}/balance-reminder`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to send reminder');
    }
    return res.json();
  },
  sendBulkBalanceReminders: async (clientIds) => {
    const res = await fetch('/api/clients/bulk-balance-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientIds })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to send reminders');
    }
    return res.json();
  },
  // Full client record (profile + invoices + payments + sales)
  getClientRecord: async (clientId) => {
    const res = await fetch(`/api/clients/${clientId}/record`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to load client record');
    }
    return res.json();
  },

  // Download client account summary (trading history)
  downloadAccountSummary: async (clientId, format = 'csv') => {
    const res = await fetch(`/api/clients/${clientId}/account-summary?format=${format}`);
    if (!res.ok) throw new Error('Failed to download');
    const ext = format === 'excel' ? 'xlsx' : format;
    return { blob: await res.blob(), contentType: res.headers.get('Content-Type'), ext };
  },

  // Export clients as CSV
  exportClients: async (format = 'csv') => {
    try {
      const response = await fetch(`/api/clients/export?format=${format}`);
      
      if (!response.ok) {
        throw new Error(`Error exporting clients: ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Error exporting clients:', error);
      throw error;
    }
  }
};

// Client Form Component
const ClientForm = ({ client, onSubmit, onCancel, isSubmitting }) => {
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    industry: "",
    status: "Active",
    additionalEmails: []
  });

  // If editing, populate the form with client data
  useEffect(() => {
    if (client) {
      const extra = Array.isArray(client.additionalEmails) ? client.additionalEmails : [];
      setFormData({
        name: client.name || "",
        contactPerson: client.contactPerson || client.contact || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        industry: client.industry || "",
        status: client.status || "Active",
        additionalEmails: extra
      });
    }
  }, [client]);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">{client ? "Edit Client" : "Add New Client"}</h2>
        <button className="text-gray-500 hover:text-gray-700" onClick={onCancel}>
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter business name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label>
            <input
              type="text"
              name="contactPerson"
              value={formData.contactPerson}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Primary contact name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Contact email"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Contact phone"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional email addresses (for invoices)</label>
            <textarea
              name="additionalEmailsRaw"
              rows={3}
              value={(formData.additionalEmails || []).join('\n')}
              onChange={(e) => {
                const raw = e.target.value || '';
                const list = raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
                setFormData(prev => ({ ...prev, additionalEmails: list }));
              }}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px]"
              placeholder="One per line or comma-separated, e.g. accounts@client.com, finance@client.com"
            />
            <p className="mt-1 text-xs text-gray-500">Use Enter for a new line or commas between addresses. Invoices can be sent to these in addition to the primary email.</p>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Business address"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <input
              type="text"
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Client industry"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && (
              <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            )}
            {client ? "Update Client" : "Create Client"}
          </button>
        </div>
      </form>
    </div>
  );
};

// Main Client Management Component
const ClientManagement = () => {
  // State management
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedClient, setSelectedClient] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [statistics, setStatistics] = useState({
    activeCount: 0,
    inactiveCount: 0,
    totalOutstanding: 0,
    totalBilled: 0
  });
  const [clientInvoices, setClientInvoices] = useState([]);
  const [clientRecord, setClientRecord] = useState(null);
  const [loadingClientRecord, setLoadingClientRecord] = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '' });
  const [emailFiles, setEmailFiles] = useState([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBalanceReminderTemplateModal, setShowBalanceReminderTemplateModal] = useState(false);
  const [balanceReminderTemplate, setBalanceReminderTemplate] = useState({ subject: '', body: '' });
  const [balanceReminderTemplateSaving, setBalanceReminderTemplateSaving] = useState(false);
  const [sendingBalanceReminder, setSendingBalanceReminder] = useState(false);
  const [downloadingReminderPdf, setDownloadingReminderPdf] = useState(false);
  const [downloadingAccountSummary, setDownloadingAccountSummary] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [sendingBulkReminders, setSendingBulkReminders] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [pagePermissions, setPagePermissions] = useState({
    canViewClients: false,
    canCreateClient: false,
    canExportClients: false,
    canUpdateClients:false, 
    canDeleteClients:false, 
    canCreatePayments:false,
    canCreateInvoices:false
  
  });
  
  // Pagination state (consistent with inventory)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1
  });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  useEffect(() => {
    const fetchPermissions = async () => {
      const canViewClients = await getPermission("clients.view");
      const canCreateClient = await getPermission("clients.create");
      const canExportClients = await getPermission("clients.export");
      const canUpdateClients = await getPermission("clients.update");
      const canDeleteClients = await getPermission("clients.delete"); 
      const canCreatePayments = await getPermission("payments.create");
      const canCreateInvoices =  await getPermission("invoices.create");
  
      setPagePermissions({
      canViewClients,
      canCreateClient,
      canExportClients,
      canUpdateClients, 
      canDeleteClients,  
      canCreatePayments,
      canCreateInvoices
        });
    };
  
    fetchPermissions();
  }, []);
  
  // Load clients and statistics on initial render
  useEffect(() => {
    loadClients();
    loadStatistics();
  }, []);
  
  // Reload clients when pagination changes
  useEffect(() => {
    loadClients();
  }, [pagination.currentPage, pagination.pageSize, searchTerm, statusFilter, sortBy, sortOrder]);
  
  // Handle search and filter changes
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1 when search/filter changes
    }, 500);
    
    setSearchTimeout(timeout);
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTerm, statusFilter]);
  
  // Load client data with pagination
  const loadClients = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params = {
        search: searchTerm,
        status: statusFilter !== "All" ? statusFilter : null,
        page: pagination.currentPage,
        limit: pagination.pageSize,
        sortBy,
        sortOrder
      };
      
      // For development, we'll use the dummy data until the API is ready
      const data = await clientService.fetchClients(params).catch(() => {
        // Fallback to dummy data if API fails
        const filteredClients = initialClients.filter(client => {
          const matchesSearch = !searchTerm || 
            client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.email.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesStatus = statusFilter === "All" || client.status === statusFilter;
          
          return matchesSearch && matchesStatus;
        });
        
        // Simple pagination for dummy data
        const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
        const endIndex = startIndex + pagination.pageSize;
        const paginatedClients = filteredClients.slice(startIndex, endIndex);
        
        return {
          clients: paginatedClients,
          pagination: {
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalItems: filteredClients.length,
            totalPages: Math.ceil(filteredClients.length / pagination.pageSize)
          }
        };
      });
      
      setClients(data.clients || []);
      
      // Update pagination state (matching inventory structure)
      if (data.pagination) {
        setPagination(prev => ({
          ...prev,
          currentPage: data.pagination.currentPage,
          pageSize: data.pagination.pageSize,
          totalItems: data.pagination.totalItems,
          totalPages: data.pagination.totalPages
        }));
      }
      
      // Refresh statistics to ensure they match the current data
      loadStatistics();
    } catch (error) {
      console.error("Error loading clients:", error);
      setError("Failed to load clients. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle pagination (consistent with inventory)
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handlePageSizeChange = (newPageSize) => {
    setPagination(prev => ({ 
      ...prev, 
      pageSize: newPageSize,
      currentPage: 1 // Reset to first page when changing page size
    }));
  };
  
  // Load statistics
  const loadStatistics = async () => {
    try {
      // Try to get from API, fall back to calculated stats from clients
      const stats = await clientService.getClientStatistics().catch(() => {
        // Calculate from client data as fallback
        return {
          activeCount: clients.filter(c => c.status === "Active").length,
          inactiveCount: clients.filter(c => c.status === "Inactive").length,
          totalOutstanding: clients.reduce((sum, client) => sum + (client.outstandingAmount || 0), 0),
          totalBilled: clients.reduce((sum, client) => sum + (client.totalBilled || 0), 0)
        };
      });
      
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
      // Don't set error state for statistics, just log it
    }
  };
  
  // Load full client record (totals, invoices, payments, sales)
  const loadClientRecord = async (clientId) => {
    setLoadingClientRecord(true);
    try {
      const data = await clientService.getClientRecord(clientId);
      setClientRecord(data);
      setClientInvoices(data.invoices || []);
      if (data.client) {
        setSelectedClient((prev) => ({
          ...(prev || {}),
          ...data.client,
          totalBilled: data.totals?.totalPurchases ?? prev?.totalBilled,
          outstandingAmount: data.totals?.outstanding ?? prev?.outstandingAmount,
          status: data.client.status,
        }));
      }
    } catch (error) {
      console.error(`Error loading record for client ${clientId}:`, error);
      setClientRecord(null);
      setClientInvoices([]);
    } finally {
      setLoadingClientRecord(false);
    }
  };
  
  // Handle client selection
  const handleClientClick = async (client) => {
    setSelectedClient(client);
    setDetailTab('overview');
    setClientRecord(null);
    setIsDetailOpen(true);
    loadClientRecord(client.id);
  };
  
  // Open form for creating a new client
  const handleAddClient = () => {
    setSelectedClient(null);
    setIsEditing(false);
    setIsFormOpen(true);
  };
  
  // Open form for editing a client
  const handleEditClient = (client, e) => {
    if (e) e.stopPropagation(); // Prevent triggering the row click
    setSelectedClient(client);
    setIsEditing(true);
    setIsFormOpen(true);
  };
  
  // Handle client deletion
  const handleDeleteClient = async (clientId, e) => {
    if (e) e.stopPropagation(); // Prevent triggering the row click
    
    if (confirm("Are you sure you want to delete this client?")) {
      try {
        await clientService.deleteClient(clientId).catch(() => {
          // Proceed with UI update even if API fails for demo
          console.log("API call failed, but proceeding with UI update");
        });
        
        // Update UI
        setClients(clients.filter(client => client.id !== clientId));
        
        // Close detail view if open
        if (isDetailOpen && selectedClient && selectedClient.id === clientId) {
          setIsDetailOpen(false);
        }
        
        // Refresh statistics
        loadStatistics();
      } catch (error) {
        console.error(`Error deleting client ${clientId}:`, error);
        alert("Failed to delete client. Please try again.");
      }
    }
  };
  
  // Handle form submission
  const handleFormSubmit = async (formData) => {
    setIsSubmitting(true);
    
    try {
      if (isEditing && selectedClient) {
        // Update existing client
        const updated = await clientService.updateClient(selectedClient.id, formData).catch(() => {
          // Mock response for demo
          return {
            client: {
              ...selectedClient,
              ...formData
            }
          };
        });
        
        // Update clients list
        setClients(clients.map(c => 
          c.id === selectedClient.id ? {...c, ...updated.client} : c
        ));
        
        // Update selected client if detail view is open
        if (isDetailOpen && selectedClient.id === updated.client.id) {
          setSelectedClient({...selectedClient, ...updated.client});
        }
      } else {
        // Create new client
        const created = await clientService.createClient(formData).catch(() => {
          // Mock response for demo
          return {
            client: {
              id: `new-${Date.now()}`,
              ...formData,
              outstandingAmount: 0,
              totalBilled: 0,
              lastInvoice: new Date().toISOString()
            }
          };
        });
        
        // Add to clients list
        setClients([created.client, ...clients]);
      }
      
      // Close form
      setIsFormOpen(false);
      
      // Refresh statistics
      loadStatistics();
    } catch (error) {
      console.error("Error saving client:", error);
      alert("Failed to save client. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle bulk upload completion
  const handleBulkUploadComplete = async (result) => {
    // Small delay to ensure database transaction is committed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Refresh clients after successful upload
    await loadClients();
    await loadStatistics();
    
    // Show success message
    setSuccessMessage(`Successfully imported ${result.totalProcessed} clients`);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  // Handle export
  const handleExport = async (format = 'csv') => {
    try {
      const blob = await clientService.exportClients(format).catch(() => {
        // Create CSV content as fallback
        const headers = ['ID', 'Name', 'Contact Person', 'Email', 'Phone', 'Status', 'Outstanding', 'Total Billed'];
        const rows = clients.map(c => [
          c.id,
          c.name,
          c.contactPerson || c.contact,
          c.email,
          c.phone,
          c.status,
          c.outstandingAmount,
          c.totalBilled
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map(r => r.join(','))
        ].join('\n');
        
        return new Blob([csvContent], {type: 'text/csv'});
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `clients-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting clients:", error);
      alert("Export failed. Please try again.");
    }
  };

  const handleOpenBalanceReminderTemplate = async () => {
    setShowBalanceReminderTemplateModal(true);
    try {
      const t = await clientService.getBalanceReminderTemplate();
      setBalanceReminderTemplate({ subject: t.subject || '', body: t.body || '' });
    } catch {
      setBalanceReminderTemplate({ subject: 'Outstanding balance reminder', body: 'Dear {{clientName}},\n\nThis is a friendly reminder that you have an outstanding balance of {{balance}}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.' });
    }
  };

  const handleSaveBalanceReminderTemplate = async () => {
    if (!balanceReminderTemplate.subject?.trim() || !balanceReminderTemplate.body?.trim()) {
      alert('Subject and body are required.');
      return;
    }
    setBalanceReminderTemplateSaving(true);
    try {
      await clientService.updateBalanceReminderTemplate(balanceReminderTemplate);
      setSuccessMessage('Balance reminder template saved.');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowBalanceReminderTemplateModal(false);
    } catch (e) {
      alert(e.message || 'Failed to save template.');
    } finally {
      setBalanceReminderTemplateSaving(false);
    }
  };

  const handleSendBalanceReminder = async () => {
    if (!selectedClient?.id) return;
    setSendingBalanceReminder(true);
    try {
      await clientService.sendBalanceReminder(selectedClient.id);
      setSuccessMessage('Balance reminder sent.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (e) {
      alert(e.message || 'Failed to send balance reminder.');
    } finally {
      setSendingBalanceReminder(false);
    }
  };

  const handleDownloadBalanceReminderPdf = async () => {
    if (!selectedClient?.id) return;
    setDownloadingReminderPdf(true);
    try {
      const { blob } = await clientService.downloadBalanceReminderPdf(selectedClient.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `balance-reminder-${(selectedClient.name || 'client').replace(/\s+/g, '-')}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccessMessage('Reminder PDF downloaded.');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (e) {
      alert(e.message || 'Download failed.');
    } finally {
      setDownloadingReminderPdf(false);
    }
  };

  const toggleClientSelection = (clientId, e) => {
    if (e) e.stopPropagation();
    setSelectedClientIds(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const toggleSelectAllOnPage = (e) => {
    if (e) e.stopPropagation();
    const pageIds = clients.map(c => c.id);
    const allSelected = pageIds.every(id => selectedClientIds.includes(id));
    setSelectedClientIds(allSelected ? [] : pageIds);
  };

  const handleSendBulkBalanceReminders = async () => {
    if (selectedClientIds.length === 0) return;
    setSendingBulkReminders(true);
    try {
      const data = await clientService.sendBulkBalanceReminders(selectedClientIds);
      setSelectedClientIds([]);
      const msg = data.failed > 0
        ? `Sent to ${data.sent} of ${data.total} clients. ${data.failed} had no balance or no email.`
        : `Payment reminders sent to ${data.sent} client(s).`;
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (e) {
      alert(e.message || 'Failed to send reminders.');
    } finally {
      setSendingBulkReminders(false);
    }
  };

  const handleDownloadAccountSummary = async (format) => {
    if (!selectedClient?.id) return;
    setDownloadingAccountSummary(true);
    try {
      const { blob, ext } = await clientService.downloadAccountSummary(selectedClient.id, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `account-summary-${(selectedClient.name || 'client').replace(/\s+/g, '-')}-${Date.now()}.${ext || format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccessMessage('Download started.');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (e) {
      alert(e.message || 'Download failed.');
    } finally {
      setDownloadingAccountSummary(false);
    }
  };

  // Format currency in Malawi Kwacha
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-MW', { 
      style: 'currency', 
      currency: 'MWK',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    // Format date as DD-MM-YYYY
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return '';
    }
  };
  
  // Legacy formatDate function (kept for backward compatibility, but not used)
  const formatDateLegacy = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Dummy data for initial rendering/fallback (expanded for pagination testing)
  const initialClients = [
    { 
      id: 1, 
      name: "Acme Corporation", 
      contact: "John Smith", 
      contactPerson: "John Smith",
      email: "john@acme.com", 
      phone: "+265 999 123 456", 
      status: "Active", 
      totalBilled: 1250000, 
      outstandingAmount: 32000,
      lastInvoice: "2025-02-15",
      address: "123 Business Park, Lilongwe",
      industry: "Manufacturing"
    },
    { 
      id: 2, 
      name: "TechSolutions Inc", 
      contact: "Sarah Johnson", 
      contactPerson: "Sarah Johnson",
      email: "sarah@techsolutions.com", 
      phone: "+265 888 234 567", 
      status: "Active", 
      totalBilled: 980000, 
      outstandingAmount: 0,
      lastInvoice: "2025-02-28",
      address: "45 Innovation Drive, Blantyre",
      industry: "Technology"
    },
    { 
      id: 3, 
      name: "Global Traders Ltd", 
      contact: "Michael Wong", 
      contactPerson: "Michael Wong",
      email: "michael@globaltraders.com", 
      phone: "+265 999 345 678", 
      status: "Inactive", 
      totalBilled: 650000, 
      outstandingAmount: 150000,
      lastInvoice: "2025-01-10",
      address: "78 Harbor Road, Zomba",
      industry: "Import/Export"
    },
    { 
      id: 4, 
      name: "Sunrise Hotels", 
      contact: "Lisa Banda", 
      contactPerson: "Lisa Banda",
      email: "lisa@sunrisehotels.com", 
      phone: "+265 888 456 789", 
      status: "Active", 
      totalBilled: 2350000, 
      outstandingAmount: 450000,
      lastInvoice: "2025-03-01",
      address: "10 Lakeshore Drive, Mangochi",
      industry: "Hospitality"
    },
    { 
      id: 5, 
      name: "Eco Farms", 
      contact: "David Phiri", 
      contactPerson: "David Phiri",
      email: "david@ecofarms.com", 
      phone: "+265 999 567 890", 
      status: "Active", 
      totalBilled: 875000, 
      outstandingAmount: 125000,
      lastInvoice: "2025-02-20",
      address: "200 Rural Road, Mzuzu",
      industry: "Agriculture"
    },
    { 
      id: 6, 
      name: "Malawi Construction Co", 
      contact: "Grace Mwale", 
      contactPerson: "Grace Mwale",
      email: "grace@malawiconstruction.com", 
      phone: "+265 999 678 901", 
      status: "Active", 
      totalBilled: 3200000, 
      outstandingAmount: 750000,
      lastInvoice: "2025-03-05",
      address: "15 Industrial Area, Lilongwe",
      industry: "Construction"
    },
    { 
      id: 7, 
      name: "Digital Marketing Pro", 
      contact: "James Mwenda", 
      contactPerson: "James Mwenda",
      email: "james@digitalmarketingpro.com", 
      phone: "+265 888 789 012", 
      status: "Active", 
      totalBilled: 450000, 
      outstandingAmount: 0,
      lastInvoice: "2025-02-25",
      address: "22 Tech Hub, Blantyre",
      industry: "Marketing"
    },
    { 
      id: 8, 
      name: "Fresh Produce Ltd", 
      contact: "Mary Chisale", 
      contactPerson: "Mary Chisale",
      email: "mary@freshproduce.com", 
      phone: "+265 999 890 123", 
      status: "Active", 
      totalBilled: 1800000, 
      outstandingAmount: 200000,
      lastInvoice: "2025-03-02",
      address: "8 Market Square, Zomba",
      industry: "Agriculture"
    },
    { 
      id: 9, 
      name: "Transport Solutions", 
      contact: "Peter Kachale", 
      contactPerson: "Peter Kachale",
      email: "peter@transportsolutions.com", 
      phone: "+265 888 901 234", 
      status: "Inactive", 
      totalBilled: 950000, 
      outstandingAmount: 300000,
      lastInvoice: "2025-01-15",
      address: "30 Transport Hub, Mzuzu",
      industry: "Transportation"
    },
    { 
      id: 10, 
      name: "Medical Supplies Inc", 
      contact: "Dr. Anna Mwangi", 
      contactPerson: "Dr. Anna Mwangi",
      email: "anna@medicalsupplies.com", 
      phone: "+265 999 012 345", 
      status: "Active", 
      totalBilled: 2100000, 
      outstandingAmount: 0,
      lastInvoice: "2025-03-01",
      address: "12 Health District, Lilongwe",
      industry: "Healthcare"
    },
    { 
      id: 11, 
      name: "Education Services", 
      contact: "Prof. John Banda", 
      contactPerson: "Prof. John Banda",
      email: "john@educationservices.com", 
      phone: "+265 888 123 456", 
      status: "Active", 
      totalBilled: 750000, 
      outstandingAmount: 50000,
      lastInvoice: "2025-02-28",
      address: "25 University Road, Blantyre",
      industry: "Education"
    },
    { 
      id: 12, 
      name: "Energy Solutions", 
      contact: "Engineer Sarah Phiri", 
      contactPerson: "Engineer Sarah Phiri",
      email: "sarah@energysolutions.com", 
      phone: "+265 999 234 567", 
      status: "Active", 
      totalBilled: 1500000, 
      outstandingAmount: 100000,
      lastInvoice: "2025-03-03",
      address: "18 Power Station Road, Zomba",
      industry: "Energy"
    },
    { 
      id: 13, 
      name: "Financial Advisory", 
      contact: "Accountant Mike Mwale", 
      contactPerson: "Accountant Mike Mwale",
      email: "mike@financialadvisory.com", 
      phone: "+265 888 345 678", 
      status: "Active", 
      totalBilled: 600000, 
      outstandingAmount: 0,
      lastInvoice: "2025-02-20",
      address: "7 Banking Street, Lilongwe",
      industry: "Finance"
    },
    { 
      id: 14, 
      name: "Tourism & Travel", 
      contact: "Guide Lucy Chisale", 
      contactPerson: "Guide Lucy Chisale",
      email: "lucy@tourismtravel.com", 
      phone: "+265 999 456 789", 
      status: "Active", 
      totalBilled: 850000, 
      outstandingAmount: 75000,
      lastInvoice: "2025-02-25",
      address: "14 Tourism Center, Mangochi",
      industry: "Tourism"
    },
    { 
      id: 15, 
      name: "Real Estate Group", 
      contact: "Agent Tom Mwenda", 
      contactPerson: "Agent Tom Mwenda",
      email: "tom@realestategroup.com", 
      phone: "+265 888 567 890", 
      status: "Inactive", 
      totalBilled: 2800000, 
      outstandingAmount: 500000,
      lastInvoice: "2025-01-20",
      address: "20 Property Plaza, Mzuzu",
      industry: "Real Estate"
    }
  ];

  return (
    <PermissionGuard permission="clients.view">   
    <div className="p-4 sm:p-6">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage('')}
              className="ml-auto text-green-400 hover:text-green-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <PageHeader
        title="Client Management"
        description="Manage your clients, view activities, and track payment history"
        actions={
          pagePermissions.canCreateClient ? (
            <>
              <Button variant="secondary" onClick={() => setIsBulkUploadOpen(true)}>
                <Upload size={16} aria-hidden="true" />
                Bulk Upload
              </Button>
              <Button onClick={handleAddClient}>
                <Plus size={16} aria-hidden="true" />
                Add New Client
              </Button>
            </>
          ) : null
        }
      />


      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-green-100 p-3 rounded-full mr-4">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{statistics.activeCount}</span>
            <span className="text-gray-600 text-sm">Active Clients</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-red-100 p-3 rounded-full mr-4">
            <AlertCircle size={20} className="text-red-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">{statistics.inactiveCount}</span>
            <span className="text-gray-600 text-sm">Inactive Clients</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-yellow-100 p-3 rounded-full mr-4">
            <DollarSign size={20} className="text-yellow-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">
              {formatCurrency(statistics.totalOutstanding)}
            </span>
            <span className="text-gray-600 text-sm">Outstanding Amount</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow flex items-center">
          <div className="bg-blue-100 p-3 rounded-full mr-4">
            <Briefcase size={20} className="text-blue-600" />
          </div>
          <div>
            <span className="text-xl font-bold block">
              {formatCurrency(statistics.totalBilled)}
            </span>
            <span className="text-gray-600 text-sm">Total Billed</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="relative flex-grow max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-2">
          <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white">
            <Filter size={18} className="text-gray-500 mr-2" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-none"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          
          {pagePermissions.canExportClients && ( <button 
            className="flex items-center border border-gray-300 rounded-md px-4 py-2 bg-white gap-2 hover:bg-gray-50"
            onClick={() => handleExport('csv')}
          >
            <Download size={18} className="text-gray-500" />
            <span>Export</span>
          </button>)}
          <button 
            className="flex items-center border border-gray-300 rounded-md px-4 py-2 bg-white gap-2 hover:bg-gray-50"
            onClick={handleOpenBalanceReminderTemplate}
            title="Edit balance reminder email template"
          >
            <FileText size={18} className="text-gray-500" />
            <span>Balance reminder template</span>
          </button>
        </div>
      </div>

      {selectedClientIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-amber-800">
            {selectedClientIds.length} client{selectedClientIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedClientIds([])}
              className="px-3 py-1.5 text-sm border border-amber-300 text-amber-800 rounded-md hover:bg-amber-100"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={handleSendBulkBalanceReminders}
              disabled={sendingBulkReminders}
              className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Send balance reminder email to all selected clients"
            >
              {sendingBulkReminders ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Send payment reminders
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-10 w-10 border-4 border-t-blue-600 border-r-transparent border-l-transparent border-b-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading clients...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle size={24} className="text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-800 font-medium mb-1">Error Loading Clients</h3>
            <p className="text-red-600">{error}</p>
            <button 
              className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
              onClick={loadClients}
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={clients.length > 0 && clients.every(c => selectedClientIds.includes(c.id))}
                      onChange={toggleSelectAllOnPage}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      const newOrder = sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc';
                      setSortBy('name');
                      setSortOrder(newOrder);
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                    }}
                  >
                    <div className="flex items-center">
                      Client Name
                      {sortBy === 'name' && (
                        <span className="ml-1">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      const newOrder = sortBy === 'contactPerson' && sortOrder === 'asc' ? 'desc' : 'asc';
                      setSortBy('contactPerson');
                      setSortOrder(newOrder);
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                    }}
                  >
                    <div className="flex items-center">
                      Contact Person
                      {sortBy === 'contactPerson' && (
                        <span className="ml-1">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      const newOrder = sortBy === 'email' && sortOrder === 'asc' ? 'desc' : 'asc';
                      setSortBy('email');
                      setSortOrder(newOrder);
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                    }}
                  >
                    <div className="flex items-center">
                      Email
                      {sortBy === 'email' && (
                        <span className="ml-1">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      const newOrder = sortBy === 'status' && sortOrder === 'asc' ? 'desc' : 'asc';
                      setSortBy('status');
                      setSortOrder(newOrder);
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                    }}
                  >
                    <div className="flex items-center">
                      Status
                      {sortBy === 'status' && (
                        <span className="ml-1">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      const newOrder = sortBy === 'outstandingAmount' && sortOrder === 'asc' ? 'desc' : 'asc';
                      setSortBy('outstandingAmount');
                      setSortOrder(newOrder);
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                    }}
                  >
                    <div className="flex items-center justify-end">
                      Outstanding
                      {sortBy === 'outstandingAmount' && (
                        <span className="ml-1">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      const newOrder = sortBy === 'totalBilled' && sortOrder === 'asc' ? 'desc' : 'asc';
                      setSortBy('totalBilled');
                      setSortOrder(newOrder);
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                    }}
                  >
                    <div className="flex items-center justify-end">
                      Total Billed
                      {sortBy === 'totalBilled' && (
                        <span className="ml-1">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {clients.map((client) => (
                  <tr 
                    key={client.id} 
                    onClick={() => handleClientClick(client)}
                    className={`hover:bg-gray-50 cursor-pointer ${selectedClientIds.includes(client.id) ? 'bg-amber-50' : ''}`}
                  >
                    <td className="px-3 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedClientIds.includes(client.id)}
                        onChange={(e) => toggleClientSelection(client.id, e)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{client.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">{client.contactPerson || client.contact}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">{client.email}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">{client.phone}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      <span className={`px-2.5 py-1 rounded-full text-xs ${
                        client.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {client.status}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-sm text-right ${
                      client.outstandingAmount > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(client.outstandingAmount)}
                    </td>
                    <td className="px-4 py-4 text-sm text-right text-gray-900">
                      {formatCurrency(client.totalBilled)}
                    </td>
                    <td className="px-4 py-4 text-sm text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                      {pagePermissions.canUpdateClients &&(<button 
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                          onClick={(e) => handleEditClient(client, e)}
                          title="Edit Client"
                        >
                          <Edit size={16} />
                        </button>)}
                        {pagePermissions.canDeleteClients &&(<button 
                          className="text-red-600 hover:text-red-800 p-1 rounded"
                          onClick={(e) => handleDeleteClient(client.id, e)}
                          title="Delete Client"
                        >
                          <Trash2 size={16} />
                        </button>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls (exact copy from inventory) - Always visible */}
          {pagination.totalItems > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow p-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">
                    Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} to {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems} clients
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Show:</span>
                    <select
                      value={pagination.pageSize}
                      onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-sm text-gray-700">per page</span>
                  </div>
                </div>
                
                {/* Navigation buttons - only show when there are multiple pages */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={pagination.currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      First
                    </button>
                    
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = pagination.currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-1 text-sm border rounded-md ${
                              pagination.currentPage === pageNum
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                    
                    <button
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={pagination.currentPage === pagination.totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Last
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {clients.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-4xl mb-2">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No clients found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
              {pagePermissions.canCreateClient && (  <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={handleAddClient}
              >
                Add Your First Client
              </button>)}
            </div>
          )}
        </div>
      )}

      {/* Client Detail Modal */}
      {isDetailOpen && selectedClient && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-200 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold truncate">{selectedClient.name}</h2>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                    selectedClient.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedClient.status || 'Active'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">{selectedClient.email || 'No email'}</p>
              </div>
              <button 
                className="text-gray-500 hover:text-gray-700 text-2xl"
                onClick={() => setIsDetailOpen(false)}
                aria-label="Close client record"
              >
                ×
              </button>
            </div>

            <div className="px-5 pt-3 border-b border-gray-200 flex gap-1 overflow-x-auto" role="tablist">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'invoices', label: `Invoices (${clientRecord?.totals?.invoiceCount ?? clientInvoices.length})` },
                { id: 'payments', label: `Payments (${clientRecord?.totals?.paymentCount ?? 0})` },
                { id: 'sales', label: `Sales (${clientRecord?.totals?.salesCount ?? 0})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={detailTab === tab.id}
                  onClick={() => setDetailTab(tab.id)}
                  className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
                    detailTab === tab.id
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="p-5 overflow-y-auto flex-grow">
              {loadingClientRecord && (
                <p className="text-sm text-gray-500 mb-4">Loading full client record…</p>
              )}

              {detailTab === 'overview' && (
              <>
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 border-b pb-2">Client Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <User size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-600 mr-2">Contact Person:</span>
                    <span className="font-medium">{selectedClient.contactPerson || selectedClient.contact || '—'}</span>
                  </div>
                  <div className="flex items-center">
                    <Mail size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-600 mr-2">Email:</span>
                    <span className="font-medium">{selectedClient.email || '—'}</span>
                  </div>
                  <div className="flex items-center">
                    <Phone size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-600 mr-2">Phone:</span>
                    <span className="font-medium">{selectedClient.phone || '—'}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-600 mr-2">Address:</span>
                    <span className="font-medium">{selectedClient.address || '—'}</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-600 mr-2">Status:</span>
                    <span className="font-medium">{selectedClient.status || 'Active'}</span>
                  </div>
                  {selectedClient.additionalEmails && selectedClient.additionalEmails.length > 0 && (
                    <div className="sm:col-span-2 flex items-start">
                      <Mail size={16} className="text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-gray-600 mr-2 block mb-1">Additional emails (invoices):</span>
                        <span className="font-medium text-sm">{selectedClient.additionalEmails.join(', ')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 border-b pb-2">Financial Overview</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <span className="block text-sm text-gray-600 mb-1">Total Purchases</span>
                    <span className="block text-lg font-bold">
                      {formatCurrency(clientRecord?.totals?.totalPurchases ?? selectedClient.totalBilled)}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <span className="block text-sm text-gray-600 mb-1">Invoiced</span>
                    <span className="block text-lg font-bold">
                      {formatCurrency(clientRecord?.totals?.totalInvoiced ?? selectedClient.totalBilled)}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <span className="block text-sm text-gray-600 mb-1">Paid</span>
                    <span className="block text-lg font-bold text-green-700">
                      {formatCurrency(clientRecord?.totals?.totalPaid ?? 0)}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <span className="block text-sm text-gray-600 mb-1">Outstanding</span>
                    <span className={`block text-lg font-bold ${
                      (clientRecord?.totals?.outstanding ?? selectedClient.outstandingAmount) > 0 ? "text-red-600" : "text-green-600"
                    }`}>
                      {formatCurrency(clientRecord?.totals?.outstanding ?? selectedClient.outstandingAmount)}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <span className="block text-sm text-gray-600 mb-1">POS Sales</span>
                    <span className="block text-lg font-bold">
                      {formatCurrency(clientRecord?.totals?.totalSales ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
              </>
              )}

              {detailTab === 'invoices' && (
                <div className="mb-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium text-gray-600">Invoice</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Date</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Due</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-right">Total</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-right">Paid</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-right">Outstanding</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(clientRecord?.invoices || clientInvoices || []).length === 0 ? (
                        <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">No invoices for this client</td></tr>
                      ) : (
                        (clientRecord?.invoices || clientInvoices).map((inv) => (
                          <tr key={inv.id}>
                            <td className="px-3 py-2 font-medium">{inv.invoiceNumber}</td>
                            <td className="px-3 py-2">{formatDate(inv.issueDate || inv.date)}</td>
                            <td className="px-3 py-2">{formatDate(inv.dueDate)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(inv.total ?? inv.amount)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(inv.paid ?? 0)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(inv.outstanding ?? 0)}</td>
                            <td className="px-3 py-2 capitalize">{inv.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {detailTab === 'payments' && (
                <div className="mb-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium text-gray-600">Date</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Amount</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Method</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Reference</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Applied to</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(clientRecord?.payments || []).length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No payment records</td></tr>
                      ) : (
                        clientRecord.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2">{formatDate(p.paymentDate)}</td>
                            <td className="px-3 py-2 font-medium text-green-700">{formatCurrency(p.amount)}</td>
                            <td className="px-3 py-2">{p.paymentMethod || '—'}</td>
                            <td className="px-3 py-2">{p.reference || '—'}</td>
                            <td className="px-3 py-2">{p.sourceType} {p.sourceNumber}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {detailTab === 'sales' && (
                <div className="mb-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium text-gray-600">Reference</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Date</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-right">Total</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(clientRecord?.sales || []).length === 0 ? (
                        <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No POS sales for this client</td></tr>
                      ) : (
                        clientRecord.sales.map((sale) => (
                          <tr key={sale.id}>
                            <td className="px-3 py-2 font-medium">{sale.reference}</td>
                            <td className="px-3 py-2">{formatDate(sale.saleDate)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(sale.total)}</td>
                            <td className="px-3 py-2 capitalize">{sale.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {detailTab === 'overview' && (
              <>
              
              <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4 border-b pb-2">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {pagePermissions.canCreateInvoices && (
                      <button
                        onClick={() => setShowInvoiceModal(true)}
                        className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <div className="p-2 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                          <FileText size={16} className="text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">Create Invoice</span>
                      </button>
                    )}
                    {pagePermissions.canCreatePayments && (
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      >
                        <div className="p-2 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors">
                          <DollarSign size={16} className="text-green-600" />
                        </div>
                        <span className="font-medium text-gray-900">Record Payment</span>
                      </button>
                    )}
                    {pagePermissions.canUpdateClients && (
                    <button
                      onClick={() => {
                        setIsDetailOpen(false);
                        handleEditClient(selectedClient, { stopPropagation: () => {} });
                      }}
                      className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                    >
                      <div className="p-2 bg-purple-100 rounded-full group-hover:bg-purple-200 transition-colors">
                        <Edit size={16} className="text-purple-600" />
                      </div>
                      <span className="font-medium text-gray-900">Edit Profile</span>
                    </button>
                    )}
                    <button
                      onClick={() => {
                        setEmailForm({
                          to: selectedClient?.email || '',
                          subject: '',
                          body: ''
                        });
                        setEmailFiles([]);
                        setShowSendEmailModal(true);
                      }}
                      className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                    >
                      <div className="p-2 bg-orange-100 rounded-full group-hover:bg-orange-200 transition-colors">
                        <Mail size={16} className="text-orange-600" />
                      </div>
                      <span className="font-medium text-gray-900">Send Email</span>
                    </button>
                    <button
                      onClick={handleSendBalanceReminder}
                      disabled={sendingBalanceReminder}
                      className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-amber-300 hover:bg-amber-50 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
                      title="Send payment reminder using your template"
                    >
                      <div className="p-2 bg-amber-100 rounded-full group-hover:bg-amber-200 transition-colors">
                        <AlertCircle size={16} className="text-amber-600" />
                      </div>
                      <span className="font-medium text-gray-900">{sendingBalanceReminder ? 'Sending…' : 'Send payment reminder'}</span>
                    </button>
                    <button
                      onClick={handleDownloadBalanceReminderPdf}
                      disabled={downloadingReminderPdf}
                      className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-amber-300 hover:bg-amber-50 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
                      title="Download balance reminder as PDF to send manually"
                    >
                      <div className="p-2 bg-amber-100 rounded-full group-hover:bg-amber-200 transition-colors">
                        <Download size={16} className="text-amber-600" />
                      </div>
                      <span className="font-medium text-gray-900">{downloadingReminderPdf ? 'Downloading…' : 'Download reminder (PDF)'}</span>
                    </button>
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <span className="text-xs font-medium text-gray-500 px-1">Export full record</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleDownloadAccountSummary('pdf')}
                          disabled={downloadingAccountSummary}
                          className="group flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50"
                          title="Download client record as PDF"
                        >
                          <Download size={14} className="text-teal-600" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={() => handleDownloadAccountSummary('xlsx')}
                          disabled={downloadingAccountSummary}
                          className="group flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50"
                          title="Download client record as Excel"
                        >
                          <Download size={14} className="text-teal-600" />
                          <span>Excel</span>
                        </button>
                        <button
                          onClick={() => handleDownloadAccountSummary('csv')}
                          disabled={downloadingAccountSummary}
                          className="group flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50"
                          title="Download client trading history as CSV"
                        >
                          <Download size={14} className="text-teal-600" />
                          <span>CSV</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
              )}
            </div>
            
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                onClick={() => setIsDetailOpen(false)}
              >
                Close
              </button>
              {pagePermissions.canUpdateClients &&(<button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={() => {
                  setIsDetailOpen(false);
                  handleEditClient(selectedClient, { stopPropagation: () => {} });
                }}
              >
                Edit Client
              </button>)}
            </div>
          </div>
        </div>
      )}

      {/* Client Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ClientForm 
              client={isEditing ? selectedClient : null}
              onSubmit={handleFormSubmit}
              onCancel={() => setIsFormOpen(false)}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {showSendEmailModal && selectedClient && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => !isSendingEmail && setShowSendEmailModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Send Email to {selectedClient.name}</h3>
              <button className="p-2 hover:bg-gray-100 rounded" onClick={() => !isSendingEmail && setShowSendEmailModal(false)}>
                <X size={18} className="text-gray-600" />
              </button>
            </div>
            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input
                  type="email"
                  value={"insightinnovationsltd@gmail.com"}
                  readOnly
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
                />
                <p className="mt-1 text-xs text-gray-500">Organisation sender address</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                  placeholder="client@example.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
                {!emailForm.to && (
                  <p className="mt-1 text-xs text-amber-600">Client has no email on profile. You can enter it here.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  placeholder="Subject"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  placeholder="Write your message..."
                  rows={8}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setEmailFiles(files);
                  }}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                {emailFiles && emailFiles.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    {emailFiles.length} file{emailFiles.length > 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                disabled={isSendingEmail}
                onClick={() => setShowSendEmailModal(false)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 ${isSendingEmail ? 'opacity-70 cursor-not-allowed' : ''}`}
                disabled={isSendingEmail || !emailForm.to || !emailForm.subject || !emailForm.body}
                onClick={async () => {
                  if (!emailForm.to || !emailForm.subject || !emailForm.body) return;
                  try {
                    setIsSendingEmail(true);
                    const formData = new FormData();
                    formData.append('clientId', selectedClient.id);
                    formData.append('to', emailForm.to);
                    formData.append('subject', emailForm.subject);
                    formData.append('message', emailForm.body);
                    formData.append('replyTo', 'insightinnovationsltd@gmail.com');
                    (emailFiles || []).forEach((file) => formData.append('attachments', file));

                    const res = await fetch('/api/clients/send-email', {
                      method: 'POST',
                      body: formData
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err.error || 'Failed to send email');
                    }
                    setSuccessMessage('Email sent successfully');
                    setShowSendEmailModal(false);
                  } catch (e) {
                    console.error(e);
                    setError(e.message || 'Failed to send email');
                  } finally {
                    setIsSendingEmail(false);
                  }
                }}
              >
                {isSendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance reminder template modal */}
      {showBalanceReminderTemplateModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => !balanceReminderTemplateSaving && setShowBalanceReminderTemplateModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Balance reminder email template</h3>
              <button className="p-2 hover:bg-gray-100 rounded" onClick={() => !balanceReminderTemplateSaving && setShowBalanceReminderTemplateModal(false)}>
                <X size={18} className="text-gray-600" />
              </button>
            </div>
            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-600">This template is used when you send a balance reminder to a client. Use {'{{clientName}}'} and {'{{balance}}'} as placeholders.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={balanceReminderTemplate.subject}
                  onChange={(e) => setBalanceReminderTemplate(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Outstanding balance reminder"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email body</label>
                <textarea
                  value={balanceReminderTemplate.body}
                  onChange={(e) => setBalanceReminderTemplate(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Dear {{clientName}}, ..."
                  rows={10}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                disabled={balanceReminderTemplateSaving}
                onClick={() => setShowBalanceReminderTemplateModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={balanceReminderTemplateSaving}
                onClick={handleSaveBalanceReminderTemplate}
              >
                {balanceReminderTemplateSaving ? 'Saving…' : 'Save template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal (inline) */}
      {showInvoiceModal && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          mode="create"
          invoice={null}
          onSubmit={async (payload) => {
            try {
              // Ensure clientId defaults to selected client
              const body = { ...payload, clientId: payload.clientId || selectedClient?.id };
              const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              });
              if (!res.ok) throw new Error('Failed to create invoice');
              setShowInvoiceModal(false);
            } catch (err) {
              console.error(err);
              setError('Failed to create invoice');
            }
          }}
        />
      )}

      {/* Record Payment Modal (inline) */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSubmit={async (payload) => {
            try {
              const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              if (!res.ok) throw new Error('Failed to record payment');
              setShowPaymentModal(false);
            } catch (err) {
              console.error(err);
              setError('Failed to record payment');
            }
          }}
        />
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadOpen && (
        <BulkClientUpload
          onUploadComplete={handleBulkUploadComplete}
          onClose={() => setIsBulkUploadOpen(false)}
        />
      )}

      {/* CSS for animations and loading spinner */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
    </PermissionGuard>
  );
};

export default ClientManagement;