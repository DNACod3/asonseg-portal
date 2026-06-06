# Feature: Moderar rascunho de vaga, CV ou serviço (USP-016)

> Stub de spec apontando para a US do PRD. Os testes-fonte (facts) estão em `tests/`.

## User Story

**USP-016 — Moderar rascunho (vaga, CV ou serviço)** · Prioridade: Must

Como **coordenador da área Portal Empregabilidade (ou voluntário delegado)**, quero
revisar rascunhos de vaga, CV e serviço e aprovar, devolver para ajustes ou rejeitar,
para que apenas conteúdo verificado fique visível no portal.

## Critérios de Aceitação (EARS) — verbatim do PRD

- **AC-016-1:** WHEN o coordenador acessa a fila de moderação, the system SHALL listar
  rascunhos com status "em moderação" ordenados por data de envio.
- **AC-016-2:** WHEN o coordenador aprova, the system SHALL alterar status para "ativo"
  e enviar e-mail ao autor.
- **AC-016-3:** WHEN o coordenador devolve para ajustes, the system SHALL exigir motivo
  textual obrigatório, alterar status para "aguardando ajustes" e enviar e-mail ao autor
  com o motivo.
- **AC-016-4:** WHEN o coordenador rejeita definitivamente, the system SHALL exigir motivo
  textual, alterar status para "rejeitado" e enviar e-mail ao autor.
- **AC-016-5:** The system SHALL registrar log da decisão (autor, momento, motivo).

*Notas:* Sem SLA formal. Coordenador vê fila e processa conforme capacidade. Ver ADR-0015.

## Fontes da verdade consultadas

- PRD §Épico 4 USP-016
- ADR-0011 técnico — máquina de estados de moderação (`transitionContent`, tabela `TRANSITIONS`)
- ADR-0015 negócio — moderação humana pré-publicação
- ADR-T-0004 — audit log append-only · ADR-T-0013 — revalidation on-demand
- technical-design §3.3 (sequence moderação), §117-119 (MODERATE_JOB/CV/SERVICE)
- project-guideline §4 (Server Action), §12 (casos obrigatórios), §20–23 (Fact-Driven)
- architecture-document §6 (Top 8 fluxos críticos — USP-016 é o #8)

## Facts (testes-fonte)

Ver `tests/`:
- `tests/bdd/usp-016-moderacao-rascunho.feature` — Gherkin PT-BR
- `tests/unit/usp-016-moderacao-rascunho.spec.ts` — Vitest red
- `tests/e2e/usp-016-moderacao-rascunho.e2e.ts` — Playwright red (fluxo Top 8)
- `tests/traceability.md` — matriz AC → fact
