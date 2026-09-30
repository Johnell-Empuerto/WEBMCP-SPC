import { getTool, parseToolArgs } from "./registry";

/**
 * WebMCP frontend executor (Step 5).
 *
 * Contract:
 *   tool name (registry) → executor → registered frontend handler
 *
 * - The orchestrator returns `ui` toolCalls as `pending`; the browser runs
 *   them here, then re-POSTs /chat with `executed=[...toolNames]`.
 * - `read` tools never reach this executor (they run server-side with JWT).
 * - Pages/features register their handlers with `registerToolHandler`
 *   (e.g. the DPR page registers setDPRFilters / searchDPR).
 * - Args are validated against the registry's zod schema BEFORE the handler
 *   runs — a handler never sees invalid input.
 */

export type ToolHandler = (args: Record<string, unknown>) => void | Promise<void>;

export interface ToolExecutionResult {
  tool: string;
  status: "done" | "error";
  error?: string;
}

const handlers = new Map<string, ToolHandler>();

/** Register the frontend function that executes a ui/write tool. */
export function registerToolHandler(name: string, handler: ToolHandler): void {
  const tool = getTool(name);
  if (!tool) throw new Error(`Cannot register handler for unknown tool: ${name}`);
  if (tool.type === "read") {
    throw new Error(`read tool "${name}" executes server-side, not in the browser`);
  }
  handlers.set(name, handler);
}

export function unregisterToolHandler(name: string): void {
  handlers.delete(name);
}

export function hasToolHandler(name: string): boolean {
  return handlers.has(name);
}

/**
 * Execute one toolCall from /chat. Never throws — always returns
 * {status: "done"} or {status: "error", error} so the chat loop can decide
 * whether to add the tool to `executed` and continue the chain.
 */
export async function executeToolCall(
  toolName: string,
  rawArgs?: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const tool = getTool(toolName);
  if (!tool) {
    return { tool: toolName, status: "error", error: `unknown tool: ${toolName}` };
  }
  if (tool.type === "read") {
    return { tool: toolName, status: "error", error: `"${toolName}" runs server-side` };
  }

  let args: unknown;
  try {
    args = parseToolArgs(toolName, rawArgs ?? {});
  } catch (err) {
    return {
      tool: toolName,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const handler = handlers.get(toolName);
  if (!handler) {
    return {
      tool: toolName,
      status: "error",
      error: `no handler registered for "${toolName}" yet`,
    };
  }

  try {
    await handler(args as Record<string, unknown>);
    return { tool: toolName, status: "done" };
  } catch (err) {
    return {
      tool: toolName,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
