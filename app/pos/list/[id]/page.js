"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect } from "react";
import { useRouter,useParams } from "next/navigation";
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Loader, 
  CheckCircle, 
  XCircle, 
  FileText, 
  CreditCard, 
  DollarSign, 
  Smartphone,
  User,
  Calendar,
  ClipboardList,
  Tag,
  MoreVertical,
  Edit,
  Trash2,
  Ban,
  RotateCcw
} from "lucide-react";
import { fetchSaleById, voidSale, refundSale, printReceipt } from "@/app/services/salesService";
import { getPaymentMethodIcon, getPaymentMethodName } from "@/lib/paymentMethods";
import { MIN_AUDIT_REASON_LENGTH } from "@/lib/auditReasonConstants";
import { RECEIPT_PAPER_WIDTH_UI_OPTIONS_MM } from "@/lib/receiptPaperWidthPresets";
import { normalizeReceiptPaperWidthMm } from "@/lib/receiptPaperWidth";

// This is the page component
const SaleDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  
  const [sale, setSale] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [receiptPaperWidthMm, setReceiptPaperWidthMm] = useState(80);
  
  // Load sale data
  useEffect(() => {
    loadSale();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tenant/settings');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setReceiptPaperWidthMm(
            normalizeReceiptPaperWidthMm(data.receiptPaperWidthMm)
          );
        }
      } catch {
        // Keep default 80 mm
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  
  // Close action success message after 5 seconds
  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => {
        setActionSuccess(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActionsMenu) {
        setShowActionsMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);
  
  // Load sale details
  const loadSale = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const saleData = await fetchSaleById(id);
      setSale(saleData);
    } catch (error) {
      console.error(`Error loading sale ${id}:`, error);
      setError("Failed to load sale details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle void sale
  const handleVoidSale = async () => {
    if (voidReason.trim().length < MIN_AUDIT_REASON_LENGTH) {
      alert(
        `Please provide a reason of at least ${MIN_AUDIT_REASON_LENGTH} characters (audit / GL reversal requirement).`
      );
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      await voidSale(id, voidReason);
      
      // Reload sale data
      await loadSale();
      
      // Show success message
      setActionSuccess("Sale has been voided successfully");
      
      // Close modal
      setShowVoidModal(false);
      setVoidReason("");
    } catch (error) {
      console.error("Error voiding sale:", error);
      alert("Failed to void sale. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle refund sale
  const handleRefundSale = async () => {
    if (refundReason.trim().length < MIN_AUDIT_REASON_LENGTH) {
      alert(
        `Please provide a reason of at least ${MIN_AUDIT_REASON_LENGTH} characters (audit / GL reversal requirement).`
      );
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      await refundSale(id, refundReason);
      
      // Reload sale data
      await loadSale();
      
      // Show success message
      setActionSuccess("Sale has been refunded successfully");
      
      // Close modal
      setShowRefundModal(false);
      setRefundReason("");
    } catch (error) {
      console.error("Error refunding sale:", error);
      alert("Failed to refund sale. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle print receipt
  const handlePrintReceipt = async (paperWidth = receiptPaperWidthMm) => {
    try {
      await printReceipt(id, {
        paperWidth: normalizeReceiptPaperWidthMm(paperWidth),
      });
    } catch (error) {
      console.error("Error printing receipt:", error);
      alert("Failed to print receipt. Please try again.");
    }
  };
const handleDeleteSale = async () => {
  if (!confirm("Are you sure you want to delete this sale? This action cannot be undone.")) {
    return;
  }

  try {
    const response = await fetch(`/api/sales/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      alert(`Failed to delete: ${errorData.error || 'Unknown error'}`);
      return;
    }

    alert("Sale deleted successfully.");
    router.push('/pos'); // redirect to sales list
  } catch (err) {
    console.error("Delete failed", err);
    alert("An error occurred while deleting the sale.");
  }
};
  // Format payment method for display
  // const formatPaymentMethod = (method) => {
  //   const methodMap = {
  //     'cash': 'Cash',
  //     'card': 'Card',
  //     'mobile_money': 'Mobile Money',
  //     'bank_transfer': 'Bank Transfer',
  //     'check': 'Check'
  //   };
    
  //   return methodMap[method] || method;
  // };
  
  // Get payment method icon
  // const getPaymentMethodIcon = (method) => {
  //   switch (method) {
  //     case 'cash':
  //       return <DollarSign className="w-5 h-5" />;
  //     case 'card':
  //       return <CreditCard className="w-5 h-5" />;
  //     case 'mobile_money':
  //       return <Smartphone className="w-5 h-5" />;
  //     default:
  //       return <DollarSign className="w-5 h-5" />;
  //   }
  // };
  
  // Get status badge
  const StatusBadge = ({ status }) => {
    let badgeClass = "";
    let icon = null;
    
    switch (status) {
      case "completed":
        badgeClass = "bg-green-100 text-green-800";
        icon = <CheckCircle className="w-4 h-4 mr-1" />;
        break;
      case "draft":
        badgeClass = "bg-yellow-100 text-yellow-800";
        icon = <FileText className="w-4 h-4 mr-1" />;
        break;
      case "void":
        badgeClass = "bg-red-100 text-red-800";
        icon = <XCircle className="w-4 h-4 mr-1" />;
        break;
      case "refunded":
        badgeClass = "bg-purple-100 text-purple-800";
        icon = <RotateCcw className="w-4 h-4 mr-1" />;
        break;
      default:
        badgeClass = "bg-gray-100 text-gray-800";
        icon = <AlertCircle className="w-4 h-4 mr-1" />;
    }
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs flex items-center ${badgeClass}`}>
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">{tt('Loading sale details...')}</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{tt('Error')}</h2>
          <p className="text-red-500 mb-4">{error}</p>
          <div className="flex justify-center space-x-4">
            <button 
              className="px-4 py-2 bg-gray-200 rounded-md"
              onClick={() => router.push('/pos')}
            >
              <ArrowLeft className="w-4 h-4 mr-2 inline-block" />
              {tt('Back to Sales')}
            </button>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={loadSale}
            >
              <RefreshCw className="w-4 h-4 mr-2 inline-block" />
              {tt('Try Again')}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!sale) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{tt('Sale Not Found')}</h2>
          <p className="text-gray-500 mb-4">{tt('The requested sale could not be found')}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
            onClick={() => router.push('/pos')}
          >
            <ArrowLeft className="w-4 h-4 mr-2 inline-block" />
            {tt('Back to Sales')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <button 
            className="mr-4 p-2 rounded-full hover:bg-gray-100"
            onClick={() => router.push('/pos')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">{tt('Sale Details')}</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <select
            value={receiptPaperWidthMm}
            onChange={(e) =>
              setReceiptPaperWidthMm(normalizeReceiptPaperWidthMm(e.target.value))
            }
            className="px-2 py-2 border border-gray-300 bg-white rounded-md text-sm"
            title={tt('Thermal paper width')}
          >
            {RECEIPT_PAPER_WIDTH_UI_OPTIONS_MM.map((mm) => (
              <option key={mm} value={mm}>
                {mm} mm
              </option>
            ))}
          </select>
          <button
            className="px-4 py-2 border border-gray-300 bg-white rounded-md flex items-center hover:bg-gray-50"
            onClick={() => handlePrintReceipt(receiptPaperWidthMm)}
          >
            <Printer className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{tt('Print Receipt')}</span>
          </button>
          
          {/* <div className="relative">
            <button 
              className="px-3 py-2 border border-gray-300 bg-white rounded-md hover:bg-gray-50"
              onClick={() => setShowActionsMenu(!showActionsMenu)}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {showActionsMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                <div className="py-1">
                  {sale.status === 'draft' && (
                    <>
                      <button 
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        onClick={() => router.push(`/sales/${id}/edit`)}
                      >
                        <Edit className="w-4 h-4 mr-2 text-gray-500" />
                        {tt('Edit Draft')}
                      </button>
                      <button 
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                        onClick={() => {}} // Would implement delete functionality
                      >
                        <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                        {tt('Delete Draft')}
                      </button>
                    </>
                  )}
                  
                  {sale.status === 'completed' && (
                    <>
                      <button 
                        className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center"
                        onClick={() => setShowVoidModal(true)}
                      >
                        <Ban className="w-4 h-4 mr-2 text-orange-500" />
                        {tt('Void Sale')}
                      </button>
                      <button 
                        className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center"
                        onClick={() => setShowRefundModal(true)}
                      >
                        <RotateCcw className="w-4 h-4 mr-2 text-blue-500" />
                        {tt('Process Refund')}
                      </button>
                    </>
                  )}
                  
                  <button 
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    onClick={() => handlePdfReceipt()} // Would implement export functionality
                  >
                    <Download className="w-4 h-4 mr-2 text-gray-500" />
                    {tt('Export as PDF')}
                  </button>
                </div>
              </div>
            )}
          </div> */}
        </div>
      </div>
      
      {/* Success message */}
      {actionSuccess && (
        <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{actionSuccess}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Sale Info */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            {sale.isHistorical && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
                <div className="flex items-center">
                  <Calendar className="w-5 h-5 text-amber-600 mr-2" />
                  <div>
                    <h3 className="text-sm font-medium text-amber-800">{tt('Historical Transaction')}</h3>
                    <p className="text-xs text-amber-700 mt-1">
                      This transaction was recorded for historical purposes with date: {sale.historicalDate || sale.saleDate}
                    </p>
                    {sale.originalReference && (
                      <p className="text-xs text-amber-700">
                        {tt('Original Reference:')} <span className="font-medium">{sale.originalReference}</span>
                      </p>
                    )}
                    {sale.migrationBatch && (
                      <p className="text-xs text-amber-700">
                        {tt('Migration Batch:')} <span className="font-medium">{sale.migrationBatch}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">{sale.saleNumber}</h2>
                  {sale.isHistorical && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                      <Calendar className="w-3 h-3 mr-1" />
                      {tt('Historical')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  <Calendar className={`w-4 h-4 inline-block mr-1 ${sale.isHistorical ? 'text-amber-500' : ''}`} />
                  {sale.saleDate}
                  {sale.isHistorical && (
                    <span className="ml-2 text-amber-600 font-medium">(Historical Date)</span>
                  )}
                </p>
              </div>
              <StatusBadge status={sale.status} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="border border-gray-200 rounded-md p-4">
                <h3 className="text-sm text-gray-500 font-medium mb-2 flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  {tt('Customer')}
                </h3>
                <p className="text-lg font-medium">{sale.client?.name || 'Walk-in Customer'}</p>
                {sale.clientId && (
                  <p className="text-sm text-gray-500">ID: {sale.clientId}</p>
                )}
              </div>
              
              <div className="border border-gray-200 rounded-md p-4">
                <h3 className="text-sm text-gray-500 font-medium mb-2 flex items-center">
                  {getPaymentMethodIcon(sale.paymentMethod)}
                  <span className="ml-1">{tt('Payment Method')}</span>
                </h3>
                <p className="text-lg font-medium">{getPaymentMethodName(sale.paymentMethod)}</p>
                <p className="text-sm text-gray-500">Processed by {sale.createdBy?.name}</p>
              </div>
            </div>
            
            {sale.notes && (
              <div className="mb-6 bg-gray-50 p-4 rounded-md">
                <h3 className="text-sm text-gray-500 font-medium mb-2">{tt('Notes')}</h3>
                <p className="text-sm">{sale.notes}</p>
              </div>
            )}
            
            <h3 className="text-lg font-semibold mb-3">{tt('Sale Items')}</h3>
            {sale.items && sale.items.length > 0 ? (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Product')}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Price')}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Qty')}</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Subtotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sale.items.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.unitPrice}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : sale.batchProducts && sale.batchProducts.length > 0 ? (
            <div>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Product')}</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{tt('Qty')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sale.batchProducts.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{item.name}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">{tt('Pricing details not available for this sale. See sale summary for totals.')}</p>
            </div>
            ) : sale.originalReference ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <p className="text-sm font-medium text-gray-700">{sale.originalReference}</p>
              <p className="text-xs text-gray-500 mt-1">{tt('Full item details are not available for this historical sale. See sale summary for totals.')}</p>
            </div>
            ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <p className="text-sm text-gray-600">{tt('Item details are not available for this sale.')}</p>
              <p className="text-xs text-gray-500 mt-1">{tt('This sale was recorded before item-level tracking was enabled. See sale summary for totals.')}</p>
            </div>
            )}
          </div>
        </div>

        {/* Right Column - Sale Summary */}
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">{tt('Sale Summary')}</h2>
            
            <div className="border-b border-gray-200 pb-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">{tt('Discount:')}</span>
                <span>{sale.discount}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">{tt('Subtotal:')}</span>
                <span>{sale.subtotal}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Tax ({sale.taxRate}%):</span>
                <span>{sale.taxAmount}</span>
              </div>
              {sale.taxRate === 'Mixed' && (
                <div className="text-xs text-gray-500 ml-2">
                  {tt('Multiple tax rates applied')}
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>{tt('Total:')}</span>
                <span>{sale.total}</span>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">{tt('Sale Details')}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600">{tt('Status:')}</div>
                <div className="text-right font-medium">
                  <StatusBadge status={sale.status} />
                </div>
                
                <div className="text-gray-600">{tt('Created By:')}</div>
                <div className="text-right">{sale.createdBy?.name}</div>
                
                <div className="text-gray-600">{tt('Sale Date:')}</div>
                <div className="text-right">{sale.saleDate}</div>
                
                <div className="text-gray-600">{tt('Items:')}</div>
                <div className="text-right">{sale.items.length}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {tt('Thermal paper width')}
                </label>
                <select
                  value={receiptPaperWidthMm}
                  onChange={(e) =>
                    setReceiptPaperWidthMm(normalizeReceiptPaperWidthMm(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {RECEIPT_PAPER_WIDTH_UI_OPTIONS_MM.map((mm) => (
                    <option key={mm} value={mm}>
                      {mm} mm{mm === 80 ? ' (most common)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md flex items-center justify-center hover:bg-blue-700"
                onClick={() => handlePrintReceipt(receiptPaperWidthMm)}
              >
                <Printer className="w-4 h-4 mr-2" />
                {tt('Print Receipt')}
              </button>
              
              {sale.status === 'completed' && (
                <>
                  <button 
                    className="w-full px-4 py-2 border border-orange-500 text-orange-600 bg-white rounded-md flex items-center justify-center hover:bg-orange-50"
                    onClick={() => setShowVoidModal(true)}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    {tt('Void Sale')}
                  </button>
                  
                  <button 
                    className="w-full px-4 py-2 border border-blue-500 text-blue-600 bg-white rounded-md flex items-center justify-center hover:bg-blue-50"
                    onClick={() => setShowRefundModal(true)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {tt('Process Refund')}
                  </button>
                </>
              )}
              
              {sale.status === 'draft' && (
                <>
                  <button 
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-md flex items-center justify-center hover:bg-green-700"
                    onClick={() => router.push(`/pos/list/${id}/edit`)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {tt('Edit Draft')}
                  </button>
                  
                  <button 
                    className="w-full px-4 py-2 border border-red-500 text-red-600 bg-white rounded-md flex items-center justify-center hover:bg-red-50"
                    onClick={handleDeleteSale} // Would implement delete functionality
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {tt('Delete Draft')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Void Sale Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">{tt('Void Sale')}</h2>
            <p className="mb-4 text-gray-600">
              Are you sure you want to void this sale? This action cannot be undone.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{tt('Reason for Void')}</label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="3"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={tt('At least 10 characters required for audit...')}
                required
              ></textarea>
              <p className="text-xs text-gray-500 mt-1">
                Minimum {MIN_AUDIT_REASON_LENGTH} characters (audit / GL reversal)
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md"
                onClick={() => {
                  setShowVoidModal(false);
                  setVoidReason("");
                }}
                disabled={isSubmitting}
              >
                {tt('Cancel')}
              </button>
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center"
                onClick={handleVoidSale}
                disabled={
                  isSubmitting ||
                  voidReason.trim().length < MIN_AUDIT_REASON_LENGTH
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader className="animate-spin w-4 h-4 mr-2" />
                    {tt('Processing...')}
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-2" />
                    {tt('Void Sale')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Refund Sale Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">{tt('Process Refund')}</h2>
            <p className="mb-4 text-gray-600">
              Are you sure you want to process a refund for this sale? This action cannot be undone.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{tt('Reason for Refund')}</label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="3"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={tt('At least 10 characters required for audit...')}
                required
              ></textarea>
              <p className="text-xs text-gray-500 mt-1">
                Minimum {MIN_AUDIT_REASON_LENGTH} characters (audit / GL reversal)
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md"
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundReason("");
                }}
                disabled={isSubmitting}
              >
                {tt('Cancel')}
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
                onClick={handleRefundSale}
                disabled={
                  isSubmitting ||
                  refundReason.trim().length < MIN_AUDIT_REASON_LENGTH
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader className="animate-spin w-4 h-4 mr-2" />
                    {tt('Processing...')}
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {tt('Process Refund')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaleDetailPage;