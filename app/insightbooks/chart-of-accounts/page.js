"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildDefaultSystemCoaPayload } from "@/lib/systemCoaPayload";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronRight,
  CloudDownload,
  GitMerge,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";

const ROOT_CODES = ["1000", "2000", "3000", "4000", "5000"];

function isAncestor(accounts, ancestorCode, nodeCode) {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  let cur = nodeCode;
  const seen = new Set();
  while (cur) {
    if (cur === ancestorCode) return true;
    if (seen.has(cur)) return false;
    seen.add(cur);
    cur = byCode.get(cur)?.parentCode || null;
  }
  return false;
}

function buildChildrenMap(accounts) {
  const m = new Map();
  for (const a of accounts) {
    const p = a.parentCode || "__root__";
    if (!m.has(p)) m.set(p, []);
    m.get(p).push(a);
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  return m;
}

/** Every whitespace-separated token must appear as a substring (case-insensitive), e.g. "transport exp" → "Transport Expenses". */
function textMatchesTokenSearch(haystack, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const h = String(haystack || "").toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((t) => h.includes(t));
}

/** Catalog UI: scope filter labels use internal tenant id only (no business display names). */
function formatTenantIdForScope(id) {
  const s = String(id ?? "").trim();
  return s || "—";
}

function coaDefinitionSearchHaystack(row) {
  return [
    row.code,
    row.name,
    row.type,
    row.subtype,
    row.description,
    row.normalBalance,
    row.parentCode,
  ]
    .filter((x) => x != null && String(x).trim())
    .join(" ");
}

/**
 * When searching, show matching rows plus every ancestor so the tree still makes sense.
 * @returns {Set<string> | null} null = no filter (show all)
 */
function getVisibleCodesForCoaSearch(accounts, query) {
  const q = String(query || "").trim();
  if (!q || !accounts?.length) return null;
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const matchCodes = new Set();
  for (const a of accounts) {
    if (a?.code && textMatchesTokenSearch(coaDefinitionSearchHaystack(a), q)) {
      matchCodes.add(a.code);
    }
  }
  if (matchCodes.size === 0) return new Set();
  const visible = new Set(matchCodes);
  for (const code of matchCodes) {
    let cur = code;
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      visible.add(cur);
      const p = byCode.get(cur)?.parentCode;
      cur = p && byCode.has(p) ? p : null;
    }
  }
  return visible;
}

/** BFS from canonical roots plus any other top-level rows (parentCode empty → __root__). */
function getReachableAccountCodes(childrenMap, rootCodes) {
  const seeds = new Set(rootCodes);
  const rootBucket = childrenMap.get("__root__") || [];
  for (const r of rootBucket) {
    if (r?.code) seeds.add(r.code);
  }
  const seen = new Set();
  const stack = [...seeds];
  while (stack.length) {
    const c = stack.pop();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    for (const ch of childrenMap.get(c) || []) {
      if (ch?.code) stack.push(ch.code);
    }
  }
  return seen;
}

