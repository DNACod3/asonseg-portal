# ADR-0004 (Técnico) — Auditoria imutável via tabela append-only com restrição de GRANT

- **Status:** Aceito — Estendido ao Release 1 (Portal MVP) em 2026-05-22
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** auditoria | seguranca | lgpd | persistencia

## Nota de extensão — Release 1 (Portal MVP)

A decisão técnica de `audit_log` append-only com REVOKE UPDATE,DELETE permanece **integralmente válida**. A extensão para o Portal MVP é apenas no **catálogo de eventos** registrados — não há mudança estrutural na tabela nem no wrapper `withAudit`.

**Eventos adicionais ao catálogo (sobre o que já existia para a Frente 4):**

| Categoria | Eventos novos |
|---|---|
| Identidade | `PERSON_CREATED_PUBLIC` (auto-cadastro), `PERSON_CREATED_BY_AS` (AS, situação extrema), `PERSON_CPF_EXCEPTION_GRANTED`, `CREDENTIAL_CLAIM_REQUESTED`, `CREDENTIAL_CLAIM_VERIFIED`, `ROLE_GRANT_ACTIVATED`, `ROLE_GRANT_REVOKED` |
| Empresa | `COMPANY_CREATED`, `COMPANY_VERIFIED` (após 1ª vaga), `COMPANY_RESPONSIBLE_ADDED`, `COMPANY_RESPONSIBLE_REMOVED`, `COMPANY_UPDATED` (rebaixa verificação) |
| Consentimentos LGPD | `CONSENT_GRANTED` (com finalidade + versão do termo + IP), `CONSENT_REVOKED` (com finalidade + motivo opcional) |
| Moderação | `CONTENT_SUBMITTED_TO_MODERATION`, `CONTENT_APPROVED`, `CONTENT_RETURNED_FOR_ADJUSTMENTS`, `CONTENT_REJECTED`, `CONTENT_INACTIVATED_BY_COORDINATOR` |
| Vagas | `JOB_PUBLISHED`, `JOB_EXPIRED`, `JOB_PAUSED`, `JOB_ARCHIVED`, `JOB_EDITED_AFTER_APPROVAL` (rebaixa para rascunho) |
| Candidaturas | `APPLICATION_CREATED`, `APPLICATION_CANCELLED`, `APPLICATION_VIEWED_BY_EMPLOYER` (sensitive access) |
| Serviços | `SERVICE_PUBLISHED`, `SERVICE_PAUSED`, `SERVICE_ARCHIVED` |
| Manifestações | `INTEREST_MANIFESTED`, `INTEREST_CANCELLED`, `PROVIDER_CONTACT_REVEALED` (sensitive access) |
| Encaminhamentos | `REFERRAL_CREATED`, `REFERRAL_RESULT_REGISTERED` |
| Extração CV | `CV_EXTRACTION_REQUESTED`, `CV_EXTRACTION_COMPLETED`, `CV_EXTRACTION_FAILED`, `CV_USER_CONFIRMED_FIELDS` |
| Visibilidade | `SENSITIVE_FIELD_VIEWED` (genérico para acessos a CPF, contato, ficha socioeconômica) |
| Configuração global | `CATEGORY_SUGGESTED`, `CATEGORY_APPROVED`, `REGION_ADDED`, `JOB_AREA_ADDED` |

**Justificativa textual obrigatória** continua o padrão da Frente 4: em todo evento de revogação/rejeição/edição retroativa, o operador escreve justificativa que é persistida no campo `justification` do `audit_log`.

**Retenção:** mantida em **1 ano** para audit_log operacional (mesma definição do cliente para a Frente 4). Dados pessoais nas tabelas operacionais (`persons`, `consents` ativos, conteúdos) continuam com retenção indefinida.

---

## Contexto e Problema

O PRD especifica em §6.3 que o sistema deve manter **log imutável de auditoria** para:

- Autenticação
- Alteração de permissão (concessão/revogação de permissão delegável)
- Edição ou exclusão de qualquer registro operacional
- Mudança de status de família, beneficiário ou indicação
- Resolução de divergência (de fechamento de caixa ou de conciliação PIX)
- Configuração de parâmetro global

ADR-0007 de negócio (edição com janela mensal) e ADR-0008 de negócio (retenção indefinida + direito de acesso sob demanda) tornam o log imutável **não-negociável** — é o que sustenta a integridade do modelo de correção retroativa por coordenador/diretoria com justificativa rastreável.

