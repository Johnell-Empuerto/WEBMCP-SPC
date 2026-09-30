"""Minimal Laya API for the React playground.

Run:
    python server.py                     # http://127.0.0.1:9000
    python server.py --port 9000

Endpoints (the contract the web UI expects):
    POST /predict   answer every question about one state
    POST /intent    NXPERT chat: typed intent + entities for a user message
    POST /chat      orchestrator: intent + Qwen tool choice + reply/toolCalls
"""

from __future__ import annotations

import argparse
import datetime
import logging
import os
import re
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

import laya
from laya import Router

from orchestrator import run_chat

# The same per-request bounds laya.serve enforces, read from it so this shim cannot drift.
import laya.serve as _laya_serve

MAX_QUESTIONS = getattr(_laya_serve, "MAX_QUESTIONS", 64)
MAX_STATE_CHARS = getattr(_laya_serve, "MAX_STATE_CHARS", 50_000)
MAX_CHOICE_OPTIONS = getattr(_laya_serve, "MAX_CHOICE_OPTIONS", 100)
MAX_SCORE_LEVELS = getattr(_laya_serve, "MAX_SCORE_LEVELS", 32)
MAX_TOTAL_OPTIONS = getattr(_laya_serve, "MAX_TOTAL_OPTIONS", 512)

_log = logging.getLogger("laya.react-server")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

MODELS = tuple(getattr(laya, "DEFAULT_MODELS", {}) or ("english", "multilingual", "typed-decisions"))
QTYPES = sorted(getattr(laya, "QTYPES", {}) or ("choice", "score", "noul"))


# --------------------------------------------------------------------------- #
# NXPERT intent taxonomy (single source for the /intent endpoint)
# --------------------------------------------------------------------------- #

# NOTE: Laya's job here is ONLY intent classification. Simple entities
# (date/line/shift) are extracted deterministically by Python in
# `_extract_entities` — a tiny classifier guesses those, Python never does.

INTENT_CRITERIA: Dict[str, str] = {
    "dpr_actual": "ask how many units were actually produced or actual production output",
    "dpr_plan": "ask for planned production quantity",
    "dpr_search": "search or load DPR data, or set DPR filters such as model, date, line, or shift",
    "mpr_summary": "ask for monthly production summary",
    "ng_summary": "ask about NG defects, NG quantity, NG count, or which model has the most NG",
    "ng_trend": "ask about NG defects over time or NG history",
    "production_status": "ask for production status or compare plan versus actual",
    "add_plan": "create or add a production plan",
    "create_user": "create a new user",
    "update_user": "edit an existing user",
    "ppm_status": "ask about PPM defect rate or PPM status",
    "navigate": "only go to or open a page; do not search, load, filter, retrieve, or change data",
    "greeting": "greeting, thanks, or asking what you can do",
    "unknown": "request does not match any other intent",
}

# Canonical month numbers + the spellings people actually type: 3-letter
# abbreviations ("feb", "jul") and common typos ("febuary").
MONTH_NAMES: Dict[str, int] = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2, "febuary": 2, "febrary": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sept": 9, "sep": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}
# Longest first so "february" wins over "feb" in the alternation.
_MONTH_RE = "|".join(sorted(MONTH_NAMES, key=len, reverse=True))

# Which DPR line the current page implies. A short command like
# "load data from february" carries no line — the page supplies it.
DPR_PAGE_LINES: Dict[str, str] = {"mpr-adc": "adc", "mpr-c4": "c4", "mpr-kd": "kd"}


# --------------------------------------------------------------------------- #
# Request models
# --------------------------------------------------------------------------- #

def _check_model(v: Optional[str]) -> Optional[str]:
    """`model` is optional; when given it must name a known checkpoint."""
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if v not in MODELS:
        raise ValueError(f"unknown model {v!r}; expected one of {sorted(MODELS)} (or omit it)")
    return v


class Question(BaseModel):
    """One question in the `questions` mapping."""

    type: str = Field(..., description="choice | score | noul | ... (see /qtypes)")
    instructions: str = Field(..., description="Natural-language prompt for the question")
    criteria: Optional[Union[Dict[str, Any], list]] = Field(
        default=None,
        description="dict of label -> description for `choice`, ordered list for `score`.",
    )

    model_config = {"extra": "allow"}

    @field_validator("type")
    @classmethod
    def _known_type(cls, v: str) -> str:
        known = set(QTYPES)
        if known and v not in known:
            raise ValueError(f"unknown question type {v!r}; expected one of {sorted(known)}")
        return v

    @model_validator(mode="after")
    def _criteria_required_for_choice_and_score(self) -> "Question":
        if self.type in ("choice", "score") and not self.criteria:
            raise ValueError(f"'{self.type}' questions require non-empty `criteria`")
        return self


