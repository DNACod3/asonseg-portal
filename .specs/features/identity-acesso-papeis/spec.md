# Identidade, Acesso e Papéis Specification

## Problem Statement
O portal ASONSEG precisa identificar Pessoas de forma unificada e permitir que elas acessem funcionalidades autenticadas conforme um ou mais papéis. É necessário cobrir desde o auto-cadastro público até o cadastro assistido de Pessoas sem capacidade digital (situação extrema), além de autenticação segura, recuperação de senha, ativação de papéis adicionais, inativação com preservação de histórico e delegação de permissões operacionais a voluntários.

## Goals
- [ ] Permitir auto-cadastro público de Pessoa com CPF válido, e-mail e senha, ativando ao menos um papel público.
- [ ] Permitir cadastro assistido pela assistente social, sem credencial e com exceção de CPF justificada.
- [ ] Permitir que Pessoa pré-cadastrada reivindique credencial mediante verificação de identidade.
- [ ] Autenticar usuários com e-mail/senha, com bloqueio após 5 tentativas em 15 minutos e sessão expirando em 12h de inatividade.
- [ ] Permitir recuperação de senha por e-mail com link válido por 24h.
- [ ] Permitir ativar papel adicional na Pessoa autenticada sem moderação do papel em si.
- [ ] Permitir inativar Pessoa preservando histórico e bloqueando novos logins.
- [ ] Permitir ao coordenador conceder/revogar permissões delegáveis a voluntários a partir de catálogo finito.

## Out of Scope
| Feature | Reason |
| --- | --- |
| Criação de Empresa | Empresa é criada após o login (USP-013), não no auto-cadastro. |
| Moderação de papel | A moderação se aplica ao conteúdo publicado (vaga, CV, serviço), não ao papel em si (ADR-0015). |
| i18n / múltiplos idiomas | MVP é exclusivamente PT-BR. |
| Meios concretos de verificação de identidade na reivindicação | A definir na Fase 0 (questão aberta no PRD). |

## User Stories

### P1: Auto-cadastro de Pessoa no portal ⭐ MVP
**User Story**: Como visitante anônimo (futuro usuário público), quero criar minha conta informando nome, CPF, e-mail e senha e ativando ao menos um papel público, para que eu possa usar as funcionalidades autenticadas do portal.
**Why P1**: Porta de entrada principal do portal; sem auto-cadastro não há base de usuários públicos.
**Acceptance Criteria**:
1. QUANDO o visitante submete o auto-cadastro com nome, CPF válido, e-mail e senha, ENTÃO o sistema DEVE persistir a Pessoa, criar a credencial e ativar o(s) papel(éis) público(s) escolhido(s).
2. QUANDO o e-mail informado já está em uso por outra Pessoa, ENTÃO o sistema DEVE bloquear o cadastro e informar o conflito.
3. QUANDO o CPF informado já está em uso por outra Pessoa, ENTÃO o sistema DEVE bloquear o cadastro.
4. QUANDO o CPF tem formato/dígito verificador inválido, ENTÃO o sistema DEVE bloquear o cadastro.
5. O sistema DEVE exigir validação CAPTCHA no auto-cadastro.
6. QUANDO o cadastro é concluído com sucesso, ENTÃO o sistema DEVE enviar e-mail de boas-vindas e registrar log de auditoria.
7. O sistema DEVE armazenar senhas com hash bcrypt (ou equivalente atual).
8. O sistema DEVE exigir CPF obrigatório no auto-cadastro público, sem permitir exceção.
**Independent Test**: Submeter o formulário público com dados válidos e papel selecionado; verificar Pessoa, credencial e papel persistidos, e-mail de boas-vindas enviado e log de auditoria registrado. Repetir com e-mail/CPF duplicados e CPF inválido para confirmar bloqueios.

