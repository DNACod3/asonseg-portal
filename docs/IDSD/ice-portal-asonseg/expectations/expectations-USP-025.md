# Expectations — USP-025: Candidatar-se a uma vaga

**Origem:** AC-025-1 a AC-025-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa com papel candidato ativo (USP-009 aprovado) clica em "candidatar-se" em vaga em status "ativo", the system SHALL persistir a candidatura, enviar e-mail de confirmação ao candidato (USP-044) e tornar contato + CV do candidato visíveis para a Empresa (USP-027) — **tudo em transação única** com retry para o e-mail.

  *Ajuste do AC-025-1:* explicita atomicidade dos 3 efeitos colaterais (toca F5 do intent).

- **E-002:** IF o candidato já tem candidatura ativa (não cancelada) à mesma vaga, THEN the system SHALL bloquear nova candidatura com mensagem clara.

- **E-003:** IF o perfil do candidato não está com status "ativo" (não foi moderado ou foi devolvido), THEN the system SHALL bloquear a candidatura.

- **E-004:** IF o consentimento da finalidade 2 (candidatura a vagas) está suspenso/revogado (USP-043), THEN the system SHALL bloquear a candidatura.

  *Ajuste:* AC do PRD não cobre revogação de consentimento como bloqueio; vem do F4 do intent + ADR-0013.

- **E-005:** WHEN o candidato faz a N-ésima candidatura em janela curta (N e janela acordados), the system SHALL alertar o coordenador para análise de candidatura em massa.
  ✅ RESOLVIDO (dono do intent): >20 candidaturas/semana → alerta operacional ao coordenador (sem bloqueio); valor tunável (ADR-0029).

## 2. Proibições (must-not)

- **P-001 (toca F1 — CV mal extraído chega à Empresa):** O sistema NÃO PODE permitir candidatura quando o perfil contém campos pré-preenchidos pela IA não confirmados pelo candidato. Confirmação é precondição para o perfil virar "ativo" (alinhado com USP-009/P-001).

- **P-002 (toca F2 — Empresa minera dados):** O sistema NÃO PODE expor contato + CV à Empresa sem que ela tenha aceitado o **termo de responsabilidade** que cobre "uso restrito à finalidade de avaliação para a vaga". Sem esse termo aprovado (D-002 do PRD), a USP fica em gate.

- **P-003 (toca F3 — candidatura em massa):** O sistema NÃO PODE deixar candidato candidatar-se a um volume manifestamente anômalo sem qualquer fricção ou alerta operacional. Defesa mínima: rate limiting por janela + sinal ao coordenador.

- **P-004 (toca F4 — candidato com consentimento revogado):** O sistema NÃO PODE permitir nova candidatura quando o consentimento da finalidade 2 está suspenso/revogado, **e** o sistema precisa tratar candidaturas históricas conforme decidido em USP-043 (ocultar da Empresa? notificar?).
  ✅ RESOLVIDO (dono do intent): candidaturas ativas pré-revogação são canceladas automaticamente, sem notificação à Empresa.

- **P-005 (toca F5 — atomicidade quebrada):** O sistema NÃO PODE deixar a candidatura em estado meio-bom (candidatura persistida sem contato revelado, ou contato revelado sem persistência, etc.). Falha em qualquer um dos três efeitos aborta o conjunto (com tratamento específico para retry de e-mail).

- **P-006:** O sistema NÃO PODE permitir candidatura a vaga em status diferente de "ativo" (pausada, expirada, em moderação, arquivada).

- **P-007:** O sistema NÃO PODE expor contato + CV à Empresa antes da ação afirmativa (candidatura) — princípio ADR-0017 da reciprocidade.

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (E-mail):** Confirmação ao candidato em ≤ 60s.
- **L-003 (Rate limiting):** Máximo de candidaturas por candidato por janela (a definir).
- **L-004 (Auditoria):** Log imutável da candidatura, retido conforme ADR-0008.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate jurídico — BLOQUEANTE):** Antes desta USP ir para produção, o **termo de responsabilidade da Empresa** (cobrindo uso restrito à finalidade de avaliação para a vaga) está aprovado pelo jurídico via **D-002 do PRD**. Sem esse termo, RP-003 indireto (mineração de dados de candidatos) fica desprotegido. A USP **não vai para produção** sem isso.

- **D-002:** Candidato com perfil ativo, em ensaio, candidata-se a uma vaga em ≤ 30s; recebe e-mail; Empresa vê na lista (USP-027) com contato + CV; tudo em transação consistente.

- **D-003:** Em teste de race condition: dois cliques rápidos no botão "candidatar-se" para a mesma vaga resultam em **uma única candidatura** + mensagem clara no segundo (P-002).

- **D-004:** Em teste de revogação: candidato revoga consentimento da finalidade 2 (USP-043); tentativa subsequente de candidatura é bloqueada com mensagem clara.

- **D-005:** Em teste de candidatura em massa: candidato faz N+1 candidaturas em janela < acordada; sistema alerta o coordenador no painel operacional.

- **D-006:** A Empresa abre a lista (USP-027) e vê, para cada candidato, contato + CV + flag visual quando o perfil foi pré-preenchido por IA (alinhado com USP-027/F2).
