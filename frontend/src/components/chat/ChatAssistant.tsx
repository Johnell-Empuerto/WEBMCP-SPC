import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useChatContext,
  isPendingAction,
  type PendingAction,
} from "@/webmcp/context";
import { fetchChat } from "@/webmcp/chat";
import { getTool } from "@/webmcp/registry";
import {
  executeToolCall,
  registerToolHandler,
  unregisterToolHandler,
} from "@/webmcp/executor";

/** One line of MCP activity, e.g. "✓ setDPRFilters / date: 2026-07". */
interface ToolStep {
  name: string;
  args?: Record<string, unknown>;
  status: "done" | "error";
  error?: string;
}

interface ChatMessage {
  id: number;
  from: "bot" | "user" | "mcp";
  text: string;
  steps?: ToolStep[];
}

/**
 * Panel lifecycle. Send ≠ UI execution:
 *
 *   "closed"     → FAB only, panel off-screen
 *   "open"       → visible — stays visible while the AI thinks, and STAYS
 *                  OPEN after a UI action (success ✓ or failure ✗) until
 *                  the user closes it manually
 *   "executing"  → collapsed ONLY because /chat returned executable ui
 *                  toolCalls and the browser is running them right now
 *
 * executing → open is the only post-execution transition; nothing
 * auto-closes the panel.
 */
type McpState = "closed" | "open" | "executing";

/** Clean result line for the pop-open (matches the MCP flow spec). */
function successMessage(executed: string[], navLine: string | null): string {
  if (executed.includes("searchDPR")) return "✓ Data loaded successfully";
  if (executed.includes("setDPRFilters")) return "✓ Filters applied";
  if (executed.includes("navigateToDPR"))
    return `✓ Opened DPR ${(navLine ?? "adc").toUpperCase()}`;
  return "✓ Done";
}

