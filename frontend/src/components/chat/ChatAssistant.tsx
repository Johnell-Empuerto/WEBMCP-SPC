import { useState, type FormEvent } from "react";
import {
  Bot,
  Send,
  Sparkles,
  X,
  MessageCircle,
  Paperclip,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: number;
  from: "bot" | "user";
  text: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    from: "bot",
    text: "Hi! I'm the NXPERT EON assistant. How can I help you today?",
  },
];

const QUICK_REPLIES = [
  "Today's production",
  "Plan vs actual",
  "DPR summary",
  "NG report",
];

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // UI only — no backend call yet.
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "user", text: input.trim() },
    ]);
    setInput("");
  };

  return (
    <>
      {/* ═══ Floating action button ═══ */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat assistant" : "Open chat assistant"}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white",
          "bg-gradient-to-br from-primary to-secondary shadow-lg transition-all duration-200",
          "hover:scale-105 hover:shadow-xl active:scale-95",
        )}
      >
        <span className="relative">
          {open ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </span>
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-secondary" />
        )}
      </button>

      {/* ═══ Chat window ═══ */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden",
            "w-[calc(100vw-3rem)] max-w-lg h-[600px] max-h-[calc(100vh-8rem)]",
            "rounded-2xl border bg-background shadow-popover animate-in fade-in duration-200",
          )}
        >
          {/* Header */}
          <div className="relative flex items-center gap-3 bg-gradient-to-r from-primary to-secondary px-4 py-3.5 text-primary-foreground">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Bot className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                NXPERT EON Assistant
                <Sparkles className="h-3.5 w-3.5 opacity-80" />
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 p-4 mpr-scroll">
            <p className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Today
            </p>

            {messages.map((msg) =>
              msg.from === "bot" ? (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[75%] rounded-2xl rounded-tl-sm border bg-background px-3.5 py-2.5 text-sm leading-relaxed shadow-card">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div
                  key={msg.id}
                  className="flex items-start justify-end gap-2.5"
                >
                  <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-card">
                    {msg.text}
                  </div>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <User className="h-4 w-4" />
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Quick replies */}
          <div className="flex flex-wrap gap-2 border-t bg-background px-4 py-3">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                type="button"
                className="rounded-full border border-primary/30 bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t bg-background px-3 py-3"
          >
            <button
              type="button"
              aria-label="Attach file"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about production, DPR, MPR…"
              className="h-10 flex-1 rounded-lg border border-input bg-muted/40 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label="Send message"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary hover:opacity-90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