### P1: Cadastro de Pessoa pela assistente social (situação extrema) ⭐ MVP
**User Story**: Como assistente social, quero cadastrar uma Pessoa sem capacidade digital de auto-cadastro, sem e-mail e senha, podendo dispensar excepcionalmente o CPF, para que eu possa registrar e referenciar essa Pessoa em encaminhamentos e ficha social.
**Why P1**: Atende o público em situação de vulnerabilidade extrema, central à missão da ASONSEG.
**Acceptance Criteria**:
1. QUANDO a assistente social cadastra uma Pessoa, ENTÃO o sistema DEVE persistir com nome obrigatório e demais campos opcionais.
2. QUANDO a assistente social marca "Pessoa sem documento — exceção", ENTÃO o sistema DEVE exigir justificativa textual obrigatória e gravar marca de exceção no cadastro.
3. O sistema DEVE impedir que o auto-cadastro público marque exceção de CPF — apenas AS ou diretoria podem fazê-lo.
4. QUANDO o cadastro é sem credencial (e-mail e senha vazios), ENTÃO o sistema DEVE permitir referenciar a Pessoa em encaminhamentos, ficha social e relatórios, mas DEVE impedir login dessa Pessoa.
5. O sistema DEVE registrar log com responsável, data/hora e dados informados.
**Independent Test**: Cadastrar uma Pessoa pela AS marcando exceção de CPF com justificativa; verificar marca de exceção, ausência de credencial, bloqueio de login e log com responsável. Confirmar que o fluxo público não oferece a opção de exceção.

### P1: Reivindicar credencial de Pessoa pré-cadastrada ⭐ MVP
**User Story**: Como Pessoa cadastrada pela assistente social (ou familiar autorizado), quero ativar uma credencial (e-mail e senha) para uma Pessoa pré-cadastrada, com verificação de identidade, para que essa Pessoa passe a acessar o portal diretamente.
**Why P1**: Conecta o cadastro assistido ao acesso autônomo, completando o ciclo de inclusão digital.
**Acceptance Criteria**:
1. QUANDO o solicitante inicia o fluxo de reivindicação informando CPF (ou identificador alternativo da Pessoa sem CPF) e e-mail desejado, ENTÃO o sistema DEVE gerar uma solicitação pendente.
2. O sistema DEVE exigir verificação de identidade conforme processo definido pela ASONSEG (presencial na sede, código por carta, ou confirmação pela AS) antes de ativar a credencial.
3. QUANDO a verificação é confirmada pela AS ou diretoria, ENTÃO o sistema DEVE ativar a credencial e enviar e-mail de boas-vindas.
4. QUANDO o e-mail informado já está em uso por outra Pessoa, ENTÃO o sistema DEVE bloquear a reivindicação.
5. O sistema DEVE registrar log com solicitante, verificador, data/hora e meio de verificação utilizado.
**Independent Test**: Iniciar reivindicação para Pessoa pré-cadastrada; confirmar solicitação pendente, ativação somente após confirmação da AS/diretoria, e-mail de boas-vindas, bloqueio em caso de e-mail duplicado e log com meio de verificação.

### P1: Autenticar no portal com e-mail e senha ⭐ MVP
**User Story**: Como usuário com credencial ativa, quero fazer login com meu e-mail e senha, para que eu possa usar as funcionalidades autenticadas.
**Why P1**: Sem autenticação não há acesso às áreas autenticadas do portal.
**Acceptance Criteria**:
1. QUANDO o usuário submete e-mail e senha válidos, ENTÃO o sistema DEVE autenticar e redirecionar à tela inicial.
2. QUANDO as credenciais são inválidas, ENTÃO o sistema DEVE exibir mensagem genérica "credenciais inválidas".
3. QUANDO o usuário falhar 5 tentativas em 15 minutos, ENTÃO o sistema DEVE bloquear novas tentativas por 15 minutos.
4. ENQUANTO o usuário está autenticado, o sistema DEVE encerrar a sessão após 12 horas de inatividade.
**Independent Test**: Logar com credenciais válidas (redireciona à home); tentar 5 logins inválidos em 15 min e confirmar bloqueio por 15 min; manter sessão inativa por 12h e confirmar expiração.

### P1: Recuperar senha esquecida ⭐ MVP
**User Story**: Como usuário, quero solicitar redefinição de senha por e-mail, para que eu recupere o acesso sem intervenção administrativa.
**Why P1**: Reduz dependência de suporte e evita bloqueio de acesso por esquecimento de senha.
**Acceptance Criteria**:
1. QUANDO o usuário solicita recuperação informando e-mail cadastrado, ENTÃO o sistema DEVE enviar link de redefinição válido por 24 horas.
2. QUANDO o e-mail não está cadastrado, ENTÃO o sistema DEVE exibir mensagem genérica de confirmação de envio (sem revelar inexistência).
3. QUANDO o usuário acessa link válido e define nova senha, ENTÃO o sistema DEVE atualizar a senha e invalidar o link.
**Independent Test**: Solicitar recuperação com e-mail válido e redefinir senha via link (link expira após uso); solicitar com e-mail inexistente e confirmar mensagem genérica idêntica.

