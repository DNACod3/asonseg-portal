// OpenWolf token-tick hook — acumula tokens de API por timer ativo.
//
// Roda em PostToolUse + UserPromptSubmit + Stop. Le o JSONL da sessao atual,
// encontra mensagens do assistant com campo `usage`, e soma input + cache +
// output tokens. Armazena o total em `accumulated_tokens` de cada timer ativo
// no task-timer.json.
//
// Campos adicionados a cada timer ativo:
//   accumulated_tokens: total de tokens desde o start
//
// Metadata top-level:
//   _token_meta.last_jsonl_path: caminho do ultimo JSONL lido
//   _token_meta.last_jsonl_offset: byte offset da ultima leitura
//
// Silencioso: nunca imprime; sempre exit 0.
// Atomico: usa fs.renameSync via .tmp para evitar corrupcao.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_FILE = path.join(PROJECT_DIR, ".wolf", "task-timer.json");
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

function getProjectSlug(projectDir) {
  // /Users/foo/bar → -Users-foo-bar
  return projectDir.replace(/\//g, "-");
}

function findLatestJsonl(slug) {
  const dir = path.join(CLAUDE_PROJECTS_DIR, slug);
  if (!fs.existsSync(dir)) return null;

  let latest = null;
  let latestMtime = 0;

  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".jsonl")) continue;
    const fp = path.join(dir, f);
    try {
      const stat = fs.statSync(fp);
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latest = fp;
      }
    } catch {
      // skip unreadable files
    }
  }

  return latest;
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

function countTokensInRange(jsonlPath, fromOffset) {
  try {
    const stat = fs.statSync(jsonlPath);
    if (stat.size <= fromOffset) return { tokens: 0, newOffset: fromOffset };

    const fd = fs.openSync(jsonlPath, "r");
    const buf = Buffer.alloc(stat.size - fromOffset);
    fs.readSync(fd, buf, 0, buf.length, fromOffset);
    fs.closeSync(fd);

    const text = buf.toString("utf-8");
    const lines = text.split("\n");
    let tokens = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === "assistant" && obj.message && obj.message.usage) {
          const u = obj.message.usage;
          tokens +=
            (u.input_tokens || 0) +
            (u.cache_creation_input_tokens || 0) +
            (u.cache_read_input_tokens || 0) +
            (u.output_tokens || 0);
        }
      } catch {
        // skip malformed lines
      }
    }

    return { tokens, newOffset: stat.size };
  } catch {
    return { tokens: 0, newOffset: fromOffset };
  }
}

function tick() {
  if (!fs.existsSync(STATE_FILE)) return;
  const state = safeReadJson(STATE_FILE);
  if (!state || !state.actives) return;

  const keys = Object.keys(state.actives);
  if (keys.length === 0) return;

  // Find current session JSONL
  const slug = getProjectSlug(PROJECT_DIR);
  const jsonlPath = findLatestJsonl(slug);
  if (!jsonlPath) return;

  // Get token metadata
  const meta = state._token_meta || {};
  let lastPath = meta.last_jsonl_path || "";
  let lastOffset = meta.last_jsonl_offset || 0;

  // If JSONL file changed (new session), reset offset
  if (lastPath !== jsonlPath) {
    lastOffset = 0;
  }

  // Count new tokens since last read
  const { tokens: newTokens, newOffset } = countTokensInRange(
    jsonlPath,
    lastOffset
  );

  if (newTokens === 0 && newOffset === lastOffset) return;

  // Distribute new tokens to all active timers
  for (const key of keys) {
    const a = state.actives[key];
    if (!a) continue;
    a.accumulated_tokens = (a.accumulated_tokens || 0) + newTokens;
  }

  // Update metadata
  state._token_meta = {
    last_jsonl_path: jsonlPath,
    last_jsonl_offset: newOffset,
  };

  try {
    atomicWriteJson(STATE_FILE, state);
  } catch {
    // Falha silenciosa — nunca bloquear tool use.
  }
}

try {
  tick();
} catch {
  // Engole qualquer erro — hook NUNCA deve falhar tool/stop.
}
process.exit(0);
