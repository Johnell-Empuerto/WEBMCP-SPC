"""Step 4 — chat orchestrator.

Pipeline: Laya intent/entities (computed by the caller) → Qwen tool choice →
route by tool type:

  meta none    → Qwen writes a short conversational reply
  meta clarify → Qwen writes one short clarifying question
  ui           → returned to the browser as a PENDING toolCall (Step 5 executes
                 it in React, then calls /chat again with `executed=[...]`)
  read         → executed server-side against Express with the user's JWT →
                 Qwen explains the data → reply + DONE toolCall

One tool step per request (max 3 chain steps enforced via `executed`).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from tools import get_tool
from qwen import call_llm, choose_tool

EXPRESS_BASE = os.getenv("EXPRESS_BASE", "http://127.0.0.1:3002")
EXPRESS_TIMEOUT = float(os.getenv("EXPRESS_TIMEOUT", "20"))

MAX_CHAIN = 3

# Short deterministic replies for UI steps (no LLM call needed).
UI_REPLIES = {
    "navigateToDPR": "Opening the DPR page.",
    "setDPRFilters": "Applying the filters.",
    "searchDPR": "Loading the data.",
}

CLARIFY_FALLBACK = "Could you tell me a bit more about what you need?"

ANSWER_SYSTEM = (
    "You are the NXPERT manufacturing assistant. Answer the user in 1-3 short "
    "sentences using ONLY the data provided. Never invent numbers. "
    "If the data is empty, say no results were found."
)


def _truncate(value: Any, limit: int = 6000) -> str:
    text = json.dumps(value, ensure_ascii=False, default=str)
    if len(text) > limit:
        return text[:limit] + "…(truncated)"
    return text


def converse(message: str) -> str:
    """Direct conversational reply (greetings / chit-chat)."""
    reply = call_llm(
        [
            {
                "role": "system",
                "content": "You are the NXPERT manufacturing assistant. "
                           "Reply in one short friendly sentence. No tools, no JSON.",
            },
            {"role": "user", "content": message},
        ],
        max_tokens=120,
    )
    return reply.strip() or "Hi! How can I help?"


def clarify_question(intent: str) -> str:
    try:
        reply = call_llm(
            [
                {
                    "role": "system",
                    "content": "You are the NXPERT manufacturing assistant. "
                               "Ask ONE short clarifying question about the request. "
                               "No tools, no JSON.",
                },
                {"role": "user", "content": f"Intent: {intent}"},
            ],
            max_tokens=80,
        )
        reply = reply.strip().strip('"')
        if reply:
            return reply
    except Exception:  # noqa: BLE001 — fallback text keeps the API alive
        pass
    return CLARIFY_FALLBACK


def execute_read(tool_name: str, args: Dict[str, Any], jwt: Optional[str]) -> Any:
    """Call the tool's Express endpoint with the logged-in user's JWT."""
    tool = get_tool(tool_name)
    if not tool or not tool.get("endpoint"):
        raise RuntimeError(f"tool {tool_name} has no endpoint")
    ep = tool["endpoint"]
    url = EXPRESS_BASE.rstrip("/") + ep["path"]
    headers = {"Content-Type": "application/json"}
    if jwt:
        headers["Authorization"] = jwt if jwt.lower().startswith("bearer ") else f"Bearer {jwt}"

    data = None
    if ep.get("method") == "POST":
        data = json.dumps(args).encode("utf-8")
    else:
        # GET: map tool args to the API's query parameter names.
        mapping = ep.get("map") or {}
        params = {api_name: args[tool_arg]
                  for api_name, tool_arg in mapping.items()
                  if tool_arg in args} if mapping else args
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, data=data, headers=headers, method=ep.get("method", "POST"))
    try:
        with urllib.request.urlopen(req, timeout=EXPRESS_TIMEOUT) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Express {exc.code} on {ep['path']}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Express unreachable at {EXPRESS_BASE}: {exc.reason}") from exc


def explain(message: str, tool_name: str, args: Dict[str, Any], result: Any) -> str:
    """Qwen turns raw tool data into a short conversational answer."""
    user = (
        f"User message: {message}\n"
        f"Tool called: {tool_name}({json.dumps(args, ensure_ascii=False)})\n"
        f"Tool data: {_truncate(result)}\n\n"
        "Answer:"
    )
    reply = call_llm(
        [{"role": "system", "content": ANSWER_SYSTEM}, {"role": "user", "content": user}],
        max_tokens=220,
    )
    return reply.strip() or "Here is the result from the system."


def run_chat(
    *,
    message: str,
    intent: str,
    entities: Dict[str, Any],
    confidence: Optional[float],
    routing: Dict[str, Any],
    page: Optional[str],
    date: Optional[str],
    executed: List[str],
    jwt: Optional[str],
) -> Dict[str, Any]:
    """Full Step-4 pipeline. Returns the /chat response body."""
    response: Dict[str, Any] = {
        "intent": intent,
        "entities": entities,
        "confidence": confidence,
        "routing": routing,
        "reply": "",
        "toolCalls": [],
    }

    try:
        choice = choose_tool(message, intent, entities, page, date, executed)
    except Exception as exc:  # noqa: BLE001 — never 500 the chat on model output
        response["reply"] = f"I couldn't decide how to handle that ({exc})."
        return response

    tool_name = choice["tool"]
    args = choice["args"]

    # ── meta tools ────────────────────────────────────────────────────────
    if tool_name == "none":
        # Chain finished (or no app action needed).
        response["reply"] = converse(message) if not executed else \
            "All steps are done. Anything else I can help with?"
        return response

    if tool_name == "clarify":
        response["toolCalls"].append({"tool": "clarify", "args": {}, "status": "clarify"})
        response["reply"] = clarify_question(intent)
        return response

    tool = get_tool(tool_name)
    if tool is None:  # validate_choice should prevent this
        response["reply"] = "I couldn't find that tool."
        return response

    # ── deterministic loop stop ───────────────────────────────────────────
    if tool_name in executed:
        response["reply"] = "All requested steps are done."
        response["toolCalls"].append({"tool": tool_name, "args": args, "status": "done"})
        return response
    if len(executed) >= MAX_CHAIN:
        response["reply"] = "That's as far as I can go in one request — what's next?"
        response["toolCalls"].append({"tool": tool_name, "args": args, "status": "pending"})
        return response

    # ── UI tool → browser executes (Step 5) ───────────────────────────────
    if tool["type"] == "ui":
        response["reply"] = UI_REPLIES.get(tool_name, f"Running {tool_name}.")
        response["toolCalls"].append({"tool": tool_name, "args": args, "status": "pending"})
        return response

    # ── read tool → Express → Qwen explains ───────────────────────────────
    if tool["type"] == "read":
        try:
            result = execute_read(tool_name, args, jwt)
        except Exception as exc:  # noqa: BLE001 — surface as a chat message
            response["reply"] = f"I couldn't fetch that data: {exc}"
            response["toolCalls"].append(
                {"tool": tool_name, "args": args, "status": "error", "error": str(exc)}
            )
            return response
        response["reply"] = explain(message, tool_name, args, result)
        response["toolCalls"].append(
            {"tool": tool_name, "args": args, "status": "done", "result": result}
        )
        return response

    # ── write tools: not registered yet, safety net ───────────────────────
    response["reply"] = "That action needs confirmation and isn't enabled yet."
    response["toolCalls"].append({"tool": tool_name, "args": args, "status": "blocked"})
    return response


__all__ = ["run_chat", "MAX_CHAIN"]