### P1: Ativar papel adicional na Pessoa autenticada ⭐ MVP
**User Story**: Como usuário autenticado, quero ativar um novo papel público preenchendo apenas os dados faltantes, para que eu use funcionalidades de múltiplos papéis com o mesmo login.
**Why P1**: Permite que a mesma Pessoa atue em múltiplos papéis (ex.: candidato e prestador) sem novo cadastro.
**Acceptance Criteria**:
1. QUANDO o usuário solicita ativar um novo papel público, ENTÃO o sistema DEVE exibir formulário com apenas os campos ainda não preenchidos.
2. QUANDO o usuário conclui o preenchimento, ENTÃO o sistema DEVE ativar o papel imediatamente sem etapa de moderação adicional sobre a Pessoa em si.
3. O sistema DEVE registrar log do papel ativado.
**Independent Test**: Com usuário autenticado de papel candidato, ativar papel de prestador; confirmar formulário apenas com campos faltantes, ativação imediata sem moderação e log do papel ativado.

### P1: Inativar Pessoa ⭐ MVP
**User Story**: Como coordenador da área (para voluntários) ou diretoria (para qualquer Pessoa), quero marcar uma Pessoa como inativa preservando histórico, para que ela deixe de ter acesso e o histórico operacional fique preservado.
**Why P1**: Necessário para desligamento de voluntários e atendimento a pedidos do titular, mantendo integridade dos dados.
**Acceptance Criteria**:
1. QUANDO o usuário autorizado inativa uma Pessoa, ENTÃO o sistema DEVE impedir novos logins dessa Pessoa.
2. ENQUANTO a Pessoa está inativa, o sistema DEVE preservar todo o histórico (candidaturas, encaminhamentos, vagas publicadas como responsável de empresa, serviços, etc.).
3. QUANDO a Pessoa inativada era único responsável de uma Empresa, ENTÃO o sistema DEVE exigir designação de outro responsável antes da inativação.
**Independent Test**: Inativar uma Pessoa e tentar login (bloqueado), confirmar histórico preservado; tentar inativar um único responsável de Empresa e confirmar exigência de novo responsável antes de concluir.

### P1: Configurar permissões delegadas a voluntário ⭐ MVP
**User Story**: Como coordenador da área Portal Empregabilidade, quero conceder ou revogar permissões administrativas específicas a voluntários da minha área, para que eu distribua tarefas operacionais sem promover voluntários a coordenador.
**Why P1**: Habilita a operação descentralizada de moderação e encaminhamento sem inflar hierarquia de papéis.
**Acceptance Criteria**:
1. QUANDO o coordenador concede uma permissão delegável a um voluntário, ENTÃO o sistema DEVE aplicar imediatamente e registrar log.
2. QUANDO o coordenador revoga uma permissão, ENTÃO o sistema DEVE remover o acesso no próximo carregamento e registrar log.
3. QUANDO o catálogo de permissões delegáveis do Portal está definido, ENTÃO o sistema DEVE apresentá-lo como lista finita.
**Independent Test**: Conceder a um voluntário a permissão de moderar vagas (aplicada imediatamente, com log); revogar e confirmar perda de acesso no próximo carregamento e log; verificar que a UI lista apenas o catálogo finito de permissões.

## Edge Cases
- QUANDO o e-mail informado no auto-cadastro ou na reivindicação já existe, ENTÃO o sistema DEVE bloquear a operação e sinalizar o conflito.
- QUANDO o CPF está duplicado ou tem dígito verificador inválido no auto-cadastro, ENTÃO o sistema DEVE bloquear o cadastro.
- QUANDO o auto-cadastro público tenta marcar exceção de CPF, ENTÃO o sistema DEVE recusar — somente AS ou diretoria podem.
- QUANDO uma Pessoa cadastrada sem credencial tenta fazer login, ENTÃO o sistema DEVE impedir o acesso.
- QUANDO ocorrem 5 tentativas de login falhas em 15 minutos, ENTÃO o sistema DEVE bloquear novas tentativas por 15 minutos.
- QUANDO a sessão atinge 12 horas de inatividade, ENTÃO o sistema DEVE encerrá-la.
- QUANDO se solicita recuperação de senha com e-mail inexistente, ENTÃO o sistema DEVE exibir a mesma mensagem genérica de confirmação, sem revelar a inexistência.
- QUANDO um link de redefinição já usado ou expirado (>24h) é acessado, ENTÃO o sistema DEVE recusar a redefinição.
- QUANDO se tenta inativar a única Pessoa responsável de uma Empresa, ENTÃO o sistema DEVE exigir a designação de outro responsável antes de concluir.

