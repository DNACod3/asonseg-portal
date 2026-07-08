# USP-027 — Empresa ver lista de candidatos da vaga — Specification

> **Unidade U3 da Fase 3** (Candidaturas + Busca + Extração de CV). Planejada em
> conjunto com a **USP-028** (busca ativa) — as duas entregam View Models de
> candidato voltados à Empresa, com controle de privacidade LGPD. Design do View
> Model compartilhado: ver `../usp-028-empresa-buscar-candidatos/design.md`.
>
> **Fonte da verdade upstream** (adapt, don't re-derive): a spec de épico
> `.specs/features/candidaturas-busca-candidatos/spec.md` (história "Empresa ver
> lista de candidatos da vaga", req. **CAN-03**). Os IDs `USP027-NN` abaixo
> **decompõem** CAN-03 em requisitos atômicos rastreáveis; não forkam a fonte.

## Problem Statement

Uma Empresa que publicou uma vaga precisa ver **quem se candidatou** para avaliar
e entrar em contato. Hoje não existe nenhuma consulta nem View Model que exponha
candidatos a uma Empresa — só `viewPersonForStaff` (institucional). Expor contato
e CV de um candidato a outra Pessoa (a Empresa) é operação sensível sob LGPD: só
pode ocorrer para o responsável **da própria Empresa** dona da vaga, apenas para
candidaturas **ativas**, sempre via View Model, e **todo acesso a dado sensível
deve deixar rastro de auditoria** (direito de acesso LGPD).

## Goals

- [ ] Permitir que o responsável ativo de uma Empresa veja as candidaturas
      **ativas** de uma vaga **da própria Empresa**, com nome, contato (e-mail e
      telefone) e link para o CV, sempre via `viewCandidateForEmployer`.
- [ ] Registrar rastro de auditoria em todo acesso: `APPLICATION_VIEWED_BY_EMPLOYER`
      (nível vaga) + `SENSITIVE_FIELD_VIEWED` (por candidato cujo contato/CV é servido).
- [ ] Negar o acesso a vaga que não pertence à Empresa do consultante (ownership).
- [ ] Exibir data/hora da candidatura (fuso `America/Sao_Paulo`) e o badge
      "Candidato encaminhado pela ASONSEG" quando `Application.viaEncaminhamento`.
- [ ] Garantir que **nenhum** dado do candidato trafegue por consulta direta ao
      Prisma para a Empresa — só via View Model tipado (sem vazar linha crua no
      payload RSC/Flight).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Busca ativa de candidatos (filtros/texto) | É a **USP-028** (mesma unidade U3, dir irmão). |
| Escrita da candidatura (candidatar-se / cancelar) | É a **USP-025/026** (Unidade U2). Aqui só **leitura**. |
| Materializar `Application.viaEncaminhamento` | Entregue por **U2 (USP-025)**; aqui só é **lido**. Sempre `false` na Fase 3 (Referral entra na Fase 5). |
| Kanban / status de candidatura (vista, entrevistada, contratada) | Fora do MVP (Deferred Ideas do STATE; V2). |
| Notificação à Empresa de nova candidatura | Candidatura é silenciosa (épico); só o candidato recebe e-mail. |
| Mensageria Empresa↔candidato | Fora do MVP; contato ocorre fora do sistema. |
| Persistir `Person.phone` no cadastro de candidato | Débito pré-existente da USP-009 (o form coleta mas não persiste `phone`). USP-027 **exibe** o que houver; correção é follow-up (ver Assumptions). |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| `Application.viaEncaminhamento Boolean @default(false)` existe quando U3 roda | pipeline (U2/USP-025) | Ler o campo; renderizar o badge condicionalmente | U2 é sequenciada **antes** de U3 pelo orquestrador; owner interno da pipeline, **não** externo → não trip do Entry Gate. Se ausente no working tree, é sinal de que U2 não rodou (o Verifier deve falhar), não de U3 criar a coluna. | n |
| Contato exposto = `Person.emailLogin` + `Person.phone` | agent | e-mail sempre presente (auto-cadastro); telefone pode ser `null` → UI "não informado" | `CandidateProfile` **não** tem coluna de telefone; `activateCandidateRole` valida `phone` mas **não** o persiste (débito USP-009). USP-027 não é dona do fix; exibe graciosamente. | y |
| Campos sensíveis servidos ao empregador = **só** e-mail, telefone, CV, nome | agent | View Model **não** carrega `cpf`, `birthDate`, `fullAddress` nem para o empregador autorizado (least privilege) | Empresa precisa de contato+CV para dar sequência; CPF/endereço/nascimento não são necessários → não devem sequer ser SELECTados. | y |
| CV entregue como **URL assinada de curta duração** via `shared/lib/supabase-storage` | agent | `listJobApplicants` resolve a signed URL server-side quando `cvStoragePath` presente; se bucket não provisionado no ambiente, `cv.available=false` e link desabilita | Reusa o client de storage da Fase 0 (AD-013). Geração da URL = o acesso sensível → coberto pelo `SENSITIVE_FIELD_VIEWED`. Degrada limpo. | y |
| Auditoria por render (inclui refresh/paginação) | agent | Cada carregamento da lista grava 1 `APPLICATION_VIEWED_BY_EMPLOYER` + N `SENSITIVE_FIELD_VIEWED` (N = candidatos da página) | `audit_log` é append-only e o objetivo LGPD é o trilho de acesso por candidato. Dedup/throttle é Deferred Idea, não MVP. | y |
| Autorização = gate de domínio `requireActiveResponsible(viewer.id, job.companyId)` | agent | **Não** há `PermissionId` de empregador no catálogo RBAC; reusa o gate de vínculo Pessoa↔Empresa do módulo `jobs` (mesmo dos ciclos de vida de vaga) | Confirmado por varredura do enum `PermissionId` (só moderação/coordenação). | y |
| Paginação da lista de candidaturas | agent | `take` obrigatório, `APPLICANTS_PAGE_SIZE = 20`, ordenado por `appliedAt ASC` | L-002 (paginação obrigatória) + AC de exibir data/hora e ordem estável. | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Empresa ver lista de candidatos da vaga ⭐ MVP

**User Story**: Como Pessoa-responsável ativa de uma Empresa, quero ver a lista de
candidatos que se candidataram a uma vaga **minha**, com contato e CV, para avaliar
e entrar em contato — com o acesso a dados sensíveis registrado em auditoria.

**Why P1**: Sem visualizar os candidatos, a Empresa não consegue avaliar nem dar
prosseguimento ao processo seletivo. É o retorno de valor da candidatura (USP-025).

**Acceptance Criteria**:

1. WHEN o responsável ativo abre a página de candidatos de uma vaga **da sua Empresa**
   THEN o sistema SHALL listar todas as candidaturas **ativas** (`cancelledAt IS NULL`),
   ordenadas por data da candidatura, com: nome do candidato, contato (e-mail e
   telefone) e link para o CV — servidos por `viewCandidateForEmployer`. *(USP027-01)*
2. WHEN uma candidatura tem `viaEncaminhamento = true` THEN o sistema SHALL exibir o
   badge visível "Candidato encaminhado pela ASONSEG" naquele item. *(USP027-02)*
3. WHEN a lista é exibida THEN o sistema SHALL exibir a **data e hora** da candidatura
   convertida para `America/Sao_Paulo`. *(USP027-03)*
4. WHEN o contato/CV do candidato é servido THEN o sistema SHALL registrar
   `APPLICATION_VIEWED_BY_EMPLOYER` (entity=job) **e** um `SENSITIVE_FIELD_VIEWED`
   por candidato (entity=person), e SHALL servir os dados **apenas** via View Model,
   nunca consultando o Prisma diretamente para devolver a linha crua ao cliente. *(USP027-04)*
5. WHEN um responsável de **outra** Empresa (ou não-responsável) tenta abrir os
   candidatos da vaga THEN o sistema SHALL negar o acesso (`FORBIDDEN`), sem
   carregar nem registrar dado de candidato. *(USP027-06)*

**Independent Test**: Como responsável de uma Empresa, abrir uma vaga com
candidaturas ativas e canceladas e verificar: (a) só as ativas aparecem, ordenadas
por `appliedAt`; (b) contato/CV vêm do View Model (a linha crua não aparece no
payload); (c) data/hora exibida em fuso SP; (d) badge de encaminhamento quando
`viaEncaminhamento=true`; (e) `APPLICATION_VIEWED_BY_EMPLOYER` + `SENSITIVE_FIELD_VIEWED`
gravados; (f) responsável de outra Empresa recebe `FORBIDDEN`.

---

## Edge Cases

- WHEN a vaga não existe THEN o sistema SHALL retornar `NOT_FOUND` sem vazar
  existência. *(USP027-07)*
- WHEN a vaga existe mas não tem candidaturas ativas (nenhuma ou todas canceladas)
  THEN o sistema SHALL exibir estado vazio "Nenhuma candidatura ativa" (sem erro). *(USP027-08)*
- WHEN uma candidatura está cancelada (`cancelledAt != null`) THEN o sistema SHALL
  **excluí-la** da lista. *(USP027-MN-03)*
- WHEN o candidato aplicante não tem `CandidateProfile` ou não tem CV
  (`cvStoragePath = null`) THEN o sistema SHALL exibir o item com `cv.available=false`
  (sem quebrar) e sem registrar acesso a CV inexistente.
- WHEN o telefone do candidato é `null` THEN o sistema SHALL exibir "não informado"
  sem quebrar o contato.
- WHEN o responsável perdeu o vínculo (`PersonCompanyGrant` revogado/pendente) THEN
  o acesso SHALL ser negado (`FORBIDDEN`) na próxima navegação (ADR-0030). *(USP027-MN-02)*

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| USP027-MN-01 | ao servir candidatos ao empregador, carregar (SELECT) ou emitir `cpf`, `birthDate` ou `fullAddress` do candidato | Sobre-exposição de PII além do contato necessário (mesmo ao empregador autorizado) | T3, T4 | unit VM: chaves proibidas ausentes + SELECT não pede; int: `JSON.stringify` do resultado não contém o CPF/endereço semeado |
| USP027-MN-02 | permitir que um responsável veja candidatos de uma vaga que **não** pertence à Empresa da qual é responsável ativo | Quebra de controle de acesso entre Empresas (BOLA) | T4 | int: responsável de outra Empresa → `FORBIDDEN`, sem carregar candidato |
| USP027-MN-03 | incluir candidaturas canceladas (`cancelledAt != null`) na lista | Exibir candidato que se retirou (privacidade + dado obsoleto) | T4 | int: semear ativa+cancelada; só a ativa retorna |
| USP027-MN-04 | servir contato/CV sem gravar o trilho de auditoria (`APPLICATION_VIEWED_BY_EMPLOYER` + `SENSITIVE_FIELD_VIEWED`) | Acesso a PII sem rastro (lacuna do direito de acesso LGPD) | T4 | int: após a consulta, ambos os eventos existem no `audit_log`; consulta negada → nenhum evento |
| USP027-MN-05 | retornar linha crua de `Person`/`Application` do Prisma ao cliente (fora do View Model tipado) | Vazamento de campo sensível no payload RSC/Flight | T3, T4 | tipo de retorno é o View Model; int: nenhum campo sensível no `JSON.stringify` do resultado |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| USP027-01 | P1 (AC1) | Design | Pending |
| USP027-02 | P1 (AC2) | Design | Pending |
| USP027-03 | P1 (AC3) | Design | Pending |
| USP027-04 | P1 (AC4) | Design | Pending |
| USP027-06 | P1 (AC5) / edge | Design | Pending |
| USP027-07 | Edge (não existe) | Design | Pending |
| USP027-08 | Edge (vazio) | Design | Pending |
| USP027-MN-01 | Must-not | Design | Pending |
| USP027-MN-02 | Must-not | Design | Pending |
| USP027-MN-03 | Must-not | Design | Pending |
| USP027-MN-04 | Must-not | Design | Pending |
| USP027-MN-05 | Must-not | Design | Pending |

**ID format:** `USP027-NN` (realizam a req. de épico **CAN-03**); must-nots `USP027-MN-NN`.
**Status values:** Pending → In Design → In Tasks → Implementing → Verified.
**Coverage:** 12 requisitos, todos mapeados a tasks em `tasks.md` (0 unmapped).

---

## Success Criteria

- [ ] Responsável ativo vê **apenas** candidaturas ativas da **própria** vaga, com
      contato, CV, data/hora e badge de encaminhamento quando aplicável — via
      `viewCandidateForEmployer`.
- [ ] `APPLICATION_VIEWED_BY_EMPLOYER` + `SENSITIVE_FIELD_VIEWED` gravados a cada acesso.
- [ ] Responsável de outra Empresa recebe `FORBIDDEN`; vaga inexistente → `NOT_FOUND`.
- [ ] CPF, `birthDate` e `fullAddress` **nunca** são SELECTados nem emitidos.
- [ ] Nenhum dado de candidato trafega por Prisma direto — só via View Model tipado
      (sensor de discriminação sobre o payload serializado passa).
