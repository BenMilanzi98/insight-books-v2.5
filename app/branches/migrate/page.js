"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2, ArrowLeft, Database, RefreshCw } from "lucide-react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";

export default function BranchMigrationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [assignTo, setAssignTo] = useState("default");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadPreview();
    loadBranches();
  }, []);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/branches/migrate-data');
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
        if (data.userDefaultBranchId) {
          setSelectedBranchId(data.userDefaultBranchId);
        }
      } else {
        setError('Failed to load migration preview');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const res = await fetch('/api/branches?includeInactive=false');
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
  };

  const handleMigrate = async () => {
    if (assignTo === 'specific' && !selectedBranchId) {
      setError('Please select a branch');
      return;
    }

    try {
      setMigrating(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/branches/migrate-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: assignTo === 'specific' ? selectedBranchId : null,
          assignTo
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message || 'Migration completed successfully');
        await loadPreview(); // Refresh preview
      } else {
        setError(data.error || 'Migration failed');
      }
    } catch (e) {
      setError(e.message || 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <PermissionGuard permission="branches.view">
        <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading migration preview...</p>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="branches.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/branches"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft size={18} />
              Back to Branches
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Migrate Existing Data to Branches</h1>
            <p className="text-gray-600 mt-2">
              Assign existing transactions, inventory, and other data to branches for proper branch-level reporting.
            </p>
          </div>

          {/* Info Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-600 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">About Data Migration</h3>
                <p className="text-sm text-blue-800">
                  Records created before the branch system was implemented have <code className="bg-blue-100 px-1 rounded">branchId = null</code>.
                  This migration tool allows you to assign all existing data to a branch so it appears in branch-specific reports.
                  <br /><br />
                  <strong>Note:</strong> This only affects records with <code className="bg-blue-100 px-1 rounded">branchId = null</code>.
                  Records already assigned to branches will not be changed.
                </p>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-lg text-red-700 flex items-center gap-2">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 border border-green-200 bg-green-50 rounded-lg text-green-700 flex items-center gap-2">
              <CheckCircle size={20} />
              <span>{success}</span>
            </div>
          )}

          {/* Preview Section */}
          {preview && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="text-gray-600" size={24} />
                <h2 className="text-xl font-semibold text-gray-900">Migration Preview</h2>
              </div>

              {preview.hasDataToMigrate ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Found <strong className="text-gray-900">{preview.totalRecords.toLocaleString()}</strong> records without branch assignment:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-2xl font-bold text-gray-900">{preview.counts.sales}</div>
                        <div className="text-xs text-gray-600">Sales</div>
                      </div>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-2xl font-bold text-gray-900">{preview.counts.invoices}</div>
                        <div className="text-xs text-gray-600">Invoices</div>
                      </div>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-2xl font-bold text-gray-900">{preview.counts.expenses}</div>
                        <div className="text-xs text-gray-600">Expenses</div>
                      </div>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-2xl font-bold text-gray-900">{preview.counts.payments}</div>
                        <div className="text-xs text-gray-600">Payments</div>
                      </div>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-2xl font-bold text-gray-900">{preview.counts.products}</div>
                        <div className="text-xs text-gray-600">Products</div>
                      </div>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-2xl font-bold text-gray-900">{preview.counts.transactions}</div>
                        <div className="text-xs text-gray-600">Transactions</div>
                      </div>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-2xl font-bold text-gray-900">{preview.counts.journalEntries}</div>
                        <div className="text-xs text-gray-600">Journal Entries</div>
                      </div>
                    </div>
                  </div>

                  {/* Migration Options */}
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Assign to Branch</h3>
                    
                    <div className="space-y-3 mb-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="assignTo"
                          value="default"
                          checked={assignTo === "default"}
                          onChange={(e) => setAssignTo(e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="font-medium text-gray-900">My Default Branch</div>
                          <div className="text-sm text-gray-600">
                            {preview.userDefaultBranchId
                              ? `Assign to your default branch (set in User Management)`
                              : "No default branch set. Please set one in User Management first."}
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="assignTo"
                          value="specific"
                          checked={assignTo === "specific"}
                          onChange={(e) => setAssignTo(e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Specific Branch</div>
                          <select
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value)}
                            disabled={assignTo !== "specific"}
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <option value="">-- Select Branch --</option>
                            {branches.map(branch => (
                              <option key={branch.id} value={branch.id}>
                                {branch.name} {branch.code ? `(${branch.code})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                    </div>

                    <button
                      onClick={handleMigrate}
                      disabled={migrating || (assignTo === "specific" && !selectedBranchId) || (assignTo === "default" && !preview.userDefaultBranchId)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {migrating ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          Migrating...
                        </>
                      ) : (
                        <>
                          <Database size={18} />
                          Migrate {preview.totalRecords.toLocaleString()} Records
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="text-green-600 mx-auto mb-3" size={48} />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">All Data Already Assigned</h3>
                  <p className="text-gray-600">
                    All your records are already assigned to branches. No migration needed!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <div className="flex justify-end">
            <button
              onClick={loadPreview}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Refresh Preview
            </button>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}







