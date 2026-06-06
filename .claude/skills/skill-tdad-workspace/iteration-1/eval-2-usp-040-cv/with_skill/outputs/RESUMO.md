# RESUMO — Facts (fonte da verdade) da USP-040: Extração automática de CV via IA generativa

Gerado pela skill-tdad (EARS → Fact). Todos os artefatos em estado **Red** (falham por ausência
de implementação, prontos para a fase Execute). Idioma PT-BR.

## Fontes da verdade consultadas
- PRD §5.2 **USP-040** (5 ACs verbatim) · §6.1 (latência ≤30s p95) · §6.7 (LGPD/ZDR)
- **ADR-0018** (negócio) — extração via IA, validação humana obrigatória, best effort
- **ADR-T-0012** (técnico) — porta `CVExtractor` + adapter Anthropic Claude, erros tipados, auditoria, ZDR, não-vazamento
- **ADR-T-0009** — consentimento por finalidade; finalidade 7 `CV_AI_EXTRACTION`
- **project-guideline** §4 (Server Action), §7 (LLM só pela porta), §8 (consentimento), §12 (casos obrigatórios), §21 (eval suite LLM)
- **architecture-document** §6 — USP-040 é o **fluxo crítico Top 8 #7** → tem E2E

## Critérios de Aceitação cobertos (5/5)
| AC | EARS | Resumo |
|----|------|--------|
| AC-040-1 | WHEN…SHALL | upload (PDF/DOC/DOCX ≤5MB) → invoca IA e extrai campos estruturados |
| AC-040-2 | WHEN…SHALL | extração retorna → pré-preenche + validação obrigatória |
| AC-040-3 | IF…THEN | falha/vazia → campos vazios, sem erro disruptivo (fallback) |
| AC-040-4 | SHALL (invariante) | confirmação explícita obrigatória antes de salvar |
| AC-040-5 | SHALL (invariante) | armazenar arquivo original vinculado ao candidato |

## Facts por tipo
- **Gherkin BDD** (`bdd/usp-040-extracao-cv.feature`): 13 cenários (happy paths, 2 Esquemas de Cenário, fallback, invariantes, consentimento, permissão, não-vazamento LGPD).
- **Vitest red** (`unit/usp-040-extracao-cv.spec.ts`): testes de integração mockando a **porta** `CVExtractor` (nunca o SDK). Cobre os 5 casos obrigatórios §12: happy path · validação Zod (mime/tamanho) · permissão · consentimento ausente · concorrência (it.todo justificado).
- **Eval suite** (`unit/usp-040-eval-baseline.json`): fact da **qualidade/latência** do LLM (precision/recall por campo, completeness, hallucination_rate, latency_p95) com thresholds da §21.2; `baseline=null` (red) até a primeira run aprovada. É aqui que vivem os ACs probabilísticos — não viram teste determinístico (P3).
- **Playwright E2E** (`e2e/usp-040-extracao-cv.e2e.ts`): 4 cenários `test.fixme` do fluxo crítico Top 8 #7 (upload→extração→revisão→confirmação, fallback, termo de consentimento).
- **Matriz de rastreabilidade** (`traceability.md`): AC → fact → path-alvo → status, + bloco `## Facts` pronto para o corpo do issue (Kickoff Gate §22/§23).

## Como LLM e consentimento ficaram refletidos (pedido explícito do usuário)
- **LLM:** a invocação determinística (que a porta foi chamada, ordem dos eventos de auditoria, fallback nos erros tipados `TIMEOUT/PROVIDER_ERROR/PARSE_ERROR`) é ancorada por testes de integração **mockando a porta `CVExtractor`** — código consumidor nunca toca o SDK Anthropic (ADR-T-0012/§7). A **qualidade e a latência** (probabilísticas) são ancoradas pela **eval suite** (`baseline.json`), conforme P3 e §21, não por assertion de teste. Anti-alucinação → `hallucination_rate > 2%` = falha.
- **Consentimento:** embora o texto dos ACs não cite consentimento, a US depende da finalidade 7 `CV_AI_EXTRACTION`. Fact obrigatório garante que, sem consentimento ativo, a ação retorna `CONSENT_REQUIRED` e o **CV não é enviado ao LLM** (ordem da §4: validar → permissão → consentimento → pré-condições → audit).

## Cobertura e gate
- **5/5 ACs com fact** + 5 facts obrigatórios de Server Action sensível + 3 cenários E2E.
- Sem lacunas bloqueantes de Kickoff Gate.

## Lacunas / pendências (não bloqueiam o Gate; resolver antes do Green)
1. Códigos de erro da Server Action (`FORMATO_NAO_SUPORTADO`, `ARQUIVO_MUITO_GRANDE`, `CONFIRMATION_REQUIRED`) propostos por consistência com `ActionResult`; confirmar nomes finais no schema/catálogo do módulo na implementação (a ADR-T-0012 só tipa os erros do *extractor*).
2. Dataset da eval suite (≥30 CVs sintéticos) + `rubric.md` ainda não existem — necessários para o `baseline.json` sair de `null` (red→medido). Trabalho da fase Execute/spike.
3. `primaryAreaOfInterest` existe no contrato da porta mas não no AC verbatim — tratado como opcional; não enfraquece nenhum AC.

## Arquivos gerados
```
outputs/
├── RESUMO.md
├── traceability.md
├── bdd/usp-040-extracao-cv.feature
├── unit/usp-040-extracao-cv.spec.ts
├── unit/usp-040-eval-baseline.json
└── e2e/usp-040-extracao-cv.e2e.ts
```
