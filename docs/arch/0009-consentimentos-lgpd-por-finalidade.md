# ADR-0009 (Técnico) — Consentimentos LGPD por finalidade com versionamento de termo

- **Status:** Aceito
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** lgpd | consentimento | conformidade | persistencia

## Contexto e Problema

ADR-0013 de negócio determina que o Portal opera com **consentimentos múltiplos por finalidade**, com 8 finalidades previstas no MVP, cada uma com base legal própria, versão de termo própria, possibilidade de revogação individual.

A arquitetura precisa decidir:
- Estrutura de dados que persiste cada consentimento com versão do termo, data, IP, ator e status
- Como o termo jurídico (texto humanamente legível, mutável ao longo do tempo) é versionado e referenciado
- Quando o consentimento é solicitado (lazy — ao ativar a finalidade vs. eager — no cadastro inicial)
- Como revogação interage com o papel correspondente (ADR-T-0008)
- Como o termo de candidato com finalidade "extração via IA" referencia o provedor LLM (que pode mudar — ADR-T-0012)

## Drivers de Decisão

- LGPD (Lei 13.709/2018) art. 7º, 8º — consentimento informado, específico, granular
- Capacidade de comprovar judicialmente o que foi consentido em uma data específica → versionamento textual do termo é mandatório
- UX humana — solicitar consentimento de 8 finalidades de uma vez no cadastro inicial é hostil; pedir só quando a finalidade vai ser ativada é mais legível
- Revogação granular não pode destruir dados do perfil — apenas inativar o papel (ADR-T-0008)
- Termos jurídicos são produzidos pela ASONSEG (D-002 ampliada) e podem ser revisados ao longo do tempo

## Opções Consideradas

### Opção A — Tabela única `consents` com versão e finalidade (escolhida)

**Descrição:** uma tabela `consents` com uma linha por consentimento. Termos versionados em diretório separado do código (Git como source of truth do texto) e referenciados por identificador estável `purpose@version`.

- **Prós:** explícito; auditável por design (cada consentimento tem timestamp, IP, ator); revogação por finalidade trivial; histórico preservado
- **Contras:** termo textual fica fora do banco (em arquivos versionados no repositório) — sutileza para o time absorver

### Opção B — Tabela `consents` + termos em tabela `consent_term_versions`

**Descrição:** acrescenta uma tabela com versões textuais do termo armazenadas no banco.

- **Prós:** termo e consentimento ficam juntos; comprovação 100% no banco
- **Contras:** versionamento de texto é melhor no Git (revisão jurídica via PR); duplicação se também versionarmos no repo

### Opção C — Consentimento implícito + log de aceite em audit_log

**Descrição:** sem tabela dedicada; cada aceite gera uma entrada em `audit_log` apenas.

- **Prós:** mínimo
- **Contras:** consulta "Pessoa X tem consentimento ativo para finalidade Y" exige varrer `audit_log` (lento); revogação não tem representação clara; insuficiente para comprovação LGPD

## Decisão

Adotamos a **Opção A — tabela `consents` + termos versionados em arquivos do repositório**.

### Schema

