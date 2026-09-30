"""WebMCP tool registry — Python side of the contract.

MUST stay in sync with `frontend/src/webmcp/registry.ts` (Step 1).
The frontend registry drives the executor; this copy drives the Qwen prompt.
Adding a tool = update BOTH files, then Laya intent, then executor.
"""

from typing import Any, Dict, List

TOOLS: List[Dict[str, str]] = [
    {
        "name": "navigateToDPR",
        "type": "ui",
        "description": "Open the DPR page",
        "args": "line?: adc|c4|kd (default adc)",
    },
    {
        "name": "setDPRFilters",
        "type": "ui",
        "description": "Set DPR filters on the open page; only include fields the user named",
        "args": "model?, date?(YYYY-MM-DD), shift?, partName?, dieNo?",
    },
    {
        "name": "searchDPR",
        "type": "ui",
        "description": "Reload DPR data using current filters (run after navigate/filters)",
        "args": "",
    },
    {
        "name": "getDPRActuals",
        "type": "read",
        "description": "Fetch DPR production actuals for a date",
        "args": "date(YYYY-MM-DD), model?",
    },
    {
        "name": "getDPRSummary",
        "type": "read",
        "description": "Aggregated DPR totals for a date",
        "args": "date(YYYY-MM-DD)",
    },
    {
        "name": "getNGSummary",
        "type": "read",
        "description": "NG defect totals by model for a date",
        "args": "date(YYYY-MM-DD), process?",
    },
]

# Meta "tools" the model may output instead of a registry tool.
#   none    -> no tool needed, answer conversationally
#   clarify -> ask the user a short clarifying question first
META_TOOLS = {
    "none": "answer conversationally, no app action",
    "clarify": "the request is missing required information; ask one short question",
}


def tool_names():
    return [t["name"] for t in TOOLS]


def get_tool(name: str):
    for t in TOOLS:
        if t["name"] == name:
            return t
    return None


def format_registry_for_prompt() -> str:
    lines = [f'- {t["name"]} [{t["type"]}]: {t["description"]}. Args: {t["args"] or "none"}'
             for t in TOOLS]
    lines += [f'- {name} [meta]: {desc}' for name, desc in META_TOOLS.items()]
    return "\n".join(lines)


def validate_choice(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Raise ValueError if the model output is not an allowed tool call."""
    tool = payload.get("tool")
    if not isinstance(tool, str):
        raise ValueError("missing 'tool'")
    if tool not in tool_names() and tool not in META_TOOLS:
        raise ValueError(f"unknown tool {tool!r}")
    args = payload.get("args", {})
    if args is None:
        args = {}
    if not isinstance(args, dict):
        raise ValueError("'args' must be an object")
    return {"tool": tool, "args": args}
