import { useCallback, useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { FilterField } from "@/components/ui/FilterField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Clock,
  CircleDot,
} from "lucide-react";
import {
  addShift,
  checkShiftCode,
  deleteShift,
  fetchShiftsMaster,
  updateShift,
} from "../api";
import type {
  AddShiftPayload,
  ShiftMasterFilter,
  ShiftMasterRow,
  UpdateShiftPayload,
} from "../types";
import {
  isActiveStatus,
  ACTIVE_STATUS_BADGE,
  DEFAULT_STATUS_BADGE,
} from "@/lib/status";

const PAGE_SIZE = 10;

const SCHEDULE_OPTIONS = [
  { value: "D", label: "Day" },
  { value: "S", label: "Swing" },
  { value: "G", label: "Graveyard" },
];

const STATUS_OPTIONS = [
  { value: "A", label: "Active" },
  { value: "I", label: "Inactive" },
];

interface FormState {
  code: string;
  desc: string;
  scheduleType: string;
  timein: string;
  breakStart: string;
  breakEnd: string;
  timeout: string;
  totalHours: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  desc: "",
  scheduleType: "D",
  timein: "",
  breakStart: "",
  breakEnd: "",
  timeout: "",
  totalHours: "8",
  status: "A",
};

// "0600" → "06:00"  (empty passthrough)
function hhmmToTime(v: string): string {
  return /^\d{4}$/.test(v) ? `${v.slice(0, 2)}:${v.slice(2)}` : "";
}

// "06:00" → "0600"  (empty → empty)
function timeToHhmm(v: string): string {
  return v.replace(":", "");
}

