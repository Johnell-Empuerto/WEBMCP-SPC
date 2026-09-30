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
  Sliders,
  Folder,
} from "lucide-react";
import {
  addPreference,
  checkPreference,
  deletePreference,
  fetchPreferenceGroups,
  fetchPreferences,
  updatePreference,
} from "../api";
import type {
  AddPreferencePayload,
  PreferenceMasterFilter,
  PreferenceMasterRow,
  UpdatePreferencePayload,
} from "../types";

const PAGE_SIZE = 10;

interface FormState {
  parameterid: string;
  seq: string;
  desc: string;
  value: string;
}

const EMPTY_FORM: FormState = {
  parameterid: "",
  seq: "0",
  desc: "",
  value: "",
};

function toForm(r: PreferenceMasterRow): FormState {
  return {
    parameterid: r.parameterid,
    seq: String(r.seq),
    desc: r.desc,
    value: r.value,
  };
}

export default function PreferenceMasterPage() {
  usePageTitle("Preference Master");

  const [rows, setRows] = useState<PreferenceMasterRow[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", group: "" });

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editKey, setEditKey] = useState("");
  const [deleteKey, setDeleteKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (pageNo: number, f: typeof filters) => {
    setLoading(true);
    try {
      const filter: PreferenceMasterFilter = {
        size: PAGE_SIZE,
        pageno: pageNo,
        ...f,
      };
      const result = await fetchPreferences(filter);
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
    fetchPreferenceGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
    load(page, filters);
  }, [page, load]);

  const handleSearch = () => {
    setPage(1);
    load(1, filters);
  };

  const resetSearch = () => {
    setFilters({ search: "", group: "" });
    setPage(1);
    load(1, { search: "", group: "" });
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError("");
    setAddOpen(true);
  };

  const openEdit = (row: PreferenceMasterRow) => {
    setEditKey(`${row.parameterid} / seq ${row.seq}`);
    setForm(toForm(row));
    setError("");
    setEditOpen(true);
  };

  const openDelete = (row: PreferenceMasterRow) => {
    setDeleteKey(`${row.parameterid} / seq ${row.seq}`);
    setError("");
    setDeleteOpen(true);
  };

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async () => {
    const seq = Number(form.seq);
    if (!form.parameterid.trim()) {
      setError("Parameter Group is required");
      return;
    }
    if (!Number.isInteger(seq) || seq < 0) {
      setError("Sequence must be a valid number");
      return;
    }
    if (!form.desc.trim()) {
      setError("Description is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const exists = await checkPreference(form.parameterid.trim(), seq);
      if (exists.exists) {
        setError(
          `Preference "${form.parameterid.trim()}" (seq ${seq}) already exists`,
        );
        return;
      }
      const payload: AddPreferencePayload = {
        parameterid: form.parameterid.trim(),
        seq,
        desc: form.desc,
        value: form.value,
      };
      const res = await addPreference(payload);
      if (res.status === "blocked") {
        setError(
          res.message || `Preference "${form.parameterid}" already exists`,
        );
        return;
      }
      if (res.status === "error") {
        setError("Failed to add preference");
        return;
      }
      setAddOpen(false);
      setMessage(`Preference "${form.parameterid}" added`);
      setTimeout(() => setMessage(""), 3000);
      fetchPreferenceGroups()
        .then(setGroups)
        .catch(() => setGroups([]));
      load(page, filters);
    } catch {
      setError("Failed to add preference");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const seq = Number(form.seq);
    if (!form.desc.trim()) {
      setError("Description is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: UpdatePreferencePayload = {
        parameterid: form.parameterid.trim(),
        seq,
        desc: form.desc,
        value: form.value,
      };
      await updatePreference(payload);
      setEditOpen(false);
      setMessage(`Preference "${form.parameterid}" updated`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to update preference");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const [group, seqPart] = deleteKey.split("/ seq ");
    const seq = Number(seqPart);
    setSaving(true);
    setError("");
    try {
      const res = await deletePreference(group, seq);
      if (res.status === "blocked") {
        setError(res.message || "Failed to delete preference");
        return;
      }
      if (res.status === "error") {
        setError("Failed to delete preference");
        return;
      }
      setDeleteOpen(false);
      setMessage(`Preference "${group}" deleted`);
      setTimeout(() => setMessage(""), 3000);
      fetchPreferenceGroups()
        .then(setGroups)
        .catch(() => setGroups([]));
      load(page, filters);
    } catch {
      setError("Failed to delete preference");
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
                id="preference-master-grid"
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
            <rect
              width="100%"
              height="100%"
              fill="url(#preference-master-grid)"
            />
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
                alt="Preference Master"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              Preference Master
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Manage parameter records
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Sliders className="h-3 w-3" />
                {total} Preference{total !== 1 ? "s" : ""}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Sliders className="h-3 w-3" />
                {groups.length} Group{groups.length !== 1 ? "s" : ""}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Search className="h-3 w-3" />
                Key: Group + Seq
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
                  placeholder="Group / Description"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Folder}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.group}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, group: e.target.value }))
                  }
                >
                  <option value="">Group (All)</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
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
          <CardTitle>All Parameters</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total} preference{total !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add New Parameter
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
              <Sliders className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No preferences found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Nothing to display, please add your parameter now.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Group
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Seq
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Description
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Value
                    </th>
                    <th className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.parameterid}|${r.seq}`}
                      className="border-b border-border/20 transition-colors hover:bg-[#005B96]/[0.04]"
                    >
                      <td className="py-2.5 px-3 font-medium">
                        {r.parameterid}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {r.seq}
                      </td>
                      <td className="py-2.5 px-3">{r.desc}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {r.value}
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
              {editOpen
                ? `Update Preference (${editKey})`
                : "Add New Parameter"}
            </DialogTitle>
            <DialogDescription>
              {editOpen
                ? "Edit the parameter details below. Group and Sequence form the unique key."
                : "Fill in the parameter details below. Group and Sequence must be unique."}
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
                <Label htmlFor="parameterid">Parameter Group</Label>
                <Input
                  id="parameterid"
                  maxLength={20}
                  value={form.parameterid}
                  onChange={set("parameterid")}
                  disabled={editOpen}
                  placeholder={
                    editOpen ? editKey.split("/ seq ")[0] : "e.g. QUOTATION"
                  }
                  list="preference-group-options"
                />
                <datalist id="preference-group-options">
                  {groups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seq">Sequence</Label>
                <Input
                  id="seq"
                  type="number"
                  min={0}
                  value={form.seq}
                  onChange={set("seq")}
                  disabled={editOpen}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Input id="desc" value={form.desc} onChange={set("desc")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  maxLength={50}
                  value={form.value}
                  onChange={set("value")}
                  placeholder="Optional (max 50 characters)"
                />
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
            <DialogTitle>Delete Parameter</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete preference "{deleteKey}"? This
              cannot be undone.
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
