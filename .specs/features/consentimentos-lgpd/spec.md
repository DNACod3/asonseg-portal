# Conformidade LGPD (Consentimentos) Specification

## Problem Statement

O Portal ASONSEG trata dados pessoais de múltiplos titulares (candidatos, prestadores, clientes de serviço, empresas-responsáveis e beneficiários sociais cadastrados pela assistente social), cada um com finalidades distintas de tratamento. A LGPD (Lei 13.709/2018) exige base legal documentada por finalidade, com consentimento explícito, versionado, comprovável e revogável de forma granular. Hoje não existe mecanismo que registre, exiba, verifique e revogue consentimentos por finalidade, nem que comprove qual versão do termo o titular aceitou, quando e a partir de qual contexto técnico (IP/userAgent). Sem isso, a ASONSEG não pode operar em conformidade legal nem atender direitos do titular (acesso e revogação).

A fundação de consentimentos é transversal e bloqueante: ativação de papéis, candidatura, oferta/contratação de serviço, representação de empresa, ficha socioeconômica, extração de CV via IA e encaminhamento social dependem da verificação de consentimento ativo da finalidade correspondente.

## Goals

- [ ] Registrar consentimento por finalidade com prova jurídica completa: titular, finalidade, versão do termo, hash do conteúdo do termo, data/hora, IP e userAgent.
- [ ] Suportar as 8 finalidades de consentimento (ConsentPurpose) previstas no MVP.
- [ ] Exibir o termo versionado da finalidade e exigir aceite explícito antes de prosseguir com a ação vinculada.
- [ ] Disponibilizar `requireActiveConsent(personId, purpose)` como guarda obrigatório nas operações vinculadas a finalidade.
- [ ] Permitir revogação granular por finalidade, cascateando a desativação do role grant vinculado para `REVOKED` sem afetar outras finalidades nem excluir dados de perfil.
- [ ] Oferecer painel do titular com consentimentos vigentes, histórico e ação de revogação.
- [ ] Atender o direito de acesso (art. 19) sob demanda em até 15 dias.
- [ ] Versionar todos os termos de consentimento em Git, com hash verificável.

## Out of Scope

| Feature | Reason |
|---|---|
| Anonimização/eliminação automática de dados na revogação | ADR-0008: retenção indefinida para histórico institucional; revogação preserva dados de perfil. |
| Portabilidade de dados (exportação automatizada self-service) | Não previsto no MVP; direito de acesso atendido sob demanda pela AS/diretoria. |
| Internacionalização dos termos (i18n) | MVP é PT-BR único. |
| Editor de termos via UI / CMS | Termos são versionados em Git e revisados pelo jurídico (D-002), fora do app. |
| RLS no banco para isolamento de consentimentos | Autorização na camada de aplicação (decisão de stack). |
| Consentimento de cookies/rastreamento de marketing | Fora do escopo funcional do MVP. |

## User Stories

### P1: Registro de consentimento por finalidade ⭐ MVP
**User Story**: Como Pessoa autenticada, quero consentir explicitamente com cada finalidade de tratamento dos meus dados ao ativar um papel ou ação, para que meus dados sejam tratados somente nas finalidades que autorizei.
**Why P1**: Base legal LGPD obrigatória; sem registro de consentimento nenhuma operação vinculada a finalidade pode ocorrer legalmente (AC-043-1, AC-043-2).
**Acceptance Criteria**:
1. QUANDO a Pessoa ativa um papel ou inicia uma ação vinculada a uma das 8 finalidades ENTÃO o sistema DEVE exigir aceite explícito (ação afirmativa, sem pré-marcação) antes de prosseguir.
2. QUANDO a Pessoa aceita o termo ENTÃO o sistema DEVE persistir o consentimento com: titular (personId), finalidade (purpose), versão do termo (termVersion), hash do conteúdo do termo (termContentHash), data/hora (acceptedAt em timestamptz UTC), IP (acceptedIp) e userAgent.
3. QUANDO o consentimento é persistido ENTÃO o sistema DEVE executar a escrita dentro de `withAudit('CONSENT_GRANTED', ...)` registrando o evento no log imutável.
4. QUANDO a Pessoa já possui consentimento ativo para a finalidade na versão vigente do termo ENTÃO o sistema DEVE não exigir novo aceite e prosseguir.
5. QUANDO existe consentimento ativo de uma finalidade em versão anterior à vigente ENTÃO o sistema DEVE exigir novo aceite da versão vigente antes de prosseguir.
**Independent Test**: Ativar um papel disparando o aceite; verificar registro de Consent com todos os campos de prova preenchidos e evento de auditoria correspondente.

