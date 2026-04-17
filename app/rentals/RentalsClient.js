"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import {
  Building2,
  CalendarRange,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Wrench,
} from "lucide-react";

function formatMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function localYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function addDaysLocal(d, n) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

/** Nights covered by half-open [checkInYmd, checkOutYmd) */
function eachNightYmd(checkInYmd, checkOutYmd) {
  const out = [];
  let cur = parseYmd(checkInYmd);
  const end = parseYmd(checkOutYmd);
  while (cur < end) {
    out.push(localYmd(cur));
    cur = addDaysLocal(cur, 1);
  }
  return out;
}

function startOfWeekMonday(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return x;
}

/**
 * Calendar days where the asset is not free for new day-based stays.
 * Rental: any overlap with an existing booking blocks the whole day (check-in and check-out).
 * Hiring: day blocked only when booked quantity meets or exceeds pool capacity.
 */
function buildBlockedYmdSet(events, assetId, kind, totalQuantity) {
  const blocked = new Set();
  if (!assetId) return blocked;
  const cap = kind === "hiring" ? Math.max(1, Number(totalQuantity) || 1) : 1;
  const evList = (events || []).filter((e) => e.rentalAssetId === assetId);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 14);
  const to = addDaysLocal(from, 420);
  for (let d = new Date(from); d < to; d = addDaysLocal(d, 1)) {
    const ymd = localYmd(d);
    const ds = new Date(d);
    const de = addDaysLocal(ds, 1);
    let sum = 0;
    for (const ev of evList) {
      const s = new Date(ev.startAt);
      const e = new Date(ev.endAt);
      if (s < de && e > ds) sum += Number(ev.quantity) || 1;
    }
    if (kind === "rental") {
      if (sum > 0) blocked.add(ymd);
    } else if (sum >= cap) {
      blocked.add(ymd);
    }
  }
  return blocked;
}

function rangeOverlapsEvents(startIso, endIso, events) {
  const ns = new Date(startIso).getTime();
  const ne = new Date(endIso).getTime();
  if (!(ne > ns)) return false;
  return events.some((ev) => {
    const s = new Date(ev.startAt).getTime();
    const e = new Date(ev.endAt).getTime();
    return ns < e && ne > s;
  });
}