function scheduleLabel(type: string): string {
  return SCHEDULE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function toForm(r: ShiftMasterRow): FormState {
  return {
    code: r.code,
    desc: r.desc,
    scheduleType: r.scheduleType || "D",
    timein: hhmmToTime(r.timein),
    breakStart: hhmmToTime(r.breakStart),
    breakEnd: hhmmToTime(r.breakEnd),
    timeout: hhmmToTime(r.timeout),
    totalHours: String(r.totalHours ?? 0),
    status: r.status || "A",
  };
}

function isValidTime(v: string): boolean {
  if (v === "") return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export default function ShiftMasterPage() {
  usePageTitle("Shift Master");

  const { user } = useAuth();
  const userlogin = user?.userCode ?? "";

  const [rows, setRows] = useState<ShiftMasterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", status: "" });

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (pageNo: number, f: typeof filters) => {
    setLoading(true);
    try {
      const filter: ShiftMasterFilter = {
        size: PAGE_SIZE,
        pageno: pageNo,
        ...f,
      };
      const result = await fetchShiftsMaster(filter);
      setRows(result.rows);
      setTotal(result.totalItems);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, filters);
  }, [page, load]);

  const handleSearch = () => {
    setPage(1);
    load(1, filters);
  };

  const resetSearch = () => {
    setFilters({ search: "", status: "" });
    setPage(1);
    load(1, { search: "", status: "" });
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError("");
    setAddOpen(true);
  };

  const openEdit = (row: ShiftMasterRow) => {
    setEditId(row.code);
    setForm(toForm(row));
    setError("");
    setEditOpen(true);
  };

  const openDelete = (row: ShiftMasterRow) => {
    setDeleteId(row.code);
    setError("");
    setDeleteOpen(true);
  };

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const buildPayload = (): AddShiftPayload => ({
    code: form.code.trim(),
    desc: form.desc,
    scheduleType: form.scheduleType,
    timein: timeToHhmm(form.timein),
    breakStart: timeToHhmm(form.breakStart),
    breakEnd: timeToHhmm(form.breakEnd),
    timeout: timeToHhmm(form.timeout),
    totalHours: Number(form.totalHours),
    status: form.status,
    userlogin,
  });

  const validate = (): string => {
    if (!form.code.trim()) return "Shift Code is required";
    if (!form.desc.trim()) return "Shift Description is required";
    if (!isValidTime(form.timein)) return "Time In is required";
    if (!isValidTime(form.timeout)) return "Time Out is required";
    if (!isValidTime(form.breakStart) || !isValidTime(form.breakEnd))
      return "Break times must be valid";
    const hours = Number(form.totalHours);
    if (!Number.isFinite(hours) || hours < 0)
      return "Total Hours must be a valid number";
    return "";
  };

  const handleAdd = async () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const exists = await checkShiftCode(form.code.trim());
      if (exists.exists) {
        setError(`Shift "${form.code.trim()}" already exists`);
        return;
      }
      const res = await addShift(buildPayload());
      if (res.status === "blocked") {
        setError(res.message || `Shift "${form.code}" already exists`);
        return;
      }
      if (res.status === "error") {
        setError("Failed to add shift");
        return;
      }
      setAddOpen(false);
      setMessage(`Shift "${form.code}" added`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to add shift");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: UpdateShiftPayload = buildPayload();
      await updateShift(payload);
      setEditOpen(false);
      setMessage(`Shift "${editId}" updated`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to update shift");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await deleteShift(deleteId);
      if (res.status === "blocked") {
        setError(
          res.message ||
            `Shift "${deleteId}" cannot be deleted because it is referenced by other records.`,
        );
        return;
      }
      if (res.status === "error") {
        setError("Failed to delete shift");
        return;
      }
      setDeleteOpen(false);
      setMessage(`Shift "${deleteId}" deleted`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to delete shift");
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dialogOpen = addOpen || editOpen;
  const closeDialog = () => {
    setAddOpen(false);
    setEditOpen(false);
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="shift-master-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#shift-master-grid)" />
            <line
              x1="0"
              y1="0"
              x2="100%"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
            <line
              x1="100%"
              y1="0"
              x2="0"
              y2="100%"
              stroke="white"
              strokeWidth="0.3"
            />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="flex-shrink-0">
            <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 shadow-inner">
              <img
                src="/plan.png"
                alt="Shift Master"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              Shift Master
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Manage shift schedules
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Clock className="h-3 w-3" />
                {total} Shift{total !== 1 ? "s" : ""}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Search className="h-3 w-3" />
                Status: Active / Inactive
              </div>
              {message && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white border border-white/10">
                  {message}
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-sm border border-white/20">
              <img
                src="/logo_npax.png"
                alt="ISUZU"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {/* Filter card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Search}>
                <Input
                  placeholder="Shift Code / Description"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={CircleDot}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  <option value="">Status (All)</option>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <Button variant="default" size="sm" onClick={handleSearch}>
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" size="sm" onClick={resetSearch}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Shifts</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total} shift{total !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add New Shift
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No shifts found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Nothing to display, please add your shift now.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Shift Code
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Description
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Schedule Type
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Shift Hours
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Total Hours
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.code}
                      className="border-b border-border/20 transition-colors hover:bg-[#005B96]/[0.04]"
                    >
                      <td className="py-2.5 px-3 font-medium">{r.code}</td>
                      <td className="py-2.5 px-3 text-muted-foreground max-w-[260px] truncate">
                        {r.desc}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.scheduleType === "D"
                              ? "bg-sky-100 text-sky-700"
                              : r.scheduleType === "S"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-indigo-100 text-indigo-700"
                          }`}
                        >
                          {scheduleLabel(r.scheduleType)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-xs text-muted-foreground">
                        {hhmmToTime(r.timein) || "—"} –{" "}
                        {hhmmToTime(r.timeout) || "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {r.totalHours}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            isActiveStatus(r.status)
                              ? ACTIVE_STATUS_BADGE
                              : DEFAULT_STATUS_BADGE
                          }`}
                        >
                          {isActiveStatus(r.status) ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDelete(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) closeDialog();
        }}
      >
        <DialogContent
          hideDefaultClose
          className="max-w-lg w-full max-h-[78vh] overflow-hidden flex flex-col p-0 gap-0"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <DialogTitle>
              {editOpen ? `Update Shift (${editId})` : "Add New Shift"}
            </DialogTitle>
            <DialogDescription>
              {editOpen
                ? "Edit the shift details below. The Shift Code is the immutable key."
                : "Fill in the shift details below. The Shift Code is required and must be unique."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mx-6 mt-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 product-master-scroll">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Shift Code</Label>
                <Input
                  id="code"
                  maxLength={50}
                  value={form.code}
                  onChange={set("code")}
                  disabled={editOpen}
                  placeholder={editOpen ? editId : "e.g. Shift04"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scheduleType">Schedule Type</Label>
                <FilterField icon={Clock}>
                  <select
                    id="scheduleType"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.scheduleType}
                    onChange={set("scheduleType")}
                  >
                    {SCHEDULE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  maxLength={200}
                  value={form.desc}
                  onChange={set("desc")}
                  placeholder="e.g. 1st Shift (06:00 AM ~ 02:00 PM)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timein">Time In</Label>
                <Input
                  id="timein"
                  type="time"
                  value={form.timein}
                  onChange={set("timein")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timeout">Time Out</Label>
                <Input
                  id="timeout"
                  type="time"
                  value={form.timeout}
                  onChange={set("timeout")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="breakStart">Break Start</Label>
                <Input
                  id="breakStart"
                  type="time"
                  value={form.breakStart}
                  onChange={set("breakStart")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="breakEnd">Break End</Label>
                <Input
                  id="breakEnd"
                  type="time"
                  value={form.breakEnd}
                  onChange={set("breakEnd")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalHours">Total Hours</Label>
                <Input
                  id="totalHours"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.totalHours}
                  onChange={set("totalHours")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <FilterField icon={CircleDot}>
                  <select
                    id="status"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.status}
                    onChange={set("status")}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/60 bg-background">
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={editOpen ? handleUpdate : handleAdd}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editOpen ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Shift</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete shift "{deleteId}"? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .product-master-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .product-master-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 4px 0;
        }
        .product-master-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 999px;
        }
        .product-master-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.6);
        }
      `}</style>
    </div>
  );
}
