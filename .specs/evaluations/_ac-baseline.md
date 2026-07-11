# AC Baseline — Frozen Contract

**PRD:** `.specs/prd/prd.md` — *Portal Empregabilidade e Serviços — MVP Release 1* (ASONSEG), v0.3.
**Purpose:** single frozen decomposition every implementation of this PRD is scored against. Do not re-derive per run. One AC = one testable assertion; one check = one atomic yes/no proposition.

---

## Provenance & adaptations (read before scoring)

This baseline was produced with the `spec-baseline.md` skill, which was authored against a *different* benchmark PRD (a Stripe subscription-trial spec). That PRD's priority scheme (`P0/P1/P2`), its named stories (`Iniciar Teste`, `trialDays`…), its QA-clauses (QA-02/03/05) and its Stripe-webhook `T-outcome` / wiring-ingress hotspots **do not exist here** and were dropped. Only the skill's generic *method* was applied. The following adaptations were made and are frozen with the baseline:

1. **Priority → weight (MoSCoW, not P0/P1/P2).** This PRD labels every story `**Prioridade:** Must / Should / Could / Won't` (§9 Backlog MoSCoW). Mapping:
   - `Must` → **weight 3**
   - `Should` → **weight 2**
   - `Could` / `Won't (este release)` / anything in §3.2 *Out of Scope* → **weight 0** (listed, never scored; absence is not a defect).
   - No story is unlabeled, so no `ASSUMED` tags. In-scope: **42 Must (w3) + 2 Should (w2)** = 44 stories. Could/Won't: none.

2. **Check IDs.** The PRD already assigns AC IDs (`AC-001-1`…). Checks hang off them: `AC-001-1 · I1` (behavior check), `AC-001-1 · T` (test-level requirement).

3. **I-check (observable behavior).** One per distinct stated verb — *persistir / criar / ativar / bloquear / impedir / exibir / enviar / anonimizar / ocultar / alterar status / gerar / registrar-auditoria / validar*. Non-functional polish (WCAG, p95 latency, exact UI wording) is **not** a check — **except** anti-enumeration wording, which is a security behavior (e.g. `AC-004-2`, `AC-005-2`).

4. **Conjunction / payload-field rule — scope.** Each named field or entity in an **emitted / returned / persisted artifact** (email event, displayed record, persisted row the AC enumerates) is its **own** check. Applied to: displayed field enumerations (detail/list views), persisted legal records (consent row `AC-043-2`), and reveal/hide privacy fields. **Not** applied to required-*input* validation lists — a "form requires X, Y, Z" is one `valida campos obrigatórios` check.

5. **Audit log is a check here (unlike the source skill).** The source skill treated "logging" as polish. In this system the audit log is a first-class, append-only, legally-mandated **persisted artifact** (`withAudit`, immutable `audit_log`, ADR). So `registrar log (de auditoria)` stated in an AC → one I-check "evento auditado persistido" (not exploded into sub-fields).

6. **Authorization checks — selective.** A separate authz I-check is added only where role/permission restriction is the *point* of the AC (`AC-002-3`, `AC-003-3`, `AC-008-*`, `AC-036-3`, `AC-039-2`), not for every "authorized user does X".

7. **Privacy / RSC-Flight caveat (testing note on reveal/hide checks).** For every "anonimizar / ocultar até…" check, the T-e2e must assert the restricted value is **absent from the serialized payload** (Server-Component/Flight response), not merely hidden in the DOM. Loading a restricted field and hiding it client-side is a **fail**. (Project lesson: anonymizing only in the View Model is insufficient.)

8. **`T-outcome` (async fairness) mapping.** No Stripe webhooks exist here. The source skill's async-delivered-status fairness case maps to **scheduled/async effects**: `AC-024-1`, `AC-024-3` (expiry cron + T-3d email) and `AC-044-7`, `AC-044-8` (scheduled reminder emails). These are labeled `T-e2e (agendado)` and **must assert against real DB state / real inbox** (Mailpit), not a mock-only read.

9. **Email dispatched once.** Several emails appear both in a feature AC and again in the USP-044 catalog (welcome, reset, moderation decision, candidatura, manifestação, encaminhamento, expiração). This is **one observable**. Canonical home = the **feature AC**; USP-044 restates them as a catalog with `→ mesmo observável` cross-refs. Graders count the dispatch **once**.

10. **T-check level policy (fixed).** pure/business logic (validation, digit-check, uniqueness guard, state-machine rule, filter/normalization, date/tz, default value) → **unit** required. Observable HTTP/persistence side-effect (row persisted, status changed, email sent, contact revealed, list returned) → **e2e** required. Both apply → **both**. Labels used: `T-unit`, `T-e2e`, `T-e2e (agendado)`.

---

## Épico 1 — Identidade, Acesso e Papéis

### USP-001 — Auto-cadastro de Pessoa no portal (público) · Must · **w3**

**AC-001-1** — *WHEN o visitante submete o auto-cadastro com nome, CPF válido, e-mail e senha, the system SHALL persistir a Pessoa, criar a credencial e ativar o(s) papel(éis) público(s) escolhido(s).*
- I1: persiste a Pessoa · I2: cria a credencial de login · I3: ativa o(s) papel(éis) público(s) escolhido(s)
- T: `T-e2e`

**AC-001-2** — *IF o e-mail informado já está em uso por outra Pessoa, THEN the system SHALL bloquear o cadastro e informar o conflito.*
- I1: bloqueia cadastro com e-mail duplicado · I2: informa o conflito
- T: `T-unit` (unicidade de e-mail) + `T-e2e`

**AC-001-3** — *IF o CPF informado já está em uso por outra Pessoa, THEN the system SHALL bloquear o cadastro.*
- I1: bloqueia cadastro com CPF duplicado
- T: `T-unit` + `T-e2e`

**AC-001-4** — *IF o CPF tem formato/dígito verificador inválido, THEN the system SHALL bloquear o cadastro.*
- I1: bloqueia CPF com dígito verificador inválido
- T: `T-unit` (validação de dígito CPF) + `T-e2e`

**AC-001-5** — *The system SHALL exigir validação CAPTCHA no auto-cadastro.*
- I1: rejeita submit sem CAPTCHA válido
- T: `T-e2e`

**AC-001-6** — *WHEN o cadastro é concluído com sucesso, the system SHALL enviar e-mail de boas-vindas e registrar log de auditoria.*
- I1: envia e-mail de boas-vindas *(canônico; = AC-044-1)* · I2: registra log de auditoria do cadastro
- T: `T-e2e`

**AC-001-7** — *The system SHALL armazenar senhas com hash bcrypt (ou equivalente atual).*
- I1: senha persistida como hash bcrypt (nunca em texto plano)
- T: `T-unit` + `T-e2e`

### USP-002 — Cadastro de Pessoa pela assistente social (situação extrema) · Must · **w3**

**AC-002-1** — *WHEN a assistente social cadastra uma Pessoa, the system SHALL persistir com nome obrigatório e demais campos opcionais.*
- I1: persiste Pessoa apenas com nome (demais opcionais) · I2: nome é obrigatório (rejeita sem nome)
- T: `T-unit` + `T-e2e`

**AC-002-2** — *WHERE a assistente social marca "Pessoa sem documento — exceção", the system SHALL exigir justificativa textual obrigatória e gravar marca de exceção no cadastro.*
- I1: exige justificativa textual quando exceção marcada · I2: grava marca de exceção no cadastro
- T: `T-unit` + `T-e2e`

