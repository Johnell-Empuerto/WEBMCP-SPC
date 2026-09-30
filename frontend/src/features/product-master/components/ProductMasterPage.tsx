import { useCallback, useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/MonthField";
import { FilterField } from "@/components/ui/FilterField";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/Pagination";
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
  Package,
  Tag,
  Layers,
  ToggleLeft,
  Ruler,
  CircleDot,
  Folder,
  Clock,
  Boxes,
  Barcode,
  FileText,
  Box,
  Hash,
} from "lucide-react";
import {
  addProduct,
  deleteProduct,
  fetchProductDetail,
  fetchProductLookups,
  fetchProducts,
  updateProduct,
} from "../api";
import type {
  ProductDetail,
  ProductMasterFilter,
  ProductMasterLookups,
  ProductMasterPayload,
  ProductMasterRow,
} from "../types";
import {
  getStatusLabel,
  isActiveStatus,
  ACTIVE_STATUS_BADGE,
  DEFAULT_STATUS_BADGE,
} from "@/lib/status";

const BM_STATUS_LABELS: Record<string, string> = {
  A: "Active",
  N: "New",
  F: "Fulfilled",
  U: "OnHold",
};

const PAGE_SIZE = 10;

interface FormState {
  prodcode: string;
  prodname: string;
  prodcostcenter: string;
  prodregdate: string;
  prodcategory: string;
  prodsource: string;
  reqcpo: string;
  produnit: string;
  bomcontrolno: string;
  bomprodcode: string;
  bomtype: string;
  bmstatus: string;
  hascurpsched: string;
  hasnxtpsched: string;
  psgroupcode: string;
  minlotsize: string;
  maxlotsize: string;
  prodleadtime: string;
  leadtimeunit: string;
  stdpackingqty: string;
  stdpackingunit: string;
  barcodeheader: string;
  accountcode: string;
  ishalffinished: string;
  last_shipment: string;
  prodspec: string;
  prodextcode: string;
  businessunitcode: string;
  stdnetweight: string;
  stdgrossweight: string;
  netgrossdecdigit: string;
  desccategorycode: string;
  internalprodcode: string;
}

const EMPTY_FORM: FormState = {
  prodcode: "",
  prodname: "",
  prodcostcenter: "",
  prodregdate: "",
  prodcategory: "",
  prodsource: "",
  reqcpo: "1",
  produnit: "",
  bomcontrolno: "",
  bomprodcode: "",
  bomtype: "",
  bmstatus: "A",
  hascurpsched: "0",
  hasnxtpsched: "0",
  psgroupcode: "",
  minlotsize: "",
  maxlotsize: "",
  prodleadtime: "",
  leadtimeunit: "",
  stdpackingqty: "",
  stdpackingunit: "",
  barcodeheader: "0",
  accountcode: "",
  ishalffinished: "0",
  last_shipment: "",
  prodspec: "",
  prodextcode: "",
  businessunitcode: "",
  stdnetweight: "",
  stdgrossweight: "",
  netgrossdecdigit: "",
  desccategorycode: "",
  internalprodcode: "",
};

function toForm(d: ProductDetail): FormState {
  const n = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : String(v);
  const dStr = (v: string) => (v && v !== "null" ? v : "");
  return {
    prodcode: dStr(d.Pmt_Productcode),
    prodname: dStr(d.Pmt_Productname),
    prodcostcenter: dStr(d.Pmt_CostCenterCode),
    prodregdate: dStr(d.Pmt_ProdRegdate),
    prodcategory: dStr(d.Pmt_ProdCategory),
    prodsource: dStr(d.Pmt_ProdSource),
    reqcpo: n(d.Pmt_RequireCPO),
    produnit: dStr(d.Pmt_ProductUnit),
    bomcontrolno: dStr(d.Pmt_BOMControlNo),
    bomprodcode: dStr(d.Pmt_BOMProdCode),
    bomtype: dStr(d.Pmt_BOMType),
    bmstatus: dStr(d.Pmt_BMstatus),
    hascurpsched: n(d.Pmt_HasCurMthPSched),
    hasnxtpsched: n(d.Pmt_HasNxtMthPSched),
    psgroupcode: dStr(d.Pmt_PSGroupCode),
    minlotsize: n(d.Pmt_MinLotSize),
    maxlotsize: n(d.Pmt_MaxLotSize),
    prodleadtime: n(d.Pmt_ProdLeadTime),
    leadtimeunit: dStr(d.Pmt_LeadTimeUnit),
    stdpackingqty: n(d.Pmt_StdPackingQty),
    stdpackingunit: dStr(d.Pmt_StdPackingUnit),
    barcodeheader: n(d.Pmt_BarcodeHeader),
    accountcode: dStr(d.Pmt_AccountCode),
    ishalffinished: n(d.Pmt_IsHalfFinished),
    last_shipment: dStr(d.Pmt_LastShipment),
    prodspec: dStr(d.Pmt_ProductSpecification),
    prodextcode: dStr(d.Pmt_ProductExtCode),
    businessunitcode: dStr(d.Pmt_BusinessUnitCode),
    stdnetweight: n(d.Pmt_StdNetWeight),
    stdgrossweight: n(d.Pmt_StdGrossWeight),
    netgrossdecdigit: n(d.Pmt_NetGrossDecDigit),
    desccategorycode: dStr(d.Pmt_DescCategoryCode),
    internalprodcode: dStr(d.Pmt_InternalProdCode),
  };
}

