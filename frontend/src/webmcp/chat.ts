import { getTokens } from "@/lib/tokenStorage";
import type { ChatPageState, IntentEntities } from "./context";

/**
 * /chat client (Step 4 contract consumed by Step 5).
 *
 * The Authorization header is forwarded so the orchestrator can call Express
 * `read` tools under the logged-in user's permissions.
 */

export type ToolCallStatus = "pending" | "done" | "error" | "clarify" | "blocked";

export interface ChatToolCall {
  tool: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
}

export interface ChatResponse {
  intent: string;
  entities: IntentEntities;
  confidence: number | null;
  routing?: { model?: string; reason?: string };
  reply: string;
  toolCalls: ChatToolCall[];
}

export async function fetchChat(
  message: string,
  ctx: ChatPageState,
  executed: string[] = [],
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const { token } = getTokens();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/laya-api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ state: { ...ctx, message }, executed }),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`chat request failed (${res.status}) ${detail}`);
  }
  return (await res.json()) as ChatResponse;
}
