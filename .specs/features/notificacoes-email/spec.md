# Notificações por E-mail Specification

## Problem Statement

O Portal ASONSEG executa diversas operações sensíveis e relevantes para seus usuários (cadastro, recuperação de senha, decisões de moderação, candidaturas, manifestações de interesse, encaminhamentos, expiração de vagas e lembretes de atualização de CV), mas hoje não há mecanismo automático para informar os usuários quando esses eventos ocorrem. Sem notificações, as Pessoas, Empresas-responsáveis e prestadores precisam acessar o portal proativamente para descobrir mudanças que lhes dizem respeito, o que reduz engajamento, atrasa respostas a decisões de moderação e faz com que vagas expirem sem aviso prévio à Empresa.

O Épico 13 (USP-044) define o envio automático de e-mails nos eventos críticos do portal. O canal de e-mail é provido pela Resend, consumido exclusivamente por trás de uma abstração port-adapter, e o envio é tratado como integração **não-crítica**: uma falha de envio é registrada em log estruturado, mas nunca bloqueia ou reverte a operação de negócio que originou a notificação.

## Goals

- [ ] Disparar e-mail automático nos eventos críticos do portal definidos em USP-044.
- [ ] Encapsular o provedor de e-mail (Resend) atrás de um port-adapter, de modo que o código consumidor dependa apenas da interface de envio.
- [ ] Garantir que a falha de envio de e-mail seja não-crítica: logada de forma estruturada, sem bloquear nem reverter a operação de negócio.
- [ ] Produzir todo o conteúdo dos e-mails em PT-BR, alinhado à terminologia do portal.
- [ ] Permitir parametrização do prazo (N dias) do lembrete de CV sem atualização (default 180, ajustável pela diretoria).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Notificações por WhatsApp | Apenas e-mail no MVP; previsto para V2. |
| Push notification (web/app) | Apenas e-mail no MVP; previsto para V2. |
| Convite por e-mail para adicionar responsável de Empresa | Pessoa deve estar pré-cadastrada no MVP; convite vira V2. |
| Centro de notificações in-app / preferências granulares de opt-out por usuário | Não previsto no MVP. |
| Internacionalização (i18n) do conteúdo dos e-mails | Sem i18n no MVP; conteúdo somente em PT-BR. |

## User Stories

### P1: Notificações por e-mail em eventos do portal ⭐ MVP

**User Story**: Como sistema do Portal ASONSEG, quero disparar e-mails automaticamente em eventos relevantes do portal, por trás de um port-adapter sobre a Resend e de forma não-crítica, para que os usuários sejam mantidos informados sem que falhas de envio bloqueiem as operações de negócio.

**Why P1**: USP-044 é Must Have no MVP. As notificações são pré-requisito de vários fluxos críticos já priorizados (cadastro, recuperação de senha, moderação, candidatura, manifestação de interesse, encaminhamento, expiração de vaga). Sem elas os usuários não tomam conhecimento de decisões e prazos que lhes afetam diretamente.

**Acceptance Criteria**:

1. QUANDO um cadastro de Pessoa é concluído com sucesso ENTÃO o sistema DEVE enviar e-mail de boas-vindas à Pessoa. (NOT-01)
2. QUANDO uma Pessoa solicita recuperação de senha com e-mail cadastrado ENTÃO o sistema DEVE enviar e-mail contendo o link de redefinição. (NOT-02)
3. QUANDO um rascunho de conteúdo é aprovado ENTÃO o sistema DEVE enviar e-mail ao autor informando a decisão de aprovação. (NOT-03)
4. QUANDO um rascunho de conteúdo é devolvido para ajustes ENTÃO o sistema DEVE enviar e-mail ao autor com a decisão e o motivo textual obrigatório. (NOT-04)
5. QUANDO um rascunho de conteúdo é rejeitado definitivamente ENTÃO o sistema DEVE enviar e-mail ao autor com a decisão e o motivo textual obrigatório. (NOT-05)
6. QUANDO uma candidatura é registrada ENTÃO o sistema DEVE enviar e-mail de confirmação ao candidato. (NOT-06)
7. QUANDO uma manifestação de interesse em serviço é registrada ENTÃO o sistema DEVE enviar e-mail informativo ao prestador. (NOT-07)
8. QUANDO um encaminhamento institucional é criado ENTÃO o sistema DEVE enviar e-mail informativo à Pessoa encaminhada. (NOT-08)
9. QUANDO uma vaga está a 3 dias da data de validade (timezone América/São_Paulo) ENTÃO o sistema DEVE enviar e-mail de aviso de expiração à Empresa-responsável. (NOT-09)
10. QUANDO o CV de um candidato completa N dias sem atualização (default 180, parametrizável pela diretoria) ENTÃO o sistema DEVE enviar e-mail de lembrete ao candidato, sem qualquer impacto funcional caso ele ignore. (NOT-10)
11. QUANDO qualquer e-mail é enviado ENTÃO o sistema DEVE fazê-lo através do port de envio (interface), sem que o código consumidor dependa diretamente do SDK/cliente da Resend. (NOT-11)
12. QUANDO o envio de e-mail falha ENTÃO o sistema DEVE registrar o erro em log estruturado e permitir que a operação de negócio de origem seja concluída normalmente, sem bloquear nem reverter. (NOT-12)
13. QUANDO qualquer e-mail é gerado ENTÃO o sistema DEVE produzir assunto e corpo em PT-BR, com terminologia alinhada ao portal e, quando aplicável, incluir o motivo da decisão de moderação. (NOT-13)

