"""Step 4 test: POST /chat orchestrator pipeline.

Prereq:
  - llama-server   http://127.0.0.1:9001
  - this server    python server.py --port 9000
  - (read case only) Express on :3002 + set NXPERT_TOKEN=<jwt>
Run:
  python test_chat.py
"""

import io
import json
import os
import sys
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

CHAT_URL = os.getenv("LAYA_CHAT_URL", "http://127.0.0.1:9000/chat")
TODAY = "2026-10-03"


def chat(message: str, executed=None, page: str = "home"):
    body = {
        "state": {"page": page, "date": TODAY, "filters": {}, "message": message},
        "executed": executed or [],
    }
    headers = {"Content-Type": "application/json"}
    token = os.getenv("NXPERT_TOKEN")
    if token:
        headers["Authorization"] = token if token.startswith("Bearer") else f"Bearer {token}"
    req = urllib.request.Request(
        CHAT_URL, data=json.dumps(body).encode(), headers=headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        return json.loads(res.read().decode())


def show(label, res, expect_tool=None, expect_reply_only=False):
    tools = [f"{t['tool']}({t['status']})" for t in res.get("toolCalls", [])]
    reply = (res.get("reply") or "")[:90]
    if expect_reply_only:
        ok = bool(reply) and not tools
    elif expect_tool:
        ok = bool(tools) and tools[0].startswith(expect_tool)
    else:
        ok = True
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    print(f"       intent={res.get('intent')} tools={tools}")
    print(f"       reply={reply!r}")
    return ok


def main():
    passed = total = 0

    # 1. greeting -> none -> conversational reply, no tools
    total += 1
    passed += show("greeting", chat("hi"), expect_reply_only=True)

    # 2. navigate -> pending ui tool
    total += 1
    passed += show("Go to DPR", chat("Go to DPR."), expect_tool="navigateToDPR")

    # 3. chain: dpr_search -> navigateToDPR, then setDPRFilters, then searchDPR
    total += 1
    steps = []
    executed = []
    msgs = ["Open DPR, set model 500 date today, then load."] * 3
    try:
        for _ in msgs:
            res = chat(msgs[0], executed=executed)
            if not res["toolCalls"]:
                break
            tc = res["toolCalls"][0]
            steps.append(tc["tool"])
            executed.append(tc["tool"])
        ok = steps == ["navigateToDPR", "setDPRFilters", "searchDPR"]
        print(f"[{'PASS' if ok else 'FAIL'}] dpr_search chain")
        print(f"       steps={steps}")
        passed += int(ok)
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] dpr_search chain\n       ERROR: {exc}")

    # 4. unregistered intent -> clarify
    total += 1
    res = chat("Add plan today 300 model 500 shift 1.")
    tools = [t["tool"] for t in res.get("toolCalls", [])]
    ok = "clarify" in tools and bool(res.get("reply"))
    print(f"[{'PASS' if ok else 'FAIL'}] add_plan -> clarify")
    print(f"       tools={tools} reply={(res.get('reply') or '')[:80]!r}")
    passed += int(ok)

    # 5. read tool (needs Express + NXPERT_TOKEN)
    total += 1
    if not os.getenv("NXPERT_TOKEN"):
        print("[SKIP] read getNGSummary — set NXPERT_TOKEN=<jwt> (and Express running)")
    else:
        try:
            res = chat("Which model has the most NG today?")
            tc = res.get("toolCalls", [{}])[0]
            ok = tc.get("tool") == "getNGSummary" and tc.get("status") == "done"
            print(f"[{'PASS' if ok else 'FAIL'}] read getNGSummary")
            print(f"       status={tc.get('status')} reply={(res.get('reply') or '')[:90]!r}")
            passed += int(ok)
        except Exception as exc:  # noqa: BLE001
            print(f"[FAIL] read getNGSummary\n       ERROR: {exc}")

    print(f"\n{passed}/{total} passed")


if __name__ == "__main__":
    main()
