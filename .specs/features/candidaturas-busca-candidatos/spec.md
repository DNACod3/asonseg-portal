# Candidaturas e Busca de Candidatos Specification

## Problem Statement

Candidatos ativos precisam de uma forma simples de manifestar interesse em vagas, e Empresas precisam de meios para descobrir e avaliar talentos — tanto de forma reativa (recebendo candidaturas em suas vagas) quanto ativa (buscando candidatos por filtros). Sem este fluxo, não há conexão efetiva entre a oferta de trabalho das Empresas e a base de candidatos da ASONSEG. Além disso, a exposição de dados pessoais sensíveis dos candidatos precisa ser controlada conforme a LGPD: o contato completo de um candidato só pode tornar-se visível à Empresa quando há consentimento explícito (candidatura) ou candidatura concretizada.

## Goals

- [ ] Permitir que um candidato ativo se candidate a uma vaga ativa de forma silenciosa, com consentimento `JOB_APPLICATION` e garantia de unicidade de candidatura ativa.
- [ ] Permitir que o candidato cancele sua candidatura e possa recandidatar-se posteriormente à mesma vaga.
- [ ] Permitir que a Empresa veja a lista de candidatos de suas vagas, com contato e CV, sempre via View Model e registrando o acesso a campos sensíveis.
- [ ] Permitir que a Empresa faça busca ativa de candidatos por filtros e texto livre, exibindo apenas dados não sensíveis via View Model.
- [ ] Garantir que dados pessoais do candidato nunca trafeguem por consulta direta ao Prisma para outro papel, somente via View Model de privacidade.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Kanban / gerenciamento de status de candidatura (vista, entrevistada, contratada) | Empresa usa seu próprio processo fora do sistema; fica para V2 (USP-027 Notas). |
| Notificação à Empresa sobre nova candidatura | Candidatura é silenciosa no MVP; apenas o candidato recebe e-mail de confirmação. |
| Mensageria / chat entre Empresa e candidato | Fora do escopo do MVP; contato ocorre fora do sistema. |
| Ranqueamento ou matching automático de candidatos | Busca ativa é por filtros e texto livre, sem score. |

## User Stories

### P1: Candidatar-se a uma vaga ⭐ MVP

**User Story**: Como Pessoa com papel candidato ativo, quero candidatar-me a uma vaga ativa para que a Empresa veja meu interesse e considere meu perfil.

**Why P1**: É o fluxo central de empregabilidade do portal; sem candidatura não há conexão entre candidato e Empresa.

**Acceptance Criteria**:
1. QUANDO o candidato clica em "candidatar-se" em uma vaga ativa ENTÃO o sistema DEVE persistir a candidatura, enviar e-mail de confirmação ao candidato e tornar o contato do candidato visível para a Empresa.
2. QUANDO o candidato já tem candidatura ativa (não cancelada) à mesma vaga ENTÃO o sistema DEVE bloquear nova candidatura.
3. QUANDO o perfil do candidato não está com status "ativo" (não foi moderado) ENTÃO o sistema DEVE bloquear a candidatura.
4. QUANDO o candidato se candidata ENTÃO o sistema DEVE registrar/verificar o consentimento `JOB_APPLICATION` antes de tornar o contato visível à Empresa.

**Independent Test**: Com um candidato de perfil ativo e consentimento `JOB_APPLICATION`, candidatar-se a uma vaga ativa e verificar que a `Application` foi persistida (`jobId`, `candidatePersonId`, `appliedAt`), o e-mail de confirmação foi disparado e nova candidatura à mesma vaga é bloqueada.

### P1: Cancelar candidatura ⭐ MVP

**User Story**: Como candidato, quero cancelar uma candidatura que eu fiz para que eu me desfaça de uma candidatura que não faz mais sentido.

**Why P1**: Dá controle ao candidato sobre suas próprias candidaturas e libera a recandidatura.

**Acceptance Criteria**:
1. QUANDO o candidato cancela uma candidatura ativa ENTÃO o sistema DEVE marcá-la como "cancelada" (preencher `cancelledAt`) e ocultá-la da lista da Empresa.
2. QUANDO a candidatura é cancelada ENTÃO o sistema DEVE permitir nova candidatura à mesma vaga posteriormente.

**Independent Test**: Cancelar uma candidatura ativa e verificar que ela some da lista da Empresa, que `cancelledAt` foi preenchido e que uma nova candidatura à mesma vaga passa a ser aceita.

### P1: Empresa ver lista de candidatos da vaga ⭐ MVP

**User Story**: Como Pessoa-responsável da Empresa, quero ver a lista de candidatos que se candidataram a uma vaga minha, com seus dados de contato e CVs, para que eu avalie e entre em contato com os candidatos.

**Why P1**: Sem visualizar os candidatos, a Empresa não consegue avaliar nem dar prosseguimento ao processo seletivo.