**Independent Test**: Acionar cada evento de origem (cadastro, recuperação de senha, transições de moderação, candidatura, manifestação de interesse, encaminhamento, vaga a 3 dias da expiração, CV vencido) em ambiente controlado com um port de e-mail fake/registrável; verificar que cada disparo invoca o port com destinatário, assunto e corpo em PT-BR corretos. Em seguida, simular falha do adapter (exceção/erro do provedor) e verificar que a operação de negócio conclui com sucesso e que a falha aparece no log estruturado.

## Edge Cases

- QUANDO o provedor Resend retorna erro ou está indisponível ENTÃO o sistema DEVE logar a falha e concluir a operação de negócio normalmente (envio não-crítico).
- QUANDO a recuperação de senha é solicitada para um e-mail não cadastrado ENTÃO o sistema NÃO DEVE enviar e-mail, mantendo a mensagem genérica de confirmação na UI (sem revelar inexistência da conta).
- QUANDO a Pessoa-alvo de um evento (ex.: encaminhamento, boas-vindas via reivindicação) não possui credencial/e-mail cadastrado ENTÃO o sistema DEVE pular o envio sem erro de negócio e registrar a ausência de destinatário em log.
- QUANDO um rascunho é devolvido ou rejeitado sem motivo textual ENTÃO o motivo é obrigatório na transição de origem; o e-mail DEVE refletir o motivo quando aplicável.
- QUANDO a diretoria altera o parâmetro N de dias do lembrete de CV ENTÃO o sistema DEVE passar a usar o novo valor nos próximos disparos.
- QUANDO uma vaga já expirou ou foi pausada/arquivada antes da janela de 3 dias ENTÃO o sistema NÃO DEVE enviar o aviso de expiração.
- QUANDO o mesmo evento poderia disparar duplicidade de e-mail (ex.: reprocessamento do job de expiração) ENTÃO o sistema DEVE evitar envios duplicados para o mesmo evento/vaga.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| NOT-01 | USP-044 | Design | Pending |
| NOT-02 | USP-044 | Design | Pending |
| NOT-03 | USP-044 | Design | Pending |
| NOT-04 | USP-044 | Design | Pending |
| NOT-05 | USP-044 | Design | Pending |
| NOT-06 | USP-044 | Design | Pending |
| NOT-07 | USP-044 | Design | Pending |
| NOT-08 | USP-044 | Design | Pending |
| NOT-09 | USP-044 | Design | Pending |
| NOT-10 | USP-044 | Design | Pending |
| NOT-11 | USP-044 | Design | Pending |
| NOT-12 | USP-044 | Design | Pending |
| NOT-13 | USP-044 | Design | Pending |

## Success Criteria

- [ ] Todos os 8 eventos de USP-044 disparam e-mail nas condições especificadas (boas-vindas, recuperação de senha, decisão de moderação, candidatura, manifestação de interesse, encaminhamento, aviso de expiração de vaga, lembrete de CV).
- [ ] O envio de e-mail ocorre exclusivamente via port-adapter; nenhum módulo consumidor importa o SDK da Resend diretamente.
- [ ] Falhas de envio são logadas em formato estruturado e nunca bloqueiam ou revertem a operação de negócio de origem.
- [ ] Assuntos e corpos de e-mail são integralmente em PT-BR e, nos casos de moderação, incluem o motivo quando aplicável.
- [ ] O prazo N do lembrete de CV é parametrizável (default 180 dias) e respeitado nos disparos.
