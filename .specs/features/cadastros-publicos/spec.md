# Cadastros Públicos Specification

## Problem Statement

Uma Pessoa autenticada no Portal ASONSEG precisa ativar os papéis que viabilizam sua participação na rede de empregabilidade e serviços (candidato, prestador de serviço, cliente de serviço) e, quando aplicável, cadastrar uma Empresa em cujo nome possa publicar vagas e serviços. Hoje não existe um fluxo unificado que (a) ative cada papel com a coleta de consentimento LGPD por finalidade, (b) respeite os diferentes níveis de atrito de cada papel (do mais leve — cliente — ao mais formal — candidato com moderação), e (c) trate a Empresa como entidade sem login próprio, operada por uma Pessoa-responsável, com validação de CNPJ e marca de "não verificada" até a primeira vaga aprovada. A ausência desse fluxo impede que o portal cumpra seu propósito social de conectar pessoas a oportunidades de trabalho e serviços de forma legalmente conforme.

## Goals

- [ ] Permitir que uma Pessoa autenticada ative o papel de **candidato** preenchendo dados pessoais, qualificações e (opcionalmente) anexando currículo, com fluxo de moderação até ficar visível em buscas.
- [ ] Permitir que uma Pessoa autenticada ative o papel de **prestador de serviço PF** de forma imediata, sem moderação.
- [ ] Permitir que uma Pessoa autenticada ative o papel de **cliente de serviço** automaticamente, sem formulário extra, na primeira manifestação de interesse.
- [ ] Permitir que uma Pessoa autenticada **cadastre uma Empresa** (CNPJ regular ou MEI), tornando-se Pessoa-responsável, com validação de dígito verificador do CNPJ, bloqueio de duplicidade e marca "não verificada" até a aprovação da primeira vaga.
- [ ] Coletar e registrar **consentimento LGPD por finalidade** em cada ativação de papel/cadastro (`PORTAL_ACCESS` + a finalidade específica do papel).

## Out of Scope

| Feature | Reason |
|---|---|
| Cadastro/login inicial da Pessoa (conta) | Pertence ao Épico 1 (Identidade e Acesso), USP-001 a USP-008. |
| Extração de CV por IA (detalhe do fluxo) | Especificado em USP-040 (cv-extraction); aqui apenas a invocação no cadastro de candidato. |
| Adicionar responsável adicional a uma Empresa | Pertence ao Épico 3 (Vínculos Pessoa-Empresa), USP-013 a USP-015. |
| Moderação de perfil/CV (regras internas da fila) | Pertence ao módulo de moderação (USP de moderação); aqui apenas a transição "enviar para moderação". |
| Validação manual da Empresa na moderação da 1ª vaga | Detalhada em USP-019 (jobs); aqui apenas a marca inicial "não verificada". |
| i18n | Não há internacionalização no MVP (apenas PT-BR). |

## User Stories

### P1: Cadastro de candidato (papel) ⭐ MVP

**User Story**: Como Pessoa autenticada, quero ativar o papel de candidato preenchendo dados pessoais, qualificações, escolaridade, áreas de interesse e (opcionalmente) anexando currículo, para que eu apareça nas buscas de empresas e possa me candidatar a vagas.

**Why P1**: É o papel central da finalidade de empregabilidade do portal; sem candidatos ativos e visíveis, empresas não têm a quem buscar. Marcado como Must no PRD.

**Acceptance Criteria**:
1. QUANDO a Pessoa submete o cadastro com escolaridade, área de interesse principal e telefone preenchidos ENTÃO o sistema DEVE ativar o papel de candidato com status "rascunho" para o conteúdo do perfil/CV.
2. QUANDO a Pessoa anexa CV (PDF, DOC ou DOCX até 5MB) ENTÃO o sistema DEVE invocar extração automática por IA generativa e pré-preencher campos estruturados para validação do usuário (ver USP-040).
3. QUANDO o candidato envia o perfil para moderação ENTÃO o sistema DEVE alterar o status para "em moderação" e enfileirar para o coordenador.
4. QUANDO o perfil é aprovado pelo coordenador ENTÃO o sistema DEVE ativar o candidato (visível na busca de empresas) e enviar e-mail ao candidato.
5. QUANDO a Pessoa ativa o papel de candidato ENTÃO o sistema DEVE registrar consentimento LGPD ativo para as finalidades `PORTAL_ACCESS` e `JOB_APPLICATION` (e `CV_AI_EXTRACTION` quando houver anexo de CV).

