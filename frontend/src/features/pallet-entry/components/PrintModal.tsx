import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, ChevronLeft, ChevronRight, X } from "lucide-react"
import type { PrintEntry } from "../types"

interface PrintModalProps {
  open: boolean
  entries: PrintEntry[]
  onClose: () => void
}

export default function PrintModal({ open, entries, onClose }: PrintModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const entry = entries[currentIndex]
  const total = entries.length

  const renderPackingList = (en: PrintEntry) => (
    <div className="font-sans">
      <div className="text-right mb-2.5">
        {en.qrCode.startsWith("data:image") && (
          <img src={en.qrCode} alt="QR Code" className="ml-auto w-[50px] h-[50px]" />
        )}
        <div>{en.palletId}</div>
      </div>

      <h3
        className="text-center bg-black text-white px-1 py-[5px] m-0"
        style={{ marginBottom: 0 }}
      >
        PACKING LIST
      </h3>
      <table className="w-full border-collapse mt-2.5 border border-black">
        <tbody>
          <tr>
            <td colSpan={2} style={{ border: "1px solid black", padding: "5px" }}>
              INVOICE NO. {en.invoiceNo}
            </td>
            <td colSpan={2} style={{ border: "1px solid black", padding: "5px" }}>
              PO NO. {en.poNumber}
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              CASE NO.
              <br />
              {en.caseNo}
            </td>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              PART NO./DESCRIPTION
              <br />
              {en.partNo} / {en.description}
            </td>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              BOX NO.
              <br />
              {en.boxNo}
            </td>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              TOTAL QTY/CASE
              <br />
              {en.totalQtyCase}
            </td>
          </tr>
        </tbody>
      </table>

      <h3
        className="text-center bg-black text-white px-1 py-[5px]"
        style={{ marginTop: 10, marginBottom: 0 }}
      >
        PACKING RESULT
      </h3>
      <table className="w-full border-collapse border border-black">
        <tbody>
          <tr>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              PART NAME
              <br />
              {en.partName}
            </td>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              Date of Packing (Plan)
              <br />
              {en.packingDatePlan}
              <br />
              Date of Packing (Actual)
              <br />
              {en.packingDateActual}
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              CASE NO.
              <br />
              {en.caseNo}
            </td>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              TOTAL QTY/Case
              <br />
              {en.totalQtyCase}
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              ORDER NO.
              <br />
              {en.orderNo}
            </td>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              DESTINATION
              <br />
              {en.destination}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse mt-2.5 border border-black">
        <tbody>
          <tr>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              PACKED BY:
              <br />
              {en.packedBy}
            </td>
            <td style={{ border: "1px solid black", padding: "5px" }}>
              CHECKED BY:
              <br />
              {en.checkedBy}
            </td>
            <td style={{ border: "1px solid black", padding: "5px" }}>SALES PLANNING</td>
            <td style={{ border: "1px solid black", padding: "5px" }}>{en.caseNoFooter}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  const handlePrint = () => {
    if (!entry) return
    const printWindow = window.open(
      "",
      "_blank",
      `left=0,top=0,width=${screen.availWidth},height=${screen.availHeight},scrollbars=yes`,
    )
    if (!printWindow) return
    const date = new Date().toISOString().slice(0, 10)
    const doc = printWindow.document
    doc.write(`<html><head><title>NXPERT_EON-Pallet_Loading-${date}</title><style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid black; padding: 8px; }
      th { background-color: #f2f2f2; font-weight: bold; }
      .print-page { page-break-after: always; margin-bottom: 20px; }
      h3 { text-align: center; background: black; color: white; padding: 5px; margin: 0; }
      .ptag h3 { text-align: center; background: black; color: white; padding: 5px; margin: 0; }
    </style></head><body></body></html>`)
    let html = ""
    entries.forEach((en) => {
      html += `
      <div class="print-page">
        <div style="text-align:right;margin-bottom:10px;">
          ${en.qrCode.startsWith("data:image") ? `<img src="${en.qrCode}" alt="QR" style="width:50px;height:50px;" />` : ""}<br/>${en.palletId}
        </div>
        <h3>PACKING LIST</h3>
        <table>
          <tr><td colspan="2" style="border:1px solid black;padding:5px;">INVOICE NO. ${en.invoiceNo}</td><td colspan="2" style="border:1px solid black;padding:5px;">PO NO. ${en.poNumber}</td></tr>
          <tr><td style="border:1px solid black;padding:5px;">CASE NO.<br/>${en.caseNo}</td><td style="border:1px solid black;padding:5px;">PART NO./DESCRIPTION<br/>${en.partNo} / ${en.description}</td><td style="border:1px solid black;padding:5px;">BOX NO.<br/>${en.boxNo}</td><td style="border:1px solid black;padding:5px;">TOTAL QTY/CASE<br/>${en.totalQtyCase}</td></tr>
        </table>
        <h3>PACKING RESULT</h3>
        <table>
          <tr><td style="border:1px solid black;padding:5px;">PART NAME<br/>${en.partName}</td><td style="border:1px solid black;padding:5px;">Date of Packing (Plan)<br/>${en.packingDatePlan}<br/>Date of Packing (Actual)<br/>${en.packingDateActual}</td></tr>
          <tr><td style="border:1px solid black;padding:5px;">CASE NO.<br/>${en.caseNo}</td><td style="border:1px solid black;padding:5px;">TOTAL QTY/Case<br/>${en.totalQtyCase}</td></tr>
          <tr><td style="border:1px solid black;padding:5px;">ORDER NO.<br/>${en.orderNo}</td><td style="border:1px solid black;padding:5px;">DESTINATION<br/>${en.destination}</td></tr>
        </table>
        <table style="margin-top:10px;">
          <tr><td style="border:1px solid black;padding:5px;">PACKED BY:<br/>${en.packedBy}</td><td style="border:1px solid black;padding:5px;">CHECKED BY:<br/>${en.checkedBy}</td><td style="border:1px solid black;padding:5px;">SALES PLANNING</td><td style="border:1px solid black;padding:5px;">${en.caseNoFooter}</td></tr>
        </table>
      </div>
      <div class="print-page" style="font-family:Arial;text-align:center;border:2px solid black;">
        <div style="font-weight:bold;border-bottom:1px solid black;text-align:left;padding:5px;"><span style="font-size:30px;">ISUZU ENGINE MANUFACTURING CO., (THAILAND) LTD.</span></div>
        <div style="text-align:left;border-bottom:1px solid black;padding:5px;"><span style="font-size:20px;"><i>PARTS FOR ISUZU ENGINE</i></span></div>
        <div style="text-align:left;padding:5px;"><span style="font-size:20px;">CASE NO.:</span></div>
        <div style="text-align:left;padding:5px;"><span style="font-size:35px;">${en.caseNo}</span></div>
        <div style="text-align:left;padding:5px;font-size:20px;">PART NO.: ${en.partNo}</div>
        <div style="text-align:left;padding:5px;font-size:20px;">PART NAME: ${en.partName}</div>
        <div style="text-align:left;padding:5px;font-size:20px;">ORDER NO.: ${en.orderNo}</div>
        <div style="text-align:left;padding:5px;font-size:20px;">QUANTITY: ${en.totalQtyCase}</div>
        <div style="text-align:left;padding:5px;font-size:20px;">G/WEIGHT: ${en.weight}</div>
        <div style="text-align:left;border-top:1px solid black;padding:10px;font-size:20px;">PACKING DATE: ${en.packingDateActual}</div>
        <div style="font-weight:bold;font-size:30px;background:black;color:white;padding:5px;border-top:1px solid black;">MADE IN THE PHILIPPINES</div>
      </div>`
    })
    doc.body.innerHTML = html
    printWindow.document.close()
    printWindow.focus()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        hideDefaultClose
        className="sm:max-w-[760px] rounded-3xl p-0 gap-0 overflow-hidden border-border/60"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#005B96]/10">
              <Printer className="h-4 w-4 text-[#005B96]" />
            </div>
            <DialogTitle className="text-base font-semibold">Print</DialogTitle>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Printing {currentIndex + 1} of {total}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-border/40"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 relative flex-1 overflow-y-auto">
          {entry ? (
            <>
              {total > 1 && (
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="absolute left-1 top-1/2 -translate-y-1/2 bg-none border-none text-2xl text-primary cursor-pointer hover:text-primary/70 disabled:opacity-30"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              {total > 1 && (
                <button
                  onClick={() => setCurrentIndex(Math.min(total - 1, currentIndex + 1))}
                  disabled={currentIndex === total - 1}
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-none border-none text-2xl text-primary cursor-pointer hover:text-primary/70 disabled:opacity-30"
                  aria-label="Next"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}

              <div className="mx-6 rounded-xl border border-border/40 bg-white p-5 text-sm text-black">
                {renderPackingList(entry)}
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No print entries.</p>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border/60 shrink-0">
          <Button variant="outline" onClick={onClose} className="h-10">
            Close
          </Button>
          <Button onClick={handlePrint} className="h-10 bg-[#005B96] hover:bg-[#005B96]/90">
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}