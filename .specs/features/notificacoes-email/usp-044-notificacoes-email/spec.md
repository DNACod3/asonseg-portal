# USP-044 Specification — Dispatcher assíncrono do Outbox de e-mail (ICE adapter)

> **SOURCE OF TRUTH:** `docs/IDSD/ice-portal-asonseg/intents/intent-USP-044.md` + `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-044.md`.
> Este arquivo **não re-deriva** requisitos: indexa os IDs ICE e destaca as proibições (must-not) como ACs negativas.
> Card da matriz: `docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` §USP-044 (l.716). Decisão de escopo: STATE **AD-007** (l.143-148).

## Escopo desta unidade (U2 / Fase 6)

A infraestrutura de **envio** já existe (porta `EmailSender`, adapter `ResendEmailSender` no `container.ts`, 8 templates, model Prisma `Outbox`, 6 sítios de enfileiramento). **Nada em produção drena a fila hoje.** Esta unidade entrega **exatamente a peça que falta**: o **dispatcher assíncrono que drena `Outbox` onde `topic='email'`**, despacha via a porta `EmailSender`, marca `processedAt`/`attempts`/`lastError` e cobre concorrência, retentativa e isolamento de falha. É o que AD-007 define: *"USP-044 deve consumir `topic='email'` do `Outbox`, despachar via `ResendEmailSender`, marcar `processedAt`/`attempts`/`lastError`, e cobrir retentativa."*

Os demais itens do épico USP-044 (SPF/DKIM/DMARC, minimização de PII nos templates, opt-out `email_prefs`, monitoramento de quota/bounce, lembrete de CV) estão **resolvidos a montante** (Fase 0 / ADRs), são **gates operacionais de terceiros**, ou **não produzem linha no Outbox** hoje — ver o mapa de cobertura de IDs ICE em `design.md §ICE-ID Coverage`. Nada é silenciosamente descartado.

## Requirement IDs (canônicos = IDs ICE; must-not de unidade seguem a convenção `<UNIT>-MN-NN` do projeto)

| ID | Tipo | Origem | Coberto nesta unidade | Fact (skill-tdad → alvo) |
|---|---|---|---|---|
| **E-001** | must-do | expectations §1 (disparo pós-commit dos eventos enfileirados) | **Sim — núcleo** | `src/shared/lib/outbox/__tests__/dispatch-outbox.int.test.ts` |
| **P-003** | must-not (F3) | expectations §2 — não disparar e-mail antes do commit | Sim (dispatcher só lê linhas committadas `processedAt IS NULL`) | idem (asserção de não-envio de linha não-committada) |
| **P-007** | must-not (F3) | expectations §2 — não enviar e-mail de evento revertido; cancelar/ignorar órfãos | Sim (idempotência do dreno; rollback já apaga a linha na origem) | idem |
| **U44-MN-01** | must-not (unidade; ancora P-007 + ADR-0020 "retry/idempotência") | orquestrador | Sim | `dispatch-outbox.int.test.ts` (concorrência) |
| **U44-MN-02** | must-not (unidade; ancora precedente cron `verifyCronSecret` / U24-MN-06) | orquestrador | Sim | `src/app/api/cron/dispatch-outbox/__tests__/route.test.ts` |
| **U44-MN-03** | must-not (unidade; ancora ADR-0020 retry + L-001 latência) | orquestrador | Sim | `dispatch-outbox.int.test.ts` (poison/isolamento) |
| **U44-MN-04** | must-not (unidade; ancora P-008 + ADR-0028) | expectations §2 P-008 | Sim | `dispatch-outbox.int.test.ts` (metadado, sem corpo) |
| E-004 / P-004 | must-do / must-not | expectations §1/§2 — opt-out granular | **Não (deferido)** — `persons.email_prefs` não existe; nenhum sítio de enqueue depende | — (ver design §ICE-ID Coverage) |
| E-006 | must-do | expectations §1 — N parametrizável do lembrete de CV | **Não (deferido)** — sem sítio de enqueue de `cv_reminder` | — |
| E-002 / E-005 / P-001 / P-006 / P-002 / P-008(templates) | must-do/must-not | SPF/DKIM/DMARC, quota, minimização de template | **Não (resolvido a montante / gate operacional)** | — |

## Acceptance Criteria (comportamento do dispatcher — refinam E-001; formato QUANDO/ENTÃO/DEVE)