**Acceptance Criteria**:
1. QUANDO o responsável abre uma vaga dele ENTÃO o sistema DEVE listar todas as candidaturas ativas (não canceladas) com nome do candidato, contato (e-mail e telefone) e link para CV.
2. QUANDO a candidatura veio de encaminhamento ASONSEG ENTÃO o sistema DEVE exibir badge visível "Candidato encaminhado pela ASONSEG".
3. QUANDO a lista é exibida ENTÃO o sistema DEVE exibir data e hora da candidatura.
4. QUANDO o responsável visualiza dados de contato/CV do candidato ENTÃO o sistema DEVE servir os dados via View Model `viewCandidateForEmployer` e registrar o evento `SENSITIVE_FIELD_VIEWED`, nunca consultando o Prisma diretamente.

**Independent Test**: Como responsável de uma Empresa, abrir uma vaga com candidaturas ativas e canceladas e verificar que apenas as ativas aparecem, que contato/CV vêm do View Model, que a data/hora da candidatura é exibida, que o badge de encaminhamento aparece quando aplicável e que um evento `SENSITIVE_FIELD_VIEWED` foi registrado.

### P1: Empresa buscar candidatos (busca ativa) ⭐ MVP

**User Story**: Como Pessoa-responsável da Empresa, quero buscar candidatos com filtros (área de interesse, escolaridade, disponibilidade, localização) e texto livre para que eu encontre profissionais para minhas vagas.

**Why P1**: Permite à Empresa encontrar talentos proativamente, sem depender de candidaturas recebidas.

**Acceptance Criteria**:
1. QUANDO o responsável acessa a busca de candidatos ENTÃO o sistema DEVE listar candidatos com status "ativo" ordenados por data de cadastro.
2. QUANDO o responsável aplica filtros ENTÃO o sistema DEVE atualizar a lista respeitando todos os filtros.
3. QUANDO a lista é exibida ENTÃO o sistema DEVE exibir, para cada candidato: primeiro nome, cidade/região, área de interesse principal, escolaridade e qualificações resumidas.
4. QUANDO o candidato ainda não se candidatou a uma vaga da Empresa ENTÃO o sistema DEVE ocultar dados sensíveis (CPF, contato completo, endereço, CV).
5. QUANDO a busca retorna candidatos ENTÃO o sistema DEVE servir os dados via View Model de privacidade, nunca consultando o Prisma diretamente para expor dados de outra Pessoa.

**Independent Test**: Como responsável de uma Empresa, executar a busca sem filtros e verificar a listagem de candidatos ativos ordenados por data de cadastro; aplicar filtros combinados e verificar que a lista respeita todos; confirmar que apenas os campos não sensíveis (primeiro nome, cidade/região, área, escolaridade, qualificações) são exibidos e que CPF/contato/endereço/CV permanecem ocultos para candidatos que não se candidataram.

## Edge Cases

- QUANDO o candidato tenta candidatar-se a uma vaga que não está mais ativa (encerrada/moderada/removida) ENTÃO o sistema DEVE bloquear a candidatura.
- QUANDO o candidato não possui consentimento `JOB_APPLICATION` ativo ENTÃO o sistema DEVE impedir a candidatura.
- QUANDO ocorrem duas tentativas concorrentes de candidatura do mesmo candidato à mesma vaga ENTÃO o sistema DEVE garantir unicidade da candidatura ativa (constraint `unique` em `Application`).
- QUANDO o candidato cancela uma candidatura já cancelada ou inexistente ENTÃO o sistema DEVE retornar erro sem alterar estado.
- QUANDO um responsável de outra Empresa tenta ver a lista de candidatos de uma vaga que não pertence à sua Empresa ENTÃO o sistema DEVE negar o acesso (permissão).
- QUANDO a busca ativa não retorna nenhum candidato para os filtros aplicados ENTÃO o sistema DEVE exibir lista vazia com mensagem adequada.
- QUANDO a Empresa visualiza um candidato na busca ativa que ainda não se candidatou a vaga dela ENTÃO o sistema DEVE manter ocultos CPF, contato completo, endereço e CV mesmo que o responsável tente acessá-los diretamente.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CAN-01 | USP-025 | Design | Pending |
| CAN-02 | USP-026 | Design | Pending |
| CAN-03 | USP-027 | Design | Pending |
| CAN-04 | USP-028 | Design | Pending |

## Success Criteria

- [ ] Um candidato ativo com consentimento `JOB_APPLICATION` consegue candidatar-se a uma vaga ativa, recebe e-mail de confirmação e a unicidade de candidatura ativa é respeitada.
- [ ] Candidato consegue cancelar candidatura e recandidatar-se à mesma vaga depois.
- [ ] Empresa vê apenas candidaturas ativas em suas vagas, com contato, CV, data/hora e badge de encaminhamento quando aplicável, sempre via `viewCandidateForEmployer`.
- [ ] Todo acesso a dados sensíveis de candidato gera registro `SENSITIVE_FIELD_VIEWED`.
- [ ] Busca ativa lista candidatos ativos por data de cadastro, respeita todos os filtros e mantém ocultos CPF, contato completo, endereço e CV de candidatos que não se candidataram à Empresa.
- [ ] Nenhum dado pessoal de candidato é exposto a outro papel por consulta direta ao Prisma — sempre via View Model.
