"use client";

import { useState, useEffect } from "react";
import {
  Gift,
  Plus,
  Pencil,
  Trash2,
  X,
  Home,
  Smartphone,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export default function BenefitsPage() {
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    defaultAmount: "",
    defaultPercentage: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" });

  useEffect(() => {
    fetchBenefits();
  }, []);

  const fetchBenefits = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/benefits");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load benefits");
      setBenefits(data.benefits || []);
    } catch (e) {
      setError(e.message);
      setBenefits([]);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      defaultAmount: "",
      defaultPercentage: "",
      isActive: true,
    });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({
      name: b.name || "",
      description: b.description || "",
      defaultAmount: b.defaultAmount != null ? b.defaultAmount : "",
      defaultPercentage: b.defaultPercentage != null ? b.defaultPercentage : "",
      isActive: b.isActive !== false,
    });
    setError("");
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name?.trim()) {
      setError("Benefit name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        defaultAmount: form.defaultAmount !== "" ? Number(form.defaultAmount) : 0,
        defaultPercentage:
          form.defaultPercentage !== "" ? Number(form.defaultPercentage) : null,
        isActive: form.isActive,
      };
      const url = editing ? `/api/benefits/${editing.id}` : "/api/benefits";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      showToast(editing ? "Benefit updated." : "Benefit created.");
      setModalOpen(false);
      fetchBenefits();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this benefit? Employee assignments will be cleared.")) return;
    try {
      const res = await fetch(`/api/benefits/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      showToast("Benefit removed.");
      fetchBenefits();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const iconForName = (name) => {
    const n = (name || "").toLowerCase();
    if (n.includes("house") || n.includes("housing") || n.includes("accommodation"))
      return <Home className="text-indigo-600" size={20} />;
    if (n.includes("airtime") || n.includes("air time"))
      return <Smartphone className="text-green-600" size={20} />;
    return <Gift className="text-amber-600" size={20} />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Benefits & Allowances</h1>
            <p className="text-gray-600 mt-1">
              Manage perks such as house allowance, airtime, and other allowances. Assign amounts per employee in Employee Management.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
          >
            <Plus size={18} />
            Add benefit
          </button>
        </div>

        {toast.visible && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
              toast.type === "error" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            {toast.message}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Loading benefits…
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {benefits.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Gift className="mx-auto mb-3 text-gray-400" size={48} />
                <p>No benefits defined yet.</p>
                <p className="text-sm mt-1">
                  Add House Allowance, Airtime, or other perks to assign to employees.
                </p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Add benefit
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {benefits.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0">{iconForName(b.name)}</div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{b.name}</div>
                        {b.description && (
                          <div className="text-sm text-gray-500 truncate">
                            {b.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">
                          Default:{" "}
                          {b.defaultAmount != null && b.defaultAmount > 0
                            ? `MWK ${Number(b.defaultAmount).toLocaleString()}`
                            : b.defaultPercentage != null && b.defaultPercentage > 0
                            ? `${b.defaultPercentage}% of salary`
                            : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!b.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                          Inactive
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">
                  {editing ? "Edit benefit" : "Add benefit"}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-4 space-y-4">
                {error && (
                  <div className="p-2 rounded bg-red-50 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. House Allowance, Airtime"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Short description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default amount (MWK)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.defaultAmount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, defaultAmount: e.target.value }))
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default % (optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={form.defaultPercentage}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, defaultPercentage: e.target.value }))
                      }
                      placeholder="—"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActive: e.target.checked }))
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : editing ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
