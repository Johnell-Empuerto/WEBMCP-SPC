// ════════════════════════════════════════════════════════════════════════════
// DPR MASTER — TYPES
// ════════════════════════════════════════════════════════════════════════════
// The field names match the legacy DprMasterController.js / Node-RED payloads
// (md_Usercode, md_firstname, md_lastname, md_position, md_status) so the
// backend reproduces the exact SQL semantics of the legacy save/update flows.

// The 5 role tabs (legacy nav-tabs: team_leader / group_leader / leadman /
// inspector / line_checker). Values map 1:1 to the whitelist in the backend.
export type DprMasterTab =
  | "team-leader"
  | "group-leader"
  | "leadman"
  | "inspector"
  | "line-checker"

export interface DprMasterTabDef {
  value: DprMasterTab
  label: string
}

export const DPR_MASTER_TABS: DprMasterTabDef[] = [
  { value: "team-leader", label: "Team Leader" },
  { value: "group-leader", label: "Group Leader" },
  { value: "leadman", label: "Leadman" },
  { value: "inspector", label: "Inspector" },
  { value: "line-checker", label: "Line Checker" },
]

export type DprMasterStatus = "A" | "I"

// One row from the list endpoint (legacy select<Role> → table row).
export interface DprMasterRow {
  id: number
  md_Usercode: number
  md_firstname: string
  md_lastname: string
  md_position: string
  md_status: string
}

// Filter used by the list endpoint (modern additions are server-side).
export interface DprMasterFilter {
  size: number
  pageno: number
  search?: string
  // "" | "default" → active only (legacy hides md_status = 'I')
  // "A" | "I"     → explicit status
  // "all"         → everything
  status?: string
  sort?: string
  order?: "asc" | "desc"
}

// The payload the create call sends (legacy save<Role>).
export interface AddDprMasterPayload {
  tab: DprMasterTab
  md_Usercode: number
  md_firstname: string
  md_lastname: string
  md_position: string
  md_status: DprMasterStatus
}

// The payload the update call sends (legacy update<Role>, same fields).
// `id` is the identity/row key so the update targets exactly one row — the
// legacy md_Usercode key created duplicate rows (see T_MasterDprLeadMan).
export interface UpdateDprMasterPayload extends AddDprMasterPayload {
  id: number
}
