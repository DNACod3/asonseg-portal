# Extração de CV via IA Generativa (USP-040) Specification

> **Unidade U4 da Fase 3** (`.specs/project/ROADMAP.md`) — standalone, a maior unidade da fase.
> **Fontes upstream (source of truth — adaptado, não re-derivado):**
> - Rascunho de épico: `.specs/features/extracao-cv-ia/spec.md` (ACs CVE-01..CVE-08 — **IDs canônicos, preservados**).
> - PRD Épico 10 (Extração de CV por IA) — `docs/prd/prd-asonseg-portal-mvp.md`.
> - ADR-0012 (LLM com abstração via porta `CVExtractor`) — `docs/arch/0012-llm-extracao-cv-com-abstracao.md`; ADR-0005 (Storage).
> - `CLAUDE.md` (regra de abstração LLM, sequência da Server Action, View Models, auditoria, LGPD).

## Problem Statement

O cadastro de candidatos exige o preenchimento manual de diversos campos estruturados (escolaridade, área de formação, experiência, habilidades, cursos), o que é demorado e desestimula a conclusão do perfil — especialmente para o público vulnerável atendido pela ASONSEG. Muitos candidatos já possuem um currículo pronto em PDF/DOC/DOCX. A proposta é permitir o upload desse arquivo e usar IA generativa (provedor LLM) para extrair os campos e pré-preencher o formulário, reduzindo o esforço de cadastro.

Como o CV contém dados pessoais e passa por um provedor LLM externo, o tratamento exige consentimento LGPD específico (`CV_AI_EXTRACTION`). A extração é best effort: a IA nunca grava dados diretamente — a validação humana do candidato é obrigatória antes de qualquer persistência. Falhas de extração não podem bloquear o cadastro: deve haver fallback gracioso para o formulário manual. O custo de uso do LLM precisa ser monitorado e o uso protegido por rate limit.

## Goals

- [ ] Permitir upload de CV (PDF, DOC, DOCX) com validação de MIME real e tamanho ≤ 5MB, armazenando o arquivo original vinculado ao candidato.
- [ ] Extrair campos estruturados do CV via IA generativa atrás da porta `CVExtractor`, sem acoplamento direto ao SDK do provedor LLM.
- [ ] Pré-preencher o formulário com os campos extraídos e exigir validação/confirmação humana explícita antes de persistir.
- [ ] Garantir que a IA nunca grave dados diretamente no perfil — confirmação do candidato é pré-condição obrigatória da persistência.
- [ ] Exigir consentimento LGPD ativo `CV_AI_EXTRACTION` (citando o provedor LLM) antes do upload/extração.
- [ ] Tratar falha/extração vazia com fallback gracioso para preenchimento manual, sem mensagem de erro disruptiva.
- [ ] Aplicar rate limit de 3 uploads por candidato por dia.
- [ ] Auditar todo o fluxo (upload, extração, falha, confirmação) e monitorar custo/tokens/duração do LLM.

## Out of Scope

| Feature | Reason |
|---|---|
| Escolha do provedor LLM | **Já fixada** em CLAUDE.md + ADR-0012 + env `ANTHROPIC_*` → Anthropic Claude. Não é gate: a spec depende da porta `CVExtractor` (adapter Anthropic) resolvida via `shared/container.ts`. |
| Extração de formatos ≠ PDF/DOC/DOCX (imagem/JPG, ODT) | Fora do MVP — apenas os três MIME suportados. |
| Reextração agendada ou versionamento de múltiplos CVs por candidato | MVP mantém o CV original vinculado (`cvStoragePath` único); histórico/versões não previstos no PRD. |
| Tradução/normalização semântica avançada dos campos extraídos | Best effort de extração; normalização fina não está nos ACs. |
| Internacionalização (i18n) dos termos e mensagens | Sem i18n no MVP — apenas PT-BR. |
| Extração assíncrona por fila/worker | MVP roda a extração de forma **síncrona** na Server Action (ver Assumption A-05); `CandidateProfile` não tem coluna para estacionar rascunho não-confirmado (persistir violaria CVE-MN-01). |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida ou registrada aqui — nada fica silenciosamente indefinido. Todos os owners abaixo são `agent` (resolvidos por discrição, ancorados no código/ADRs existentes) → **nenhum item externo não-resolvido → Entry Gate LIVRE**.

| # | Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|---|
| A-01 | Provedor LLM | agent | Anthropic Claude via porta `CVExtractor` + adapter Anthropic | CLAUDE.md, ADR-0012 e `env.ANTHROPIC_*` já fixam Anthropic; o termo `CV_AI_EXTRACTION` v1.0 já cita "Anthropic Claude". | y |
| A-02 | Modelo LLM | agent | `env.ANTHROPIC_MODEL` (default `claude-sonnet-4-6`) | `claude-sonnet-4-6` é modelo **válido e atual** (verificado via skill claude-api), custo-adequado a extração de documento. Trocar = mudar a env var, sem alterar código. | y |
| A-03 | Autorização do candidato | agent | **Ownership por sessão** (`getCurrentPerson()`) sobre o próprio perfil — NÃO `requirePermission()` | O catálogo `PermissionId` não tem permissão de "upload CV"/"editar próprio perfil"; auto-serviço de candidato usa ownership + consentimento (precedente `activateCandidateRole`, USP-009). O passo "permission" da sequência da Server Action é satisfeito pela guarda de sessão. | y |
| A-04 | Rate limit — mecanismo e janela | agent | Tabela durável `CvUploadAttempt` (padrão `AuthAttempt`), janela = **dia-calendário em `America/Sao_Paulo`** (date-fns-tz) | Cota diária precisa sobreviver a restart e ser compartilhada (o `SlidingWindowRateLimiter` em memória não serve); "por dia" ⇒ dia-calendário no TZ do projeto. Só uploads **válidos** consomem cota (contados após validação, antes de storage/LLM). | y |
| A-05 | Extração síncrona vs. assíncrona | agent | **Síncrona** na Server Action, resultado retornado no `data` (draft) para o cliente pré-preencher; sem fila | O AC de p95≤30s permite assíncrono mas não exige; persistir um rascunho não-confirmado exigiria coluna nova e arriscaria CVE-MN-01. Feedback visual de processamento cobre o p95. | y |
| A-06 | Onde vivem upload/extração/confirmação | agent | Novo módulo `src/modules/cv-extraction/` detém as 3 Server Actions; escreve as **colunas de CV** de `candidate_profiles` | Jornada única e coesa (upload→extrair→confirmar); as colunas `cv*` existem para esta feature; candidato edita o próprio dado (regra de privacidade permite Prisma direto). Campos-base do perfil seguem de `persons` (USP-009). | y |
| A-07 | "Liberar o envio para moderação" (CVE-04) | agent | Confirmar **habilita** o envio; a submissão em si reusa `submitCandidateForModeration()` (USP-009) — `confirmCvFields` NÃO auto-submete | Evita duplicar o caminho de moderação e respeita a fronteira; os campos confirmados passam a fazer parte do perfil submetido normalmente. | y |
| A-08 | Extração de texto de DOC/DOCX | agent | PDF → bloco `document` nativo do Claude; **DOCX → texto** (ex.: `mammoth`); **DOC legado → best-effort** (pode cair no fallback manual) | A Messages API aceita PDF e texto, **não** DOC/DOCX (verificado via skill claude-api). Best-effort + fallback gracioso cobrem falha de conversão. Encapsulado no adapter. | y |
| A-09 | Structured outputs (`output_config.format`) | agent | **Não** usado (Sonnet 4.6 não suporta); JSON via instrução no prompt + parse defensivo + validação Zod; JSON malformado → falha ⇒ fallback | Sonnet 4.6 não está na lista de modelos com structured outputs; o parse defensivo já é exigido por CVE-05. | y |
| A-10 | Termo LGPD cita o provedor | agent | Termo `cv-ai-extraction/v1.0.md` **já existe e já cita "Anthropic Claude"** | Confirmado por leitura do arquivo; CVE-06 satisfeito sem editar termo nem hash do `terms-registry`. Um teste leve assevera que o termo cita um provedor. | y |
| A-11 | Metadados de custo — onde ficam | agent | No `audit_log` (`after`/`context`) do evento `CV_EXTRACTION_COMPLETED` (tokens/duração/custo/modelo) — **nunca** os valores extraídos (PII) | Evento já existe; agregação sobre `audit_log` cobre CVE-08. Privacidade: auditoria guarda metadados, não o conteúdo do CV. | y |
| A-12 | Semente de teste/E2E do extractor | agent | Flag de env guardada (ex.: `CV_EXTRACTOR_FAKE`, ignorada sob deploy Vercel real — padrão do `RATE_LIMIT_DISABLED`) faz o container ligar o `FakeCVExtractor` | Permite E2E determinístico sem chamada real ao LLM; guarda impede ativação em produção (memória: rate-limit-disabled-vercel-guard). | y |

