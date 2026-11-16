import time, traceback, datetime as dt
from pathlib import Path
from src.utils import io_utils as io
from src.utils.paths import FILES

RECORD = []
_STARTED = dt.datetime.now().isoformat(timespec="seconds")


class DataSizeSkip(Exception):
    pass


def _bad(p):
    p = Path(p)
    if not p.exists() or p.stat().st_size == 0:
        return True
    if p.suffix == ".json":
        try:
            d = io.read_json(p)
        except Exception:
            return True
        return isinstance(d, dict) and d.get("status") == "skipped"
    return False


def run_stage(name, fn, requires=(), produces=()):
    t0 = time.time()
    status, reason = "ok", ""
    gone = [Path(p).name for p in requires if _bad(p)]
    if gone:
        status, reason = "SKIPPED", "missing upstream output: " + ", ".join(gone)
    else:
        try:
            fn()
        except DataSizeSkip as exc:
            status, reason = "SKIPPED", str(exc)
        except Exception as exc:
            status, reason = "FAILED", str(exc)
            traceback.print_exc()
        if status == "ok":
            absent = [Path(p).name for p in produces if _bad(p)]
            if absent:
                status, reason = "FAILED", "expected output missing: " + ", ".join(absent)
    if status != "ok":
        for p in produces:
            p = Path(p)
            if p.suffix == ".json" and (not p.exists() or p.stat().st_size == 0):
                io.save_json({"status": "skipped", "reason": reason}, p)
    secs = round(time.time() - t0, 2)
    RECORD.append({"name": name, "status": status, "seconds": secs, "reason": reason,
                   "produces": [Path(p) for p in produces]})
    print("[" + status + "] " + name + " (" + str(secs) + "s)" + ((" - " + reason) if reason else ""))
    return status


def verify_outputs():
    print("")
    print("Stage".ljust(34) + "Status".ljust(10) + "Output")
    problems = 0
    for r in RECORD:
        outs = []
        for p in r["produces"]:
            ok = Path(p).exists() and Path(p).stat().st_size > 0
            if ok and Path(p).suffix == ".json":
                try:
                    io.read_json(p)
                except Exception:
                    ok = False
            if r["status"] == "ok" and not ok:
                problems += 1
            outs.append(Path(p).name)
        print(r["name"][:33].ljust(34) + r["status"].ljust(10) + ", ".join(outs[:2]))
    run = {"started": _STARTED, "finished": dt.datetime.now().isoformat(timespec="seconds"),
           "stages": [{"name": r["name"], "status": r["status"], "seconds": r["seconds"], "reason": r["reason"]}
                      for r in RECORD]}
    prev = io.read_json_ok(FILES["run_log"])
    runs = (prev or {}).get("runs", []) if isinstance(prev, dict) else []
    io.save_json({"runs": ([run] + runs)[:20]}, FILES["run_log"])
    if problems:
        print(str(problems) + " expected output file(s) were missing or unreadable")
    return problems == 0