class PredictRequest(BaseModel):
    state: Union[str, Dict[str, Any], list] = Field(
        ..., description="The text/record to classify: a string, a dict of fields, or a list"
    )
    questions: Dict[str, Question] = Field(..., min_length=1)
    model: Optional[str] = Field(default=None, description="english | multilingual | typed-decisions; omit to auto-route")
    task: Optional[str] = None
    lang: Optional[str] = Field(default=None, description="ISO code hint; skips detection")

    _v_model = field_validator("model")(classmethod(lambda cls, v: _check_model(v)))

    @field_validator("state")
    @classmethod
    def _non_empty(cls, v):
        if not v:
            raise ValueError("state must not be empty")
        return v


class IntentState(BaseModel):
    """What the frontend knows right now + the user's message."""

    page: Optional[str] = Field(default=None, description="Current NXPERT page/route, e.g. 'dpr-adc'")
    date: Optional[str] = Field(default=None, description="Date currently selected on the page (YYYY-MM-DD)")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Filters currently applied on the page")
    pendingAction: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Clarify state from the previous turn "
                    "(toolCalls[].args.pendingAction), e.g. "
                    "{'tool': 'navigateToDPR', 'missing': 'line'}",
    )
    message: str = Field(..., min_length=1, max_length=2000, description="User chat message")

    @field_validator("message")
    @classmethod
    def _strip_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message must not be blank")
        return v


class IntentRequest(BaseModel):
    state: IntentState


def _intent_questions() -> Dict[str, Any]:
    """The typed intent question answered by Laya."""
    return {
        "intent": {
            "type": "choice",
            "instructions": "The user's main request in the NXPERT manufacturing system",
            "criteria": INTENT_CRITERIA,
        },
    }


def _extract_entities(message: str, current_date: Optional[str]) -> Dict[str, Any]:
    """Extract simple entities deterministically from the user's message.

    Laya is a tiny classifier — it guesses when an entity is absent. Dates,
    lines and shifts are exact string matches, so Python does them instead.
    """
    text = message.lower()

    # Date — resolve to a concrete YYYY-MM-DD whenever the message implies
    # one; otherwise keep the date the page is already showing.
    date = current_date
    try:
        anchor = datetime.date.fromisoformat(str(current_date))
    except (ValueError, TypeError):
        anchor = datetime.date.today()

    def _shift(days: int) -> str:
        return (anchor + datetime.timedelta(days=days)).isoformat()

    month_year = re.search(rf"\b({_MONTH_RE})\s+(\d{{4}})\b", text)
    month_day = re.search(
        rf"\b({_MONTH_RE})\s+(\d{{1,2}})(?:,?\s+(\d{{4}}))?\b", text
    )
    month_bare = re.search(rf"\b({_MONTH_RE})\b", text)
    iso_match = re.search(r"\b(\d{4}-\d{1,2}-\d{1,2})\b", text)

    if re.search(r"\btoday\b", text):
        date_hint = "today"
    elif re.search(r"\byesterday\b", text):
        date_hint, date = "yesterday", _shift(-1)
    elif re.search(r"\btomorrow\b", text):
        date_hint, date = "tomorrow", _shift(1)
    elif month_year:
        year = int(month_year.group(2))
        date = f"{year}-{MONTH_NAMES[month_year.group(1)]:02d}-01"
        date_hint = "explicit"
    elif month_day:
        name, dd = month_day.group(1), int(month_day.group(2))
        yy = month_day.group(3)
        year = int(yy) if yy else anchor.year
        try:
            date = datetime.date(year, MONTH_NAMES[name], dd).isoformat()
        except ValueError:
            date = f"{year}-{MONTH_NAMES[name]:02d}-01"
        date_hint = "explicit"
    elif month_bare and (
        month_bare.group(1) != "may"
        or re.search(r"\b(?:for|in|during)\s+may\b", text)
    ):
        date = f"{anchor.year}-{MONTH_NAMES[month_bare.group(1)]:02d}-01"
        date_hint = "explicit"
    elif iso_match:
        try:
            date = datetime.date.fromisoformat(iso_match.group(1)).isoformat()
        except ValueError:
            date = iso_match.group(1)
        date_hint = "explicit"
    else:
        date_hint = "not_specified"

    # Production line
    if re.search(r"\badc\b", text):
        line = "adc"
    elif re.search(r"\bc4\b", text):
        line = "c4"
    elif re.search(r"\bkd\b", text):
        line = "kd"
    else:
        line = "not_specified"

    # Shift
    if re.search(r"\b(?:shift\s*1|first\s+shift|1st\s+shift)\b", text):
        shift = "1"
    elif re.search(r"\b(?:shift\s*2|second\s+shift|2nd\s+shift)\b", text):
        shift = "2"
    elif re.search(r"\b(?:shift\s*3|third\s+shift|3rd\s+shift)\b", text):
        shift = "3"
    else:
        shift = "not_specified"

    # Model / product code ("model 500", "model ES01", "model: 8-98247-187-2")
    # Captured with original case; the frontend resolves name/part-code.
    # \b after "model" keeps "models" from yielding the stray "s" match.
    model_match = re.search(
        r"\bmodel\b\s*[:#=]?\s*([A-Za-z0-9][A-Za-z0-9\-]{0,19})", message, re.IGNORECASE
    )
    if model_match:
        model = model_match.group(1)
    elif re.search(r"\b(?:all|every|everything)\b", text):
        model = "all"
    else:
        # Bare model without the keyword: "load ES01". Matches the
        # chat-facing names (ES codes, hyphenated part codes); normalized to
        # upper so the frontend resolveModel gets "ES01", not "es01".
        bare = re.search(
            r"\b(?:ES\s?\d{2}(?:\s+[HL]/R)?|\d(?:-\d+){2,})\b",
            message,
            re.IGNORECASE,
        )
        model = bare.group(0).replace(" ", "").upper() if bare else "not_specified"

    return {
        "date_hint": date_hint,
        "date": date,
        "line": line,
        "shift": shift,
        "model": model,
    }