US-039, US-040, US-041 materializam ACs explícitos: "the system SHALL gravar log imutável contendo: registro afetado, valores antes e depois, autor, data/hora, justificativa".

Era necessário decidir onde mora o log, em qual estrutura, e como garantir a imutabilidade.

## Drivers de Decisão

- Imutabilidade real (não apenas "não temos UI para editar")
- Custo mínimo (ADR-0010 de negócio) — não justifica store externo dedicado tipo S3 Object Lock no porte atual
- Retenção: 1 ano para audit log operacional (definido pelo cliente em conjunto com este ADR; dados pessoais têm retenção indefinida — ADR-0008 de negócio)
- Captura de contexto rico: autor, IP, valores antes/depois, justificativa
- Volume estimado: ~5.000-15.000 entradas/mês (estimativa do arquiteto baseada nas operações descritas no PRD §5)

## Opções Consideradas

### Opção A — Tabela `audit_log` append-only com restrição de GRANT no Postgres (escolhida)

**Descrição:** uma única tabela `audit_log` no Postgres da aplicação. O role do Postgres usado pela aplicação tem `GRANT INSERT` mas **NÃO tem `GRANT UPDATE` nem `GRANT DELETE`** nessa tabela. Toda inserção é gravada via Server Action; a imutabilidade é garantida pelo Postgres em nível de role.

**Estrutura da tabela:**
```sql
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID,                  -- nullable em eventos sem ator (ex: cron de expiração)
  actor_ip      INET,
  event_type    TEXT NOT NULL,         -- enum-like: AUTH_LOGIN, RECORD_UPDATED, PERMISSION_GRANTED, etc.
  entity_type   TEXT,                  -- ex: 'family', 'cesta_delivery', 'indication'
  entity_id     TEXT,                  -- ID textual para suportar IDs compostos
  before_state  JSONB,                 -- nullable em INSERT
  after_state   JSONB,                 -- nullable em DELETE
  justification TEXT,                  -- obrigatório quando event_type exige (validado na app)
  context       JSONB                  -- request_id, user_agent, etc.
);

-- Índices úteis:
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_actor  ON audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_event  ON audit_log (event_type, occurred_at DESC);

-- Restrição de GRANT (executada após criação, com role admin):
REVOKE UPDATE, DELETE ON audit_log FROM app_role;
GRANT  INSERT, SELECT ON audit_log TO app_role;
```

- **Prós:** mesmo banco da aplicação (zero custo adicional); imutabilidade garantida pelo Postgres em nível de role (não dependende de disciplina aplicacional); SQL standard, sem features exóticas; consultável com Prisma normalmente
- **Contras:** se a credencial admin do banco vazar, há possibilidade técnica de manipulação — mitigado por gestão de secret (admin URL nunca em código, apenas em Vercel env protegida)
- **Custo:** US$ 0/mês adicional

### Opção B — Store externo append-only (S3 com Object Lock)

**Descrição:** cada evento de auditoria vira um objeto JSON em bucket S3 com Object Lock em modo Compliance (write-once-read-many, sem possibilidade de exclusão nem por root account no período de retenção).

- **Prós:** imutabilidade máxima, certificável para compliance pesada (financeira, médica)
- **Contras:** custo adicional; consultas complexas (precisa de Athena ou ETL); duplicação de infra (events no S3 + queries no banco); overkill para o porte ASONSEG
- **Custo:** US$ 5-15/mês adicional + custos de query (Athena)

### Opção C — Tabela `audit_log` "imutável por convenção" (sem GRANT restrictivo)

**Descrição:** mesma tabela da Opção A, mas com `GRANT ALL` para o role da aplicação. "Imutabilidade" garantida apenas porque não há UI/endpoint que faça UPDATE/DELETE.

- **Prós:** mais simples; sem ajuste de GRANT
- **Contras:** **não é imutabilidade real** — desenvolvedor descuidado, migration acidental ou comando manual via console do Supabase podem apagar/alterar; falha em atender ao requisito do PRD §6.3 que pede log **imutável**
- **Custo:** US$ 0/mês

## Decisão

Adotamos a **Opção A — `audit_log` append-only com restrição de GRANT no Postgres**.

**Captura de contexto via wrapper aplicacional:**

