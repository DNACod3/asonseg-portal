#!/usr/bin/env python3
"""
Timer de task — registra tempo real de execução do início do kickoff até o merge.

Distingue:
- Trabalho do assistant (entre tick-start e tick-end): contado integral, sem cap.
- Espera do humano (entre tick-end e tick-start seguinte): truncada em
  MAX_GAP_MINUTES (default 15 — granularidade do arredondamento de 0.25h).

Suporta MÚLTIPLOS timers ativos simultâneos (1 por issue) — cada chat/dev
trabalha em sua própria task em paralelo. Use `--issue N` quando houver mais
de 1 ativo; com 1 só, `--issue` é opcional (auto-pick).

Uso:
    timer.py start --issue 51 --task TASK-009
    timer.py tick-start --issue 51   # início de turn do assistant
    timer.py tick-end --issue 51     # fim de turn do assistant
    timer.py stop --issue 51         # fechamento (arquiva no history)
    timer.py status                  # lista todos os timers ativos
    timer.py status --issue 51       # status de um timer específico

Compat:
    timer.py tick                    # alias deprecado de tick-start

State: .wolf/task-timer.json
Schema (v2): {"actives": {"<issue>": {...}}, "history": [...]}
Schema (v1, migrado on-read): {"active": {...} | null, "history": [...]}
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_FILE = ROOT / "task-timer.json"
MAX_GAP_MINUTES_DEFAULT = 15


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def load() -> dict:
    if not STATE_FILE.exists():
        return {"actives": {}, "history": []}
    with STATE_FILE.open() as f:
        state = json.load(f)
    # Migração v1 → v2: `active` (single dict | null) → `actives` (dict by issue).
    if "actives" not in state:
        actives = {}
        legacy = state.pop("active", None)
        if legacy:
            actives[str(legacy["issue_number"])] = legacy
        state["actives"] = actives
    state.setdefault("history", [])
    return state


def save(state: dict) -> None:
    with STATE_FILE.open("w") as f:
        json.dump(state, f, indent=2)


def _migrate_active(active: dict) -> bool:
    """Migra schema antigo (last_tick_at) para o novo (turn_started_at + turn_ended_at).
    Retorna True se mutou o dict."""
    changed = False
    if "assistant_turn_started_at" not in active:
        seed = active.get("last_tick_at") or active.get("started_at")
        active["assistant_turn_started_at"] = seed
        active["assistant_turn_ended_at"] = seed
        changed = True
    if active.get("max_gap_minutes") == 30:
        active["max_gap_minutes"] = MAX_GAP_MINUTES_DEFAULT
        changed = True
    if "last_tick_at" in active:
        active.pop("last_tick_at", None)
        changed = True
    return changed


def _resolve_active(state: dict, issue: int | None) -> tuple[str | None, dict | None]:
    """Resolve qual timer ativo operar. Se --issue informado, usa esse;
    senão, exige que haja exatamente 1 ativo (auto-pick)."""
    actives = state.get("actives", {})
    if issue is not None:
        key = str(issue)
        return key, actives.get(key)
    if len(actives) == 0:
        return None, None
    if len(actives) == 1:
        key = next(iter(actives.keys()))
        return key, actives[key]
    keys = sorted(actives.keys(), key=int)
    print(
        f"ERROR: {len(actives)} timers ativos ({', '.join('#'+k for k in keys)}). "
        "Informe --issue N para escolher.",
        file=sys.stderr,
    )
    return None, None


def cmd_start(args) -> int:
    state = load()
    key = str(args.issue)
    if key in state["actives"]:
        prev = state["actives"][key]
        print(
            f"ERROR: timer já ativo para issue #{prev['issue_number']} "
            f"({prev['task_id']}). Pare antes com 'stop --issue {key}'.",
            file=sys.stderr,
        )
        return 1

    now = now_iso()
    state["actives"][key] = {
        "issue_number": args.issue,
        "task_id": args.task,
        "started_at": now,
        "assistant_turn_started_at": now,
        "assistant_turn_ended_at": now,
        "accumulated_seconds": 0,
        "max_gap_minutes": args.max_gap or MAX_GAP_MINUTES_DEFAULT,
    }
    save(state)
    other = [k for k in state["actives"] if k != key]
    extra = f" | outros ativos: {', '.join('#'+k for k in other)}" if other else ""
    print(f"OK   timer iniciado para #{args.issue} ({args.task}) at {now}{extra}")
    return 0


def cmd_tick_start(args) -> int:
    """Início de turn do assistant — conta espera humana (capped em max_gap)."""
    state = load()
    key, active = _resolve_active(state, getattr(args, "issue", None))
    if key is None and active is None:
        if not state.get("actives"):
            print("noop: sem timer ativo")
            return 0
        return 1
    if active is None:
        print(f"noop: sem timer ativo para issue #{key}")
        return 0
    _migrate_active(active)

    now = datetime.now(timezone.utc)
    ended_at = parse_iso(active["assistant_turn_ended_at"])
    started_at = parse_iso(active["assistant_turn_started_at"])
    max_gap_seconds = active.get("max_gap_minutes", MAX_GAP_MINUTES_DEFAULT) * 60

    warning = ""
    if started_at > ended_at:
        warning = " [warn: tick-end anterior pulado, trabalho perdido]"

    delta_seconds = max(0, int((now - ended_at).total_seconds()))

    if delta_seconds <= max_gap_seconds:
        added = delta_seconds
        added_label = f"+{added}s espera"
    else:
        added = max_gap_seconds
        added_label = f"+{added}s espera (cap; gap real {int(delta_seconds/60)}min)"

    active["accumulated_seconds"] += added
    new_started_at = now_iso()
    active["assistant_turn_started_at"] = new_started_at
    # Garante invariante started_at > ended_at: se start+tick-start no mesmo
    # segundo (ou tick-end + tick-start no mesmo segundo), recua ended_at em 1s
    # para que o próximo tick-end conte o trabalho corretamente. Bug #094.
    if parse_iso(new_started_at) <= parse_iso(active["assistant_turn_ended_at"]):
        bumped_ended = parse_iso(new_started_at).replace(microsecond=0)
        bumped_ended = bumped_ended.replace(second=max(0, bumped_ended.second - 1))
        active["assistant_turn_ended_at"] = bumped_ended.strftime("%Y-%m-%dT%H:%M:%SZ")
    save(state)
    total_h = active["accumulated_seconds"] / 3600
    print(
        f"tick-start #{active['issue_number']} {active['task_id']}: "
        f"{added_label}{warning} | acumulado={total_h:.2f}h"
    )
    return 0


def cmd_tick_end(args) -> int:
    """Fim de turn do assistant — conta trabalho do agente (sem cap)."""
    state = load()
    key, active = _resolve_active(state, getattr(args, "issue", None))
    if key is None and active is None:
        if not state.get("actives"):
            print("noop: sem timer ativo")
            return 0
        return 1
    if active is None:
        print(f"noop: sem timer ativo para issue #{key}")
        return 0
    _migrate_active(active)

    now = datetime.now(timezone.utc)
    started_at = parse_iso(active["assistant_turn_started_at"])
    ended_at = parse_iso(active["assistant_turn_ended_at"])

    if ended_at >= started_at:
        added = 0
        added_label = "+0s trabalho [warn: tick-start não foi chamado]"
    else:
        delta_seconds = max(0, int((now - started_at).total_seconds()))
        added = delta_seconds
        added_label = f"+{added}s trabalho"

    active["accumulated_seconds"] += added
    active["assistant_turn_ended_at"] = now_iso()
    save(state)
    total_h = active["accumulated_seconds"] / 3600
    print(
        f"tick-end #{active['issue_number']} {active['task_id']}: "
        f"{added_label} | acumulado={total_h:.2f}h"
    )
    return 0


def cmd_stop(args) -> int:
    state = load()
    key, active = _resolve_active(state, getattr(args, "issue", None))
    if active is None:
        print("ERROR: sem timer ativo para parar", file=sys.stderr)
        return 1
    _migrate_active(active)

    started_at = parse_iso(active["assistant_turn_started_at"])
    ended_at = parse_iso(active["assistant_turn_ended_at"])
    if started_at > ended_at:
        # Fecha trabalho aberto antes de arquivar
        ns = argparse.Namespace(issue=int(key))
        cmd_tick_end(ns)
        state = load()
        active = state["actives"][key]

    total_seconds = active["accumulated_seconds"]
    total_hours = total_seconds / 3600
    rounded = round(total_hours * 4) / 4

    record = dict(active)
    record["stopped_at"] = now_iso()
    record["total_seconds"] = total_seconds
    record["total_hours"] = total_hours
    record["spent_hours_rounded"] = rounded

    state["history"].append(record)
    del state["actives"][key]
    save(state)

    print(
        f"OK   timer parado para #{record['issue_number']} ({record['task_id']})\n"
        f"     total = {total_hours:.2f}h ({total_seconds}s) → "
        f"Spent Time = {rounded}h (arredondado a 0.25h)"
    )
    return 0


def cmd_status(args) -> int:
    state = load()
    actives = state.get("actives", {})
    issue = getattr(args, "issue", None)

    if issue is not None:
        key = str(issue)
        active = actives.get(key)
        if not active:
            print(f"sem timer ativo para issue #{key}")
            return 0
        _print_active(active)
        return 0

    if not actives:
        print("sem timer ativo")
        last = state.get("history", [])
        if last:
            print(
                f"último encerrado: #{last[-1]['issue_number']} "
                f"{last[-1]['task_id']} ({last[-1]['spent_hours_rounded']}h)"
            )
        return 0

    keys = sorted(actives.keys(), key=int)
    print(f"{len(actives)} timer(s) ativo(s):")
    for k in keys:
        active = actives[k]
        if _migrate_active(active):
            save(state)
        _print_active(active, prefix="  ")
    return 0


def _print_active(active: dict, prefix: str = "") -> None:
    total_h = active["accumulated_seconds"] / 3600
    started_at = parse_iso(active["assistant_turn_started_at"])
    ended_at = parse_iso(active["assistant_turn_ended_at"])
    phase = "assistant working" if started_at > ended_at else "waiting for user"
    print(f"{prefix}#{active['issue_number']} ({active['task_id']})")
    print(f"{prefix}  started: {active['started_at']}")
    print(f"{prefix}  turn started: {active['assistant_turn_started_at']}")
    print(f"{prefix}  turn ended:   {active['assistant_turn_ended_at']}")
    print(f"{prefix}  phase: {phase}")
    print(f"{prefix}  accumulated: {total_h:.2f}h ({active['accumulated_seconds']}s)")
    print(f"{prefix}  max gap: {active.get('max_gap_minutes', MAX_GAP_MINUTES_DEFAULT)} min")


def main() -> int:
    p = argparse.ArgumentParser(prog="timer.py")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("start")
    s.add_argument("--issue", type=int, required=True)
    s.add_argument("--task", required=True, help='ex: "TASK-003"')
    s.add_argument(
        "--max-gap",
        type=int,
        default=None,
        help="minutos sem interação que paralisam o cronômetro (default 15)",
    )
    s.set_defaults(func=cmd_start)

    ts = sub.add_parser("tick-start", help="início de turn do assistant — conta espera humana")
    ts.add_argument("--issue", type=int, default=None,
                    help="obrigatório se houver >1 timer ativo; opcional caso contrário")
    ts.set_defaults(func=cmd_tick_start)

    te = sub.add_parser("tick-end", help="fim de turn do assistant — conta trabalho do agente")
    te.add_argument("--issue", type=int, default=None,
                    help="obrigatório se houver >1 timer ativo; opcional caso contrário")
    te.set_defaults(func=cmd_tick_end)

    t = sub.add_parser("tick", help="alias deprecado de tick-start")
    t.add_argument("--issue", type=int, default=None)
    t.set_defaults(func=cmd_tick_start)

    sp = sub.add_parser("stop")
    sp.add_argument("--issue", type=int, default=None,
                    help="obrigatório se houver >1 timer ativo")
    sp.set_defaults(func=cmd_stop)

    st = sub.add_parser("status")
    st.add_argument("--issue", type=int, default=None,
                    help="filtra status para uma issue específica")
    st.set_defaults(func=cmd_status)

    args = p.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