**AC-002-3** — *The system SHALL impedir auto-cadastro público de marcar exceção de CPF — apenas AS ou diretoria podem fazê-lo.*
- I1: bloqueia exceção de CPF no auto-cadastro público · I2: permite exceção apenas para AS/diretoria *(authz)*
- T: `T-unit` (regra de permissão) + `T-e2e`

**AC-002-4** — *WHEN o cadastro é sem credencial (e-mail e senha vazios), the system SHALL permitir que a Pessoa seja referenciada em encaminhamentos, ficha social e relatórios, mas SHALL impedir login dessa Pessoa.*
- I1: Pessoa sem credencial é referenciável (encaminhamento/ficha/relatório) · I2: impede login de Pessoa sem credencial
- T: `T-unit` (guard de login) + `T-e2e`

**AC-002-5** — *The system SHALL registrar log com responsável, data/hora e dados informados.*
- I1: registra log de auditoria do cadastro pela AS
- T: `T-e2e`

### USP-003 — Reivindicar credencial de Pessoa pré-cadastrada · Must · **w3**

**AC-003-1** — *WHEN o solicitante inicia o fluxo de reivindicação informando CPF (ou identificador alternativo da Pessoa sem CPF) e e-mail desejado, the system SHALL gerar uma solicitação pendente.*
- I1: gera solicitação de reivindicação com status pendente
- T: `T-e2e`

**AC-003-2** — *The system SHALL exigir verificação de identidade conforme processo definido pela ASONSEG (presencial na sede, código por carta, ou confirmação pela AS) antes de ativar a credencial.*
- I1: credencial permanece inativa até verificação concluída (gate-antes-de-ativar)
- T: `T-unit` (guard de estado) + `T-e2e`
- *Freeze:* o **meio concreto** de verificação é QP-001/D-011 em aberto → é configuração de processo, **não** um check de código. Só o gate-antes-de-ativar é graduável.

**AC-003-3** — *WHEN a verificação é confirmada pela AS ou diretoria, the system SHALL ativar a credencial e enviar e-mail de boas-vindas.*
- I1: ativa a credencial após confirmação · I2: envia e-mail de boas-vindas *(= AC-044-1)* · I3: confirmação restrita a AS/diretoria *(authz)*
- T: `T-unit` (authz) + `T-e2e`

**AC-003-4** — *IF o e-mail informado já está em uso por outra Pessoa, THEN the system SHALL bloquear a reivindicação.*
- I1: bloqueia reivindicação com e-mail duplicado
- T: `T-unit` + `T-e2e`

**AC-003-5** — *The system SHALL registrar log com solicitante, verificador, data/hora e meio de verificação utilizado.*
- I1: registra log de auditoria da reivindicação
- T: `T-e2e`

### USP-004 — Autenticar no portal com e-mail e senha · Must · **w3**

**AC-004-1** — *WHEN o usuário submete e-mail e senha válidos, the system SHALL autenticar e redirecionar à tela inicial.*
- I1: autentica e cria sessão com credenciais válidas · I2: redireciona à tela inicial
- T: `T-e2e`

**AC-004-2** — *IF as credenciais são inválidas, THEN the system SHALL exibir mensagem genérica "credenciais inválidas".*
- I1: rejeita credenciais inválidas · I2: mensagem genérica não distingue e-mail vs senha *(anti-enumeração)*
- T: `T-unit` (mensagem) + `T-e2e`

**AC-004-3** — *IF o usuário falhar 5 tentativas em 15 minutos, THEN the system SHALL bloquear novas tentativas por 15 minutos.*
- I1: bloqueia após 5 falhas em 15 min · I2: bloqueio expira após 15 min (libera)
- T: `T-unit` (contador/janela) + `T-e2e`

**AC-004-4** — *WHILE o usuário está autenticado, the system SHALL encerrar a sessão após 12 horas de inatividade.*
- I1: encerra a sessão após 12h de inatividade
- T: `T-unit` (expiração) + `T-e2e`

### USP-005 — Recuperar senha esquecida · Must · **w3**

**AC-005-1** — *WHEN o usuário solicita recuperação informando e-mail cadastrado, the system SHALL enviar link de redefinição válido por 24 horas.*
- I1: envia link de redefinição *(= AC-044-2)* · I2: link válido por 24h (expira depois)
- T: `T-unit` (expiração) + `T-e2e`

**AC-005-2** — *IF o e-mail não está cadastrado, THEN the system SHALL exibir mensagem genérica de confirmação de envio (sem revelar inexistência).*
- I1: mensagem genérica para e-mail inexistente, sem revelar inexistência *(anti-enumeração)*
- T: `T-e2e`

**AC-005-3** — *WHEN o usuário acessa link válido e define nova senha, the system SHALL atualizar a senha e invalidar o link.*
- I1: atualiza a senha · I2: invalida o link após uso (uso único)
- T: `T-unit` (token de uso único) + `T-e2e`

### USP-006 — Ativar papel adicional na Pessoa autenticada · Must · **w3**

**AC-006-1** — *WHEN o usuário solicita ativar um novo papel público, the system SHALL exibir formulário com apenas os campos ainda não preenchidos.*
- I1: exibe formulário apenas com os campos ainda não preenchidos (reaproveita dados existentes)
- T: `T-unit` (diff de campos) + `T-e2e`

**AC-006-2** — *WHEN o usuário conclui o preenchimento, the system SHALL ativar o papel imediatamente sem etapa de moderação adicional sobre a Pessoa em si.*
- I1: ativa o papel imediatamente · I2: sem etapa de moderação sobre o papel/Pessoa
- T: `T-e2e`

**AC-006-3** — *The system SHALL registrar log do papel ativado.*
- I1: registra log de auditoria da ativação de papel
- T: `T-e2e`

### USP-007 — Inativar Pessoa · Must · **w3**

**AC-007-1** — *WHEN o usuário autorizado inativa uma Pessoa, the system SHALL impedir novos logins dessa Pessoa.*
- I1: impede novos logins da Pessoa inativada
- T: `T-unit` + `T-e2e`

**AC-007-2** — *WHILE a Pessoa está inativa, the system SHALL preservar todo o histórico (candidaturas, encaminhamentos, vagas publicadas como responsável de empresa, serviços, etc.).*
- I1: preserva todo o histórico após inativação
- T: `T-e2e`

**AC-007-3** — *WHEN a Pessoa inativada era único responsável de uma Empresa, the system SHALL exigir designação de outro responsável antes da inativação.*
- I1: bloqueia inativação se Pessoa é única responsável de uma Empresa (exige substituto antes)
- T: `T-unit` (invariante ≥1 responsável) + `T-e2e`

### USP-008 — Configurar permissões delegadas a voluntário no portal · Must · **w3**

**AC-008-1** — *WHEN o coordenador concede uma permissão delegável a um voluntário, the system SHALL aplicar imediatamente e registrar log.*
- I1: aplica a permissão imediatamente · I2: registra log da concessão
- T: `T-e2e`

**AC-008-2** — *WHEN o coordenador revoga uma permissão, the system SHALL remover o acesso no próximo carregamento e registrar log.*
- I1: remove o acesso na revogação · I2: registra log da revogação
- T: `T-e2e`

