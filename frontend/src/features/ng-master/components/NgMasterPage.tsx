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
  AlertTriangle,
  Tag,
  CircleDot,
} from "lucide-react";
import { addNg, checkNgCode, deleteNg, fetchNgMaster, updateNg } from "../api";
import type {
  AddNgPayload,
  NgMasterFilter,
  NgMasterRow,
  UpdateNgPayload,
} from "../types";
import {
  isActiveStatus,
  ACTIVE_STATUS_BADGE,
  DEFAULT_STATUS_BADGE,
} from "@/lib/status";

const PAGE_SIZE = 10;

const CATEGORY_OPTIONS = [
  { value: "", label: "None" },
  { value: "1", label: "Casting (ADC)" },
  { value: "2", label: "Machining (C4)" },
  { value: "3", label: "Pallet (KD)" },
];

const STATUS_OPTIONS = [
  { value: "A", label: "Active" },
  { value: "I", label: "Inactive" },
];

interface FormState {
  code: string;
  shortName: string;
  desc: string;
  definition1: string;
  definition2: string;
  category: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  shortName: "",
  desc: "",
  definition1: "",
  definition2: "",
  category: "",
  status: "A",
};

function categoryLabel(type: string): string {
  return CATEGORY_OPTIONS.find((o) => o.value === type)?.label ?? "None";
}

function toForm(r: NgMasterRow): FormState {
  return {
    code: r.code,
    shortName: r.shortName,
    desc: r.desc,
    definition1: r.definition1,
    definition2: r.definition2,
    category: r.category || "",
    status: r.status || "A",
  };
}

export default function NgMasterPage() {
  usePageTitle("NG Master");

  const { user } = useAuth();
  const userlogin = user?.userCode ?? "";

  const [rows, setRows] = useState<NgMasterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "",
  });

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
      const filter: NgMasterFilter = { size: PAGE_SIZE, pageno: pageNo, ...f };
      const result = await fetchNgMaster(filter);
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
    setFilters({ search: "", category: "", status: "" });
    setPage(1);
    load(1, { search: "", category: "", status: "" });
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError("");
    setAddOpen(true);
  };

  const openEdit = (row: NgMasterRow) => {
    setEditId(row.code);
    setForm(toForm(row));
    setError("");
    setEditOpen(true);
  };

  const openDelete = (row: NgMasterRow) => {
    setDeleteId(row.code);
    setError("");
    setDeleteOpen(true);
  };

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const buildPayload = (): AddNgPayload => ({
    code: form.code.trim(),
    shortName: form.shortName,
    desc: form.desc,
    definition1: form.definition1,
    definition2: form.definition2,
    category: form.category,
    status: form.status,
    userlogin,
  });

  const validate = (): string => {
    if (!form.code.trim()) return "Defect Code is required";
    if (form.code.length > 3) return "Defect Code must be 3 characters or less";
    if (!form.shortName.trim()) return "Short Name is required";
    if (form.shortName.length > 5)
      return "Short Name must be 5 characters or less";
    if (!form.desc.trim()) return "Description is required";
    if (form.desc.length > 30)
      return "Description must be 30 characters or less";
    if (form.definition1.length > 50)
      return "Definition 1 must be 50 characters or less";
    if (form.definition2.length > 50)
      return "Definition 2 must be 50 characters or less";
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
      const exists = await checkNgCode(form.code.trim());
      if (exists.exists) {
        setError(`Defect "${form.code.trim()}" already exists`);
        return;
      }
      const res = await addNg(buildPayload());
      if (res.status === "blocked") {
        setError(res.message || `Defect "${form.code}" already exists`);
        return;
      }
      if (res.status === "error") {
        setError("Failed to add defect");
        return;
      }
      setAddOpen(false);
      setMessage(`Defect "${form.code}" added`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to add defect");
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
      const payload: UpdateNgPayload = buildPayload();
      await updateNg(payload);
      setEditOpen(false);
      setMessage(`Defect "${editId}" updated`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to update defect");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await deleteNg(deleteId);
      if (res.status === "blocked") {
        setError(
          res.message ||
            `Defect "${deleteId}" cannot be deleted because it is referenced by other records.`,
        );
        return;
      }
      if (res.status === "error") {
        setError("Failed to delete defect");
        return;
      }
      setDeleteOpen(false);
      setMessage(`Defect "${deleteId}" deleted`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to delete defect");
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
                id="ng-master-grid"
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
            <rect width="100%" height="100%" fill="url(#ng-master-grid)" />
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
                alt="NG Master"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              NG Master
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Manage defect / NG records
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <AlertTriangle className="h-3 w-3" />
                {total} Defect{total !== 1 ? "s" : ""}
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
                  placeholder="Code / Short Name / Description"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[140px]">
              <FilterField icon={Tag}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.category}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  <option value="">Category (All)</option>
                  {CATEGORY_OPTIONS.filter((o) => o.value !== "").map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="flex-1 min-w-[130px]">
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
          <CardTitle>All Defects</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total} defect{total !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add New Defect
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
              <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No defects found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Nothing to display, please add your defect now.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Code
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Short Name
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Description
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Category
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
                      <td className="py-2.5 px-3 font-mono text-xs">
                        {r.shortName}
                      </td>
                      <td className="py-2.5 px-3 max-w-[280px] truncate">
                        {r.desc}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.category === "1"
                              ? "bg-sky-100 text-sky-700"
                              : r.category === "2"
                                ? "bg-amber-100 text-amber-700"
                                : r.category === "3"
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {categoryLabel(r.category)}
                        </span>
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
              {editOpen ? `Update Defect (${editId})` : "Add New Defect"}
            </DialogTitle>
            <DialogDescription>
              {editOpen
                ? "Edit the defect details below. The Defect Code is the immutable key."
                : "Fill in the defect details below. The Defect Code is required and must be unique."}
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
                <Label htmlFor="code">Defect Code</Label>
                <Input
                  id="code"
                  maxLength={3}
                  value={form.code}
                  onChange={set("code")}
                  disabled={editOpen}
                  placeholder={editOpen ? editId : "e.g. 001"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shortName">Short Name</Label>
                <Input
                  id="shortName"
                  maxLength={5}
                  value={form.shortName}
                  onChange={set("shortName")}
                  placeholder="e.g. ADBH"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  maxLength={30}
                  value={form.desc}
                  onChange={set("desc")}
                  placeholder="e.g. Blow Hole"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="definition1">Definition 1</Label>
                <Input
                  id="definition1"
                  maxLength={50}
                  value={form.definition1}
                  onChange={set("definition1")}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="definition2">Definition 2</Label>
                <Input
                  id="definition2"
                  maxLength={50}
                  value={form.definition2}
                  onChange={set("definition2")}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <FilterField icon={Tag}>
                  <select
                    id="category"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.category}
                    onChange={set("category")}
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </FilterField>
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
            <DialogTitle>Delete Defect</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete defect "{deleteId}"? This cannot
              be undone.
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
