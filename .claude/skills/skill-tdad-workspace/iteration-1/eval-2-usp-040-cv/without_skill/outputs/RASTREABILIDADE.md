# Matriz de rastreabilidade EARS → Fact — USP-040

Materializa a Seção 23 do project-guideline: **todo critério EARS tem fact
máquina-verificável**. Paths relativos à raiz do módulo no projeto real
(`src/modules/cv-extraction/`, `e2e/`, `features/`).

## Critérios de aceitação (EARS) — fonte: PRD §USP-040

- **AC-040-1** — WHEN upload de CV (PDF/DOC/DOCX ≤5MB) → invocar IA generativa para extrair campos estruturados (escolaridade, área, experiência, habilidades, cursos).
- **AC-040-2** — WHEN extração retorna → pré-preencher campos e exibir para validação obrigatória do candidato.
- **AC-040-3** — IF extração falha ou volta vazia → campos vazios para preenchimento manual, sem erro disruptivo.
- **AC-040-4** — SHALL exigir confirmação explícita antes de salvar.
- **AC-040-5** — SHALL armazenar o arquivo original do CV vinculado ao candidato.

## Pré-condições transversais (Notas da US + ADR-T-0012 + ADR-T-0009)

- **PRE-LGPD** — consentimento `CV_AI_EXTRACTION` (finalidade 7) é pré-condição; sem ele o CV não vai ao LLM.
- **PRE-AUTHZ** — só o próprio candidato (ou permissão) opera sobre o seu CV.
- **PRE-AUDIT** — trilha `CV_UPLOADED` / `CV_EXTRACTION_REQUESTED` / `_COMPLETED` / `_FAILED` / `CV_USER_CONFIRMED_FIELDS`, sem conteúdo cru do CV.

## Mapa AC → Fact

| AC / Pré | Tipo de fact | Artefato :: caso |
|---|---|---|
| AC-040-1 (happy) | Integration (Vitest) | `__tests__/extractCV.integration.test.ts` :: `AC-040-1 happy path: invoca LLM e extrai campos estruturados` |
| AC-040-1 (DOCX) | Integration | `extractCV.integration.test.ts` :: `AC-040-1 aceita DOCX` |
| AC-040-1 (>5MB) | Integration | `extractCV.integration.test.ts` :: `AC-040-1 rejeita arquivo > 5MB antes de chamar o LLM` |
| AC-040-1 (MIME) | Integration | `extractCV.integration.test.ts` :: `AC-040-1 rejeita MIME não suportado` |
| AC-040-1 (limites) | Schema Zod (unit) | `schemas/extractCVInput.ts` + `__tests__/extractCVInput.schema.test.ts` :: `uploadCVInputSchema (AC-040-1)` |
| AC-040-1 (qualidade) | Eval suite (LLM) | `evals/baseline.json` :: `precision_per_field` / `recall_per_field` / `extraction_completeness` + `evals/rubric.md` |
| AC-040-1 (latência) | Eval suite | `evals/baseline.json` :: `latency_p95_s` (teto 30s, PRD §6.1) |
| AC-040-1/3 (anti-halluc.) | Eval suite + Schema | `evals/baseline.json` :: `hallucination_rate` (≤2%) + `extractCVInput.schema.test.ts` :: `extractedCVFieldsSchema (anti-hallucination)` |
| AC-040-1 (BDD) | Gherkin | `features/usp-040-extracao-cv.feature` :: `Upload de CV válido invoca a IA generativa...` |
| AC-040-2 | Integration | `extractCV.integration.test.ts` :: `AC-040-2 pré-preenche campos e exige validação do candidato` |
| AC-040-2 (BDD) | Gherkin | `features/usp-040-extracao-cv.feature` :: `Campos extraídos são pré-preenchidos e exigem validação...` |
| AC-040-2/4/5 (E2E) | Playwright | `e2e/usp-040-extracao-cv.e2e.spec.ts` :: `AC-040-1/2/4/5 fluxo feliz...` |
| AC-040-3 (timeout) | Integration | `extractCV.integration.test.ts` :: `AC-040-3 falha de LLM (timeout) -> fallback gracioso...` |
| AC-040-3 (provider err) | Integration | `extractCV.integration.test.ts` :: `AC-040-3 falha de provider (PROVIDER_ERROR)...` |
| AC-040-3 (vazio) | Integration | `extractCV.integration.test.ts` :: `AC-040-3 extração vazia -> campos vazios...` |
| AC-040-3 (E2E) | Playwright | `e2e/usp-040-extracao-cv.e2e.spec.ts` :: `AC-040-3 fallback gracioso...` |
| AC-040-4 (sem conf.) | Integration | `extractCV.integration.test.ts` :: `AC-040-4 não persiste sem confirmação explícita` |
| AC-040-4 (com conf.) | Integration | `extractCV.integration.test.ts` :: `AC-040-4 persiste após confirmação explícita do candidato` |
| AC-040-4 (schema) | Schema Zod | `extractCVInput.schema.test.ts` :: `confirmCVFieldsInputSchema (AC-040-4)` (`confirmed === true`) |
| AC-040-5 | Integration | `extractCV.integration.test.ts` :: `AC-040-5 armazena o arquivo original vinculado ao candidato` |
| AC-040-5 (BDD) | Gherkin | `features/usp-040-extracao-cv.feature` :: `Arquivo original do CV é armazenado...` |
| PRE-LGPD (upload) | Integration | `extractCV.integration.test.ts` :: `CONSENT: uploadCV sem consentimento... não toca o Storage` |
| PRE-LGPD (extract) | Integration | `extractCV.integration.test.ts` :: `CONSENT: extractCV sem consentimento... não chama o LLM` |
| PRE-LGPD (outra fin.) | Integration | `extractCV.integration.test.ts` :: `CONSENT: consentimento de OUTRA finalidade não habilita a extração` |
| PRE-LGPD (BDD/E2E) | Gherkin + Playwright | `feature` :: `Não envia o CV ao provedor LLM sem consentimento ativo` + `e2e` :: `LGPD: sem aceitar o termo...` |
| PRE-AUTHZ | Integration | `extractCV.integration.test.ts` :: `AUTHZ: permissão negada retorna error e não chama o LLM` |
| PRE-AUDIT (sucesso) | Integration | `extractCV.integration.test.ts` :: `AUDIT: trilha CV_UPLOADED / CV_EXTRACTION_REQUESTED / COMPLETED` |
| PRE-AUDIT (falha) | Integration | `extractCV.integration.test.ts` :: `AUDIT: CV_EXTRACTION_FAILED registrado no ramo de falha` |
| PRE-AUDIT (minimização) | Integration | `extractCV.integration.test.ts` :: `AUDIT: nenhum log contém o conteúdo cru do CV` |
| PRE-AUDIT (confirmação) | Integration | `extractCV.integration.test.ts` :: `AUDIT: confirmação registra CV_USER_CONFIRMED_FIELDS` |

## Cobertura

Todos os 5 ACs + 3 pré-condições transversais possuem ao menos um fact executável.
Os dois eixos destacados pelo usuário estão cobertos com facts dedicados:

- **Dependência de LLM** → porta `CVExtractor` mockada (sucesso + 3 modos de falha), eval suite (`baseline.json` + `rubric.md` + `dataset.jsonl`) para qualidade/latência/alucinação.
- **Dependência de consentimento** → 3 facts de integração + BDD + E2E garantindo que sem `CV_AI_EXTRACTION` ativo nem o Storage nem o LLM são acionados.