**AC-008-3** — *WHERE o catálogo de permissões delegáveis do Portal está definido (ver Glossário), the system SHALL apresentá-lo como lista finita.*
- I1: apresenta o catálogo como lista finita (9 permissões do Glossário)
- T: `T-unit`

---

## Épico 2 — Cadastros Públicos

### USP-009 — Cadastro de candidato (papel) · Must · **w3**

**AC-009-1** — *WHEN a Pessoa submete o cadastro com escolaridade, área de interesse principal e telefone preenchidos, the system SHALL ativar o papel de candidato com status "rascunho" para o conteúdo do perfil/CV.*
- I1: ativa o papel de candidato · I2: conteúdo do perfil/CV entra com status "rascunho" · I3: valida campos obrigatórios (escolaridade, área de interesse principal, telefone)
- T: `T-unit` (obrigatórios) + `T-e2e`

**AC-009-2** — *WHERE a Pessoa anexa CV (PDF, DOC ou DOCX até 5MB), the system SHALL invocar extração automática por IA generativa e pré-preencher campos estruturados para validação do usuário (ver US-040).*
- I1: valida CV PDF/DOC/DOCX até 5MB · I2: invoca extração por IA ao anexar CV · I3: pré-preenche campos estruturados para validação
- T: `T-unit` (validação de arquivo) + `T-e2e` *(extração via port `CVExtractor`, adapter mockado)*
- *Nota:* detalhamento da extração graduado em USP-040; aqui é o nível de integração do cadastro.

**AC-009-3** — *WHEN o candidato envia o perfil para moderação, the system SHALL alterar status para "em moderação" e enfileirar para o coordenador.*
- I1: altera status para "em moderação" · I2: enfileira para o coordenador (aparece na fila)
- T: `T-unit` (transição) + `T-e2e`

**AC-009-4** — *WHEN o perfil é aprovado pelo coordenador, the system SHALL ativar o candidato (visível na busca de empresas) e enviar e-mail ao candidato.*
- I1: ativa o candidato (status ativo, visível na busca) · I2: envia e-mail ao candidato *(= AC-044-3, decisão de moderação)*
- T: `T-e2e`

### USP-010 — Cadastro de prestador de serviço (papel) · Must · **w3**

**AC-010-1** — *WHEN a Pessoa solicita ativar o papel de prestador PF, the system SHALL ativar o papel imediatamente.*
- I1: ativa o papel de prestador PF imediatamente
- T: `T-e2e`

**AC-010-2** — *The system SHALL permitir que o prestador informe dados fiscais opcionais (CNPJ MEI próprio, se houver) sem que isso afete o tipo de cadastro.*
- I1: aceita dados fiscais opcionais (CNPJ MEI próprio) · I2: dados fiscais não alteram o tipo de cadastro (permanece PF)
- T: `T-unit` + `T-e2e`

### USP-011 — Cadastro de cliente de serviço (papel) · Must · **w3**

**AC-011-1** — *WHEN a Pessoa autenticada acessa a tela de serviço e tenta manifestar interesse pela primeira vez, the system SHALL ativar o papel de cliente automaticamente sem formulário adicional.*
- I1: ativa o papel de cliente automaticamente na 1ª manifestação · I2: sem formulário adicional
- T: `T-unit` (auto-ativação) + `T-e2e`

### USP-012 — Cadastro de Empresa (pela Pessoa que se torna responsável) · Must · **w3**

**AC-012-1** — *WHEN a Pessoa submete o cadastro de Empresa com CNPJ, razão social, nome fantasia e setor, the system SHALL persistir a Empresa e criar o vínculo Pessoa↔Empresa com tipo "responsável" automaticamente.*
- I1: persiste a Empresa · I2: cria vínculo Pessoa↔Empresa tipo "responsável" automaticamente · I3: valida campos obrigatórios (CNPJ, razão social, nome fantasia, setor)
- T: `T-unit` (obrigatórios) + `T-e2e`

**AC-012-2** — *IF o CNPJ informado tem formato/dígito verificador inválido, THEN the system SHALL bloquear o cadastro.*
- I1: bloqueia CNPJ com dígito verificador inválido
- T: `T-unit` (dígito CNPJ) + `T-e2e`

**AC-012-3** — *IF o CNPJ já está cadastrado no portal, THEN the system SHALL bloquear o cadastro e oferecer fluxo de "solicitar inclusão como responsável" à pessoa logada (o sistema notifica os responsáveis atuais da Empresa).*
- I1: bloqueia cadastro de CNPJ duplicado · I2: oferece fluxo "solicitar inclusão como responsável" · I3: notifica os responsáveis atuais da Empresa
- T: `T-unit` (guard de duplicidade) + `T-e2e`

**AC-012-4** — *The system SHALL marcar a Empresa como "não verificada" até a aprovação da primeira vaga (validação manual pelo coordenador no momento da moderação da primeira vaga — US-019).*
- I1: Empresa criada com marca "não verificada"
- T: `T-unit` (estado default) + `T-e2e`

---

## Épico 3 — Gestão de Vínculos Pessoa-Empresa

### USP-013 — Adicionar responsável a uma Empresa · Must · **w3**

**AC-013-1** — *WHEN o responsável atual busca uma Pessoa por CPF ou e-mail e a adiciona como responsável, the system SHALL criar vínculo Pessoa↔Empresa com tipo "responsável".*
- I1: cria vínculo Pessoa↔Empresa "responsável" ao adicionar
- T: `T-e2e`

**AC-013-2** — *IF a Pessoa buscada não está cadastrada no portal, THEN the system SHALL bloquear a operação e orientar que essa Pessoa precisa fazer o auto-cadastro antes.*
- I1: bloqueia adição de Pessoa não cadastrada · I2: orienta auto-cadastro prévio
- T: `T-unit` + `T-e2e`

**AC-013-3** — *WHEN o vínculo é criado, the system SHALL enviar e-mail à nova Pessoa-responsável informando o vínculo.*
- I1: envia e-mail à nova Pessoa-responsável
- T: `T-e2e`

### USP-014 — Remover responsável de uma Empresa · Must · **w3**

**AC-014-1** — *WHEN o responsável solicita remoção de um vínculo, the system SHALL persistir a remoção e enviar e-mail à Pessoa removida.*
- I1: persiste a remoção do vínculo · I2: envia e-mail à Pessoa removida
- T: `T-e2e`

**AC-014-2** — *IF a remoção deixaria a Empresa sem nenhum responsável ativo, THEN the system SHALL bloquear a operação e exigir designação de outro responsável antes.*
- I1: bloqueia remoção que deixaria a Empresa sem responsável ativo
- T: `T-unit` (invariante ≥1 responsável) + `T-e2e`

**AC-014-3** — *The system SHALL preservar o histórico de vínculos passados para auditoria.*
- I1: preserva o histórico de vínculos removidos
- T: `T-e2e`

### USP-015 — Editar dados da Empresa · Must · **w3**

**AC-015-1** — *WHEN o responsável submete a edição, the system SHALL persistir as alterações.*
- I1: persiste as alterações da Empresa
- T: `T-e2e`

**AC-015-2** — *IF a edição alterar CNPJ, razão social ou nome fantasia, THEN the system SHALL marcar a Empresa como "não verificada" novamente, exigindo nova validação manual na próxima vaga publicada.*
- I1: remarca Empresa como "não verificada" quando CNPJ/razão social/nome fantasia mudam
- T: `T-unit` (detecção de mudança nesses 3 campos) + `T-e2e`

