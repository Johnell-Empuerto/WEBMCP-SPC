"""Step 3 test: Laya intent/entities -> Qwen -> tool selection.

Prereq: llama-server running (default http://127.0.0.1:9001).
Run:    python test_qwen.py
"""

import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from qwen import choose_tool  # noqa: E402

TODAY = "2026-10-03"

# (label, message, intent, entities, expected_tool)
CASES = [
    (
        "Go to DPR.",
        "Go to DPR.",
        "navigate",
        {"date_hint": "not_specified", "date": TODAY, "line": "not_specified", "shift": "not_specified"},
        "navigateToDPR",
    ),
    (
        "Open DPR + filters + load",
        "Open DPR, set model 500 date today, then load.",
        "dpr_search",
        {"date_hint": "today", "date": TODAY, "line": "not_specified", "shift": "not_specified"},
        "setDPRFilters",  # first step of navigate -> setFilters -> search
    ),
    (
        "Add plan today 300 model 500 shift 1",
        "Add plan today 300 model 500 shift 1.",
        "add_plan",
        {"date_hint": "today", "date": TODAY, "line": "not_specified", "shift": "1"},
        "clarify",  # plan tools not registered yet — model must NOT invent them
    ),
    (
        "How much produced today?",
        "How much did we produce today?",
        "dpr_actual",
        {"date_hint": "today", "date": TODAY, "line": "not_specified", "shift": "not_specified"},
        "getDPRActuals",
    ),
    (
        "Most NG today",
        "Which model has the most NG today?",
        "ng_summary",
        {"date_hint": "today", "date": TODAY, "line": "not_specified", "shift": "not_specified"},
        "getNGSummary",
    ),
    (
        "hi",
        "hi",
        "greeting",
        {"date_hint": "not_specified", "date": TODAY, "line": "not_specified", "shift": "not_specified"},
        "none",
    ),
    (
        "MPR summary",
        "Show the MPR summary for this month.",
        "mpr_summary",
        {"date_hint": "not_specified", "date": TODAY, "line": "not_specified", "shift": "not_specified"},
        "clarify",  # MPR tools not registered yet
    ),
    (
        "NG trend ADC",
        "Show NG trend for ADC this month.",
        "ng_trend",
        {"date_hint": "not_specified", "date": TODAY, "line": "adc", "shift": "not_specified"},
        "getNGSummary",  # closest registered read tool; ng_trend tools come later
    ),
]

def main() -> None:
    passed = 0
    for label, message, intent, entities, expected in CASES:
        try:
            call = choose_tool(message, intent, entities, page="home", date=TODAY)
            got = call["tool"]
            ok = got == expected
            passed += int(ok)
            mark = "PASS" if ok else "FAIL"
            print(f"[{mark}] {label}\n"
                  f"       intent={intent} -> {got} args={call['args']}\n"
                  f"       expected={expected}")
        except Exception as exc:  # noqa: BLE001 — show any failure and continue
            print(f"[FAIL] {label}\n       ERROR: {exc}\n       expected={expected}")
    print(f"\n{passed}/{len(CASES)} passed")

if __name__ == "__main__":
    main()
