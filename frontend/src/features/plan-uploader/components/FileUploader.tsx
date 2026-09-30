import { useState, useRef, useCallback } from "react"
import { Upload, X, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploaderProps {
  onFileSelect: (file: File, base64: string) => void
  disabled?: boolean
  acceptedFile?: string
}

export default function FileUploader({
  onFileSelect,
  disabled = false,
  acceptedFile = ".xlsx,.xls",
}: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndRead = useCallback(
    (file: File) => {
      setError(null)

      const validExtensions = [".xlsx", ".xls"]
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()

      if (!validExtensions.includes(ext)) {
        setError("Invalid file type. Please upload an .xlsx or .xls file.")
        return
      }

      setSelectedFile(file)

      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1]
        onFileSelect(file, base64)
      }
      reader.onerror = () => {
        setError("Failed to read file. Please try again.")
      }
      reader.readAsDataURL(file)
    },
    [onFileSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = e.dataTransfer.files
      if (files.length > 0) {
        validateAndRead(files[0])
      }
    },
    [validateAndRead],
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      validateAndRead(files[0])
    }
  }

  const handleRemove = () => {
    setSelectedFile(null)
    setError(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary shrink-0">
          <Upload className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Upload File</span>
      </div>

      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all duration-200",
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : selectedFile
              ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/20",
          disabled && "opacity-50 pointer-events-none",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !selectedFile && !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedFile}
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled}
        />

        {selectedFile ? (
          <div className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove()
              }}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 px-4 cursor-pointer">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary mb-2">
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Drop your Excel file here, or <span className="text-primary">browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Supports .xlsx and .xls files</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