**Independent Test**: Autenticar uma Pessoa, preencher escolaridade, área de interesse principal e telefone, submeter, e verificar que o papel de candidato existe com status "rascunho"; enviar para moderação e verificar status "em moderação"; aprovar como coordenador e verificar visibilidade na busca + e-mail. Sem dependência das demais stories.

### P1: Cadastro de prestador de serviço (papel) ⭐ MVP

**User Story**: Como Pessoa autenticada, quero ativar o papel de prestador de serviço PF, para que eu possa publicar serviços em meu nome.

**Why P1**: Habilita a metade de "serviços" do portal; sem prestadores não há oferta de serviços. Marcado como Must no PRD.

**Acceptance Criteria**:
1. QUANDO a Pessoa solicita ativar o papel de prestador PF ENTÃO o sistema DEVE ativar o papel imediatamente.
2. QUANDO o prestador informa dados fiscais opcionais (CNPJ MEI próprio, se houver) ENTÃO o sistema DEVE permitir o registro sem que isso afete o tipo de cadastro (continua prestador PF).
3. QUANDO a Pessoa ativa o papel de prestador ENTÃO o sistema DEVE registrar consentimento LGPD ativo para as finalidades `PORTAL_ACCESS` e `SERVICE_OFFERING`.

**Independent Test**: Autenticar uma Pessoa, solicitar ativação do papel de prestador PF e verificar que o papel fica ativo imediatamente (sem moderação); opcionalmente informar CNPJ MEI e confirmar que o tipo permanece "prestador PF".

### P1: Cadastro de cliente de serviço (papel) ⭐ MVP

**User Story**: Como Pessoa autenticada, quero ativar o papel de cliente de serviço, para que eu possa manifestar interesse em serviços e ver os contatos dos prestadores.

**Why P1**: É o papel "mais leve" e a porta de entrada para a demanda por serviços; necessário para fechar o ciclo prestador↔cliente. Marcado como Must no PRD.

**Acceptance Criteria**:
1. QUANDO a Pessoa autenticada acessa a tela de um serviço e tenta manifestar interesse pela primeira vez ENTÃO o sistema DEVE ativar o papel de cliente automaticamente, sem formulário adicional.
2. QUANDO o papel de cliente é ativado automaticamente ENTÃO o sistema DEVE registrar consentimento LGPD ativo para as finalidades `PORTAL_ACCESS` e `SERVICE_HIRING`.

**Independent Test**: Autenticar uma Pessoa sem papel de cliente, abrir um serviço, clicar em "manifestar interesse" e verificar que o papel de cliente passa a existir sem qualquer formulário intermediário.

### P1: Cadastro de Empresa pela Pessoa-responsável ⭐ MVP

**User Story**: Como Pessoa autenticada, quero cadastrar uma Empresa (CNPJ — regular ou MEI) informando razão social, nome fantasia, setor, descrição e endereço, e tornar-me responsável dela, para que eu possa publicar vagas e serviços em nome dessa Empresa.

**Why P1**: A Empresa é a entidade que publica vagas e serviços formais; sem ela e seu vínculo de responsável não há oferta corporativa. Marcado como Must no PRD.

**Acceptance Criteria**:
1. QUANDO a Pessoa submete o cadastro de Empresa com CNPJ, razão social, nome fantasia e setor ENTÃO o sistema DEVE persistir a Empresa e criar o vínculo Pessoa↔Empresa com tipo "responsável" automaticamente.
2. QUANDO o CNPJ informado tem formato ou dígito verificador inválido ENTÃO o sistema DEVE bloquear o cadastro.
3. QUANDO o CNPJ informado já está cadastrado no portal ENTÃO o sistema DEVE bloquear o cadastro e oferecer fluxo de "solicitar inclusão como responsável" à Pessoa logada, notificando os responsáveis atuais da Empresa.
4. QUANDO a Empresa é criada ENTÃO o sistema DEVE marcá-la como "não verificada" até a aprovação da primeira vaga (validação manual pelo coordenador na moderação da primeira vaga — USP-019).
5. QUANDO a Pessoa cadastra uma Empresa e se torna responsável ENTÃO o sistema DEVE registrar consentimento LGPD ativo para as finalidades `PORTAL_ACCESS` e `COMPANY_REPRESENTATION`.