def _correct_intent(
    message: str,
    predicted: str,
    page: Optional[str] = None,
    entities: Optional[Dict[str, Any]] = None,
) -> str:
    """Apply deterministic NXPERT rules for obvious intent signals.

    Laya is a tiny classifier and blurs two known pairs (navigate vs
    dpr_search, dpr_actual vs ng_summary). When the message contains the
    deciding keyword, Python overrides the prediction.

    `page`/`entities` make the decision context-aware: on a DPR page a short
    command like "load data from febuary" is a dpr_search even without the
    word "DPR" — the message supplies the filter, the page supplies the line.
    """
    text = message.lower()

    # DPR search/filter/load takes priority over simple navigation.
    if "dpr" in text or "drp" in text:
        if any(word in text for word in (
            "set",
            "filter",
            "load",
            "search",
            "model",
            "date",
            "line",
            "shift",
            "data",
        )):
            return "dpr_search"

    # NG summary: current NG quantity/count or model with most NG.
    if "ng" in text:
        if any(phrase in text for phrase in (
            "most ng",
            "highest ng",
            "more ng",
            "ng count",
            "ng quantity",
            "ng defects",
        )):
            return "ng_summary"

    # Short data commands: a data verb plus a concrete filter the message
    # actually carries (a date or a model, from the entity layer — the
    # phrasing needn't mention "DPR" or spell the month correctly). On a DPR
    # page even a bare "load data" counts — the page supplies the line.
    ents = entities if entities is not None else {}
    has_filter = (
        ents.get("date_hint", "not_specified") != "not_specified"
        or ents.get("model", "not_specified") != "not_specified"
    )
    bare_page_load = page in DPR_PAGE_LINES and re.search(
        r"\b(?:data|models?|table|production|results?)\b", text
    )
    if (
        re.search(
            r"\b(?:load|show|display|fetch|get|pull|refresh|search|view|see|want)\b",
            text,
        )
        and (has_filter or bare_page_load)
        and not re.search(r"\b(?:ng|ppm|plan|user|actual)\b", text)
    ):
        return "dpr_search"

    # Pure page navigation: an opening verb + a known page keyword, or a bare
    # "dpr c4" phrase, with no data action (the dpr_search rules above already
    # claimed those).
    verb = re.search(
        r"\b(?:open|show|go\s+to|goto|take\s+me\s+to|navigate\s+to|display)\b", text
    )
    page_kw = re.search(
        r"\b(?:dpr|drp|mpr|dashboard|calendar|logs|settings|ng\s+report|plan\s+uploader)\b",
        text,
    )
    bare_dpr_line = (
        ("dpr" in text or "drp" in text) and re.search(r"\b(?:adc|c4|kd)\b", text)
    )
    if (verb or bare_dpr_line) and page_kw:
        # Stay on data intents ("show dpr plan"), but the page names
        # "ng report" / "plan uploader" are navigation despite the words.
        if not re.search(
            r"\b(?:plan(?!\s+uploader)|actual|production|quantity|output"
            r"|units?|ng(?!\s+report)|ppm)\b",
            text,
        ):
            return "navigate"

    # A cold "navigate" prediction must carry a navigational signal — a bare
    # answer like "c4" is not a command on its own (it only counts while a
    # pendingAction is waiting for it, which run_chat resolves separately).
    if predicted == "navigate" and not (verb or bare_dpr_line or page_kw):
        return "unknown"

    return predicted