```prisma
model Consent {
  id              String         @id @default(uuid()) @db.Uuid
  personId        String         @map("person_id") @db.Uuid
  purpose         ConsentPurpose
  termVersion     String         @map("term_version")              // ex: 'candidate@v1.2'
  termContentHash String         @map("term_content_hash")         // SHA-256 do texto no momento do aceite
  acceptedAt      DateTime       @default(now()) @map("accepted_at") @db.Timestamptz
  acceptedIp      String?        @map("accepted_ip") @db.Inet
  userAgent       String?        @map("user_agent")
  revokedAt       DateTime?      @map("revoked_at") @db.Timestamptz
  revokedReason   String?        @map("revoked_reason")
  // Metadados específicos por finalidade (ex.: nome do provedor LLM no momento do aceite — ADR-T-0012)
  context         Json?

  person          Person         @relation(fields: [personId], references: [id])
  @@unique([personId, purpose, acceptedAt])
  @@index([personId, purpose, revokedAt])                          // index para "consentimento ativo"
  @@map("consents")
}

enum ConsentPurpose {
  PORTAL_ACCESS                  // Finalidade 1 — cadastro/autenticação
  JOB_APPLICATION                // Finalidade 2 — candidatura
  SERVICE_OFFERING               // Finalidade 3 — oferta de serviço
  SERVICE_HIRING                 // Finalidade 4 — contratação como cliente
  COMPANY_REPRESENTATION         // Finalidade 5 — representação de empresa
  SOCIAL_ASSISTANCE              // Finalidade 6 — atendimento social
  CV_AI_EXTRACTION               // Finalidade 7 — extração de CV via LLM
  SOCIAL_REFERRAL_TO_JOB         // Finalidade 8 — encaminhamento institucional
}
```

### Termos textuais — versionamento no repositório

Termos vivem em `legal/consent-terms/` no repositório, um arquivo por finalidade:

```
legal/consent-terms/
├── portal-access/
│   ├── v1.0.md
│   └── v1.1.md
├── job-application/
│   └── v1.0.md
├── cv-ai-extraction/
│   ├── v1.0.md       # provedor: Anthropic Claude
│   └── v2.0.md       # se trocarmos de provedor (ADR-T-0012)
└── ...
```

Cada arquivo `.md` contém:
- Cabeçalho YAML com `version`, `purpose`, `effective_date`, `legal_basis`
- Texto do termo em PT-BR, aprovado por jurídico (D-002)
- Lista de operações de tratamento de dados

Hash SHA-256 do conteúdo é calculado em build-time e persistido no banco no momento do aceite — garante integridade entre o texto que o titular viu e o que ficou no banco.

### Solicitação de consentimento (lazy)

Consentimento de uma finalidade é solicitado **no momento de ativar a funcionalidade vinculada**, não no cadastro inicial. Comportamento concreto:

| Finalidade | Quando o termo é exibido |
|---|---|
| `PORTAL_ACCESS` | No fluxo de auto-cadastro (USP-001) ou no primeiro login após reivindicação (USP-003) |
| `JOB_APPLICATION` | Ao ativar o papel de candidato (USP-009) |
| `SERVICE_OFFERING` | Ao ativar o papel de prestador |
| `SERVICE_HIRING` | Na primeira manifestação de interesse (USP-033) — papel cliente é ativado junto |
| `COMPANY_REPRESENTATION` | Ao cadastrar a primeira Empresa (USP-012) |
| `SOCIAL_ASSISTANCE` | Quando a AS ativa o papel beneficiário e/ou cria a ficha socioeconômica (USP-036) — pode ser presencial em papel + AS lança no sistema |
| `CV_AI_EXTRACTION` | Antes do primeiro upload de CV (USP-040) |
| `SOCIAL_REFERRAL_TO_JOB` | Junto com `SOCIAL_ASSISTANCE` no fluxo da AS, ou separadamente se já existir Pessoa em atendimento |

### Operações suportadas

**Aceite:**
```typescript
await withAudit('CONSENT_GRANTED', async (tx) => {
  await tx.consent.create({
    data: {
      personId, purpose: 'JOB_APPLICATION',
      termVersion: 'job-application@v1.0', termContentHash: '...',
      acceptedIp: req.ip, userAgent: req.headers['user-agent'],
    },
  })
})
```

**Verificar consentimento ativo:**
```typescript
const active = await prisma.consent.findFirst({
  where: { personId, purpose: 'JOB_APPLICATION', revokedAt: null },
})
if (!active) throw new ConsentRequiredError('JOB_APPLICATION')
```

