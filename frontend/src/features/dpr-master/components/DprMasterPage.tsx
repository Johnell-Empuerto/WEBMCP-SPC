import { useCallback, useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
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
  UsersRound,
  RotateCcw,
  AlertCircle,
  UserX,
  CircleDot,
} from "lucide-react";
import {
  addDprMaster,
  deleteDprMaster,
  fetchDprMasters,
  updateDprMaster,
} from "../api";
import { DPR_MASTER_TABS } from "../types";
import type {
  AddDprMasterPayload,
  DprMasterFilter,
  DprMasterRow,
  DprMasterStatus,
  DprMasterTab,
  UpdateDprMasterPayload,
} from "../types";
import {
  isActiveStatus,
  ACTIVE_STATUS_BADGE,
  DEFAULT_STATUS_BADGE,
} from "@/lib/status";

const PAGE_SIZE = 10;

// Status filter options — "" (default) preserves the legacy hide-inactive
// behavior (md_status <> 'I'); "A" / "I" / "all" are explicit.
const STATUS_OPTIONS = [
  { value: "", label: "Active (default)" },
  { value: "A", label: "Active" },
  { value: "I", label: "Inactive" },
  { value: "all", label: "All" },
] as const;

interface FormState {
  md_Usercode: string;
  md_firstname: string;
  md_lastname: string;
  md_position: string;
  md_status: DprMasterStatus;
}

const EMPTY_FORM: FormState = {
  md_Usercode: "",
  md_firstname: "",
  md_lastname: "",
  md_position: "",
  md_status: "A",
};

