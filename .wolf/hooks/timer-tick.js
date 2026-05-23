// OpenWolf timer-tick hook — atualiza accumulated_seconds em cada tool use.
//
// Por que: hooks `tick-start`/`tick-end` do timer.py exigem chamadas manuais que
// o agente raramente faz com subagents/longa execucao. Resultado: timer fica em
// 0h. Este hook dispara em PostToolUse (qualquer tool) E Stop, e mantem o
// `assistant_turn_ended_at` sempre atualizado, somando deltas capped em
// max_gap_minutes (default 15) — mesma regra do timer.py mas automatica.
//
// Modelo simplificado vs timer.py original:
//   - timer.py: trabalho integral (sem cap) entre start/end; espera capped.
//   - hook: cada delta entre eventos consecutivos cap em max_gap_seconds.
//   Para subagents que duram minutos, isso ainda funciona (delta capped em
//   15min = mais conservador que contar integral, mas evita acumular tools
//   travadas indefinidamente).
//
// Idempotente: rodar 2x seguidos em <1s nao dobra contagem (delta=0).
// Atomico: usa fs.renameSync via .tmp para evitar corrupcao concorrente.
// Silent: nunca imprime; sempre exit 0 (nao bloqueia tool use).

import fs from "node:fs";
import path from "node:path";

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_FILE = path.join(PROJECT_DIR, ".wolf", "task-timer.json");
const MAX_GAP_MINUTES_DEFAULT = 15;

function nowIsoSec() {
  const d = new Date();
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function atomicWriteJson(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function tick() {
  if (!fs.existsSync(STATE_FILE)) return;
  const state = safeReadJson(STATE_FILE);
  if (!state || !state.actives) return;

  const keys = Object.keys(state.actives);
  if (keys.length === 0) return;

  const now = new Date();
  let changed = false;

  for (const key of keys) {
    const a = state.actives[key];
    if (!a) continue;

    const started = new Date(a.assistant_turn_started_at || a.started_at);
    const ended = new Date(a.assistant_turn_ended_at || a.started_at);
    const lastEvent = ended > started ? ended : started;

    const deltaSec = Math.max(0, Math.floor((now - lastEvent) / 1000));
    if (deltaSec === 0) continue;

    const maxGapSec =
      ((a.max_gap_minutes || MAX_GAP_MINUTES_DEFAULT) * 60) | 0;
    const capped = Math.min(deltaSec, maxGapSec);

    a.accumulated_seconds = (a.accumulated_seconds || 0) + capped;
    a.assistant_turn_ended_at = nowIsoSec();
    changed = true;
  }

  if (changed) {
    try {
      atomicWriteJson(STATE_FILE, state);
    } catch {
      // Falha silenciosa — nunca bloquear tool use.
    }
  }
}

try {
  tick();
} catch {
  // Engole qualquer erro — hook NUNCA deve falhar tool/stop.
}
process.exit(0);
