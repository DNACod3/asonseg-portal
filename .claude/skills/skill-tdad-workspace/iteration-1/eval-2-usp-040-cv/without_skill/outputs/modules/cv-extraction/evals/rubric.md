# Rubric de avaliação — Extração de CV (USP-040)

Fact (eval suite) que define **como** medir a qualidade da extração por campo.
Acompanha `baseline.json` e `dataset.jsonl`. Materializa AC-040-1 (campos
estruturados corretos) e o anti-hallucination (Risco 4 da ADR-T-0012) como
métrica probabilística, conforme project-guideline §21.2.

## Campos avaliados

| Campo | Critério de acerto | Observação |
|---|---|---|
| `educationLevel` | match normalizado contra catálogo de escolaridade (Fundamental/Médio/Superior/etc., com "Completo/Incompleto") | normalização case/acento-insensível |
| `educationArea` | match semântico tolerante (sinônimos) contra a área do golden | `null` esperado quando ausente no CV |
| `experienceText` | recall de cargos/empresas/períodos presentes no golden (substring/entidades) | narrativa livre — avaliar cobertura, não igualdade textual |
| `skillsText` | recall de habilidades presentes no golden | idem |
| `coursesText` | recall de cursos/certificações presentes no golden | idem |
| `primaryAreaOfInterest` | match contra catálogo de áreas do portal | mapeamento, não texto livre |

## Métricas (registradas em `baseline.json`)

- **precision_per_field** — dos valores extraídos, quantos estão corretos. Falha: queda > 5% em qualquer campo.
- **recall_per_field** — do que existia no CV (golden), quanto foi extraído. Falha: queda > 5% em qualquer campo.
- **extraction_completeness** — % média de campos preenchidos quando presentes. Falha: queda > 5% absoluta.
- **hallucination_rate** — % de campos com valor que **não existe** no CV (golden marca cada campo como presente/ausente). Falha: > 2% absoluto. **Métrica mais crítica** — protege contra o LLM inventar dados (AC-040-2 confiança do candidato + LGPD).
- **latency_p95_s** — p95 do tempo end-to-end. Falha: aumento > 30% relativo OU acima do teto duro de 30s (PRD §6.1).

## Regras

- Dataset **congelado** (`dataset.jsonl@v1`). Alterar dataset = alterar baseline = PR explícito (Seção 21.2).
- Golden labels marcam, por campo: `value` esperado e `present_in_cv` (bool) — `present_in_cv=false` é o que permite calcular `hallucination_rate`.
- Mínimo 30 CVs: variar formato (PDF nativo, PDF escaneado/OCR, DOCX), qualidade e área (operacional, técnico, administrativo, saúde).
- Dados **sintéticos** (LGPD — §21.2); se reais, anonimizados (CPF, e-mail, telefone, nome alterados).

## Quando roda

- Em todo PR que toca `prompts/*.v*.ts`, o adapter, a constante `MODEL`, ou o dataset (workflow `eval-cv-extraction.yml`).
- Comparação automática contra `baseline.json` postada como comentário no PR (Seção 21.4).