## Requirement Traceability
| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IDN-01 | USP-001 | Design | Pending |
| IDN-02 | USP-001 | Design | Pending |
| IDN-03 | USP-001 | Design | Pending |
| IDN-04 | USP-002 | Design | Pending |
| IDN-05 | USP-002 | Design | Pending |
| IDN-06 | USP-002 | Design | Pending |
| IDN-07 | USP-003 | Design | Pending |
| IDN-08 | USP-003 | Design | Pending |
| IDN-09 | USP-004 | Design | Pending |
| IDN-10 | USP-004 | Design | Pending |
| IDN-11 | USP-004 | Design | Pending |
| IDN-12 | USP-005 | Design | Pending |
| IDN-13 | USP-005 | Design | Pending |
| IDN-14 | USP-006 | Design | Pending |
| IDN-15 | USP-007 | Design | Pending |
| IDN-16 | USP-007 | Design | Pending |
| IDN-17 | USP-008 | Design | Pending |
| IDN-18 | USP-008 | Design | Pending |

- **IDN-01**: Persistência de Pessoa + credencial + papel(éis) público(s) no auto-cadastro válido (AC-001-1).
- **IDN-02**: Bloqueios de unicidade e validação no auto-cadastro — e-mail, CPF duplicado, CPF inválido, CPF obrigatório sem exceção (AC-001-2, AC-001-3, AC-001-4, nota).
- **IDN-03**: Segurança do auto-cadastro — CAPTCHA, hash bcrypt, e-mail de boas-vindas e auditoria (AC-001-5, AC-001-6, AC-001-7).
- **IDN-04**: Cadastro assistido pela AS com nome obrigatório e campos opcionais (AC-002-1).
- **IDN-05**: Exceção de CPF com justificativa obrigatória, restrita a AS/diretoria (AC-002-2, AC-002-3).
- **IDN-06**: Pessoa sem credencial referenciável mas sem login, com log de responsável (AC-002-4, AC-002-5).
- **IDN-07**: Fluxo de reivindicação de credencial com solicitação pendente e verificação de identidade (AC-003-1, AC-003-2).
- **IDN-08**: Ativação após confirmação AS/diretoria, bloqueio por e-mail duplicado e log de verificação (AC-003-3, AC-003-4, AC-003-5).
- **IDN-09**: Autenticação válida e mensagem genérica para credenciais inválidas (AC-004-1, AC-004-2).
- **IDN-10**: Bloqueio após 5 tentativas em 15 minutos por 15 minutos (AC-004-3).
- **IDN-11**: Encerramento de sessão após 12h de inatividade (AC-004-4).
- **IDN-12**: Envio de link de redefinição válido por 24h e mensagem genérica para e-mail inexistente (AC-005-1, AC-005-2).
- **IDN-13**: Atualização de senha e invalidação do link após uso (AC-005-3).
- **IDN-14**: Ativação de papel adicional com campos faltantes, imediata e auditada (AC-006-1, AC-006-2, AC-006-3).
- **IDN-15**: Inativação bloqueando novos logins e preservando histórico (AC-007-1, AC-007-2).
- **IDN-16**: Exigência de novo responsável antes de inativar único responsável de Empresa (AC-007-3).
- **IDN-17**: Concessão e revogação de permissões delegáveis com efeito imediato/próximo carregamento e log (AC-008-1, AC-008-2).
- **IDN-18**: Catálogo finito de permissões delegáveis do Portal (AC-008-3).

## Success Criteria
- [ ] Auto-cadastro válido cria Pessoa, credencial e papel(éis); duplicidades e CPF inválido são bloqueados; CAPTCHA e hash bcrypt aplicados.
- [ ] AS consegue cadastrar Pessoa sem credencial e com exceção de CPF justificada; auto-cadastro público nunca marca exceção; Pessoa sem credencial não loga.
- [ ] Reivindicação só ativa credencial após verificação confirmada pela AS/diretoria; e-mail duplicado bloqueia; logs registram solicitante, verificador e meio.
- [ ] Login bloqueia após 5 tentativas em 15 min e expira a sessão após 12h de inatividade; mensagens de erro são genéricas.
- [ ] Recuperação de senha envia link válido por 24h, invalida o link após uso e não revela inexistência de e-mail.
- [ ] Papel adicional é ativado imediatamente sem moderação do papel, exibindo apenas campos faltantes, com log.
- [ ] Inativação bloqueia logins, preserva histórico e exige novo responsável quando aplicável.
- [ ] Coordenador concede/revoga permissões delegáveis com efeito imediato/próximo carregamento, a partir de catálogo finito, com log em cada operação.