---

## Épico 4 — Moderação de Conteúdo

### USP-016 — Moderar rascunho (vaga, CV ou serviço) · Must · **w3**

**AC-016-1** — *WHEN o coordenador acessa a fila de moderação, the system SHALL listar rascunhos com status "em moderação" ordenados por data de envio.*
- I1: lista rascunhos com status "em moderação" · I2: ordenados por data de envio
- T: `T-unit` (ordenação) + `T-e2e`

**AC-016-2** — *WHEN o coordenador aprova, the system SHALL alterar status para "ativo" e enviar e-mail ao autor.*
- I1: altera status para "ativo" · I2: envia e-mail ao autor *(= AC-044-3)*
- T: `T-unit` (transição) + `T-e2e`

**AC-016-3** — *WHEN o coordenador devolve para ajustes, the system SHALL exigir motivo textual obrigatório, alterar status para "aguardando ajustes" e enviar e-mail ao autor com o motivo.*
- I1: exige motivo textual obrigatório · I2: altera status para "aguardando ajustes" · I3: envia e-mail ao autor com o motivo *(= AC-044-3)*
- T: `T-unit` (motivo obrigatório) + `T-e2e`

**AC-016-4** — *WHEN o coordenador rejeita definitivamente, the system SHALL exigir motivo textual, alterar status para "rejeitado" e enviar e-mail ao autor.*
- I1: exige motivo textual obrigatório · I2: altera status para "rejeitado" · I3: envia e-mail ao autor *(= AC-044-3)*
- T: `T-unit` + `T-e2e`

**AC-016-5** — *The system SHALL registrar log da decisão (autor, momento, motivo).*
- I1: registra log de auditoria da decisão de moderação
- T: `T-e2e`
- *Nota:* transições devem passar por `transitionContent()` (state machine); o check é a mudança de status observável.

### USP-017 — Validar Empresa na primeira vaga publicada · Must · **w3**

**AC-017-1** — *WHEN o coordenador modera uma vaga cuja Empresa está marcada como "não verificada", the system SHALL exibir os dados da Empresa em destaque com solicitação explícita de verificação manual.*
- I1: exibe dados da Empresa em destaque com solicitação de verificação quando "não verificada"
- T: `T-e2e`

**AC-017-2** — *WHEN o coordenador aprova a vaga (e portanto a Empresa), the system SHALL marcar a Empresa como "verificada" e registrar log com responsável e data.*
- I1: marca Empresa como "verificada" ao aprovar a 1ª vaga · I2: registra log com responsável e data
- T: `T-e2e`

**AC-017-3** — *IF o coordenador identifica inconsistência nos dados da Empresa, THEN the system SHALL permitir rejeitar a vaga com motivo (e a Empresa permanece "não verificada").*
- I1: permite rejeitar a vaga com motivo · I2: Empresa permanece "não verificada" após rejeição
- T: `T-unit` + `T-e2e`

### USP-018 — Inativar conteúdo já publicado · Must · **w3**

**AC-018-1** — *WHEN o coordenador inativa conteúdo já ativo, the system SHALL exigir motivo textual obrigatório, alterar status para "arquivado" e enviar e-mail ao autor com o motivo.*
- I1: exige motivo textual obrigatório · I2: altera status para "arquivado" · I3: envia e-mail ao autor com o motivo
- T: `T-unit` (motivo) + `T-e2e`

**AC-018-2** — *The system SHALL registrar log da operação.*
- I1: registra log de auditoria da inativação
- T: `T-e2e`

### USP-019 — Sugerir nova categoria de serviço ou área de vaga · Should · **w2**

**AC-019-1** — *WHEN o usuário escolhe "Outro / sugerir nova" no campo de categoria/área, the system SHALL permitir digitar a sugestão como texto livre.*
- I1: permite digitar a sugestão de categoria/área como texto livre
- T: `T-e2e`

**AC-019-2** — *WHEN o conteúdo é submetido para moderação, the system SHALL enfileirar a sugestão para a diretoria aprovar ou rejeitar.*
- I1: enfileira a sugestão para a diretoria
- T: `T-e2e`

**AC-019-3** — *WHEN a diretoria aprova uma sugestão, the system SHALL adicionar a categoria/área ao catálogo padronizado.*
- I1: adiciona a categoria/área ao catálogo ao aprovar
- T: `T-e2e`

---

## Épico 5 — Vagas

### USP-020 — Publicar vaga · Must · **w3**

**AC-020-1** — *WHEN o responsável submete a vaga com todos os campos obrigatórios e data de validade preenchida, the system SHALL persistir com status "em moderação".*
- I1: persiste a vaga com status "em moderação" · I2: valida campos obrigatórios da vaga
- T: `T-unit` + `T-e2e`

**AC-020-2** — *The system SHALL exigir data de validade obrigatória.*
- I1: exige data de validade (rejeita sem)
- T: `T-unit` + `T-e2e`

**AC-020-3** — *IF a data de validade é anterior ou igual a hoje, THEN the system SHALL bloquear o submit.*
- I1: bloqueia validade anterior ou igual a hoje (timezone America/Sao_Paulo)
- T: `T-unit` (regra de data/tz) + `T-e2e`

**AC-020-4** — *The system SHALL permitir salvar como rascunho a qualquer momento sem submissão.*
- I1: permite salvar como rascunho sem submeter (status "rascunho")
- T: `T-e2e`

### USP-021 — Buscar vagas (pública) · Must · **w3**

**AC-021-1** — *WHEN o visitante acessa a lista de vagas, the system SHALL exibir apenas vagas com status "ativo" ordenadas por data de publicação (mais recente primeiro).*
- I1: exibe apenas vagas com status "ativo" · I2: ordena por data de publicação desc (mais recente primeiro)
- T: `T-unit` (filtro+ordem) + `T-e2e`

**AC-021-2** — *WHEN o visitante aplica filtros, the system SHALL atualizar a lista respeitando todos os filtros simultaneamente.*
- I1: aplica todos os filtros simultaneamente (área/escolaridade/contrato/regime/salário/região)
- T: `T-unit` (composição de filtros) + `T-e2e`

**AC-021-3** — *WHEN o visitante usa busca textual, the system SHALL aplicar match case-insensitive ignorando acentos sobre título, descrição e requisitos.*
- I1: match case-insensitive e sem acentos · I2: escopo cobre título, descrição e requisitos
- T: `T-unit` (normalização) + `T-e2e`

**AC-021-4** — *WHERE a vaga é visualizada por visitante anônimo, the system SHALL anonimizar o nome da Empresa (exibindo apenas o setor).*
- I1: anonimiza o nome da Empresa para anônimo (exibe só o setor)
- T: `T-e2e` *(asserção: nome da Empresa ausente do payload Flight — ver caveat §7)* + `T-unit`

**AC-021-5** — *WHERE a vaga é visualizada por Pessoa autenticada, the system SHALL exibir o nome da Empresa.*
- I1: exibe o nome da Empresa para Pessoa autenticada
- T: `T-e2e`

### USP-022 — Ver detalhe da vaga · Must · **w3**

**AC-022-1** — *WHEN o visitante anônimo abre o detalhe, the system SHALL exibir todos os dados da vaga e anonimizar a Empresa.*
- I1: exibe todos os dados da vaga (anônimo) · I2: anonimiza a Empresa (anônimo) *(payload — ver §7)*
- T: `T-e2e`

**AC-022-2** — *WHEN a Pessoa autenticada com papel candidato abre o detalhe, the system SHALL exibir nome da Empresa e botão "candidatar-se".*
- I1: exibe o nome da Empresa (autenticada candidato) · I2: exibe o botão "candidatar-se"
- T: `T-e2e`

**AC-022-3** — *The system SHALL exibir contador de candidaturas ("N pessoas se candidataram").*
- I1: exibe contador de candidaturas
- T: `T-unit` (contagem) + `T-e2e`

### USP-023 — Editar vaga (pausar, arquivar, renovar) · Must · **w3**

**AC-023-1** — *WHEN o responsável edita uma vaga ativa, the system SHALL alterar status para "rascunho" e exigir nova moderação antes de voltar a "ativo".*
- I1: altera status para "rascunho" ao editar vaga ativa · I2: exige nova moderação antes de voltar a "ativo"
- T: `T-unit` (transição) + `T-e2e`

**AC-023-2** — *WHEN o responsável pausa a vaga, the system SHALL alterar status para "pausado" (oculta da busca, mas não exige nova moderação para reativar).*
- I1: altera status para "pausado" · I2: vaga pausada oculta da busca · I3: reativar não exige nova moderação
- T: `T-unit` + `T-e2e`

**AC-023-3** — *WHEN o responsável arquiva, the system SHALL alterar status para "arquivado".*
- I1: altera status para "arquivado"
- T: `T-e2e`

**AC-023-4** — *WHEN o responsável prorroga a validade, the system SHALL permitir nova data de validade futura sem exigir nova moderação se a vaga ainda está ativa.*
- I1: permite nova data de validade futura (prorrogação) · I2: sem nova moderação se a vaga ainda está ativa
- T: `T-unit` (data futura) + `T-e2e`

### USP-024 — Expiração automática de vaga · Must · **w3**

**AC-024-1** — *WHEN a data de validade é atingida (timezone América/São_Paulo), the system SHALL alterar o status da vaga para "expirado" automaticamente.*
- I1: altera status para "expirado" na data de validade (America/Sao_Paulo)
- T: `T-unit` (limite de data/tz) + `T-e2e (agendado)` *(assertar estado real no DB — ver §8)*

**AC-024-2** — *The system SHALL ocultar vagas expiradas da busca pública.*
- I1: oculta vagas expiradas da busca pública
- T: `T-e2e`

**AC-024-3** — *The system SHALL enviar e-mail à Empresa-responsável 3 dias antes da expiração avisando.*
- I1: envia e-mail 3 dias antes da expiração à Empresa-responsável *(= AC-044-7)*
- T: `T-unit` (gatilho D-3) + `T-e2e (agendado)`

---

## Épico 6 — Candidaturas e Busca de Candidatos

### USP-025 — Candidatar-se a uma vaga · Must · **w3**

**AC-025-1** — *WHEN o candidato clica em "candidatar-se" em uma vaga ativa, the system SHALL persistir a candidatura, enviar e-mail de confirmação ao candidato e tornar o contato do candidato visível para a Empresa.*
- I1: persiste a candidatura · I2: envia e-mail de confirmação ao candidato *(= AC-044-4)* · I3: torna o contato do candidato visível para a Empresa
- T: `T-e2e`

**AC-025-2** — *IF o candidato já tem candidatura ativa (não cancelada) à mesma vaga, THEN the system SHALL bloquear nova candidatura.*
- I1: bloqueia candidatura duplicada ativa na mesma vaga (unicidade de candidatura ativa)
- T: `T-unit` (unicidade) + `T-e2e`

**AC-025-3** — *IF o perfil do candidato não está com status "ativo" (não foi moderado), THEN the system SHALL bloquear a candidatura.*
- I1: bloqueia candidatura se o perfil não está "ativo"
- T: `T-unit` (precondição) + `T-e2e`

### USP-026 — Cancelar candidatura · Must · **w3**

**AC-026-1** — *WHEN o candidato cancela uma candidatura ativa, the system SHALL marcá-la como "cancelada" e ocultar da lista da Empresa.*
- I1: marca candidatura como "cancelada" · I2: oculta da lista da Empresa
- T: `T-e2e`

**AC-026-2** — *WHEN a candidatura é cancelada, the system SHALL permitir nova candidatura à mesma vaga posteriormente.*
- I1: permite recandidatura à mesma vaga após cancelamento
- T: `T-unit` + `T-e2e`

### USP-027 — Empresa ver lista de candidatos da vaga · Must · **w3**

**AC-027-1** — *WHEN o responsável abre a vaga dele, the system SHALL listar todas as candidaturas ativas (não canceladas) com nome do candidato, contato (e-mail e telefone), e link para CV.*
- I1: lista candidaturas ativas (exclui canceladas) · I2: exibe nome do candidato · I3: exibe contato (e-mail e telefone) · I4: exibe link para CV
- T: `T-unit` (filtro de ativas) + `T-e2e`

**AC-027-2** — *WHERE a candidatura veio de encaminhamento ASONSEG, the system SHALL exibir badge visível "Candidato encaminhado pela ASONSEG".*
- I1: exibe badge "Candidato encaminhado pela ASONSEG" para candidatura de encaminhamento
- T: `T-e2e`

**AC-027-3** — *The system SHALL exibir data e hora da candidatura.*
- I1: exibe data e hora da candidatura
- T: `T-e2e`

### USP-028 — Empresa buscar candidatos (busca ativa) · Must · **w3**

**AC-028-1** — *WHEN o responsável acessa a busca de candidatos, the system SHALL listar candidatos com status "ativo" ordenados por data de cadastro.*
- I1: lista candidatos com status "ativo" · I2: ordenados por data de cadastro
- T: `T-unit` + `T-e2e`

**AC-028-2** — *WHEN o responsável aplica filtros, the system SHALL atualizar a lista respeitando todos os filtros.*
- I1: aplica todos os filtros (área/escolaridade/disponibilidade/localização) simultaneamente
- T: `T-unit` + `T-e2e`

**AC-028-3** — *The system SHALL exibir, para cada candidato na lista: primeiro nome, cidade/região, área de interesse principal, escolaridade e qualificações resumidas.*
- I1: exibe primeiro nome · I2: exibe cidade/região · I3: exibe área de interesse principal · I4: exibe escolaridade · I5: exibe qualificações resumidas
- T: `T-e2e`

**AC-028-4** — *The system SHALL ocultar dados sensíveis (CPF, contato completo, endereço, CV) até que o candidato se candidate a uma vaga da Empresa.*
- I1: oculta CPF até candidatura · I2: oculta contato completo até candidatura · I3: oculta endereço até candidatura · I4: oculta CV até candidatura
- T: `T-e2e` *(asserção: campos ausentes do payload Flight — ver §7)* + `T-unit`

---

## Épico 7 — Serviços

### USP-029 — Publicar serviço · Must · **w3**

**AC-029-1** — *WHEN o usuário inicia o cadastro de serviço, the system SHALL exigir escolha entre "publicar como PF" ou "publicar em nome de [Empresa X]" (lista das empresas que a Pessoa representa).*
- I1: exige escolha entre PF e Empresa · I2: lista as empresas que a Pessoa representa
- T: `T-unit` + `T-e2e`

**AC-029-2** — *WHEN o serviço é submetido, the system SHALL persistir com status "em moderação".*
- I1: persiste o serviço com status "em moderação"
- T: `T-e2e`

**AC-029-3** — *The system SHALL exigir título, categoria, descrição, valor, unidade (por hora/diária/serviço/etc.), região(ões) de atendimento e disponibilidade (dias e horários).*
- I1: valida campos obrigatórios do serviço (título, categoria, descrição, valor, unidade, regiões, disponibilidade)
- T: `T-unit` + `T-e2e`

**AC-029-4** — *The system SHALL permitir até 3 fotos do trabalho (JPG/PNG/WEBP até 5MB cada) opcionalmente.*
- I1: aceita até 3 fotos (rejeita a 4ª) · I2: valida tipo/tamanho das fotos (JPG/PNG/WEBP, ≤5MB cada)
- T: `T-unit` (limites) + `T-e2e`

### USP-030 — Buscar serviços (pública) · Must · **w3**

**AC-030-1** — *WHEN o visitante acessa a lista de serviços, the system SHALL exibir apenas serviços com status "ativo" ordenados por data de publicação.*
- I1: exibe apenas serviços com status "ativo" · I2: ordena por data de publicação
- T: `T-unit` + `T-e2e`

**AC-030-2** — *WHEN o visitante aplica filtros, the system SHALL atualizar a lista respeitando os filtros.*
- I1: aplica os filtros (categoria/preço/região/disponibilidade)
- T: `T-unit` + `T-e2e`

**AC-030-3** — *The system SHALL aplicar busca textual case-insensitive sem acentos sobre título, descrição e categoria.*
- I1: busca textual case-insensitive e sem acentos · I2: escopo cobre título, descrição e categoria
- T: `T-unit` + `T-e2e`

### USP-031 — Ver detalhe do serviço · Must · **w3**

**AC-031-1** — *WHEN o visitante (anônimo ou autenticado) abre o detalhe, the system SHALL exibir nome do prestador/Empresa, categorias, descrição, fotos, valor, região e disponibilidade.*
- I1: exibe nome do prestador/Empresa · I2: exibe categorias · I3: exibe descrição · I4: exibe fotos · I5: exibe valor · I6: exibe região · I7: exibe disponibilidade
- T: `T-e2e`

**AC-031-2** — *The system SHALL ocultar telefone e e-mail do prestador até manifestação de interesse autenticada.*
- I1: oculta telefone do prestador até manifestação · I2: oculta e-mail do prestador até manifestação
- T: `T-e2e` *(asserção: campos ausentes do payload — ver §7)* + `T-unit`

**AC-031-3** — *WHEN a Pessoa autenticada manifesta interesse, the system SHALL exibir o contato do prestador (US-032).*
- I1: exibe o contato do prestador após manifestação de interesse autenticada
- T: `T-e2e`

### USP-032 — Editar serviço (pausar, arquivar) · Must · **w3**

**AC-032-1** — *WHEN o prestador edita um serviço ativo, the system SHALL alterar status para "rascunho" e exigir nova moderação.*
- I1: altera status para "rascunho" ao editar serviço ativo · I2: exige nova moderação
- T: `T-unit` (transição) + `T-e2e`

**AC-032-2** — *WHEN o prestador pausa, the system SHALL alterar status para "pausado".*
- I1: altera status para "pausado"
- T: `T-e2e`

**AC-032-3** — *WHEN o prestador arquiva, the system SHALL alterar status para "arquivado".*
- I1: altera status para "arquivado"
- T: `T-e2e`

---

## Épico 8 — Manifestação de Interesse em Serviço

### USP-033 — Manifestar interesse em serviço · Must · **w3**

**AC-033-1** — *WHEN o cliente clica em "entrar em contato" em um serviço ativo, the system SHALL persistir a manifestação, exibir o contato do prestador e enviar e-mail ao prestador avisando do interesse.*
- I1: persiste a manifestação · I2: exibe o contato do prestador ao cliente · I3: envia e-mail ao prestador *(= AC-044-5)*
- T: `T-e2e`

**AC-033-2** — *WHERE o cliente ainda não tem papel "cliente de serviço" ativo, the system SHALL ativar o papel automaticamente sem formulário adicional.*
- I1: ativa papel cliente automaticamente · I2: sem formulário adicional
- T: `T-unit` + `T-e2e`

**AC-033-3** — *The system SHALL permitir múltiplas manifestações simultâneas em serviços diferentes.*
- I1: permite múltiplas manifestações simultâneas (serviços diferentes)
- T: `T-unit` + `T-e2e`

### USP-034 — Cancelar manifestação de interesse · Should · **w2**

**AC-034-1** — *WHEN o cliente cancela, the system SHALL marcar a manifestação como "cancelada".*
- I1: marca a manifestação como "cancelada"
- T: `T-e2e`

### USP-035 — Prestador ver manifestações de interesse · Must · **w3**

**AC-035-1** — *WHEN o prestador abre seu painel, the system SHALL listar manifestações ativas com nome do cliente, contato, data e serviço referenciado.*
- I1: lista manifestações ativas · I2: exibe nome do cliente · I3: exibe contato · I4: exibe data · I5: exibe serviço referenciado
- T: `T-e2e`

---

## Épico 9 — Ficha Social, Encaminhamento e Visão Consolidada

### USP-036 — Cadastrar ficha socioeconômica da Pessoa · Must · **w3**

**AC-036-1** — *WHEN a assistente social acessa o cadastro social de uma Pessoa, the system SHALL exibir os campos: renda aproximada, benefício social recebido, situação de moradia, composição familiar declarada (texto/número).*
- I1: exibe campo renda aproximada · I2: exibe campo benefício social recebido · I3: exibe campo situação de moradia · I4: exibe campo composição familiar declarada
- T: `T-e2e`

**AC-036-2** — *The system SHALL permitir editar a qualquer momento e registrar log das alterações.*
- I1: permite editar a ficha a qualquer momento · I2: registra log das alterações
- T: `T-e2e`

**AC-036-3** — *The system SHALL impedir o acesso aos dados sociais por qualquer Pessoa que não tenha papel de assistente social ou diretoria.*
- I1: impede acesso aos dados sociais por não-AS/não-diretoria *(authz restrita)*
- T: `T-unit` (authz) + `T-e2e` *(asserção: dados sociais ausentes do payload para papel não autorizado — ver §7)*

### USP-037 — Encaminhar Pessoa para vaga · Must · **w3**

**AC-037-1** — *WHEN o usuário autorizado submete um encaminhamento com Pessoa e vaga selecionadas, the system SHALL persistir o encaminhamento.*
- I1: persiste o encaminhamento
- T: `T-e2e`

**AC-037-2** — *WHERE a Pessoa não tem papel candidato ativo, the system SHALL ativar o papel automaticamente.*
- I1: ativa papel candidato automaticamente
- T: `T-unit` + `T-e2e`

**AC-037-3** — *WHERE a Pessoa não tem CV anexo, the system SHALL exigir resumo profissional textual obrigatório como parte do encaminhamento.*
- I1: exige resumo profissional textual quando a Pessoa não tem CV
- T: `T-unit` (obrigatório condicional) + `T-e2e`

**AC-037-4** — *The system SHALL persistir motivo do encaminhamento como campo opcional.*
- I1: persiste o motivo do encaminhamento (opcional)
- T: `T-e2e`

