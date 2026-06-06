# RESUMO — Facts (testes fonte da verdade) da USP-040

**US:** USP-040 — Extração automática de CV via IA generativa (Épico 10).
**Objetivo:** transformar os critérios EARS AC-040-1..5 em artefatos máquina-verificáveis
(princípio P1 / Seção 23 do project-guideline), refletindo explicitamente as duas
dependências centrais da US: **LLM** e **consentimento LGPD**.

## Fontes usadas
- `docs/prd/prd-asonseg-portal-mvp.md` — USP-040 (AC-040-1..5) e §6.1 (latência ≤30s p95).
- `docs/arch/0012-llm-extracao-cv-com-abstracao.md` — porta `CVExtractor`, fluxo 3 Server Actions, fallback, audit, anti-hallucination, finalidade 7.
- `docs/arch/0009-consentimentos-lgpd-por-finalidade.md` — `CV_AI_EXTRACTION` como pré-condição lazy.
- `docs/arch/technical-design.md` §3.6 — `uploadCV`/`extractCV`/`confirmCVFields`, campos `candidate_profiles` (cvStoragePath, cvSha256, cvLastConfirmedAt), eventos de audit.
- `docs/arch/project-guideline.md` §20–23 — Server Action canônica, tipos de fact, eval suite LLM, EARS→Fact.

## Artefatos entregues (em `outputs/`)
| Artefato | Tipo de fact | Cobre |
|---|---|---|
| `modules/cv-extraction/schemas/extractCVInput.ts` | Schema Zod | AC-040-1 (≤5MB, MIME PDF/DOC/DOCX), AC-040-4 (confirmação explícita) |
| `modules/cv-extraction/ports/cv-extractor.ts` | Port (seam mockável) | dependência de LLM via abstração (ADR-T-0012) |
| `modules/cv-extraction/__tests__/extractCV.integration.test.ts` | Vitest integração (RED) | AC-040-1..5 + consentimento + authz + auditoria |
| `modules/cv-extraction/__tests__/extractCVInput.schema.test.ts` | Vitest unit (RED) | limites de upload, confirmação, anti-hallucination de formato |
| `modules/cv-extraction/__tests__/helpers.ts` | Stubs de harness | mantém os testes vermelhos por design |
| `features/usp-040-extracao-cv.feature` | Gherkin/BDD (pt) | todos os ACs + LGPD |
| `e2e/usp-040-extracao-cv.e2e.spec.ts` | Playwright (esqueleto) | fluxo crítico ponta-a-ponta + fallback + termo LGPD |
| `modules/cv-extraction/evals/baseline.json` | Eval LLM | qualidade/latência/alucinação (thresholds normativos) |
| `modules/cv-extraction/evals/rubric.md` | Eval LLM | como medir cada campo |
| `modules/cv-extraction/evals/dataset.jsonl` | Eval LLM | amostra (3 casos) do dataset congelado, golden com `present_in_cv` |
| `RASTREABILIDADE.md` | Matriz | AC/pré-condição → fact (1:N) |

## Como as duas dependências da US foram refletidas nos facts
**LLM (probabilístico/externo):**
- Os testes de integração mockam a **porta `CVExtractor`**, nunca o SDK Anthropic (ADR-T-0012 Opção B) — fica fiel ao acoplamento real.
- Cobertos ambos os ramos: sucesso e falha (`TIMEOUT`, `PROVIDER_ERROR`, retorno vazio) com **fallback gracioso** (AC-040-3) — a Action retorna `ok:true` com campos nulos, sem erro disruptivo.
- A qualidade do LLM (que não cabe em assert determinístico) vira **eval suite**: `precision/recall_per_field`, `extraction_completeness`, `hallucination_rate ≤2%`, `latency_p95 ≤30s`. Thresholds são o fact normativo; valores de baseline são placeholders a confirmar no Kickoff Gate.

**Consentimento (LGPD, finalidade 7 `CV_AI_EXTRACTION`):**
- 3 facts de integração garantem que **sem consentimento ativo** o sistema retorna `CONSENT_REQUIRED` e (crítico) **não toca o Storage no upload nem chama o LLM na extração** — verificado por spies. Inclui o caso de consentimento de outra finalidade não habilitar a extração.
- Reforçado em BDD e E2E (termo exibido, upload bloqueado sem aceite).
- Trilha de auditoria sem conteúdo cru do CV (minimização) também é fact.

## Notas / decisões
- A US foi modelada como **3 Server Actions** (`uploadCV` → `extractCV` → `confirmCVFields`), exatamente como o technical-design §3.6, em vez de uma só — por isso os facts cobrem a separação (upload persiste arquivo+hash; extract chama LLM; confirm persiste após confirmação explícita).
- Os testes nascem **VERMELHOS** intencionalmente: importam de `@/modules/cv-extraction/...` (ainda inexistente) e os helpers lançam "não implementado". Isso é o esperado para facts pré-implementação (TDD / Kickoff Gate).
- Nada foi escrito em `src/` nem em `.specs/` do projeto; os paths em `outputs/` espelham a estrutura-alvo (`modules/cv-extraction/`, `e2e/`, `features/`) para facilitar o transplante.
- Próximo passo do squad: prover o harness (`helpers.ts` reais + container DI de teste) e expandir `dataset.jsonl` para ≥30 CVs sintéticos antes de fechar o Kickoff Gate.
