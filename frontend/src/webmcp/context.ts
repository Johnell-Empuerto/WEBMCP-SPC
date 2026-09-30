import { useLocation } from "react-router-dom";

/**
 * Chat context + Laya intent client (Step 2 of the WebMCP plan).
 *
 * Every chat message is sent to POST /laya-api/intent together with what the
 * user is looking at right now (page, selected date, filters). Laya answers
 * with a typed intent + entities — the orchestrator (Step 4) feeds that to
 * Qwen for tool selection.
 */

/**
 * Pending clarification state: what the assistant still needs before it can
 * run a tool. Small on purpose — just the tool and the missing field, e.g.
 * after "Which DPR do you want to open, ADC or C4?" the next message is the
 * missing `line` value. Cleared as soon as it is answered (one-shot).
 */
export interface PendingAction {
  tool: "navigateToDPR";
  missing: "line";
  /** Future: resume payload (e.g. a paused dpr_search) after the answer. */
  [key: string]: unknown;
}

/** Type guard for `toolCalls[].args.pendingAction` coming back from /chat. */
export function isPendingAction(v: unknown): v is PendingAction {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { tool?: unknown }).tool === "string" &&
    typeof (v as { missing?: unknown }).missing === "string"
  );
}

export interface ChatPageState {
  /** Current route without leading slash, e.g. "dpr-adc", "plan-uploader". */
  page: string;
  /** ISO date (YYYY-MM-DD) the user has selected, default = today. */
  date: string;
  /** Filters currently applied on the page (wired per-page in Step 5). */
  filters: Record<string, string>;
  /**
   * Clarify state from the previous assistant turn
   * (toolCalls[].args.pendingAction) — sent back with the NEXT message so
   * the server can resolve it as the missing tool argument instead of
   * classifying the answer as a brand-new request.
   */
  pendingAction?: PendingAction | null;
}

export interface IntentEntities {
  date_hint: "today" | "yesterday" | "tomorrow" | "explicit" | "not_specified";
  date: string | null;
  line: "adc" | "c4" | "kd" | "not_specified";
  shift: "1" | "2" | "3" | "not_specified";
  /** Product/model code from the message ("model 500" -> "500"). */
  model: string;
}

export interface IntentResult {
  intent: string;
  entities: IntentEntities;
  confidence: number | null;
  state: { page: string | null; filters: Record<string, string> };
  routing?: { model?: string; reason?: string };
}

export function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function useChatContext(): ChatPageState {
  const { pathname } = useLocation();
  const page = pathname.replace(/^\//, "").replace(/\/$/, "") || "home";
  return { page, date: todayISO(), filters: {} };
}

export async function fetchIntent(
  message: string,
  ctx: ChatPageState,
  signal?: AbortSignal
): Promise<IntentResult> {
  const res = await fetch("/laya-api/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: { ...ctx, message } }),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`intent request failed (${res.status}) ${detail}`);
  }
  return (await res.json()) as IntentResult;
}
