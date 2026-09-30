/**
 * Model resolution for WebMCP tool args (Step 5b).
 *
 * Match order (deliberately strict — never silently broaden the query):
 *   1. exact part code (option value)
 *   2. exact model name (option name/label, case-insensitive)
 *   3. no match → error listing the available models
 *
 * No alias table: aliases are only added once confirmed against
 * T_ProductMaster / legacy EON — never invented to satisfy a test phrase.
 */

export interface ModelOption {
  value: string;
  name?: string;
  label?: string;
}

export type ModelResolution = { value: string } | { error: string };

function displayName(m: ModelOption): string {
  return m.name ?? m.label ?? m.value;
}

export function resolveModel(
  raw: string,
  models: readonly ModelOption[],
): ModelResolution {
  const v = raw.trim();
  if (!v) return { error: "Empty model value." };

  // "all models" / "every model" → the page's no-filter sentinel.
  if (["all", "every", "everything"].includes(v.toLowerCase())) {
    return { value: "all" };
  }

  const byValue = models.find((m) => m.value === v);
  if (byValue) return { value: byValue.value };

  const lower = v.toLowerCase();
  const byName = models.find((m) => displayName(m).toLowerCase() === lower);
  if (byName) return { value: byName.value };

  return {
    error: `Unknown model '${v}'. Available models: ${models
      .map(displayName)
      .join(", ")}.`,
  };
}