**Open questions:** none — todas resolvidas/registradas acima.

---

## User Stories

### P1: Extração automática de CV via IA generativa ⭐ MVP

**User Story**: Como candidato, quero fazer upload do meu currículo em PDF/DOC/DOCX e ter os campos do formulário pré-preenchidos automaticamente pela IA, para que eu economize tempo no cadastro mantendo controle sobre os dados salvos.

**Why P1**: USP-040 é classificada como Must no PRD (Épico 10). Reduz fricção de cadastro do público-alvo vulnerável e aumenta a taxa de conclusão de perfis. O fluxo envolve dados pessoais sensíveis sob LGPD, exigindo tratamento cuidadoso (consentimento, validação humana, auditoria, controle de custo) desde o MVP.

**Acceptance Criteria** *(WHEN/THEN/SHALL — IDs CVE-NN preservados do upstream)*:

1. **(CVE-01 — Upload e validação)** QUANDO o candidato faz upload de um arquivo de CV ENTÃO o sistema DEVE validar o MIME real (PDF, DOC ou DOCX) e o tamanho (≤ 5MB) e, sendo válido, armazenar o arquivo original vinculado ao candidato (`cvStoragePath`, `cvSha256`, `cvUploadedAt`) e registrar auditoria `CV_UPLOADED`.
2. **(CVE-01 — Upload inválido)** QUANDO o arquivo enviado não for PDF/DOC/DOCX por MIME real OU exceder 5MB ENTÃO o sistema DEVE rejeitar o upload com mensagem clara em PT-BR e NÃO DEVE armazenar o arquivo nem invocar a IA.
3. **(CVE-02 — Extração via porta)** QUANDO o upload é concluído com sucesso ENTÃO o sistema DEVE invocar o serviço de IA generativa exclusivamente pela porta `CVExtractor` (sem acoplamento direto ao SDK do provedor) para extrair campos estruturados: escolaridade, área de formação, experiência, habilidades e cursos.
4. **(CVE-02 — Auditoria de extração)** QUANDO a extração é solicitada ENTÃO o sistema DEVE registrar auditoria `CV_EXTRACTION_REQUESTED` e, ao concluir com sucesso, `CV_EXTRACTION_COMPLETED` com metadados de tokens, duração e custo.
5. **(CVE-03 — Pré-preenchimento)** QUANDO a extração retorna campos ENTÃO o sistema DEVE pré-preencher o formulário com os valores extraídos, sinalizando que vieram da IA, e exibi-los para validação obrigatória pelo candidato.
6. **(CVE-04 — Validação humana obrigatória)** QUANDO há campos pré-preenchidos pela IA ENTÃO o sistema DEVE exigir confirmação explícita do candidato antes de persistir, e a IA NUNCA DEVE gravar os dados diretamente no perfil sem essa confirmação.
7. **(CVE-04 — Confirmação)** QUANDO o candidato revisa, ajusta e confirma os campos ENTÃO o sistema DEVE persistir os valores confirmados em `candidate_profiles`, atualizar `cvLastConfirmedAt`, registrar auditoria `CV_USER_CONFIRMED_FIELDS` e liberar o envio para moderação.
8. **(CVE-05 — Fallback gracioso)** QUANDO a extração falha ou retorna vazia ENTÃO o sistema DEVE registrar auditoria `CV_EXTRACTION_FAILED`, deixar os campos vazios para preenchimento manual e exibir mensagem amigável (sem erro disruptivo), permitindo concluir o cadastro normalmente.
9. **(CVE-06 — Consentimento LGPD)** QUANDO o candidato inicia o upload/extração de CV ENTÃO o sistema DEVE exigir consentimento ativo `CV_AI_EXTRACTION` (cujo termo cita o provedor LLM) via `requireActiveConsent`, bloqueando a operação caso o consentimento esteja ausente ou revogado.
10. **(CVE-07 — Rate limit)** QUANDO o candidato tenta um quarto upload de CV no mesmo dia ENTÃO o sistema DEVE bloquear o upload e informar o limite de 3 uploads por candidato por dia.
11. **(CVE-08 — Monitoramento de custo)** QUANDO uma extração via LLM ocorre ENTÃO o sistema DEVE registrar tokens, duração e custo associados à chamada para permitir monitoramento de custo agregado.