### P1: Leitura e exibição do termo versionado ⭐ MVP
**User Story**: Como Pessoa autenticada, quero ler o texto íntegro do termo da finalidade antes de aceitar, para que meu consentimento seja informado e inequívoco.
**Why P1**: Consentimento informado é requisito legal; o termo aceito deve ser exatamente o conteúdo cujo hash é registrado (AC-043-1).
**Acceptance Criteria**:
1. QUANDO a Pessoa visualiza um pedido de consentimento ENTÃO o sistema DEVE exibir o conteúdo íntegro do termo da finalidade, sua versão e a data de vigência.
2. QUANDO o termo é carregado a partir de `legal/consent-terms/` (versionado em Git) ENTÃO o sistema DEVE calcular/validar o hash do conteúdo e usar esse hash no registro do consentimento.
3. QUANDO a finalidade for CV_AI_EXTRACTION ENTÃO o termo exibido DEVE descrever explicitamente o envio do CV a provedor LLM externo.
4. QUANDO o conteúdo do termo carregado divergir do hash esperado da versão vigente ENTÃO o sistema DEVE bloquear o aceite e registrar erro, impedindo consentimento sobre termo não íntegro.
**Independent Test**: Renderizar a tela de consentimento de uma finalidade e confirmar que o texto exibido corresponde ao arquivo em `legal/consent-terms/` e que o hash bate com o termContentHash registrado ao aceitar.

### P1: Verificação requireActiveConsent ⭐ MVP
**User Story**: Como sistema, quero verificar consentimento ativo antes de operações vinculadas a finalidade, para que nenhum dado seja tratado sem base legal vigente.
**Why P1**: Guarda transversal que protege todas as operações sensíveis; sem ela o registro de consentimento não é aplicado de fato.
**Acceptance Criteria**:
1. QUANDO uma Server Action vinculada a finalidade é executada ENTÃO o sistema DEVE chamar `requireActiveConsent(personId, purpose)` na etapa de verificação (após permissão, antes das pré-condições de negócio).
2. QUANDO não existe consentimento ativo para a finalidade exigida ENTÃO o sistema DEVE retornar `{ ok: false, error }` sem lançar exceção e sem executar a operação.
3. QUANDO existe consentimento mas em versão de termo desatualizada ENTÃO o sistema DEVE tratá-lo como não ativo e exigir reaceite.
4. QUANDO o consentimento está revogado (revokedAt preenchido) ENTÃO o sistema DEVE negar a operação vinculada à finalidade.
**Independent Test**: Invocar uma Server Action protegida sem consentimento ativo e confirmar retorno `{ ok: false }` sem efeito colateral; repetir com consentimento ativo e confirmar prosseguimento.

### P1: Revogação granular com cascata para role grant ⭐ MVP
**User Story**: Como Pessoa autenticada, quero revogar o consentimento de uma finalidade específica, para que aquela finalidade deixe de ser tratada sem afetar minhas outras finalidades nem apagar meu perfil.
**Why P1**: Direito de revogação é obrigatório na LGPD e a cascata controlada garante consistência do papel vinculado (AC-043-4, art. 884).
**Acceptance Criteria**:
1. QUANDO a Pessoa solicita revogação de uma finalidade ENTÃO o sistema DEVE preencher revokedAt no consentimento e marcar o role grant vinculado como `REVOKED`.
2. QUANDO a revogação ocorre ENTÃO o sistema DEVE preservar os dados de perfil do titular (sem exclusão), conforme retenção institucional.
3. QUANDO uma finalidade é revogada ENTÃO o sistema DEVE não afetar consentimentos de outras finalidades da mesma Pessoa.
4. QUANDO a revogação é processada ENTÃO o sistema DEVE executar tudo em transação dentro de `withAudit('CONSENT_REVOKED', ...)`.
5. QUANDO o role grant é revogado ENTÃO o sistema DEVE impedir novas operações daquela finalidade até eventual novo consentimento.
**Independent Test**: Revogar uma das 8 finalidades de uma Pessoa com múltiplos papéis e verificar role grant em `REVOKED`, dados de perfil intactos, demais consentimentos ativos e evento de auditoria gravado.

### P1: Painel de consentimentos do titular ⭐ MVP
**User Story**: Como Pessoa autenticada, quero ver e gerenciar meus consentimentos vigentes em um painel, para que eu tenha controle sobre as finalidades às quais autorizei o tratamento.
**Why P1**: Transparência ao titular e ponto único de revogação exigidos pela LGPD (AC-043-3).
**Acceptance Criteria**:
1. QUANDO a Pessoa acessa o painel de consentimentos ENTÃO o sistema DEVE listar seus consentimentos vigentes com finalidade, versão do termo aceita e data de aceite.
2. QUANDO a Pessoa visualiza um consentimento ENTÃO o sistema DEVE permitir abrir o termo aceito e oferecer ação de revogação por finalidade.
3. QUANDO a Pessoa possui consentimento já revogado ENTÃO o sistema DEVE exibir o histórico com data de revogação, distinguindo vigentes de revogados.
4. QUANDO a Pessoa consulta o painel ENTÃO o sistema DEVE retornar apenas os próprios consentimentos do titular autenticado.
**Independent Test**: Abrir o painel de uma Pessoa com consentimentos ativos e revogados e verificar listagem correta, abertura do termo e disponibilidade da revogação por finalidade.

