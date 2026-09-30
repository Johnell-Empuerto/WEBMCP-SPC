// Display-only status mapping.
//
// The database stores the value "A" for an Active record. This is NEVER
// changed anywhere in the data flow — this module only maps the raw value to
// a friendly UI label and badge styling during rendering.

export const ACTIVE_STATUS = "A"

export const ACTIVE_STATUS_BADGE =
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"

export function isActiveStatus(value?: string | null): boolean {
  return ((value ?? "").trim().toUpperCase()) === ACTIVE_STATUS
}

// Maps a raw status value to the label shown in the UI. Unknown / empty
// values are returned unchanged so they are never silently converted.
export function getStatusLabel(value?: string | null): string {
  const raw = (value ?? "").trim()
  if (!raw) return "—"
  return isActiveStatus(raw) ? "Active" : raw
}

// Neutral fallback for statuses that have no established visual treatment.
export const DEFAULT_STATUS_BADGE =
  "bg-muted text-muted-foreground"