function toPayload(form: FormState): ProductMasterPayload {
  return {
    ...form,
    prodsource: form.prodsource || "M",
    barcodeheader: form.barcodeheader || "0",
    ishalffinished: form.ishalffinished || "0",
  };
}

export default function ProductMasterPage() {
  usePageTitle("Product Master");

  const { user } = useAuth();
  const userlogin = user?.userCode ?? "";

  const [rows, setRows] = useState<ProductMasterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    prodcode: "",
    prodname: "",
    prodspec: "",
    internalprodcode: "",
  });

  const [lookups, setLookups] = useState<ProductMasterLookups>({
    costCenters: [],
    prodUnits: [],
    accountCodes: [],
    psGroupCodes: [],
  });
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteCode, setDeleteCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (pageNo: number, f: typeof filters) => {
    setLoading(true);
    try {
      const filter: ProductMasterFilter = {
        size: PAGE_SIZE,
        pageno: pageNo,
        ...f,
      };
      const result = await fetchProducts(filter);
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
    fetchProductLookups()
      .then(setLookups)
      .catch(() =>
        setLookups({
          costCenters: [],
          prodUnits: [],
          accountCodes: [],
          psGroupCodes: [],
        }),
      );
  }, []);

  const handleSearch = () => {
    setPage(1);
    load(1, filters);
  };

  const resetSearch = () => {
    setFilters({
      prodcode: "",
      prodname: "",
      prodspec: "",
      internalprodcode: "",
    });
    setPage(1);
    load(1, { prodcode: "", prodname: "", prodspec: "", internalprodcode: "" });
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError("");
    setAddOpen(true);
  };

  const openEdit = async (code: string) => {
    setError("");
    try {
      const detail = await fetchProductDetail(code);
      setForm(detail ? toForm(detail) : EMPTY_FORM);
      setEditOpen(true);
    } catch {
      setError("Failed to load product details");
    }
  };

  const openDelete = (code: string) => {
    setDeleteCode(code);
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
      const res = await addProduct({ ...toPayload(form), userlogin });
      if (res.status === "duplicate") {
        setError(`Product code "${form.prodcode}" already exists`);
        return;
      }
      if (res.status === "error") {
        setError("Failed to add product");
        return;
      }
      setAddOpen(false);
      setMessage(`Product "${form.prodcode}" added`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to add product");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    setError("");
    try {
      await updateProduct({ ...toPayload(form), userlogin });
      setEditOpen(false);
      setMessage(`Product "${form.prodcode}" updated`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await deleteProduct(deleteCode, userlogin);
      if (res.status === "blocked") {
        setError(
          res.message ||
            `Product "${deleteCode}" cannot be deleted because it is referenced by other records.`,
        );
        return;
      }
      if (res.status === "error") {
        setError("Failed to delete product");
        return;
      }
      setDeleteOpen(false);
      setMessage(`Product "${deleteCode}" deleted`);
      setTimeout(() => setMessage(""), 3000);
      load(page, filters);
    } catch {
      setError("Failed to delete product");
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
                id="product-master-grid"
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
            <rect width="100%" height="100%" fill="url(#product-master-grid)" />
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
              Product Master
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Manage product master records
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Package className="h-3 w-3" />
                {total} Product{total !== 1 ? "s" : ""}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Search className="h-3 w-3" />
                Status: Active
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
              <FilterField icon={Box}>
                <Input
                  placeholder="Product Code"
                  value={filters.prodcode}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, prodcode: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Tag}>
                <Input
                  placeholder="Product Name"
                  value={filters.prodname}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, prodname: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={FileText}>
                <Input
                  placeholder="Product Specification"
                  value={filters.prodspec}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, prodspec: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </FilterField>
            </div>
            <div className="flex-1 min-w-[160px]">
              <FilterField icon={Hash}>
                <Input
                  placeholder="Internal Product Code"
                  value={filters.internalprodcode}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      internalprodcode: e.target.value,
                    }))
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
          <CardTitle>All Products</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total} product{total !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add New Product
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
              <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No products found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Nothing to display, please add your product now.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-border/60">
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Product Code
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Product Name
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Cost Center Code
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Category
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Source
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      BM Status
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Specification
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Internal Product Code
                    </th>
                    <th className="text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      User
                    </th>
                    <th className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.Pmt_Productcode}
                      className="border-b border-border/20 transition-colors hover:bg-[#005B96]/[0.04]"
                    >
                      <td className="py-2.5 px-3 font-medium">
                        {r.Pmt_Productcode}
                      </td>
                      <td className="py-2.5 px-3">{r.Pmt_Productname}</td>
                      <td className="py-2.5 px-3">{r.Pmt_CostCenterCode}</td>
                      <td className="py-2.5 px-3">{r.Pmt_ProdCategory}</td>
                      <td className="py-2.5 px-3">{r.Pmt_ProdSource}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isActiveStatus(r.Pmt_BMstatus) ? ACTIVE_STATUS_BADGE : DEFAULT_STATUS_BADGE}`}
                        >
                          {BM_STATUS_LABELS[r.Pmt_BMstatus] ??
                            getStatusLabel(r.Pmt_BMstatus)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {r.Pmt_ProductSpecification}
                      </td>
                      <td className="py-2.5 px-3">{r.Pmt_InternalProdCode}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {r.User_login}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(r.Pmt_Productcode)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDelete(r.Pmt_Productcode)}
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
          className="max-w-2xl w-full max-h-[78vh] overflow-hidden flex flex-col p-0 gap-0"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <DialogTitle>
              {editOpen
                ? `Update Product (${form.prodcode})`
                : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {editOpen
                ? "Edit the product details below."
                : "Fill in the product details below."}
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
                <Label htmlFor="prodcode">Product Code</Label>
                <Input
                  id="prodcode"
                  maxLength={25}
                  value={form.prodcode}
                  onChange={set("prodcode")}
                  readOnly={editOpen}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodname">Product Name</Label>
                <Input
                  id="prodname"
                  maxLength={50}
                  value={form.prodname}
                  onChange={set("prodname")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodcostcenter">Product Cost Center Code</Label>
                <FilterField icon={Tag}>
                  <select
                    id="prodcostcenter"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.prodcostcenter}
                    onChange={set("prodcostcenter")}
                  >
                    <option value="">Select Cost Center Code</option>
                    {lookups.costCenters.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} - {o.description}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodregdate">Prod Reg Date</Label>
                <DateField>
                  <Input
                    id="prodregdate"
                    type="date"
                    value={form.prodregdate}
                    onChange={set("prodregdate")}
                  />
                </DateField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodcategory">Product Category</Label>
                <FilterField icon={Tag}>
                  <select
                    id="prodcategory"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.prodcategory}
                    onChange={set("prodcategory")}
                  >
                    <option value="">Select Product Category</option>
                    <option value="G">Goods</option>
                    <option value="S">Services</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodsource">Product Source</Label>
                <FilterField icon={Layers}>
                  <select
                    id="prodsource"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.prodsource}
                    onChange={set("prodsource")}
                  >
                    <option value="">Select Product Source</option>
                    <option value="M">Manufacturing</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reqcpo">Require CPO</Label>
                <FilterField icon={ToggleLeft}>
                  <select
                    id="reqcpo"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.reqcpo}
                    onChange={set("reqcpo")}
                  >
                    <option value="1">True</option>
                    <option value="0">False</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="produnit">Product Unit</Label>
                <FilterField icon={Ruler}>
                  <select
                    id="produnit"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.produnit}
                    onChange={set("produnit")}
                  >
                    <option value="">Select Product Unit</option>
                    {lookups.prodUnits.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} - {o.description}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bomcontrolno">BOM Control No</Label>
                <Input
                  id="bomcontrolno"
                  maxLength={12}
                  value={form.bomcontrolno}
                  onChange={set("bomcontrolno")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bomprodcode">BOM Prod Code</Label>
                <Input
                  id="bomprodcode"
                  maxLength={25}
                  value={form.bomprodcode}
                  onChange={set("bomprodcode")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bomtype">BOM Type</Label>
                <Input
                  id="bomtype"
                  maxLength={1}
                  value={form.bomtype}
                  onChange={set("bomtype")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bmstatus">BM Status</Label>
                <FilterField icon={CircleDot}>
                  <select
                    id="bmstatus"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.bmstatus}
                    onChange={set("bmstatus")}
                  >
                    <option value="">Select BM Status</option>
                    <option value="A">Active</option>
                    <option value="N">New</option>
                    <option value="F">Fulfilled</option>
                    <option value="U">OnHold</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hascurpsched">Has Cur Mth PSched</Label>
                <FilterField icon={ToggleLeft}>
                  <select
                    id="hascurpsched"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.hascurpsched}
                    onChange={set("hascurpsched")}
                  >
                    <option value="1">True</option>
                    <option value="0">False</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hasnxtpsched">Has Nxt Mth PSched</Label>
                <FilterField icon={ToggleLeft}>
                  <select
                    id="hasnxtpsched"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.hasnxtpsched}
                    onChange={set("hasnxtpsched")}
                  >
                    <option value="1">True</option>
                    <option value="0">False</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="psgroupcode">PS Group Code</Label>
                <FilterField icon={Folder}>
                  <select
                    id="psgroupcode"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.psgroupcode}
                    onChange={set("psgroupcode")}
                  >
                    <option value="">Select PS Group Code</option>
                    {lookups.psGroupCodes.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} - {o.description}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minlotsize">Min Lot Size</Label>
                <Input
                  id="minlotsize"
                  type="number"
                  step="1"
                  value={form.minlotsize}
                  onChange={set("minlotsize")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxlotsize">Max Lot Size</Label>
                <Input
                  id="maxlotsize"
                  type="number"
                  step="1"
                  value={form.maxlotsize}
                  onChange={set("maxlotsize")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodleadtime">Prod Lead Time</Label>
                <Input
                  id="prodleadtime"
                  type="number"
                  step="0.01"
                  value={form.prodleadtime}
                  onChange={set("prodleadtime")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leadtimeunit">Lead Time Unit</Label>
                <FilterField icon={Clock}>
                  <select
                    id="leadtimeunit"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.leadtimeunit}
                    onChange={set("leadtimeunit")}
                  >
                    <option value="">Select Lead Time Unit</option>
                    <option value="H">Hours</option>
                    <option value="M">Minute</option>
                    <option value="S">Seconds</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stdpackingqty">Std Packing Qty</Label>
                <Input
                  id="stdpackingqty"
                  type="number"
                  step="0.001"
                  value={form.stdpackingqty}
                  onChange={set("stdpackingqty")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stdpackingunit">Std Packing Unit</Label>
                <FilterField icon={Boxes}>
                  <select
                    id="stdpackingunit"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.stdpackingunit}
                    onChange={set("stdpackingunit")}
                  >
                    <option value="">Select Std Packing Unit</option>
                    {lookups.prodUnits.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} - {o.description}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="barcodeheader">Barcode Header</Label>
                <FilterField icon={Barcode}>
                  <select
                    id="barcodeheader"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.barcodeheader}
                    onChange={set("barcodeheader")}
                  >
                    <option value="1">True</option>
                    <option value="0">False</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accountcode">Account Code</Label>
                <FilterField icon={FileText}>
                  <select
                    id="accountcode"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.accountcode}
                    onChange={set("accountcode")}
                  >
                    <option value="">Select Account Code</option>
                    {lookups.accountCodes.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} - {o.description}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ishalffinished">Is Half Finished</Label>
                <FilterField icon={Package}>
                  <select
                    id="ishalffinished"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.ishalffinished}
                    onChange={set("ishalffinished")}
                  >
                    <option value="1">True</option>
                    <option value="0">False</option>
                  </select>
                </FilterField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_shipment">Last Shipment</Label>
                <DateField>
                  <Input
                    id="last_shipment"
                    type="date"
                    value={form.last_shipment}
                    onChange={set("last_shipment")}
                  />
                </DateField>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodspec">Product Specification</Label>
                <Input
                  id="prodspec"
                  maxLength={50}
                  value={form.prodspec}
                  onChange={set("prodspec")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prodextcode">Product Ext Code</Label>
                <Input
                  id="prodextcode"
                  maxLength={150}
                  value={form.prodextcode}
                  onChange={set("prodextcode")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="businessunitcode">Business Unit Code</Label>
                <Input
                  id="businessunitcode"
                  maxLength={10}
                  value={form.businessunitcode}
                  onChange={set("businessunitcode")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stdnetweight">Std Net Weight</Label>
                <Input
                  id="stdnetweight"
                  type="number"
                  step="0.001"
                  value={form.stdnetweight}
                  onChange={set("stdnetweight")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stdgrossweight">Std Gross Weight</Label>
                <Input
                  id="stdgrossweight"
                  type="number"
                  step="0.001"
                  value={form.stdgrossweight}
                  onChange={set("stdgrossweight")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="netgrossdecdigit">Net Gross Dec Digit</Label>
                <Input
                  id="netgrossdecdigit"
                  type="number"
                  step="1"
                  min="0"
                  value={form.netgrossdecdigit}
                  onChange={set("netgrossdecdigit")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desccategorycode">Desc Category Code</Label>
                <Input
                  id="desccategorycode"
                  maxLength={10}
                  value={form.desccategorycode}
                  onChange={set("desccategorycode")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="internalprodcode">Internal Product Code</Label>
                <Input
                  id="internalprodcode"
                  maxLength={25}
                  value={form.internalprodcode}
                  onChange={set("internalprodcode")}
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

      {/* Delete confirm */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete product "{deleteCode}"? This
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
    </div>
  );
}
