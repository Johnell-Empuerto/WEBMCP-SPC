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
  MapPin,
  Tag,
  Boxes,
  CircleDot,
  Warehouse,
} from "lucide-react";
import {
  addLocator,
  checkLocatorCode,
  deleteLocator,
  fetchLocators,
  updateLocator,
} from "../api";
import type {
  AddLocatorPayload,
  LocatorMasterFilter,
  LocatorMasterRow,
  UpdateLocatorPayload,
} from "../types";
import {
  getStatusLabel,
  isActiveStatus,
  ACTIVE_STATUS_BADGE,
  DEFAULT_STATUS_BADGE,
} from "@/lib/status";

const PAGE_SIZE = 10;

const TYPE_OPTIONS = ["S", "C", "ADC"];
const AREA_OPTIONS = ["IN", "OUT", "N"];
const OCCUPANCY_OPTIONS = ["E", "O", "N"];
const STATUS_OPTIONS = ["A", "F", "N"];
const WAREHOUSE_OPTIONS = ["000", "PRD"];

interface FormState {
  locatorcode: string;
  desc: string;
  type: string;
  area: string;
  occupancy: string;
  status: string;
  warehouse: string;
  effectivitydate: string;
}

const EMPTY_FORM: FormState = {
  locatorcode: "",
  desc: "",
  type: "",
  area: "",
  occupancy: "",
  status: "",
  warehouse: "",
  effectivitydate: "",
};

function toForm(r: LocatorMasterRow): FormState {
  return {
    locatorcode: r.Lmt_Locatorcode ?? "",
    desc: r.Lmt_Locatordesc ?? "",
    type: r.Lmt_LocatorType ?? "",
    area: r.Lmt_LocatorArea ?? "",
    occupancy: r.Lmt_OccupancyStatus ?? "",
    status: r.Lmt_status ?? "",
    warehouse: r.Lmt_WarehouseCode ?? "",
    effectivitydate: r.Lmt_EffectivityDate
      ? String(r.Lmt_EffectivityDate).slice(0, 16)
      : "",
  };
}