**Independent Test**: Autenticar uma Pessoa, submeter cadastro de Empresa com CNPJ válido + razão social + nome fantasia + setor, e verificar: Empresa persistida, vínculo "responsável" criado, flag "não verificada" presente; repetir com CNPJ de dígito inválido (bloqueio) e com CNPJ já existente (bloqueio + oferta de solicitação de inclusão).

## Edge Cases

- QUANDO a Pessoa tenta ativar candidato sem escolaridade, área de interesse principal ou telefone ENTÃO o sistema DEVE rejeitar a submissão indicando os campos obrigatórios faltantes (Zod).
- QUANDO o anexo de CV excede 5MB ou não é PDF/DOC/DOCX ENTÃO o sistema DEVE rejeitar o upload sem ativar a extração por IA.
- QUANDO a extração de CV por IA falha ENTÃO o sistema DEVE permitir o preenchimento manual dos campos sem bloquear o cadastro do candidato (ver USP-040).
- QUANDO a Pessoa já possui um papel ativo e tenta ativá-lo novamente ENTÃO o sistema DEVE tratar de forma idempotente, sem duplicar o papel nem o consentimento ativo.
- QUANDO a Pessoa não aceita o termo de consentimento da finalidade exigida ENTÃO o sistema DEVE bloquear a ativação do papel/cadastro.
- QUANDO o CNPJ é submetido com máscara, espaços ou pontuação ENTÃO o sistema DEVE normalizar antes de validar formato e dígito verificador.
- QUANDO a Pessoa tenta cadastrar Empresa estando não autenticada ENTÃO o sistema DEVE negar a operação (permissão exigida).
- QUANDO o prestador informa um CNPJ MEI com dígito verificador inválido nos dados fiscais opcionais ENTÃO o sistema DEVE rejeitar apenas esse campo, mantendo a ativação do papel de prestador PF possível.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| CAD-01 | USP-009 | Design | Pending |
| CAD-02 | USP-009 | Design | Pending |
| CAD-03 | USP-009 | Design | Pending |
| CAD-04 | USP-009 | Design | Pending |
| CAD-05 | USP-009 | Design | Pending |
| CAD-06 | USP-010 | Design | Pending |
| CAD-07 | USP-010 | Design | Pending |
| CAD-08 | USP-010 | Design | Pending |
| CAD-09 | USP-011 | Design | Pending |
| CAD-10 | USP-011 | Design | Pending |
| CAD-11 | USP-012 | Design | Pending |
| CAD-12 | USP-012 | Design | Pending |
| CAD-13 | USP-012 | Design | Pending |
| CAD-14 | USP-012 | Design | Pending |
| CAD-15 | USP-012 | Design | Pending |

## Success Criteria

- [ ] Uma Pessoa autenticada consegue ativar candidato (rascunho → em moderação → aprovado/visível) com e-mail de aprovação enviado.
- [ ] Uma Pessoa autenticada consegue ativar prestador PF imediatamente, com dados fiscais opcionais que não alteram o tipo.
- [ ] Uma Pessoa autenticada vira cliente automaticamente na primeira manifestação de interesse, sem formulário extra.
- [ ] Uma Pessoa autenticada consegue cadastrar Empresa com CNPJ válido, virando responsável, com Empresa marcada "não verificada".
- [ ] CNPJ com dígito inválido e CNPJ duplicado são bloqueados; o duplicado oferece "solicitar inclusão como responsável" e notifica os responsáveis atuais.
- [ ] Cada ativação de papel/cadastro registra consentimento LGPD ativo para `PORTAL_ACCESS` mais a finalidade específica (`JOB_APPLICATION`, `SERVICE_OFFERING`, `SERVICE_HIRING`, `COMPANY_REPRESENTATION`).
- [ ] Todas as escritas sensíveis ficam registradas no audit log e seguem o padrão de Server Action (Zod → permissão → consentimento → preconditions → withAudit).
