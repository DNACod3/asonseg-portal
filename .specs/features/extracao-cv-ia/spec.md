# Extração de CV via IA Generativa Specification

## Problem Statement

O cadastro de candidatos exige o preenchimento manual de diversos campos estruturados (escolaridade, área de formação, experiência, habilidades, cursos), o que é demorado e desestimula a conclusão do perfil — especialmente para o público vulnerável atendido pela ASONSEG. Muitos candidatos já possuem um currículo pronto em PDF/DOC/DOCX. A proposta é permitir o upload desse arquivo e usar IA generativa (provedor LLM) para extrair os campos e pré-preencher o formulário, reduzindo o esforço de cadastro.

Como o CV contém dados pessoais e passa por um provedor LLM externo, o tratamento exige consentimento LGPD específico (CV_AI_EXTRACTION). A extração é best effort: a IA nunca grava dados diretamente — a validação humana do candidato é obrigatória antes de qualquer persistência. Falhas de extração não podem bloquear o cadastro: deve haver fallback gracioso para o formulário manual. O custo de uso do LLM precisa ser monitorado e o uso protegido por rate limit.

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
| Escolha definitiva do provedor LLM | Decisão do Arquiteto na Fase 0 (Q-aberta); ver ADR-0018. A spec depende apenas da porta `CVExtractor`. |
| Extração de CV em formatos diferentes de PDF/DOC/DOCX (ex.: imagem/JPG, ODT) | Fora do escopo do MVP — apenas os três MIME suportados. |
| Reextração automática agendada ou versionamento de múltiplos CVs por candidato | MVP mantém o CV original vinculado; histórico/versões não previstos no PRD. |
| Tradução/normalização semântica avançada dos campos extraídos | Best effort de extração; normalização fina não está nos ACs. |
| Internacionalização (i18n) dos termos e mensagens | Sem i18n no MVP — apenas PT-BR. |

## User Stories

### P1: Extração automática de CV via IA generativa ⭐ MVP

**User Story**: Como candidato, quero fazer upload do meu currículo em PDF/DOC/DOCX e ter os campos do formulário pré-preenchidos automaticamente pela IA, para que eu economize tempo no cadastro mantendo controle sobre os dados salvos.

**Why P1**: USP-040 é classificada como Must no PRD (Épico 10). Reduz fricção de cadastro do público-alvo vulnerável e aumenta a taxa de conclusão de perfis. O fluxo envolve dados pessoais sensíveis sob LGPD, exigindo tratamento cuidadoso (consentimento, validação humana, auditoria, controle de custo) desde o MVP.

**Acceptance Criteria**:

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

**Independent Test**: Com um candidato autenticado que possui consentimento `CV_AI_EXTRACTION` ativo, fazer upload de um PDF válido (≤ 5MB) e verificar: arquivo armazenado e auditado (`CV_UPLOADED`); extração invocada via porta `CVExtractor` (adapter mockado) com auditoria `CV_EXTRACTION_REQUESTED`/`CV_EXTRACTION_COMPLETED`; formulário pré-preenchido sem persistência automática; persistência somente após confirmação explícita (`CV_USER_CONFIRMED_FIELDS`). Repetir simulando retorno `{ok:false}` do adapter e verificar `CV_EXTRACTION_FAILED` + fallback manual sem erro disruptivo. Validar rejeição de MIME/tamanho inválidos, bloqueio sem consentimento e bloqueio no quarto upload do dia.

## Edge Cases

- QUANDO o arquivo tem extensão `.pdf` mas o MIME real não corresponde a PDF/DOC/DOCX ENTÃO o sistema DEVE rejeitar o upload com base no MIME real, não na extensão.
- QUANDO o consentimento `CV_AI_EXTRACTION` é revogado entre o upload e a extração ENTÃO o sistema DEVE interromper a extração e não invocar o LLM.
- QUANDO a extração excede 30s (p95) ENTÃO o sistema DEVE manter feedback visual de processamento, sendo a operação assíncrona aceitável.
- QUANDO o LLM retorna JSON malformado ou parcialmente válido ENTÃO o sistema DEVE tratar como falha de extração (best effort) e seguir o fallback de preenchimento manual.
- QUANDO o candidato faz upload de um novo CV válido após uma extração anterior ENTÃO o sistema DEVE respeitar o rate limit diário de 3 uploads e contabilizar a nova tentativa.
- QUANDO o candidato fecha o formulário sem confirmar os campos pré-preenchidos ENTÃO o sistema DEVE NÃO persistir nenhum dado extraído (validação humana é pré-condição da persistência).
- QUANDO a IA retorna campos para áreas não previstas no formulário ENTÃO o sistema DEVE ignorar campos desconhecidos e mapear apenas escolaridade, área de formação, experiência, habilidades e cursos.
- QUANDO o upload no Storage falha após validação ENTÃO o sistema DEVE retornar `{ ok: false, error }` sem registrar `CV_UPLOADED` nem prosseguir para a extração.

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

## Success Criteria

- [ ] Upload aceita apenas PDF/DOC/DOCX (validação por MIME real) e tamanho ≤ 5MB, com o arquivo original vinculado ao candidato.
- [ ] Extração ocorre exclusivamente pela porta `CVExtractor`, sem dependência direta do SDK do provedor LLM no código consumidor.
- [ ] Nenhum dado extraído é persistido sem confirmação explícita do candidato (validação humana obrigatória comprovada em teste).
- [ ] Falha ou retorno vazio da IA resulta em fallback gracioso para o formulário manual, sem mensagem de erro disruptiva e sem bloquear o cadastro.
- [ ] Consentimento `CV_AI_EXTRACTION` (citando o provedor LLM) é exigido e validado antes de upload/extração; revogação interrompe o fluxo.
- [ ] Rate limit de 3 uploads por candidato por dia é aplicado e testado.
- [ ] Eventos `CV_UPLOADED`, `CV_EXTRACTION_REQUESTED`, `CV_EXTRACTION_COMPLETED`, `CV_EXTRACTION_FAILED` e `CV_USER_CONFIRMED_FIELDS` são registrados em auditoria.
- [ ] Custo, tokens e duração de cada extração são registrados para monitoramento.
- [ ] Extração retorna em ≤ 30s no p95 (operação assíncrona aceitável, com feedback visual).
