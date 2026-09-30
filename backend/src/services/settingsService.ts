import * as repo from '../repositories/settingsRepository';

// ════════════════════════════════════════════════════════════════════════════
// Service layer for Settings.
// Contains business/use-case logic:
//   - Applies the default/allowed-values rules for the session timeout
//   - Decides UPDATE vs INSERT for the stored parameter
// SQL belongs in settingsRepository.ts; HTTP concerns belong in
// settingsController.ts.
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_TIMEOUT_MINUTES = 30;
const ALLOWED_MINUTES = [15, 30, 60, 120, 240, 480];

function readMinutes(raw: unknown): number {
  if (raw == null) return DEFAULT_TIMEOUT_MINUTES;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) && ALLOWED_MINUTES.includes(n) ? n : DEFAULT_TIMEOUT_MINUTES;
}

/** GET — read the configured idle timeout (falls back to 30 when unset/invalid). */
export async function getSessionTimeout(): Promise<number> {
  const raw = await repo.getSessionTimeoutValue();
  return readMinutes(raw);
}

/**
 * PUT — update the idle timeout.
 * Returns a ServiceError (HTTP 400) when the minutes value is not allowed,
 * otherwise persists (UPDATE existing row, or INSERT the first time).
 */
export async function updateSessionTimeout(minutes: number, userLogin: string):
  Promise<{ ok: true; minutes: number } | { ok: false; statusCode: number; message: string; errors: string[] }> {
  if (!ALLOWED_MINUTES.includes(minutes)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid session timeout value',
      errors: [`minutes must be one of: ${ALLOWED_MINUTES.join(', ')}`],
    };
  }

  const exists = (await repo.countSessionTimeout()) > 0;

  if (exists) {
    await repo.updateSessionTimeout(minutes, userLogin);
  } else {
    await repo.insertSessionTimeout(minutes, userLogin);
  }

  return { ok: true, minutes };
}

