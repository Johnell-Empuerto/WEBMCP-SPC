import { useCallback, useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Plus,
  Search,
  Printer,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  fetchPallets,
  fetchPallet,
  fetchCustomerCodes,
  fetchProductDetails,
  updatePallets,
  cancelPallets,
  buildPrintEntries,
  buildPrintEntryFromRow,
  generateQRCodeDataUrl,
} from "../api";
import type {
  PalletFilter,
  PalletRow,
  CustomerCode,
  PalletHeaderForm,
  PalletDetailsForm,
  ProductDetailsResult,
  PrintEntry,
} from "../types";
import {
  getStatusLabel,
  isActiveStatus,
  ACTIVE_STATUS_BADGE,
  DEFAULT_STATUS_BADGE,
} from "@/lib/status";
import EntryModal from "./EntryModal";
import SearchModal from "./SearchModal";
import PrintModal from "./PrintModal";
import ConfirmDialog from "./ConfirmDialog";
import SuccessDialog from "./SuccessDialog";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100, 500];

function emptyHeader(): PalletHeaderForm {
  return {
    controlNo: "",
    partNo: "",
    plCode: "",
    date: "",
    customerCode: "",
    destination: "",
    poNumber: "",
    invoiceNo: "",
    caseNo: "",
    orderDate: "",
  };
}

function emptyDetails(): PalletDetailsForm {
  return {
    packingDate: "",
    orderNo: "",
    productName: "",
    palletCount: null,
    quantity: null,
    weight: null,
    boxNo: "",
  };
}

function convertToYYMM(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return y + m;
}

