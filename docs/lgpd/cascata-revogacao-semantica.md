# Semântica da cascata de revogação de consentimento

> ✅ **STATUS: APROVADO em 2026-06-03 pela DPO (diretora Angélica) + jurídico.**
> Define a semântica concreta da cascata de revogação por finalidade (o "destino"
> de dados já compartilhados e artefatos ativos) que o
> [ADR-0025](../IDSD/architecture/adrs/0025-cascata-de-revogacao-de-consentimento.md)
> deixou em aberto. Este documento é o **adendo ao ADR-0025**; a matriz está
> materializada em código em
> [`src/modules/consents/domain/revocation-cascade.ts`](../../src/modules/consents/domain/revocation-cascade.ts)
> (`REVOCATION_CASCADE_MATRIX`).
>
> As decisões abaixo (coluna **Decisão** = ☑) estão **aprovadas**. A aplicação de
> cada efeito em seu módulo (`jobs`, `services`, `referrals`, …) é trabalho das
> USPs desses módulos que consomem a matriz.
>
> Origem: USP-043 (#209) · pendência 🔶 "semântica da cascata" do
> [checklist de go-live](checklist-revisao-lgpd.md#8-pend%C3%AAncias-bloqueantes-de-go-live).

---

## 1. O que já está decidido (mecanismo — não está em revisão)

O **mecanismo** da cascata é o ADR-0025 (Opção A, *Accepted*) e **não** é objeto
desta revisão. Resumo do que o código já garante:

1. **Matriz declarativa finalidade → papel** ([`purpose-role-map.ts`](../../src/modules/consents/domain/purpose-role-map.ts)):
   ao revogar, o `PersonRoleGrant` vinculado vai a `REVOKED` (`revokedAt` preenchido).
2. **Verificação on-read** (`requireActiveConsent`) em toda operação ligada a uma
   finalidade — fecha a janela proibida por **P-002** (zero "papel ativo sem
   consentimento") **mesmo se um efeito assíncrono atrasar**.
3. **Sem exclusão de dados** — revogação desativa o *uso*, preserva o *histórico*
   com marcação "finalidade revogada em DD/MM/AAAA" (USP-039/P-006 + retenção
   indefinida do ADR-0008 de negócio).
4. **Registro append-only** — `withAudit('CONSENT_REVOKED', ...)` (justificativa
   obrigatória) + `ROLE_GRANT_REVOKED` em cascata.

> **O que está em aberto e esta revisão precisa fechar:** o **destino dos artefatos
> ativos e dos dados já compartilhados com terceiros** (empregador, cliente,
> prestador, equipe interna) no momento da revogação. É a coluna "efeitos" da
> matriz que o código ainda não materializou.

## 2. Princípios LGPD que enquadram as decisões

- **Revogação a qualquer tempo** (art. 8º, §5º) — facilitada, gratuita, pelo painel.
- **Não-retroatividade** (art. 8º, §5º / art. 18) — a revogação **não desfaz**
  tratamentos lícitos **já realizados**. Dado que já foi legitimamente compartilhado
  com um terceiro **antes** da revogação não "volta"; o que cessa é o tratamento
  **dali para frente**.
- **Eliminação após fim do tratamento** (art. 16) — com exceções de guarda legal,
  exercício de direitos e (anonimizado) outras hipóteses. Aqui, ADR-0008 (negócio)
  opta por **retenção com marcação**, não exclusão.
- **Dado sensível** (art. 11) — `SOCIAL_ASSISTANCE` exige tratamento mais restritivo.

## 3. Vocabulário dos efeitos (a escolher por finalidade)

Para cada artefato ativo, a DPO escolhe **um** efeito:

| Efeito | Significado |
|---|---|
| **MANTER** | Artefato permanece como está (tratamento já realizado, não-retroativo). |
| **MARCAR** | Mantém o registro, mas com flag "finalidade revogada em DD/MM" (histórico). |
| **OCULTAR** | Some das visões *dali para frente* (busca, catálogo, pipeline ativo); registro preservado. |
| **ENCERRAR** | Encerra/retira o artefato do fluxo ativo (ex.: candidatura → "retirada"); preserva histórico. |
| **ANONIMIZAR** | Remove/ofusca PII do artefato mantendo o dado estatístico/institucional. |
| **NOTIFICAR** | Terceiro envolvido (empresa/cliente/prestador) é avisado da mudança. |

Combinações são possíveis (ex.: **ENCERRAR + MARCAR**, sem **NOTIFICAR**).

---

## 4. Matriz proposta por finalidade

> Legenda da coluna **Decisão**: ☐ pendente · ☑ confirmado pela DPO+jurídico.
> A coluna **Recomendação** é a proposta deste draft.

### 4.1 `JOB_APPLICATION` → papel `CANDIDATE`

| Item | Recomendação (draft) | Decisão |
|---|---|---|
| Papel `CANDIDATE` | → `REVOKED` (já no mecanismo) | ☑ (mecanismo) |
| **Candidaturas ativas** (em avaliação) | **ENCERRAR + MARCAR** como "retirada por revogação"; saem do pipeline ativo do empregador (on-read bloqueia novas leituras do perfil). Histórico preservado. | ☑ |
| **Perfil do candidato** visível a empregadores | **OCULTAR** de buscas/listagens dali para frente (View Models — ADR-0010). | ☑ |
| **Dados já vistos pelo empregador** (perfil/contato já acessado antes da revogação) | **MANTER** (tratamento lícito já realizado — não-retroativo). Sem "desfazer". | ☑ |
| Notificar o empregador? | **NÃO** notificar individualmente (candidatura apenas deixa de constar como ativa). | ☑ |

### 4.2 `SERVICE_OFFERING` → papel `PROVIDER`

| Item | Recomendação (draft) | Decisão |
|---|---|---|
| Papel `PROVIDER` | → `REVOKED` | ☑ (mecanismo) |
| **Serviços publicados** no catálogo | **OCULTAR/despublicar** do catálogo público dali para frente; histórico preservado (transição via máquina de estados — ADR-0011, sem `prisma.update` direto). | ☑ |
| **Contratações/manifestações em andamento** dirigidas ao prestador | **MARCAR**; o prestador deixa de ser contatável por novos clientes. In-flight: ver §4.3. | ☑ |
| Notificar clientes com manifestação ativa? | **NÃO** (regra geral — terceiros não são notificados; a manifestação ativa é encerrada, cf. §4.3). | ☑ |

### 4.3 `SERVICE_HIRING` → papel `CLIENT`

| Item | Recomendação (draft) | Decisão |
|---|---|---|
| Papel `CLIENT` | → `REVOKED` | ☑ (mecanismo) |
| **Novas manifestações de interesse** | Bloqueadas (on-read). | ☑ (mecanismo) |
| **Contato do cliente já revelado** a um prestador (antes da revogação) | **MANTER** (já compartilhado licitamente — não-retroativo). | ☑ |
| **Manifestações ativas** ainda não respondidas | **ENCERRAR + MARCAR** ("retirada"); contato deixa de ser compartilhado com novos prestadores. | ☑ |

### 4.4 `COMPANY_REPRESENTATION` → papel `COMPANY_RESPONSIBLE`

| Item | Recomendação (draft) | Decisão |
|---|---|---|
| Papel `COMPANY_RESPONSIBLE` | → `REVOKED` (`COMPANY_RESPONSIBLE_REMOVED`) | ☑ (mecanismo) |
| **Vagas publicadas pela empresa** (a empresa é entidade sem login — ADR-0015) | **MANTER** ativas (pertencem à empresa, não à pessoa); apenas a *pessoa* deixa de representá-la. | ☑ |
| ⚠️ **Edge: pessoa é a única responsável da empresa** | **APROVADO — opção (b):** permitir a revogação e **alertar a coordenação** para nova designação (a empresa fica temporariamente sem responsável). | ☑ |

### 4.5 `SOCIAL_ASSISTANCE` → **sem papel** (dado sensível, art. 11)

| Item | Recomendação (draft) | Decisão |
|---|---|---|
| Uso futuro de dado sensível de atendimento | **Bloqueado** on-read (`requireActiveConsent`). | ☑ (mecanismo) |
| **Histórico de atendimento social** | **MARCAR** + **restringir acesso**; preservar pelo prazo de **guarda legal** (não excluir) — exceção do art. 16 / dado sensível. Acesso só por necessidade legal/DPO. | ☑ |
| Notificar a equipe de assistência social? | **SIM** — sinalizar à AS responsável (operacional, não ao titular). | ☑ |
| ⚠️ Especificidade do dado sensível | **APROVADO:** preservar por **dever legal de guarda** (prazo a confirmar pelo jurídico) com **acesso restrito**; não excluir. | ☑ |

### 4.6 `CV_AI_EXTRACTION` → **sem papel**

| Item | Recomendação (draft) | Decisão |
|---|---|---|
| Novos envios de CV ao provedor de IA | **Bloqueados** on-read. | ☑ (mecanismo) |
| **Dados já extraídos** do CV | **MANTER** se ainda sob `JOB_APPLICATION` ativo (foram processados licitamente); o provedor (Anthropic) opera em **ZDR — sem retenção** (ADR-0027), então não há cópia no terceiro a expurgar. | ☑ |
| Re-extração futura | Exige **novo consentimento** (e nova versão de termo se trocar o provedor — ADR-0009/0012). | ☑ (mecanismo) |

### 4.7 `SOCIAL_REFERRAL_TO_JOB` → **sem papel**

| Item | Recomendação (draft) | Decisão |
|---|---|---|
| Novos encaminhamentos institucionais pela AS | **Bloqueados** on-read. | ☑ (mecanismo) |
| **Encaminhamentos já realizados** (perfil já enviado a um empregador/vaga) | **MANTER + MARCAR** (não-retroativo; perfil já compartilhado). | ☑ |
| Notificar a AS? | **SIM** (operacional). | ☑ |

### 4.8 `PORTAL_ACCESS` → **sem papel** (sustenta o acesso)

| Item | Recomendação (draft) | Decisão |
|---|---|---|
| Conta de acesso | **Inativação da conta** (cascata da base de acesso — já descrito no termo v1.0). Sem login ⇒ todas as demais finalidades ficam inalcançáveis. | ☑ |
| **Histórico institucional** (atendimentos, candidaturas, auditoria) | **MANTER** (não exclusão — ADR-0008; audit append-only). | ☑ |
| Demais consentimentos ativos | **APROVADO — suspender:** a revogação inativa o acesso e deixa os demais consentimentos **suspensos** (não revogados), permitindo re-aceite no retorno. | ☑ |

---

## 5. Questões transversais para a DPO + jurídico

> ✅ **Respostas aprovadas (2026-06-03):** (1) re-concessão exige **novo aceite**;
> (2) **sem carência** — efeito imediato (P-002); (3) terceiros indivíduos **não**
> são notificados; (4) dado sensível **preservado** por guarda legal (prazo pelo
> jurídico) com **acesso restrito**; (5) empresa órfã: **opção (b)** — permitir +
> alertar a coordenação. Codificadas em `CASCADE_CROSS_CUTTING` e nos `policyNote`
> da `REVOCATION_CASCADE_MATRIX`.

1. **Re-concessão (re-grant):** quando o titular reativa uma finalidade antes
   revogada, exige-se **novo aceite** (novo `acceptedAt`/hash) — confirmar que não
   há "ressurreição" automática de candidaturas/serviços antes encerrados.
2. **Janela de prazo:** algum efeito deve ter carência (ex.: candidatura encerrada
   mas "desfazível" por N dias)? Recomendação: **não** — efeito imediato (P-002).
3. **Comunicação a terceiros:** a regra geral proposta é **não** notificar
   indivíduos terceiros (o artefato apenas some do fluxo ativo). Confirmar se há
   finalidade em que a notificação é **obrigatória**.
4. **Dado sensível (`SOCIAL_ASSISTANCE`):** há **dever legal de guarda** que se
   sobrepõe ao pedido de eliminação? Definir o prazo.
5. **Empresa órfã (§4.4):** bloquear a revogação do último responsável ou permitir
   e alertar a coordenação?

## 6. Próximos passos (após aprovação)

1. ✅ Decisões aprovadas pela DPO + jurídico (2026-06-03).
2. ✅ Matriz materializada em código:
   [`revocation-cascade.ts`](../../src/modules/consents/domain/revocation-cascade.ts)
   (`REVOCATION_CASCADE_MATRIX`) + testes por finalidade
   ([`revocation-cascade.test.ts`](../../src/modules/consents/__tests__/revocation-cascade.test.ts)).
3. ✅ Registrado como **adendo ao ADR-0025**; pendência 🔶 do
   [checklist §8](checklist-revisao-lgpd.md#8-pend%C3%AAncias-bloqueantes-de-go-live)
   resolvida.
4. ⏭️ **Próximo (USPs dos módulos):** consumir a matriz para aplicar os efeitos em
   `jobs` (encerrar candidaturas), `services` (despublicar), `referrals` etc.

---

## Aprovação

| Papel | Nome | Data | Veredito |
|---|---|---|---|
| DPO (encarregada) | Diretora Angélica | 2026-06-03 | ☑ aprovado |
| Jurídico | Lino | 2026-06-03 | ☑ aprovado |
| Tech Lead | _a preencher_ | 2026-06-03 | ☑ ciente |

## Referências

- [ADR-0025 — Cascata de revogação](../IDSD/architecture/adrs/0025-cascata-de-revogacao-de-consentimento.md)
- [`purpose-role-map.ts`](../../src/modules/consents/domain/purpose-role-map.ts) · [`revoke-consent.ts`](../../src/modules/consents/actions/revoke-consent.ts)
- [runbook-consent-gate](../IDSD/architecture/runbooks/runbook-consent-gate.md)
- ADR-0027 (porta CVExtractor / LLM ZDR): [`docs/IDSD/architecture/adrs/0027-...md`](../IDSD/architecture/adrs/0027-porta-cvextractor-llm-zdr.md)
- [Checklist de revisão LGPD](checklist-revisao-lgpd.md) · [DPO](dpo.md)
