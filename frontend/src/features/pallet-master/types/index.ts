// ════════════════════════════════════════════════════════════════════════════
// PALLET MASTER — TYPES
// ════════════════════════════════════════════════════════════════════════════
// The field names match the legacy PalletMasterController.js / Node-RED
// payloads (getPalletMaster24 / getPalletMasterWithPara24 / addPalletMaster24 /
// updatePalletMaster24 / checkifCodeExists24), so the backend can reproduce
// the exact SQL semantics.

// Filter used by the list endpoint (legacy getPalletMasterWithPara24 params).
export interface PalletMasterFilter {
  size: number
  pageno: number
  search?: string
  category?: string
  status?: string
}

// One row from the list endpoint (E_PalletMaster).
export interface PalletMasterRow {
  Ptm_PalletCode: string
  Ptm_PalletDesc: string
  Ptm_PalletColor: string
  Ptm_Category: string
  Ptm_Status: string
  user_Login: string
  ludatetime: string
  selected: boolean
}

// The payload the add call sends (legacy addPalletMaster24 query params).
export interface AddPalletPayload {
  palletcode: string
  desc?: string
  color?: string
  category?: string
  status?: string
  userlogin?: string
}

// The payload the update call sends (adds the immutable Pallet Code key).
export interface UpdatePalletPayload extends AddPalletPayload {
  palletcode: string
}