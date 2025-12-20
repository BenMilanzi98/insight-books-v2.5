"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { paymentMethods } from "@/lib/paymentMethods";

const PaymentModal = ({
  isOpen,
  onClose,
  onSubmit,
  mode = "create",
  payment = null,
}) => {
  const [formData, setFormData] = useState({
    invoiceId: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Bank Transfer",
    reference: "",
    notes: "",
  });
  
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Initialize form data when editing an existing payment
  useEffect(() => {
    if (mode === "edit" && payment) {
      setFormData({
        invoiceId: payment.invoiceId,
        amount: payment.amount.toString(),
        paymentDate: new Date(payment.paymentDate).toISOString().split("T")[0],
        paymentMethod: payment.paymentMethod,
        reference: payment.reference || "",
        notes: payment.notes || "",
      });
    }
  }, [payment, mode]);
  
  useEffect(() => {
    const fetchUnpaidInvoices = async () => {
      try {
        // Fetch invoices with status "Pending" or "Partial"
        const response = await fetch('/api/invoices?status=Pending,Partial');
        
        if (response.ok) {
          const data = await response.json();
          console.log("Fetched invoices:", data); // Debug log
          setInvoices(data.invoices || []);
        } else {
          console.error("Failed to fetch invoices:", await response.text());
        }
      } catch (error) {
        console.error("Error loading unpaid invoices:", error);
      }
    };
    
    if (isOpen) {
      fetchUnpaidInvoices();
    }
  }, [isOpen]);
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // For amount, ensure it's a valid number
    if (name === "amount") {
      if (value === "" || /^\d+(\.\d{0,2})?$/.test(value)) {
        setFormData({
          ...formData,
          [name]: value,
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null,
      });
    }
  };
  
  // If invoice is selected, auto-fill the amount
  const handleInvoiceSelect = (invoiceId) => {
    setFormData({
      ...formData,
      invoiceId,
    });
    
    if (invoiceId) {
      const selectedInvoice = invoices.find((inv) => inv.id === invoiceId);
      if (selectedInvoice) {
        setFormData({
          ...formData,
          invoiceId,
          amount: selectedInvoice.amountDue.toString(),
        });
      }
    }
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.invoiceId) {
      newErrors.invoiceId = "Invoice is required";
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Valid amount is required";
    }
    
    if (!formData.paymentDate) {
      newErrors.paymentDate = "Payment date is required";
    }
    
    if (!formData.paymentMethod) {
      newErrors.paymentMethod = "Payment method is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Convert amount to a number
      const paymentData = {
        ...formData,
        amount: parseFloat(formData.amount),
      };
      
      // Submit form data
      await onSubmit(paymentData);
      
      // Reset form and close modal on success
      setFormData({
        invoiceId: "",
        amount: "",
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: "Bank Transfer",
        reference: "",
        notes: "",
      });
      
      onClose();
    } catch (error) {
      console.error("Error submitting payment:", error);
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            {mode === "create" ? "Record New Payment" : "Edit Payment"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invoiceId">
                Invoice <span className="text-red-500">*</span>
              </label>
              <select
                id="invoiceId"
                name="invoiceId"
                className={`w-full p-2 border rounded-md ${errors.invoiceId ? 'border-red-500' : 'border-gray-300'}`}
                value={formData.invoiceId}
                onChange={(e) => handleInvoiceSelect(e.target.value)}
              >
                <option value="">Select an invoice</option>
                {invoices.map(invoice => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber} - {invoice.client?.name} (MK {invoice.amountDue})
                  </option>
                ))}
              </select>
              {errors.invoiceId && (
                <p className="text-red-500 text-xs mt-1">{errors.invoiceId}</p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="amount">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">MK</span>
                <input
                  type="text"
                  id="amount"
                  name="amount"
                  className={`w-full p-2 pl-10 border rounded-md ${errors.amount ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
              {errors.amount && (
                <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="paymentDate">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="paymentDate"
                name="paymentDate"
                className={`w-full p-2 border rounded-md ${errors.paymentDate ? 'border-red-500' : 'border-gray-300'}`}
                value={formData.paymentDate}
                onChange={handleChange}
              />
              {errors.paymentDate && (
                <p className="text-red-500 text-xs mt-1">{errors.paymentDate}</p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="paymentMethod">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                className={`w-full p-2 border rounded-md ${errors.paymentMethod ? 'border-red-500' : 'border-gray-300'}`}
                value={formData.paymentMethod}
                onChange={handleChange}
              >
                {paymentMethods.map(method => (
                  <option key={method.key} value={method.key}>{method.name}</option>
                  ))}
                {/* <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card Payment">Card Payment</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="PayChangu">PayChangu</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option> */}
              </select>
              {errors.paymentMethod && (
                <p className="text-red-500 text-xs mt-1">{errors.paymentMethod}</p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="reference">
                Reference Number
              </label>
              <input
                type="text"
                id="reference"
                name="reference"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.reference}
                onChange={handleChange}
                placeholder="Transaction ref, check #, etc."
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows="3"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any additional details about this payment"
              ></textarea>
            </div>
          </form>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⌛</span>
                Saving...
              </>
            ) : (
              mode === "create" ? "Record Payment" : "Update Payment"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;