**AC-037-5** — *WHEN o encaminhamento é persistido, the system SHALL gerar candidatura à vaga com badge "Candidato encaminhado pela ASONSEG" e enviar e-mail informativo à Pessoa encaminhada.*
- I1: gera candidatura à vaga · I2: candidatura recebe badge "Candidato encaminhado pela ASONSEG" · I3: envia e-mail informativo à Pessoa encaminhada *(= AC-044-6)*
- T: `T-e2e`

**AC-037-6** — *The system SHALL permitir múltiplos encaminhamentos da mesma Pessoa para vagas diferentes.*
- I1: permite múltiplos encaminhamentos (vagas diferentes)
- T: `T-unit` + `T-e2e`

**AC-037-7** — *IF a vaga não está com status "ativo", THEN the system SHALL bloquear o encaminhamento.*
- I1: bloqueia encaminhamento se a vaga não está "ativo"
- T: `T-unit` (precondição) + `T-e2e`

### USP-038 — Registrar resultado do encaminhamento manualmente · Must · **w3**

**AC-038-1** — *WHEN o usuário autorizado registra resultado em um encaminhamento, the system SHALL persistir resultado + observação textual + data.*
- I1: persiste o resultado (contratado/não selecionado/em análise/sem resposta) · I2: persiste a observação textual · I3: persiste a data
- T: `T-e2e`

### USP-039 — Visão consolidada da Pessoa · Must · **w3**

**AC-039-1** — *WHEN o usuário autorizado abre a ficha consolidada, the system SHALL exibir todas as dimensões da Pessoa em painel único.*
- I1: exibe dados pessoais · I2: exibe papéis ativos · I3: exibe ficha socioeconômica · I4: exibe candidaturas (ativas e históricas) · I5: exibe encaminhamentos · I6: exibe serviços oferecidos · I7: exibe manifestações de interesse · I8: exibe papéis organizacionais
- T: `T-e2e`

**AC-039-2** — *The system SHALL respeitar visibilidade por papel: voluntário comum não acessa essa visão; coordenador acessa apenas dados operacionais relevantes à sua área.*
- I1: voluntário comum não acessa a visão consolidada · I2: coordenador acessa apenas dados operacionais relevantes (não a ficha social completa)
- T: `T-unit` (matriz de authz) + `T-e2e` *(escopo do payload por papel — ver §7)*

---

## Épico 10 — Extração de CV via IA Generativa

### USP-040 — Extração automática de CV via IA generativa · Must · **w3**

**AC-040-1** — *WHEN o candidato faz upload do CV (PDF, DOC ou DOCX até 5MB), the system SHALL invocar serviço de IA generativa para extrair campos estruturados (escolaridade, área de formação, experiência, habilidades, cursos).*
- I1: valida upload PDF/DOC/DOCX até 5MB · I2: invoca o serviço de IA generativa · I3: extrai campos estruturados (escolaridade, área de formação, experiência, habilidades, cursos)
- T: `T-unit` (validação de arquivo) + `T-e2e` *(via port `CVExtractor`; adapter mockado — dependência só do interface)*

**AC-040-2** — *WHEN a extração retorna, the system SHALL pré-preencher os campos do formulário e exibir os valores para validação obrigatória pelo candidato.*
- I1: pré-preenche os campos do formulário com o resultado · I2: exibe os valores para validação do candidato
- T: `T-e2e`

**AC-040-3** — *IF a extração falha ou retorna vazia, THEN the system SHALL deixar os campos vazios para preenchimento manual sem mensagem de erro disruptiva.*
- I1: em falha/retorno vazio, deixa campos vazios e não bloqueia o cadastro (best effort)
- T: `T-unit` (fallback) + `T-e2e`

**AC-040-4** — *The system SHALL exigir confirmação explícita do candidato antes de salvar os dados extraídos.*
- I1: exige confirmação explícita antes de salvar os dados extraídos
- T: `T-unit` + `T-e2e`

**AC-040-5** — *The system SHALL armazenar o arquivo original do CV vinculado ao candidato.*
- I1: armazena o arquivo original do CV vinculado ao candidato
- T: `T-e2e` (storage)

---

## Épico 11 — Indicadores e Relatórios

### USP-041 — Home pública com indicadores em tempo real · Must · **w3**

**AC-041-1** — *WHEN o visitante acessa a home, the system SHALL exibir: total de vagas com status "ativo", total de candidatos com perfil "ativo", total de Empresas "verificadas".*
- I1: exibe total de vagas com status "ativo" · I2: exibe total de candidatos com perfil "ativo" · I3: exibe total de Empresas "verificadas"
- T: `T-unit` (contagens) + `T-e2e`

**AC-041-2** — *The system SHALL atualizar os indicadores em tempo real (cache curto admitido — política a definir pelo Arquiteto).*
- I1: indicadores refletem o estado atual (tempo real, cache curto tolerado)
- T: `T-e2e`
- *Freeze:* política de cache = QP-004/D-012 em aberto → configuração, não um check. Só "refletem o estado atual (dentro da tolerância de cache curto)" é graduável.

### USP-042 — Relatórios operacionais do Portal · Must · **w3**

**AC-042-1** — *WHEN o usuário autorizado acessa um relatório, the system SHALL exibir lista filtrável por período, status e categoria.*
- I1: exibe relatório como lista filtrável · I2: filtro por período · I3: filtro por status · I4: filtro por categoria
- T: `T-unit` (filtros) + `T-e2e`

**AC-042-2** — *The system SHALL permitir exportação em CSV e PDF (estrutura mínima viável; detalhamento de filtros/agrupamentos refinado durante sprints).*
- I1: exporta em CSV · I2: exporta em PDF
- T: `T-e2e`
- *Freeze:* detalhamento de filtros/agrupamentos = QP-005/D-005 refinado nas sprints → não graduável além da estrutura mínima (lista filtrável + os 2 formatos).

---

## Épico 12 — Conformidade LGPD (Consentimentos)

### USP-043 — Consentimentos LGPD por finalidade · Must · **w3**

**AC-043-1** — *WHEN a Pessoa ativa um papel (candidato, prestador, cliente, empresa-responsável, ficha social), the system SHALL exibir o termo de consentimento específico daquela finalidade e exigir aceite explícito antes de prosseguir.*
- I1: exibe o termo de consentimento específico da finalidade · I2: exige aceite explícito e bloqueia a ativação sem aceite
- T: `T-unit` (gate) + `T-e2e`

**AC-043-2** — *The system SHALL persistir cada consentimento com: titular, finalidade, versão do termo aceita, data/hora, IP.*
- I1: persiste titular · I2: persiste finalidade · I3: persiste versão do termo aceita · I4: persiste data/hora · I5: persiste IP
- T: `T-e2e`

**AC-043-3** — *The system SHALL permitir à Pessoa visualizar seus consentimentos vigentes em painel próprio.*
- I1: exibe os consentimentos vigentes no painel da Pessoa
- T: `T-e2e`

**AC-043-4** — *WHERE a Pessoa solicita revogação de um consentimento, the system SHALL desativar o papel/funcionalidade vinculada à finalidade revogada (sem afetar outros consentimentos da mesma Pessoa).*
- I1: a revogação desativa o papel/funcionalidade vinculado à finalidade · I2: a revogação não afeta outros consentimentos da mesma Pessoa
- T: `T-unit` (isolamento por finalidade) + `T-e2e`

