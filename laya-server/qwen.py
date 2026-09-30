"""Qwen tool-selection client (Step 3 of the WebMCP plan).

Laya gives us `{intent, entities}`; this module turns that + the user message
into ONE tool call: {"tool": "...", "args": {...}}.

Talks to an OpenAI-compatible llama-server (default http://127.0.0.1:9001).
No third-party HTTP lib — stdlib urllib only.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from tools import format_registry_for_prompt, validate_choice

QWEN_URL = os.getenv("QWEN_URL", "http://127.0.0.1:9001/v1/chat/completions")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen3-0.6b")
QWEN_TIMEOUT = float(os.getenv("QWEN_TIMEOUT", "60"))

# Qwen3 defaults to "thinking" mode; we want a short direct JSON answer.
_THINK_OFF = {"enable_thinking": False}

SYSTEM_PROMPT = f"""You are the tool selector for the NXPERT manufacturing app.

Choose exactly ONE item from the allowed list.

Allowed items:
{format_registry_for_prompt()}

IMPORTANT:
- Laya already classified the user's intent.
- Laya already extracted the entities.
- Your job is ONLY to select the next registered tool.
- Never invent a tool.
- Output ONLY JSON.

Special values:
- "none" = greeting, thanks, casual conversation, or a completed workflow.
- "clarify" = the intent has no matching registered tool.
- Never use "none" for an unfinished NXPERT request.

Intent mapping:
- navigate -> navigateToDPR
- dpr_actual -> getDPRActuals
- ng_summary -> getNGSummary
- ng_trend -> getNGSummary
- add_plan -> clarify
- mpr_summary -> clarify
- greeting -> none
- unknown -> clarify

DPR SEARCH WORKFLOW:
When intent is "dpr_search", the tools MUST be selected in this exact order:
1. navigateToDPR
2. setDPRFilters
3. searchDPR

Use "already_done" to determine the next step.

Rules for intent=dpr_search:
- If navigateToDPR is NOT in already_done: choose navigateToDPR.
- Otherwise, if setDPRFilters is NOT in already_done: choose setDPRFilters.
- Otherwise, if searchDPR is NOT in already_done: choose searchDPR.
- Otherwise: choose none.

Never skip a step.
Never repeat a tool that appears in already_done.

Examples:
already_done=[]
-> {{"tool":"navigateToDPR","args":{{}}}}

already_done=["navigateToDPR"]
-> {{"tool":"setDPRFilters","args":{{...}}}}

already_done=["navigateToDPR","setDPRFilters"]
-> {{"tool":"searchDPR","args":{{}}}}

already_done=["navigateToDPR","setDPRFilters","searchDPR"]
-> {{"tool":"none","args":{{}}}}

Arguments:
- navigateToDPR normally uses {{}}
- setDPRFilters uses the relevant Laya entities.
- searchDPR uses only the arguments required by its registry schema.
- Omit optional arguments that are not specified.

Output format:
{{"tool":"<registered tool name>","args":{{}}}}

Output ONLY valid JSON.
"""


def call_llm(messages: List[Dict[str, str]],
             temperature: float = 0.0,
             max_tokens: int = 200) -> str:
    """One chat completion against llama-server. Returns message content."""
    payload: Dict[str, Any] = {
        "model": QWEN_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "chat_template_kwargs": _THINK_OFF,
    }
    req = urllib.request.Request(
        QWEN_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=QWEN_TIMEOUT) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Qwen unreachable at {QWEN_URL}: {exc}") from exc
    return data["choices"][0]["message"]["content"]


def build_tool_messages(
    message: str,
    intent: str,
    entities: Dict[str, Any],
    page: Optional[str] = None,
    date: Optional[str] = None,
    executed: Optional[List[str]] = None,
) -> List[Dict[str, str]]:
    """System prompt + one user turn with the structured context."""
    ctx_lines = [
        f"page={page or 'unknown'}",
        f"today={date or 'unknown'}",
        f"intent={intent}",
        f"entities={json.dumps(entities, ensure_ascii=False)}",
        f"already_done={json.dumps(executed or [])}",
    ]
    user = "Context:\n" + "\n".join(ctx_lines) + f"\n\nUser message: {message}\n\nJSON:"
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]


def extract_json(text: str) -> Dict[str, Any]:
    """Pull the first {...} object out of the raw model output."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"no JSON in model output: {text[:120]!r}")
    return json.loads(match.group(0))


# ── Workflow guard (Step 4 design: Qwen chooses, we validate) ──────────────
# The 0.6B model reliably picks mid-workflow steps but skips/misorders the
# chain, so the chain order lives here, not in the prompt.

DPR_WORKFLOW = ["navigateToDPR", "setDPRFilters", "searchDPR"]
SET_FILTER_ARG_KEYS = ("model", "date", "shift", "partName", "dieNo")


def _expected_dpr_tool(executed: List[str]) -> str:
    """First workflow step not yet in executed, or 'none' when complete."""
    for step in DPR_WORKFLOW:
        if step not in executed:
            return step
    return "none"


def _dpr_step_args(step: str, entities: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic args for a CORRECTED step (Qwen's args are only kept
    when Qwen chose the right step)."""
    if step == "setDPRFilters":
        return {
            k: entities[k]
            for k in SET_FILTER_ARG_KEYS
            if entities.get(k) and entities[k] != "not_specified"
        }
    return {}


def _workflow_feedback(selected: str, expected: str) -> str:
    return (
        f"Wrong step: you chose {selected}, but the next required tool is "
        f"{expected}. Output ONLY JSON with that tool."
    )


def choose_tool(
    message: str,
    intent: str,
    entities: Dict[str, Any],
    page: Optional[str] = None,
    date: Optional[str] = None,
    executed: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Prompt Qwen → validated {"tool", "args"}.

    Up to 3 attempts: each is rejected (with feedback appended) if the JSON
    is invalid OR the step breaks the dpr_search workflow. dpr_search always
    ends with a valid next step — corrected steps get deterministic args.
    """
    # These intents currently have no registered WebMCP tool.
    # Do not let Qwen substitute an unrelated tool.
    if intent in {"add_plan", "mpr_summary"}:
        return {"tool": "clarify", "args": {}}

    messages = build_tool_messages(message, intent, entities, page, date, executed)
    last_error: Optional[Exception] = None
    for attempt in range(3):
        raw = call_llm(messages)
        try:
            choice = validate_choice(extract_json(raw))
        except (ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            # Retry once, telling the model exactly what was wrong.
            messages = messages + [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"Invalid: {exc}. Output ONLY corrected JSON."},
            ]
            continue

        if intent == "dpr_search":
            expected = _expected_dpr_tool(executed or [])
            if choice["tool"] != expected:
                last_error = ValueError(
                    f"selected {choice['tool']}, next must be {expected}"
                )
                messages = messages + [
                    {"role": "assistant", "content": raw},
                    {"role": "user", "content": _workflow_feedback(choice["tool"], expected)},
                ]
                continue
        return choice

    # Model exhausted its retries: force the valid next step (dpr_search only).
    if intent == "dpr_search":
        step = _expected_dpr_tool(executed or [])
        return {"tool": step, "args": _dpr_step_args(step, entities)}
    raise ValueError(f"Qwen returned no valid tool call: {last_error}")
