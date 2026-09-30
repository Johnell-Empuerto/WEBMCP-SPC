// Service for NG Tagging business/use-case logic.
// Owns the process → defect-category mapping, the tag request validation and
// the SP result interpretation. All SQL lives in the repository; HTTP
// concerns live in the controller.

import * as repo from '../repositories/ngTaggingRepository';

// Map a process code to the defect master category used for the NG Master
// dropdown: '00' Casting(ADC), '01'..'07' Machining(C4), '08' Pallet(KD).
function categoryForProcess(processCode: string): string | null {
  if (!processCode) return null;
  if (processCode === '00') return '1';
  if (processCode >= '01' && processCode <= '07') return '2';
  if (processCode === '08') return '3';
  return null;
}

export interface TagPartInput {
  partsId?: string;
  processCode?: string;
  defectCode?: string;
  userCode?: string;
}

export type TagPartResult =
  | { ok: true }
  | { ok: false; message: string };

// POST /ng-tagging — validate, then run spHandyNGTagging. The exact legacy
// validation order and messages are preserved.
export async function tagPart(input: TagPartInput): Promise<TagPartResult> {
  const partsId = String(input.partsId ?? '').trim();
  let processCode = String(input.processCode ?? '').trim();
  const defectCode = String(input.defectCode ?? '').trim();
  const userCode = String(input.userCode ?? '').trim();

  // Legacy behaviour: pad the process code to 2 digits and clamp.
  if (processCode) {
    processCode = processCode.padStart(2, '0').substring(0, 2);
  }

  if (!partsId) {
    return { ok: false, message: 'Parts ID is required' };
  }
  if (partsId.length > 20) {
    return { ok: false, message: 'Parts ID must be 20 characters or less' };
  }
  if (!processCode) {
    return { ok: false, message: 'Process Code is required' };
  }
  if (!defectCode) {
    return { ok: false, message: 'Defect Code is required' };
  }
  if (!userCode) {
    return { ok: false, message: 'User Code is required' };
  }

  const ok = await repo.tagNg({ partsId, processCode, defectCode, userCode });
  if (!ok) {
    return { ok: false, message: 'Tagging failed: the stored procedure did not succeed' };
  }
  return { ok: true };
}

// GET /ng-tagging/processes — active process codes (thin pass-through).
export function getProcesses() {
  return repo.getProcesses();
}

// GET /ng-tagging/defects — resolve the defect category for the process code.
export async function resolveDefects(processCode: string) {
  const category = categoryForProcess(processCode);
  return repo.getDefects(category ?? undefined);
}

// GET /ng-tagging/lookup — part look-up + existing-NG check.
export async function lookupPart(partsId: string) {
  const row = await repo.lookupPart(partsId);
  const ngCount = await repo.countActiveNg(partsId);
  return { row, ngCount };
}

// GET /ng-tagging — paginated NG history (thin pass-through: all filtering
// and SQL lives in the repository).
export function getHistory(filters: repo.NgHistoryFilters) {
  return repo.getHistory(filters);
}
