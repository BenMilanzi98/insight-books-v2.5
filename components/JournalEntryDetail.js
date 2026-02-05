"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Printer, 
  Clock, 
  AlertCircle,
  CheckCircle,
  Calendar,
  FileText
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currencyUtils";

const JournalEntryDetail = ({ id }) => {
  const router = useRouter();
  
  // Data state
  const [journalEntry, setJournalEntry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
// Look for this section and update it:
useEffect(() => {
    const fetchJournalEntry = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/journal-entries/${id}`);
        
        if (!response.ok) {
          throw new Error(`Error fetching journal entry: ${response.statusText}`);
        }
        
        const data = await response.json();
        // The API now returns the data directly, not nested in a journalEntry property
        setJournalEntry(data);
      } catch (err) {
        console.error("Error fetching journal entry:", err);
        setError(err.message || "Failed to load journal entry");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchJournalEntry();
    }
  }, [id]);
  
  // Handle delete
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/journal-entries/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete journal entry");
      }
      
      // Redirect to general ledger
      router.push('/accounting/general-ledger');
    } catch (err) {
      console.error("Error deleting journal entry:", err);
      setError(err.message || "Failed to delete journal entry");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Handle print
  const handlePrint = () => {
    window.print();
  };
  
  // Return to general ledger
  const handleBack = () => {
    router.back();
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded flex items-center">
          <AlertCircle className="mr-3" size={24} />
          <div>
            <h3 className="font-bold">Error</h3>
            <p>{error}</p>
          </div>
        </div>
        <div className="mt-6">
          <button
            onClick={handleBack}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to General Ledger
          </button>
        </div>
      </div>
    );
  }
  
  if (!journalEntry) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center h-64">
          <FileText size={48} className="text-gray-400 mb-4" />
          <h2 className="text-xl font-medium mb-2">Journal Entry Not Found</h2>
          <p className="text-gray-500 mb-6">The journal entry you're looking for doesn't exist or you don't have permission to view it.</p>
          <button
            onClick={handleBack}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to General Ledger
          </button>
        </div>
      </div>
    );
  }
  const totals = (journalEntry?.lines || []).reduce(
    (acc, line) => {
      acc.debits += line.debit || line.debitAmount || 0;
      acc.credits += line.credit || line.creditAmount || 0;
      return acc;
    },
    { debits: 0, credits: 0 }
  );
  const isBalanced = Math.abs(totals.debits - totals.credits) < 0.0001;
  const isPosted = journalEntry.status === 'Posted' || journalEntry.status === 'posted';
  
  return (
    <div className="container mx-auto px-4 py-6 print:py-0">
      {/* Header - hidden in print */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 print:hidden">
        <div className="flex items-center mb-4 sm:mb-0">
          <button
            onClick={handleBack}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Journal Entry Details</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded flex items-center gap-2"
          >
            <Printer size={16} />
            Print
          </button>
          {!isPosted && (
            <Link href={`/accounting/journal-entries/edit/${id}`}>
              <button className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded flex items-center gap-2">
                <Edit size={16} />
                Edit
              </button>
            </Link>
          )}
          {!isPosted && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded flex items-center gap-2"
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      </div>
      
      {/* Title for print */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-center">Journal Entry</h1>
      </div>
      
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Are you sure you want to delete this journal entry? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Journal Entry Details */}
      <div className="bg-white rounded-lg shadow-sm p-6 print:shadow-none print:p-0">
        {isPosted && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Posted entries are read-only. Corrections must be made via reversal or a new adjusting entry.
          </div>
        )}
        {/* Summary and metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="flex flex-col">
            <div className="text-gray-500 text-sm">Date</div>
            <div className="flex items-center mt-1">
              <Calendar size={16} className="text-gray-400 mr-2" />
              <div className="font-medium">{formatDate(journalEntry.date)}</div>
            </div>
          </div>
          
          <div className="flex flex-col">
            <div className="text-gray-500 text-sm">Reference</div>
            <div className="flex items-center mt-1">
              <FileText size={16} className="text-gray-400 mr-2" />
              <div className="font-medium">{journalEntry.referenceNumber || journalEntry.reference || "N/A"}</div>
            </div>
          </div>
          
          <div className="flex flex-col">
            <div className="text-gray-500 text-sm">Entry Type</div>
            <div className="flex items-center mt-1">
              <div className="font-medium">{journalEntry.entryType || "Correction"}</div>
            </div>
          </div>
          
          <div className="flex flex-col">
            <div className="text-gray-500 text-sm">Status</div>
            <div className="flex items-center mt-1">
              {isBalanced ? (
                <>
                  <CheckCircle size={16} className="text-green-500 mr-2" />
                  <div className="text-green-600 font-medium">Balanced</div>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-red-500 mr-2" />
                  <div className="text-red-600 font-medium">Unbalanced</div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Description */}
        <div className="mb-8">
          <div className="text-gray-500 text-sm mb-1">Description</div>
          <div className="p-4 bg-gray-50 rounded">{journalEntry.description}</div>
        </div>
        
        <div className="mb-8">
          <div className="text-gray-500 text-sm mb-1">Internal Reference / Tag</div>
          <div className="p-4 bg-gray-50 rounded">{journalEntry.notes || "—"}</div>
        </div>
        
        {/* Journal Entry Lines */}
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-4">Entry Lines</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3 font-medium text-gray-500 text-sm">Account</th>
                  <th className="p-3 font-medium text-gray-500 text-sm">Description</th>
                  <th className="p-3 font-medium text-gray-500 text-sm text-right">Debit</th>
                  <th className="p-3 font-medium text-gray-500 text-sm text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {journalEntry.entries.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium">{entry.accountCode}</div>
                      <div className="text-gray-500 text-sm">{entry.accountName}</div>
                    </td>
                    <td className="p-3">{entry.description || "-"}</td>
                    <td className="p-3 text-right">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                    </td>
                    <td className="p-3 text-right">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                    </td>
                  </tr>
                ))}
                
                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 font-medium">
                  <td colSpan={2} className="p-3 text-right">
                    Totals:
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(journalEntry.totalDebit)}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(journalEntry.totalCredit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Footer with timestamp - visible only in print */}
        <div className="hidden print:block mt-12 text-sm text-gray-500 text-center">
          <div className="flex items-center justify-center">
            <Clock size={14} className="mr-1" /> 
            Printed on {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalEntryDetail;