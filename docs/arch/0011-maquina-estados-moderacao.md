# ADR-0011 (Técnico) — Fluxo de moderação como máquina de estados explícita

- **Status:** Aceito
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** modelagem | fluxo | moderacao | estados

## Contexto e Problema

ADR-0015 de negócio estabelece a moderação humana pré-publicação como pilar do Portal — toda vaga, CV e serviço passa por aprovação antes de ficar visível. PRD USP-016 a USP-019 detalham o fluxo.

Os estados pelos quais um conteúdo (vaga, CV, serviço) pode passar:

```
        ┌─────────┐
        │ DRAFT   │ ←──────────────────────┐
        └────┬────┘                        │
             │ submeter para moderação     │ editar (rebaixa)
             ▼                             │
    ┌────────────────┐                     │
    │ IN_MODERATION  │                     │
    └────┬───────────┘                     │
         │                                 │
    ┌────┴─────┬───────────┐               │
    │aprovar   │devolver   │rejeitar       │
    ▼          ▼           ▼               │
┌────────┐ ┌───────────────────────┐  ┌────────────┐
│ ACTIVE │ │ AWAITING_ADJUSTMENTS  │  │ REJECTED   │
└───┬────┘ └──────┬────────────────┘  └────────────┘
    │             │                                  
    │  ┌──────────┘                                  
    │  │ ajustar e re-submeter                       
    │  ▼                                             
    │  IN_MODERATION                                 
    │                                                
 transições autorais                                 
    ├─→ PAUSED  (autor pausa temporariamente)
    ├─→ ARCHIVED (autor arquiva — para vaga, indica encerramento)
    └─→ EXPIRED (apenas vaga; via job de expiração quando passa validade)

 transições administrativas
    └─→ INACTIVATED (coordenador inativa via USP-018; escape válve)
```

A questão é **como representar e enforçar essa máquina de estados** em código com:
- Type safety — transições inválidas devem ser detectadas em compile time se possível, ou retornar erro tipado em runtime
- Auditoria — toda transição registra autor, motivo (quando aplicável), timestamp
- Coerência — três tipos de conteúdo (vaga/CV/serviço) compartilham 90% do fluxo, com pequenas variações (só vaga tem `EXPIRED`)
- ISR + invalidação on-demand (ADR-T-0013) — toda transição que afeta visibilidade pública dispara `revalidatePath`
- Capacidade de testar exaustivamente as transições

## Drivers de Decisão

- Volume de moderações relevante (várias por dia) — fluxo robusto é central à operação
- ADR-0015 de negócio dá a estrutura conceitual; este ADR é o "como" técnico
- Comunicação por e-mail em quase toda transição (USP-044) — fluxo precisa orquestrar isso
- Sem SLA formal no MVP (PRD), mas métrica MP10 acompanha tempo médio
- Voluntários com permissão delegada também moderam — o fluxo é igual independente do moderador

## Opções Consideradas

### Opção A — String do estado em coluna + ifs espalhados

**Descrição:** coluna `status TEXT` na tabela do conteúdo; código verifica e atualiza com `if`/`switch` em cada lugar.

- **Prós:** simples no início
- **Contras:** transições inválidas são fáceis de cometer; sem tabela de transições permitidas; auditoria depende de boa disciplina; testes ficam pulverizados

### Opção B — Enum de estado + função canônica `transitionContent()` + tabela de transições permitidas (escolhida)

**Descrição:** enum `ContentStatus` tipado, função única para transitar entre estados que valida a tabela de transições permitidas, registra audit log e dispara efeitos colaterais (e-mail, revalidation). Cada tipo de conteúdo (vaga/CV/serviço) tem sua própria tabela de transições (mas a maior parte é compartilhada).

- **Prós:** transições centralizadas; impossível pular passos; auditoria automática; testes da máquina de estados são isolados; efeitos colaterais (e-mail, revalidation) são side effects gerenciados por callback
- **Contras:** abstração — desenvolvedor precisa entender o padrão antes de mexer

### Opção C — Biblioteca de state machine (XState)

**Descrição:** usar XState ou similar para definir formalmente a máquina.

- **Prós:** ferramenta poderosa, visualizável
- **Contras:** dependência grande para uso modesto; curva de aprendizado; uso típico de XState é client-side; integração com Prisma + Server Actions pesa

## Decisão

Adotamos a **Opção B — Enum + função canônica + tabela declarativa de transições**.

### Estrutura

```typescript
// src/modules/moderation/domain/content-status.ts

export enum ContentStatus {
  DRAFT = 'DRAFT',
  IN_MODERATION = 'IN_MODERATION',
  AWAITING_ADJUSTMENTS = 'AWAITING_ADJUSTMENTS',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',                   // apenas vaga
  ARCHIVED = 'ARCHIVED',
  INACTIVATED = 'INACTIVATED',
}

export enum ContentKind {
  JOB = 'JOB',
  CV = 'CV',
  SERVICE = 'SERVICE',
}

// Transições permitidas, definidas por tipo de conteúdo
export const TRANSITIONS: Record<ContentKind, Array<{
  from: ContentStatus
  to: ContentStatus
  trigger: TransitionTrigger          // quem dispara: AUTHOR_ACTION, MODERATOR_ACTION, SYSTEM_JOB, COORDINATOR_INACTIVATION
  requiresJustification: boolean
}>> = {
  JOB: [
    { from: 'DRAFT',               to: 'IN_MODERATION',       trigger: 'AUTHOR_ACTION',          requiresJustification: false },
    { from: 'IN_MODERATION',       to: 'ACTIVE',              trigger: 'MODERATOR_ACTION',       requiresJustification: false },
    { from: 'IN_MODERATION',       to: 'AWAITING_ADJUSTMENTS',trigger: 'MODERATOR_ACTION',       requiresJustification: true  },
    { from: 'IN_MODERATION',       to: 'REJECTED',            trigger: 'MODERATOR_ACTION',       requiresJustification: true  },
    { from: 'AWAITING_ADJUSTMENTS',to: 'IN_MODERATION',       trigger: 'AUTHOR_ACTION',          requiresJustification: false },
    { from: 'ACTIVE',              to: 'PAUSED',              trigger: 'AUTHOR_ACTION',          requiresJustification: false },
    { from: 'PAUSED',              to: 'ACTIVE',              trigger: 'AUTHOR_ACTION',          requiresJustification: false },
    { from: 'ACTIVE',              to: 'DRAFT',               trigger: 'AUTHOR_ACTION',          requiresJustification: false },  // editar
    { from: 'ACTIVE',              to: 'ARCHIVED',            trigger: 'AUTHOR_ACTION',          requiresJustification: false },
    { from: 'ACTIVE',              to: 'EXPIRED',             trigger: 'SYSTEM_JOB',             requiresJustification: false },  // só JOB
    { from: 'ACTIVE',              to: 'INACTIVATED',         trigger: 'COORDINATOR_INACTIVATION', requiresJustification: true },
    // ...
  ],
  CV: [ /* CV não tem EXPIRED, demais idênticos */ ],
  SERVICE: [ /* idem CV */ ],
}

export type TransitionTrigger =
  | 'AUTHOR_ACTION'
  | 'MODERATOR_ACTION'
  | 'SYSTEM_JOB'
  | 'COORDINATOR_INACTIVATION'
```

### Função canônica

```typescript
// src/modules/moderation/actions/transitionContent.ts

export async function transitionContent(input: {
  contentKind: ContentKind
  contentId: string
  to: ContentStatus
  trigger: TransitionTrigger
  justification?: string
}): Promise<ActionResult<TransitionResult>> {
  // 1. Carregar estado atual
  const current = await loadContentStatus(input.contentKind, input.contentId)

  // 2. Validar transição
  const valid = TRANSITIONS[input.contentKind].find(
    t => t.from === current && t.to === input.to && t.trigger === input.trigger
  )
  if (!valid) {
    return { ok: false, error: { code: 'INVALID_TRANSITION', from: current, to: input.to } }
  }

  // 3. Validar justificativa quando exigida
  if (valid.requiresJustification && !input.justification?.trim()) {
    return { ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } }
  }

  // 4. Verificar permissão conforme trigger
  // (MODERATOR_ACTION requer MODERATE_<KIND>, etc.)

  // 5. Aplicar transição, registrar audit log, disparar efeitos colaterais
  return withAudit(eventTypeFor(input), async (tx) => {
    await updateContentStatus(tx, input.contentKind, input.contentId, input.to, input.justification)

    // Side effects:
    await sendModerationEmail(input, current)              // ADR-T-0012-not, this is unrelated
    await revalidatePublicCacheIfNeeded(input)             // ADR-T-0013
    await triggerVerifiedCompanyFlagIfApplicable(input)    // específico de JOB ativando 1ª vez

    return { ok: true, data: { from: current, to: input.to } }
  })
}
```

### Tabela única `content_lifecycle` vs. coluna em cada tabela

**Decisão:** coluna `status ContentStatus` em cada tabela (`jobs`, `candidate_profiles`, `services`) — modelo "type-specific". Não criamos tabela genérica `content_lifecycle` porque cada tipo tem campos próprios e queries diferentes (filtros, projeções). A função `transitionContent` recebe `contentKind` e despacha internamente.

### Histórico de transições

Não criamos tabela `content_status_history` separada — o **`audit_log` já cobre** com eventos `CONTENT_SUBMITTED_TO_MODERATION`, `CONTENT_APPROVED`, etc. (ADR-T-0004 estendido). Consulta de histórico de uma vaga = query no `audit_log` por `entity_type = 'job', entity_id = X`.

### Side effects gerenciados

Toda transição que afeta:
- **E-mail (USP-044):** disparado conforme tabela de transições (aprovado → e-mail ao autor; devolvido → e-mail com motivo; etc.)
- **Cache público (ADR-T-0013):** `revalidatePath` de rotas afetadas quando transição muda visibilidade (entrar em ACTIVE, sair de ACTIVE)
- **Flag de Empresa verificada:** quando primeira vaga da Empresa entra em ACTIVE, `companies.is_verified = true`

Side effects são **side effects da transição**, não responsabilidade do chamador. Encapsulados em `transitionContent`.

### Validação manual de Empresa na 1ª vaga (USP-017)

Caso especial documentado: ao aprovar a primeira vaga de uma Empresa (`IN_MODERATION → ACTIVE`), o moderador é guiado por UI a uma **checklist de inspeção da Empresa** antes de confirmar a aprovação:
- CNPJ válido ([dígito verificador já validado no cadastro])
- Razão social consistente com nome fantasia / domínio do site
- Endereço razoável
- Setor coerente com a vaga
- Sem sinais de empresa-fantasma (busca rápida do CNPJ em sites públicos)

A inspeção não bloqueia tecnicamente a aprovação — é processo humano. Mas o checkbox de "Empresa validada" registra `COMPANY_VERIFIED` no audit log junto com `CONTENT_APPROVED`.

### Job de expiração (apenas vagas)

GitHub Actions cron diário (06:00 UTC = 03:00 BRT) executa Server Action `expireOverdueJobs()` que:
1. Busca todas as vagas com `status = ACTIVE` e `valid_until < now()`
2. Para cada uma, chama `transitionContent({kind: 'JOB', id, to: 'EXPIRED', trigger: 'SYSTEM_JOB'})`
3. Cada transição dispara o e-mail "vaga expirada" e revalida o cache público

E-mail "vaga próxima da expiração" (AC-044-7) sai 3 dias antes, em outro job similar.

## Consequências

**Positivas:**
- Estados explícitos; transição inválida retorna erro tipado
- Auditoria + e-mail + revalidation são responsabilidade da transição, não dispersos
- Testes da máquina ficam isolados: "para cada (from, to, trigger), validar happy path + caso justification missing"
- Mudança no fluxo (Release 2 ou ajuste) = mudança na tabela `TRANSITIONS`, sem hunt de `if`s

**Negativas (trade-offs aceitos):**
- Abstração — desenvolvedor precisa entender o padrão. Mitigação: project-guideline + exemplo canônico em cada módulo de conteúdo
- Job de expiração roda só uma vez por dia — vaga expirada às 03:01 BRT só é processada às 03:00 do dia seguinte. Aceitável (impacto pequeno)

**Neutras / a monitorar:**
- Se XState ou Inngest provar valor em V2, migrar — interface `transitionContent` é estável o suficiente para isso

## Riscos e Mitigações

**Risco 1 — Código aplica `prisma.job.update({data: {status: 'ACTIVE'}})` direto, sem passar por `transitionContent`.** **Mitigação:** convenção rígida; revisão de PR; lint custom que detecta updates de coluna `status` fora de `transitionContent`.

**Risco 2 — Side effect falha (e-mail Resend fora do ar)** e a transição rola mesmo assim. **Mitigação:** e-mail é "soft fail" (logado no Sentry, não bloqueia); revalidation é tentado mas falha não bloqueia (ISR como fallback de 30min).

**Risco 3 — Concorrência de transições** (dois moderadores aprovam o mesmo conteúdo em paralelo). **Mitigação:** `transitionContent` faz UPDATE com `WHERE status = current` (otimista) — segunda chamada falha por `INVALID_TRANSITION`.

## Referências

- ADR-0015 de negócio (Moderação humana pré-publicação)
- ADR-T-0004 (audit log — extensão com eventos de moderação)
- ADR-T-0013 (cache público — revalidation acionada por transições)
- PRD MVP Portal USP-016 a USP-019, USP-020, USP-022, USP-044
- Lentes do arquiteto: Acoplamento & Coesão, Fail-Fast & Blast Radius, Observability by Design
