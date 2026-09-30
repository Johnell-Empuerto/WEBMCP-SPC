import { usePageTitle } from "@/hooks/usePageTitle";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GuideExample {
  /** The exact phrase to type into the assistant. */
  text: string;
  /** Where it takes effect, shown right-aligned. */
  hint: string;
}

interface GuideSection {
  icon: string;
  title: string;
  examples: GuideExample[];
}

const SECTIONS: GuideSection[] = [
  {
    icon: "🧭",
    title: "Navigation",
    examples: [
      { text: "Open DPR ADC", hint: "/mpr-adc" },
      { text: "Open DPR C4", hint: "/mpr-c4" },
      { text: "Go to DPR", hint: "asks which line" },
    ],
  },
  {
    icon: "📊",
    title: "DPR Data",
    examples: [
      { text: "Load data for February", hint: "on this page" },
      { text: "Load ES01 for July", hint: "on this page" },
      { text: "Load all models for July", hint: "on this page" },
    ],
  },
];

export default function McpGuidePage() {
  usePageTitle("MCP Guide");
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="-ml-2 mb-4"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back
      </Button>

      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            NXPERT EON MCP Guide
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Learn what you can ask the NXPERT assistant to do.
          </p>
        </div>
      </div>

      <div className="my-6 border-t" />

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <span>{section.icon}</span>
              {section.title}
            </h2>
            <ul className="mt-3 space-y-2">
              {section.examples.map((ex) => (
                <li
                  key={ex.text}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-card"
                >
                  <span className="text-muted-foreground">•</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[13px]">
                    {ex.text}
                  </code>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {ex.hint}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 rounded-lg border border-dashed px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Spelling mistakes are fine — “load data from febuary” still finds
        February. You don’t need to say “DPR” either: whatever page you’re on
        tells the assistant where to work.
      </p>
    </div>
  );
}
