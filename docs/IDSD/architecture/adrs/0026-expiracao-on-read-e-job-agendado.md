# ADR-0026 — Expiração de vaga: verificação on-read + job agendado + observabilidade

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead
- **Tags:** domínio, jobs, observabilidade

## Contexto e Problema

A USP-024 exige que a vaga vire `expirado` na data de validade (timezone América/São_Paulo) e saia da busca. O intent USP-024/F1 marca `(arquitetural-estrutural → vira ADR técnico)`: "job + verificação on-read … observabilidade com alerta quando o job não roda". Os must-not:

- USP-021/P-003: "NÃO PODE exibir na busca vaga cuja validade já passou, **mesmo se o job de expiração atrasou**. Verificação on-read precisa garantir consistência independentemente do estado persistido."
- USP-024/E-001+L-001: transição via job batch (≤1h da validade) + **falha do job dispara alerta** (RNF 6.6).

Depender só do job cria janela de inconsistência se o job falha/atrasa (RP: "job falha silenciosamente, vaga vencida fica visível"). Depender só de on-read deixa o status persistido errado (relatórios e painéis inconsistentes).

## Drivers de Decisão

- Consistência da busca pública **independente** do estado do job (P-003).
- Estado persistido correto para relatórios/painéis.
- Falha do job nunca silenciosa (RNF 6.6).

## Opções Consideradas

### Opção A — Defesa em profundidade: filtro on-read + job agendado + alerta de observabilidade
- **Descrição:** (1) Toda query de busca pública filtra `status='ativo' AND validade >= now()` (timezone São_Paulo) — a vaga vencida **nunca aparece**, mesmo com status persistido desatualizado. (2) Um **Vercel Cron** roda periodicamente (ex.: de hora em hora), atualiza para `expirado` as vagas vencidas e registra heartbeat. (3) Observabilidade alerta se o job **não registrou heartbeat** na janela esperada.
- **Prós:** Busca sempre consistente (on-read); estado persistido convergente (job); falha detectável (alerta).
- **Contras:** Lógica de "expiração" em dois lugares (query + job) — by design, documentada.

### Opção B — Só job agendado
- **Contras:** Janela de inconsistência em falha/atraso — viola USP-021/P-003. Rejeitada.

### Opção C — Só on-read (status nunca muda)
- **Contras:** Status persistido mente para relatórios e e-mail de "expira em 3 dias"; quebra MP e painéis. Rejeitada.

## Decisão

Adotamos a **Opção A** (defesa em profundidade). A **verificação on-read é a fonte da verdade para visibilidade**; o **job é convergência de estado** + gatilho do e-mail "expira em 3 dias" (USP-024/E-003, via outbox — ADR-0020); a **observabilidade alerta** se o job não rodar. Conversão de timezone com `date-fns-tz` (`America/Sao_Paulo`) na fronteira.

## Consequências

**Positivas:**
- Vaga vencida nunca visível, mesmo com job parado (P-003 satisfeito).
- Falha do job é ruidosa (RNF 6.6), não silenciosa.

**Negativas (trade-offs aceitos):**
- Regra de validade duplicada (query + job) — custo pequeno, documentado no `runbook-search-pagination` e no TD §4.

**Neutras / a monitorar:**
- O mesmo padrão on-read serve a serviço/conteúdo com consentimento revogado (ADR-0025).

## Referências

- ADR-0020 (outbox/e-mail), ADR-0025 (on-read p/ consentimento), `runbook-search-pagination`.
- USPs servidas: USP-021, USP-022, USP-024, USP-030.