### P1: Direito de acesso atendido em até 15 dias ⭐ MVP
**User Story**: Como diretoria/assistente social da ASONSEG, quero gerar o relatório de dados e consentimentos de um titular sob demanda, para que possamos atender a solicitação de acesso (art. 19) no prazo legal de até 15 dias.
**Why P1**: Direito de acesso é obrigação legal com prazo definido (seção 6.7, art. 883).
**Acceptance Criteria**:
1. QUANDO um perfil interno autorizado solicita o relatório de acesso de um titular ENTÃO o sistema DEVE consolidar os dados pessoais e o histórico de consentimentos (finalidade, versão, datas de aceite/revogação) daquela Pessoa.
2. QUANDO o relatório de acesso é gerado ENTÃO o sistema DEVE registrar a emissão em `withAudit` para rastreabilidade do atendimento ao direito.
3. QUANDO a solicitação é aberta ENTÃO o sistema DEVE permitir a entrega dentro de até 15 dias, sem depender de processamento manual disperso.
4. QUANDO o solicitante não possui permissão ENTÃO o sistema DEVE negar a geração via `requirePermission()` retornando `{ ok: false, error }`.
**Independent Test**: Solicitar relatório de acesso de um titular com perfil autorizado e confirmar consolidação de dados + consentimentos e evento de auditoria; repetir sem permissão e confirmar negação.

> **Finalidades de consentimento (ConsentPurpose) no MVP:** `PORTAL_ACCESS`, `JOB_APPLICATION`, `SERVICE_OFFERING`, `SERVICE_HIRING`, `COMPANY_REPRESENTATION`, `SOCIAL_ASSISTANCE`, `CV_AI_EXTRACTION`, `SOCIAL_REFERRAL_TO_JOB`.

## Edge Cases

- QUANDO o termo de uma finalidade é atualizado para nova versão em Git ENTÃO o sistema DEVE manter os consentimentos antigos como prova histórica e exigir reaceite da versão vigente nas próximas operações.
- QUANDO a Pessoa tenta revogar uma finalidade já revogada ENTÃO o sistema DEVE ser idempotente e não criar duplicidade nem novo efeito de cascata.
- QUANDO IP ou userAgent não estão disponíveis na requisição ENTÃO o sistema DEVE registrar o consentimento com valor sentinela auditável, sem bloquear o aceite legítimo.
- QUANDO duas solicitações de aceite da mesma finalidade ocorrem em concorrência ENTÃO o sistema DEVE evitar registros duplicados de consentimento ativo para a mesma finalidade/versão.
- QUANDO a Pessoa revoga `PORTAL_ACCESS` ENTÃO o sistema DEVE tratar como revogação da base de acesso ao portal, cascateando os efeitos previstos sem excluir o histórico institucional.
- QUANDO uma operação vinculada a finalidade é executada por perfil interno em nome do titular (ex.: ficha social pela AS) ENTÃO o sistema DEVE garantir que o consentimento de `SOCIAL_ASSISTANCE` do titular esteja registrado.
- QUANDO o arquivo do termo referenciado por uma versão não existir em `legal/consent-terms/` ENTÃO o sistema DEVE bloquear o aceite e registrar erro de configuração.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| LGP-01 | USP-043 | Design | Pending |
| LGP-02 | USP-043 | Design | Pending |
| LGP-03 | USP-043 | Design | Pending |
| LGP-04 | USP-043 | Design | Pending |
| LGP-05 | USP-043 | Design | Pending |
| LGP-06 | USP-043 | Design | Pending |

> LGP-01 Registro de consentimento por finalidade · LGP-02 Leitura/exibição do termo versionado · LGP-03 Verificação requireActiveConsent · LGP-04 Revogação granular + cascata role grant → REVOKED · LGP-05 Painel de consentimentos do titular · LGP-06 Direito de acesso em até 15 dias.

## Success Criteria

- [ ] Todo consentimento registrado contém titular, finalidade, termVersion, termContentHash, acceptedAt, acceptedIp e userAgent.
- [ ] As 8 finalidades de ConsentPurpose estão suportadas e cobertas por termo versionado em Git com hash verificável.
- [ ] Nenhuma operação vinculada a finalidade é executada sem `requireActiveConsent` retornando consentimento ativo na versão vigente.
- [ ] Revogação granular marca o role grant como `REVOKED`, preserva dados de perfil e não afeta outras finalidades.
- [ ] Eventos `CONSENT_GRANTED` e `CONSENT_REVOKED` são registrados no log imutável de auditoria.
- [ ] Painel do titular exibe consentimentos vigentes e revogados e permite revogação por finalidade.
- [ ] Solicitações de direito de acesso podem ser atendidas em até 15 dias com consolidação de dados + consentimentos.
- [ ] **Dependência bloqueante (D-001):** DPO (Encarregado pelo Tratamento de Dados) designado a um diretor da ASONSEG antes do go-live.
- [ ] **Dependência bloqueante (D-002):** termos de consentimento por finalidade revisados pelo jurídico antes do go-live.