---

## Épico 13 — Notificações por E-mail

### USP-044 — Notificações por e-mail em eventos do portal · Must · **w3**

> **Catálogo consolidado.** Cada e-mail abaixo é **um observável, contado uma vez** (§9). O *home canônico* é a AC da feature indicada; aqui é a visão de catálogo. Grade a expedição no local canônico; use estas linhas para rastreabilidade do disparo por evento.

**AC-044-1** — *WHEN um cadastro é concluído, the system SHALL enviar e-mail de boas-vindas à Pessoa.*
- I1: envia e-mail de boas-vindas · *(→ mesmo observável de AC-001-6 / AC-003-3)*
- T: `T-e2e`

**AC-044-2** — *WHEN a Pessoa solicita recuperação de senha, the system SHALL enviar e-mail com link de redefinição.*
- I1: envia e-mail de recuperação de senha · *(→ AC-005-1)*
- T: `T-e2e`

**AC-044-3** — *WHEN um rascunho é aprovado, devolvido para ajustes ou rejeitado, the system SHALL enviar e-mail ao autor com decisão e motivo (quando aplicável).*
- I1: envia e-mail de decisão de moderação ao autor (decisão + motivo quando aplicável) · *(→ AC-016-2/3/4, AC-009-4)*
- T: `T-e2e`

**AC-044-4** — *WHEN uma candidatura é registrada, the system SHALL enviar e-mail de confirmação ao candidato.*
- I1: envia e-mail de confirmação de candidatura · *(→ AC-025-1)*
- T: `T-e2e`

**AC-044-5** — *WHEN uma manifestação de interesse é registrada, the system SHALL enviar e-mail ao prestador.*
- I1: envia e-mail de manifestação ao prestador · *(→ AC-033-1)*
- T: `T-e2e`

**AC-044-6** — *WHEN um encaminhamento é criado, the system SHALL enviar e-mail informativo à Pessoa encaminhada.*
- I1: envia e-mail informativo de encaminhamento · *(→ AC-037-5)*
- T: `T-e2e`

**AC-044-7** — *WHEN uma vaga está a 3 dias da expiração, the system SHALL enviar e-mail à Empresa-responsável.*
- I1: envia e-mail D-3 da expiração à Empresa-responsável · *(→ AC-024-3)*
- T: `T-unit` (gatilho D-3) + `T-e2e (agendado)`

**AC-044-8** — *WHEN o CV de um candidato completa N dias sem atualização (default 180, parametrizável pela diretoria), the system SHALL enviar e-mail de lembrete ao candidato (sem impacto funcional se ignorar).*
- I1: envia e-mail de lembrete de CV desatualizado · I2: aplica default de 180 dias quando N não configurado · I3: N é parametrizável pela diretoria
- T: `T-unit` (default + parametrização) + `T-e2e (agendado)`

---

## Fora de escopo — weight 0 (listado, nunca graduável)

Itens do PRD §3.2 e notas de escopo. Listados por completude; **ausência não é defeito**. Nunca convertidos em checks.

| Item | Origem | Nota |
|---|---|---|
| Família como entidade estruturada (triagem, fila, indicações) | §3.2 / USP-036 nota | Release 2. Composição familiar só como texto/número declarado na ficha. |
| Gestão de estoque, distribuição, vendas, caixa (Frente 4) | §3.2 | Release 2. |
| Triagem de família, fila de cesta, indicação de necessidade | §3.2 | Release 2. |
| Gerenciamento de status de candidatura (Kanban) | §3.2 / USP-027 nota | V2. Sem status de candidatura no MVP. |
| Sistema de denúncia estruturado | §3.2 | V2. Escalonamento manual via USP-018. |
| Convite por e-mail para adicionar responsável | §3.2 / USP-013 nota | V2. Pessoa deve estar pré-cadastrada. |
| Consulta automática à Receita Federal (CNPJ) | §3.2 | V2. CNPJ só por dígito verificador. |
| WhatsApp e push notification | §3.2 | V2. Só e-mail no MVP. |
| SEO técnico / indexação | §3.2 | V2. |
| Algoritmo de relevância na ordenação | §3.2 | V2. Ordenação por mais recente. |
| Busca semântica / full-text avançado | §3.2 | V2. Match exato robusto no MVP. |
| App mobile nativo | §3.2 | PWA + web cobrem. |
| Modo offline | §3.2 | Online-only. |
| Dashboard público no site institucional | §3.2 | V2. |
| Integração ativa com redes sociais | §3.2 | Publicação manual. |
| Portal do beneficiário com login próprio | §3.2 | Acesso sob demanda pela AS/diretoria. |
| Avaliações / reputação | §3.2 | Sem rating no MVP. |
| Mensagens internas entre Pessoas | §3.2 | Contato revelado, fora do portal. |
| Faturamento / pagamentos de serviço | §3.2 | ASONSEG só conecta (termo de responsabilidade). |
| Múltiplos idiomas | §3.2 | Apenas PT-BR. |
| **Could Have** | §9 | Nenhum. |
| **Won't Have (este release)** | §9 | Nenhum. |

---

## Resumo (contrato congelado)

| Épico | USPs | Prioridade | Peso | I-checks |
|---|---|---|---|---|
| 1 — Identidade, Acesso e Papéis | 001–008 | Must ×8 | 3 | 51 |
| 2 — Cadastros Públicos | 009–012 | Must ×4 | 3 | 23 |
| 3 — Vínculos Pessoa-Empresa | 013–015 | Must ×3 | 3 | 10 |
| 4 — Moderação de Conteúdo | 016–018 Must; 019 Should | Must ×3 / Should ×1 | 3 / 2 | 23 |
| 5 — Vagas | 020–024 | Must ×5 | 3 | 26 |
| 6 — Candidaturas e Busca | 025–028 | Must ×4 | 3 | 26 |
| 7 — Serviços | 029–032 | Must ×4 | 3 | 25 |
| 8 — Manifestação de Interesse | 033, 035 Must; 034 Should | Must ×2 / Should ×1 | 3 / 2 | 12 |
| 9 — Ficha Social, Encaminhamento, Visão | 036–039 | Must ×4 | 3 | 29 |
| 10 — Extração de CV via IA | 040 | Must ×1 | 3 | 8 |
| 11 — Indicadores e Relatórios | 041–042 | Must ×2 | 3 | 10 |
| 12 — Consentimentos LGPD | 043 | Must ×1 | 3 | 10 |
| 13 — Notificações por E-mail | 044 | Must ×1 | 3 | 10 |
| **Total** | **44 USPs (42 Must, 2 Should)** | — | — | **≈263 I-checks** |

- **Weights:** Must = 3 (42 stories), Should = 2 (USP-019, USP-034). Could/Won't = 0 (none).
- **T-levels:** every AC with pure/business logic requires `T-unit`; every AC with an observable persistence/HTTP/email side-effect requires `T-e2e`. Async/scheduled effects (`AC-024-1`, `AC-024-3`, `AC-044-7`, `AC-044-8`) require `T-e2e (agendado)` asserted against real DB/inbox.
- **Count-once observables:** email dispatches shared between a feature AC and USP-044 (marked `→ mesmo observável`) are graded once at the feature AC.
- This file is the single frozen contract for this PRD. Do not timestamp; do not re-derive per run.
