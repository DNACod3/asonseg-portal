# Matriz de Conexões — MVP Portal Empregabilidade e Serviços (ASONSEG)

**Origem:** PRD `prd-asonseg-portal-mvp` v0.3 (22/05/2026)
**Status:** Enriquecida pela skill `architecture-planning-idsd` (2026-05-28; pendências de negócio resolvidas em 2026-05-29). Colunas de negócio preservadas do esqueleto da `po-bravi-idsd`; colunas técnicas (Schemas, Endpoints, Eventos, Runbooks, ADRs técnicos, Fase) preenchidas apontando para o `technical-design.md` (TD). A matriz é o **índice por-USP que aponta para dentro do TD** — não duplica o TD.
**Escopo:** apenas USPs do Release 1 (USP-001 a USP-044). ADRs 0002, 0003, 0004, 0005, 0006, 0007, 0009 aplicam-se ao Release 2 (Frente 4) e não aparecem aqui.

> **Como usar (agente de dev):** ao pegar uma USP, leia o card dela na Seção 2, puxe só as seções do TD apontadas (ex.: `TD §4.5`), os **runbooks** nomeados e os **ADRs técnicos** listados — em vez de carregar o TD inteiro. Os artefatos vivem em `../architecture/` (TD, ADRs, runbooks, project-guideline).

---

## Seção 1 — Índice compacto

| USP | Título | Épico | Prioridade |
|---|---|---|---|
| USP-001 | Auto-cadastro de Pessoa no portal (público) | 1 — Identidade, Acesso e Papéis | Must |
| USP-002 | Cadastro de Pessoa pela assistente social (situação extrema) | 1 — Identidade, Acesso e Papéis | Must |
| USP-003 | Reivindicar credencial de Pessoa pré-cadastrada | 1 — Identidade, Acesso e Papéis | Must |
| USP-004 | Autenticar no portal com e-mail e senha | 1 — Identidade, Acesso e Papéis | Must |
| USP-005 | Recuperar senha esquecida | 1 — Identidade, Acesso e Papéis | Must |
| USP-006 | Ativar papel adicional na Pessoa autenticada | 1 — Identidade, Acesso e Papéis | Must |
| USP-007 | Inativar Pessoa (desligamento de voluntário ou pedido do titular) | 1 — Identidade, Acesso e Papéis | Must |
| USP-008 | Configurar permissões delegadas a voluntário no portal | 1 — Identidade, Acesso e Papéis | Must |
| USP-009 | Cadastro de candidato (papel) | 2 — Cadastros Públicos | Must |
| USP-010 | Cadastro de prestador de serviço (papel) | 2 — Cadastros Públicos | Must |
| USP-011 | Cadastro de cliente de serviço (papel) | 2 — Cadastros Públicos | Must |
| USP-012 | Cadastro de Empresa (pela Pessoa que se torna responsável) | 2 — Cadastros Públicos | Must |
| USP-013 | Adicionar responsável a uma Empresa | 3 — Gestão de Vínculos Pessoa-Empresa | Must |
| USP-014 | Remover responsável de uma Empresa | 3 — Gestão de Vínculos Pessoa-Empresa | Must |
| USP-015 | Editar dados da Empresa | 3 — Gestão de Vínculos Pessoa-Empresa | Must |
| USP-016 | Moderar rascunho (vaga, CV ou serviço) | 4 — Moderação de Conteúdo | Must |
| USP-017 | Validar Empresa na primeira vaga publicada | 4 — Moderação de Conteúdo | Must |
| USP-018 | Inativar conteúdo já publicado | 4 — Moderação de Conteúdo | Must |
| USP-019 | Sugerir nova categoria de serviço ou área de vaga | 4 — Moderação de Conteúdo | Should |
| USP-020 | Publicar vaga | 5 — Vagas | Must |
| USP-021 | Buscar vagas (pública) | 5 — Vagas | Must |
| USP-022 | Ver detalhe da vaga | 5 — Vagas | Must |
| USP-023 | Editar vaga (pausar, arquivar, renovar) | 5 — Vagas | Must |
| USP-024 | Expiração automática de vaga | 5 — Vagas | Must |
| USP-025 | Candidatar-se a uma vaga | 6 — Candidaturas e Busca de Candidatos | Must |
| USP-026 | Cancelar candidatura | 6 — Candidaturas e Busca de Candidatos | Must |
| USP-027 | Empresa ver lista de candidatos da vaga | 6 — Candidaturas e Busca de Candidatos | Must |
| USP-028 | Empresa buscar candidatos (busca ativa) | 6 — Candidaturas e Busca de Candidatos | Must |
| USP-029 | Publicar serviço | 7 — Serviços | Must |
| USP-030 | Buscar serviços (pública) | 7 — Serviços | Must |
| USP-031 | Ver detalhe do serviço | 7 — Serviços | Must |
| USP-032 | Editar serviço (pausar, arquivar) | 7 — Serviços | Must |
| USP-033 | Manifestar interesse em serviço | 8 — Manifestação de Interesse em Serviço | Must |
| USP-034 | Cancelar manifestação de interesse | 8 — Manifestação de Interesse em Serviço | Should |
| USP-035 | Prestador ver manifestações de interesse | 8 — Manifestação de Interesse em Serviço | Must |
| USP-036 | Cadastrar ficha socioeconômica da Pessoa | 9 — Ficha Social, Encaminhamento e Visão Consolidada | Must |
| USP-037 | Encaminhar Pessoa para vaga | 9 — Ficha Social, Encaminhamento e Visão Consolidada | Must |
| USP-038 | Registrar resultado do encaminhamento manualmente | 9 — Ficha Social, Encaminhamento e Visão Consolidada | Must |
| USP-039 | Visão consolidada da Pessoa | 9 — Ficha Social, Encaminhamento e Visão Consolidada | Must |
| USP-040 | Extração automática de CV via IA generativa | 10 — Extração de CV via IA Generativa | Must |
| USP-041 | Home pública com indicadores em tempo real | 11 — Indicadores e Relatórios | Must |
| USP-042 | Relatórios operacionais do Portal | 11 — Indicadores e Relatórios | Must |
| USP-043 | Consentimentos LGPD por finalidade | 12 — Conformidade LGPD (Consentimentos) | Must |
| USP-044 | Notificações por e-mail em eventos do portal | 13 — Notificações por E-mail | Must |
| USP-045 | Reativar Pessoa (fluxo inverso da USP-007) | 1 — Identidade, Acesso e Papéis | Must |

> **USP-045** criada na fase de arquitetura (2026-05-29) a partir da premissa de reativação confirmada pelo PO. Os intent/expectations (camada ICE) devem ser gerados pela `po-bravi-idsd`.

---

## Seção 2 — Cards de conexão por USP

> Cada card preserva as colunas de negócio do esqueleto e acrescenta o bloco **[técnico]** (Schemas/Endpoints/Eventos/Runbooks/ADRs técnicos/Fase) apontando para o TD em `../architecture/technical-design.md`.

### USP-001 — Auto-cadastro de Pessoa no portal (público)