# --------------------------------------------------------------------------- #
# App
# --------------------------------------------------------------------------- #

ROUTER: Optional[Router] = None
_CFG: Dict[str, Any] = {
    "preload": os.getenv("LAYA_PRELOAD", "0") not in ("0", "false", "False"),
    "device": os.getenv("LAYA_DEVICE") or None,
    "default": os.getenv("LAYA_DEFAULT_MODEL", "english"),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ROUTER
    ROUTER = Router(preload=_CFG["preload"], device=_CFG["device"], default=_CFG["default"])
    yield
    ROUTER = None


app = FastAPI(title="Laya React shim", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # dev convenience; the UI normally reaches this through Vite's proxy
    allow_methods=["*"],
    allow_headers=["*"],
)


def _router() -> Router:
    if ROUTER is None:
        raise HTTPException(status_code=503, detail="router not ready")
    return ROUTER


def _questions(model_map: Dict[str, Question]) -> Dict[str, Any]:
    """Back to the plain dicts laya expects, dropping unset keys."""
    return {k: v.model_dump(exclude_none=True) for k, v in model_map.items()}


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok" if ROUTER is not None else "loading", "config": dict(_CFG)}


@app.get("/qtypes")
def qtypes() -> Dict[str, Any]:
    return {"types": QTYPES}


@app.get("/models")
def models() -> Dict[str, Any]:
    return {
        "default": _CFG["default"],
        "allowed": sorted(MODELS),
        "models": {k: list(v) for k, v in (getattr(laya, "DEFAULT_MODELS", {}) or {}).items()},
    }


def _check_request_limits(state: Any, questions: Dict[str, Any]) -> None:
    """Refuse an oversized request, as `laya.serve._check_request_limits` does."""
    if len(questions) > MAX_QUESTIONS:
        raise HTTPException(status_code=413, detail="too many questions (%d > %d)" % (len(questions), MAX_QUESTIONS))
    size = len(state) if isinstance(state, str) else len(str(state))
    if size > MAX_STATE_CHARS:
        raise HTTPException(status_code=413, detail="state too large (%d > %d chars)" % (size, MAX_STATE_CHARS))
    total_options = 0
    for qid, qdef in questions.items():
        qtype = qdef.get("type") if isinstance(qdef, dict) else getattr(qdef, "type", None)
        crit = qdef.get("criteria") if isinstance(qdef, dict) else getattr(qdef, "criteria", None)
        if qtype == "choice" and isinstance(crit, (dict, list)):
            count = len(crit)
            total_options += count
            if count > MAX_CHOICE_OPTIONS:
                raise HTTPException(status_code=413,
                                    detail="too many choice options for %r (%d > %d)" % (qid, count, MAX_CHOICE_OPTIONS))
        elif qtype == "score" and isinstance(crit, list):
            count = len(crit)
            total_options += count
            if count > MAX_SCORE_LEVELS:
                raise HTTPException(status_code=413,
                                    detail="too many score levels for %r (%d > %d)" % (qid, count, MAX_SCORE_LEVELS))
    if total_options > MAX_TOTAL_OPTIONS:
        raise HTTPException(status_code=413,
                            detail="too many answer options across questions (%d > %d)" % (total_options, MAX_TOTAL_OPTIONS))


@app.post("/predict")
def predict(req: PredictRequest, request: Request) -> Dict[str, Any]:
    _check_request_limits(req.state, req.questions)
    questions = _questions(req.questions)
    try:
        return _router().predict(req.state, questions, model=req.model, task=req.task, lang=req.lang)
    except HTTPException:
        raise
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        # The caller gets a fixed message; the traceback describes the deployment, not the request.
        _log.exception("prediction failed")
        raise HTTPException(status_code=500, detail="prediction failed")


def _choice(answer: Dict[str, Any], default: str) -> str:
    """Extract the chosen label + calibrated probability from a Laya answer."""
    return str(answer.get("choice") or default)


def _confidence(answer: Dict[str, Any]) -> Optional[float]:
    value = answer.get("answer_confidence")
    if value is None:
        value = answer.get("confidence")
    if value is None:
        return None
    try:
        return round(float(value), 4)
    except (TypeError, ValueError):
        return None


def _classify(state: IntentState) -> Dict[str, Any]:
    """Laya intent + deterministic entities for one message (shared by
    /intent and /chat)."""
    # Laya reads plain text best; page/filters are context for the response,
    # not tokens it must parse, so only the message becomes the state text.
    try:
        result = _router().predict(
            state.message, _intent_questions(), head_max_len=512
        )
    except HTTPException:
        raise
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        _log.exception("intent prediction failed")
        raise HTTPException(status_code=500, detail="prediction failed")

    intent_answer = result.get("answers", {}).get("intent", {})
    predicted_intent = _choice(intent_answer, "unknown")
    entities = _extract_entities(state.message, state.date)
    final_intent = _correct_intent(state.message, predicted_intent, state.page, entities)

    if final_intent == "dpr_search":
        # Context: the current page supplies the line, and a load command
        # that never mentions a model means ALL models (a fresh request —
        # "load data from february" shouldn't keep an old ES01 filter).
        if entities["line"] == "not_specified":
            entities["line"] = DPR_PAGE_LINES.get(state.page or "", "not_specified")
        if entities["model"] == "not_specified":
            entities["model"] = "all"

    return {
        "intent": final_intent,
        "entities": entities,
        "confidence": _confidence(intent_answer),
        "state": {"page": state.page, "filters": state.filters},
        "routing": result.get("routing", {}),
    }


@app.post("/intent")
def intent(req: IntentRequest) -> Dict[str, Any]:
    """NXPERT chat entry point: user message + page state → typed intent/entities.

    Laya answers the intent question in one forward pass; simple entities
    (date/line/shift) are extracted deterministically by Python. The caller
    (orchestrator) feeds `intent` + `entities` to Qwen for tool selection.
    """
    return _classify(req.state)


class ChatRequest(BaseModel):
    """Full chat turn: classification context + already-executed UI steps."""
    state: IntentState
    executed: List[str] = Field(default_factory=list)


@app.post("/chat")
def chat(req: ChatRequest, authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Step-4 orchestrator: Laya → Qwen → tool routing → reply + toolCalls.

    `executed` lists UI tools the browser already ran this turn (chaining:
    navigateToDPR → setDPRFilters → searchDPR). The Authorization header is
    forwarded to Express for `read` tools so the AI runs under the logged-in
    user's permissions.
    """
    classified = _classify(req.state)
    return run_chat(
        message=req.state.message,
        intent=classified["intent"],
        entities=classified["entities"],
        confidence=classified["confidence"],
        routing=classified["routing"],
        page=req.state.page,
        date=req.state.date,
        executed=req.executed,
        jwt=authorization,
        pending_action=req.state.pendingAction,
    )


@app.exception_handler(404)
async def _not_found(request: Request, exc: Exception):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=404,
        content={"detail": "not found",
                "routes": ["/predict", "/intent", "/chat", "/qtypes", "/models", "/health"]},
    )


# --------------------------------------------------------------------------- #

def main() -> None:
    p = argparse.ArgumentParser(description="Laya API shim for the React playground")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=9000)
    p.add_argument("--device", default=_CFG["device"], help="cuda, cpu, mps ...")
    p.add_argument("--preload", action="store_true", help="build checkpoints at startup instead of lazily")
    args = p.parse_args()

    _CFG.update(preload=args.preload or _CFG["preload"], device=args.device)

    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
