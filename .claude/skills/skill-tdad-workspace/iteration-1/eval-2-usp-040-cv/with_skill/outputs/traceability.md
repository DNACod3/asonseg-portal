# Rastreabilidade EARS → Fact — USP-040 Extração automática de CV via IA generativa

Fonte: PRD §5.2 USP-040 · §6.1 (latência ≤30s p95) · §6.7 (LGPD/ZDR) · ADR-0018 (negócio) ·
ADR-T-0012 (abstração CVExtractor + Anthropic Claude) · ADR-T-0009 (consentimento finalidade 7
`CV_AI_EXTRACTION`) · project-guideline §4, §7, §8, §12, §21 · architecture-document §6 (fluxo Top 8 #7).
Gerado por skill-tdad. **Cobertura: 5/5 ACs com fact.** Todos os facts em estado **Red**.

Módulo: `cv-extraction`. Server Actions de referência: `uploadCvEExtrair` (upload+extração) e
`confirmCVFields` (confirmação humana). LLM consumido **só pela porta `CVExtractor`** (ADR-T-0012, §7).

| AC | Tipo EARS | Texto (verbatim) | Tipo de fact | Cenário BDD | Path-alvo do fact | Status |
|----|-----------|------------------|--------------|-------------|-------------------|--------|
| AC-040-1 | WHEN…SHALL | WHEN o candidato faz upload do CV (PDF, DOC ou DOCX até 5MB), the system SHALL invocar serviço de IA generativa para extrair campos estruturados (escolaridade, área de formação, experiência, habilidades, cursos). | integração (invocação determinística) | `@ac-040-1 @happy-path` | `modules/cv-extraction/__tests__/uploadCvEExtrair.integration.test.ts::happy-path` | Red |
| AC-040-1 | WHEN…SHALL (validação de fronteira) | (mesmo AC — limite 5MB e formatos PDF/DOC/DOCX) | schema Zod + unit | `@ac-040-1 @validacao` | `modules/cv-extraction/schemas/cvUploadInput.ts` + `…::validacao-mime-tamanho` | Red |
| AC-040-1 | WHEN…SHALL (qualidade/latência) | (mesmo AC — qualidade e latência da extração LLM) | métrica de eval suite | (n/a — probabilístico) | `modules/cv-extraction/evals/baseline.json::precision_per_field,recall_per_field,extraction_completeness,latency_p95` | Red |
| AC-040-2 | WHEN…SHALL | WHEN a extração retorna, the system SHALL pré-preencher os campos do formulário e exibir os valores para validação obrigatória pelo candidato. | integração + eval (alucinação) | `@ac-040-2` | `…::pre-preenche-para-validacao` + `…/evals/baseline.json::hallucination_rate` | Red |
| AC-040-3 | IF…THEN | IF a extração falha ou retorna vazia, THEN the system SHALL deixar os campos vazios para preenchimento manual sem mensagem de erro disruptiva. | integração (fallback) | `@ac-040-3 @fallback` | `…::fallback-extracao-falha` | Red |
| AC-040-4 | SHALL (ubíquo/invariante) | The system SHALL exigir confirmação explícita do candidato antes de salvar os dados extraídos. | integração | `@ac-040-4 @invariante` | `modules/cv-extraction/__tests__/confirmCVFields.integration.test.ts::confirmacao-obrigatoria` | Red |
| AC-040-5 | SHALL (ubíquo/invariante) | The system SHALL armazenar o arquivo original do CV vinculado ao candidato. | integração | `@ac-040-5 @invariante` | `…uploadCvEExtrair.integration.test.ts::armazena-arquivo-original` | Red |

## Facts adicionais (casos obrigatórios de Server Action sensível — project-guideline §12)

Não são ACs explícitos da US, mas a sequência canônica da Server Action (§4) e os requisitos
LGPD da ADR-T-0012 os tornam obrigatórios. Sem eles a US não passa no Kickoff Gate.

| Caso obrigatório | Tipo de fact | Cenário BDD | Path-alvo do fact | Status |
|------------------|--------------|-------------|-------------------|--------|
| Consentimento ausente (`CV_AI_EXTRACTION`) → `CONSENT_REQUIRED`, CV não vai ao LLM | integração | `@consentimento` | `…::consentimento-ausente` | Red |
| Permissão recusada (sem papel candidato) → `PERMISSION_DENIED` | integração | `@permissao` | `…::permissao-negada` | Red |
| Auditoria `CV_EXTRACTION_REQUESTED/COMPLETED/FAILED` + `CV_USER_CONFIRMED_FIELDS` | integração | `@ac-040-1`, `@ac-040-3`, `@ac-040-4` | `…::audita-eventos-extracao` | Red |
| Não-vazamento: conteúdo do CV / raw response nunca em log | integração (it.todo) | `@lgpd` | `…::nao-vazamento-conteudo-cv` | Red (todo) |
| Validação Zod: mime não suportado / >5MB rejeitado antes do LLM | schema Zod + unit | `@ac-040-1 @validacao` | `modules/cv-extraction/schemas/cvUploadInput.ts` | Red |

## Facts E2E (fluxo crítico Top 8 #7 — architecture-document §6)

| Fluxo | Cenário | Path-alvo | Status |
|-------|---------|-----------|--------|
| Upload → extração → revisão → confirmação | AC-040-1/2/4 | `e2e/usp-040-extracao-cv.e2e.ts` | Red (`test.fixme`) |
| Fallback gracioso na falha de extração | AC-040-3 | `e2e/usp-040-extracao-cv.e2e.ts` | Red (`test.fixme`) |
| Exibição do termo da finalidade quando sem consentimento | consentimento | `e2e/usp-040-extracao-cv.e2e.ts` | Red (`test.fixme`) |

## Bloco "## Facts" (para o corpo do issue — Kickoff Gate, §22/§23)

- AC-040-1 (invocação) → `modules/cv-extraction/__tests__/uploadCvEExtrair.integration.test.ts::happy-path`
- AC-040-1 (validação 5MB/formato) → `modules/cv-extraction/schemas/cvUploadInput.ts` (Zod) + `…::validacao-mime-tamanho`
- AC-040-1 (qualidade/latência LLM) → `modules/cv-extraction/evals/baseline.json::precision_per_field,recall_per_field,extraction_completeness,latency_p95` (thresholds §21.2)
- AC-040-2 (pré-preenche + validação obrigatória) → `…::pre-preenche-para-validacao`
- AC-040-2 (anti-alucinação) → `modules/cv-extraction/evals/baseline.json::hallucination_rate` (> 2% = falha)
- AC-040-3 (fallback gracioso) → `…::fallback-extracao-falha`
- AC-040-4 (confirmação humana obrigatória) → `modules/cv-extraction/__tests__/confirmCVFields.integration.test.ts::confirmacao-obrigatoria`
- AC-040-5 (armazenar CV original) → `…uploadCvEExtrair.integration.test.ts::armazena-arquivo-original`
- Consentimento finalidade 7 → `…::consentimento-ausente`
- Permissão papel candidato → `…::permissao-negada`
- Auditoria → `…::audita-eventos-extracao`
- E2E (fluxo crítico #7) → `e2e/usp-040-extracao-cv.e2e.ts`

## Lacunas / decisões pendentes

Nenhum AC ficou sem fact. Pontos a confirmar na fase Execute (não bloqueiam o Gate, mas devem
ser resolvidos antes do Green):

1. **Códigos de erro de validação de fronteira** (`FORMATO_NAO_SUPORTADO`, `ARQUIVO_MUITO_GRANDE`)
   e de confirmação (`CONFIRMATION_REQUIRED`) são propostos por esta skill por consistência com o
   padrão `ActionResult` (§4); a ADR-T-0012 só tipa os erros do *extractor* (`TIMEOUT`,
   `PROVIDER_ERROR`, `PARSE_ERROR`, `UNSUPPORTED_FORMAT`). Confirmar os códigos finais da Server
   Action no schema Zod / catálogo de erros do módulo na implementação.
2. **Dataset da eval suite (≥30 CVs sintéticos)** ainda não existe — `dataset.jsonl` e `rubric.md`
   precisam ser construídos para que o `baseline.json` saia de `null` (red) para medido (§21.2).
   Isso é trabalho da fase Execute / spike, não desta skill.
3. **`primaryAreaOfInterest`** (mapeamento para o catálogo de áreas, citado na ADR-T-0012 mas não
   no texto verbatim do AC-040-1) foi incluído no contrato da porta mas não é exigido pelos ACs;
   tratado como campo opcional — não enfraquece nenhum AC.

## Notas de fidelidade ao contrato

- **LLM (P3):** qualidade e latência da extração são ancoradas por **eval suite** (`baseline.json`),
  não por teste determinístico — exigência da taxonomia EARS (item 3) e da §21. O teste de
  integração mocka a **porta** `CVExtractor`, nunca o SDK Anthropic (ADR-T-0012, §7).
- **Consentimento:** AC-040 não cita consentimento no texto, mas a US depende da finalidade 7
  `CV_AI_EXTRACTION` (ADR-T-0009, §8, ADR-T-0012 pré-condição). O fact de consentimento ausente é
  obrigatório (§12) e ancora que o CV **não** é enviado ao LLM sem consentimento.
- **Não-enfraquecimento (P4):** AC-040-3 (erro) tem cenário de fallback próprio, não só o happy
  path; AC-040-4 tem tanto o caminho bloqueado (sem confirmação) quanto o confirmado.

Status válidos: `Red` (gerado, falhando) → `Green` (implementado, passando) → `Verified`. Entrega em `Red`.