1. **AC-044-D1** QUANDO o dispatcher roda ENTÃO DEVE selecionar apenas linhas `topic='email' AND processedAt IS NULL AND attempts < MAX_ATTEMPTS`, em lote **limitado** (`take N`, paginação obrigatória), **mais antigas primeiro** (`createdAt ASC`). (E-001)
2. **AC-044-D2** QUANDO uma linha carrega um `EmailMessage` completo (campo `template`) ENTÃO DEVE enviá-la diretamente via a porta `EmailSender` e, em sucesso, marcar `processedAt`. (E-001)
3. **AC-044-D3** QUANDO uma linha carrega o payload leve `{ kind:'JOB_EXPIRY_D3', jobId }` ENTÃO DEVE **hidratá-la** (carregar vaga + destinatário responsável), renderizar o `EmailMessage` e enviá-la. (E-001, AC-044-7)
4. **AC-044-D4** QUANDO o envio de uma linha falha ENTÃO DEVE incrementar `attempts`, gravar `lastError` e **deixar `processedAt` nulo** (retentativa no próximo ciclo do cron). (E-001)
5. **AC-044-D5** QUANDO o destinatário/entidade de um payload leve não existe (vaga apagada / responsável sem e-mail) ENTÃO DEVE tratar como **no-op gracioso**: marcar `processedAt`, registrar `skipped` em log, sem retentativa infinita. (E-001)
6. **AC-044-D6** QUANDO o dispatcher termina ENTÃO DEVE retornar contagens `{ sent, failed, skipped }` em JSON e registrar log estruturado `childLogger({ module:'cron', job:'dispatch-outbox' })`. (E-001)

## Negative ACs (must-not → proibição de mundo; cada uma com teste negativo)

- **U44-MN-01 (ancora P-007 / ADR-0020 idempotência):** QUANDO duas execuções do dispatcher rodam **concorrentemente** sobre a mesma fila ENTÃO o sistema **NÃO DEVE** enviar a mesma linha duas vezes — cada linha é reivindicada por no máximo uma execução (garantia de nível de banco: `FOR UPDATE SKIP LOCKED`). *Teste exercita o lock real, não um pré-check de aplicação (L-010).*
- **U44-MN-02 (fail-closed):** QUANDO a rota de cron recebe requisição **sem** `CRON_SECRET` configurado ENTÃO **NÃO DEVE** processar nada e DEVE responder `503`; QUANDO recebe segredo **ausente/incorreto** ENTÃO **NÃO DEVE** processar nada e DEVE responder `401`. Zero envios em ambos.
- **U44-MN-03 (poison / isolamento):** QUANDO uma linha falha até atingir `MAX_ATTEMPTS` ENTÃO o sistema **NÃO DEVE** re-tentá-la indefinidamente (excluída da seleção por `attempts < MAX_ATTEMPTS`) **e NÃO DEVE** deixar que ela bloqueie as demais linhas do lote (isolamento de falha por linha).
- **U44-MN-04 (P-008 / ADR-0028):** QUANDO o dispatcher registra log ENTÃO **NÃO DEVE** gravar o corpo do e-mail nem PII de terceiros em claro — somente metadado (`outboxId`, `template`/`kind`, status, `attempts`).
- **P-003:** QUANDO uma transação de origem ainda não committou ENTÃO o dispatcher **NÃO DEVE** enviar o e-mail correspondente (lê apenas linhas committadas).
- **P-007:** QUANDO uma transação de origem é revertida ENTÃO **não existe** linha no Outbox (rollback a apaga) e o dispatcher **NÃO DEVE** enviar e-mail órfão.

## Edge Cases

- QUANDO a porta `EmailSender` retorna `{ ok:false }` (Resend indisponível) ENTÃO trata como falha da linha (AC-044-D4) — nunca lança, não bloqueia o lote.
- QUANDO o payload é malformado (nem `template` válido nem `kind` conhecido) ENTÃO trata como falha da linha (incrementa `attempts`/`lastError`); ao atingir o cap vira poison (U44-MN-03).
- QUANDO o processo cai no meio de um envio ENTÃO, em execução concorrente, `SKIP LOCKED` garante ausência de duplo-envio concorrente; um raríssimo re-envio pós-crash (at-least-once) é aceito para e-mails informativos e documentado em `design.md`.
- QUANDO o lote está vazio ENTÃO retorna `{ sent:0, failed:0, skipped:0 }` e `200`.

## Success Criteria

- [ ] Toda linha `topic='email'` committada é entregue via a porta `EmailSender` em ≤ 1 ciclo de cron do enqueue (L-001, alvo ≤ 60s — depende da cadência do agendamento).
- [ ] Duas execuções concorrentes nunca enviam a mesma linha duas vezes (U44-MN-01, provado contra o lock do Postgres).
- [ ] Rota fail-closed: sem/segredo errado ⇒ 503/401, zero envios (U44-MN-02).
- [ ] Linha poison não é re-tentada além do cap e não bloqueia o lote (U44-MN-03).
- [ ] Logs carregam somente metadado (U44-MN-04); nenhum corpo/PII em claro.