function toForm(r: DprMasterRow): FormState {
  return {
    md_Usercode: String(r.md_Usercode),
    md_firstname: r.md_firstname ?? "",
    md_lastname: r.md_lastname ?? "",
    md_position: r.md_position ?? "",
    md_status: (r.md_status === "I" ? "I" : "A") as DprMasterStatus,
  };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isActiveStatus(status) ? ACTIVE_STATUS_BADGE : DEFAULT_STATUS_BADGE
      }`}
    >
      {isActiveStatus(status) ? "Active" : "Inactive"}
    </span>
  );
}

export default function DprMasterPage() {
  usePageTitle("DPR Master");

  const [activeTab, setActiveTab] = useState<DprMasterTab>("team-leader");

  // Draft (user-editable) vs applied (actually queried) filter state —
  // changing a control never fetches; only Search applies.
  const [draftSearch, setDraftSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState<string>("");
  const [applied, setApplied] = useState<{ search: string; status: string }>({
    search: "",
    status: "",
  });

  const [rows, setRows] = useState<DprMasterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUsercode, setEditUsercode] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteUsercode, setDeleteUsercode] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const activeLabel =
    DPR_MASTER_TABS.find((t) => t.value === activeTab)?.label ?? activeTab;

  const load = useCallback(
    async (
      tab: DprMasterTab,
      pageNo: number,
      f: { search: string; status: string },
    ) => {
      setLoading(true);
      setLoadError("");
      try {
        const filter: DprMasterFilter = {
          size: PAGE_SIZE,
          pageno: pageNo,
          search: f.search || undefined,
          status: f.status || undefined,
        };
        const result = await fetchDprMasters(tab, filter);
        setRows(result.rows);
        setTotal(result.totalItems);
      } catch (err) {
        setRows([]);
        setTotal(0);
        setLoadError(
          err instanceof Error
            ? err.message
            : "Failed to load DPR master records",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Single fetch source: reload whenever the tab, page, or applied filters change.
  useEffect(() => {
    load(activeTab, page, applied);
  }, [activeTab, page, applied, load]);

  const handleTabChange = (tab: DprMasterTab) => {
    setActiveTab(tab);
    setDraftSearch("");
    setDraftStatus("");
    setPage(1);
    setApplied({ search: "", status: "" });
  };

  const handleSearch = () => {
    setPage(1);
    setApplied({ search: draftSearch.trim(), status: draftStatus });
  };

  const handleReset = () => {
    setDraftSearch("");
    setDraftStatus("");
    setPage(1);
    setApplied({ search: "", status: "" });
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditId(null);
    setEditUsercode(null);
    setAddOpen(true);
  };

  const openEdit = (row: DprMasterRow) => {
    setEditUsercode(row.md_Usercode);
    setEditId(row.id);
    setForm(toForm(row));
    setFormError("");
    setEditOpen(true);
  };

  const openDelete = (row: DprMasterRow) => {
    setDeleteId(row.id);
    setDeleteUsercode(row.md_Usercode);
    setFormError("");
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await deleteDprMaster(activeTab, deleteId);
      if (res.status === "blocked") {
        setFormError(
          res.message ||
            `User code ${deleteUsercode} cannot be deleted because it is referenced by existing DPR records.`,
        );
        return;
      }
      if (res.status === "error") {
        setFormError(res.message || "Failed to delete record");
        return;
      }
      setDeleteOpen(false);
      setMessage(
        `User code ${deleteUsercode} (${activeLabel}) deleted successfully.`,
      );
      setTimeout(() => setMessage(""), 4000);
      load(activeTab, page, applied);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to delete record",
      );
    } finally {
      setSaving(false);
    }
  };

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const validateForm = (): string => {
    if (editId === null) {
      const code = Number(form.md_Usercode);
      if (
        form.md_Usercode.trim() === "" ||
        !Number.isInteger(code) ||
        code < 0
      ) {
        return "User Code is required and must be a non-negative number";
      }
    }
    if (!form.md_firstname.trim()) return "First Name is required";
    if (!form.md_lastname.trim()) return "Last Name is required";
    if (!form.md_position.trim()) return "Position is required";
    return "";
  };

  const handleSave = async () => {
    const invalid = validateForm();
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const base = {
        tab: activeTab,
        md_Usercode: Number(form.md_Usercode),
        md_firstname: form.md_firstname.trim(),
        md_lastname: form.md_lastname.trim(),
        md_position: form.md_position.trim(),
        md_status: form.md_status,
      };
      if (editOpen && editId !== null && editUsercode !== null) {
        const payload: UpdateDprMasterPayload = {
          ...base,
          id: editId,
          md_Usercode: editUsercode,
        };
        await updateDprMaster(payload);
        setEditOpen(false);
        setMessage(
          `User code ${editUsercode} (${activeLabel}) updated successfully.`,
        );
      } else {
        const payload: AddDprMasterPayload = base;
        await addDprMaster(payload);
        setAddOpen(false);
        setMessage(
          `User code ${base.md_Usercode} (${activeLabel}) saved successfully.`,
        );
      }
      setTimeout(() => setMessage(""), 4000);
      load(activeTab, page, applied);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save record",
      );
    } finally {
      setSaving(false);
    }
  };

  // After a successful save/update, reload the current view with the applied
  // filters so the new/updated row is reflected (handled in handleSave via
  // load with the CURRENT applied state).

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-in">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="dpr-master-grid"
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
              <pattern
                id="dpr-master-dots"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dpr-master-grid)" />
            <rect width="100%" height="100%" fill="url(#dpr-master-dots)" />
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
                alt="DPR Master"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              DPR Master
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Daily Production Report Personnel Master Data
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <UsersRound className="h-3 w-3" />
                {activeLabel}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Search className="h-3 w-3" />
                {total} record{total !== 1 ? "s" : ""}
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

      {/* ── Tabs ───────────────────────────────────────── */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div className="flex flex-wrap gap-1.5">
            {DPR_MASTER_TABS.map((t) => {
              const isActive = t.value === activeTab;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTabChange(t.value)}
                  className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-all duration-150 ${
                    isActive
                      ? "bg-[#005B96] text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Filters ────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <FilterField icon={Search}>
                <Input
                  placeholder="Search user code, name, or position..."
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <FilterField icon={CircleDot} className="w-44">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <Button variant="default" size="sm" onClick={handleSearch}>
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Records table ──────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
              <UsersRound className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-foreground">
                {activeLabel} Master
              </span>
              <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
                Manage {activeLabel.toLowerCase()} records
              </span>
            </div>
          </CardTitle>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Record
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive/60 mb-3" />
              <p className="text-sm font-medium text-destructive">
                Unable to load records
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-md">
                {loadError}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => load(activeTab, page, applied)}
              >
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserX className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No records found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                No {activeLabel.toLowerCase()} records match the current
                filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      User Code
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      First Name
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Last Name
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Position
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
                      key={r.id}
                      className="border-b border-border/20 transition-colors hover:bg-[#005B96]/[0.04]"
                    >
                      <td className="py-2.5 px-3 font-medium">
                        {r.md_Usercode}
                      </td>
                      <td className="py-2.5 px-3">{r.md_firstname}</td>
                      <td className="py-2.5 px-3">{r.md_lastname}</td>
                      <td className="py-2.5 px-3">{r.md_position}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={r.md_status} />
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

      {/* ── Delete confirm ────────────────────────────── */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user code {deleteUsercode} from
              the {activeLabel} master? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {formError}
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

      {/* ── Add / Edit dialog ──────────────────────────── */}
      <Dialog
        open={addOpen || editOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setEditOpen(false);
          }
        }}
      >
        <DialogContent
          hideDefaultClose
          className="max-w-lg w-full max-h-[78vh] overflow-hidden flex flex-col p-0 gap-0"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <DialogTitle>
              {editOpen
                ? `Update ${activeLabel} (${editUsercode})`
                : `Add ${activeLabel} Record`}
            </DialogTitle>
            <DialogDescription>
              {editOpen
                ? "Edit the personnel details below. The user code is the record key and cannot be changed."
                : "Fill in the personnel details below. The user code must be unique for this role."}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="mx-6 mt-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 dpr-master-scroll">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="md_Usercode">User Code</Label>
                <Input
                  id="md_Usercode"
                  type="number"
                  min={0}
                  disabled={editOpen}
                  placeholder="e.g. 11009"
                  value={form.md_Usercode}
                  onChange={set("md_Usercode")}
                />
                <p className="text-[11px] text-muted-foreground/70">
                  {editOpen
                    ? "Locked — this is the record key"
                    : "Non-negative number, unique per role"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="md_status">Status</Label>
                <FilterField icon={CircleDot}>
                  <select
                    id="md_status"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.md_status}
                    onChange={set("md_status")}
                  >
                    <option value="A">Active</option>
                    <option value="I">Inactive</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="md_firstname">First Name</Label>
                <Input
                  id="md_firstname"
                  maxLength={100}
                  placeholder="e.g. Renz"
                  value={form.md_firstname}
                  onChange={set("md_firstname")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="md_lastname">Last Name</Label>
                <Input
                  id="md_lastname"
                  maxLength={100}
                  placeholder="e.g. Dalisay"
                  value={form.md_lastname}
                  onChange={set("md_lastname")}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="md_position">Position</Label>
                <Input
                  id="md_position"
                  maxLength={100}
                  placeholder="e.g. Staff Engineer"
                  value={form.md_position}
                  onChange={set("md_position")}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/60 bg-background">
            <Button
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                setEditOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editOpen ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .dpr-master-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .dpr-master-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 4px 0;
        }
        .dpr-master-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 999px;
        }
        .dpr-master-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.6);
        }
      `}</style>
    </div>
  );
}