export default function LocatorMasterPage() {
  usePageTitle("Locator Master");

  const { user } = useAuth();
  const userlogin = user?.userCode ?? "";

  const [rows, setRows] = useState<LocatorMasterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    area: "",
    occupancy: "",
    status: "",
    warehouse: "",
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
      const filter: LocatorMasterFilter = {
        size: PAGE_SIZE,
        pageno: pageNo,
        ...f,
      };
      const result = await fetchLocators(filter);
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
    setFilters({
      search: "",
      type: "",
      area: "",
      occupancy: "",
      status: "",
      warehouse: "",
    });
    setPage(1);
    load(1, {
      search: "",
      type: "",
      area: "",
      occupancy: "",
      status: "",
      warehouse: "",
    });
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError("");
    setAddOpen(true);
  };

  const openEdit = (row: LocatorMasterRow) => {
    setEditId(row.Lmt_Locatorcode);
    setForm(toForm(row));
    setError("");
    setEditOpen(true);
  };

  const openDelete = (row: LocatorMasterRow) => {
    setDeleteId(row.Lmt_Locatorcode);
    setError("");
    setDeleteOpen(true);
  };

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async () => {
    if (
      !form.locatorcode.trim() ||
      !form.desc.trim() ||
      !form.type ||
      !form.area ||
      !form.occupancy ||
      !form.status
    ) {
      setError("Please fill out the required fields");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const exists = await checkLocatorCode(form.locatorcode.trim());
      if (exists.exists) {
        setError(`Locator "${form.locatorcode.trim()}" already exists`);
        return;
      }
      const payload: AddLocatorPayload = {
        locatorcode: form.locatorcode.trim(),
        desc: form.desc,
        type: form.type,
        area: form.area,
        occupancy: form.occupancy,
        status: form.status,
        warehouse: form.warehouse,
        userlogin,
      };
      const res = await addLocator(payload);
      if (res.status === "blocked") {
        setError(res.message || `Locator "${form.locatorcode}" already exists`);
        return;
      }
      if (res.status === "error") {
        setError("Failed to add locator");
        return;
      }
      setAddOpen(false);
      setMessage(`Locator "${form.locatorcode}" added`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to add locator");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: UpdateLocatorPayload = {
        locatorcode: editId,
        desc: form.desc,
        type: form.type,
        area: form.area,
        occupancy: form.occupancy,
        status: form.status,
        warehouse: form.warehouse,
        effectivitydate: form.effectivitydate || undefined,
        userlogin,
      };
      await updateLocator(payload);
      setEditOpen(false);
      setMessage(`Locator "${editId}" updated`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to update locator");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await deleteLocator(deleteId);
      if (res.status === "blocked") {
        setError(
          res.message ||
            `Locator "${deleteId}" cannot be deleted because it is referenced by other records.`,
        );
        return;
      }
      if (res.status === "error") {
        setError("Failed to delete locator");
        return;
      }
      setDeleteOpen(false);
      setMessage(`Locator "${deleteId}" deleted`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to delete locator");
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="locator-master-grid"
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
            <rect width="100%" height="100%" fill="url(#locator-master-grid)" />
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
              Locator Master
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Manage locator records
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <MapPin className="h-3 w-3" />
                {total} Locator{total !== 1 ? "s" : ""}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Search className="h-3 w-3" />
                Types: S / C / ADC
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
              <FilterField icon={Search}>
                <Input
                  placeholder="Locator Code"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Tag}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.type}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  <option value="">Type (All)</option>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={MapPin}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.area}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, area: e.target.value }))
                  }
                >
                  <option value="">Area (All)</option>
                  {AREA_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Boxes}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.occupancy}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, occupancy: e.target.value }))
                  }
                >
                  <option value="">Occupancy (All)</option>
                  {OCCUPANCY_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
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
                    <option key={o} value={o}>
                      {o === "A" ? "Active" : o}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Warehouse}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={filters.warehouse}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, warehouse: e.target.value }))
                  }
                >
                  <option value="">Warehouse (All)</option>
                  {WAREHOUSE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Locators</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total} locator{total !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add New Locator
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
              <MapPin className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No locators found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Nothing to display, please add your locator now.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Locator Code
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Description
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Type
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Area
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Occupancy
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Warehouse
                    </th>
                    <th className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.Lmt_Locatorcode}
                      className="border-b border-border/20 transition-colors hover:bg-[#005B96]/[0.04]"
                    >
                      <td className="py-2.5 px-3 font-medium">
                        {r.Lmt_Locatorcode}
                      </td>
                      <td className="py-2.5 px-3">{r.Lmt_Locatordesc}</td>
                      <td className="py-2.5 px-3">{r.Lmt_LocatorType}</td>
                      <td className="py-2.5 px-3">{r.Lmt_LocatorArea}</td>
                      <td className="py-2.5 px-3">{r.Lmt_OccupancyStatus}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isActiveStatus(r.Lmt_status) ? ACTIVE_STATUS_BADGE : DEFAULT_STATUS_BADGE}`}
                        >
                          {getStatusLabel(r.Lmt_status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{r.Lmt_WarehouseCode}</td>
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
              {editOpen ? `Update Locator (${editId})` : "Add New Locator"}
            </DialogTitle>
            <DialogDescription>
              {editOpen
                ? "Edit the locator details below."
                : "Fill in the locator details below. The Locator Code is required and must be unique."}
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
                <Label htmlFor="locatorcode">Locator Code</Label>
                <Input
                  id="locatorcode"
                  maxLength={6}
                  value={form.locatorcode}
                  onChange={set("locatorcode")}
                  disabled={editOpen}
                  placeholder={editOpen ? editId : "e.g. S-A01"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <FilterField icon={Tag}>
                  <select
                    id="type"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.type}
                    onChange={set("type")}
                  >
                    <option value="">Select Option</option>
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  maxLength={300}
                  value={form.desc}
                  onChange={set("desc")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="area">Area</Label>
                <FilterField icon={MapPin}>
                  <select
                    id="area"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.area}
                    onChange={set("area")}
                  >
                    <option value="">Select Option</option>
                    {AREA_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="occupancy">Occupancy</Label>
                <FilterField icon={Boxes}>
                  <select
                    id="occupancy"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.occupancy}
                    onChange={set("occupancy")}
                  >
                    <option value="">Select Option</option>
                    {OCCUPANCY_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
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
                    <option value="">Select Option</option>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o === "A" ? "Active" : o}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="warehouse">Warehouse</Label>
                <FilterField icon={Warehouse}>
                  <select
                    id="warehouse"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.warehouse}
                    onChange={set("warehouse")}
                  >
                    <option value="">Select Option</option>
                    {WAREHOUSE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="effectivitydate">Effectivity Date</Label>
                <Input
                  id="effectivitydate"
                  type="datetime-local"
                  value={form.effectivitydate}
                  onChange={set("effectivitydate")}
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
            <DialogTitle>Delete Locator</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete locator "{deleteId}"? This cannot
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
