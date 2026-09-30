import { z } from "zod";

/**
 * WebMCP tool registry — the single authoritative contract between
 * Laya / Qwen and the NXPERT application.
 *
 * Rules:
 *  - Qwen may ONLY select tools listed here (never invented names).
 *  - `type` decides who executes the tool:
 *      read  → orchestrator calls Express (server-side, JWT required)
 *      ui    → browser executor drives React state / router
 *      write → browser executor runs fill/validate, then asks for
 *              user confirmation before calling Express
 *  - Adding a tool here is the first step of adding a capability
 *    (registry → Laya intent → prompt → executor).
 */

export type ToolType = "read" | "ui" | "write";
export type ToolStatus = "live" | "planned";

export interface ToolEndpoint {
  method: "GET" | "POST";
  path: string;
}

export interface WebMcpTool {
  /** Unique tool name — this exact string is what Qwen must output. */
  name: string;
  type: ToolType;
  /** One line shown to the LLM — be specific, no marketing words. */
  description: string;
  /** Zod schema used to validate args before execution. */
  schema: z.ZodTypeAny;
  /** Where a `read`/`write` tool is executed. Missing for pure `ui` tools. */
  endpoint?: ToolEndpoint;
  /** `planned` = contract defined, endpoint not wired yet (Phase 4). */
  status?: ToolStatus;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD");

/* ═══ Seed slice: Navigation + DPR + NG (Phase 0–3) ═══════════════════════ */

export const TOOLS: WebMcpTool[] = [
  {
    name: "navigateToDPR",
    type: "ui",
    description:
      "Open the DPR page. Args: line = which DPR line to open ('adc' | 'c4' | 'kd', default 'adc').",
    schema: z.object({
      line: z.enum(["adc", "c4", "kd"]).optional(),
    }),
    status: "live",
  },
  {
    name: "setDPRFilters",
    type: "ui",
    description:
      "Set DPR filter fields on the open DPR page. Only pass fields the user specified; other filters stay unchanged.",
    schema: z.object({
      model: z.string().max(50).optional(),
      date: isoDate.optional(),
      shift: z.string().max(20).optional(),
      partName: z.string().max(100).optional(),
      dieNo: z.string().max(50).optional(),
    }),
    status: "live",
  },
  {
    name: "searchDPR",
    type: "ui",
    description:
      "Reload DPR data on the open page using the current filters. Run after navigateToDPR / setDPRFilters.",
    schema: z.object({}),
    status: "live",
  },
  {
    name: "getDPRActuals",
    type: "read",
    description:
      "Fetch DPR production actuals for a date (optionally filtered by model). Returns rows with model and actual quantities.",
    schema: z.object({
      date: isoDate,
      model: z.string().max(50).optional(),
    }),
    endpoint: { method: "POST", path: "/api/dpr-adc/data" },
    status: "live",
  },
  {
    name: "getDPRSummary",
    type: "read",
    description:
      "Fetch aggregated DPR totals for a date: total actual, total plan, and per-model breakdown.",
    schema: z.object({
      date: isoDate,
    }),
    endpoint: { method: "POST", path: "/api/dpr-adc/summary" },
    status: "planned",
  },
  {
    name: "getNGSummary",
    type: "read",
    description:
      "Fetch NG (defect) totals grouped by model for a date. Used to answer 'which model has the most NG'.",
    schema: z.object({
      date: isoDate,
      process: z.string().max(50).optional(),
    }),
    endpoint: { method: "POST", path: "/api/ng-report/summary" },
    status: "planned",
  },
];

/* ═══ Registry helpers ════════════════════════════════════════════════════ */

const byName = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): WebMcpTool | undefined {
  return byName.get(name);
}

export function isRegisteredTool(name: string): boolean {
  return byName.has(name);
}

export function toolNames(): string[] {
  return TOOLS.map((t) => t.name);
}

/** Validate args for a tool. Throws zod error if invalid. */
export function parseToolArgs(name: string, args: unknown): unknown {
  const tool = getTool(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.schema.parse(args ?? {});
}

/**
 * Render the registry as a compact prompt block for Qwen.
 * Keep this small — the 0.6B model has a limited context.
 */
export function formatRegistryForPrompt(): string {
  return TOOLS.map((tool) => {
    const params = describeParams(tool.schema);
    return `- ${tool.name}(${params}) [${tool.type}]: ${tool.description}`;
  }).join("\n");
}

function describeParams(schema: z.ZodTypeAny): string {
  if (!(schema instanceof z.ZodObject)) return "";
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  return Object.entries(shape)
    .map(([key, value]) => {
      const optional = value instanceof z.ZodOptional;
      const inner = optional ? (value as z.ZodOptional<z.ZodTypeAny>).unwrap() : value;
      const type = zTypeLabel(inner);
      return optional ? `${key}?: ${type}` : `${key}: ${type}`;
    })
    .join(", ");
}

function zTypeLabel(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodDate) return "date";
  if (schema instanceof z.ZodEnum) return schema.options.join("|");
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  return "unknown";
}