export default function PalletEntryPage() {
  usePageTitle("Pallet Entry");
  const { user } = useAuth();

  // ── Filter / list ──
  const [filter, setFilter] = useState<PalletFilter>({ status: "A" });
  const [palletData, setPalletData] = useState<PalletRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Pagination (client-side, mirrors legacy) ──
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPallets, setSelectedPallets] = useState<PalletRow[]>([]);
  const [referencePartNo, setReferencePartNo] = useState<string | null>(null);

  // ── Customer codes ──
  const [customerCodes, setCustomerCodes] = useState<CustomerCode[]>([]);

  // ── Entry modal state ──
  const [entryOpen, setEntryOpen] = useState(false);
  const [header, setHeader] = useState<PalletHeaderForm>(emptyHeader);
  const [details, setDetails] = useState<PalletDetailsForm>(emptyDetails);
  const [populating, setPopulating] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Search modal ──
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Confirm / success dialogs ──
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "save">(
    "cancel",
  );
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ── Print modal ──
  const [printEntries, setPrintEntries] = useState<PrintEntry[]>([]);
  const [printOpen, setPrintOpen] = useState(false);

  const totalItems = palletData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = palletData.slice(startIndex, endIndex);

  // ── Initial load (legacy calls filterPallets() on init) ──
  const runFilter = useCallback(async (f: PalletFilter) => {
    setLoading(true);
    try {
      const data = await fetchPallets(f);
      setPalletData(data);
      setSelectedPallets([]);
      setReferencePartNo(null);
      setCurrentPage(1);
      fetchCustomerCodes()
        .then(setCustomerCodes)
        .catch(() => {});
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to retrieve pallets. Please try again.",
      );
      setErrorOpen(true);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    runFilter({ status: "A" });
  }, [runFilter]);

  // ── Selection (single, part-no restricted, excludes N/F/C) ──
  const updateSelectedPallets = useCallback(
    (data: PalletRow, checked: boolean) => {
      const status = (data.Plh_Status || "").toUpperCase();
      if (checked) {
        if (status === "N" || status === "F" || status === "C") return;
        setPalletData((prev) =>
          prev.map((item) => ({
            ...item,
            selected: item.Plh_PLCode === data.Plh_PLCode,
          })),
        );
        setSelectedPallets([data]);
        setReferencePartNo(data.Plh_PartNo);
      } else {
        setPalletData((prev) =>
          prev.map((item) =>
            item.Plh_PLCode === data.Plh_PLCode
              ? { ...item, selected: false }
              : item,
          ),
        );
        setSelectedPallets([]);
        setReferencePartNo(null);
      }
    },
    [],
  );

  const eligibleOnPage = paginatedData.filter((d) => {
    const status = (d.Plh_Status || "").toUpperCase();
    return (
      status !== "N" &&
      status !== "F" &&
      (!referencePartNo || d.Plh_PartNo === referencePartNo)
    );
  });
  const selectAllChecked =
    eligibleOnPage.length > 0 && eligibleOnPage.every((d) => d.selected);

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      const firstEligible = paginatedData.find((d) => {
        const s = (d.Plh_Status || "").toUpperCase();
        return s !== "N" && s !== "F" && s !== "C";
      });
      if (checked && firstEligible) {
        const ref = firstEligible.Plh_PartNo;
        setReferencePartNo(ref);
        setSelectedPallets(
          paginatedData.filter((d) => {
            const s = (d.Plh_Status || "").toUpperCase();
            return s !== "N" && s !== "F" && d.Plh_PartNo === ref;
          }),
        );
        setPalletData((prev) =>
          prev.map((item) =>
            paginatedData.some((p) => p.Plh_PLCode === item.Plh_PLCode) &&
            (item.Plh_Status || "").toUpperCase() !== "N" &&
            (item.Plh_Status || "").toUpperCase() !== "F" &&
            item.Plh_PartNo === ref
              ? { ...item, selected: true }
              : item,
          ),
        );
      } else {
        setPalletData((prev) =>
          prev.map((item) =>
            paginatedData.some((p) => p.Plh_PLCode === item.Plh_PLCode) &&
            (item.Plh_Status || "").toUpperCase() !== "N" &&
            (item.Plh_Status || "").toUpperCase() !== "F"
              ? { ...item, selected: false }
              : item,
          ),
        );
        setSelectedPallets([]);
        setReferencePartNo(null);
      }
    },
    [paginatedData],
  );

  // ── Generate: load selected entry into the modal ──
  const openEntryModal = useCallback(async () => {
    if (selectedPallets.length === 0) return;
    setEntryOpen(true);
    setHeader(emptyHeader());
    setDetails(emptyDetails());
    const selectedEntry = selectedPallets[0];
    try {
      const data = await fetchPallet(selectedEntry.Plh_PLCode);
      const r = data[0];
      if (r) {
        setHeader((prev) => ({
          ...prev,
          controlNo: r.Plh_CaseNo || "",
          partNo: r.Plh_PartNo || "",
          plCode: r.Plh_PLCode || "",
          date: (r.Plh_Date || new Date().toISOString().slice(0, 10)).slice(
            0,
            10,
          ),
          customerCode: r.Plh_CustomerCode || "",
          destination: r.Plh_Destination || "",
          poNumber: r.Plh_PONo || "",
          invoiceNo: r.Plh_InvoiceNo || "",
          caseNo: r.Plh_CaseNo || "",
          orderDate:
            r.Plh_OrderDate != null && r.Plh_OrderDate !== 0
              ? String(r.Plh_OrderDate)
              : "",
        }));
        setDetails((prev) => ({
          ...prev,
          orderNo: r.Plh_OrderNo || "",
          productName: selectedEntry.Plh_ProductName || r.Plh_ProductName || "",
          boxNo: r.Plh_BoxNo?.toString() || "",
        }));
        if (r.Plh_OrderDate == null || r.Plh_OrderDate === 0) {
          const today = new Date().toISOString().slice(0, 10);
          setHeader((h) => ({
            ...h,
            orderDate: convertToYYMM(h.date || today),
          }));
        } else {
          setHeader((h) => ({ ...h, orderDate: String(r.Plh_OrderDate) }));
        }
      }
    } catch {
      setErrorMessage("Failed to load selected pallet.");
      setErrorOpen(true);
    }
  }, [selectedPallets]);

  const handlePopulateFields = useCallback(async () => {
    if (!header.orderDate || !header.partNo) {
      setErrorMessage("Please input the Order Date and Part No.");
      setErrorOpen(true);
      return;
    }
    setPopulating(true);
    try {
      const result: ProductDetailsResult = await fetchProductDetails({
        orderDate: header.orderDate,
        partNo: header.partNo,
      });
      const count = selectedPallets.length;
      const row = result.data;
      if (row) {
        const qty = Number(row.Pmt_StdPackingQty) * count;
        const weight = Number(row.Pmt_StdGrossWeight) * count;
        setDetails((prev) => ({
          ...prev,
          palletCount: count,
          quantity: qty,
          weight: Number(weight.toFixed(2)),
        }));
        const orderDate = String(header.orderDate || "");
        const caseNo = `${row.Pmt_ProductCase}${orderDate}${String(result.entryCount + 1).padStart(8, "0")}`;
        setHeader((prev) => ({ ...prev, caseNo, controlNo: caseNo }));
      }
    } catch {
      setErrorMessage("Failed to load product details.");
      setErrorOpen(true);
    } finally {
      setPopulating(false);
    }
  }, [header.orderDate, header.partNo, selectedPallets.length]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const accountid = user?.userCode || "";
      const result = await updatePallets(
        accountid,
        header,
        details,
        selectedPallets.map((p) => p.Plh_PLCode),
      );
      if (result.success) {
        setSuccessMessage("Pallet Loading Successfully Updated!");
        setSuccessOpen(true);
        setEntryOpen(false);
        setSelectedPallets([]);
        setReferencePartNo(null);
        setPalletData((prev) => prev.map((it) => ({ ...it, selected: false })));
        setTimeout(() => runFilter(filter), 500);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update pallet entry.",
      );
      setErrorOpen(true);
    } finally {
      setSaving(false);
    }
  }, [user, header, details, selectedPallets, filter, runFilter]);

  // ── Cancel ──
  const requestCancel = useCallback(() => {
    if (selectedPallets.length === 0) return;
    setConfirmAction("cancel");
    setConfirmOpen(true);
  }, [selectedPallets.length]);

  const handleConfirm = useCallback(async () => {
    setConfirmOpen(false);
    if (confirmAction === "cancel") {
      try {
        const result = await cancelPallets(
          selectedPallets.map((p) => p.Plh_PLCode),
        );
        if (result.success) {
          setSuccessMessage("Pallet Loading Successfully Cancelled!");
          setSuccessOpen(true);
          setSelectedPallets([]);
          runFilter(filter);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to cancel pallets.",
        );
        setErrorOpen(true);
      }
    }
  }, [confirmAction, selectedPallets, filter, runFilter]);

  // ── Print A (from entry modal / selected) ──
  const handlePrintSelected = useCallback(async () => {
    if (selectedPallets.length === 0) return;
    const entries: PrintEntry[] = [];
    for (const pallet of selectedPallets) {
      const qrCode = await generateQRCodeDataUrl(pallet.Plh_PLCode);
      entries.push(
        buildPrintEntries(
          {
            Plh_PLCode: pallet.Plh_PLCode,
            Plh_PalletCode: pallet.Plh_PalletCode,
            Plh_PartNo: pallet.Plh_PartNo,
            Plh_CaseNo: pallet.Plh_CaseNo,
            Plh_PONo: header.poNumber || pallet.Plh_PONo,
            Plh_InvoiceNo: header.invoiceNo || pallet.Plh_InvoiceNo,
            Plh_CustomerCode: header.customerCode || pallet.Plh_CustomerCode,
            Plh_Destination: header.destination || pallet.Plh_Destination,
            Plh_OrderDate: header.orderDate
              ? Number(header.orderDate)
              : pallet.Plh_OrderDate,
            Plh_Date: header.date || pallet.Plh_Date,
            Plh_PackingDate: details.packingDate || pallet.Plh_PackingDate,
            Plh_OrderNo: details.orderNo || pallet.Plh_OrderNo,
            Plh_ProductName: details.productName || pallet.Plh_ProductName,
            Plh_Quantity: details.quantity ?? pallet.Plh_Quantity,
            Plh_Weight: details.weight ?? pallet.Plh_Weight,
            Plh_BoxNo: details.boxNo ? Number(details.boxNo) : pallet.Plh_BoxNo,
            Plh_ControlNo: header.controlNo || pallet.Plh_ControlNo,
            Plh_CheckBy: pallet.Plh_CheckBy,
          },
          header,
          details,
          qrCode,
        ),
      );
    }
    setPrintEntries(entries);
    setPrintOpen(true);
  }, [selectedPallets, header, details]);

  // ── Print F (row-level, shown when filter.status === 'F') ──
  // Legacy openPrintModalF() groups all palletData rows that share the clicked
  // row's Plh_CaseNo and maps each to a print entry straight from the DB row.
  const handleRowPrint = useCallback(
    async (row: PalletRow) => {
      const caseNo = row.Plh_CaseNo;
      const matching = caseNo
        ? palletData.filter((entry) => entry.Plh_CaseNo === caseNo)
        : [row];
      const entries: PrintEntry[] = [];
      for (const entry of matching) {
        const qrCode = await generateQRCodeDataUrl(entry.Plh_PLCode);
        entries.push(buildPrintEntryFromRow(entry, qrCode));
      }
      setPrintEntries(entries);
      setPrintOpen(true);
    },
    [palletData],
  );

  const handleFieldChange = useCallback((field: string, value: string) => {
    setHeader((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "date") {
        next.orderDate = convertToYYMM(value);
      }
      return next;
    });
  }, []);

  const handleCustomerChange = useCallback(
    (code: string) => {
      setHeader((prev) => {
        const customer = customerCodes.find((c) => c.code === code);
        return {
          ...prev,
          customerCode: code,
          destination: customer?.name || "",
        };
      });
    },
    [customerCodes],
  );

  const handleDetailChange = useCallback((field: string, value: string) => {
    setDetails((prev) => ({ ...prev, [field]: value }));
  }, []);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const pageNumbers: number[] = [];
  for (let i = currentPage - 2; i <= currentPage + 2; i++) {
    if (i >= 1 && i <= totalPages) pageNumbers.push(i);
  }

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005B96] to-[#0078C8] px-7 py-6 text-white shadow-md border border-white/10">
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="pe-grid"
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
            <rect width="100%" height="100%" fill="url(#pe-grid)" />
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
              Pallet Entry
            </div>
            <div className="text-sm font-medium text-white/70 mt-0.5">
              Pallet Loading Management &amp; Packing
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                <Search className="h-3 w-3" />
                Status: {getStatusLabel(filter.status || "A")}
              </div>
              {filter.date && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-white/90 border border-white/10">
                  <Package className="h-3 w-3" />
                  {filter.date}
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

      {/* ── Toolbar + Table ──────────────────────────── */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-3 px-5 pt-5 flex flex-row items-center gap-3 flex-wrap">
          <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
              <Package className="h-4 w-4" />
            </div>
            <span>Pallet List</span>
          </CardTitle>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span>entries</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="h-9"
            >
              <Search className="h-4 w-4 mr-1.5" /> Search
            </Button>
            <Button
              size="sm"
              className="h-9 bg-[#0099FC] hover:bg-[#0099FC]/90 disabled:opacity-50"
              disabled={selectedPallets.length === 0}
              onClick={openEntryModal}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Generate
            </Button>
            <Button
              size="sm"
              className="h-9 bg-[#0099FC] hover:bg-[#0099FC]/90 disabled:opacity-50"
              disabled={selectedPallets.length === 0}
              onClick={handlePrintSelected}
            >
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-9"
              disabled={selectedPallets.length === 0}
              onClick={requestCancel}
            >
              <X className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {initialLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border/60 bg-slate-100 dark:bg-slate-800 text-left">
                    <th className="px-3 py-2.5 font-semibold w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectAllChecked}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="h-4 w-4 rounded border-border"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      PL Code
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Pallet Code
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Control No.
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Order Date
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Invoice No.
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      PO Number
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Case No.
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Part No.
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Status
                    </th>
                    {filter.status === "F" && (
                      <th className="px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={filter.status === "F" ? 11 : 10}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        Nothing to display.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((data) => {
                      const status = (data.Plh_Status || "").toUpperCase();
                      const disabled =
                        status === "F" ||
                        status === "C" ||
                        status === "N" ||
                        (selectedPallets.length > 0 && !data.selected);
                      return (
                        <tr
                          key={data.Plh_PLCode}
                          className="border-b border-border/40 hover:bg-muted/40"
                        >
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!data.selected}
                              disabled={disabled}
                              onChange={(e) =>
                                updateSelectedPallets(data, e.target.checked)
                              }
                              className="h-4 w-4 rounded border-border disabled:opacity-50"
                            />
                          </td>
                          <td className="px-3 py-2.5">{data.Plh_PLCode}</td>
                          <td className="px-3 py-2.5">{data.Plh_PalletCode}</td>
                          <td className="px-3 py-2.5">{data.Plh_ControlNo}</td>
                          <td className="px-3 py-2.5">{data.Plh_OrderDate}</td>
                          <td className="px-3 py-2.5">{data.Plh_InvoiceNo}</td>
                          <td className="px-3 py-2.5">{data.Plh_PONo}</td>
                          <td className="px-3 py-2.5">{data.Plh_CaseNo}</td>
                          <td className="px-3 py-2.5">{data.Plh_PartNo}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                status === "A"
                                  ? ACTIVE_STATUS_BADGE
                                  : status === "F"
                                    ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                                    : status === "C"
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      : status === "N"
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        : DEFAULT_STATUS_BADGE
                              }`}
                            >
                              {isActiveStatus(status)
                                ? "Active"
                                : getStatusLabel(data.Plh_Status)}
                            </span>
                          </td>
                          {filter.status === "F" && (
                            <td className="px-3 py-2.5 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => handleRowPrint(data)}
                              >
                                <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination footer ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-3">
            <p className="text-sm text-muted-foreground">
              Showing {totalItems === 0 ? 0 : startIndex + 1} to {endIndex} of{" "}
              {totalItems} entries
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pageNumbers.map((p) => (
                <Button
                  key={p}
                  variant={p === currentPage ? "default" : "outline"}
                  size="icon"
                  onClick={() => goToPage(p)}
                  className={
                    p === currentPage
                      ? "bg-[#005B96] hover:bg-[#005B96]/90"
                      : ""
                  }
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading pallets...
        </div>
      )}

      {/* ── Modals ── */}
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onReset={() => {
          setFilter({});
          runFilter({});
        }}
        onSearch={(f) => {
          setFilter(f);
          runFilter(f);
          setSearchOpen(false);
        }}
      />
      <EntryModal
        open={entryOpen}
        header={header}
        details={details}
        customerCodes={customerCodes}
        saving={saving}
        populating={populating}
        onClose={() => {
          setEntryOpen(false);
          setHeader(emptyHeader());
          setDetails(emptyDetails());
        }}
        onFieldChange={handleFieldChange}
        onCustomerChange={handleCustomerChange}
        onDetailChange={handleDetailChange}
        onPopulate={handlePopulateFields}
        onPrint={handlePrintSelected}
        onSave={handleSave}
      />
      <PrintModal
        open={printOpen}
        entries={printEntries}
        onClose={() => setPrintOpen(false)}
      />
      <ConfirmDialog
        open={confirmOpen}
        action={confirmAction}
        count={selectedPallets.length}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
      <SuccessDialog
        open={successOpen}
        message={successMessage}
        onClose={() => setSuccessOpen(false)}
      />
      <ConfirmDialog
        open={errorOpen}
        action="error"
        count={0}
        errorMessage={errorMessage}
        onClose={() => setErrorOpen(false)}
        onConfirm={() => setErrorOpen(false)}
      />
    </div>
  );
}
