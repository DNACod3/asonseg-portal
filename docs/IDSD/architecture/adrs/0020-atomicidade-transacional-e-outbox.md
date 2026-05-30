# ADR-0020 — Atomicidade transacional e efeitos colaterais via outbox

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead
- **Tags:** data, concorrência, integração

## Contexto e Problema

Várias USPs compõem **múltiplas escritas + efeitos colaterais** numa única intenção do usuário. Os intent files marcam isso como `(arquitetural-estrutural)` e os expectations elevam a must-not:

- USP-001/P-002: "NÃO PODE ativar papel antes do consentimento da finalidade estar persistido **na mesma transação da ativação**. Se essa persistência falhar, o papel não ativa (fica `AWAITING_CONSENT`)." — no auto-cadastro, a finalidade vem numa **2ª transação atômica** (lazy); a 1ª cria Pessoa + credencial + papel `AWAITING_CONSENT` + consentimento `PORTAL_ACCESS` (ver TD §4.3).
- USP-012/P-004: criar Empresa + vínculo + papel + consentimento — "falha em qualquer ponta aborta a transação inteira".
- USP-025/P-005, USP-033/P-003, USP-037/P-006: candidatura/manifestação/encaminhamento "não podem ficar em estado parcial".
- USP-044/P-003: "NÃO PODE disparar e-mail antes da confirmação da transação"; P-007 exige cancelar mensagens órfãs em rollback.

O conflito: escritas no banco são transacionais e revertíveis; envio de e-mail é um efeito externo **não revertível**. Disparar e-mail dentro da transação arrisca enviar e depois reverter (mensagem órfã); disparar fora arrisca persistir e não notificar.

## Drivers de Decisão

- Integridade atômica das escritas de domínio (LGPD: papel nunca ativo sem consentimento).
- E-mail confiável mas idempotente, sem mensagens órfãs.
- Custo mínimo — sem broker pesado (ADR-0010 proíbe mensageria pesada).

## Opções Consideradas

### Opção A — Transação única no Postgres (Prisma `$transaction`) + outbox para e-mail
- **Descrição:** Todas as escritas de domínio numa transação Prisma. O e-mail é gravado como linha numa tabela `outbox` **dentro da mesma transação**; um worker (Vercel Cron / processo leve) lê o outbox **após o commit** e despacha via SMTP, marcando como enviado. Rollback → a linha de outbox some junto (nunca foi commitada) → sem órfão.
- **Prós:** Atomicidade real; e-mail só sai pós-commit; idempotência por id de outbox; sem broker.
- **Contras:** Latência de entrega do e-mail = intervalo do worker (segundos a 1 min) — aceitável (e-mails são informativos).
- **Custo estimado:** ~US$0 adicional (usa Postgres + Cron já existentes).

### Opção B — E-mail síncrono pós-commit (sem outbox)
- **Descrição:** Commit e, em seguida, chamada SMTP no mesmo request.
- **Prós:** Entrega imediata; simples.
- **Contras:** Se o SMTP falha após o commit, o e-mail se perde sem retry; acopla latência do SMTP à resposta ao usuário.

### Opção C — Broker dedicado (SQS/RabbitMQ)
- **Descrição:** Fila externa para efeitos colaterais.
- **Contras:** Mensageria pesada — **proibida** pelo ADR-0010 no volume do MVP.

## Decisão

Adotamos a **Opção A**. Toda Server Action que compõe múltiplas escritas roda numa **única transação Prisma**; efeitos colaterais externos (e-mail, e qualquer notificação futura) são **enfileirados na tabela `outbox` dentro da transação** e despachados por um worker pós-commit com retry e idempotência. A auditoria (`withAudit` — ADR-0023) participa da **mesma transação** das escritas.

## Consequências

**Positivas:**
- Garante "papel nunca ativo sem consentimento" e "sem estado parcial" das USPs compostas.
- E-mail confiável com retry; rollback nunca gera e-mail órfão (P-007 satisfeito).

**Negativas (trade-offs aceitos):**
- Pequena latência de entrega de e-mail (janela do worker).
- Exige tabela `outbox` e worker — complexidade modesta, paga uma vez.

**Neutras / a monitorar:**
- Monitorar tamanho do outbox e taxa de retry; alertar se acumular.

## Referências

- ADR-0023 (auditoria na mesma transação), ADR-0021 (unicidade), ADR-0025 (cascata).
- USPs servidas: USP-001, USP-006, USP-009, USP-010, USP-011, USP-012, USP-013, USP-025, USP-033, USP-037, USP-043, USP-044.
