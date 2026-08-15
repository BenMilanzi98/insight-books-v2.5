"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Save, 
  Plus, 
  Trash2, 
  HelpCircle, 
  ChevronRight, 
  CreditCard, 
  Receipt, 
  DollarSign, 
  FileText, 
  AlertCircle,
  Info,
  Check,
  X,
  Edit,
  Eye,
  Briefcase
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";

const FinancialSetupPage = () => {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("tax");
  const [taxRules, setTaxRules] = useState([
    { id: 1, name: "Standard VAT", rate: 17.5, isDefault: true },
    { id: 2, name: "Zero-rated", rate: 0, isDefault: false }
  ]);
  const [invoiceTemplates, setInvoiceTemplates] = useState([
    { id: 1, name: "Standard Invoice", isDefault: true },
    { id: 2, name: "Professional", isDefault: false }
  ]);
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 1, name: "PayChangu", enabled: true, apiKey: "pk_test_123456" },
    { id: 2, name: "Bank Transfer", enabled: true, accountDetails: "Bank: NBM, Account: 1234567890" },
    { id: 3, name: "Mobile Money", enabled: false, provider: "" }
  ]);
  const [approvalWorkflows, setApprovalWorkflows] = useState([
    { 
      id: 1, 
      name: "Invoice Approval", 
      enabled: true, 
      threshold: 100000, 
      approvers: ["Admin", "Finance Manager"] 
    },
    { 
      id: 2, 
      name: "Expense Approval", 
      enabled: true, 
      threshold: 50000, 
      approvers: ["Department Head", "Admin"] 
    }
  ]);
  
  // Function to add a new tax rule
  const addTaxRule = () => {
    const newId = taxRules.length > 0 ? Math.max(...taxRules.map(rule => rule.id)) + 1 : 1;
    setTaxRules([...taxRules, { id: newId, name: "", rate: 0, isDefault: false }]);
  };
  
  // Function to delete a tax rule
  const deleteTaxRule = (id) => {
    setTaxRules(taxRules.filter(rule => rule.id !== id));
  };
  
  // Function to update a tax rule
  const updateTaxRule = (id, field, value) => {
    setTaxRules(taxRules.map(rule => 
      rule.id === id ? { ...rule, [field]: value } : rule
    ));
  };
  
  // Function to set a tax rule as default
  const setDefaultTaxRule = (id) => {
    setTaxRules(taxRules.map(rule => 
      ({ ...rule, isDefault: rule.id === id })
    ));
  };

  // Function to add a new invoice template
  const addInvoiceTemplate = () => {
    const newId = invoiceTemplates.length > 0 ? Math.max(...invoiceTemplates.map(template => template.id)) + 1 : 1;
    setInvoiceTemplates([...invoiceTemplates, { id: newId, name: "New Template", isDefault: false }]);
  };

  // Function to set default invoice template
  const setDefaultInvoiceTemplate = (id) => {
    setInvoiceTemplates(invoiceTemplates.map(template => 
      ({ ...template, isDefault: template.id === id })
    ));
  };
  
  // Function to add a new payment method
  const addPaymentMethod = () => {
    const newId = paymentMethods.length > 0 ? Math.max(...paymentMethods.map(method => method.id)) + 1 : 1;
    setPaymentMethods([...paymentMethods, { id: newId, name: "", enabled: true }]);
  };
  
  // Function to delete a payment method
  const deletePaymentMethod = (id) => {
    setPaymentMethods(paymentMethods.filter(method => method.id !== id));
  };
  
  // Function to update a payment method
  const updatePaymentMethod = (id, field, value) => {
    setPaymentMethods(paymentMethods.map(method => 
      method.id === id ? { ...method, [field]: value } : method
    ));
  };
  
  // Function to toggle payment method enabled status
  const togglePaymentMethod = (id) => {
    setPaymentMethods(paymentMethods.map(method => 
      method.id === id ? { ...method, enabled: !method.enabled } : method
    ));
  };

  // Function to add approval workflow
  const addApprovalWorkflow = () => {
    const newId = approvalWorkflows.length > 0 ? Math.max(...approvalWorkflows.map(workflow => workflow.id)) + 1 : 1;
    setApprovalWorkflows([...approvalWorkflows, { 
      id: newId, 
      name: "New Workflow", 
      enabled: true, 
      threshold: 0, 
      approvers: [] 
    }]);
  };

  // Function to toggle workflow enabled status
  const toggleWorkflowEnabled = (id) => {
    setApprovalWorkflows(approvalWorkflows.map(workflow => 
      workflow.id === id ? { ...workflow, enabled: !workflow.enabled } : workflow
    ));
  };

  // Function to update workflow threshold
  const updateWorkflowThreshold = (id, value) => {
    setApprovalWorkflows(approvalWorkflows.map(workflow => 
      workflow.id === id ? { ...workflow, threshold: value } : workflow
    ));
  };

  // Function to update workflow name
  const updateWorkflowName = (id, name) => {
    setApprovalWorkflows(approvalWorkflows.map(workflow => 
      workflow.id === id ? { ...workflow, name } : workflow
    ));
  };

  // Function to update workflow approvers
  const updateWorkflowApprovers = (id, approvers) => {
    setApprovalWorkflows(approvalWorkflows.map(workflow => 
      workflow.id === id ? { ...workflow, approvers } : workflow
    ));
  };

  // Function to delete a workflow
  const deleteWorkflow = (id) => {
    setApprovalWorkflows(approvalWorkflows.filter(workflow => workflow.id !== id));
  };

  // Function to save all configurations
  const saveConfigurations = () => {
    // In a real application, this would send the data to the backend
    alert('Configuration saved successfully!');
    // You could also implement API calls here to save the configurations
    // Example: saveToAPI('/api/tax-rules', taxRules);
  };
  
  return (
    <PermissionGuard permission="settings.view">   
    <div className="max-w-7xl mx-auto bg-white shadow-sm rounded-lg">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{tt('Financial Setup')}</h1>
            <p className="mt-1 text-sm text-gray-600">{tt("Configure your organization's financial settings, tax rules, and payment methods.")}</p>
          </div>
          <button 
            onClick={saveConfigurations}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Save className="mr-2 h-4 w-4" />
            {tt('Save Configuration')}
          </button>
        </div>
      </div>
      
      {/* Setup Progress */}
      <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-blue-500" />
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-blue-800">{tt('Setup Progress: 2/4 Completed')}</h3>
              <p className="text-sm text-blue-700">{tt('50% Complete')}</p>
            </div>
            <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '50%' }}></div>
            </div>
            <p className="mt-2 text-xs text-blue-700">{tt('Complete all configuration steps to ensure optimal system functionality.')}</p>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="px-6 pt-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('tax')}
              className={`${
                activeTab === 'tax'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Receipt className="mr-2 h-5 w-5" />
              {tt('Tax Rules')}
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`${
                activeTab === 'invoices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <FileText className="mr-2 h-5 w-5" />
              {tt('Invoice Templates')}
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`${
                activeTab === 'payments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              {tt('Payment Integrations')}
            </button>
            <Link
              href="/financial-setup/opening-balances"
              className={`${
                pathname === '/financial-setup/opening-balances'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <DollarSign className="mr-2 h-5 w-5" />
              {tt('Opening Balances')}
            </Link>

          </nav>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="p-6">
        {/* Tax Rules Tab */}
        {activeTab === 'tax' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">{tt('Tax Rules Configuration')}</h2>
              <button 
                onClick={addTaxRule}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {tt('Add Tax Rule')}
              </button>
            </div>
            
            <div className="bg-white overflow-hidden shadow-sm border border-gray-200 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {tt('Tax Name')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate (%)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {tt('Default')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {tt('Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {taxRules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input 
                          type="text" 
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          value={rule.name}
                          onChange={(e) => updateTaxRule(rule.id, 'name', e.target.value)}
                          placeholder={tt('Tax rule name')}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative rounded-md shadow-sm w-32">
                          <input 
                            type="number" 
                            className="focus:ring-blue-500 focus:border-blue-500 block w-full pr-8 sm:text-sm border-gray-300 rounded-md"
                            value={rule.rate}
                            onChange={(e) => updateTaxRule(rule.id, 'rate', parseFloat(e.target.value))}
                            step="0.01"
                            min="0"
                            max="100"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">%</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <input 
                            type="radio" 
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                            checked={rule.isDefault}
                            onChange={() => setDefaultTaxRule(rule.id)}
                          />
                          {rule.isDefault && (
                            <span className="ml-2 text-xs font-medium text-blue-600">{tt('Default')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => deleteTaxRule(rule.id)}
                          className="text-red-600 hover:text-red-900 focus:outline-none"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                          </tbody>
              </table>
            </div>
            
            <div className="flex items-start space-x-2 text-sm text-gray-500 bg-gray-50 p-4 rounded-md border border-gray-200">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{tt('About Tax Rules')}</p>
                <p className="mt-1">Tax rules are applied to invoices and financial transactions. The default rule will be automatically applied to new invoices, but can be changed during invoice creation.</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Invoice Templates Tab */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">{tt('Invoice Template Management')}</h2>
              <button 
                onClick={addInvoiceTemplate}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {tt('Add Template')}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {invoiceTemplates.map((template) => (
                <div key={template.id} className={`overflow-hidden shadow-sm rounded-lg border ${template.isDefault ? 'border-blue-300 ring-1 ring-blue-500' : 'border-gray-200'}`}>
                  <div className={`px-4 py-3 flex justify-between items-center ${template.isDefault ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <h3 className="text-sm font-medium">{template.name}</h3>
                    {template.isDefault ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Check className="mr-1 h-3 w-3" />
                        {tt('Default')}
                      </span>
                    ) : (
                      <button 
                        onClick={() => setDefaultInvoiceTemplate(template.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {tt('Set as Default')}
                      </button>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <div className="aspect-w-8 aspect-h-11 bg-gray-100 mb-3 rounded border border-gray-200 flex items-center justify-center">
                      <FileText className="h-12 w-12 text-gray-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <Eye className="mr-1 h-3 w-3" />
                        {tt('Preview')}
                      </button>
                      <button className="inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <Edit className="mr-1 h-3 w-3" />
                        {tt('Edit')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={addInvoiceTemplate}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 hover:border-gray-400 hover:bg-gray-50 focus:outline-none"
              >
                <Plus className="h-8 w-8 mb-2" />
                <span className="text-sm font-medium">{tt('Add New Template')}</span>
              </button>
            </div>
            
            <div className="flex items-start space-x-2 text-sm text-gray-500 bg-gray-50 p-4 rounded-md border border-gray-200">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{tt('About Invoice Templates')}</p>
                <p className="mt-1">Templates determine how your invoices appear to clients. The default template will be used for new invoices unless another is selected during invoice creation.</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Payment Integrations Tab */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">{tt('Payment Method Configuration')}</h2>
              <button 
                onClick={addPaymentMethod}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {tt('Add Payment Method')}
              </button>
            </div>
            
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="bg-white shadow-sm overflow-hidden sm:rounded-lg border border-gray-200">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="bg-white p-2 rounded-md border border-gray-200">
                        <CreditCard className="h-5 w-5 text-gray-500" />
                      </div>
                      <input 
                        type="text" 
                        className="ml-3 border-0 bg-transparent focus:ring-0 focus:outline-none font-medium placeholder-gray-400"
                        value={method.name}
                        onChange={(e) => updatePaymentMethod(method.id, 'name', e.target.value)}
                        placeholder={tt('Payment Method Name')}
                      />
                    </div>
                    <div className="flex items-center ml-4 space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${method.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {method.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <label className="relative inline-flex items-center">
                        <input 
                          type="checkbox"
                          className="sr-only peer" 
                          checked={method.enabled}
                          onChange={() => togglePaymentMethod(method.id)}
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {method.name === 'PayChangu' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={`api-key-${method.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                            {tt('API Key')}
                          </label>
                          <input 
                            id={`api-key-${method.id}`}
                            type="text" 
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder={tt('pk_test_...')}
                            value={method.apiKey || ''}
                            onChange={(e) => updatePaymentMethod(method.id, 'apiKey', e.target.value)}
                          />
                          <p className="mt-1 text-xs text-gray-500">{tt('Find this in your PayChangu dashboard')}</p>
                        </div>
                        <div>
                          <label htmlFor={`secret-key-${method.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                            {tt('Secret Key')}
                          </label>
                          <input 
                            id={`secret-key-${method.id}`}
                            type="password" 
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder={tt('sk_test_...')}
                          />
                          <p className="mt-1 text-xs text-gray-500">{tt('Keep this confidential and secure')}</p>
                        </div>
                      </div>
                    )}
                    
                    {method.name === 'Bank Transfer' && (
                      <div>
                        <label htmlFor={`account-details-${method.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          {tt('Account Details')}
                        </label>
                        <textarea 
                          id={`account-details-${method.id}`}
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          rows="3"
                          placeholder={tt('Bank name, account number, branch code, etc.')}
                          value={method.accountDetails || ''}
                          onChange={(e) => updatePaymentMethod(method.id, 'accountDetails', e.target.value)}
                        ></textarea>
                        <p className="mt-1 text-xs text-gray-500">{tt('These details will appear on your invoices')}</p>
                      </div>
                    )}
                    
                    {method.name === 'Mobile Money' && (
                      <div>
                        <label htmlFor={`provider-${method.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                          {tt('Provider')}
                        </label>
                        <select 
                          id={`provider-${method.id}`}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                          value={method.provider || ''}
                          onChange={(e) => updatePaymentMethod(method.id, 'provider', e.target.value)}
                        >
                          <option value="">{tt('Select Provider')}</option>
                          <option value="airtel">{tt('Airtel Money')}</option>
                          <option value="tnm">{tt('TNM Mpamba')}</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">{tt('Select the mobile money provider you use')}</p>
                      </div>
                    )}
                    
                    <div className="mt-4 text-right">
                      <button 
                        onClick={() => deletePaymentMethod(method.id)}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash2 className="mr-1.5 h-3 w-3" />
                        {tt('Remove')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex items-start space-x-2 text-sm text-gray-500 bg-gray-50 p-4 rounded-md border border-gray-200">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{tt('About Payment Methods')}</p>
                <p className="mt-1">{tt('Configure the payment methods your business accepts. Clients will be able to choose from enabled payment methods when paying invoices.')}</p>
              </div>
            </div>
          </div>
        )}
 
      </div>
      
      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/account?tab=business" className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <ChevronRight className="mr-1.5 h-4 w-4 transform rotate-180" />
            {tt('Previous: Account & business')}
          </Link>
        </div>
        <div className="flex items-center">
          <Link href="/users" className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            {tt('Next: User Management')}
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
};

export default FinancialSetupPage;
        