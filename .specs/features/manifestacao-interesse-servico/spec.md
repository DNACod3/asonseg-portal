# Manifestação de Interesse em Serviço Specification

## Problem Statement

Pessoas que buscam serviços no portal precisam de uma forma simples de sinalizar a um prestador que desejam contratá-lo, sem etapas burocráticas. Hoje não existe vínculo registrado entre quem procura e quem oferece um serviço, o que impede a retomada de contato pelo prestador e a revelação controlada de dados de contato. Além disso, a captura desse contato envolve dados pessoais e exige base legal (consentimento `SERVICE_HIRING`). É necessário um fluxo silencioso de manifestação de interesse que persista o vínculo, revele imediatamente o contato do prestador ao cliente, notifique o prestador por e-mail, permita cancelamento e exiba ao prestador quem o procurou, sempre respeitando privacidade via View Models.

## Goals

- [ ] Permitir que uma Pessoa autenticada manifeste interesse em um serviço ativo de forma silenciosa, ativando o papel "cliente de serviço" automaticamente quando necessário.
- [ ] Revelar imediatamente o contato do prestador ao cliente no momento da manifestação.
- [ ] Enviar e-mail informativo ao prestador avisando do interesse manifestado.
- [ ] Exigir e validar consentimento `SERVICE_HIRING` antes de persistir a manifestação.
- [ ] Permitir múltiplas manifestações simultâneas em serviços diferentes.
- [ ] Permitir que o cliente cancele uma manifestação de interesse.
- [ ] Permitir que o prestador visualize, via View Model, as manifestações ativas em seus serviços.

## Out of Scope

| Feature | Reason |
| Chat ou mensageria interna entre cliente e prestador | MVP usa revelação de contato direto; comunicação ocorre fora do portal |
| Avaliação ou reputação do prestador após contato | Não previsto nas USP-033..035 |
| Confirmação de contratação ou status de conclusão do serviço | Manifestação é apenas sinalização de interesse, não contrato |
| Notificação ao cliente sobre resposta do prestador | Apenas o prestador é notificado por e-mail (AC-033-1) |
| i18n das mensagens | Sem i18n no MVP |

## User Stories

### P1: Manifestar interesse em serviço ⭐ MVP

**User Story**: Como Pessoa autenticada (papel cliente ativado automaticamente se for a primeira vez), quero manifestar interesse em um serviço e ver o contato do prestador para que eu possa contratar o serviço.

**Why P1**: É a funcionalidade central do épico (Must Have); sem ela não há vínculo entre cliente e prestador nem revelação de contato, inviabilizando a contratação de serviços no portal.

**Acceptance Criteria**:
1. QUANDO o cliente clica em "entrar em contato" em um serviço ativo ENTÃO o sistema DEVE persistir a manifestação, exibir o contato do prestador e enviar e-mail ao prestador avisando do interesse. (AC-033-1)
2. QUANDO o cliente ainda não tem o papel "cliente de serviço" ativo ENTÃO o sistema DEVE ativar o papel automaticamente sem formulário adicional. (AC-033-2)
3. QUANDO o cliente manifesta interesse em serviços diferentes ENTÃO o sistema DEVE permitir múltiplas manifestações simultâneas. (AC-033-3)
4. QUANDO o consentimento `SERVICE_HIRING` não está ativo para o cliente ENTÃO o sistema DEVE exigir e registrar o consentimento antes de persistir a manifestação.

**Independent Test**: Autenticar como Pessoa sem papel de cliente, abrir um serviço ativo, conceder o consentimento `SERVICE_HIRING`, clicar em "entrar em contato" e verificar que: a manifestação foi persistida, o contato do prestador é exibido na tela, o papel "cliente de serviço" foi ativado e o e-mail informativo foi disparado ao prestador.

### P1: Prestador ver manifestações de interesse ⭐ MVP

**User Story**: Como prestador de serviço, quero ver a lista de pessoas que manifestaram interesse no(s) meu(s) serviço(s) para que eu saiba quem me procurou e possa retomar o contato.

**Why P1**: É Must Have; sem essa visão o prestador não consegue identificar nem retomar contato com os interessados, esvaziando o valor da manifestação.

**Acceptance Criteria**:
1. QUANDO o prestador abre seu painel ENTÃO o sistema DEVE listar as manifestações ativas com nome do cliente, contato, data e serviço referenciado. (AC-035-1)
2. QUANDO o prestador visualiza os dados do cliente ENTÃO o sistema DEVE retornar os campos por meio de View Model (controle de visibilidade por papel do observador), nunca por consulta direta ao Prisma.

**Independent Test**: Autenticar como prestador com serviços que receberam manifestações ativas, abrir o painel e verificar que cada item lista nome do cliente, contato, data e serviço referenciado, e que manifestações canceladas não aparecem.

### P2: Cancelar manifestação de interesse

**User Story**: Como cliente de serviço, quero cancelar uma manifestação que fiz para que minha lista de interesses reflita a realidade.

**Why P2**: Classificada como Should Have na PRD; melhora a higiene da lista de interesses mas não é bloqueante para o fluxo principal de manifestação e contato.

**Acceptance Criteria**:
1. QUANDO o cliente cancela uma manifestação ENTÃO o sistema DEVE marcar a manifestação como "cancelada". (AC-034-1)
2. QUANDO uma manifestação é marcada como cancelada ENTÃO o sistema DEVE deixar de exibi-la na lista de manifestações ativas do prestador.

**Independent Test**: Como cliente com uma manifestação ativa, executar o cancelamento e verificar que a manifestação fica marcada como cancelada (`cancelledAt` preenchido) e não aparece mais na lista de manifestações ativas do prestador.

## Edge Cases

- QUANDO o cliente tenta manifestar interesse em um serviço que não está ativo ENTÃO o sistema DEVE recusar a operação.
- QUANDO o cliente já possui manifestação ativa para o mesmo serviço ENTÃO o sistema DEVE evitar duplicidade respeitando a restrição de unicidade (`serviceId`, `clientPersonId`, `interestedAt`).
- QUANDO o cliente recusa o consentimento `SERVICE_HIRING` ENTÃO o sistema DEVE não persistir a manifestação nem revelar o contato do prestador.
- QUANDO o cliente tenta cancelar uma manifestação que não é dele ENTÃO o sistema DEVE negar a operação por falta de permissão.
- QUANDO o cliente tenta cancelar uma manifestação já cancelada ENTÃO o sistema DEVE tratar a operação de forma idempotente, sem alterar o estado.
- QUANDO o envio do e-mail ao prestador falha ENTÃO o sistema DEVE manter a manifestação persistida e a revelação de contato ao cliente, sem reverter a operação.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| MIS-01 | USP-033 | Design | Pending |
| MIS-02 | USP-034 | Design | Pending |
| MIS-03 | USP-035 | Design | Pending |

## Success Criteria

- [ ] Cliente consegue manifestar interesse em serviço ativo e visualizar imediatamente o contato do prestador.
- [ ] Papel "cliente de serviço" é ativado automaticamente na primeira manifestação, sem formulário adicional.
- [ ] E-mail informativo é enviado ao prestador a cada manifestação.
- [ ] Consentimento `SERVICE_HIRING` é exigido e registrado antes de persistir a manifestação.
- [ ] Múltiplas manifestações simultâneas em serviços diferentes são suportadas.
- [ ] Cliente consegue cancelar uma manifestação, marcando-a como cancelada.
- [ ] Prestador visualiza, via View Model, as manifestações ativas com nome do cliente, contato, data e serviço referenciado.