Toda Server Action de mutação é obrigada a usar o helper `withAudit(eventType, fn)` que:
1. Captura `actor_user_id` via `getCurrentUser()` (vindo do middleware de auth — ADR-0003)
2. Captura `actor_ip` do header `x-forwarded-for` da request
3. Captura `before_state` via SELECT antes da operação (quando aplicável — UPDATE/DELETE)
4. Executa a operação dentro de `prisma.$transaction(...)`
5. Captura `after_state` via SELECT depois (UPDATE) ou usa o input (INSERT)
6. INSERT em `audit_log` dentro da mesma transação

Pseudo-código:
```typescript
export async function updateRecord(input: UpdateInput) {
  await requirePermission('EDIT_OWN_RECORD');
  return withAudit('RECORD_UPDATED', async (tx) => {
    const before = await tx.record.findUniqueOrThrow({ where: { id: input.id } });
    const after = await tx.record.update({ where: { id: input.id }, data: input.data });
    return { before, after };
  });
}
```

**Justificativa obrigatória:** validada em camada aplicacional (Zod) para `event_type` que exige (ex.: `RECORD_UPDATED_RETROACTIVE`, `PERMISSION_REVOKED`). Server Action retorna erro 422 se justificativa vazia.

**Retenção:** 1 ano para audit_log operacional (definido pelo cliente). Job de limpeza diário roda à madrugada removendo entradas com `occurred_at < now() - interval '1 year'`. **Antes da remoção**, snapshot agregado/anonimizado pode ser preservado se a diretoria pedir — fora do escopo do MVP. Importante: dados pessoais nas tabelas operacionais (família, beneficiário) seguem retenção indefinida (ADR-0008 de negócio); o audit_log dessas mesmas entidades é o que tem retenção limitada a 1 ano.

**Soft delete em tabelas operacionais:** registros operacionais (entrega, venda, etc.) usam soft delete com coluna `deleted_at`. A "exclusão" propriamente dita registra `RECORD_DELETED` no audit_log e reverte o efeito no estoque/caixa via lógica de domínio dentro da mesma transação (US-039 AC-039-4).

## Consequências

**Positivas:**
- Imutabilidade **real**, garantida pelo Postgres, não apenas por disciplina
- Custo zero adicional sobre a infraestrutura
- Consulta via Prisma como qualquer outra tabela
- Wrapper `withAudit` centraliza a captura de contexto — fica difícil esquecer
- Log dentro da mesma transação da operação garante consistência (ou ambos persistem, ou nenhum)

**Negativas (trade-offs aceitos):**
- Volume do `audit_log` cresce continuamente — mitigado pelo job de retenção de 1 ano e por índices apropriados
- Disciplina de uso do `withAudit` depende de revisão de PR — mitigado por convenção rígida no `project-guideline.md` e por lint custom planejado

**Neutras / a monitorar:**
- Performance da tabela pode degradar acima de ~10M linhas — no volume estimado (~5-15k/mês × 12 meses = ~60-180k/ano), está duas ordens de grandeza abaixo do limite prático

## Riscos e Mitigações

**Risco 1 — Desenvolvedor esquece de chamar `withAudit` em nova Server Action de mutação.** **Mitigação:** convenção no `project-guideline.md`; revisão de PR explícita; lint custom (eslint plugin) que falha quando uma Server Action que faz `prisma.X.{create,update,delete}` não está envolvida em `withAudit`.

**Risco 2 — Job de retenção apaga audit_log enquanto há investigação em curso.** **Mitigação:** flag `do_not_purge` na tabela (booleano default false); diretor/admin marca registros sob investigação antes do prazo; job respeita a flag.

**Risco 3 — Credencial admin do Postgres vaza, permitindo bypass do GRANT.** **Mitigação:** admin URL **apenas** em Vercel env (não em código, não em prints, não no Git); rotação semestral; auditoria de acesso ao painel Vercel.

## Referências

- PRD §6.3 (Segurança — log imutável)
- PRD §13 R-008 (Risco de manipulação indevida na janela do voluntário)
- US-039, US-040, US-041 (auditoria e correções)
- ADR-0007 de negócio (janela mensal de edição)
- ADR-0008 de negócio (retenção)
- ADR-0003 (técnico) — middleware de auth que popula `getCurrentUser()`
- Lentes do arquiteto: Observability by Design, Fail-Fast & Blast Radius
