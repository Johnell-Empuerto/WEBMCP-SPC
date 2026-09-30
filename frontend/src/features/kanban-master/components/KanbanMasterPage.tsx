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
  ClipboardList,
  Box,
  MapPin,
  Hash,
  Gauge,
  StickyNote,
} from "lucide-react";
import {
  addKanban,
  deleteKanban,
  fetchKanbanLookups,
  fetchKanbanMasters,
  updateKanban,
} from "../api";
import type {
  AddKanbanPayload,
  KanbanMasterFilter,
  KanbanMasterLookups,
  KanbanMasterRow,
  UpdateKanbanPayload,
} from "../types";

const PAGE_SIZE = 10;

interface FormState {
  partno: string;
  desc: string;
  capacity: string;
  loc: string;
  rem: string;
}

const EMPTY_FORM: FormState = {
  partno: "",
  desc: "",
  capacity: "",
  loc: "",
  rem: "",
};

function toForm(r: KanbanMasterRow): FormState {
  return {
    partno: r.Kbm_PartNo ?? "",
    desc: r.Kbm_Description ?? "",
    capacity:
      r.Kbm_Qty === null || r.Kbm_Qty === undefined ? "" : String(r.Kbm_Qty),
    loc: r.Kbm_DefaultLocator ?? "",
    rem: r.Kbm_Remarks ?? "",
  };
}

export default function KanbanMasterPage() {
  usePageTitle("Kanban Master");

  const { user } = useAuth();
  const userlogin = user?.userCode ?? "";

  const [rows, setRows] = useState<KanbanMasterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    kanban: "",
    partno: "",
    capacity: "",
    rem: "",
  });

  const [lookups, setLookups] = useState<KanbanMasterLookups>({
    partNos: [],
    locators: [],
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
      const filter: KanbanMasterFilter = {
        size: PAGE_SIZE,
        pageno: pageNo,
        ...f,
      };
      const result = await fetchKanbanMasters(filter);
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

  useEffect(() => {
    fetchKanbanLookups()
      .then(setLookups)
      .catch(() => setLookups({ partNos: [], locators: [] }));
  }, []);

  const handleSearch = () => {
    setPage(1);
    load(1, filters);
  };

  const resetSearch = () => {
    setFilters({ kanban: "", partno: "", capacity: "", rem: "" });
    setPage(1);
    load(1, { kanban: "", partno: "", capacity: "", rem: "" });
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError("");
    setAddOpen(true);
  };

  const openEdit = (row: KanbanMasterRow) => {
    setEditId(row.Kbm_KanbanID);
    setForm(toForm(row));
    setError("");
    setEditOpen(true);
  };

  const openDelete = (row: KanbanMasterRow) => {
    setDeleteId(row.Kbm_KanbanID);
    setError("");
    setDeleteOpen(true);
  };

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: AddKanbanPayload = { ...form, userlogin };
      const res = await addKanban(payload);
      if (res.status === "error") {
        setError("Failed to add kanban");
        return;
      }
      setAddOpen(false);
      setMessage(`Kanban added for part "${form.partno}"`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to add kanban");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: UpdateKanbanPayload = {
        ...form,
        kanbanid: editId,
        userlogin,
      };
      await updateKanban(payload);
      setEditOpen(false);
      setMessage(`Kanban "${editId}" updated`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to update kanban");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await deleteKanban(deleteId);
      if (res.status === "blocked") {
        setError(
          res.message ||
            `Kanban "${deleteId}" cannot be deleted because it is referenced by other records.`,
        );
        return;
      }
      if (res.status === "error") {
        setError("Failed to delete kanban");
        return;
      }
      setDeleteOpen(false);
      setMessage(`Kanban "${deleteId}" deleted`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to delete kanban");
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-in">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="kanban-master-grid"
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
            <rect width="100%" height="100%" fill="url(#kanban-master-grid)" />
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
                alt="Production Planning"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-white leading-tight">
              Kanban Master
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Manage kanban records
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <ClipboardList className="h-3 w-3" />
                {total} Kanban{total !== 1 ? "s" : ""}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Search className="h-3 w-3" />
                Status: 1
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

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Hash}>
                <Input
                  placeholder="Kanban ID"
                  value={filters.kanban}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, kanban: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Box}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.partno}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, partno: e.target.value }))
                  }
                >
                  <option value="">Part Number (All)</option>
                  {lookups.partNos.map((o) => (
                    <option key={o.Pmt_Productcode} value={o.Pmt_Productcode}>
                      {o.Pmt_Productcode} | {o.Pmt_Productname}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Gauge}>
                <Input
                  type="number"
                  placeholder="Capacity"
                  value={filters.capacity}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, capacity: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={StickyNote}>
                <Input
                  placeholder="Remarks"
                  value={filters.rem}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, rem: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Kanbans</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total} kanban{total !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add New Kanban
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
              <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No kanbans found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Nothing to display, please add your kanban now.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Kanban ID
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Part No.
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Description
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Capacity
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Locator
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Remarks
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Reg By
                    </th>
                    <th className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.Kbm_KanbanID}
                      className="border-b border-border/20 transition-colors hover:bg-[#005B96]/[0.04]"
                    >
                      <td className="py-2.5 px-3 font-medium">
                        {r.Kbm_KanbanID}
                      </td>
                      <td className="py-2.5 px-3">{r.Kbm_PartNo}</td>
                      <td className="py-2.5 px-3">{r.Kbm_Description}</td>
                      <td className="py-2.5 px-3">{r.Kbm_Qty}</td>
                      <td className="py-2.5 px-3">{r.Kbm_DefaultLocator}</td>
                      <td className="py-2.5 px-3">{r.Kbm_Remarks}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {r.Kbm_RegBy}
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

      {/* Add / Edit modal */}
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
              {editOpen ? `Update Kanban (${editId})` : "Add New Kanban"}
            </DialogTitle>
            <DialogDescription>
              {editOpen
                ? "Edit the kanban details below."
                : "Fill in the kanban details below. The Kanban ID is generated automatically."}
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
                <Label htmlFor="partno">Part No</Label>
                <FilterField icon={Box}>
                  <select
                    id="partno"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.partno}
                    onChange={set("partno")}
                  >
                    <option value="">Select Option</option>
                    {lookups.partNos.map((o) => (
                      <option key={o.Pmt_Productcode} value={o.Pmt_Productcode}>
                        {o.Pmt_Productcode} | {o.Pmt_Productname}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  maxLength={200}
                  value={form.desc}
                  onChange={set("desc")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  step="0.000001"
                  value={form.capacity}
                  onChange={set("capacity")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc">Default Locator</Label>
                <FilterField icon={MapPin}>
                  <select
                    id="loc"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.loc}
                    onChange={set("loc")}
                  >
                    <option value="">Select Option</option>
                    {lookups.locators.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} - {o.description}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rem">Remarks</Label>
                <Input
                  id="rem"
                  maxLength={200}
                  value={form.rem}
                  onChange={set("rem")}
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
            <DialogTitle>Delete Kanban</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete kanban "{deleteId}"? This cannot
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