**Independent Test**: Com um candidato autenticado que possui consentimento `CV_AI_EXTRACTION` ativo, fazer upload de um PDF válido (≤ 5MB) e verificar: arquivo armazenado e auditado (`CV_UPLOADED`); extração invocada via porta `CVExtractor` (adapter fake) com auditoria `CV_EXTRACTION_REQUESTED`/`CV_EXTRACTION_COMPLETED`; formulário pré-preenchido sem persistência automática; persistência somente após confirmação explícita (`CV_USER_CONFIRMED_FIELDS`). Repetir simulando retorno `{ok:false}` do adapter e verificar `CV_EXTRACTION_FAILED` + fallback manual sem erro disruptivo. Validar rejeição de MIME/tamanho inválidos, bloqueio sem consentimento e bloqueio no quarto upload do dia.

---

## Edge Cases

- QUANDO o arquivo tem extensão `.pdf` mas o MIME real não corresponde a PDF/DOC/DOCX ENTÃO o sistema DEVE rejeitar o upload com base no MIME real, não na extensão.
- QUANDO o consentimento `CV_AI_EXTRACTION` é revogado entre o upload e a extração ENTÃO o sistema DEVE interromper a extração e não invocar o LLM.
- QUANDO a extração excede 30s (p95) ENTÃO o sistema DEVE manter feedback visual de processamento (a operação assíncrona é aceitável; ver A-05).
- QUANDO o LLM retorna JSON malformado ou parcialmente válido ENTÃO o sistema DEVE tratar como falha de extração (best effort) e seguir o fallback de preenchimento manual.
- QUANDO o candidato faz upload de um novo CV válido após uma extração anterior ENTÃO o sistema DEVE respeitar o rate limit diário de 3 uploads e contabilizar a nova tentativa.
- QUANDO o candidato fecha o formulário sem confirmar os campos pré-preenchidos ENTÃO o sistema DEVE NÃO persistir nenhum dado extraído (validação humana é pré-condição da persistência).
- QUANDO a IA retorna campos para áreas não previstas no formulário ENTÃO o sistema DEVE ignorar campos desconhecidos e mapear apenas escolaridade, área de formação, experiência, habilidades e cursos.
- QUANDO o upload no Storage falha após validação ENTÃO o sistema DEVE retornar `{ ok: false, error }` sem registrar `CV_UPLOADED` nem prosseguir para a extração.
- QUANDO o candidato ainda não ativou o papel candidato (sem `candidate_profiles`) ENTÃO o upload DEVE ser bloqueado com precondição (`PRECONDITION_FAILED`) — depende de USP-009.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, independente do caminho. Cada um exige um **teste negativo** que assevera que o resultado proibido não ocorre (ver `validate.md` §6b). Owning task e Negative test preenchidos em `tasks.md` (Check 4).