**Revogar:**
```typescript
await withAudit('CONSENT_REVOKED', async (tx) => {
  await tx.consent.update({
    where: { id: consentId },
    data: { revokedAt: new Date(), revokedReason: motivo },
  })
  // Cascata: revogar role grants correspondentes
  await tx.personRoleGrant.updateMany({
    where: { personId, role: 'CANDIDATE', status: 'ACTIVE' },
    data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'consent_revoked' },
  })
})
```

### Painel da Pessoa (USP-043)

Tela `/conta/consentimentos` lista todos os consentimentos da Pessoa:
- Finalidade, versão do termo aceito, data/hora, IP (mascarado parcialmente)
- Botão "Visualizar termo na versão aceita" (carrega arquivo do repositório pelo `termVersion`)
- Botão "Revogar este consentimento" com confirmação dupla (alerta sobre desativação do papel)

### Atualização de termo (nova versão)

Quando jurídico revisa um termo (mudança de cláusula, mudança de provedor LLM):
1. Nova versão é commitada em `legal/consent-terms/<purpose>/vN.md`
2. **Consentimentos anteriores permanecem válidos** (versão aceita é imutável no banco)
3. Para operações que exigem aceite da nova versão (ex.: troca de provedor LLM), sistema solicita re-aceite no próximo acesso à funcionalidade — fluxo de "consentimento desatualizado"
4. No painel da Pessoa, consentimentos com versão desatualizada são sinalizados visualmente

## Consequências

**Positivas:**
- Modelo LGPD-grade explícito; comprovação judicial robusta (versão + hash + IP + timestamp)
- Solicitação lazy melhora UX (titular vê só o termo da finalidade que vai ativar)
- Revogação individual sem afetar outras finalidades
- Termo textual versionado no Git permite revisão jurídica via PR (workflow auditável)
- Troca de provedor LLM = nova versão de termo + re-aceite (ADR-T-0012)

**Negativas (trade-offs aceitos):**
- Termo fora do banco — depende de o repositório estar versionado e os arquivos não serem removidos (mitigado por hash persistido — se o arquivo sumir, o hash provará que o conteúdo existiu)
- Re-aceite após atualização de termo é fricção real — minimizado por boa UX e por raramente atualizar

**Neutras / a monitorar:**
- Volume previsto de consentimentos: ~500-1000 candidatos × 2-3 consentimentos médios = ~2k registros no primeiro ano — confortável

## Riscos e Mitigações

**Risco 1 — Termo versionado no repositório é apagado por engano em refactor.** **Mitigação:** hash persistido no banco serve como prova; histórico do Git preserva arquivos; CI poderia validar que todos os hashes ativos têm arquivo correspondente (lint custom planejado).

**Risco 2 — Pessoa revoga consentimento `PORTAL_ACCESS` (cadastro/autenticação).** Implicação: precisa inativar a Pessoa toda. **Mitigação:** UI alerta explicitamente; revogação dessa finalidade dispara fluxo de inativação com confirmação adicional. ASONSEG mantém dados até o prazo legal (5 anos pós-revogação para fins de comprovação — ADR-0005 técnico e ADR-0008 de negócio).

**Risco 3 — Aceite de consentimento sem IP capturado** (proxy/cloudflare mascarando). **Mitigação:** capturar `x-forwarded-for` confiável da Vercel; fallback graceful para `acceptedIp = null` com warning logado.

## Referências

- ADR-0013 de negócio (Consentimentos LGPD por finalidade)
- ADR-0017 de negócio (Visibilidade conservadora — referência cruzada)
- ADR-0018 de negócio (Extração de CV via IA — finalidade 7)
- ADR-T-0008 (Pessoa unificada + papéis)
- ADR-T-0012 (Integração LLM — depende deste ADR para finalidade 7)
- PRD MVP Portal USP-043, §6.7 (Compliance LGPD)
- LGPD art. 7º (consentimento), art. 8º (consentimento específico), art. 18 (direitos do titular)
- Lentes do arquiteto: Compliance by Design, Observability by Design
