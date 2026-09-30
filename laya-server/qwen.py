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
- Follow the intent first.
- "none" is ONLY for greeting, thanks, or casual conversation.
- "clarify" is for an intent that has NO matching registered tool.
- Never use "none" for a real NXPERT request.
- Never invent a tool.

Intent mapping:
- navigate -> navigateToDPR when the user wants to open/go to DPR
- dpr_search -> setDPRFilters when the user wants to set DPR filters
- dpr_actual -> getDPRActuals
- ng_summary -> getNGSummary
- ng_trend -> getNGSummary
- add_plan -> clarify because no add-plan tool exists
- mpr_summary -> clarify because no MPR tool exists
- greeting -> none
- unknown -> clarify

Rules:
- Output ONLY JSON.
- Format: {{"tool": "<name>", "args": {{}}}}
- Do not output explanations.
- Do not invent tool names.
- Do not use "none" for a real application request.
- Omit optional arguments that are not specified.
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
) -> List[Dict[str, str]]:
    """System prompt + one user turn with the structured context."""
    ctx_lines = [
        f"page={page or 'unknown'}",
        f"today={date or 'unknown'}",
        f"intent={intent}",
        f"entities={json.dumps(entities, ensure_ascii=False)}",
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


def choose_tool(
    message: str,
    intent: str,
    entities: Dict[str, Any],
    page: Optional[str] = None,
    date: Optional[str] = None,
) -> Dict[str, Any]:
    """Prompt Qwen → validated {"tool", "args"}. One retry on bad output."""
    # These intents currently have no registered WebMCP tool.
    # Do not let Qwen substitute an unrelated tool.
    if intent in {"add_plan", "mpr_summary"}:
        return {"tool": "clarify", "args": {}}

    messages = build_tool_messages(message, intent, entities, page, date)
    last_error: Optional[Exception] = None
    for attempt in range(2):
        raw = call_llm(messages)
        try:
            return validate_choice(extract_json(raw))
        except (ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            # Retry once, telling the model exactly what was wrong.
            messages = messages + [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"Invalid: {exc}. Output ONLY corrected JSON."},
            ]
    raise ValueError(f"Qwen returned no valid tool call: {last_error}")