| ID | WHEN [contexto] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| CVE-MN-01 | QUANDO a IA retorna campos extraídos ENTÃO o sistema NÃO DEVE persistir nenhum desses campos em `candidate_profiles` sem confirmação explícita do candidato | Dados de IA não revisados gravados no perfil (fracasso LGPD/qualidade) | T13 (extract), T14 (confirm) | `extractCvFromUpload` (fake retorna campos) → colunas estruturadas de `candidate_profiles` inalteradas; só `confirmCvFields` grava |
| CVE-MN-02 | QUANDO o arquivo não é PDF/DOC/DOCX por MIME real OU excede 5MB ENTÃO o sistema NÃO DEVE armazená-lo no Storage nem invocar o LLM | Armazenamento de arquivo arbitrário / custo de LLM desperdiçado / vetor de injeção | T12 (upload) | Bytes não-PDF com nome `.pdf` (e arquivo >5MB) → `storage.upload` NÃO chamado; `cvStoragePath` inalterado; extractor nunca alcançado |
| CVE-MN-03 | QUANDO o consentimento `CV_AI_EXTRACTION` está ausente OU revogado (inclusive entre upload e extração) ENTÃO o sistema NÃO DEVE invocar o LLM | Tratar dado pessoal via LLM externo sem base legal (LGPD) | T12 (upload), T13 (extract) | Sem consentimento → bloqueado antes de storage; revogar entre upload e extract → fake do extractor NÃO chamado + `CONSENT_REQUIRED` + sem `CV_EXTRACTION_COMPLETED` |
| CVE-MN-04 | QUANDO o candidato já fez 3 uploads válidos no dia ENTÃO o sistema NÃO DEVE aceitar um 4º upload (armazenar/extrair) nesse dia | Abuso de custo de LLM / DoS | T12 (upload) | 3 `CvUploadAttempt` no dia + 4º `uploadCv` → `PRECONDITION_FAILED`; `storage.upload` NÃO chamado no 4º |
| CVE-MN-05 | QUANDO qualquer código de `src/` (fora o adapter Anthropic) é escrito ENTÃO ele NÃO DEVE importar o SDK do provedor LLM (`@anthropic-ai/sdk`) diretamente | Vendor lock-in / bypass da porta `CVExtractor` (regra LLM do CLAUDE.md) | T10 (guarda estática) | Guarda estática varre `src/` e falha se `@anthropic-ai` for importado fora do adapter allowlistado |
| CVE-MN-06 | QUANDO a extração falha/vazia/JSON malformado ENTÃO o sistema NÃO DEVE lançar erro disruptivo nem impedir a conclusão do cadastro | Cadastro quebrado por falha do LLM (best effort) | T13 (extract) | Fake retorna `{ok:false}` / JSON malformado → action retorna `{ok:true}` com flag de fallback, sem `throw`; cadastro segue completável |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| CVE-01 | USP-040 | Design | Pending |
| CVE-02 | USP-040 | Design | Pending |
| CVE-03 | USP-040 | Design | Pending |
| CVE-04 | USP-040 | Design | Pending |
| CVE-05 | USP-040 | Design | Pending |
| CVE-06 | USP-040 | Design | Pending |
| CVE-07 | USP-040 | Design | Pending |
| CVE-08 | USP-040 | Design | Pending |
| CVE-MN-01 | USP-040 | Design | Pending |
| CVE-MN-02 | USP-040 | Design | Pending |
| CVE-MN-03 | USP-040 | Design | Pending |
| CVE-MN-04 | USP-040 | Design | Pending |
| CVE-MN-05 | USP-040 | Design | Pending |
| CVE-MN-06 | USP-040 | Design | Pending |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 14 total (8 ACs + 6 must-nots), a mapear a tasks em `tasks.md`.

---

## Success Criteria

- [ ] Upload aceita apenas PDF/DOC/DOCX (validação por MIME real) e tamanho ≤ 5MB, com o arquivo original vinculado ao candidato.
- [ ] Extração ocorre exclusivamente pela porta `CVExtractor`, sem dependência direta do SDK do provedor LLM no código consumidor (guarda estática verde).
- [ ] Nenhum dado extraído é persistido sem confirmação explícita do candidato (validação humana obrigatória comprovada em teste negativo).
- [ ] Falha ou retorno vazio da IA resulta em fallback gracioso para o formulário manual, sem mensagem de erro disruptiva e sem bloquear o cadastro.
- [ ] Consentimento `CV_AI_EXTRACTION` (citando o provedor LLM) é exigido e validado antes de upload/extração; revogação interrompe o fluxo.
- [ ] Rate limit de 3 uploads por candidato por dia é aplicado e testado.
- [ ] Eventos `CV_UPLOADED`, `CV_EXTRACTION_REQUESTED`, `CV_EXTRACTION_COMPLETED`, `CV_EXTRACTION_FAILED` e `CV_USER_CONFIRMED_FIELDS` são registrados em auditoria.
- [ ] Custo, tokens e duração de cada extração são registrados para monitoramento (no `audit_log` de `CV_EXTRACTION_COMPLETED`; nunca o conteúdo do CV).
- [ ] Extração retorna em ≤ 30s no p95 (operação síncrona com feedback visual; assíncrona aceitável).