/** Accounts not reachable from seeds — e.g. broken parentCode or cycles. Forest roots for rendering. */
function getOrphanForestRoots(accounts, reachableCodes) {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const unreachable = accounts.filter((a) => a?.code && !reachableCodes.has(a.code));
  const U = new Set(unreachable.map((a) => a.code));
  return unreachable
    .filter((a) => {
      const p = a.parentCode;
      if (!p || !byCode.has(p)) return true;
      if (!U.has(p)) return true;
      return false;
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function CoaTableRow({
  row,
  depth,
  childrenMap,
  payload,
  visibleCodes,
  onDropOn,
  dragCode,
  setDragCode,
  onEdit,
  onMerge,
  onToggleDeactivate,
}) {
  const isRoot = ROOT_CODES.includes(row.code);
  const isMergeSource = (payload.merges || []).some((m) => m.sourceCode === row.code);
  const mergeTarget = (payload.merges || []).find((m) => m.sourceCode === row.code);
  const deactivated = (payload.deactivatedCodes || []).includes(row.code);
  const childKey = row.code;
  const hasKids = (childrenMap.get(childKey) || []).some((ch) => !visibleCodes || visibleCodes.has(ch.code));

  return (
    <tr
      className={`border-b border-slate-100 ${deactivated ? "bg-slate-50 text-slate-400" : "bg-white"}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData("text/coa-code") || dragCode;
        if (from && from !== row.code) onDropOn(from, row.code);
        setDragCode(null);
      }}
    >
      <td
        className={`sticky left-0 z-[1] border-r border-slate-100 bg-inherit px-2 py-2 align-middle sm:static sm:z-auto sm:border-r-0 ${deactivated ? "bg-slate-50" : "bg-white"}`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <div className="flex min-w-0 items-center gap-1">
          {hasKids ? (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <span className="inline-block w-4 shrink-0" aria-hidden />
          )}
          <span
            draggable={!row.isSystem || !isRoot}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/coa-code", row.code);
              e.dataTransfer.effectAllowed = "move";
              setDragCode(row.code);
            }}
            onDragEnd={() => setDragCode(null)}
            className={`min-h-[44px] min-w-0 touch-manipulation cursor-grab rounded px-1.5 py-2 font-mono text-xs font-semibold leading-tight active:cursor-grabbing sm:min-h-0 sm:py-0.5 ${dragCode === row.code ? "bg-indigo-100 text-indigo-900" : "text-slate-800"}`}
            title="Drag onto another row to reparent under that account"
          >
            {row.code}
          </span>
        </div>
      </td>
      <td className="max-w-[min(100vw,280px)] px-2 py-2 text-sm text-slate-900 sm:max-w-none">
        {mergeTarget ? (
          <span className="block text-slate-600">
            <span className="font-mono text-xs">{row.code}</span>
            <span className="mx-1">→</span>
            <span className="font-semibold text-indigo-700">{mergeTarget.targetCode}</span>
            <span className="mt-0.5 block text-[11px] font-normal text-slate-500 sm:inline sm:mt-0">
              (merged for display / pickers)
            </span>
          </span>
        ) : (
          <span className="line-clamp-2 sm:line-clamp-none">{row.name}</span>
        )}
      </td>
      <td className="hidden px-2 py-2 text-xs text-slate-600 md:table-cell">{row.type}</td>
      <td className="hidden w-14 px-1 py-2 text-center sm:table-cell">
        <input
          type="checkbox"
          className="h-4 w-4 touch-manipulation rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          checked={deactivated}
          disabled={row.isSystem}
          title={row.isSystem ? "System accounts cannot be deactivated" : "Deactivate on all tenants when applied"}
          onChange={() => onToggleDeactivate(row.code)}
        />
      </td>
      <td className="px-1 py-2 sm:px-2">
        <div className="flex items-center justify-end gap-0.5 sm:justify-end">
          <span className="mr-1 text-[10px] font-medium uppercase text-slate-400 sm:hidden">Off</span>
          <input
            type="checkbox"
            className="h-5 w-5 touch-manipulation rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 sm:hidden"
            checked={deactivated}
            disabled={row.isSystem}
            aria-label={`Deactivate ${row.code}`}
            onChange={() => onToggleDeactivate(row.code)}
          />
          <button
            type="button"
            className="touch-manipulation rounded-md p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:p-1.5"
            title="Rename"
            onClick={() => onEdit(row)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="touch-manipulation rounded-md p-2.5 text-slate-500 hover:bg-slate-100 hover:text-violet-700 disabled:opacity-30 sm:p-1.5"
            title="Merge into another code (system accounts allowed; both codes stay in DB for audit)"
            onClick={() => onMerge(row)}
          >
            <GitMerge className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="touch-manipulation rounded-md p-2.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 sm:p-1.5"
            title="Remove merge for this code"
            disabled={!isMergeSource}
            onClick={() => onMerge(row, true)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TreeRows({
  parentKey,
  depth,
  childrenMap,
  payload,
  visibleCodes,
  onDropOn,
  dragCode,
  setDragCode,
  onEdit,
  onMerge,
  onToggleDeactivate,
}) {
  const rows = (childrenMap.get(parentKey) || []).filter((r) => !visibleCodes || visibleCodes.has(r.code));
  return rows.map((row) => (
    <React.Fragment key={row.code}>
      <CoaTableRow
        row={row}
        depth={depth}
        childrenMap={childrenMap}
        payload={payload}
        visibleCodes={visibleCodes}
        onDropOn={onDropOn}
        dragCode={dragCode}
        setDragCode={setDragCode}
        onEdit={onEdit}
        onMerge={onMerge}
        onToggleDeactivate={onToggleDeactivate}
      />
      <TreeRows
        parentKey={row.code}
        depth={depth + 1}
        childrenMap={childrenMap}
        payload={payload}
        visibleCodes={visibleCodes}
        onDropOn={onDropOn}
        dragCode={dragCode}
        setDragCode={setDragCode}
        onEdit={onEdit}
        onMerge={onMerge}
        onToggleDeactivate={onToggleDeactivate}
      />
    </React.Fragment>
  ));
}

function ModalPortal({ children, open }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export default function AdminSystemChartOfAccountsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [payload, setPayload] = useState(null);
  const [dragCode, setDragCode] = useState(null);
  const [mergeRow, setMergeRow] = useState(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [addName, setAddName] = useState("");
  const [addParentCode, setAddParentCode] = useState("5000");
  const [tenantInventory, setTenantInventory] = useState(null);
  const [tenantInventoryError, setTenantInventoryError] = useState(null);
  const [tenantPullLoading, setTenantPullLoading] = useState(false);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantIdFilter, setTenantIdFilter] = useState("");
  const [tenantSourceTab, setTenantSourceTab] = useState("gl");
  /** Filter system definition table: tokenized substring match on name, code, type, subtype, description. */
  const [coaDefinitionSearch, setCoaDefinitionSearch] = useState("");

  const loadDefinition = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const defRes = await fetch("/api/admin/system-coa", { credentials: "include" });
      const data = await defRes.json().catch(() => ({}));
      if (!defRes.ok) throw new Error(data.error || "Failed to load");
      setPayload(data.payload);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Same data tenants see under Chart of accounts + Payment accounts (management); all businesses, read-only. */
  const pullTenantAccounts = useCallback(async () => {
    setTenantPullLoading(true);
    setTenantInventoryError(null);
    setMessage(null);
    try {
      const invRes = await fetch("/api/admin/system-coa/tenant-accounts", { credentials: "include" });
      const inv = await invRes.json().catch(() => ({}));
      if (!invRes.ok) {
        setTenantInventoryError(inv.error || `Tenant pull failed (${invRes.status})`);
        return;
      }
      setTenantInventory(inv);
      setTenantInventoryError(null);
      const gl = inv.meta?.combinedGlCatalogCount ?? inv.meta?.chartAccountCount ?? 0;
      const pay = inv.meta?.paymentAccountCount ?? 0;
      const tn = inv.meta?.tenantCount ?? 0;
      const bp = inv.meta?.blueprintCatalogCount ?? 0;
      const sd = inv.meta?.savedDefinitionCatalogCount ?? 0;
      const rawTenant = inv.meta?.chartAccountCount ?? 0;
      setMessage(
        `Pulled GL catalog: ${gl} distinct codes (${rawTenant} tenant DB rows + ${bp} blueprint + ${sd} saved definition entries, deduplicated by code) and ${pay} payment accounts across ${tn} tenants. Merges are configured in the system template above, then Apply to all tenants.`
      );
    } catch (e) {
      setTenantInventoryError(e?.message || "Tenant pull failed");
    } finally {
      setTenantPullLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefinition();
  }, [loadDefinition]);

  useEffect(() => {
    if (!mergeRow && !editRow && !addOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMergeRow(null);
        setEditRow(null);
        setAddOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mergeRow, editRow, addOpen]);

  useEffect(() => {
    if (mergeRow || editRow || addOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mergeRow, editRow, addOpen]);

  const childrenMap = useMemo(() => {
    if (!payload?.accounts) return new Map();
    return buildChildrenMap(payload.accounts);
  }, [payload]);

  /** Top-level rows (no parent) besides the five canonical roots — still draggable into the main tree. */
  const extraRootLevelAccounts = useMemo(() => {
    const bucket = childrenMap.get("__root__") || [];
    return bucket
      .filter((r) => r?.code && !ROOT_CODES.includes(r.code))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [childrenMap]);

  const reachableAllCodes = useMemo(
    () => getReachableAccountCodes(childrenMap, ROOT_CODES),
    [childrenMap]
  );

  const orphanForestRoots = useMemo(() => {
    if (!payload?.accounts?.length) return [];
    return getOrphanForestRoots(payload.accounts, reachableAllCodes);
  }, [payload, reachableAllCodes]);

  const coaSearchVisibleCodes = useMemo(
    () => getVisibleCodesForCoaSearch(payload?.accounts, coaDefinitionSearch),
    [payload?.accounts, coaDefinitionSearch]
  );

  const coaSearchStats = useMemo(() => {
    const q = coaDefinitionSearch.trim();
    if (!q || !payload?.accounts?.length) {
      return { active: false, directMatches: 0, visibleRows: 0 };
    }
    const directMatches = payload.accounts.filter((a) =>
      textMatchesTokenSearch(coaDefinitionSearchHaystack(a), q)
    ).length;
    const visibleRows = coaSearchVisibleCodes instanceof Set ? coaSearchVisibleCodes.size : 0;
    return { active: true, directMatches, visibleRows };
  }, [payload?.accounts, coaDefinitionSearch, coaSearchVisibleCodes]);

  const extraRootVisible = useMemo(() => {
    if (!coaSearchVisibleCodes) return extraRootLevelAccounts;
    return extraRootLevelAccounts.filter((r) => coaSearchVisibleCodes.has(r.code));
  }, [extraRootLevelAccounts, coaSearchVisibleCodes]);

  const orphanRootsVisible = useMemo(() => {
    if (!coaSearchVisibleCodes) return orphanForestRoots;
    return orphanForestRoots.filter((r) => coaSearchVisibleCodes.has(r.code));
  }, [orphanForestRoots, coaSearchVisibleCodes]);

  const parentOptions = useMemo(() => {
    if (!payload?.accounts) return [];
    return [...payload.accounts].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true })
    );
  }, [payload]);

  const systemCodeSet = useMemo(() => new Set((payload?.accounts || []).map((a) => a.code)), [payload]);

  const mergeBySourceCode = useMemo(() => {
    const m = new Map();
    for (const x of payload?.merges || []) {
      if (x?.sourceCode) m.set(x.sourceCode, x);
    }
    return m;
  }, [payload?.merges]);

  /** Server-built union: tenant DB (deduped by code) + saved definition + blueprint; optional scope by tenant id. */
  const allGlInventoryRows = useMemo(() => {
    if (!tenantInventory) return [];
    const tid = tenantIdFilter.trim();
    const combined = tenantInventory.combinedGlCatalog;
    if (Array.isArray(combined) && combined.length > 0) {
      if (!tid) return combined;
      return combined.filter((r) => {
        if (r._inventorySource !== "tenant") return true;
        return r.tenantId === tid;
      });
    }
    const tenant = (tenantInventory.chartAccounts || []).map((r) => ({ ...r, _inventorySource: "tenant" }));
    const bp = (tenantInventory.blueprintChartCatalog || []).map((r) => ({ ...r, _inventorySource: "blueprint" }));
    const sd = (tenantInventory.savedDefinitionCatalog || []).map((r) => ({ ...r, _inventorySource: "saved_definition" }));
    const norm = (c) => String(c ?? "").trim().toLowerCase();
    const seen = new Set();
    const out = [];
    const tenantSlice = tid ? tenant.filter((r) => r.tenantId === tid) : tenant;
    for (const r of tenantSlice) {
      const c = norm(r.accountCode);
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push(r);
    }
    for (const r of sd) {
      const c = norm(r.code);
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push(r);
    }
    for (const r of bp) {
      const c = norm(r.code);
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push(r);
    }
    return out;
  }, [tenantInventory, tenantIdFilter]);

  const filteredTenantChart = useMemo(() => {
    const tid = tenantIdFilter.trim();
    const q = tenantSearch.trim();
    return allGlInventoryRows.filter((r) => {
      if (tid && r._inventorySource === "tenant" && r.tenantId !== tid) return false;
      const blob =
        r._inventorySource === "tenant"
          ? [
              r.tenantId,
              r.accountCode,
              r.accountName,
              r.accountType,
              r.accountSubtype,
              r.description,
              r.mergedIntoAccount?.accountCode,
              r.mergedIntoAccount?.accountName,
              r.parentAccount?.accountCode,
              r.parentAccount?.accountName,
            ]
              .filter((x) => x != null && String(x).trim())
              .join(" ")
          : [
              r.code,
              r.name,
              r.type,
              r.subtype,
              r.parentCode,
              r.description,
              r._inventorySource,
              r.isSystem ? "system" : "",
            ]
              .filter(Boolean)
              .join(" ");
      return textMatchesTokenSearch(blob, q);
    });
  }, [allGlInventoryRows, tenantIdFilter, tenantSearch]);

  const filteredTenantPayments = useMemo(() => {
    const rows = tenantInventory?.paymentAccounts || [];
    const tid = tenantIdFilter.trim();
    const q = tenantSearch.trim();
    return rows.filter((r) => {
      if (tid && r.tenantId !== tid) return false;
      const blob = [
        r.tenantId,
        r.name,
        r.accountType,
        r.reference,
        r.coaAccount?.accountCode,
        r.coaAccount?.accountName,
        r.coaAccount?.accountType,
      ]
        .filter(Boolean)
        .join(" ");
      return textMatchesTokenSearch(blob, q);
    });
  }, [tenantInventory, tenantIdFilter, tenantSearch]);

  const onDropOn = useCallback((movingCode, newParentCode) => {
    setPayload((prev) => {
      if (!prev?.accounts) return prev;
      if (movingCode === newParentCode) return prev;
      if (isAncestor(prev.accounts, movingCode, newParentCode)) {
        setError("Cannot move an account under one of its descendants.");
        return prev;
      }
      const next = {
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.code === movingCode ? { ...a, parentCode: newParentCode } : a
        ),
      };
      setError(null);
      setMessage("Structure updated locally — save, then apply to tenants.");
      return next;
    });
  }, []);

  const onToggleDeactivate = (code) => {
    setPayload((prev) => {
      const set = new Set(prev.deactivatedCodes || []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...prev, deactivatedCodes: [...set] };
    });
    setMessage(null);
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditName(row.name || "");
  };

  const saveEdit = () => {
    const trimmed = editName.trim();
    if (!editRow || !trimmed) return;
    setPayload((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.code === editRow.code ? { ...a, name: trimmed } : a)),
    }));
    setEditRow(null);
    setMessage("Renamed locally — save, then apply to tenants.");
  };

  const onMerge = (row, unmerge) => {
    if (unmerge) {
      setPayload((prev) => ({
        ...prev,
        merges: (prev.merges || []).filter((m) => m.sourceCode !== row.code),
      }));
      setMergeRow(null);
      setMessage("Merge removed locally — save, then apply.");
      return;
    }
    setMergeRow(row);
    setMergeTarget("");
  };

  const confirmMerge = () => {
    if (!mergeRow || !mergeTarget || mergeRow.code === mergeTarget) return;
    setPayload((prev) => {
      const others = (prev.merges || []).filter((m) => m.sourceCode !== mergeRow.code);
      return {
        ...prev,
        merges: [...others, { sourceCode: mergeRow.code, targetCode: mergeTarget }],
      };
    });
    setMergeRow(null);
    setMergeTarget("");
    setMessage("Merge added locally — save, then apply to tenants.");
  };

  const saveDefinition = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/system-coa", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setPayload(data.payload);
      setMessage("Definition saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const applyAll = async () => {
    if (!window.confirm("Apply the saved definition to every tenant? This updates names, parents, merges, and deactivations.")) {
      return;
    }
    setApplying(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/system-coa/apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Apply failed");
      const fail = data.failures?.length ? ` (${data.failures.length} tenant failures — see server log)` : "";
      setMessage(`Applied: ${data.successCount}/${data.tenantCount} tenants.${fail}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const openAdd = (prefillCode, prefillName) => {
    const str = (v) => (typeof v === "string" ? v : "");
    setAddCode(str(prefillCode));
    setAddName(str(prefillName));
    setAddParentCode("5000");
    setAddOpen(true);
  };

  const saveAdd = () => {
    const c = addCode.trim();
    if (!c || !payload?.accounts) return;
    if (payload.accounts.some((a) => a.code === c)) {
      setError("That code already exists.");
      return;
    }
    if (!payload.accounts.some((a) => a.code === addParentCode)) {
      setError("Parent code must exist in the list.");
      return;
    }
    const name = addName.trim() || c;
    setPayload((prev) => ({
      ...prev,
      accounts: [
        ...prev.accounts,
        {
          code: c,
          name,
          type: "Expense",
          subtype: "Operating Expense",
          normalBalance: "Debit",
          parentCode: addParentCode,
          isSystem: false,
          description: null,
        },
      ],
    }));
    setAddOpen(false);
    setError(null);
    setMessage("Account added locally — save, then apply.");
  };

  const resetFromBlueprint = () => {
    if (!window.confirm("Reset the editor to the built-in blueprint? This does not change the server until you click Save.")) return;
    setPayload(buildDefaultSystemCoaPayload());
    setMessage("Reset to default blueprint in editor only — click Save to store, then Apply.");
  };

  if (loading && !payload) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading system chart…
      </div>
    );
  }

  const mergeModalOpen = Boolean(mergeRow);
  const editModalOpen = Boolean(editRow);
  const anyModal = mergeModalOpen || editModalOpen || addOpen;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">System chart of accounts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Edit the canonical GL template. <strong>Save</strong> stores the definition. <strong>Apply to all tenants</strong> syncs
            every tenant&apos;s accounts by <span className="font-mono">accountCode</span> (creates missing codes, updates names and
            parents). <strong>Merges</strong> keep both rows and codes in the database; merged sources are hidden from account pickers
            and show as pointing to the target for a clean chart and easier auditing.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={loadDefinition}
            className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto sm:min-h-0 sm:py-2"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            Reload definition
          </button>
          <button
            type="button"
            onClick={saveDefinition}
            disabled={saving || !payload}
            className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 sm:w-auto sm:min-h-0 sm:py-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
            Save definition
          </button>
          <button
            type="button"
            onClick={applyAll}
            disabled={applying}
            className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50 sm:w-auto sm:min-h-0 sm:py-2"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 shrink-0" />}
            Apply to all tenants
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800 sm:px-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}
      {message && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900 sm:px-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="min-w-0 break-words">{message}</span>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => openAdd()}
          className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 sm:w-auto sm:min-h-0 sm:py-2"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Add account
        </button>
        <button
          type="button"
          onClick={resetFromBlueprint}
          className="min-h-[44px] w-full touch-manipulation rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100 sm:w-auto sm:min-h-0 sm:py-2"
        >
          Reset editor to default blueprint
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="coa-def-search" className="sr-only">
              Search system accounts by name or code
            </label>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="coa-def-search"
                type="search"
                value={coaDefinitionSearch}
                onChange={(e) => setCoaDefinitionSearch(e.target.value)}
                placeholder='e.g. transport — matches "Transportation", "Transport expense", codes…'
                className="block min-h-[44px] w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <button
              type="button"
              onClick={() => setCoaDefinitionSearch("")}
              className="inline-flex min-h-[44px] shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Clear search
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Multiple words: each word must appear somewhere in the account name, code, type, subtype, or description. Rows include
            parent path so you can drag or <strong>merge</strong> (system accounts can be merge sources or targets).
          </p>
          {coaSearchStats.active && (
            <p className="mt-1 text-xs font-medium text-indigo-800">
              {coaSearchStats.directMatches} direct match{coaSearchStats.directMatches === 1 ? "" : "es"},{" "}
              {coaSearchStats.visibleRows} row{coaSearchStats.visibleRows === 1 ? "" : "s"} shown (with ancestors).
            </p>
          )}
        </div>
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2.5 text-xs leading-snug text-slate-600 sm:text-sm">
          Drag a <span className="font-mono">code</span> chip onto a row to set that row as the new parent (no cycles). Every account in
          the definition appears below: main tree under roots {ROOT_CODES.join(", ")}, then any other top-level codes, then disconnected
          rows (fix by dragging onto a valid parent). <strong>Merge</strong> uses the row actions (including system accounts).
        </div>
        <div className="max-h-[min(70dvh,720px)] overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[min(100%,520px)] border-collapse text-left text-sm sm:min-w-[640px]">
            <thead className="sticky top-0 z-[3] border-b border-slate-200 bg-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:text-xs">
              <tr>
                <th className="sticky left-0 z-[3] min-w-[4.5rem] border-r border-slate-200 bg-slate-100 px-2 py-2 sm:static sm:z-auto sm:min-w-0 sm:border-r-0">
                  Code
                </th>
                <th className="min-w-0 px-2 py-2">Name / merge</th>
                <th className="hidden min-w-[4rem] px-2 py-2 md:table-cell">Type</th>
                <th className="hidden w-14 px-1 py-2 text-center sm:table-cell">Off</th>
                <th className="w-[8.5rem] shrink-0 px-1 py-2 text-right sm:w-auto sm:px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coaDefinitionSearch.trim() && coaSearchVisibleCodes?.size === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-600">
                    No system accounts match <span className="font-mono font-semibold text-slate-800">{coaDefinitionSearch.trim()}</span>
                    . Try fewer or shorter words (e.g. <span className="font-mono">transport</span>).
                  </td>
                </tr>
              )}
              {ROOT_CODES.map((code) => {
                const row = payload?.accounts?.find((a) => a.code === code);
                if (!row) return null;
                if (coaSearchVisibleCodes && !coaSearchVisibleCodes.has(code)) return null;
                const rootIsMergeSource = (payload.merges || []).some((m) => m.sourceCode === row.code);
                const rootMergeTarget = (payload.merges || []).find((m) => m.sourceCode === row.code);
                return (
                  <React.Fragment key={code}>
                    <tr
                      className="border-b border-slate-200 bg-slate-200/80 font-semibold"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = e.dataTransfer.getData("text/coa-code") || dragCode;
                        if (from && from !== code) onDropOn(from, code);
                        setDragCode(null);
                      }}
                    >
                      <td className="sticky left-0 z-[1] border-r border-slate-200 bg-slate-200/95 px-2 py-2 font-mono text-xs sm:static sm:z-auto sm:border-r-0 sm:bg-transparent">
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/coa-code", row.code);
                            setDragCode(row.code);
                          }}
                          onDragEnd={() => setDragCode(null)}
                          className="inline-flex min-h-[44px] touch-manipulation cursor-grab items-center rounded px-1 active:cursor-grabbing sm:min-h-0"
                        >
                          {row.code}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {rootMergeTarget ? (
                          <span className="block text-slate-700">
                            <span className="font-mono text-xs">{row.code}</span>
                            <span className="mx-1">→</span>
                            <span className="font-semibold text-indigo-800">{rootMergeTarget.targetCode}</span>
                            <span className="mt-0.5 block text-[11px] font-normal text-slate-600 sm:inline sm:mt-0">
                              (merged for display / pickers)
                            </span>
                          </span>
                        ) : (
                          row.name
                        )}
                      </td>
                      <td className="hidden px-2 py-2 text-xs md:table-cell">{row.type}</td>
                      <td className="hidden px-2 py-2 text-center sm:table-cell">—</td>
                      <td className="px-1 py-2 text-right sm:px-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            className="touch-manipulation rounded-md p-2.5 text-slate-600 hover:bg-white sm:p-1.5"
                            title="Rename"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="touch-manipulation rounded-md p-2.5 text-slate-600 hover:bg-white hover:text-violet-800 sm:p-1.5"
                            title="Merge this root into another code (system merges allowed)"
                            onClick={() => onMerge(row)}
                          >
                            <GitMerge className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="touch-manipulation rounded-md p-2.5 text-slate-600 hover:bg-white hover:text-rose-700 disabled:opacity-30 sm:p-1.5"
                            title="Remove merge for this code"
                            disabled={!rootIsMergeSource}
                            onClick={() => onMerge(row, true)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    <TreeRows
                      parentKey={code}
                      depth={1}
                      childrenMap={childrenMap}
                      payload={payload}
                      visibleCodes={coaSearchVisibleCodes}
                      onDropOn={onDropOn}
                      dragCode={dragCode}
                      setDragCode={setDragCode}
                      onEdit={openEdit}
                      onMerge={onMerge}
                      onToggleDeactivate={onToggleDeactivate}
                    />
                  </React.Fragment>
                );
              })}
              {extraRootVisible.length > 0 && (
                <>
                  <tr className="border-b border-sky-200 bg-sky-50">
                    <td colSpan={5} className="px-2 py-2 text-xs font-semibold text-sky-950">
                      Other top-level accounts (same bucket as roots; drag a code onto a row under{" "}
                      {ROOT_CODES.join(", ")} to attach to the main tree).
                    </td>
                  </tr>
                  {extraRootVisible.map((row) => (
                    <React.Fragment key={`xroot-${row.code}`}>
                      <CoaTableRow
                        row={row}
                        depth={0}
                        childrenMap={childrenMap}
                        payload={payload}
                        visibleCodes={coaSearchVisibleCodes}
                        onDropOn={onDropOn}
                        dragCode={dragCode}
                        setDragCode={setDragCode}
                        onEdit={openEdit}
                        onMerge={onMerge}
                        onToggleDeactivate={onToggleDeactivate}
                      />
                      <TreeRows
                        parentKey={row.code}
                        depth={1}
                        childrenMap={childrenMap}
                        payload={payload}
                        visibleCodes={coaSearchVisibleCodes}
                        onDropOn={onDropOn}
                        dragCode={dragCode}
                        setDragCode={setDragCode}
                        onEdit={openEdit}
                        onMerge={onMerge}
                        onToggleDeactivate={onToggleDeactivate}
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
              {orphanRootsVisible.length > 0 && (
                <>
                  <tr className="border-b border-amber-200 bg-amber-50">
                    <td colSpan={5} className="px-2 py-2 text-xs font-semibold text-amber-950">
                      Disconnected accounts (parent code missing from this list or not in the tree). Drag a code onto any valid row
                      above to reparent so they join the main chart.
                    </td>
                  </tr>
                  {orphanRootsVisible.map((row) => (
                    <React.Fragment key={`orphan-${row.code}`}>
                      <CoaTableRow
                        row={row}
                        depth={0}
                        childrenMap={childrenMap}
                        payload={payload}
                        visibleCodes={coaSearchVisibleCodes}
                        onDropOn={onDropOn}
                        dragCode={dragCode}
                        setDragCode={setDragCode}
                        onEdit={openEdit}
                        onMerge={onMerge}
                        onToggleDeactivate={onToggleDeactivate}
                      />
                      <TreeRows
                        parentKey={row.code}
                        depth={1}
                        childrenMap={childrenMap}
                        payload={payload}
                        visibleCodes={coaSearchVisibleCodes}
                        onDropOn={onDropOn}
                        dragCode={dragCode}
                        setDragCode={setDragCode}
                        onEdit={openEdit}
                        onMerge={onMerge}
                        onToggleDeactivate={onToggleDeactivate}
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section className="mt-10 space-y-4 border-t border-slate-200 pt-8" aria-labelledby="tenant-inventory-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 id="tenant-inventory-heading" className="text-lg font-semibold text-slate-900">
              Full GL catalog (entire system)
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
              One pull lists <strong>everywhere</strong> chart-of-accounts codes appear: <strong>all tenant databases</strong> (same as
              each business&apos;s <span className="font-medium text-slate-800">/chart-of-accounts</span>), the{" "}
              <strong>default hard-coded blueprint</strong> shipped in code, and the <strong>saved system definition</strong> in the
              database (the template you edit above).               Use search to find similar names. Codes that appear in the <strong>system template</strong> (editor above) can use{" "}
              <strong>Merge into…</strong> in the catalog table to designate the survivor account; then <strong>Save</strong> and{" "}
              <strong>Apply to all tenants</strong>. Other codes: <strong>Add to template</strong> first. Payment methods still come from{" "}
              <span className="font-medium text-slate-800">/payments/management</span>.
            </p>
            {tenantInventory?.meta && (
              <p className="mt-2 text-xs text-slate-500">
                Last pull:{" "}
                <span className="font-medium text-slate-700">{tenantInventory.meta.combinedGlCatalogCount ?? tenantInventory.meta.chartAccountCount}</span>{" "}
                distinct GL codes (
                <span className="font-medium text-slate-700">{tenantInventory.meta.chartAccountCount}</span> tenant DB rows +{" "}
                <span className="font-medium text-slate-700">{tenantInventory.meta.blueprintCatalogCount ?? 0}</span> blueprint +{" "}
                <span className="font-medium text-slate-700">{tenantInventory.meta.savedDefinitionCatalogCount ?? 0}</span> saved
                definition, deduplicated by code),{" "}
                <span className="font-medium text-slate-700">{tenantInventory.meta.paymentAccountCount}</span> payment accounts,{" "}
                <span className="font-medium text-slate-700">{tenantInventory.meta.tenantCount}</span> tenants
                {tenantInventory.meta.filteredByTenantId ? ` (API filtered to one tenant)` : ""}.
              </p>
            )}
          </div>
          <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={pullTenantAccounts}
              disabled={tenantPullLoading}
              className="inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[44px] sm:w-auto sm:py-2.5"
            >
              {tenantPullLoading ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              ) : (
                <CloudDownload className="h-5 w-5 shrink-0" />
              )}
              {tenantInventory ? "Refresh full catalog" : "Pull full GL catalog"}
            </button>
          </div>
        </div>

        {tenantInventoryError && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex min-w-0 items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="min-w-0 break-words">
                Could not pull tenant data: {tenantInventoryError}. The system template above is unchanged.
              </span>
            </div>
            <button
              type="button"
              onClick={pullTenantAccounts}
              disabled={tenantPullLoading}
              className="inline-flex min-h-[44px] shrink-0 touch-manipulation items-center justify-center rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        )}

        {!tenantInventory && !tenantInventoryError && !tenantPullLoading && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center">
            <p className="mx-auto max-w-lg text-sm text-slate-600">
              No catalog loaded yet. Press <strong>Pull full GL catalog</strong> above to load tenant chart rows, the default
              hard-coded blueprint, the saved system definition from the database, and payment accounts from every business.
            </p>
          </div>
        )}

        {tenantPullLoading && !tenantInventory && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-12 text-slate-600">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm font-medium">Pulling full GL catalog from the system…</span>
          </div>
        )}

        {tenantInventory && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1 sm:max-w-xs">
                <label htmlFor="tenant-inv-filter" className="block text-xs font-medium text-slate-600">
                  Tenant ID (tenant DB rows only)
                </label>
                <select
                  id="tenant-inv-filter"
                  className="mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={tenantIdFilter}
                  onChange={(e) => setTenantIdFilter(e.target.value)}
                >
                  <option value="">All tenants</option>
                  {(tenantInventory.tenants || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatTenantIdForScope(t.id)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Blueprint and saved-definition rows always stay visible; this filter only narrows tenant DB rows.
                </p>
              </div>
              <div className="min-w-0 flex-1 sm:max-w-md">
                <label htmlFor="tenant-inv-search" className="block text-xs font-medium text-slate-600">
                  Search
                </label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="tenant-inv-search"
                    type="search"
                    value={tenantSearch}
                    onChange={(e) => setTenantSearch(e.target.value)}
                    placeholder="Words: transport expense — matches names, codes, types…"
                    className="block min-h-[44px] w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setTenantSourceTab("gl")}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium touch-manipulation sm:flex-none sm:px-4 ${
                  tenantSourceTab === "gl"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                GL / full catalog ({filteredTenantChart.length})
              </button>
              <button
                type="button"
                onClick={() => setTenantSourceTab("payment")}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium touch-manipulation sm:flex-none sm:px-4 ${
                  tenantSourceTab === "payment"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Wallet className="h-4 w-4 shrink-0" />
                Payment accounts ({filteredTenantPayments.length})
              </button>
            </div>

            {tenantSourceTab === "gl" && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[min(60dvh,560px)] overflow-auto overscroll-x-contain">
                  <table className="w-full min-w-[820px] border-collapse text-left text-xs sm:text-sm">
                    <thead className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-100 font-semibold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2 py-2">Source</th>
                        <th className="px-2 py-2 font-mono">Code</th>
                        <th className="min-w-0 px-2 py-2">Name</th>
                        <th className="hidden px-2 py-2 lg:table-cell">Type</th>
                        <th className="hidden px-2 py-2 md:table-cell">Parent</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2 text-right">In editor</th>
                        <th className="min-w-[9.5rem] px-2 py-2 text-right">Merge (survivor)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTenantChart.map((r) => {
                        const isTenant = r._inventorySource === "tenant";
                        const isBp = r._inventorySource === "blueprint";
                        const code = (isTenant ? r.accountCode : r.code) || "";
                        const codeTrim = String(code).trim();
                        const dispName = isTenant ? r.accountName : r.name;
                        const dispType = isTenant ? r.accountType : r.type;
                        const parentDisp = isTenant ? r.parentAccount?.accountCode || "—" : r.parentCode || "—";
                        const inTemplate = codeTrim && systemCodeSet.has(codeTrim);
                        const rowKey = isTenant ? r.id : `${r._inventorySource}-${r.code}`;
                        const rowTint =
                          isBp ? "bg-sky-50/40" : r._inventorySource === "saved_definition" ? "bg-violet-50/35" : "";
                        const systemMerge = codeTrim ? mergeBySourceCode.get(codeTrim) : null;
                        return (
                          <tr key={rowKey} className={`border-b border-slate-100 hover:bg-slate-50/80 ${rowTint}`}>
                            <td className="max-w-[200px] px-2 py-2 align-top">
                              {isTenant ? (
                                <>
                                  <div className="truncate font-medium text-slate-800">Tenant database</div>
                                  <div
                                    className="truncate font-mono text-[11px] text-slate-500"
                                    title={r.tenantId || ""}
                                  >
                                    {formatTenantIdForScope(r.tenantId)}
                                  </div>
                                </>
                              ) : isBp ? (
                                <>
                                  <div className="font-medium text-sky-950">Default blueprint</div>
                                  <div className="text-[11px] text-sky-800">Hard-coded in app</div>
                                </>
                              ) : (
                                <>
                                  <div className="font-medium text-violet-950">Saved definition</div>
                                  <div className="text-[11px] text-violet-800">Database template</div>
                                </>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 font-mono text-xs font-semibold text-slate-900">
                              {codeTrim || "—"}
                            </td>
                            <td className="min-w-0 px-2 py-2 text-slate-800">
                              <div className="break-words">{dispName || "—"}</div>
                              {isTenant && r.mergedIntoAccount && (
                                <div className="mt-0.5 text-[11px] text-violet-700">
                                  Merged → {r.mergedIntoAccount.accountCode}{" "}
                                  {r.mergedIntoAccount.accountName ? `(${r.mergedIntoAccount.accountName})` : ""}
                                </div>
                              )}
                            </td>
                            <td className="hidden whitespace-nowrap px-2 py-2 text-slate-600 lg:table-cell">
                              {dispType || "—"}
                            </td>
                            <td className="hidden px-2 py-2 font-mono text-[11px] text-slate-600 md:table-cell">
                              {parentDisp}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">
                              {isTenant ? (
                                !r.isActive ? (
                                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                                    Inactive
                                  </span>
                                ) : r.mergedIntoAccountId ? (
                                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-800">
                                    Merged
                                  </span>
                                ) : (
                                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                                    Active
                                  </span>
                                )
                              ) : (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                                  Reference
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right">
                              {inTemplate ? (
                                <span className="text-[11px] font-medium text-emerald-700">Yes</span>
                              ) : codeTrim ? (
                                <button
                                  type="button"
                                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                                  onClick={() => {
                                    openAdd(codeTrim, dispName || "");
                                    setMessage("Prefilled Add account in the system template above — pick parent, Save, then Apply to all tenants.");
                                  }}
                                >
                                  Add to template
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="min-w-0 px-2 py-2 text-right align-top">
                              {!codeTrim ? (
                                <span className="text-slate-400">—</span>
                              ) : !inTemplate ? (
                                <span
                                  className="text-[11px] text-slate-500"
                                  title="Merge is configured on the system template. Add this code to the editor first."
                                >
                                  Add to editor first
                                </span>
                              ) : systemMerge ? (
                                <div className="flex flex-col items-end gap-1.5">
                                  <span className="text-left text-[10px] leading-tight text-violet-900 sm:text-right">
                                    <span className="font-mono font-semibold">{codeTrim}</span>
                                    <span className="mx-0.5">→</span>
                                    <span className="font-mono font-semibold">{systemMerge.targetCode}</span>
                                  </span>
                                  <div className="flex flex-wrap justify-end gap-1">
                                    <button
                                      type="button"
                                      className="touch-manipulation rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-50"
                                      onClick={() => onMerge({ code: codeTrim, name: dispName || codeTrim })}
                                    >
                                      Change target
                                    </button>
                                    <button
                                      type="button"
                                      className="touch-manipulation rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-900 hover:bg-rose-100"
                                      onClick={() => onMerge({ code: codeTrim }, true)}
                                    >
                                      Clear merge
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="touch-manipulation rounded-md bg-indigo-600 px-2.5 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                                  onClick={() => onMerge({ code: codeTrim, name: dispName || codeTrim })}
                                >
                                  Merge into…
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tenantSourceTab === "payment" && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[min(60dvh,560px)] overflow-auto overscroll-x-contain">
                  <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
                    <thead className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-100 font-semibold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2 py-2">Tenant ID</th>
                        <th className="min-w-0 px-2 py-2">Payment account</th>
                        <th className="hidden px-2 py-2 sm:table-cell">Method type</th>
                        <th className="hidden min-w-0 px-2 py-2 lg:table-cell">Reference</th>
                        <th className="min-w-0 px-2 py-2">Linked GL</th>
                        <th className="px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTenantPayments.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="max-w-[200px] px-2 py-2 align-top">
                            <div
                              className="truncate font-mono text-xs font-medium text-slate-800"
                              title={r.tenantId || ""}
                            >
                              {formatTenantIdForScope(r.tenantId)}
                            </div>
                          </td>
                          <td className="min-w-0 px-2 py-2 font-medium text-slate-900">
                            {r.name}
                            {r.isSystem ? (
                              <span className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                                System
                              </span>
                            ) : null}
                          </td>
                          <td className="hidden whitespace-nowrap px-2 py-2 text-slate-600 sm:table-cell">
                            {r.accountType || "—"}
                          </td>
                          <td className="hidden max-w-[180px] truncate px-2 py-2 text-slate-600 lg:table-cell" title={r.reference || ""}>
                            {r.reference || "—"}
                          </td>
                          <td className="min-w-0 px-2 py-2">
                            {r.coaAccount ? (
                              <span className="font-mono text-xs text-slate-800">
                                {r.coaAccount.accountCode}
                                <span className="mt-0.5 block font-sans text-[11px] font-normal text-slate-600 sm:inline sm:ml-1">
                                  {r.coaAccount.accountName}
                                </span>
                              </span>
                            ) : (
                              <span className="text-amber-700">Not linked</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {r.isActive ? (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                                Inactive
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <ModalPortal open={anyModal}>
        <>
        {mergeModalOpen && (
          <div
            className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setMergeRow(null);
                setMergeTarget("");
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="merge-modal-title"
              className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 id="merge-modal-title" className="text-lg font-semibold text-slate-900">
                  Merge account
                </h3>
                <button
                  type="button"
                  className="touch-manipulation rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close"
                  onClick={() => {
                    setMergeRow(null);
                    setMergeTarget("");
                  }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-slate-600">
                Source <span className="font-mono font-semibold">{mergeRow.code}</span> remains in the database with its code for every
                tenant; pickers use the target account instead. You can open this dialog from the main chart or from the{" "}
                <span className="font-medium">Merge (survivor)</span> column in the full GL catalog below. System-flagged accounts can be
                sources or targets. <strong>Save definition</strong> then <strong>Apply to all tenants</strong> to push merges live.
              </p>
              <div className="mt-4">
                <label htmlFor="merge-target-select" className="block text-sm font-medium text-slate-700">
                  Target account
                </label>
                <select
                  id="merge-target-select"
                  key={mergeRow.code}
                  className="mt-2 block min-h-[48px] w-full appearance-auto rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:min-h-[44px] sm:text-sm"
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  autoComplete="off"
                >
                  <option value="">Select target account…</option>
                  {(payload?.accounts || [])
                    .filter((a) => a.code !== mergeRow.code)
                    .map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="min-h-[48px] w-full touch-manipulation rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 sm:w-auto sm:min-h-[44px] sm:py-2"
                  onClick={() => {
                    setMergeRow(null);
                    setMergeTarget("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!mergeTarget}
                  className="min-h-[48px] w-full touch-manipulation rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-h-[44px] sm:py-2"
                  onClick={confirmMerge}
                >
                  Add merge
                </button>
              </div>
            </div>
          </div>
        )}

        {editModalOpen && (
          <div
            className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setEditRow(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-modal-title"
              className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 id="edit-modal-title" className="text-lg font-semibold text-slate-900">
                  Rename <span className="font-mono text-indigo-700">{editRow.code}</span>
                </h3>
                <button
                  type="button"
                  className="touch-manipulation rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                  onClick={() => setEditRow(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label htmlFor="edit-name-input" className="block text-sm font-medium text-slate-700">
                Account name
              </label>
              <input
                id="edit-name-input"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-2 block min-h-[48px] w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
              />
              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="min-h-[48px] w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50 sm:w-auto sm:py-2"
                  onClick={() => setEditRow(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="min-h-[48px] w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 sm:w-auto sm:py-2"
                  onClick={saveEdit}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {addOpen && (
          <div
            className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setAddOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-modal-title"
              className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 id="add-modal-title" className="text-lg font-semibold text-slate-900">
                  Add account
                </h3>
                <button
                  type="button"
                  className="touch-manipulation rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                  onClick={() => setAddOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="add-code" className="block text-sm font-medium text-slate-700">
                    Code
                  </label>
                  <input
                    id="add-code"
                    type="text"
                    inputMode="numeric"
                    value={addCode}
                    onChange={(e) => setAddCode(e.target.value)}
                    placeholder="e.g. 5991"
                    className="mt-1 block min-h-[48px] w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="add-name" className="block text-sm font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    id="add-name"
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="mt-1 block min-h-[48px] w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="add-parent" className="block text-sm font-medium text-slate-700">
                    Parent account
                  </label>
                  <select
                    id="add-parent"
                    className="mt-2 block min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:min-h-[44px] sm:text-sm"
                    value={addParentCode}
                    onChange={(e) => setAddParentCode(e.target.value)}
                    autoComplete="off"
                  >
                    {parentOptions.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="min-h-[48px] w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50 sm:w-auto sm:py-2"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="min-h-[48px] w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 sm:w-auto sm:py-2"
                  onClick={saveAdd}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      </ModalPortal>
    </div>
  );
}