export default function RentalsClient({ mode }) {
  const kind = mode === "hiring" ? "hiring" : "rental";
  const [stats, setStats] = useState(null);
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [clients, setClients] = useState([]);
  const [defaultRevenue, setDefaultRevenue] = useState(null);
  const [assetCalendar, setAssetCalendar] = useState([]);
  const [assetCalendarLoading, setAssetCalendarLoading] = useState(false);
  const [taxTypes, setTaxTypes] = useState([]);
  const [taxTypesLoading, setTaxTypesLoading] = useState(false);
  const [liabilityAccounts, setLiabilityAccounts] = useState([]);
  const [showCreateTax, setShowCreateTax] = useState(false);
  const [createTaxSaving, setCreateTaxSaving] = useState(false);
  const [createTaxForm, setCreateTaxForm] = useState({
    taxId: "",
    taxName: "",
    taxCode: "",
    taxRate: "",
    accountId: "",
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [showBook, setShowBook] = useState(false);
  const [showAsset, setShowAsset] = useState(false);
  const [saving, setSaving] = useState(false);

  const [bookForm, setBookForm] = useState({
    clientId: "",
    rentalAssetId: "",
    checkInDate: "",
    checkOutDate: "",
    startAt: "",
    endAt: "",
    quantity: 1,
    unitPrice: "",
    taxRate: 0,
    selectedTaxTypeId: "",
    notes: "",
  });
  const [datePickStep, setDatePickStep] = useState("checkIn");

  const [assetForm, setAssetForm] = useState({
    name: "",
    category: kind === "rental" ? "room" : "equipment",
    totalQuantity: 5,
    defaultRate: 0,
    rateUnit: "day",
  });

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const from = new Date();
      const to = new Date(from.getTime() + 42 * 86400000);
      const [st, as, tx, cal, cl, defRev] = await Promise.all([
        fetch("/api/rentals/stats").then((r) => r.json()),
        fetch(`/api/rental-assets?kind=${kind}`).then((r) => r.json()),
        fetch(`/api/rentals?kind=${kind}&limit=40`).then((r) => r.json()),
        fetch(
          `/api/rentals/calendar?from=${from.toISOString()}&to=${to.toISOString()}&kind=${kind}`
        ).then((r) => r.json()),
        fetch("/api/clients?limit=500").then((r) => r.json()),
        fetch("/api/rentals/default-revenue-account").then((r) => r.json()),
      ]);
      if (st.error) throw new Error(st.error);
      if (as.error) throw new Error(as.error);
      if (tx.error) throw new Error(tx.error);
      if (cal.error) throw new Error(cal.error);
      if (defRev.error) throw new Error(defRev.error);
      setStats(st);
      setAssets(as.assets || []);
      setTransactions(tx.transactions || []);
      setCalendar(cal.events || []);
      setClients(cl.clients || cl.data || []);
      setDefaultRevenue(defRev.account || null);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredAssets = useMemo(() => assets.filter((a) => a.kind === kind), [assets, kind]);

  const selectedAsset = useMemo(
    () => filteredAssets.find((a) => a.id === bookForm.rentalAssetId),
    [filteredAssets, bookForm.rentalAssetId]
  );

  const isHourlyAsset =
    selectedAsset && String(selectedAsset.rateUnit || "day").toLowerCase() === "hour";

  const blockedYmd = useMemo(
    () =>
      buildBlockedYmdSet(
        assetCalendar,
        bookForm.rentalAssetId,
        kind,
        selectedAsset?.totalQuantity
      ),
    [assetCalendar, bookForm.rentalAssetId, kind, selectedAsset?.totalQuantity]
  );

  const gridStart = useMemo(() => startOfWeekMonday(addDaysLocal(new Date(), -7)), []);

  useEffect(() => {
    if (!showBook || !bookForm.rentalAssetId) {
      setAssetCalendar([]);
      setAssetCalendarLoading(false);
      return;
    }
    const from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + 400);
    let cancelled = false;
    setAssetCalendarLoading(true);
    (async () => {
      try {
        const u = `/api/rentals/calendar?from=${encodeURIComponent(
          from.toISOString()
        )}&to=${encodeURIComponent(to.toISOString())}&kind=${kind}&rentalAssetId=${encodeURIComponent(
          bookForm.rentalAssetId
        )}`;
        const j = await fetch(u).then((r) => r.json());
        if (j.error) throw new Error(j.error);
        if (!cancelled) setAssetCalendar(j.events || []);
      } catch {
        if (!cancelled) setAssetCalendar([]);
      } finally {
        if (!cancelled) setAssetCalendarLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showBook, bookForm.rentalAssetId, kind]);

  useEffect(() => {
    if (!showBook) return;
    let cancelled = false;
    (async () => {
      setTaxTypesLoading(true);
      try {
        const [tt, acc] = await Promise.all([
          fetch("/api/tax-types?status=Active").then((r) => r.json()),
          fetch("/api/accounts?forSelect=true&type=Liability&limit=5000").then((r) => r.json()),
        ]);
        if (cancelled) return;
        const raw = tt.taxTypes || [];
        const usable = raw.filter(
          (t) =>
            t.status === "Active" &&
            String(t.taxId || "").toUpperCase() !== "PAYE" &&
            !/paye/i.test(String(t.taxName || ""))
        );
        setTaxTypes(usable);
        setLiabilityAccounts(acc.accounts || acc.data || []);
      } catch {
        if (!cancelled) {
          setTaxTypes([]);
          setLiabilityAccounts([]);
        }
      } finally {
        if (!cancelled) setTaxTypesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showBook]);

  const hourlyConflict = useMemo(() => {
    if (!isHourlyAsset || !bookForm.startAt || !bookForm.endAt) return null;
    if (new Date(bookForm.endAt) <= new Date(bookForm.startAt)) {
      return "End date and time must be after start.";
    }
    if (rangeOverlapsEvents(bookForm.startAt, bookForm.endAt, assetCalendar)) {
      return "This period overlaps an existing booking for this asset. Change start or end.";
    }
    return null;
  }, [isHourlyAsset, bookForm.startAt, bookForm.endAt, assetCalendar]);

  const submitBooking = async () => {
    setSaving(true);
    setErr(null);
    try {
      const unitPrice =
        bookForm.unitPrice === "" || bookForm.unitPrice == null
          ? undefined
          : Number(bookForm.unitPrice);

      let startAt;
      let endAt;
      if (isHourlyAsset) {
        startAt = bookForm.startAt;
        endAt = bookForm.endAt;
        if (!startAt || !endAt) throw new Error("Pick start and end date/time.");
        if (new Date(endAt) <= new Date(startAt)) throw new Error("End must be after start.");
        if (rangeOverlapsEvents(startAt, endAt, assetCalendar)) {
          throw new Error("That period overlaps an existing booking for this asset.");
        }
      } else if (assetCalendarLoading) {
        throw new Error("Still loading availability for this asset. Wait a moment and try again.");
      } else {
        if (!bookForm.checkInDate || !bookForm.checkOutDate) {
          throw new Error("Pick check-in and check-out on the calendar.");
        }
        const start = parseYmd(bookForm.checkInDate);
        const end = parseYmd(bookForm.checkOutDate);
        if (!(end > start)) throw new Error("Check-out must be after check-in.");
        const nights = eachNightYmd(bookForm.checkInDate, bookForm.checkOutDate);
        if (nights.some((n) => blockedYmd.has(n))) {
          throw new Error("Selected nights include unavailable dates (red on the calendar).");
        }
        startAt = start.toISOString();
        endAt = end.toISOString();
      }

      const res = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          clientId: bookForm.clientId,
          startAt,
          endAt,
          notes: bookForm.notes || undefined,
          items: [
            {
              rentalAssetId: bookForm.rentalAssetId,
              quantity: kind === "hiring" ? Number(bookForm.quantity) || 1 : 1,
              unitPrice,
              taxRate: Number(bookForm.taxRate) || 0,
              ...(bookForm.selectedTaxTypeId
                ? { selectedTaxTypeId: bookForm.selectedTaxTypeId }
                : {}),
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      setShowBook(false);
      setDatePickStep("checkIn");
      setBookForm({
        clientId: "",
        rentalAssetId: "",
        checkInDate: "",
        checkOutDate: "",
        startAt: "",
        endAt: "",
        quantity: 1,
        unitPrice: "",
        taxRate: 0,
        selectedTaxTypeId: "",
        notes: "",
      });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitAsset = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/rental-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetForm.name,
          category: assetForm.category,
          kind,
          totalQuantity: kind === "hiring" ? assetForm.totalQuantity : 1,
          defaultRate: Number(assetForm.defaultRate) || 0,
          rateUnit: assetForm.rateUnit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add asset");
      setShowAsset(false);
      setAssetForm({
        name: "",
        category: kind === "rental" ? "room" : "equipment",
        totalQuantity: 5,
        defaultRate: 0,
        rateUnit: "day",
      });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const completeTx = async (id) => {
    if (!confirm("Mark this booking completed and release capacity?")) return;
    setErr(null);
    try {
      const res = await fetch("/api/rentals/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const cancelDraft = async (id) => {
    if (!confirm("Cancel this draft booking? The draft invoice will be removed.")) return;
    setErr(null);
    try {
      const res = await fetch("/api/rentals/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const submitCreateTax = async () => {
    setCreateTaxSaving(true);
    setErr(null);
    try {
      const taxId = createTaxForm.taxId.trim();
      const taxName = createTaxForm.taxName.trim();
      const rate = parseFloat(createTaxForm.taxRate);
      if (!taxId || !taxName) throw new Error("Tax ID and name are required.");
      if (Number.isNaN(rate) || rate < 0 || rate > 100) throw new Error("Tax rate must be between 0 and 100.");
      const res = await fetch("/api/tax-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxId,
          taxName,
          taxCode: createTaxForm.taxCode.trim() || null,
          taxRate: rate,
          calculationType: "Percentage",
          accountId: createTaxForm.accountId || null,
          status: "Active",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create tax type");
      const refreshed = await fetch("/api/tax-types?status=Active").then((r) => r.json());
      const raw = refreshed.taxTypes || [];
      const usable = raw.filter(
        (t) =>
          t.status === "Active" &&
          String(t.taxId || "").toUpperCase() !== "PAYE" &&
          !/paye/i.test(String(t.taxName || ""))
      );
      setTaxTypes(usable);
      const created = data.id ? data : usable.find((t) => t.taxId === taxId);
      if (created?.id) {
        setBookForm((f) => ({
          ...f,
          selectedTaxTypeId: created.id,
          taxRate: Number(created.taxRate) || rate,
        }));
      }
      setShowCreateTax(false);
      setCreateTaxForm({ taxId: "", taxName: "", taxCode: "", taxRate: "", accountId: "" });
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreateTaxSaving(false);
    }
  };

  const title = kind === "rental" ? "Rentals" : "Hiring";
  const subtitle =
    kind === "rental"
      ? "Rooms, lodges, and time-based spaces — tied to invoices and availability."
      : "Equipment and quantity-based hires — capacity-aware booking with invoicing.";

  return (
    <PermissionGuard permissions={["rentals.view", "invoices.view", "invoices.create"]}>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                Rental &amp; Hiring
              </p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                {kind === "rental" ? (
                  <Building2 className="h-8 w-8 text-indigo-600" />
                ) : (
                  <Wrench className="h-8 w-8 text-amber-600" />
                )}
                {title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{subtitle}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/rentals"
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    kind === "rental"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200"
                  }`}
                >
                  Rentals
                </Link>
                <Link
                  href="/rentals/hiring"
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    kind === "hiring"
                      ? "bg-amber-600 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200"
                  }`}
                >
                  Hiring
                </Link>
                <Link
                  href="/invoice"
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Invoicing
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => load()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowAsset(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Package className="h-4 w-4" />
                Add asset
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePickStep("checkIn");
                  setBookForm((f) => ({
                    ...f,
                    checkInDate: "",
                    checkOutDate: "",
                    startAt: "",
                    endAt: "",
                    selectedTaxTypeId: "",
                    taxRate: 0,
                  }));
                  setShowBook(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                New booking
              </button>
            </div>
          </header>

          {err && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {err}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <section className="mb-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {kind === "rental" ? "Rental assets" : "Hiring pool items"}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {kind === "rental" ? stats?.totalRentalAssets ?? 0 : stats?.totalHiringAssets ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Active bookings
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{stats?.activeBookings ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {kind === "rental" ? "Assets available" : "Fleet status"}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">
                    {kind === "rental"
                      ? `${stats?.rentalUnitsAvailable ?? 0} of ${stats?.totalRentalAssets ?? 0} available`
                      : `${stats?.totalHiringAssets ?? 0} Assets in pool`}
                  </p>
                </div>
              </section>

              <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">Calendar</h2>
                  <span className="text-xs text-slate-500">(next 6 weeks)</span>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {calendar.length === 0 ? (
                    <p className="text-sm text-slate-500">No bookings in this window.</p>
                  ) : (
                    calendar.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-800">
                          {ev.rentalAsset?.name}{" "}
                          <span className="text-slate-500">
                            · {new Date(ev.startAt).toLocaleString()} → {new Date(ev.endAt).toLocaleString()}
                          </span>
                        </span>
                        <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          {ev.rentalTransaction?.client?.name || "Client"} · qty {ev.quantity}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">Assets</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Category</th>
                        <th className="py-2 pr-4">Status</th>
                        {kind === "hiring" && <th className="py-2 pr-4">Pool qty</th>}
                        <th className="py-2 pr-4">Default rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.map((a) => (
                        <tr key={a.id} className="border-b border-slate-100">
                          <td className="py-2 pr-4 font-medium text-slate-900">{a.name}</td>
                          <td className="py-2 pr-4 text-slate-600">{a.category}</td>
                          <td className="py-2 pr-4 capitalize">{a.status}</td>
                          {kind === "hiring" && (
                            <td className="py-2 pr-4 tabular-nums">{a.totalQuantity}</td>
                          )}
                          <td className="py-2 pr-4 tabular-nums">
                            {formatMoney(a.defaultRate)} / {a.rateUnit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredAssets.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">No assets yet — add one to get started.</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">Recent bookings</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                        <th className="py-2 pr-4">Invoice</th>
                        <th className="py-2 pr-4">Client</th>
                        <th className="py-2 pr-4">Period</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4 text-right">Total</th>
                        <th className="py-2 pr-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id} className="border-b border-slate-100">
                          <td className="py-2 pr-4 font-mono text-xs">
                            {t.invoice?.invoiceNumber}
                          </td>
                          <td className="py-2 pr-4">{t.client?.name}</td>
                          <td className="py-2 pr-4 text-xs text-slate-600">
                            {new Date(t.startAt).toLocaleDateString()} –{" "}
                            {new Date(t.endAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4 capitalize">{t.status}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {formatMoney(t.totalAmount)}
                          </td>
                          <td className="py-2 pr-4 text-right">
                            {["booked", "active", "overdue"].includes(t.status) && (
                              <button
                                type="button"
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                                onClick={() => completeTx(t.id)}
                              >
                                Complete
                              </button>
                            )}
                            {t.invoice?.status?.toLowerCase?.() === "draft" && (
                              <button
                                type="button"
                                className="ml-2 text-xs font-semibold text-rose-600 hover:underline"
                                onClick={() => cancelDraft(t.id)}
                              >
                                Cancel draft
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {transactions.length === 0 && (
                    <p className="mt-4 text-sm text-slate-500">No bookings yet.</p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {showBook && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900">New booking</h3>
              <p className="mt-1 text-xs text-slate-500">
                Creates a <strong>Pending</strong> invoice (posted to the ledger) so receivables reflect the
                balance. Revenue is always GL <strong>4000</strong>.
              </p>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-600">Client</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={bookForm.clientId}
                  onChange={(e) => setBookForm((f) => ({ ...f, clientId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="block text-xs font-semibold text-slate-600">Asset</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={bookForm.rentalAssetId}
                  onChange={(e) => {
                    const a = filteredAssets.find((x) => x.id === e.target.value);
                    setDatePickStep("checkIn");
                    setBookForm((f) => ({
                      ...f,
                      rentalAssetId: e.target.value,
                      unitPrice: a?.defaultRate != null ? String(a.defaultRate) : "",
                      checkInDate: "",
                      checkOutDate: "",
                      startAt: "",
                      endAt: "",
                    }));
                  }}
                >
                  <option value="">Select…</option>
                  {filteredAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {kind === "hiring" && (
                  <>
                    <label className="block text-xs font-semibold text-slate-600">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={bookForm.quantity}
                      onChange={(e) =>
                        setBookForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 1 }))
                      }
                    />
                  </>
                )}
                {isHourlyAsset ? (
                  <>
                    <p className="text-xs text-slate-500">
                      This asset bills by the hour. Start and end must not fall inside an existing booking
                      window for this item.
                    </p>
                    <label className="block text-xs font-semibold text-slate-600">Start</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={bookForm.startAt}
                      onChange={(e) => setBookForm((f) => ({ ...f, startAt: e.target.value }))}
                    />
                    <label className="block text-xs font-semibold text-slate-600">End</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={bookForm.endAt}
                      min={bookForm.startAt || undefined}
                      onChange={(e) => setBookForm((f) => ({ ...f, endAt: e.target.value }))}
                    />
                    {hourlyConflict && (
                      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                        {hourlyConflict}
                      </p>
                    )}
                    {bookForm.rentalAssetId && assetCalendar.length > 0 && (
                      <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <p className="font-semibold text-slate-700">Booked on this asset</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5">
                          {assetCalendar.map((ev) => (
                            <li key={ev.id}>
                              {new Date(ev.startAt).toLocaleString()} →{" "}
                              {new Date(ev.endAt).toLocaleString()}
                              {kind === "hiring" ? ` · qty ${ev.quantity ?? 1}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-slate-600">
                        Dates (red = unavailable)
                      </label>
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                        onClick={() => {
                          setBookForm((f) => ({ ...f, checkInDate: "", checkOutDate: "" }));
                          setDatePickStep("checkIn");
                        }}
                      >
                        Clear dates
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      {datePickStep === "checkIn"
                        ? "Tap check-in, then check-out (checkout day is the morning you leave; it is not charged as a full night if you use midnight-to-midnight nights)."
                        : "Now tap check-out."}
                    </p>
                    {!bookForm.rentalAssetId ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Select an asset to load availability.
                      </p>
                    ) : assetCalendarLoading ? (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Loading booked dates for this asset…
                      </p>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-slate-500">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
                            <div key={w}>{w}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: 84 }, (_, i) => {
                            const d = addDaysLocal(gridStart, i);
                            const ymd = localYmd(d);
                            const blocked = blockedYmd.has(ymd);
                            const inRange =
                              bookForm.checkInDate &&
                              ((bookForm.checkOutDate &&
                                parseYmd(ymd) >= parseYmd(bookForm.checkInDate) &&
                                parseYmd(ymd) < parseYmd(bookForm.checkOutDate)) ||
                                (!bookForm.checkOutDate && ymd === bookForm.checkInDate));
                            const todayYmd = localYmd(new Date());
                            return (
                              <button
                                key={ymd + i}
                                type="button"
                                disabled={blocked || !bookForm.rentalAssetId || assetCalendarLoading}
                                title={
                                  blocked
                                    ? "Not available (already booked in this range)"
                                    : assetCalendarLoading
                                      ? "Loading…"
                                      : ymd
                                }
                                onClick={() => {
                                  if (blocked || !bookForm.rentalAssetId || assetCalendarLoading) return;
                                  if (datePickStep === "checkIn" || !bookForm.checkInDate) {
                                    setBookForm((f) => ({ ...f, checkInDate: ymd, checkOutDate: "" }));
                                    setDatePickStep("checkOut");
                                    return;
                                  }
                                  const ci = bookForm.checkInDate;
                                  if (parseYmd(ymd) <= parseYmd(ci)) {
                                    setBookForm((f) => ({ ...f, checkInDate: ymd, checkOutDate: "" }));
                                    setDatePickStep("checkOut");
                                    return;
                                  }
                                  const nights = eachNightYmd(ci, ymd);
                                  if (nights.some((n) => blockedYmd.has(n))) {
                                    setErr(
                                      "That range includes booked dates (red). Pick a different check-out."
                                    );
                                    return;
                                  }
                                  setBookForm((f) => ({ ...f, checkOutDate: ymd }));
                                  setDatePickStep("checkIn");
                                }}
                                className={`flex aspect-square min-h-[2.25rem] flex-col items-center justify-center rounded-lg border text-xs font-semibold transition ${
                                  blocked
                                    ? "cursor-not-allowed border-red-300 bg-red-100 text-red-800 line-through"
                                    : inRange
                                      ? "border-indigo-400 bg-indigo-100 text-indigo-900"
                                      : "border-slate-200 bg-white text-slate-800 hover:border-indigo-300"
                                } ${ymd === todayYmd ? "ring-2 ring-amber-400 ring-offset-1" : ""}`}
                              >
                                <span>{d.getDate()}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Check-in:{" "}
                          <span className="font-mono font-semibold text-slate-800">
                            {bookForm.checkInDate || "—"}
                          </span>{" "}
                          · Check-out:{" "}
                          <span className="font-mono font-semibold text-slate-800">
                            {bookForm.checkOutDate || "—"}
                          </span>
                        </p>
                      </div>
                    )}
                  </>
                )}
                <label className="block text-xs font-semibold text-slate-600">Unit rate (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={bookForm.unitPrice}
                  onChange={(e) => setBookForm((f) => ({ ...f, unitPrice: e.target.value }))}
                  placeholder="Uses asset default if empty"
                />
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-600">Tax (from tax management)</label>
                  <Link
                    href="/tax-management"
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Open tax management
                  </Link>
                </div>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  disabled={taxTypesLoading}
                  value={bookForm.selectedTaxTypeId}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) {
                      setBookForm((f) => ({ ...f, selectedTaxTypeId: "", taxRate: 0 }));
                      return;
                    }
                    const t = taxTypes.find((x) => x.id === id);
                    setBookForm((f) => ({
                      ...f,
                      selectedTaxTypeId: id,
                      taxRate: t != null ? Number(t.taxRate) || 0 : f.taxRate,
                    }));
                  }}
                >
                  <option value="">{taxTypesLoading ? "Loading taxes…" : "No tax (0%)"}</option>
                  {taxTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {(t.taxCode || t.taxId) + " — " + t.taxName + " (" + Number(t.taxRate) + "%)"}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                    onClick={() => setShowCreateTax(true)}
                  >
                    Create custom tax…
                  </button>
                  <span className="text-xs text-slate-500">
                    Saved to tax management and selectable on future bookings.
                  </span>
                </div>
                {bookForm.selectedTaxTypeId ? (
                  <p className="text-xs text-slate-500">
                    Rate applied:{" "}
                    <span className="font-semibold text-slate-800">{Number(bookForm.taxRate) || 0}%</span>{" "}
                    (from selected tax type).
                  </p>
                ) : null}
                <label className="block text-xs font-semibold text-slate-600">Revenue account</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {defaultRevenue ? (
                    <>
                      <span className="font-mono font-semibold">{defaultRevenue.accountCode || "4000"}</span>
                      {" — "}
                      <span>{defaultRevenue.accountName || "Revenue"}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Fixed for rental and hiring invoices (cannot be changed here).
                      </span>
                    </>
                  ) : (
                    <span className="text-amber-800">Loading account 4000…</span>
                  )}
                </div>
                <label className="block text-xs font-semibold text-slate-600">Notes</label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  value={bookForm.notes}
                  onChange={(e) => setBookForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
                  onClick={() => setShowBook(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={
                    saving ||
                    !!hourlyConflict ||
                    (!isHourlyAsset && !!bookForm.rentalAssetId && assetCalendarLoading)
                  }
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={submitBooking}
                >
                  {saving ? "Saving…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showCreateTax && (
          <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900">Create tax type</h3>
              <p className="mt-1 text-xs text-slate-500">
                Stored in tax management (same as Settings → Taxes). Link a liability account so tax can be
                posted correctly from invoices.
              </p>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-600">Tax ID (unique code)</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={createTaxForm.taxId}
                  onChange={(e) => setCreateTaxForm((f) => ({ ...f, taxId: e.target.value }))}
                  placeholder="e.g. VAT_RENTAL"
                />
                <label className="block text-xs font-semibold text-slate-600">Display name</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={createTaxForm.taxName}
                  onChange={(e) => setCreateTaxForm((f) => ({ ...f, taxName: e.target.value }))}
                  placeholder="e.g. Rental VAT"
                />
                <label className="block text-xs font-semibold text-slate-600">Tax code (optional)</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={createTaxForm.taxCode}
                  onChange={(e) => setCreateTaxForm((f) => ({ ...f, taxCode: e.target.value }))}
                />
                <label className="block text-xs font-semibold text-slate-600">Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={createTaxForm.taxRate}
                  onChange={(e) => setCreateTaxForm((f) => ({ ...f, taxRate: e.target.value }))}
                />
                <label className="block text-xs font-semibold text-slate-600">Liability account (recommended)</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={createTaxForm.accountId}
                  onChange={(e) => setCreateTaxForm((f) => ({ ...f, accountId: e.target.value }))}
                >
                  <option value="">None (add later in tax management)</option>
                  {liabilityAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.accountCode || a.code) + " — " + (a.accountName || a.name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
                  onClick={() => setShowCreateTax(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createTaxSaving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={submitCreateTax}
                >
                  {createTaxSaving ? "Saving…" : "Save tax type"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAsset && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900">Add {kind} asset</h3>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-600">Name</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))}
                />
                <label className="block text-xs font-semibold text-slate-600">Category</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={assetForm.category}
                  onChange={(e) => setAssetForm((f) => ({ ...f, category: e.target.value }))}
                />
                {kind === "hiring" && (
                  <>
                    <label className="block text-xs font-semibold text-slate-600">Total units in pool</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={assetForm.totalQuantity}
                      onChange={(e) =>
                        setAssetForm((f) => ({
                          ...f,
                          totalQuantity: parseInt(e.target.value, 10) || 1,
                        }))
                      }
                    />
                  </>
                )}
                <label className="block text-xs font-semibold text-slate-600">Default rate</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={assetForm.defaultRate}
                  onChange={(e) => setAssetForm((f) => ({ ...f, defaultRate: e.target.value }))}
                />
                <label className="block text-xs font-semibold text-slate-600">Rate unit</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={assetForm.rateUnit}
                  onChange={(e) => setAssetForm((f) => ({ ...f, rateUnit: e.target.value }))}
                >
                  <option value="day">Per day</option>
                  <option value="hour">Per hour</option>
                </select>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
                  onClick={() => setShowAsset(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={submitAsset}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
