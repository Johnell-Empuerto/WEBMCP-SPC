"""Step 3 gate: test choose_tool() DIRECTLY (no server, no orchestrator).

Three cases against intent=dpr_search with growing already_done.

Prereq: llama-server on :9001. Run from this folder:
    python test_choose.py
"""

import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from qwen import choose_tool  # noqa: E402  (needs cwd = laya-server)

MESSAGE = "Open DPR, set model 500 date today, then load."
ENTITIES = {"date_hint": "today", "date": "2026-10-03",
            "line": "not_specified", "shift": "not_specified"}

CASES = [
    ([], "navigateToDPR"),
    (["navigateToDPR"], "setDPRFilters"),
    (["navigateToDPR", "setDPRFilters"], "searchDPR"),
]

REPEATS = 3  # run each case 3x to see reliability, not luck


def main():
    passed = total = 0
    for executed, expected in CASES:
        hits = []
        for _ in range(REPEATS):
            try:
                choice = choose_tool(
                    MESSAGE, "dpr_search", dict(ENTITIES),
                    page="home", date=ENTITIES["date"], executed=list(executed),
                )
                hits.append(choice["tool"])
            except Exception as exc:  # noqa: BLE001
                hits.append(f"ERROR:{exc}")
        n_ok = sum(1 for h in hits if h == expected)
        total += REPEATS
        passed += n_ok
        ok = n_ok == REPEATS
        print(f"[{'PASS' if ok else 'FAIL'}] already_done={executed}")
        print(f"       expected={expected}  got={hits}  ({n_ok}/{REPEATS})")
    print(f"\n{passed}/{total} (need {total} for a reliable selector)")


if __name__ == "__main__":
    main()
