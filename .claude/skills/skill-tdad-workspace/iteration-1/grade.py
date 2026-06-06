#!/usr/bin/env python3
"""Grading programático das assertions do skill-tdad (iteration-1).
Checa cada run (with_skill / without_skill) e escreve grading.json em cada dir.
Assertions que exigem leitura qualitativa ficam como 'manual' (passed=None) para
revisão humana/inline — mas a maioria é verificável por conteúdo de arquivo."""
import json, re, pathlib, sys

ROOT = pathlib.Path(__file__).parent

EVALS = {
    "eval-0-usp-004-login": "004",
    "eval-1-usp-016-moderacao": "016",
    "eval-2-usp-040-cv": "040",
}

def read_all(d: pathlib.Path):
    """concat de todo o texto dos outputs + lista de paths relativos."""
    texts, paths = [], []
    for p in sorted(d.rglob("*")):
        if p.is_file():
            rel = str(p.relative_to(d))
            paths.append(rel)
            try:
                texts.append(p.read_text(encoding="utf-8", errors="ignore"))
            except Exception:
                texts.append("")
    return "\n".join(texts), paths

def has_feature(paths):
    return any(p.endswith(".feature") for p in paths)

def gherkin_ptbr(blob, paths):
    feats = [p for p in paths if p.endswith(".feature")]
    if not feats: return False, "nenhum .feature"
    ok = bool(re.search(r"Funcionalidade:", blob) and re.search(r"Cen[aá]rio", blob)
              and re.search(r"\bDado\b", blob) and re.search(r"\bQuando\b", blob)
              and re.search(r"\bEnt[aã]o\b", blob))
    return ok, f"{len(feats)} .feature; keywords PT-BR {'presentes' if ok else 'ausentes'}"

def tags_ac(blob, num):
    m = re.findall(rf"@ac-{num}-\d+", blob)
    return (len(m) > 0), f"{len(set(m))} tags @ac-{num}-N"

def vitest_red(blob, paths):
    specs = [p for p in paths if p.endswith((".spec.ts", ".test.ts")) and "e2e" not in p]
    if not specs: return False, "nenhum spec Vitest unit/integration"
    red = bool(re.search(r"not implemented|n[aã]o implementad|it\.todo|throw new Error", blob))
    return red, f"{len(specs)} spec(s); marca de red {'presente' if red else 'ausente'}"

def matriz_facts(blob, paths):
    has_matrix = any(re.search(r"trace|rastreab|ears.?to.?fact", p, re.I) for p in paths)
    has_block = bool(re.search(r"##\s*Facts", blob))
    return (has_matrix and has_block), f"matriz={has_matrix}, bloco '## Facts'={has_block}"

def estrutura_padrao(paths):
    has_bdd = any(re.search(r"(^|/)bdd/", p) for p in paths)
    has_unit = any(re.search(r"(^|/)unit/", p) for p in paths)
    has_e2e = any(re.search(r"(^|/)e2e/", p) for p in paths)
    has_trace = any("traceability" in p.lower() for p in paths)
    score = sum([has_bdd, has_unit, has_e2e, has_trace])
    return (score >= 3 and has_trace), f"bdd={has_bdd} unit={has_unit} e2e={has_e2e} traceability={has_trace}"

def cobertura(blob):
    ok = bool(re.search(r"\b\d/\d\b.*(AC|crit)|cobertura", blob, re.I))
    return ok, "menção explícita de cobertura X/Y" if ok else "sem cobertura declarada"

def respeitou_output(paths):
    bad = [p for p in paths if p.startswith("src/")]
    return (len(bad) == 0), ("nenhum arquivo em src/" if not bad else f"{len(bad)} em src/")

def while_e_if(blob):
    has_while = bool(re.search(r"12h|12 ?h|inatividad|sess[aã]o|expir", blob, re.I))
    has_if = bool(re.search(r"5 ?tentativ|tentativas|bloque|TOO_MANY|rate.?limit", blob, re.I))
    return (has_while and has_if), f"sessão12h={has_while}, lockout5={has_if}"

def maquina_estados(blob):
    ok = bool(re.search(r"transitionContent", blob)) and not bool(re.search(r"prisma\.\w*\.update\(", blob))
    soft = bool(re.search(r"transitionContent|m[aá]quina de estado|state machine|TRANSITIONS", blob))
    return soft, f"referência a máquina de estados {'presente' if soft else 'ausente'}; transitionContent={'sim' if 'transitionContent' in blob else 'não'}"