export default function ChatAssistant() {
  const [mcpState, setMcpState] = useState<McpState>("closed");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Clarify state from the last reply (e.g. {tool:"navigateToDPR",
  // missing:"line"}); sent back with the NEXT message so the server can
  // resolve it as the missing tool argument. One-shot: cleared on send and
  // re-set only if the server asks again.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const navigate = useNavigate();
  const ctx = useChatContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  const panelVisible = mcpState === "open";

  const openPanel = () => setMcpState("open");
  const closePanel = () => setMcpState("closed");

  // App-level WebMCP controller: navigateToDPR (line adc|c4|kd → /mpr-*,
  // the pages the sidebar shows as "DPR (ADC)"/"DPR (C4)").
  // DPR-owned tools (setDPRFilters, searchDPR) register from the MPR page.
  useEffect(() => {
    registerToolHandler("navigateToDPR", (args) => {
      const line =
        typeof args.line === "string" && args.line ? args.line : "adc";
      navigate(`/mpr-${line}`);
    });
    return () => unregisterToolHandler("navigateToDPR");
  }, [navigate]);

  // Keep the newest message / tool step in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, mcpState, busy]);

  const pushBot = (text: string) =>
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), from: "bot", text },
    ]);

  // ── Single-owner lifecycle for a UI action ──────────────────────────────
  // Both outcomes land on "open" and STAY there — the panel pops back with
  // the result and only the user's × (or Guide) closes it. No timers, no
  // auto-close. Messages never control visibility.
  const completeUiAction = (done: string[], navLine: string | null) => {
    pushBot(successMessage(done, navLine));
    setMcpState("open");
  };

  const failUiAction = () => setMcpState("open");

  const send = async (text: string) => {
    if (busy) return;
    // Send ≠ UI execution. Nothing collapses here — the panel STAYS OPEN
    // while Laya/Qwen think (the thinking bubble below shows the wait).
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), from: "user", text },
    ]);
    setBusy(true);

    let collapsed = false; // did THIS command reach the executing state?
    let anyFailed = false;
    let navLine: string | null = null;
    try {
      // One-shot conversation state: the pending clarify applies to this
      // message only (the response may re-ask with a fresh one).
      const sendCtx = { ...ctx, pendingAction };
      setPendingAction(null);

      // One MCP activity block per command, appended to as steps run.
      const mcpId = Date.now() + Math.random();
      const appendSteps = (newSteps: ToolStep[]) =>
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === mcpId);
          if (idx === -1) {
            return [
              ...prev,
              { id: mcpId, from: "mcp", text: "", steps: newSteps },
            ];
          }
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            steps: [...(copy[idx].steps ?? []), ...newSteps],
          };
          return copy;
        });

      // Chain: /chat → run pending ui tools → /chat with executed=[...] …
      // (orchestrator caps the chain at 3 steps server-side).
      const executed: string[] = [];
      for (let round = 0; round < 3; round++) {
        const res = await fetchChat(text, sendCtx, executed);
        const pendingCalls = res.toolCalls.filter(
          (t) => t.status === "pending",
        );

        // Conversational replies only (clarify questions, data answers).
        // UI-step announcements are replaced by the MCP activity block.
        if (res.reply && pendingCalls.length === 0) pushBot(res.reply);

        const clarifyTc = res.toolCalls.find((t) => t.status === "clarify");
        if (clarifyTc) {
          const pa = clarifyTc.args.pendingAction;
          if (isPendingAction(pa)) setPendingAction(pa);
        }

        // No executable tool → normal chat / clarification / error:
        // the panel just stays open. Collapse is triggered ONLY when an
        // actual ui toolCall is waiting — after /chat has returned it —
        // never at send.
        if (pendingCalls.length === 0) break;
        const hasUiTool = pendingCalls.some(
          (t) => getTool(t.tool)?.type === "ui",
        );
        if (hasUiTool && !collapsed) {
          setMcpState("executing");
          collapsed = true;
        }

        const roundSteps: ToolStep[] = [];
        let progressed = false;
        for (const tc of pendingCalls) {
          if (tc.tool === "navigateToDPR") {
            const l = tc.args?.line;
            navLine = typeof l === "string" && l ? l : "adc";
          }
          const result = await executeToolCall(tc.tool, tc.args);
          if (result.status === "done") {
            executed.push(tc.tool);
            progressed = true;
            roundSteps.push({ name: tc.tool, args: tc.args, status: "done" });
          } else {
            anyFailed = true;
            roundSteps.push({
              name: tc.tool,
              args: tc.args,
              status: "error",
              error: result.error,
            });
          }
        }
        appendSteps(roundSteps);
        if (!progressed) break;
      }

      if (collapsed) {
        if (anyFailed) failUiAction(); // → open, stays open with the ✗
        else completeUiAction(executed, navLine); // → open, stays with the ✓
      }
    } catch (err) {
      pushBot(
        err instanceof Error
          ? err.message
          : "Something went wrong talking to the assistant.",
      );
      if (collapsed) failUiAction(); // reopen so the error is visible
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    void send(text);
  };

  const goGuide = () => {
    closePanel();
    navigate("/mcp-guide");
  };

  return (
    <>
      {/* ═══ Floating action button — ONLY in "closed". Hidden during
          "executing" so nothing can transition the panel from outside while
          a UI action runs; afterwards it comes back to "open" and the user
          closes it manually. */}
      {mcpState === "closed" && (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Open NXPERT EON MCP"
          className={cn(
            "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white",
            "bg-gradient-to-br from-primary to-secondary shadow-lg transition-all duration-200",
            "hover:scale-105 hover:shadow-xl active:scale-95",
            "animate-in fade-in-0 duration-200",
          )}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* ═══ MCP panel (right side) — chat, conversation, Guide link ═══ */}
      <aside
        inert={!panelVisible}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l bg-background",
          "sm:w-[380px] sm:shadow-2xl",
          "transition-transform duration-200 ease-out",
          panelVisible
            ? "translate-x-0"
            : "pointer-events-none translate-x-full",
        )}
      >
        {/* Header: title + Guide pill + close */}
        <div className="flex items-center justify-between bg-gradient-to-r from-primary to-secondary px-4 py-3 text-primary-foreground">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" />
            NXPERT EON MCP
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goGuide}
              className="rounded-full border border-white/40 bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold transition-colors hover:bg-white/30"
            >
              Guide
            </button>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close MCP panel"
              className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Conversation */}
        <div
          ref={scrollRef}
          className="mpr-scroll flex-1 space-y-3 overflow-y-auto px-4 py-3"
        >
          {messages.length === 0 && !busy && (
            <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
              What can I help you with?
            </p>
          )}

          {messages.map((msg) =>
            msg.from === "user" ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%]">
                  <p className="mb-1 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    You
                  </p>
                  <div className="rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground shadow-card">
                    {msg.text}
                  </div>
                </div>
              </div>
            ) : msg.from === "mcp" ? (
              <div
                key={msg.id}
                className="rounded-xl border bg-muted/40 px-3 py-2.5 shadow-card"
              >
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  NXPERT MCP
                </p>
                <ul className="space-y-1.5 font-mono text-xs">
                  {msg.steps?.map((s, i) => (
                    <li key={i}>
                      <span
                        className={
                          s.status === "error"
                            ? "text-destructive"
                            : "text-emerald-600"
                        }
                      >
                        {s.status === "error" ? "✗" : "✓"}
                      </span>{" "}
                      {s.name}
                      {s.args && Object.keys(s.args).length > 0 && (
                        <div className="ml-4 whitespace-pre-wrap text-muted-foreground">
                          {Object.entries(s.args)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join("\n")}
                        </div>
                      )}
                      {s.error && (
                        <div className="ml-4 text-destructive">{s.error}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border bg-background px-3.5 py-2 text-sm leading-relaxed shadow-card">
                  {msg.text}
                </div>
              </div>
            ),
          )}

          {/* Thinking bubble — the visible "AI is processing" phase. The
              panel stays open until /chat returns ui toolCalls. */}
          {busy && (
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-sm border bg-background px-4 py-3 shadow-card">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Command */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t bg-background px-3 py-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={busy ? "Working…" : "Ask NXPERT…"}
            aria-label="Command"
            className="h-10 flex-1 rounded-lg border border-input bg-muted/40 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || busy}
            aria-label="Send command"
            className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary hover:opacity-90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </aside>
    </>
  );
}