- **Upstream:** USP-043 (consentimento da finalidade persistido na ativação do papel, logo após o cadastro — modelo lazy, 2ª transação)
- **Downstream:** USP-004, USP-006, USP-009, USP-010, USP-011, USP-012, USP-013, USP-025, USP-033, USP-037 (e toda USP autenticada)
- **ADRs:** ADR-0010, ADR-0011, ADR-0013, ADR-0017
- **Métricas:** MP1, MP2, MP3 (vetor de entrada para qualquer papel público)
- **Riscos:** RP-003 (termos), RP-008 (indireto via USP-040 quando candidato anexar CV)
- **Deps/Q-abertas:** D-002 (termos), D-009 (CAPTCHA), QP-003
- **[técnico] Schemas:** persons, credentials, role_grants, consents, audit_log, outbox (TD §4.5)
- **[técnico] Endpoints:** `identity.registrar` (TD §4.4)
- **[técnico] Eventos:** PERSON_CREATED (audit) · email.welcome (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-audit-log, runbook-rate-limit-anti-abuse
- **[técnico] ADRs técnicos:** ADR-0020, ADR-0021, ADR-0023, ADR-0029
- **[técnico] Fase:** Fase 1 (TD §5)

### USP-002 — Cadastro de Pessoa pela assistente social (situação extrema)

- **Upstream:** —
- **Downstream:** USP-003 (Pessoa pode reivindicar credencial), USP-036, USP-037, USP-039
- **ADRs:** ADR-0010, ADR-0011, ADR-0017
- **Métricas:** — (indireto via USP-037)
- **Riscos:** RP-002 (DPO — Pessoa sem credencial ainda gera dado pessoal)
- **Deps/Q-abertas:** D-001 (DPO), D-002 (termos — neste caso o termo é assinado fora do sistema)
- **[técnico] Schemas:** persons (cpf_excecao), audit_log (TD §4.5)
- **[técnico] Endpoints:** `persons.cadastrarPessoaPelaAS` (TD §4.4)
- **[técnico] Eventos:** PERSON_CREATED (audit, com operador AS) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log, runbook-view-model-visibility
- **[técnico] ADRs técnicos:** ADR-0022, ADR-0023, ADR-0030 (Pessoa sem credencial não loga)
- **[técnico] Fase:** Fase 1 (TD §5)

### USP-003 — Reivindicar credencial de Pessoa pré-cadastrada

- **Upstream:** USP-002 (Pessoa precisa estar pré-cadastrada)
- **Downstream:** USP-004, USP-006, USP-043
- **ADRs:** ADR-0010, ADR-0011, ADR-0017
- **Métricas:** —
- **Riscos:** Risco proposto: sequestro de identidade por reivindicação falsa (mitigação no processo de verificação)
- **Deps/Q-abertas:** D-011/QP-001 — **RESOLVIDO (2026-05-29):** verificação **manual pela assistente social** (definido pela diretoria)
- **[técnico] Schemas:** persons, credentials, consents, audit_log (TD §4.5)
- **[técnico] Endpoints:** `identity.iniciarReivindicacao`, `identity.confirmarReivindicacao` (TD §4.4)
- **[técnico] Eventos:** CREDENTIAL_CLAIMED (audit) · email.welcome (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-audit-log, runbook-rate-limit-anti-abuse
- **[técnico] ADRs técnicos:** ADR-0020, ADR-0021, ADR-0023, ADR-0029
- **[técnico] Fase:** Fase 1 (TD §5)

### USP-004 — Login no portal

> O PRD lista USP-004 no índice do Épico 1 com prioridade Must; o corpo na §5.2 não detalhava os ACs entre USP-003 e USP-005. Tratado como "Login (e-mail + senha) com bloqueio temporário", coerente com §6.3 do PRD. **VALIDADO pelo PO (2026-05-29):** comportamento esperado = e-mail+senha, lockout 5/15min, sessão 12h.

- **Upstream:** USP-001 ou USP-003 (credencial existir)
- **Downstream:** todas as USPs autenticadas
- **ADRs:** ADR-0010
- **Métricas:** — (transversal)
- **Riscos:** RP-009 (rate limiting); risco proposto: brute-force e enumeração de e-mails
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** credentials, persons (session_epoch), audit_log (TD §4.5)
- **[técnico] Endpoints:** `identity.login` (TD §4.4)
- **[técnico] Eventos:** LOGIN_SUCCESS, LOGIN_BLOCKED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-rate-limit-anti-abuse, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0029 (lockout email+IP, anti-enumeração), ADR-0030 (revalidação de status), ADR-0023
- **[técnico] Fase:** Fase 1 (TD §5)

### USP-005 — Recuperar senha esquecida

- **Upstream:** USP-001 ou USP-003
- **Downstream:** USP-004
- **ADRs:** ADR-0010
- **Métricas:** —
- **Riscos:** Risco proposto: enumeração de e-mails (mitigado por AC-005-2 — mensagem genérica)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** credentials, persons (session_epoch) (TD §4.5)
- **[técnico] Endpoints:** `identity.recuperarSenha`, `identity.redefinirSenha` (TD §4.4)
- **[técnico] Eventos:** PASSWORD_RESET (audit) · email.password_reset (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-rate-limit-anti-abuse, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0029 (token único, anti-enumeração+timing), ADR-0030 (invalida sessões), ADR-0020 (outbox)
- **[técnico] Fase:** Fase 1 (TD §5)

### USP-006 — Ativar papel adicional na Pessoa autenticada

- **Upstream:** USP-001 ou USP-002+USP-003 (Pessoa precisa existir), USP-043 (consentimento da finalidade do papel novo)
- **Downstream:** USP-009 (se papel = candidato), USP-010 (prestador), USP-011 (cliente), USP-012 (empresa-responsável)
- **ADRs:** ADR-0011, ADR-0013, ADR-0015 (a moderação do CONTEÚDO posterior é o gate, não o papel em si)
- **Métricas:** MP1, MP2, MP3 (entrada lateral em papéis adicionais)
- **Riscos:** RP-003 (termo da finalidade nova)
- **Deps/Q-abertas:** D-002
- **[técnico] Schemas:** role_grants, consents, audit_log (TD §4.5)
- **[técnico] Endpoints:** `persons.ativarPapel` (pessoaId da sessão — anti-IDOR) (TD §4.4)
- **[técnico] Eventos:** ROLE_ACTIVATED, CONSENT_GIVEN (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0020 (transação papel+consentimento), ADR-0023, ADR-0025
- **[técnico] Fase:** Fase 1 (TD §5)

### USP-007 — Inativar Pessoa (desligamento de voluntário ou pedido do titular)

- **Upstream:** —
- **Downstream:** USP-004 (bloqueio de login), USP-008 (revogação de permissões delegadas), USP-014 (sucessão de responsável de Empresa)
- **ADRs:** ADR-0008 (estendido — retenção do histórico), ADR-0011
- **Métricas:** —
- **Riscos:** Risco proposto: inativar único responsável de Empresa quebra USP-014 (mitigado por AC-007-3)
- **Deps/Q-abertas:** D-001 (DPO precisa estar designado para autorizar inativação a pedido do titular)
- **[técnico] Schemas:** persons (status), company_responsibles, consents (suspenso), audit_log (TD §4.5)
- **[técnico] Endpoints:** `persons.inativarPessoa` (TD §4.4)
- **[técnico] Eventos:** PERSON_INACTIVATED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0023, ADR-0030 (rejeita sessão viva em janela curta), ADR-0025 (consentimentos suspensos, não apagados)
- **[técnico] Fase:** Fase 1 (TD §5)

### USP-008 — Configurar permissões delegadas a voluntário no portal

- **Upstream:** USP-001 (Pessoa existir como voluntário), USP-004
- **Downstream:** USP-016, USP-017, USP-018, USP-019, USP-037, USP-038, USP-003 (reivindicação delegável)
- **ADRs:** ADR-0001 (estendido — catálogo do Portal), ADR-0010
- **Métricas:** — (transversal — operacional)
- **Riscos:** RP-004 (carga de moderação — delegar a voluntários é o mecanismo de escala)
- **Deps/Q-abertas:** D-006 (catálogo final), QP-006
- **[técnico] Schemas:** permission_grants (enum fechado, namespace 'portal:'), audit_log (TD §4.5)
- **[técnico] Endpoints:** `persons.concederPermissao`, `persons.revogarPermissao` (TD §4.4)
- **[técnico] Eventos:** PERMISSION_GRANTED, PERMISSION_REVOKED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0023, ADR-0030 (revogação no próximo carregamento; reativação zera grants)
- **[técnico] Fase:** Fase 1 (TD §5)

### USP-009 — Cadastro de candidato (papel)

- **Upstream:** USP-001 (ou USP-006), USP-043 (consentimento "candidatura a vagas"), USP-040 (extração de CV)
- **Downstream:** USP-016 (moderação do perfil), USP-025, USP-028, USP-037
- **ADRs:** ADR-0011, ADR-0013, ADR-0015, ADR-0017, ADR-0018
- **Métricas:** MP1
- **Riscos:** RP-003, RP-007 (CV ruim validado), RP-008 (LLM sem ZDR)
- **Deps/Q-abertas:** D-002, D-008, QP-002
- **[técnico] Schemas:** role_grants, content_items (cv_perfil), cv_files, consents (TD §4.5)
- **[técnico] Endpoints:** `persons.ativarPapel(candidato)`, integração `cv-extraction` (TD §4.4/§4.7)
- **[técnico] Eventos:** ROLE_ACTIVATED, CONTENT_TRANSITIONED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-moderation-transition, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0020, ADR-0023, ADR-0024, ADR-0027 (CVExtractor/ZDR), ADR-0028 (upload)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-010 — Cadastro de prestador de serviço (papel)

- **Upstream:** USP-001 ou USP-006, USP-043 (consentimento "oferta de serviço")
- **Downstream:** USP-029
- **ADRs:** ADR-0011, ADR-0013, ADR-0014 (Empresa — destino do CNPJ MEI)
- **Métricas:** MP3
- **Riscos:** RP-003
- **Deps/Q-abertas:** D-002
- **[técnico] Schemas:** role_grants, consents, provider_profiles (foto/descrição/região, **sem CNPJ**). CNPJ MEI do prestador PF reside em `companies` via fluxo USP-012 (**ADR-0031**, revisto 2026-06-10); regime tributário em `CompanyType` (TD §4.5)
- **[técnico] Endpoints:** `persons.ativarPapel(prestador)` (TD §4.4); declarar MEI → redireciona ao fluxo `companies.cadastrarEmpresa` (USP-012)
- **[técnico] Eventos:** ROLE_ACTIVATED, CONSENT_GIVEN (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0020, ADR-0023, **ADR-0031** (CNPJ MEI em companies)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-011 — Cadastro de cliente de serviço (papel)

- **Upstream:** USP-001 ou USP-006, USP-043 (consentimento "contratação de serviço")
- **Downstream:** USP-033
- **ADRs:** ADR-0011, ADR-0013
- **Métricas:** — (vetor para MP7)
- **Riscos:** RP-003
- **Deps/Q-abertas:** D-002
- **[técnico] Schemas:** role_grants, consents, service_interests (ativação no 1º interesse) (TD §4.5)
- **[técnico] Endpoints:** ativação automática dentro de `services.manifestarInteresse` (TD §4.4)
- **[técnico] Eventos:** ROLE_ACTIVATED, CONSENT_GIVEN (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate
- **[técnico] ADRs técnicos:** ADR-0020 (ativação+consentimento+manifestação atômicos), ADR-0023
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-012 — Cadastro de Empresa (pela Pessoa que se torna responsável)

- **Upstream:** USP-001 (ou USP-006 ativando papel empresa-responsável), USP-043 (consentimento "representação de empresa")
- **Downstream:** USP-013, USP-014, USP-015, USP-017, USP-020, USP-029 (publicar serviço em nome de Empresa), USP-027
- **ADRs:** ADR-0011, ADR-0013, ADR-0014
- **Métricas:** MP2 (vetor — Empresa só vira "verificada" via USP-017)
- **Riscos:** RP-005 (empresa-fantasma — entrada do vetor)
- **Deps/Q-abertas:** D-002
- **[técnico] Schemas:** companies (UNIQUE cnpj), company_responsibles, role_grants, consents, audit_log (TD §4.5)
- **[técnico] Endpoints:** `companies.cadastrarEmpresa` (TD §4.4)
- **[técnico] Eventos:** COMPANY_CREATED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0020 (4 escritas atômicas), ADR-0021 (CNPJ único+409), ADR-0023
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-013 — Adicionar responsável a uma Empresa

- **Upstream:** USP-012, USP-001 (Pessoa-alvo precisa estar pré-cadastrada — sem convite)
- **Downstream:** USP-014, USP-020, USP-029
- **ADRs:** ADR-0014, ADR-0017
- **Métricas:** —
- **Riscos:** Risco proposto: revelação inadvertida de existência de Pessoa via busca por CPF/e-mail (mitigado por design da UX — não revelar nome até confirmar; ❓ definir comportamento exato)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** company_responsibles (UNIQUE pessoa,empresa ativo), persons (TD §4.5)
- **[técnico] Endpoints:** `companies.adicionarResponsavel` (TD §4.4)
- **[técnico] Eventos:** RESPONSIBLE_ADDED (audit) · email (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log, runbook-view-model-visibility (busca não revela PII), runbook-rate-limit-anti-abuse (anti-enumeração CPF)
- **[técnico] ADRs técnicos:** ADR-0020, ADR-0021 (vínculo único), ADR-0022 (resposta binária sem PII), ADR-0029 (limite de buscas)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-014 — Remover responsável de uma Empresa

- **Upstream:** USP-012, USP-013
- **Downstream:** USP-007 (sucessão de responsável quando Pessoa inativada)
- **ADRs:** ADR-0014
- **Métricas:** —
- **Riscos:** Risco proposto: Empresa órfã (mitigado por AC-014-2)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** company_responsibles (invariante ≥1 ativo), audit_log (TD §4.5)
- **[técnico] Endpoints:** `companies.removerResponsavel` (TD §4.4)
- **[técnico] Eventos:** RESPONSIBLE_REMOVED (audit) · email (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0023, ADR-0030 (invariante checado em todas as rotas, incl. USP-007)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-015 — Editar dados da Empresa

- **Upstream:** USP-012
- **Downstream:** USP-017 (re-verificação ao editar CNPJ/razão social/nome fantasia)
- **ADRs:** ADR-0014, ADR-0015
- **Métricas:** —
- **Riscos:** RP-005 (vetor pós-verificação — Empresa verificada edita dados e finge ainda estar verificada)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** companies (rebaixa verificada=false na mesma transação), audit_log (TD §4.5)
- **[técnico] Endpoints:** `companies.editarEmpresa` (TD §4.4)
- **[técnico] Eventos:** COMPANY_UPDATED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0020 (edição+rebaixamento atômicos), ADR-0021 (CNPJ único em UPDATE), ADR-0023, ADR-0024 (re-verificação na próxima vaga)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-016 — Moderar rascunho (vaga, CV ou serviço)

- **Upstream:** USP-008 (permissão delegada de moderar), USP-020/USP-009/USP-029 (rascunho existe)
- **Downstream:** USP-021, USP-022, USP-028, USP-030, USP-031, USP-044
- **ADRs:** ADR-0001 (estendido), ADR-0015
- **Métricas:** MP10 (tempo médio de moderação)
- **Riscos:** RP-004 (carga de moderação), RP-005 (defesa, junto com USP-017), RP-010 (sem denúncia formal)
- **Deps/Q-abertas:** D-006
- **[técnico] Schemas:** content_items, content_transitions, audit_log, outbox (TD §4.5)
- **[técnico] Endpoints:** `moderation.transitionContent` (única via) (TD §4.4)
- **[técnico] Eventos:** CONTENT_TRANSITIONED (audit) · email.moderation_decision (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-moderation-transition, runbook-audit-log, runbook-server-action
- **[técnico] ADRs técnicos:** ADR-0024 (FSM, autor≠moderador, motivo obrigatório), ADR-0023, ADR-0020
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-017 — Validar Empresa na primeira vaga publicada

- **Upstream:** USP-012 (Empresa "não verificada"), USP-020 (primeira vaga em moderação), USP-016 (fluxo de moderação)
- **Downstream:** USP-027, USP-028 (Empresa verificada aparece para candidatos)
- **ADRs:** ADR-0014, ADR-0015
- **Métricas:** MP2
- **Riscos:** RP-005 (principal defesa do MVP contra empresa-fantasma)
- **Deps/Q-abertas:** Q proposta: lista de verificação ("checklist") do coordenador — entregável da Fase 0
- **[técnico] Schemas:** companies (verificada + snapshot no instante da verificação), content_transitions (TD §4.5)
- **[técnico] Endpoints:** dentro de `moderation.transitionContent` (aprovação da 1ª vaga) (TD §4.4)
- **[técnico] Eventos:** COMPANY_VERIFIED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-moderation-transition, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0024 (aprovação-vaga + verificação-Empresa atômicas), ADR-0023, ADR-0020
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-018 — Inativar conteúdo já publicado

- **Upstream:** USP-008 (permissão delegada), USP-016 (conteúdo aprovado previamente)
- **Downstream:** —
- **ADRs:** ADR-0015
- **Métricas:** —
- **Riscos:** RP-010 (escape válve para ausência de denúncia formal)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** content_items (→ arquivado), content_transitions, outbox (TD §4.5)
- **[técnico] Endpoints:** `moderation.transitionContent(arquivado)` (TD §4.4)
- **[técnico] Eventos:** CONTENT_TRANSITIONED (audit) · email (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-moderation-transition, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0024, ADR-0023 (soft-delete por status, sem DELETE físico)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-019 — Sugerir nova categoria de serviço ou área de vaga

- **Upstream:** USP-020 ou USP-029 (autor publicando)
- **Downstream:** USP-008 (permissão de aprovar sugestão)
- **ADRs:** ADR-0010
- **Métricas:** —
- **Riscos:** Risco proposto: catálogo poluído por sugestões fora de padrão (mitigado por aprovação humana)
- **Deps/Q-abertas:** D-007
- **[técnico] Schemas:** catalogs (status pendente|ativo) (TD §4.5)
- **[técnico] Endpoints:** `catalogs.sugerir`, `catalogs.aprovarSugestao` (TD §4.4)
- **[técnico] Eventos:** CATALOG_SUGGESTED, CATALOG_APPROVED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0023, ADR-0024 (aprovação por papel/permissão)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-020 — Publicar vaga

- **Upstream:** USP-012, USP-013 (a Pessoa precisa ser responsável da Empresa)
- **Downstream:** USP-016, USP-017 (se primeira vaga), USP-021, USP-022, USP-024, USP-027, USP-037
- **ADRs:** ADR-0014, ADR-0015
- **Métricas:** MP4
- **Riscos:** RP-005 (vetor de entrada de empresa-fantasma com vaga)
- **Deps/Q-abertas:** D-007
- **[técnico] Schemas:** content_items, jobs (validade obrigatória), companies (TD §4.5)
- **[técnico] Endpoints:** `jobs.publicarVaga` (→ em_moderacao via transitionContent) (TD §4.4)
- **[técnico] Eventos:** CONTENT_TRANSITIONED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-moderation-transition, runbook-server-action, runbook-search-pagination
- **[técnico] ADRs técnicos:** ADR-0024 (1ª vaga arrasta verificação — USP-017), ADR-0021 (dedup de vaga), ADR-0028 (sanitização)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-021 — Buscar vagas (pública)

- **Upstream:** USP-016 (vaga aprovada e ativa), USP-024 (vagas expiradas ocultas)
- **Downstream:** USP-022, USP-025
- **ADRs:** ADR-0015, ADR-0017
- **Métricas:** — (vetor de descoberta)
- **Riscos:** RP-009 (volume tráfego anônimo)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** jobs, content_items (filtro on-read: ativo + validade >= hoje) (TD §4.5)
- **[técnico] Endpoints:** `jobs.buscarVagas` (ISR + cache curto) (TD §4.4)
- **[técnico] Eventos:** — (TD §4.6)
- **[técnico] Runbooks:** runbook-search-pagination, runbook-view-model-visibility (anônimo vê Empresa anonimizada)
- **[técnico] ADRs técnicos:** ADR-0022 (anonimização no serializer), ADR-0026 (on-read)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-022 — Ver detalhe da vaga

- **Upstream:** USP-021
- **Downstream:** USP-025
- **ADRs:** ADR-0015, ADR-0017
- **Métricas:** —
- **Riscos:** RP-009
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** jobs, content_items, applications (contador) (TD §4.5)
- **[técnico] Endpoints:** `jobs.detalheVaga` (TD §4.4)
- **[técnico] Eventos:** — (TD §4.6)
- **[técnico] Runbooks:** runbook-view-model-visibility, runbook-search-pagination
- **[técnico] ADRs técnicos:** ADR-0022 (anonimização em todos os canais incl. OG/JSON-LD), ADR-0026 (detalhe de expirada), ADR-0028
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-023 — Editar vaga (pausar, arquivar, renovar)

- **Upstream:** USP-020
- **Downstream:** USP-016 (edição volta a rascunho — re-moderação)
- **ADRs:** ADR-0015
- **Métricas:** —
- **Riscos:** Risco proposto: prorrogação sem re-moderação burla controle de qualidade de conteúdo já alterado (mitigado: prorrogação só de validade, AC-023-4)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** content_items, jobs, content_transitions (preserva published_at) (TD §4.5)
- **[técnico] Endpoints:** `jobs.editarVaga`, `jobs.pausarVaga`, `jobs.prorrogarVaga`, `jobs.arquivarVaga` (TD §4.4)
- **[técnico] Eventos:** CONTENT_TRANSITIONED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-moderation-transition, runbook-server-action
- **[técnico] ADRs técnicos:** ADR-0024 (editar→rascunho; preserva data de publicação — anti-ranking)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-024 — Expiração automática de vaga

- **Upstream:** USP-020 (vaga com data de validade)
- **Downstream:** USP-021 (vagas expiradas ocultas)
- **ADRs:** ADR-0010, ADR-0015
- **Métricas:** —
- **Riscos:** Risco proposto: job de expiração falha silenciosamente; vaga vencida fica visível (precisa de observabilidade)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** jobs (validade), content_items (status), outbox (TD §4.5)
- **[técnico] Endpoints:** `POST /api/cron/expire-jobs` (Vercel Cron) (TD §4.4)
- **[técnico] Eventos:** email.job_expiring (outbox, D-3) (TD §4.6)
- **[técnico] Runbooks:** runbook-search-pagination (filtro on-read)
- **[técnico] ADRs técnicos:** ADR-0026 (on-read + job + alerta de heartbeat), ADR-0020 (e-mail via outbox)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-025 — Candidatar-se a uma vaga

- **Upstream:** USP-009 (perfil ativo do candidato), USP-021/USP-022 (vaga ativa), USP-043
- **Downstream:** USP-026, USP-027, USP-044
- **ADRs:** ADR-0013, ADR-0017
- **Métricas:** MP6
- **Riscos:** RP-008 indireto (CV processado por IA aparece na empresa)
- **Deps/Q-abertas:** D-002
- **[técnico] Schemas:** applications (UNIQUE candidato,vaga ativa), audit_log, outbox (TD §4.5)
- **[técnico] Endpoints:** `jobs.candidatar` (TD §4.4)
- **[técnico] Eventos:** APPLICATION_CREATED (audit) · email.application_confirmed (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-audit-log, runbook-rate-limit-anti-abuse
- **[técnico] ADRs técnicos:** ADR-0020 (3 efeitos atômicos+retry e-mail), ADR-0021 (duplo-clique→1), ADR-0023, ADR-0025 (revogação cancela), ADR-0029 (candidatura em massa)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-026 — Cancelar candidatura

- **Upstream:** USP-025
- **Downstream:** USP-025 (re-candidatura permitida)
- **ADRs:** ADR-0017
- **Métricas:** —
- **Riscos:** —
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** applications (status cancelada; preserva timestamp da 1ª) (TD §4.5)
- **[técnico] Endpoints:** `jobs.cancelarCandidatura` (TD §4.4)
- **[técnico] Eventos:** APPLICATION_CANCELLED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0021 (re-candidatura sob UNIQUE), ADR-0023, ADR-0025 (revogação de visibilidade — semântica a definir pela DPO)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-027 — Empresa ver lista de candidatos da vaga

- **Upstream:** USP-025, USP-037 (candidatura encaminhada com badge)
- **Downstream:** —
- **ADRs:** ADR-0014, ADR-0016 (badge), ADR-0017
- **Métricas:** MP6 (indireto)
- **Riscos:** RP-008 (CV processado por IA aparece com qualidade questionável)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** applications, persons, cv_files (URL assinada) (TD §4.5)
- **[técnico] Endpoints:** `jobs.listarCandidatos` (TD §4.4)
- **[técnico] Eventos:** — (TD §4.6)
- **[técnico] Runbooks:** runbook-view-model-visibility (badge encaminhamento; isolamento por vaga)
- **[técnico] ADRs técnicos:** ADR-0022 (sem cross-leakage; contato só após candidatura), ADR-0028 (CV privado)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-028 — Empresa buscar candidatos (busca ativa)

- **Upstream:** USP-009 (candidatos com perfil ativo), USP-012 (Empresa autenticada)
- **Downstream:** USP-025 (Empresa pode atrair candidatura)
- **ADRs:** ADR-0014, ADR-0017
- **Métricas:** —
- **Riscos:** Risco proposto: mineração de dados de candidatos (mitigado por ADR-0017 — campos sensíveis ocultos até candidatura)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** persons, role_grants (candidato ativo) (TD §4.5)
- **[técnico] Endpoints:** `jobs.buscarCandidatos` (TD §4.4)
- **[técnico] Eventos:** — (TD §4.6)
- **[técnico] Runbooks:** runbook-view-model-visibility, runbook-search-pagination, runbook-rate-limit-anti-abuse (anti-scraping)
- **[técnico] ADRs técnicos:** ADR-0022 (resumo sem PII), ADR-0028 (sanitização de texto livre), ADR-0029 (rate limit agressivo)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-029 — Publicar serviço

- **Upstream:** USP-010 (papel prestador PF) OU USP-012 (Empresa) + USP-013, USP-043
- **Downstream:** USP-016, USP-030, USP-031, USP-032, USP-033, USP-035
- **ADRs:** ADR-0014, ADR-0015
- **Métricas:** MP5
- **Riscos:** Risco proposto: serviço ilegal ou enganoso publicado (mitigado por moderação USP-016)
- **Deps/Q-abertas:** D-002, D-007
- **[técnico] Schemas:** content_items, services (como pf|empresa), service_photos (TD §4.5)
- **[técnico] Endpoints:** `services.publicarServico` (escolha PF vs Empresa atômica) (TD §4.4)
- **[técnico] Eventos:** CONTENT_TRANSITIONED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-moderation-transition, runbook-server-action, runbook-consent-gate
- **[técnico] ADRs técnicos:** ADR-0024, ADR-0028 (sanitização de texto livre + inspeção de fotos), ADR-0020
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-030 — Buscar serviços (pública)

- **Upstream:** USP-016 (serviço aprovado)
- **Downstream:** USP-031, USP-033
- **ADRs:** ADR-0015, ADR-0017
- **Métricas:** — (vetor de descoberta)
- **Riscos:** RP-009
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** services, content_items (on-read: ativo + consentimento ativo) (TD §4.5)
- **[técnico] Endpoints:** `services.buscarServicos` (TD §4.4)
- **[técnico] Eventos:** — (TD §4.6)
- **[técnico] Runbooks:** runbook-search-pagination, runbook-view-model-visibility (nome do prestador público; contato oculto)
- **[técnico] ADRs técnicos:** ADR-0022, ADR-0025 (serviço com consentimento revogado some on-read), ADR-0026
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-031 — Ver detalhe do serviço

- **Upstream:** USP-030
- **Downstream:** USP-033
- **ADRs:** ADR-0017
- **Métricas:** —
- **Riscos:** RP-009
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** services, service_photos (TD §4.5)
- **[técnico] Endpoints:** `services.detalheServico` (TD §4.4)
- **[técnico] Eventos:** — (TD §4.6)
- **[técnico] Runbooks:** runbook-view-model-visibility
- **[técnico] ADRs técnicos:** ADR-0022 (contato oculto até manifestação), ADR-0028 (sanitização de contato em descrição/fotos)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-032 — Editar serviço (pausar, arquivar)

- **Upstream:** USP-029
- **Downstream:** USP-016 (edição volta a rascunho)
- **ADRs:** ADR-0015
- **Métricas:** —
- **Riscos:** —
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** content_items, services, content_transitions (TD §4.5)
- **[técnico] Endpoints:** `services.editarServico`, `services.pausarServico`, `services.arquivarServico` (TD §4.4)
- **[técnico] Eventos:** CONTENT_TRANSITIONED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-moderation-transition, runbook-server-action
- **[técnico] ADRs técnicos:** ADR-0024 (editar→rascunho; serviço sem expiração automática)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-033 — Manifestar interesse em serviço

- **Upstream:** USP-001 ou USP-006, USP-011 (papel cliente — ativado automaticamente), USP-030/USP-031, USP-043
- **Downstream:** USP-034, USP-035, USP-044
- **ADRs:** ADR-0011, ADR-0013, ADR-0017
- **Métricas:** MP7
- **Riscos:** RP-003 (consentimento da finalidade "contratação de serviço")
- **Deps/Q-abertas:** D-002
- **[técnico] Schemas:** service_interests (UNIQUE cliente,serviço ativo), role_grants, consents, outbox (TD §4.5)
- **[técnico] Endpoints:** `services.manifestarInteresse` (TD §4.4)
- **[técnico] Eventos:** INTEREST_CREATED (audit) · email.interest_notified (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-audit-log, runbook-rate-limit-anti-abuse
- **[técnico] ADRs técnicos:** ADR-0020 (4 efeitos atômicos), ADR-0021 (duplo-clique), ADR-0023, ADR-0025, ADR-0029
- **[técnico] Fase:** Fase 3 (TD §5)

### USP-034 — Cancelar manifestação de interesse

- **Upstream:** USP-033
- **Downstream:** —
- **ADRs:** ADR-0017
- **Métricas:** —
- **Riscos:** —
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** service_interests (status cancelada) (TD §4.5)
- **[técnico] Endpoints:** `services.cancelarManifestacao` (TD §4.4)
- **[técnico] Eventos:** INTEREST_CANCELLED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0021, ADR-0023, ADR-0025 (revogação de visibilidade do contato — semântica a definir pela DPO)
- **[técnico] Fase:** Fase 3 (TD §5)

### USP-035 — Prestador ver manifestações de interesse

- **Upstream:** USP-033
- **Downstream:** —
- **ADRs:** ADR-0017
- **Métricas:** MP7 (indireto)
- **Riscos:** —
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** service_interests, persons (TD §4.5)
- **[técnico] Endpoints:** `services.listarManifestacoes` (TD §4.4)
- **[técnico] Eventos:** — (TD §4.6)
- **[técnico] Runbooks:** runbook-view-model-visibility (isolamento por prestador)
- **[técnico] ADRs técnicos:** ADR-0022 (sem cross-leakage entre prestadores)
- **[técnico] Fase:** Fase 3 (TD §5)

### USP-036 — Cadastrar ficha socioeconômica da Pessoa

- **Upstream:** USP-001 ou USP-002 (Pessoa existe), USP-043 (consentimento "atendimento social")
- **Downstream:** USP-037, USP-039
- **ADRs:** ADR-0011, ADR-0012, ADR-0013, ADR-0017 (acesso restrito a AS e diretoria)
- **Métricas:** —
- **Riscos:** RP-002 (DPO), RP-003 (termo de atendimento social)
- **Deps/Q-abertas:** D-001, D-002
- **[técnico] Schemas:** ficha_social (cripto em repouso), consents, audit_log (TD §4.5/§7.2)
- **[técnico] Endpoints:** `persons.salvarFichaSocial` (TD §4.4)
- **[técnico] Eventos:** FICHA_SOCIAL_UPDATED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-view-model-visibility, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0022 (guard centralizado AS/diretoria, incl. serializer da USP-039), ADR-0023, ADR-0028 (cripto)
- **[técnico] Fase:** Fase 3 (TD §5)

### USP-037 — Encaminhar Pessoa para vaga

- **Upstream:** USP-001 ou USP-002 (Pessoa existe), USP-020 (vaga ativa), USP-008 (permissão delegada para encaminhar), USP-043 (consentimento "encaminhamento institucional")
- **Downstream:** USP-027 (badge), USP-038, USP-039, USP-044
- **ADRs:** ADR-0001, ADR-0011, ADR-0013, ADR-0016, ADR-0017
- **Métricas:** MP8
- **Riscos:** RP-002, RP-003 (sem aceite prévio da Pessoa — termo precisa cobrir)
- **Deps/Q-abertas:** D-001, D-002
- **[técnico] Schemas:** referrals, applications (via_encaminhamento), role_grants, consents, outbox (TD §4.5)
- **[técnico] Endpoints:** `referrals.encaminhar` (TD §4.4)
- **[técnico] Eventos:** REFERRAL_CREATED (audit) · email.referral_informed (outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-consent-gate, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0020 (operação composta atômica), ADR-0023, ADR-0025 (finalidade 8), ADR-0029 (anti-spray)
- **[técnico] Fase:** Fase 3 (TD §5)

### USP-038 — Registrar resultado do encaminhamento manualmente

- **Upstream:** USP-037, USP-008 (permissão)
- **Downstream:** USP-039
- **ADRs:** ADR-0016
- **Métricas:** MP9
- **Riscos:** Risco proposto: viés de registro (só o sucesso é registrado, métrica MP9 fica inflada)
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** referral_results (APPEND-ONLY versionado) (TD §4.5)
- **[técnico] Endpoints:** `referrals.registrarResultado` (TD §4.4)
- **[técnico] Eventos:** REFERRAL_RESULT_RECORDED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0023 (nova linha por atualização, nunca sobrescreve)
- **[técnico] Fase:** Fase 3 (TD §5)

### USP-039 — Visão consolidada da Pessoa

- **Upstream:** USP-001, USP-009, USP-010, USP-011, USP-012, USP-025, USP-029, USP-033, USP-036, USP-037, USP-038
- **Downstream:** —
- **ADRs:** ADR-0008, ADR-0011, ADR-0016, ADR-0017
- **Métricas:** — (instrumento de gestão, não vetor de métrica direta)
- **Riscos:** RP-002 (sem DPO, acesso amplo a dado sensível é desconfortável); risco proposto: visão consolidada exposta acidentalmente a usuário não autorizado
- **Deps/Q-abertas:** D-001
- **[técnico] Schemas:** persons, ficha_social, applications, referrals, services, role_grants (consolidação) (TD §4.5)
- **[técnico] Endpoints:** `reporting.visaoConsolidada` (TD §4.4)
- **[técnico] Eventos:** CONSOLIDATED_VIEW_ACCESSED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-view-model-visibility, runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0022 (autorização centralizada por papel; coordenador não vê ficha social nem infere), ADR-0023, ADR-0025 (histórico preservado com flag de revogação)
- **[técnico] Fase:** Fase 3 (TD §5)

### USP-040 — Extração automática de CV via IA generativa

- **Upstream:** USP-009 (candidato anexa CV), USP-043 (consentimento "extração via IA")
- **Downstream:** USP-009 (pré-preenche), USP-025 (CV processado aparece na candidatura)
- **ADRs:** ADR-0010 (custo da API LLM), ADR-0013 (finalidade 7), ADR-0018
- **Métricas:** MP1 (acelera ativação de candidato)
- **Riscos:** RP-007 (CV ruim validado), RP-008 (LLM sem ZDR), RP-003 (termo cobrindo IA)
- **Deps/Q-abertas:** D-002, D-008, QP-002
- **[técnico] Schemas:** cv_files (Storage privado), content_items, consents (finalidade 7) (TD §4.5/§4.7)
- **[técnico] Endpoints:** porta `CVExtractor` (adapter Claude Haiku ZDR), job assíncrono (TD §4.4/§4.7)
- **[técnico] Eventos:** — (telemetria de custo/uso) (TD §4.6/§8.2)
- **[técnico] Runbooks:** runbook-consent-gate, runbook-server-action
- **[técnico] ADRs técnicos:** ADR-0027 (porta+ZDR+whitelist+flag+fallback), ADR-0028 (upload/whitelist), ADR-0029 (limite por candidato/dia)
- **[técnico] Fase:** Fase 2 (TD §5)

### USP-041 — Home pública com indicadores em tempo real

- **Upstream:** USP-009 (candidatos ativos), USP-012+USP-017 (empresas verificadas), USP-020+USP-016 (vagas ativas)
- **Downstream:** —
- **ADRs:** ADR-0010, ADR-0017 (indicadores são agregados — sem dado pessoal)
- **Métricas:** — (instrumento de comunicação)
- **Riscos:** RP-009 (cache crítico)
- **Deps/Q-abertas:** D-012, QP-004
- **[técnico] Schemas:** agregados sobre jobs/persons/companies (sem PII) (TD §4.5)
- **[técnico] Endpoints:** `reporting.indicadoresHome` (ISR + cache TTL 600s + revalidação on-demand) (TD §4.4)
- **[técnico] Eventos:** — (TD §4.6)
- **[técnico] Runbooks:** runbook-view-model-visibility (só agregados), runbook-search-pagination
- **[técnico] ADRs técnicos:** ADR-0022 (sem PII), ADR-0026 (consistência on-read), ADR-0019 (ISR/CDN)
- **[técnico] Fase:** Fase 3 (TD §5)

### USP-042 — Relatórios operacionais do Portal

- **Upstream:** todas as USPs operacionais (vagas, candidaturas, serviços, encaminhamentos, moderação)
- **Downstream:** —
- **ADRs:** ADR-0008, ADR-0017
- **Métricas:** MP1–MP10 (consolidação para gestão e prestação de contas)
- **Riscos:** RP-002 (relatórios com dado pessoal sem DPO designado)
- **Deps/Q-abertas:** D-001, D-005, QP-005
- **[técnico] Schemas:** queries agregadas sobre todas as entidades operacionais; audit_log (export) (TD §4.5)
- **[técnico] Endpoints:** `reporting.relatorio`, `reporting.exportar` (CSV/PDF) (TD §4.4)
- **[técnico] Eventos:** REPORT_EXPORTED (audit, com escopo de PII) (TD §4.6)
- **[técnico] Runbooks:** runbook-view-model-visibility, runbook-search-pagination (pré-agregação), runbook-audit-log
- **[técnico] ADRs técnicos:** ADR-0022 (ficha social fora dos relatórios do coordenador), ADR-0023 (export auditado)
- **[técnico] Fase:** Fase 3 (TD §5)

### USP-043 — Consentimentos LGPD por finalidade

- **Upstream:** —
- **Downstream:** USP-001, USP-006, USP-009, USP-010, USP-011, USP-012, USP-025, USP-033, USP-036, USP-037, USP-040 (toda ativação de papel ou finalidade nova)
- **ADRs:** ADR-0008 (retenção do registro de consentimento), ADR-0013
- **Métricas:** — (transversal)
- **Riscos:** RP-002, RP-003 (depende dos termos por finalidade)
- **Deps/Q-abertas:** D-001, D-002
- **[técnico] Schemas:** consents (APPEND-ONLY, REVOKE UPDATE/DELETE, hash, cripto), revocation_cascade_matrix (TD §4.5)
- **[técnico] Endpoints:** `consents.aceitarConsentimento`, `consents.listarConsentimentos`, `consents.revogarConsentimento` (TD §4.4)
- **[técnico] Eventos:** CONSENT_GIVEN, CONSENT_REVOKED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-consent-gate, runbook-audit-log, runbook-server-action
- **[técnico] ADRs técnicos:** ADR-0023 (append-only+hash), ADR-0025 (cascata + on-read; semântica a definir pela DPO), ADR-0020
- **[técnico] Fase:** Fase 1 (TD §5)

### USP-044 — Notificações por e-mail em eventos do portal

- **Upstream:** USP-001 (boas-vindas), USP-005 (recuperação de senha), USP-016 (decisão de moderação), USP-025 (confirmação candidatura), USP-033 (manifestação), USP-037 (encaminhamento), USP-024 (expiração próxima), USP-009 (lembrete de CV desatualizado)
- **Downstream:** —
- **ADRs:** ADR-0010 (custo do provedor SMTP)
- **Métricas:** — (transversal)
- **Riscos:** Risco proposto: e-mails caem em spam (mitigado por SPF/DKIM/DMARC — decisão técnica do Arquiteto); risco proposto: vazamento de dado pessoal em corpo de e-mail mal projetado
- **Deps/Q-abertas:** —
- **[técnico] Schemas:** outbox (status, tentativas) (TD §4.5)
- **[técnico] Endpoints:** `POST /api/cron/dispatch-outbox` (worker) + mailer adapter (TD §4.4/§4.7)
- **[técnico] Eventos:** email.* (8 tipos do catálogo de outbox) (TD §4.6)
- **[técnico] Runbooks:** runbook-audit-log (só metadado de envio)
- **[técnico] ADRs técnicos:** ADR-0020 (outbox post-commit, cancela órfãos), ADR-0028 (minimização de PII no corpo), ADR-0029 (SPF/DKIM/DMARC, quota); SMTP escolhido em ADR-0019
- **[técnico] Fase:** Fase 1 (parcial) + Fase 3 (TD §5)

### USP-045 — Reativar Pessoa (fluxo inverso da USP-007)

> Criada na fase de arquitetura (2026-05-29). Fluxo inverso da USP-007. **ICE gerado (2026-05-31):** [intent](intents/intent-USP-045.md) · [expectations](expectations/expectations-USP-045.md).

- **Upstream:** USP-007 (Pessoa precisa estar inativada)
- **Downstream:** USP-004 (volta a poder logar)
- **ADRs:** ADR-0008 (histórico preservado), ADR-0011
- **Métricas:** —
- **Riscos:** Risco proposto: reativação restaurar permissões antigas indevidamente (mitigado: volta zerada — ADR-0030); reativação por usuário com permissão inferior à do inativador
- **Deps/Q-abertas:** semântica de re-aceite dos consentimentos suspensos a confirmar com a DPO (Angélica)
- **[técnico] Schemas:** persons (status→ativo), permission_grants (não restaura — zerado), consents (suspenso→re-aceite), audit_log (TD §4.5)
- **[técnico] Endpoints:** `persons.reativarPessoa` (TD §4.4)
- **[técnico] Eventos:** PERSON_REACTIVATED (audit) (TD §4.6)
- **[técnico] Runbooks:** runbook-server-action, runbook-audit-log, runbook-consent-gate
- **[técnico] ADRs técnicos:** ADR-0030 (volta sem grants; reativador ≥ inativador), ADR-0023, ADR-0025 (re-aceite de consentimento)
- **[técnico] Fase:** Fase 1 (TD §5)

---

## Seção 3 — Lookups inversos

### 3.1 ADR → USPs

> ADRs de **negócio** (0001–0018) preservados do esqueleto; ADRs **técnicos** (0019–0030) adicionados pela architecture-planning.

| ADR | Título | USPs que referenciam |
|---|---|---|
| ADR-0001 | Delegação granular de permissões (estendido para Portal) | USP-008, USP-016, USP-017, USP-018, USP-019, USP-037, USP-038 |
| ADR-0008 | Retenção indefinida e direito de acesso (estendido) | USP-007, USP-036, USP-039, USP-042, USP-043 |
| ADR-0010 | Custo mínimo como diretriz arquitetural | USP-001, USP-002, USP-003, USP-004, USP-005, USP-007, USP-008, USP-019, USP-024, USP-040, USP-041, USP-044 (transversal — toda USP herda) |
| ADR-0011 | Pessoa como entidade fundamental, login único e papéis compostos | USP-001, USP-002, USP-003, USP-006, USP-007, USP-009, USP-010, USP-011, USP-012, USP-033, USP-036, USP-037, USP-039, USP-043 |
| ADR-0012 | Beneficiário como papel social da Pessoa | USP-036 |
| ADR-0013 | Consentimentos LGPD por finalidade | USP-001, USP-006, USP-009, USP-010, USP-011, USP-012, USP-025, USP-033, USP-036, USP-037, USP-040, USP-043 |
| ADR-0014 | Empresa sem login próprio, com Pessoas-responsáveis (N:N) | USP-012, USP-013, USP-014, USP-015, USP-017, USP-020, USP-027, USP-028, USP-029 |
| ADR-0015 | Moderação humana pré-publicação | USP-009, USP-015, USP-016, USP-017, USP-018, USP-020, USP-021, USP-022, USP-023, USP-024, USP-029, USP-030, USP-031, USP-032 |
| ADR-0016 | Encaminhamento como entidade do domínio social | USP-027, USP-037, USP-038, USP-039 |
| ADR-0017 | Visibilidade conservadora de dados pessoais entre papéis | USP-001, USP-002, USP-003, USP-013, USP-021, USP-022, USP-025, USP-026, USP-027, USP-028, USP-030, USP-031, USP-033, USP-034, USP-035, USP-036, USP-039, USP-041, USP-042 |
| ADR-0018 | Extração de CV via IA generativa | USP-009, USP-040 |
| **ADR-0019** | **Stack, plataforma e ambientes (custo mínimo)** | transversal; em especial USP-021, USP-024, USP-030, USP-041, USP-044 |
| **ADR-0020** | **Atomicidade transacional e outbox** | USP-001, USP-006, USP-009, USP-010, USP-011, USP-012, USP-013, USP-015, USP-025, USP-033, USP-037, USP-043, USP-044 |
| **ADR-0021** | **Unicidade sob concorrência (UNIQUE + 409)** | USP-001, USP-003, USP-012, USP-013, USP-025, USP-026, USP-033 |
| **ADR-0022** | **Visibilidade por View Models e anonimização** | USP-002, USP-013, USP-021, USP-022, USP-027, USP-028, USP-030, USP-031, USP-035, USP-036, USP-039, USP-041, USP-042 |
| **ADR-0023** | **Log append-only (auditoria + consentimentos)** | USP-001–008, USP-012, USP-014, USP-015, USP-016, USP-017, USP-018, USP-019, USP-025, USP-026, USP-033, USP-034, USP-036, USP-037, USP-038, USP-039, USP-042, USP-043 |
| **ADR-0024** | **Máquina de estados de moderação** | USP-009, USP-015, USP-016, USP-017, USP-018, USP-019, USP-020, USP-023, USP-029, USP-032 |
| **ADR-0025** | **Cascata de revogação de consentimento** | USP-006, USP-007, USP-025, USP-026, USP-030, USP-033, USP-034, USP-037, USP-039, USP-043 |
| **ADR-0026** | **Expiração on-read + job + observabilidade** | USP-021, USP-022, USP-024, USP-030, USP-041 |
| **ADR-0027** | **Porta CVExtractor + LLM ZDR + whitelist** | USP-009, USP-040 |
| **ADR-0028** | **Sanitização de PII (texto livre + upload)** | USP-009, USP-020, USP-021, USP-022, USP-027, USP-028, USP-029, USP-031, USP-036, USP-040, USP-044 |
| **ADR-0029** | **Anti-abuso (rate limit + CAPTCHA + lockout)** | USP-001, USP-003, USP-004, USP-005, USP-013, USP-025, USP-028, USP-033, USP-037, USP-040, USP-044 |
| **ADR-0030** | **Revalidação de status/permissão por requisição** | USP-002, USP-004, USP-005, USP-007, USP-008, USP-014, USP-045 |
| **ADR-0031** | **CNPJ MEI do prestador PF em `companies` (via USP-012) + regime tributário em `CompanyType`** | USP-010, USP-012, USP-027, USP-030 |

### 3.2 Risco → USPs

| Risco | USPs vetoras |
|---|---|
| RP-001 — Escopo > orçamento | Meta-risco; sem USP-vetor (acompanhamento via processo de estimativa fina) |
| RP-002 — DPO não designado a tempo | USP-036, USP-037, USP-039, USP-042, USP-043; bloqueia também USP-007 (atender pedido de inativação por titular) |
| RP-003 — Termos de consentimento por finalidade não revisados a tempo | USP-001, USP-006, USP-009, USP-010, USP-011, USP-012, USP-025, USP-033, USP-036, USP-037, USP-040, USP-043 |
| RP-004 — Carga de moderação inviabiliza operação | USP-016 (principal), USP-008 (mitigação via delegação) |
| RP-005 — Empresa-fantasma escapa da moderação manual | USP-012 (entrada), USP-015 (vetor pós-verificação), USP-017 (defesa principal), USP-020 |
| RP-006 — Adesão baixa | Meta-risco; sem USP-vetor direta |
| RP-007 — Extração de CV gera dados ruins e candidato valida sem revisar | USP-040 (principal), USP-009 (pré-preenchimento), USP-025/USP-027 (efeito visível para Empresa) |
| RP-008 — Uso de LLM com retenção inadequada afeta LGPD | USP-040 (principal), USP-009 (indireto) |
| RP-009 — Volume de tráfego anônimo excede expectativa em pico | USP-021, USP-022, USP-030, USP-031, USP-041 |
| RP-010 — Ausência de fluxo formal de denúncia atrasa resposta | USP-018 (escape válve), USP-016 (modo proativo) |
| RP-011 — Sponsor não designado a tempo do kickoff | Meta-risco |

### 3.3 Dependência → USPs (em produção)

| Dep | Owner | USPs bloqueadas |
|---|---|---|
| D-001 — Designação formal do DPO | Diretoria ASONSEG | **RESOLVIDO (2026-05-29): diretora Angélica designada DPO.** Desbloqueia USP-036, 037, 039, 042, 043 e USP-007 (inativação por titular) — agora condicionadas só a D-002 |
| D-002 — Termos de consentimento por finalidade e revisão jurídica | Diretoria + jurídico | **RESOLVIDO (2026-06-03):** os 8 termos revisados e aprovados (`status: aprovado`); hashes revalidados no `TERMS_REGISTRY` (PR #249). Registro em `docs/lgpd/dpo.md`. Desbloqueia: USP-001, 006, 009, 010, 011, 012, 025, 033, 036, 037, 040, 043 |
| D-003 — Designação do sponsor | Diretoria ASONSEG | Bloqueante de kickoff — sem USP específica |
| D-004 — Metas concretas para MP1–MP10 | Sponsor + Bravi PO | Não bloqueia código; bloqueia avaliação de sucesso |
| D-005 — Refinamento de filtros/agrupamentos dos relatórios | Bravi PO + diretoria | USP-042 |
| D-006 — Revisão final do catálogo de permissões delegáveis | Bravi PO + coordenador | USP-008 |
| D-007 — Cadastro inicial de categorias/áreas/regiões | Diretoria ASONSEG | USP-019, USP-020, USP-029 |
| D-008 — Escolha do provedor de IA generativa | Bravi Arquiteto | USP-040 — **RESOLVIDO:** Anthropic Claude Haiku (ZDR) — ADR-0027 (resta confirmar contrato ZDR) |
| D-009 — Escolha do provedor de CAPTCHA | Bravi Arquiteto | USP-001 — **RESOLVIDO:** Cloudflare Turnstile — ADR-0029 |
| D-010 — Estimativa fina pelo Tech Lead | Bravi Tech Lead | Bloqueante de orçamento — sem USP específica |
| D-011 — Meios de verificação para reivindicação de credencial | Diretoria + Bravi PO | USP-003 — **RESOLVIDO (2026-05-29):** verificação **manual pela assistente social** |
| D-012 — Política de cache dos indicadores em tempo real | Bravi Arquiteto | USP-041 — **RESOLVIDO (2026-05-29):** TTL 600s + revalidação on-demand — ADR-0019/0026 |

### 3.4 Q-aberta → USPs

| Q-aberta | USPs afetadas |
|---|---|
| QP-001 — Meios de verificação para reivindicação | USP-003 — **RESOLVIDO:** verificação manual pela assistente social |
| QP-002 — Provedor IA | USP-009, USP-040 — **RESOLVIDO:** Anthropic Claude Haiku ZDR (ADR-0027) |
| QP-003 — Provedor CAPTCHA | USP-001 — **RESOLVIDO:** Cloudflare Turnstile (ADR-0029) |
| QP-004 — Política de cache | USP-041 — **RESOLVIDO:** TTL 600s + revalidação on-demand (ADR-0019/0026) |
| QP-005 — Detalhamento dos relatórios | USP-042 |
| QP-006 — Revisão final do catálogo de permissões | USP-008 |
| QP-007 — Metas MP1–MP10 | USP-009, USP-012, USP-016, USP-025, USP-029, USP-033, USP-037, USP-038 (toda USP que vetoriza métrica) |
| QP-008 — Política de retenção de logs operacionais | USP-042 (indireto); transversal — **RESOLVIDO:** 2 anos (audit_log/consents seguem retenção indefinida — ADR-0008) |
| QP-009 — Estratégia de divulgação inicial | USP-021, USP-030, USP-041 (carga de tráfego) |
| QP-010 — Lista inicial de regiões/categorias/áreas | USP-019, USP-020, USP-029 |

### 3.5 Métrica → USPs

| Métrica | USPs que contribuem |
|---|---|
| MP1 — Candidatos com perfil ativo (moderado) | USP-001 (entrada), USP-006, USP-009 (principal), USP-016 (aprova), USP-040 (acelera) |
| MP2 — Empresas verificadas | USP-001 (entrada), USP-006, USP-012 (entrada), USP-017 (verifica) |
| MP3 — Prestadores ativos com ≥ 1 serviço aprovado | USP-001, USP-006, USP-010, USP-016 (aprova serviço), USP-029 |
| MP4 — Vagas publicadas e aprovadas | USP-020 (publica), USP-016 (aprova) |
| MP5 — Serviços publicados e aprovados | USP-029, USP-016 |
| MP6 — Candidaturas realizadas | USP-025 |
| MP7 — Manifestações de interesse em serviços | USP-033, USP-035 (indireto) |
| MP8 — Encaminhamentos ASONSEG criados | USP-037 |
| MP9 — % de encaminhamentos com resultado positivo registrado | USP-038 |
| MP10 — Tempo médio de moderação | USP-016 |

### 3.6 Runbook → USPs (lookup técnico, novo)

| Runbook | USPs que usam |
|---|---|
| runbook-server-action | USP-001, 002, 003, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 019, 020, 023, 025, 026, 029, 032, 033, 034, 036, 037, 038, 040, 043, 045 (toda mutação sensível) |
| runbook-consent-gate | USP-001, 003, 006, 009, 010, 011, 012, 025, 029, 033, 036, 037, 040, 043, 045 |
| runbook-audit-log | USP-001–008, 012, 014, 015, 016, 017, 018, 019, 025, 026, 033, 034, 036, 037, 038, 039, 042, 043, 044, 045 (quase toda escrita) |
| runbook-moderation-transition | USP-009, 016, 017, 018, 019, 020, 023, 029, 032 |
| runbook-view-model-visibility | USP-002, 013, 021, 022, 027, 028, 030, 031, 035, 036, 039, 041, 042 |
| runbook-rate-limit-anti-abuse | USP-001, 003, 004, 005, 013, 025, 028, 033, 037, 040 |
| runbook-search-pagination | USP-020, 021, 022, 024, 028, 030, 041, 042 |

### 3.7 Status dos ❓ técnicos e arquiteturais-estruturais (entrevista architecture-planning)

| ❓ (origem) | Classificação | Status |
|---|---|---|
| Atomicidade (USP-001/006/011/012/013/025/029/033/037) | arq-estrutural | **Resolvido** → ADR-0020 |
| Unicidade sob concorrência (USP-001/F1) | arq-estrutural | **Resolvido** → ADR-0021 |
| Invalidação de sessão na inativação (USP-007/F1) | arq-estrutural | **Resolvido** → ADR-0030 |
| CNPJ MEI do prestador PF (USP-010/F1) | arq-estrutural | **Revisto (2026-06-10)** → CNPJ MEI em `companies` via fluxo USP-012 + regime tributário em `CompanyType` (**ADR-0031**). Supersede "atributo da Pessoa/papel"; reverte P-001/P-002 da USP-010 |
| Detecção de vaga duplicada (USP-020/F3) | arq-estrutural | **Resolvido** → ADR-0021 (dedup + 409) |
| Sanitização na serialização (USP-022/F2, USP-028/F2, USP-031/F1) | arq-estrutural | **Resolvido** → ADR-0022 + ADR-0028 |
| Expiração on-read (USP-024/F1) | arq-estrutural | **Resolvido** → ADR-0026 |
| Guard centralizado de campos sensíveis (USP-036/F3, USP-039/F1) | arq-estrutural | **Resolvido** → ADR-0022 |
| Prompt restritivo + whitelist do LLM (USP-040/F6) | arq-estrutural | **Resolvido** → ADR-0027 |
| Cascata de revogação (USP-043/F2) | arq-estrutural | **Mecanismo resolvido** → ADR-0025; **semântica: owner confirmado** (DPO Angélica + jurídico), a definir antes da USP-043 |
| Log append-only de consentimentos (USP-043/F7) | arq-estrutural | **Resolvido** → ADR-0023 |
| E-mail post-commit/assíncrono (USP-044/F3) | arq-estrutural | **Resolvido** → ADR-0020 (outbox) |
| Cost factor bcrypt (USP-001) | técnico | **Resolvido** → bcrypt cost 10 via Supabase Auth, não configurável pela app (TD §7) |
| Provedor CAPTCHA (USP-001) | técnico | **Resolvido** → Turnstile (ADR-0029) |
| Bloqueio por e-mail/IP, lockout (USP-004/F1) | técnico | **Resolvido** → ADR-0029 (chave combinada) |
| Verificação de status por request (USP-004/F4) | técnico | **Resolvido** → ADR-0030 |
| Tempo de resposta uniforme (USP-005/F2) | técnico | **Resolvido** → ADR-0029 (timing normalizado) |
| Sanitização de upload (USP-009/F4) | técnico | **Resolvido** → ADR-0028 (magic bytes/AV) |
| Provedor IA / ZDR (USP-009/F2, USP-040/F2) | técnico | **Resolvido** → Claude Haiku ZDR (ADR-0027) — confirmar contrato |
| Stemming na busca (USP-021/F3) | técnico | **Decisão MVP:** match exato sem acento (FTS/semântica → V2) — runbook-search-pagination |
| Timezone job/banco (USP-024/F2) | técnico | **Resolvido** → ADR-0026 (date-fns-tz) |
| Política de invalidação consistente (USP-030/F4) | técnico | **Resolvido** → ADR-0025 (on-read) |
| Estratégia query/cache consolidação (USP-039/F4) | técnico | **Resolvido** → View Models + query dedicada (TD §4.4) |
| TTL do cache da home (USP-041/F2) | técnico | **Resolvido:** TTL 600s + revalidação on-demand (ADR-0019/0026) |
| Cache/CDN (USP-041/F3) | técnico | **Resolvido** → ISR Vercel (ADR-0019) |
| Pré-agregação de relatórios (USP-042/F5) | técnico | **Resolvido** → pré-agregação/paginação (TD §4.4, runbook-search-pagination) |
| SPF/DKIM/DMARC + bounce (USP-044/F1, F5) | técnico | **Resolvido** → ADR-0029 + ADR-0019 (SMTP) |

> Os ❓ `(dono do intent)` **não foram respondidos aqui** — pertencem ao sponsor/AS/diretoria/coordenador/jurídico/DPO. Os que **bloqueiam** USPs específicas estão no hand-off (encaminhar via PO). Os demais são refinamentos de UX/operação para as fases de design/implementação.

---

## Seção 4 — Views derivadas

### 4.1 USPs de alta concentração de risco

USPs que tocam ≥ 3 ADRs **ou** ≥ 2 riscos **ou** ≥ 2 dependências bloqueantes. Onde priorizar análise prévia (gate humano denso na revisão). *(Coluna técnica adicionada: quantos ADRs técnicos a USP também concentra.)*

| USP | Razão da alta concentração (negócio) | ADRs técnicos concentrados |
|---|---|---|
| USP-001 | 4 ADRs (0010, 0011, 0013, 0017); 2 riscos (RP-003, RP-008 indireto); 2 deps (D-002, D-009) | 0020, 0021, 0023, 0029 (4) |
| USP-009 | 5 ADRs (0011, 0013, 0015, 0017, 0018); 3 riscos (RP-003, RP-007, RP-008); 2 deps (D-002, D-008) | 0020, 0023, 0024, 0027, 0028 (5) |
| USP-012 | 3 ADRs (0011, 0013, 0014); 1 risco crítico (RP-005); 1 dep (D-002) | 0020, 0021, 0023 (3) |
| USP-016 | 2 ADRs (0001, 0015); 3 riscos (RP-004, RP-005, RP-010); 1 dep (D-006) | 0024, 0023, 0020 (3) |
| USP-017 | 2 ADRs (0014, 0015); 1 risco crítico principal (RP-005) | 0024, 0023, 0020 (3) |
| USP-020 | 2 ADRs (0014, 0015); 1 risco crítico (RP-005); 1 dep (D-007) | 0024, 0021, 0028 (3) |
| USP-025 | 2 ADRs (0013, 0017); 1 risco (RP-008 indireto); 1 dep (D-002) | 0020, 0021, 0023, 0025, 0029 (5) |
| USP-036 | 4 ADRs (0011, 0012, 0013, 0017); 2 riscos (RP-002, RP-003); 2 deps (D-001, D-002) | 0022, 0023, 0028 (3) |
| USP-037 | 5 ADRs (0001, 0011, 0013, 0016, 0017); 2 riscos (RP-002, RP-003); 2 deps (D-001, D-002) | 0020, 0023, 0025, 0029 (4) |
| USP-039 | 4 ADRs (0008, 0011, 0016, 0017); 1 risco (RP-002); 1 dep (D-001) | 0022, 0023, 0025 (3) |
| USP-040 | 3 ADRs (0010, 0013, 0018); 3 riscos (RP-003, RP-007, RP-008); 2 deps (D-002, D-008) | 0027, 0028, 0029 (3) |
| USP-042 | 2 ADRs (0008, 0017); 1 risco (RP-002); 3 deps (D-001, D-005, QP-005) | 0022, 0023 (2) |
| USP-043 | 2 ADRs (0008, 0013); 2 riscos (RP-002, RP-003); 2 deps (D-001, D-002) | 0023, 0025, 0020 (3) |

### 4.2 USPs fundacionais

Quem é upstream de muita coisa — mexer dói. Mudança de design dessas USPs tem alto blast radius.

| USP | Por que é fundacional |
|---|---|
| USP-001 | Entrada de qualquer Pessoa pública — porta única do sistema |
| USP-004 | Sem login, nenhuma USP autenticada existe |
| USP-008 | Sem delegação de permissões, USP-016/USP-017/USP-018/USP-037 viram gargalo no coordenador |
| USP-012 | Sem Empresa, não há vaga, busca de candidato, serviço por PJ |
| USP-016 | Sem moderação, conteúdo não chega a ser ativo — bloqueia visibilidade de tudo |
| USP-043 | Sem consentimento por finalidade, nenhum papel pode ser ativado sob LGPD |

### 4.3 USPs bloqueadas em produção por decisão pendente (gate humano)

USPs cujo expectations file marca gate explícito — código pronto não basta. Lista mais útil para sponsor.

> **Atualização 2026-05-29:** **D-001 (DPO) resolvido** — diretora Angélica designada DPO; **D-011/QP-001 (verificação de identidade) resolvido** — manual pela AS; **D-012/QP-004 (cache) resolvido** — TTL 600s; **checklists de Fase 0 validadas**. Resta **D-002** (8 termos — em redação/aprovação na Fase 0, antes da USP-043) e a **definição da semântica da cascata** pela DPO. As linhas abaixo registram o gate original; os que dependiam só de D-001/D-011/D-012/checklists já estão liberados.
>
> **Atualização 2026-06-03:** **D-002 resolvido** — os 8 termos de consentimento foram revisados e aprovados (`status: aprovado`), com hashes revalidados no `TERMS_REGISTRY` (PR #249; registro em `docs/lgpd/dpo.md`). Resta apenas a **semântica da cascata de revogação**: há um **draft** em `docs/lgpd/cascata-revogacao-semantica.md` aguardando DPO (Angélica) + jurídico, que vira adendo ao ADR-0025. Gates que dependiam só de D-002 já estão liberados.

| USP | Gate | Responsável |
|---|---|---|
| USP-001 | D-002 (termo "cadastro e autenticação") + D-009 (CAPTCHA — resolvido: Turnstile) | Diretoria + jurídico + Arquiteto |
| USP-003 | ✅ D-011 + QP-001 **RESOLVIDO** — verificação manual pela assistente social | Diretoria + AS |
| USP-009 | D-002 (termo "candidatura a vagas") + D-008 (ZDR — resolvido: Claude Haiku, confirmar contrato) | Diretoria + jurídico + Arquiteto |
| USP-010 | D-002 (termo "oferta de serviço") | Diretoria + jurídico |
| USP-011 | D-002 (termo "contratação de serviço") | Diretoria + jurídico |
| USP-012 | D-002 (termo "representação de empresa") | Diretoria + jurídico |
| USP-017 | Checklist de verificação de Empresa (entregável Fase 0) | Coordenador do Portal + Bravi PO |
| USP-020 | D-007 + checklist de conformidade legal de vaga (Fase 0) | Coordenador + jurídico |
| USP-029 | D-007 + checklist de serviços proibidos + D-002 (finalidade 3) | Coordenador + jurídico |
| USP-033 | D-002 (termo "contratação de serviço") | Diretoria + jurídico |
| USP-036 | D-001 (DPO) + D-002 (termo "atendimento social") | Diretoria |
| USP-037 | D-001 (DPO) + D-002 (termo "encaminhamento institucional" cobrindo finalidade 8 do ADR-0013) | Diretoria + jurídico |
| USP-039 | D-001 (DPO) | Diretoria |
| USP-040 | D-002 (termo "extração via IA") + D-008 (provedor com ZDR confirmado) + QP-002 | Diretoria + jurídico + Arquiteto |
| USP-042 | D-001 (DPO) + D-005 (refinamento dos relatórios) | Diretoria + Bravi PO |
| USP-043 | D-001 (DPO) + D-002 (todos os termos) + semântica da cascata de revogação | Diretoria + jurídico + DPO |

---

## Notas finais sobre a matriz

Esta matriz foi **enriquecida** (não recriada) pela skill `architecture-planning-idsd`: preserva integralmente as colunas de negócio do esqueleto da `po-bravi-idsd` (USPs, ADRs de negócio, métricas, riscos, dependências, Q-abertas e relações) e adiciona as **colunas técnicas** (Schemas, Endpoints, Eventos, Runbooks, ADRs técnicos, Fase) que apontam para o `technical-design.md` em `../architecture/`. A matriz **indexa o TD; não o substitui** — o conteúdo detalhado continua no TD, consumível por-USP.

Os **ADRs técnicos 0019–0030** continuam a numeração dos ADRs de negócio (0001–0018), compartilhando o mesmo espaço. Cada ADR técnico lista, na seção Referências, as USPs que serve — fechando o loop com a Seção 3.1.

**Atualização 2026-05-29 (resolução de pendências pelo PO/diretoria):** ACs de login (USP-004) **validados**; **USP-045 (Reativar Pessoa) criada** (fluxo inverso da USP-007); D-001/DPO **resolvido** (diretora Angélica); D-011/QP-001 (verificação de identidade) **resolvido** (manual pela AS); D-012/QP-004 (cache) **resolvido** (TTL 600s + on-demand); QP-008 (retenção de logs) **resolvido** (2 anos); checklists de Fase 0 **validadas**. Permanecem: **D-002** (8 termos — redação/aprovação na Fase 0, antes da USP-043) e a **semântica da cascata de revogação** (owner confirmado: DPO Angélica + jurídico). Riscos "(proposto)" seguem para o CHANGELOG do PRD (v0.4); a USP-045 precisa de intent/expectations gerados pela `po-bravi-idsd`.