def casos_obrigatorios(blob):
    perm = bool(re.search(r"requirePermission|FORBIDDEN|permiss[aã]o recus|MODERATE_", blob))
    inval = bool(re.search(r"INVALID_TRANSITION|transi[cç][aã]o inv[aá]lida", blob, re.I))
    just = bool(re.search(r"justificativa|JUSTIFICATION", blob, re.I))
    score = sum([perm, inval, just])
    return (score >= 2), f"permissão={perm}, transição_inválida={inval}, justificativa={just}"

def llm_eval_suite(blob, paths):
    has_baseline = any("baseline" in p.lower() for p in paths)
    metrics = bool(re.search(r"hallucination|precision_per_field|latency_p95|recall_per_field", blob))
    return (has_baseline and metrics), f"baseline.json={has_baseline}, métricas eval={metrics}"

def consentimento(blob):
    ok = bool(re.search(r"CONSENT_REQUIRED", blob)) and bool(re.search(r"CV_AI_EXTRACTION", blob))
    return ok, f"CONSENT_REQUIRED={'sim' if 'CONSENT_REQUIRED' in blob else 'não'}, finalidade CV_AI_EXTRACTION={'sim' if 'CV_AI_EXTRACTION' in blob else 'não'}"

def mock_port(blob):
    port = bool(re.search(r"CVExtractor|cv-extractor|port", blob))
    # só conta como violação um import/instanciação REAL do SDK (não menção em comentário)
    real_sdk = [l for l in blob.splitlines()
                if (re.search(r"import .*@anthropic-ai/sdk", l) or re.search(r"new Anthropic\(", l))
                and not l.lstrip().startswith("//")]
    no_sdk = len(real_sdk) == 0
    return (port and no_sdk), f"usa port={port}, sem import real do SDK={no_sdk}"

CHECKS = {
    "gherkin_ptbr": lambda blob, paths, num: gherkin_ptbr(blob, paths),
    "tags_ac": lambda blob, paths, num: tags_ac(blob, num),
    "vitest_red": lambda blob, paths, num: vitest_red(blob, paths),
    "matriz_facts": lambda blob, paths, num: matriz_facts(blob, paths),
    "estrutura_padrao": lambda blob, paths, num: estrutura_padrao(paths),
    "cobertura_total": lambda blob, paths, num: cobertura(blob),
    "respeitou_output": lambda blob, paths, num: respeitou_output(paths),
    "while_e_if": lambda blob, paths, num: while_e_if(blob),
    "maquina_estados": lambda blob, paths, num: maquina_estados(blob),
    "casos_obrigatorios": lambda blob, paths, num: casos_obrigatorios(blob),
    "llm_eval_suite": lambda blob, paths, num: llm_eval_suite(blob, paths),
    "consentimento": lambda blob, paths, num: consentimento(blob),
    "mock_port": lambda blob, paths, num: mock_port(blob),
}

for eval_dir, num in EVALS.items():
    meta = json.loads((ROOT / eval_dir / "eval_metadata.json").read_text())
    for cfg in ["with_skill", "without_skill"]:
        outdir = ROOT / eval_dir / cfg / "outputs"
        if not outdir.exists():
            continue
        blob, paths = read_all(outdir)
        expectations = []
        for a in meta["assertions"]:
            fn = CHECKS.get(a["id"])
            if fn is None:
                passed, ev = None, "sem checker programático"
            else:
                passed, ev = fn(blob, paths, num)
            expectations.append({"text": a["text"], "passed": bool(passed), "evidence": ev})
        passed = sum(1 for e in expectations if e["passed"])
        total = len(expectations)
        timing = json.loads((ROOT / eval_dir / cfg / "timing.json").read_text())
        grading = {"expectations": expectations,
                   "summary": {"passed": passed, "failed": total - passed,
                               "total": total, "pass_rate": round(passed / total, 4)},
                   "timing": {"total_duration_seconds": timing.get("total_duration_seconds")},
                   "execution_metrics": {"total_tokens": timing.get("total_tokens")}}
        (ROOT / eval_dir / cfg / "grading.json").write_text(json.dumps(grading, ensure_ascii=False, indent=2))
        print(f"{eval_dir}/{cfg}: {passed}/{total}")
