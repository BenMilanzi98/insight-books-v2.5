"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  AlertCircle,
  Search,
  X,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";

const DEFAULT_FORM = { name: "", code: "" };

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [pagePermissions, setPagePermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });

  const [showModal, setShowModal] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = includeInactive ? branches : branches.filter((b) => b.isActive);
    if (!q) return list;
    return list.filter((b) => (b?.name || "").toLowerCase().includes(q) || (b?.code || "").toLowerCase().includes(q));
  }, [branches, search, includeInactive]);

  const loadBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/branches?includeInactive=${includeInactive ? "true" : "false"}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load branches");
      setBranches(json?.branches || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchPerms = async () => {
      const canCreate = await getPermission("branches.create");
      const canUpdate = await getPermission("branches.update");
      const canDelete = await getPermission("branches.delete");
      setPagePermissions({ canCreate, canUpdate, canDelete });
    };
    fetchPerms();
  }, []);

  useEffect(() => {
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  const openCreate = () => {
    setEditBranch(null);
    setForm(DEFAULT_FORM);
    setShowModal(true);
  };

  const openEdit = (branch) => {
    setEditBranch(branch);
    setForm({ name: branch?.name || "", code: branch?.code || "" });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditBranch(null);
    setForm(DEFAULT_FORM);
  };

  const save = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!form.name.trim()) throw new Error("Branch name is required.");

      const url = editBranch ? `/api/branches/${editBranch.id}` : "/api/branches";
      const method = editBranch ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim() || null,
        }),
      });
      const json = await res.json();
      
      if (!res.ok) {
        // Check if subscription is required
        if (json?.code === 'SUBSCRIPTION_REQUIRED' || res.status === 403) {
          // Redirect to subscription page
          window.location.href = '/subscription?redirected=true&reason=subscription_required';
          return;
        }
        throw new Error(json?.error || "Failed to save branch");
      }

      closeModal();
      await loadBranches();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (branch) => {
    try {
      setError(null);
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !branch.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update status");
      await loadBranches();
    } catch (e) {
      setError(e.message);
    }
  };

  const deactivate = async (branch) => {
    try {
      setError(null);
      const ok = window.confirm(`Deactivate branch "${branch.name}"? Transactions will remain linked for reporting.`);
      if (!ok) return;
      const res = await fetch(`/api/branches/${branch.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to deactivate branch");
      await loadBranches();
    } catch (e) {
      setError(e.message);
    }
  };

  const hardDelete = async (branch) => {
    try {
      setError(null);
      const ok = window.confirm(
        `Permanently delete branch "${branch.name}"?\n\nThis is only allowed if the branch has no linked transactions.`
      );
      if (!ok) return;
      const res = await fetch(`/api/branches/${branch.id}?hard=true`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // If branch has linked activity, offer a safe deactivate instead
        const msg = json?.error || "Failed to delete branch";
        const wantsDeactivate = window.confirm(
          `${msg}\n\nWould you like to deactivate this branch instead? (Recommended)`
        );
        if (wantsDeactivate) {
          await deactivate(branch);
          return;
        }
        throw new Error(msg);
      }
      await loadBranches();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <PermissionGuard permission="branches.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
            <p className="text-sm text-gray-600">Manage branch structure for branch-level and consolidated reporting.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/branches/migrate"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={18} />
              Migrate Data
            </Link>
            {pagePermissions.canCreate && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus size={18} />
                New Branch
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-md text-red-700 flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search branches..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Show inactive
            </label>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center text-gray-600">
              <Loader2 size={24} className="animate-spin mr-2 text-blue-600" />
              Loading branches...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-600">No branches found.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filtered.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{b.name}</span>
                      {b.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle size={14} />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                          <XCircle size={14} />
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{b.code ? `Code: ${b.code}` : "—"}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {pagePermissions.canUpdate && (
                      <button
                        type="button"
                        onClick={() => toggleActive(b)}
                        className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        {b.isActive ? "Deactivate" : "Activate"}
                      </button>
                    )}
                    {pagePermissions.canUpdate && (
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>
                    )}
                    {pagePermissions.canDelete && (
                      <button
                        type="button"
                        onClick={() => hardDelete(b)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        title="Delete (will fall back to deactivate if branch has transactions)"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeModal}>
            <div
              className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-lg mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{editBranch ? "Edit Branch" : "New Branch"}</h2>
                  <p className="text-sm text-gray-600">Create branches to enable branch-level reporting.</p>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={closeModal}>
                  <X size={22} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Lilongwe Branch"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code (optional)</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. LLW"
                  />
                </div>
              </div>
              <div className="p-5 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}


