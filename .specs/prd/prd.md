# PRD — Portal Empregabilidade e Serviços
## MVP — Release 1 (com fundação compartilhada do sistema ASONSEG)
### Ação Social Nossa Senhora de Guadalupe (ASONSEG)

| Campo | Valor |
|---|---|
| Cliente | ASONSEG |
| Versão | v0.3 — 22/05/2026 |
| Autor | Bravi Software — PO |
| Status | Draft — Aguardando revisão do cliente e estimativa do Tech Lead |

---

> ## Sobre este documento e o relacionamento com a Frente 4
>
> Este PRD descreve o **MVP do projeto ASONSEG**: o **Portal Empregabilidade e Serviços**, agora priorizado pela diretoria como **Release 1**. A **Frente 4 (Estoque, Logística e Fitoterápicos)** — antes posicionada como MVP — foi reposicionada para o **Release 2**, conforme registrado no CHANGELOG v0.2 e no PRD `prd-asonseg-frente4-v2`.
>
> **Decisão complementar fundamental:** o MVP do Portal entrega também toda a **fundação compartilhada** do sistema ASONSEG (Cenário 1 — identidade unificada plena). Isso significa que a entidade **Pessoa**, papéis compostos, autenticação e autorização unificadas, consentimentos LGPD por finalidade, auditoria imutável transversal, encaminhamento de Pessoa para vaga, ficha socioeconômica mínima e visão consolidada da Pessoa são todos modelados **já neste MVP**. O Release 2 (Frente 4) chega para ativar funcionalidades adicionais sobre essa base já existente.
>
> **ADRs do PRD da Frente 4** (ADR-0001 a ADR-0010) permanecem válidos como decisões aplicáveis ao Release 2. **ADRs novos deste PRD** (ADR-0011 a ADR-0018) cobrem as decisões estruturantes do Portal e da fundação compartilhada — alguns deles revisam parcialmente ADRs anteriores (em especial ADR-0002 e ADR-0003), o que está documentado nos respectivos arquivos em `decisions/`.

---

## 1. Visão Geral

### 1.1 Problema de negócio

A ASONSEG identificou que não existe hoje, no contexto da comunidade atendida em Florianópolis (Canasvieiras, Jurerê, Ingleses e adjacências), um canal estruturado para conectar candidatos a vagas e prestadores de serviço a clientes locais. A comunidade depende de canais informais (boca-a-boca, anúncios físicos, redes sociais não-estruturadas), o que gera ineficiências, perda de oportunidades e dificuldade da ASONSEG em desempenhar seu papel de ponte institucional entre famílias atendidas (beneficiários) e o mercado de trabalho e serviços locais.

Adicionalmente, a ASONSEG percebeu que digitalizar o controle de beneficiários e atendimentos (Frente 4) — embora institucionalmente relevante — pode esperar, pois funciona manualmente há tempo. Já o portal de empregabilidade e serviços não existe e foi identificado como prioridade institucional imediata para iniciar.

### 1.2 Solução proposta (alto nível)

Sistema web (PWA + web responsivo, online-only) composto por: portal público de vagas e serviços com busca e filtros sem login; cadastros públicos de Pessoa com papéis compostos (candidato, prestador, cliente de serviço, empresa-responsável); cadastro institucional de Empresa pela Pessoa-responsável (sem login próprio da Empresa); fluxo de moderação humana pré-publicação de vagas, CVs e serviços; candidatura silenciosa e manifestação de interesse em serviço; encaminhamento institucional ASONSEG da Pessoa para vaga (diferencial do portal); ficha socioeconômica mínima da Pessoa para acompanhamento social; visão consolidada da Pessoa para a gestão; extração automática de CV via IA generativa; relatórios mínimos viáveis com exportação CSV/PDF; conformidade LGPD com consentimentos por finalidade.

### 1.3 Público-alvo

Quatro perfis públicos de Pessoa: candidatos (membros da comunidade buscando vagas); empresas-responsáveis (pessoas representando empresas que publicam vagas e contratam prestadores); prestadores de serviço (PF ou via Empresa); clientes de serviço (qualquer pessoa que queira contratar serviços do portal).

Três perfis internos da ASONSEG: assistente social (cadastro de Pessoa em situação extrema, ficha socioeconômica, encaminhamento, visão consolidada); coordenador da área Portal Empregabilidade (moderação de vagas/CVs/serviços, validação de empresa, gestão de voluntários, delegação de permissões); diretoria (visão consolidada, decisões institucionais, parametrização global, DPO).

Estimativa institucional: 50–200 vagas ativas ao final do primeiro ano; 200–500 candidatos cadastrados; 30–100 empresas verificadas; 50–150 prestadores; volume baixo do ponto de vista técnico — números a serem refinados com o sponsor no início do projeto.

### 1.4 Resultado esperado

O MVP deve estabelecer um canal estruturado de empregabilidade e serviços que (1) conecte a comunidade local a oportunidades reais; (2) preserve o papel institucional ativo da ASONSEG via encaminhamento; (3) opere com qualidade controlada via moderação humana pré-publicação; (4) construa a fundação compartilhada (Pessoa, papéis, LGPD, auditoria) que permitirá ao Release 2 ser desenvolvido com custo significativamente menor que se cada fase tivesse modelo isolado.

---

## 2. Personas

### 2.1 Pessoa (entidade fundamental)
Toda persona do sistema é uma manifestação de **Pessoa** com um ou mais papéis ativos. Login único; papéis compostos livremente; consentimentos LGPD por finalidade. Ver ADR-0011.

### 2.2 Candidato
- **Perfil:** pessoa da comunidade buscando oportunidade profissional.
- **Necessidades:** cadastrar perfil com qualificações, anexar CV (com extração automática), buscar vagas, candidatar-se.
- **Acesso:** PWA em celular pessoal ou computador. Auto-cadastro público.

### 2.3 Empresa-responsável (Pessoa)
- **Perfil:** pessoa que representa uma Empresa (CNPJ regular ou MEI). Pode representar mais de uma Empresa simultaneamente.
- **Necessidades:** cadastrar Empresa, publicar vagas, buscar candidatos, adicionar outros responsáveis.
- **Acesso:** web e PWA. Auto-cadastro público.

### 2.4 Prestador de serviço
- **Perfil:** pessoa que oferece serviços, podendo atuar como PF ou em nome de uma Empresa (MEI ou regular) que ela representa.
- **Necessidades:** publicar serviços com descrição, valor, região, fotos; receber manifestações de interesse.
- **Acesso:** web e PWA. Auto-cadastro público.

### 2.5 Cliente de serviço
- **Perfil:** pessoa que precisa contratar um serviço.
- **Necessidades:** buscar serviços com filtros, manifestar interesse, ver contato do prestador.
- **Acesso:** web e PWA. Papel ativado automaticamente na primeira manifestação.

### 2.6 Assistente social (interno ASONSEG)
- **Perfil:** profissional ou voluntário com formação em serviço social.
- **Necessidades:** cadastrar Pessoa em situação extrema (sem credencial obrigatória), preencher ficha socioeconômica, encaminhar Pessoa para vaga, ver visão consolidada.
- **Acesso:** web em horário comercial estendido. Única persona pública com acesso pleno aos dados sociais sensíveis.

### 2.7 Coordenador da área Portal Empregabilidade (interno ASONSEG)
- **Perfil:** voluntário sênior responsável pela operação do portal como uma das áreas da ASONSEG (análogo a Cesta Básica, Fito, Bazar).
- **Necessidades:** moderar vagas, CVs e serviços; validar Empresa na primeira vaga; gerenciar voluntários e delegar permissões; inativar conteúdo problemático; aprovar sugestões de novas categorias/áreas.
- **Acesso:** web e PWA.

### 2.8 Diretoria (interno ASONSEG)
- **Perfil:** dirigentes da ASONSEG; responsabilidade institucional, LGPD, prestação de contas.
- **Necessidades:** configurações globais (regiões, categorias, prazos); designação de DPO; visão consolidada de relatórios; aprovação de sugestões.
- **Acesso:** web; uso esporádico mas estratégico.

---

## 3. Escopo

### 3.1 In Scope

- Auto-cadastro público de Pessoa com papéis compostos (candidato, prestador, cliente, empresa-responsável).
- Cadastro de Pessoa pela assistente social em situação extrema, sem credencial obrigatória, com exceção controlada de CPF.
- Reivindicação de credencial para Pessoa pré-cadastrada (com verificação de identidade pela ASONSEG).
- Identidade unificada: login único, papéis compostos ativados em auto-serviço, ativação de papel adicional sem moderação do papel em si.
- Cadastro institucional de Empresa pela Pessoa-responsável (sem login próprio da Empresa); vínculo N:N Pessoa↔Empresa com tipo "responsável".
- Validação automática de CNPJ (dígito verificador); marca "não verificada" até a primeira vaga aprovada.
- Catálogo de categorias e áreas configurável pela diretoria, com possibilidade de sugerir nova categoria que vira pendência de aprovação.
- Regiões geográficas como dado mestre gerenciado pela diretoria.
- Fluxo completo de ciclo de vida do conteúdo: rascunho → em moderação → aguardando ajustes / ativo / rejeitado; após ativo, pausado/expirado/arquivado.
- Moderação humana pré-publicação de toda vaga, CV e serviço pelo coordenador da área Portal (ou voluntário delegado) com aprovação, devolução para ajustes ou rejeição definitiva.
- Validação manual da Empresa pelo coordenador na primeira vaga publicada (anti-empresa-fantasma).
- Publicação de vaga com validade obrigatória; expiração automática; e-mail à empresa 3 dias antes.
- Busca pública de vagas com filtros (área, escolaridade, contrato, regime, salário, região) e match exato robusto (case-insensitive sem acentos).
- Detalhe de vaga com empresa anonimizada para visitante anônimo e revelada para autenticado.
- Candidatura silenciosa: registro + contato revelado para empresa + e-mail de confirmação ao candidato.
- Cancelamento e recandidatura permitidos; unicidade de candidatura ativa por vaga.
- Sem gerenciamento de status de candidatura no MVP (vai para V2).
- Busca ativa de candidatos pela empresa-responsável com filtros (área, escolaridade, disponibilidade, localização) e contato revelado apenas após candidatura.
- Publicação de serviço como PF (em nome próprio) ou em nome de Empresa que a Pessoa representa.
- Busca pública de serviços com filtros (categoria, preço, região, disponibilidade); detalhe com prestador visível e contato oculto até manifestação.
- Manifestação de interesse em serviço: silenciosa, revelação imediata de contato, e-mail informativo ao prestador; cancelamento permitido; múltiplas manifestações simultâneas.
- Ficha socioeconômica mínima da Pessoa (renda aproximada, benefício social, situação de moradia, composição familiar declarada) mantida pela assistente social. Família como entidade estruturada NÃO entra no MVP (Release 2).
- Encaminhamento institucional de Pessoa para vaga por AS, coordenador ou voluntário com permissão delegada; ativa papel candidato automaticamente; resumo profissional condicional se sem CV; badge visível na ficha da empresa; e-mail informativo à Pessoa; sem aceite prévio.
- Registro manual do resultado do encaminhamento (contratado / não selecionado / em análise / sem resposta) por usuário autorizado.
- Visão consolidada da Pessoa para assistente social e diretoria: dados pessoais, papéis ativos, ficha socioeconômica, candidaturas e encaminhamentos, serviços oferecidos e contratados, papéis organizacionais.
- Extração automática de campos do CV via IA generativa (best effort) com validação obrigatória do candidato antes de salvar.
- Home pública com indicadores em tempo real (total de vagas ativas, candidatos ativos, empresas verificadas).
- Relatórios operacionais mínimos viáveis com exportação CSV e PDF (refinamento de filtros/agrupamentos durante sprints).
- Consentimentos LGPD por finalidade (multiplos por Pessoa); registro de versão do termo, data e IP; visualização e revogação no painel da Pessoa.
- Notificações por e-mail para os eventos críticos: boas-vindas, recuperação de senha, decisão de moderação, candidatura, manifestação de interesse, encaminhamento, vaga próxima da expiração, CV há N dias sem atualizar (N parametrizável).
- Autenticação por e-mail/senha com hash bcrypt, bloqueio temporário após 5 tentativas em 15 min, sessão de 12h, troca de senha no 1º acesso, recuperação por e-mail.
- Modelo de papéis e permissões delegáveis estendendo o catálogo do ADR-0001 com permissões específicas do Portal.
- CAPTCHA no auto-cadastro público; rate limiting amplo em todas as APIs públicas.
- Auditoria imutável transversal: autenticação, alteração de permissões, edição/exclusão de conteúdo, mudança de status, configurações globais.
- Termo de responsabilidade do prestador, da empresa e do cliente de serviço (cláusula de isenção de responsabilidade da ASONSEG por relações comerciais e trabalhistas resultantes).
- PWA + web responsivo, online-only, disponibilidade até 21h cobrindo missas vespertinas/noturnas e operação comercial.

### 3.2 Out of Scope

| Fora do escopo deste release | Por quê |
|---|---|
| Família como entidade estruturada (triagem, fila, indicações, etc.) | Funcionalidades da Frente 4 — Release 2. Composição familiar entra apenas como dado declarado na ficha socioeconômica. |
| Gestão de estoque, distribuição, vendas em capelas, fechamento de caixa | Release 2 (Frente 4). |
| Triagem de família, fila de espera de cesta, indicação de necessidade | Release 2 (Frente 4). |
| Gerenciamento de status de candidatura (Kanban Recebida → Vista → Entrevista → Contratado) | MVP enxuto; empresa usa seu próprio processo fora do sistema. V2. |
| Sistema de denúncia de conteúdo | Escalonamento manual por canal externo no MVP. Denúncias estruturadas em V2. |
| Convite por e-mail para adicionar responsável de Empresa | Pessoa deve estar pré-cadastrada. Convite em V2. |
| Consulta automática à Receita Federal para verificar CNPJ | CNPJ validado por dígito verificador apenas; coordenador consulta manualmente. V2. |
| WhatsApp e push notification | Só e-mail no MVP. V2. |
| SEO técnico / indexação otimizada para tráfego orgânico | Captação inicial vem da comunidade ASONSEG. V2. |
| Algoritmo de relevância na ordenação de buscas | Ordenação por mais recente no MVP. Relevância em V2. |
| Busca semântica / full-text search avançado | Match exato robusto no MVP. FTS/semântica em V2. |
| Aplicativo mobile nativo | PWA + web responsivo cobrem. |
| Modo offline | Online-only. |
| Dashboard público embutido em site institucional | Indicadores agregados via home pública do portal e exportação CSV/PDF. Integração ativa com site institucional em V2. |
| Integração ativa com redes sociais (postagem automática) | Publicação manual via cópia dos números exportados. |
| Portal do beneficiário com login próprio para consulta de dados sociais | Direito de acesso atendido sob demanda pela AS/diretoria (mesma política do ADR-0008). |
| Avaliações e reputação de prestadores/empresas/candidatos | Sem rating no MVP. |
| Sistema de mensagens internas entre Pessoas | Comunicação acontece fora do portal via contato revelado. |
| Faturamento / pagamentos integrados a contratação de serviço | ASONSEG é apenas plataforma de conexão (termo de responsabilidade). |
| Múltiplos idiomas | Apenas português brasileiro. |

### 3.3 Premissas

- Volume estimado para o primeiro ano: 50–200 vagas, 200–500 candidatos, 30–100 empresas, 50–150 prestadores. Validar no início do projeto com sponsor ASONSEG.
- Termo de consentimento institucional será produzido/revisado por jurídico antes do go-live (D-002 estendida).
- Voluntários ASONSEG (operadores internos) e Pessoas públicas têm acesso a internet adequado.
- ASONSEG opera o portal a partir da matriz em Florianópolis com cobertura geográfica inicial de Florianópolis e região.
- Pessoas que se cadastram no portal são responsáveis pelas informações fornecidas (declaração no termo de responsabilidade).
- A ASONSEG terá capacidade interna de moderação (coordenador + voluntários delegados) coerente com o volume.

### 3.4 Restrições

- **Tecnológicas:** nenhuma restrição imposta pela ASONSEG. Diretriz arquitetural dominante: *custo operacional mínimo* (ADR-0010 estendido ao Portal). Decisão de stack delegada ao Arquiteto/Tech Lead da Bravi.
- **Regulatórias:** LGPD (Lei 13.709/2018). Múltiplos titulares de dados (candidatos, empresas-responsáveis, prestadores, clientes, beneficiários sociais cadastrados pela AS) com finalidades distintas — exige modelo de consentimentos por finalidade (ADR-0013). Termo de responsabilidade do prestador, da empresa e do cliente cobre a isenção de responsabilidade da ASONSEG por relações comerciais e trabalhistas.
- **Orçamentárias:** R$ 50.000 inicialmente aprovados pela diretoria. Estimativa qualitativa do PO para o escopo deste MVP indica faixa provável de R$ 80–150k considerando a fundação compartilhada do Cenário 1. Estimativa fina do Tech Lead determina o valor para nova rodada com diretoria.
- **De prazo:** "O mais breve possível". Sem data dura vinculada ao go-live.

---

## 4. Métricas e Critérios de Sucesso

Metas concretas (números absolutos) serão definidas com o sponsor ASONSEG no início do projeto, com horizonte de avaliação de 6 meses pós go-live. Baselines = 0 (sistema novo).

| ID | Métrica | Baseline | Meta (6 meses pós go-live) |
|---|---|---|---|
| MP1 | Nº de candidatos com perfil ativo (moderado) | 0 | A definir com sponsor |
| MP2 | Nº de empresas verificadas (com ao menos 1 vaga aprovada) | 0 | A definir com sponsor |
| MP3 | Nº de prestadores ativos com ao menos 1 serviço aprovado | 0 | A definir com sponsor |
| MP4 | Nº acumulado de vagas publicadas e aprovadas | 0 | A definir com sponsor |
| MP5 | Nº acumulado de serviços publicados e aprovados | 0 | A definir com sponsor |
| MP6 | Nº de candidaturas realizadas | 0 | A definir com sponsor |
| MP7 | Nº de manifestações de interesse em serviços | 0 | A definir com sponsor |
| MP8 | Nº de encaminhamentos ASONSEG criados | 0 | A definir com sponsor |
| MP9 | % de encaminhamentos com resultado registrado positivo (contratado) | — | A definir com sponsor |
| MP10 | Tempo médio de moderação (envio → decisão do coordenador) | — | A definir com sponsor (proposta inicial: < 72h) |

---

## 5. Requisitos Funcionais

Critérios de aceitação no padrão EARS (Easy Approach to Requirements Syntax) com a partícula normativa SHALL preservada em inglês conforme padrão consagrado.

### 5.1 Estrutura por épicos

| Épico | User Stories |
|---|---|
| Épico 1 — Identidade, Acesso e Papéis | USP-001 a USP-008 |
| Épico 2 — Cadastros Públicos | USP-009 a USP-012 |
| Épico 3 — Gestão de Vínculos Pessoa-Empresa | USP-013 a USP-015 |
| Épico 4 — Moderação de Conteúdo | USP-016 a USP-019 |
| Épico 5 — Vagas | USP-020 a USP-024 |
| Épico 6 — Candidaturas e Busca de Candidatos | USP-025 a USP-028 |
| Épico 7 — Serviços | USP-029 a USP-032 |
| Épico 8 — Manifestação de Interesse em Serviço | USP-033 a USP-035 |
| Épico 9 — Ficha Social, Encaminhamento e Visão Consolidada | USP-036 a USP-039 |
| Épico 10 — Extração de CV via IA Generativa | USP-040 |
| Épico 11 — Indicadores e Relatórios | USP-041, USP-042 |
| Épico 12 — Conformidade LGPD (Consentimentos) | USP-043 |
| Épico 13 — Notificações por E-mail | USP-044 |

### 5.2 User Stories


#### Épico 1 — Identidade, Acesso e Papéis

##### USP-001: Auto-cadastro de Pessoa no portal (público)

*Como* **visitante anônimo (futuro usuário público)**, *quero* criar minha conta no portal informando nome, CPF, e-mail e senha, ativando ao menos um papel público (candidato, prestador de serviço, cliente de serviço ou empresa-responsável), *para que* eu possa usar as funcionalidades autenticadas do portal.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-001-1:** WHEN o visitante submete o auto-cadastro com nome, CPF válido, e-mail e senha, the system SHALL persistir a Pessoa, criar a credencial e ativar o(s) papel(éis) público(s) escolhido(s).
- **AC-001-2:** IF o e-mail informado já está em uso por outra Pessoa, THEN the system SHALL bloquear o cadastro e informar o conflito.
- **AC-001-3:** IF o CPF informado já está em uso por outra Pessoa, THEN the system SHALL bloquear o cadastro.
- **AC-001-4:** IF o CPF tem formato/dígito verificador inválido, THEN the system SHALL bloquear o cadastro.
- **AC-001-5:** The system SHALL exigir validação CAPTCHA no auto-cadastro.
- **AC-001-6:** WHEN o cadastro é concluído com sucesso, the system SHALL enviar e-mail de boas-vindas e registrar log de auditoria.
- **AC-001-7:** The system SHALL armazenar senhas com hash bcrypt (ou equivalente atual).

*Notas:* CPF obrigatório no auto-cadastro público — não permite exceção. Auto-cadastro não cria empresa; empresa é criada após o login (US-013).

##### USP-002: Cadastro de Pessoa pela assistente social (situação extrema)

*Como* **assistente social**, *quero* cadastrar uma Pessoa que não tem capacidade digital de fazer auto-cadastro, sem necessidade de e-mail e senha, podendo dispensar excepcionalmente o CPF, *para que* eu possa registrar e referenciar essa Pessoa em encaminhamentos e ficha social.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-002-1:** WHEN a assistente social cadastra uma Pessoa, the system SHALL persistir com nome obrigatório e demais campos opcionais.
- **AC-002-2:** WHERE a assistente social marca "Pessoa sem documento — exceção", the system SHALL exigir justificativa textual obrigatória e gravar marca de exceção no cadastro.
- **AC-002-3:** The system SHALL impedir auto-cadastro público de marcar exceção de CPF — apenas AS ou diretoria podem fazê-lo.
- **AC-002-4:** WHEN o cadastro é sem credencial (e-mail e senha vazios), the system SHALL permitir que a Pessoa seja referenciada em encaminhamentos, ficha social e relatórios, mas SHALL impedir login dessa Pessoa.
- **AC-002-5:** The system SHALL registrar log com responsável, data/hora e dados informados.

*Notas:* Pessoa pode reivindicar credencial depois (US-003). Ver ADR-0011.

##### USP-003: Reivindicar credencial de Pessoa pré-cadastrada

*Como* **Pessoa que foi cadastrada pela assistente social (ou um familiar autorizado)**, *quero* ativar uma credencial (e-mail e senha) para uma Pessoa pré-cadastrada, com verificação de identidade, *para que* essa Pessoa passe a poder acessar o portal diretamente.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-003-1:** WHEN o solicitante inicia o fluxo de reivindicação informando CPF (ou identificador alternativo da Pessoa sem CPF) e e-mail desejado, the system SHALL gerar uma solicitação pendente.
- **AC-003-2:** The system SHALL exigir verificação de identidade conforme processo definido pela ASONSEG (presencial na sede, código por carta, ou confirmação pela AS) antes de ativar a credencial.
- **AC-003-3:** WHEN a verificação é confirmada pela AS ou diretoria, the system SHALL ativar a credencial e enviar e-mail de boas-vindas.
- **AC-003-4:** IF o e-mail informado já está em uso por outra Pessoa, THEN the system SHALL bloquear a reivindicação.
- **AC-003-5:** The system SHALL registrar log com solicitante, verificador, data/hora e meio de verificação utilizado.

*Notas:* Meios concretos de verificação a serem definidos na Fase 0 (Q-aberta).

##### USP-004: Autenticar no portal com e-mail e senha

*Como* **usuário com credencial ativa**, *quero* fazer login no portal com meu e-mail e senha, *para que* eu possa usar as funcionalidades autenticadas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-004-1:** WHEN o usuário submete e-mail e senha válidos, the system SHALL autenticar e redirecionar à tela inicial.
- **AC-004-2:** IF as credenciais são inválidas, THEN the system SHALL exibir mensagem genérica "credenciais inválidas".
- **AC-004-3:** IF o usuário falhar 5 tentativas em 15 minutos, THEN the system SHALL bloquear novas tentativas por 15 minutos.
- **AC-004-4:** WHILE o usuário está autenticado, the system SHALL encerrar a sessão após 12 horas de inatividade.

##### USP-005: Recuperar senha esquecida

*Como* **usuário**, *quero* solicitar redefinição de senha por e-mail, *para que* eu recupere o acesso sem intervenção administrativa.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-005-1:** WHEN o usuário solicita recuperação informando e-mail cadastrado, the system SHALL enviar link de redefinição válido por 24 horas.
- **AC-005-2:** IF o e-mail não está cadastrado, THEN the system SHALL exibir mensagem genérica de confirmação de envio (sem revelar inexistência).
- **AC-005-3:** WHEN o usuário acessa link válido e define nova senha, the system SHALL atualizar a senha e invalidar o link.

##### USP-006: Ativar papel adicional na Pessoa autenticada

*Como* **usuário autenticado**, *quero* ativar um novo papel público (ex.: candidato que também quer ser prestador) preenchendo os dados faltantes, *para que* eu use as funcionalidades de múltiplos papéis com o mesmo login.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-006-1:** WHEN o usuário solicita ativar um novo papel público, the system SHALL exibir formulário com apenas os campos ainda não preenchidos.
- **AC-006-2:** WHEN o usuário conclui o preenchimento, the system SHALL ativar o papel imediatamente sem etapa de moderação adicional sobre a Pessoa em si.
- **AC-006-3:** The system SHALL registrar log do papel ativado.

*Notas:* A moderação se aplica ao CONTEÚDO posteriormente publicado (vaga, CV, serviço), não ao papel em si. Ver ADR-0015.

##### USP-007: Inativar Pessoa (desligamento de voluntário ou pedido do titular)

*Como* **coordenador da área (para voluntários) ou diretoria (para qualquer Pessoa)**, *quero* marcar uma Pessoa como inativa, preservando histórico, *para que* ela deixe de ter acesso e o histórico operacional fique preservado.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-007-1:** WHEN o usuário autorizado inativa uma Pessoa, the system SHALL impedir novos logins dessa Pessoa.
- **AC-007-2:** WHILE a Pessoa está inativa, the system SHALL preservar todo o histórico (candidaturas, encaminhamentos, vagas publicadas como responsável de empresa, serviços, etc.).
- **AC-007-3:** WHEN a Pessoa inativada era único responsável de uma Empresa, the system SHALL exigir designação de outro responsável antes da inativação.

##### USP-008: Configurar permissões delegadas a voluntário no portal

*Como* **coordenador da área Portal Empregabilidade**, *quero* conceder ou revogar permissões administrativas específicas (moderar conteúdo, encaminhar, etc.) a voluntários da minha área, *para que* eu distribua tarefas operacionais sem promover voluntários a coordenador.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-008-1:** WHEN o coordenador concede uma permissão delegável a um voluntário, the system SHALL aplicar imediatamente e registrar log.
- **AC-008-2:** WHEN o coordenador revoga uma permissão, the system SHALL remover o acesso no próximo carregamento e registrar log.
- **AC-008-3:** WHERE o catálogo de permissões delegáveis do Portal está definido (ver Glossário), the system SHALL apresentá-lo como lista finita.

*Notas:* Catálogo do Portal estende o do Release 2 (ADR-0001). Permissões específicas do Portal incluem: moderar vagas, moderar CVs, moderar serviços, validar empresa na primeira vaga, encaminhar Pessoa para vaga, inativar conteúdo publicado, aprovar nova categoria sugerida.


#### Épico 2 — Cadastros Públicos

##### USP-009: Cadastro de candidato (papel)

*Como* **Pessoa autenticada**, *quero* ativar o papel de candidato preenchendo dados pessoais, qualificações, escolaridade, áreas de interesse e (opcionalmente) anexando currículo, *para que* eu apareça nas buscas de empresas e possa me candidatar a vagas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-009-1:** WHEN a Pessoa submete o cadastro com escolaridade, área de interesse principal e telefone preenchidos, the system SHALL ativar o papel de candidato com status "rascunho" para o conteúdo do perfil/CV.
- **AC-009-2:** WHERE a Pessoa anexa CV (PDF, DOC ou DOCX até 5MB), the system SHALL invocar extração automática por IA generativa e pré-preencher campos estruturados para validação do usuário (ver US-040).
- **AC-009-3:** WHEN o candidato envia o perfil para moderação, the system SHALL alterar status para "em moderação" e enfileirar para o coordenador.
- **AC-009-4:** WHEN o perfil é aprovado pelo coordenador, the system SHALL ativar o candidato (visível na busca de empresas) e enviar e-mail ao candidato.

*Notas:* Campos detalhados conforme protótipo: nome, CPF, e-mail, telefone, data nascimento, bairro/cidade, escolaridade, área de formação, áreas de interesse, experiência, habilidades, CV. Ver Glossário.

##### USP-010: Cadastro de prestador de serviço (papel)

*Como* **Pessoa autenticada**, *quero* ativar o papel de prestador de serviço PF, *para que* eu possa publicar serviços em meu nome.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-010-1:** WHEN a Pessoa solicita ativar o papel de prestador PF, the system SHALL ativar o papel imediatamente.
- **AC-010-2:** The system SHALL permitir que o prestador informe dados fiscais opcionais (CNPJ MEI próprio, se houver) sem que isso afete o tipo de cadastro.

*Notas:* Para publicar serviço em nome de Empresa (MEI ou regular), o usuário deve antes cadastrar a Empresa via US-012 e publicar o serviço em nome dela. Ver ADR-0011.

##### USP-011: Cadastro de cliente de serviço (papel)

*Como* **Pessoa autenticada**, *quero* ativar o papel de cliente de serviço, *para que* eu possa manifestar interesse em serviços e ver os contatos dos prestadores.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-011-1:** WHEN a Pessoa autenticada acessa a tela de serviço e tenta manifestar interesse pela primeira vez, the system SHALL ativar o papel de cliente automaticamente sem formulário adicional.

*Notas:* Cliente de serviço é o papel "mais leve" — qualquer Pessoa autenticada pode ser cliente sem etapa de cadastro extra.

##### USP-012: Cadastro de Empresa (pela Pessoa que se torna responsável)

*Como* **Pessoa autenticada**, *quero* cadastrar uma Empresa (CNPJ — pode ser regular ou MEI) informando razão social, nome fantasia, setor, descrição, endereço, e tornar-me responsável dela, *para que* eu possa publicar vagas e serviços em nome dessa Empresa.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-012-1:** WHEN a Pessoa submete o cadastro de Empresa com CNPJ, razão social, nome fantasia e setor, the system SHALL persistir a Empresa e criar o vínculo Pessoa↔Empresa com tipo "responsável" automaticamente.
- **AC-012-2:** IF o CNPJ informado tem formato/dígito verificador inválido, THEN the system SHALL bloquear o cadastro.
- **AC-012-3:** IF o CNPJ já está cadastrado no portal, THEN the system SHALL bloquear o cadastro e oferecer fluxo de "solicitar inclusão como responsável" à pessoa logada (o sistema notifica os responsáveis atuais da Empresa).
- **AC-012-4:** The system SHALL marcar a Empresa como "não verificada" até a aprovação da primeira vaga (validação manual pelo coordenador no momento da moderação da primeira vaga — US-019).

*Notas:* Empresa não tem login próprio — Pessoa loga em nome. Ver ADR-0014.


#### Épico 3 — Gestão de Vínculos Pessoa-Empresa

##### USP-013: Adicionar responsável a uma Empresa

*Como* **Pessoa-responsável de uma Empresa**, *quero* adicionar outra Pessoa (já cadastrada no portal) como responsável adicional dessa Empresa, *para que* mais pessoas possam operar vagas e serviços em nome da Empresa.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-013-1:** WHEN o responsável atual busca uma Pessoa por CPF ou e-mail e a adiciona como responsável, the system SHALL criar vínculo Pessoa↔Empresa com tipo "responsável".
- **AC-013-2:** IF a Pessoa buscada não está cadastrada no portal, THEN the system SHALL bloquear a operação e orientar que essa Pessoa precisa fazer o auto-cadastro antes.
- **AC-013-3:** WHEN o vínculo é criado, the system SHALL enviar e-mail à nova Pessoa-responsável informando o vínculo.

*Notas:* Sem fluxo de convite por e-mail no MVP — Pessoa precisa estar pré-cadastrada. Convite vira candidato a V2.

##### USP-014: Remover responsável de uma Empresa

*Como* **Pessoa-responsável de uma Empresa**, *quero* remover meu próprio vínculo ou de outro responsável da Empresa, *para que* a gestão da Empresa reflita as pessoas realmente envolvidas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-014-1:** WHEN o responsável solicita remoção de um vínculo, the system SHALL persistir a remoção e enviar e-mail à Pessoa removida.
- **AC-014-2:** IF a remoção deixaria a Empresa sem nenhum responsável ativo, THEN the system SHALL bloquear a operação e exigir designação de outro responsável antes.
- **AC-014-3:** The system SHALL preservar o histórico de vínculos passados para auditoria.

##### USP-015: Editar dados da Empresa

*Como* **Pessoa-responsável**, *quero* editar dados cadastrais da Empresa (descrição, endereço, contato, etc.), *para que* as informações fiquem atualizadas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-015-1:** WHEN o responsável submete a edição, the system SHALL persistir as alterações.
- **AC-015-2:** IF a edição alterar CNPJ, razão social ou nome fantasia, THEN the system SHALL marcar a Empresa como "não verificada" novamente, exigindo nova validação manual na próxima vaga publicada.


#### Épico 4 — Moderação de Conteúdo

##### USP-016: Moderar rascunho (vaga, CV ou serviço)

*Como* **coordenador da área Portal Empregabilidade (ou voluntário delegado)**, *quero* revisar rascunhos de vaga, CV e serviço e aprovar, devolver para ajustes ou rejeitar, *para que* apenas conteúdo verificado fique visível no portal.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-016-1:** WHEN o coordenador acessa a fila de moderação, the system SHALL listar rascunhos com status "em moderação" ordenados por data de envio.
- **AC-016-2:** WHEN o coordenador aprova, the system SHALL alterar status para "ativo" e enviar e-mail ao autor.
- **AC-016-3:** WHEN o coordenador devolve para ajustes, the system SHALL exigir motivo textual obrigatório, alterar status para "aguardando ajustes" e enviar e-mail ao autor com o motivo.
- **AC-016-4:** WHEN o coordenador rejeita definitivamente, the system SHALL exigir motivo textual, alterar status para "rejeitado" e enviar e-mail ao autor.
- **AC-016-5:** The system SHALL registrar log da decisão (autor, momento, motivo).

*Notas:* Sem SLA formal. Coordenador vê fila e processa conforme capacidade. Ver ADR-0015.

##### USP-017: Validar Empresa na primeira vaga publicada

*Como* **coordenador (ou voluntário delegado)**, *quero* verificar dados da Empresa (CNPJ, razão social, endereço) durante a moderação da primeira vaga dela, *para que* eu evite empresas-fantasma ou fraudulentas no portal.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-017-1:** WHEN o coordenador modera uma vaga cuja Empresa está marcada como "não verificada", the system SHALL exibir os dados da Empresa em destaque com solicitação explícita de verificação manual.
- **AC-017-2:** WHEN o coordenador aprova a vaga (e portanto a Empresa), the system SHALL marcar a Empresa como "verificada" e registrar log com responsável e data.
- **AC-017-3:** IF o coordenador identifica inconsistência nos dados da Empresa, THEN the system SHALL permitir rejeitar a vaga com motivo (e a Empresa permanece "não verificada").

*Notas:* Vagas subsequentes da mesma Empresa não exigem revalidação da Empresa, apenas do conteúdo da vaga.

##### USP-018: Inativar conteúdo já publicado

*Como* **coordenador (ou voluntário delegado)**, *quero* inativar uma vaga, CV ou serviço que já está ativo (descoberta posterior de problema), *para que* eu responda a problemas descobertos após a publicação, mesmo sem fluxo formal de denúncia.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-018-1:** WHEN o coordenador inativa conteúdo já ativo, the system SHALL exigir motivo textual obrigatório, alterar status para "arquivado" e enviar e-mail ao autor com o motivo.
- **AC-018-2:** The system SHALL registrar log da operação.

*Notas:* Substitui o fluxo de denúncia ausente no MVP. Coordenador age sob alerta externo (e-mail institucional, contato direto).

##### USP-019: Sugerir nova categoria de serviço ou área de vaga

*Como* **Pessoa autenticada (publicando vaga ou serviço)**, *quero* sugerir uma nova categoria ou área quando nenhuma existente serve, *para que* meu conteúdo possa ser categorizado corretamente.

**Prioridade:** Should

**Critérios de Aceitação (EARS):**

- **AC-019-1:** WHEN o usuário escolhe "Outro / sugerir nova" no campo de categoria/área, the system SHALL permitir digitar a sugestão como texto livre.
- **AC-019-2:** WHEN o conteúdo é submetido para moderação, the system SHALL enfileirar a sugestão para a diretoria aprovar ou rejeitar.
- **AC-019-3:** WHEN a diretoria aprova uma sugestão, the system SHALL adicionar a categoria/área ao catálogo padronizado.


#### Épico 5 — Vagas

##### USP-020: Publicar vaga

*Como* **Pessoa-responsável de uma Empresa**, *quero* publicar uma vaga em nome da Empresa com título, área, descrição, requisitos, benefícios, salário, regime, local e validade, *para que* candidatos descubram e se candidatem.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-020-1:** WHEN o responsável submete a vaga com todos os campos obrigatórios e data de validade preenchida, the system SHALL persistir com status "em moderação".
- **AC-020-2:** The system SHALL exigir data de validade obrigatória.
- **AC-020-3:** IF a data de validade é anterior ou igual a hoje, THEN the system SHALL bloquear o submit.
- **AC-020-4:** The system SHALL permitir salvar como rascunho a qualquer momento sem submissão.

##### USP-021: Buscar vagas (pública)

*Como* **qualquer pessoa (anônima ou autenticada)**, *quero* buscar vagas com filtros (área, escolaridade, tipo de contrato, regime, faixa de salário, região), *para que* eu encontre vagas que me interessem.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-021-1:** WHEN o visitante acessa a lista de vagas, the system SHALL exibir apenas vagas com status "ativo" ordenadas por data de publicação (mais recente primeiro).
- **AC-021-2:** WHEN o visitante aplica filtros, the system SHALL atualizar a lista respeitando todos os filtros simultaneamente.
- **AC-021-3:** WHEN o visitante usa busca textual, the system SHALL aplicar match case-insensitive ignorando acentos sobre título, descrição e requisitos.
- **AC-021-4:** WHERE a vaga é visualizada por visitante anônimo, the system SHALL anonimizar o nome da Empresa (exibindo apenas o setor).
- **AC-021-5:** WHERE a vaga é visualizada por Pessoa autenticada, the system SHALL exibir o nome da Empresa.

##### USP-022: Ver detalhe da vaga

*Como* **qualquer pessoa (anônima ou autenticada)**, *quero* ver descrição completa, requisitos, benefícios e dados da empresa (quando autenticado) de uma vaga, *para que* eu decida se quero me candidatar.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-022-1:** WHEN o visitante anônimo abre o detalhe, the system SHALL exibir todos os dados da vaga e anonimizar a Empresa.
- **AC-022-2:** WHEN a Pessoa autenticada com papel candidato abre o detalhe, the system SHALL exibir nome da Empresa e botão "candidatar-se".
- **AC-022-3:** The system SHALL exibir contador de candidaturas ("N pessoas se candidataram").

##### USP-023: Editar vaga (pausar, arquivar, renovar)

*Como* **Pessoa-responsável da Empresa**, *quero* editar a vaga (volta a rascunho), pausá-la temporariamente, arquivá-la, ou renovar sua validade, *para que* a vaga reflita o momento do recrutamento.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-023-1:** WHEN o responsável edita uma vaga ativa, the system SHALL alterar status para "rascunho" e exigir nova moderação antes de voltar a "ativo".
- **AC-023-2:** WHEN o responsável pausa a vaga, the system SHALL alterar status para "pausado" (oculta da busca, mas não exige nova moderação para reativar).
- **AC-023-3:** WHEN o responsável arquiva, the system SHALL alterar status para "arquivado".
- **AC-023-4:** WHEN o responsável prorroga a validade, the system SHALL permitir nova data de validade futura sem exigir nova moderação se a vaga ainda está ativa.

##### USP-024: Expiração automática de vaga

*Como* **sistema**, *quero* alterar automaticamente o status da vaga para "expirado" na data de validade, *para que* vagas vencidas não fiquem visíveis para candidatos.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-024-1:** WHEN a data de validade é atingida (timezone América/São_Paulo), the system SHALL alterar o status da vaga para "expirado" automaticamente.
- **AC-024-2:** The system SHALL ocultar vagas expiradas da busca pública.
- **AC-024-3:** The system SHALL enviar e-mail à Empresa-responsável 3 dias antes da expiração avisando.


#### Épico 6 — Candidaturas e Busca de Candidatos

##### USP-025: Candidatar-se a uma vaga

*Como* **Pessoa com papel candidato ativo**, *quero* candidatar-me a uma vaga ativa, *para que* a Empresa veja meu interesse e considere meu perfil.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-025-1:** WHEN o candidato clica em "candidatar-se" em uma vaga ativa, the system SHALL persistir a candidatura, enviar e-mail de confirmação ao candidato e tornar o contato do candidato visível para a Empresa.
- **AC-025-2:** IF o candidato já tem candidatura ativa (não cancelada) à mesma vaga, THEN the system SHALL bloquear nova candidatura.
- **AC-025-3:** IF o perfil do candidato não está com status "ativo" (não foi moderado), THEN the system SHALL bloquear a candidatura.

##### USP-026: Cancelar candidatura

*Como* **candidato**, *quero* cancelar uma candidatura que eu fiz, *para que* eu me desfaça de uma candidatura que não faz mais sentido.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-026-1:** WHEN o candidato cancela uma candidatura ativa, the system SHALL marcá-la como "cancelada" e ocultar da lista da Empresa.
- **AC-026-2:** WHEN a candidatura é cancelada, the system SHALL permitir nova candidatura à mesma vaga posteriormente.

##### USP-027: Empresa ver lista de candidatos da vaga

*Como* **Pessoa-responsável da Empresa**, *quero* ver a lista de candidatos que se candidataram a uma vaga minha, com seus dados de contato e CVs, *para que* eu avalie e entre em contato com os candidatos.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-027-1:** WHEN o responsável abre a vaga dele, the system SHALL listar todas as candidaturas ativas (não canceladas) com nome do candidato, contato (e-mail e telefone), e link para CV.
- **AC-027-2:** WHERE a candidatura veio de encaminhamento ASONSEG, the system SHALL exibir badge visível "Candidato encaminhado pela ASONSEG".
- **AC-027-3:** The system SHALL exibir data e hora da candidatura.

*Notas:* Sem gerenciamento de status de candidatura no MVP — empresa usa seu próprio processo fora do sistema. Status (vista, entrevistada, contratada) fica para V2.

##### USP-028: Empresa buscar candidatos (busca ativa)

*Como* **Pessoa-responsável da Empresa**, *quero* buscar candidatos com filtros (área de interesse, escolaridade, disponibilidade, localização) e texto livre, *para que* eu encontre profissionais para minhas vagas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-028-1:** WHEN o responsável acessa a busca de candidatos, the system SHALL listar candidatos com status "ativo" ordenados por data de cadastro.
- **AC-028-2:** WHEN o responsável aplica filtros, the system SHALL atualizar a lista respeitando todos os filtros.
- **AC-028-3:** The system SHALL exibir, para cada candidato na lista: primeiro nome, cidade/região, área de interesse principal, escolaridade e qualificações resumidas.
- **AC-028-4:** The system SHALL ocultar dados sensíveis (CPF, contato completo, endereço, CV) até que o candidato se candidate a uma vaga da Empresa.


#### Épico 7 — Serviços

##### USP-029: Publicar serviço

*Como* **Pessoa com papel prestador de serviço OU Pessoa-responsável de uma Empresa**, *quero* publicar um serviço em meu nome (PF) ou em nome de uma Empresa que represento, *para que* clientes descubram e contratem.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-029-1:** WHEN o usuário inicia o cadastro de serviço, the system SHALL exigir escolha entre "publicar como PF" ou "publicar em nome de [Empresa X]" (lista das empresas que a Pessoa representa).
- **AC-029-2:** WHEN o serviço é submetido, the system SHALL persistir com status "em moderação".
- **AC-029-3:** The system SHALL exigir título, categoria, descrição, valor, unidade (por hora/diária/serviço/etc.), região(ões) de atendimento e disponibilidade (dias e horários).
- **AC-029-4:** The system SHALL permitir até 3 fotos do trabalho (JPG/PNG/WEBP até 5MB cada) opcionalmente.

##### USP-030: Buscar serviços (pública)

*Como* **qualquer pessoa (anônima ou autenticada)**, *quero* buscar serviços com filtros (categoria, faixa de preço, região, disponibilidade), *para que* eu encontre serviços que precisar.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-030-1:** WHEN o visitante acessa a lista de serviços, the system SHALL exibir apenas serviços com status "ativo" ordenados por data de publicação.
- **AC-030-2:** WHEN o visitante aplica filtros, the system SHALL atualizar a lista respeitando os filtros.
- **AC-030-3:** The system SHALL aplicar busca textual case-insensitive sem acentos sobre título, descrição e categoria.

##### USP-031: Ver detalhe do serviço

*Como* **qualquer pessoa**, *quero* ver descrição completa, fotos, valor, região e nome do prestador (ou Empresa), *para que* eu decida se quero contratar.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-031-1:** WHEN o visitante (anônimo ou autenticado) abre o detalhe, the system SHALL exibir nome do prestador/Empresa, categorias, descrição, fotos, valor, região e disponibilidade.
- **AC-031-2:** The system SHALL ocultar telefone e e-mail do prestador até manifestação de interesse autenticada.
- **AC-031-3:** WHEN a Pessoa autenticada manifesta interesse, the system SHALL exibir o contato do prestador (US-032).

##### USP-032: Editar serviço (pausar, arquivar)

*Como* **prestador de serviço (PF ou via Empresa)**, *quero* editar (volta a rascunho), pausar ou arquivar o meu serviço, *para que* o serviço reflita meu momento atual.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-032-1:** WHEN o prestador edita um serviço ativo, the system SHALL alterar status para "rascunho" e exigir nova moderação.
- **AC-032-2:** WHEN o prestador pausa, the system SHALL alterar status para "pausado".
- **AC-032-3:** WHEN o prestador arquiva, the system SHALL alterar status para "arquivado".

*Notas:* Serviço não tem validade automática. Fica ativo até o prestador pausar/arquivar.


#### Épico 8 — Manifestação de Interesse em Serviço

##### USP-033: Manifestar interesse em serviço

*Como* **Pessoa autenticada (papel cliente ativado automaticamente se for primeira vez)**, *quero* manifestar interesse em um serviço e ver o contato do prestador, *para que* eu possa contratar o serviço.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-033-1:** WHEN o cliente clica em "entrar em contato" em um serviço ativo, the system SHALL persistir a manifestação, exibir o contato do prestador e enviar e-mail ao prestador avisando do interesse.
- **AC-033-2:** WHERE o cliente ainda não tem papel "cliente de serviço" ativo, the system SHALL ativar o papel automaticamente sem formulário adicional.
- **AC-033-3:** The system SHALL permitir múltiplas manifestações simultâneas em serviços diferentes.

##### USP-034: Cancelar manifestação de interesse

*Como* **cliente de serviço**, *quero* cancelar uma manifestação que fiz, *para que* minha lista de interesses reflita realidade.

**Prioridade:** Should

**Critérios de Aceitação (EARS):**

- **AC-034-1:** WHEN o cliente cancela, the system SHALL marcar a manifestação como "cancelada".

##### USP-035: Prestador ver manifestações de interesse

*Como* **prestador de serviço**, *quero* ver lista de pessoas que manifestaram interesse no(s) meu(s) serviço(s), *para que* eu saiba quem me procurou e possa retomar o contato.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-035-1:** WHEN o prestador abre seu painel, the system SHALL listar manifestações ativas com nome do cliente, contato, data e serviço referenciado.


#### Épico 9 — Ficha Social, Encaminhamento e Visão Consolidada

##### USP-036: Cadastrar ficha socioeconômica da Pessoa

*Como* **assistente social**, *quero* cadastrar dados socioeconômicos da Pessoa (renda aproximada, benefício social recebido, situação de moradia, composição familiar simplificada), *para que* eu mantenha o registro social mínimo para encaminhamento e acompanhamento.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-036-1:** WHEN a assistente social acessa o cadastro social de uma Pessoa, the system SHALL exibir os campos: renda aproximada, benefício social recebido, situação de moradia, composição familiar declarada (texto/número).
- **AC-036-2:** The system SHALL permitir editar a qualquer momento e registrar log das alterações.
- **AC-036-3:** The system SHALL impedir o acesso aos dados sociais por qualquer Pessoa que não tenha papel de assistente social ou diretoria.

*Notas:* Família (entidade estruturada) NÃO entra no MVP — ficará no Release 2. Composição familiar é texto/número declarado, sem amarrar a entidade Família. Ver ADR-0012.

##### USP-037: Encaminhar Pessoa para vaga

*Como* **assistente social, coordenador ou voluntário com permissão delegada**, *quero* encaminhar uma Pessoa já cadastrada para uma vaga ativa, *para que* a Empresa receba a recomendação institucional da ASONSEG.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-037-1:** WHEN o usuário autorizado submete um encaminhamento com Pessoa e vaga selecionadas, the system SHALL persistir o encaminhamento.
- **AC-037-2:** WHERE a Pessoa não tem papel candidato ativo, the system SHALL ativar o papel automaticamente.
- **AC-037-3:** WHERE a Pessoa não tem CV anexo, the system SHALL exigir resumo profissional textual obrigatório como parte do encaminhamento.
- **AC-037-4:** The system SHALL persistir motivo do encaminhamento como campo opcional.
- **AC-037-5:** WHEN o encaminhamento é persistido, the system SHALL gerar candidatura à vaga com badge "Candidato encaminhado pela ASONSEG" e enviar e-mail informativo à Pessoa encaminhada.
- **AC-037-6:** The system SHALL permitir múltiplos encaminhamentos da mesma Pessoa para vagas diferentes.
- **AC-037-7:** IF a vaga não está com status "ativo", THEN the system SHALL bloquear o encaminhamento.

*Notas:* Ver ADR-0016.

##### USP-038: Registrar resultado do encaminhamento manualmente

*Como* **assistente social ou usuário autorizado**, *quero* registrar manualmente o resultado de um encaminhamento (contratado, não selecionado, sem resposta, em análise) quando souber por canal externo, *para que* ASONSEG acompanhe o impacto institucional do encaminhamento.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-038-1:** WHEN o usuário autorizado registra resultado em um encaminhamento, the system SHALL persistir resultado + observação textual + data.

##### USP-039: Visão consolidada da Pessoa

*Como* **assistente social ou diretoria**, *quero* abrir a ficha de uma Pessoa e ver: dados pessoais, papéis ativos, ficha socioeconômica, candidaturas ativas e históricas, encaminhamentos, serviços oferecidos, manifestações de interesse, e papéis organizacionais na ASONSEG, *para que* eu tenha visão integral da relação da Pessoa com a ASONSEG.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-039-1:** WHEN o usuário autorizado abre a ficha consolidada, the system SHALL exibir todas as dimensões da Pessoa em painel único.
- **AC-039-2:** The system SHALL respeitar visibilidade por papel: voluntário comum não acessa essa visão; coordenador acessa apenas dados operacionais relevantes à sua área.


#### Épico 10 — Extração de CV via IA Generativa

##### USP-040: Extração automática de CV via IA generativa

*Como* **candidato**, *quero* fazer upload do meu currículo em PDF/DOC/DOCX e ter os campos do formulário pré-preenchidos automaticamente, *para que* eu economize tempo no cadastro.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-040-1:** WHEN o candidato faz upload do CV (PDF, DOC ou DOCX até 5MB), the system SHALL invocar serviço de IA generativa para extrair campos estruturados (escolaridade, área de formação, experiência, habilidades, cursos).
- **AC-040-2:** WHEN a extração retorna, the system SHALL pré-preencher os campos do formulário e exibir os valores para validação obrigatória pelo candidato.
- **AC-040-3:** IF a extração falha ou retorna vazia, THEN the system SHALL deixar os campos vazios para preenchimento manual sem mensagem de erro disruptiva.
- **AC-040-4:** The system SHALL exigir confirmação explícita do candidato antes de salvar os dados extraídos.
- **AC-040-5:** The system SHALL armazenar o arquivo original do CV vinculado ao candidato.

*Notas:* Provedor de IA generativa a ser decidido pelo Arquiteto (Q-aberta Fase 0). Implicações LGPD: o CV passa pelo provedor LLM — termo de consentimento do candidato deve cobrir essa finalidade. Ver ADR-0018.


#### Épico 11 — Indicadores e Relatórios

##### USP-041: Home pública com indicadores em tempo real

*Como* **visitante anônimo**, *quero* ver na home do portal o número atual de vagas ativas, candidatos ativos e empresas verificadas, *para que* eu perceba que o portal tem atividade e seja motivado a participar.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-041-1:** WHEN o visitante acessa a home, the system SHALL exibir: total de vagas com status "ativo", total de candidatos com perfil "ativo", total de Empresas "verificadas".
- **AC-041-2:** The system SHALL atualizar os indicadores em tempo real (cache curto admitido — política a definir pelo Arquiteto).

##### USP-042: Relatórios operacionais do Portal

*Como* **coordenador, diretoria**, *quero* consultar relatórios básicos do portal (vagas por período/status, candidaturas por período, serviços por período/categoria, encaminhamentos, fila de moderação), *para que* eu acompanhe a operação e a prestação de contas institucional.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-042-1:** WHEN o usuário autorizado acessa um relatório, the system SHALL exibir lista filtrável por período, status e categoria.
- **AC-042-2:** The system SHALL permitir exportação em CSV e PDF (estrutura mínima viável; detalhamento de filtros/agrupamentos refinado durante sprints).

*Notas:* Detalhamento dos relatórios a refinar na Fase 0 (Q-aberta).


#### Épico 12 — Conformidade LGPD (Consentimentos)

##### USP-043: Consentimentos LGPD por finalidade

*Como* **Pessoa autenticada**, *quero* consentir explicitamente com cada finalidade de tratamento dos meus dados pessoais, *para que* eu tenha controle sobre as finalidades para as quais meus dados são usados.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-043-1:** WHEN a Pessoa ativa um papel (candidato, prestador, cliente, empresa-responsável, ficha social), the system SHALL exibir o termo de consentimento específico daquela finalidade e exigir aceite explícito antes de prosseguir.
- **AC-043-2:** The system SHALL persistir cada consentimento com: titular, finalidade, versão do termo aceita, data/hora, IP.
- **AC-043-3:** The system SHALL permitir à Pessoa visualizar seus consentimentos vigentes em painel próprio.
- **AC-043-4:** WHERE a Pessoa solicita revogação de um consentimento, the system SHALL desativar o papel/funcionalidade vinculada à finalidade revogada (sem afetar outros consentimentos da mesma Pessoa).

*Notas:* Ver ADR-0013.


#### Épico 13 — Notificações por E-mail

##### USP-044: Notificações por e-mail em eventos do portal

*Como* **sistema**, *quero* disparar e-mails automaticamente em eventos relevantes do portal, *para que* usuários sejam mantidos informados.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-044-1:** WHEN um cadastro é concluído, the system SHALL enviar e-mail de boas-vindas à Pessoa.
- **AC-044-2:** WHEN a Pessoa solicita recuperação de senha, the system SHALL enviar e-mail com link de redefinição.
- **AC-044-3:** WHEN um rascunho é aprovado, devolvido para ajustes ou rejeitado, the system SHALL enviar e-mail ao autor com decisão e motivo (quando aplicável).
- **AC-044-4:** WHEN uma candidatura é registrada, the system SHALL enviar e-mail de confirmação ao candidato.
- **AC-044-5:** WHEN uma manifestação de interesse é registrada, the system SHALL enviar e-mail ao prestador.
- **AC-044-6:** WHEN um encaminhamento é criado, the system SHALL enviar e-mail informativo à Pessoa encaminhada.
- **AC-044-7:** WHEN uma vaga está a 3 dias da expiração, the system SHALL enviar e-mail à Empresa-responsável.
- **AC-044-8:** WHEN o CV de um candidato completa N dias sem atualização (default 180, parametrizável pela diretoria), the system SHALL enviar e-mail de lembrete ao candidato (sem impacto funcional se ignorar).

---

## 6. Requisitos Não-Funcionais

### 6.1 Performance
- Tempo de resposta de operações interativas ≤ 2 segundos no p95 considerando o volume estimado.
- Geração de relatórios com exportação CSV ≤ 10s p95 para janela mensal; PDFs ≤ 20s p95.
- Home pública (com indicadores em tempo real) ≤ 1.5s no p95 — cache curto admitido.
- Extração de CV via IA generativa: tempo até retorno ≤ 30s p95 (operação assíncrona aceitável, com feedback visual).

### 6.2 Disponibilidade
- Alvo de 99% no horário operacional (8h às 21h, todos os dias).
- Janela de manutenção: 21h às 8h.

### 6.3 Segurança
- Autenticação e-mail/senha individual com bloqueio após 5 tentativas em 15 minutos.
- Senhas com hash bcrypt (ou equivalente atual).
- Autorização por papel + permissões delegáveis (catálogo finito específico do Portal definido no Glossário).
- TLS (HTTPS) em toda comunicação.
- Criptografia em repouso para dados pessoais sensíveis (CPF, dados socioeconômicos, CV).
- CAPTCHA no auto-cadastro público.
- Rate limiting amplo em todas as APIs públicas (limite por IP/usuário/endpoint — política definida pelo Arquiteto).
- Validação automática de CNPJ por dígito verificador no cadastro de Empresa.
- Log imutável de auditoria para: autenticação, alteração de permissões, edição/exclusão de conteúdo, mudança de status, configurações globais, ativação/revogação de consentimento, decisões de moderação, encaminhamentos.

### 6.4 Escalabilidade
- Volume estimado V1 (primeiro ano): centenas de Pessoas cadastradas, dezenas a centenas de vagas/serviços ativos simultaneamente — volume baixo do ponto de vista técnico.
- Tráfego público anônimo (visitante navegando vagas/serviços) é o componente mais sujeito a picos — depende da estratégia de divulgação da ASONSEG.

### 6.5 Acessibilidade
- WCAG 2.1 nível AA como diretriz; prioridades específicas a refinar com designer durante implementação.
- Atenção especial ao público com baixo letramento digital (idosos, beneficiários sociais).

### 6.6 Observabilidade
- Logs estruturados de eventos críticos.
- Monitoramento de erros (frontend e backend) com alerta a canal definido na Fase 0.
- Tracking básico de métricas funcionais (MP1–MP10).

### 6.7 Compliance — LGPD
- Base legal: consentimento documentado por finalidade (ADR-0013) e legítimo interesse institucional para a operação social.
- Retenção indefinida com finalidade de histórico institucional (ADR-0008 estendido).
- Direito de acesso (art. 19) atendido sob demanda pela AS/diretoria em até 15 dias.
- Direito de revogação de consentimento implementado: revogação desativa o papel/finalidade vinculada sem afetar outras finalidades.
- DPO (Encarregado pelo Tratamento de Dados) designado a um diretor da ASONSEG antes do go-live (Dependência D-001 mantida).
- Termo de responsabilidade do prestador/empresa/cliente declarando que ASONSEG não se responsabiliza por relações comerciais/trabalhistas resultantes.
- Uso de IA generativa para extração de CV: termo de consentimento do candidato deve cobrir explicitamente o envio do CV a provedor LLM (com preferência por provedor com Zero Data Retention).

### 6.8 Localização
- Idioma: português brasileiro.
- Fuso horário: América/São_Paulo (UTC-3).
- Moeda: BRL (R$); data: DD/MM/AAAA.

---

## 7. Dependências

| Dependência | Status | Owner | Observações |
|---|---|---|---|
| D-001 — Designação formal do DPO | A iniciar | Diretoria ASONSEG | Bloqueante para go-live. Mesmo escopo do PRD da Frente 4 — único DPO para todo o sistema ASONSEG. |
| D-002 — Termos de consentimento por finalidade e revisão jurídica | A iniciar | Diretoria ASONSEG + jurídico | Bloqueante. Múltiplos termos por finalidade (candidato, prestador, cliente, empresa-responsável, ficha social, extração via IA). Termos de responsabilidade do prestador/empresa/cliente também. |
| D-003 — Designação do sponsor pelo projeto | A definir | Diretoria ASONSEG | Mesmo sponsor da Frente 4 — um diretor com agenda disponível. Bloqueante para kickoff. |
| D-004 — Definição de metas concretas para MP1–MP10 | A iniciar | Sponsor ASONSEG + Bravi PO | Início do projeto. |
| D-005 — Refinamento de filtros/agrupamentos dos relatórios | A iniciar | Bravi PO + diretoria ASONSEG | Durante sprints. MVP entrega estrutura mínima viável. |
| D-006 — Revisão final do catálogo de permissões delegáveis do Portal | A iniciar | Bravi PO + coordenador do Portal | Fase 0. |
| D-007 — Cadastro inicial das categorias de serviço, áreas de vaga e regiões geográficas | A definir | Diretoria ASONSEG | Pré go-live; lista inicial vem do protótipo, refinada com diretoria. |
| D-008 — Escolha do provedor de IA generativa para extração de CV | A definir | Bravi Arquiteto | Considerar provedor com Zero Data Retention. Decisão técnica. |
| D-009 — Escolha do provedor de CAPTCHA | A definir | Bravi Arquiteto | reCAPTCHA v3, hCaptcha, Cloudflare Turnstile, etc. |
| D-010 — Estimativa fina pelo Tech Lead | A iniciar | Bravi Tech Lead | Sobre este PRD. Pré-requisito para nova rodada de orçamento com diretoria. |
| D-011 — Definição dos meios de verificação para reivindicação de credencial | A definir | Diretoria ASONSEG + Bravi PO | Carta com código, presencial na sede, confirmação pela AS, etc. |
| D-012 — Política de cache dos indicadores em tempo real | A definir | Bravi Arquiteto | Decisão técnica. |

---

## 8. Equipe e Modelo de Entrega

### 8.1 Modelo de contratação

Escopo fechado, preço fixo. Orçamento inicial R$ 50.000 — em revisão com a diretoria após estimativa fina.

### 8.2 Composição da squad (referência para estimativa)

| Papel | Alocação | Responsabilidade principal |
|---|---|---|
| Tech Lead / Arquiteto | A definir | Decisão arquitetural, code review, estimativa fina, escolha de stack. |
| Desenvolvedor Pleno (x2) | A definir | Implementação de features. |
| QA | A definir | Plano de teste, automação básica, exploratório. |
| UI/UX Designer | A definir | Telas críticas (busca pública, cadastro, painéis). |
| Bravi PO | A definir | Refinamento, validação, gestão de backlog. |
| DevOps | A definir | Infra mínima, CI/CD, observabilidade. |

### 8.3 Ritmo e cerimônias
- Sprints de 2 semanas; daily interna 15 min; refinamento semanal com PO; review com cliente a cada sprint; retro interna.

### 8.4 Critérios de Pronto (DoD)
- Código revisado por outro desenvolvedor.
- Testes automatizados de fluxo crítico cobrindo ACs principais.
- Deploy validado em ambiente de homologação.
- Aprovação do PO da Bravi (e do sponsor da ASONSEG quando aplicável).
- Log de auditoria validado quando a US envolve operação rastreável.

---

## 9. Backlog Priorizado (MoSCoW)

- **Must Have:** USP-001, USP-002, USP-003, USP-004, USP-005, USP-006, USP-007, USP-008, USP-009, USP-010, USP-011, USP-012, USP-013, USP-014, USP-015, USP-016, USP-017, USP-018, USP-020, USP-021, USP-022, USP-023, USP-024, USP-025, USP-026, USP-027, USP-028, USP-029, USP-030, USP-031, USP-032, USP-033, USP-035, USP-036, USP-037, USP-038, USP-039, USP-040, USP-041, USP-042, USP-043, USP-044
- **Should Have:** USP-019, USP-034
- **Could Have:** —
- **Won't Have (este release):** —

> **Observação:** priorização representa o escopo levantado integralmente; fatiamento real (se necessário) ocorrerá após estimativa fina do Tech Lead e nova rodada com diretoria, gerando ADR específico de fatiamento se aplicável.

---

## 10. Decisões Registradas (ADRs)

ADRs deste release em arquivos próprios em `decisions/`. ADRs ADR-0001 a ADR-0010 do PRD da Frente 4 permanecem aplicáveis ao Release 2 (consultar `prd-asonseg-frente4-v2`).

- ADR-0011 — Pessoa como entidade fundamental, login único e papéis compostos
- ADR-0012 — Beneficiário como papel social da Pessoa (revisão parcial do ADR-0002)
- ADR-0013 — Consentimentos LGPD por finalidade (extensão do ADR-0003)
- ADR-0014 — Empresa sem login próprio, com Pessoas-responsáveis (vínculo N:N)
- ADR-0015 — Moderação humana pré-publicação como diferencial do Portal
- ADR-0016 — Encaminhamento como entidade do domínio social
- ADR-0017 — Visibilidade conservadora de dados pessoais entre papéis
- ADR-0018 — Extração de CV via IA generativa (best effort, validação humana obrigatória)

---

## 11. Glossário do Domínio

| Termo | Definição |
|---|---|
| Pessoa | Entidade fundamental do sistema ASONSEG. Identificada por CPF (com exceção controlada) e e-mail (único). Possui login (opcional para Pessoa cadastrada pela AS). Acumula livremente múltiplos papéis ativos. |
| Papel | Função que uma Pessoa exerce no sistema. Papéis públicos: candidato, prestador de serviço, cliente de serviço, empresa-responsável. Papéis sociais: beneficiário (no Release 2). Papéis organizacionais: voluntário, coordenador, assistente social, diretoria. |
| Empresa | Entidade jurídica (CNPJ regular ou MEI) cadastrada dentro do portal por uma Pessoa que vira sua responsável principal. NÃO tem login próprio. Pode ter múltiplas Pessoas-responsáveis simultaneamente. |
| Pessoa-responsável de Empresa | Vínculo N:N entre Pessoa e Empresa com tipo "responsável". Toda Empresa precisa ter ao menos uma Pessoa-responsável ativa. |
| Empresa verificada | Empresa cuja primeira vaga foi aprovada (e portanto teve dados validados manualmente pelo coordenador da área Portal). |
| Candidato | Papel público de Pessoa que cadastra perfil com qualificações e currículo, e pode se candidatar a vagas. |
| Prestador de serviço | Papel público de Pessoa que publica serviços (em nome próprio como PF, ou em nome de uma Empresa que representa). |
| Cliente de serviço | Papel público de Pessoa que manifesta interesse em serviços (ativado automaticamente na primeira manifestação). |
| Vaga | Conteúdo publicado por Empresa-responsável; tem validade obrigatória; passa por moderação humana pré-publicação; após aprovada, fica visível na busca pública até expirar/pausar/arquivar. |
| Serviço | Conteúdo publicado por Pessoa-prestador (PF) ou em nome de Empresa; sem validade automática; passa por moderação humana pré-publicação; fica ativo até o autor pausar/arquivar. |
| Candidatura | Vínculo entre candidato e vaga, criado pelo candidato. Silenciosa — apenas notifica candidato e revela contato para Empresa. Cancelável; permite recandidatura. |
| Manifestação de interesse | Vínculo entre cliente e serviço; revelação imediata do contato do prestador; e-mail informativo ao prestador. Cancelável; múltiplas simultâneas. |
| Encaminhamento | Ação institucional da ASONSEG: assistente social, coordenador ou voluntário delegado encaminha uma Pessoa para uma vaga. Ativa papel candidato automaticamente. Gera candidatura com badge "Encaminhado pela ASONSEG". Resultado registrável manualmente. |
| Ficha socioeconômica | Conjunto de dados sociais da Pessoa (renda aproximada, benefício social, situação de moradia, composição familiar declarada) mantido pela assistente social. Acessível apenas à AS e diretoria. NÃO inclui a entidade Família estruturada — essa fica para o Release 2. |
| Moderação humana pré-publicação | Fluxo em que toda vaga, CV e serviço entra como "rascunho" e exige revisão do coordenador da área Portal (ou voluntário delegado) com decisão de aprovar, devolver para ajustes ou rejeitar antes de ficar visível no portal. |
| Status do conteúdo | Rascunho / em moderação / aguardando ajustes / ativo / pausado / expirado (vaga) / arquivado / rejeitado. |
| Consentimento por finalidade | Aceite explícito da Pessoa para tratamento de seus dados pessoais com uma finalidade específica (candidatura, prestação de serviço, encaminhamento social, extração via IA, etc.). Modelo LGPD do Portal: múltiplos consentimentos por Pessoa, com versão, data, IP, revogáveis individualmente. |
| Visão consolidada da Pessoa | Tela exclusiva de AS e diretoria que apresenta a Pessoa em todas as suas dimensões (papéis, candidaturas, encaminhamentos, serviços, ficha social, papéis organizacionais) num painel único. |
| Permissão delegável (Portal) | Permissão administrativa do Portal que o coordenador da área pode conceder a voluntários individualmente. Catálogo inicial: (1) moderar vaga; (2) moderar CV/perfil de candidato; (3) moderar serviço; (4) validar Empresa na primeira vaga; (5) inativar conteúdo publicado; (6) encaminhar Pessoa para vaga; (7) aprovar sugestão de nova categoria/área; (8) registrar resultado de encaminhamento; (9) reivindicação de credencial. Estende o catálogo do ADR-0001. |
| Reivindicação de credencial | Fluxo em que uma Pessoa pré-cadastrada pela AS (sem login) ativa uma credencial de acesso, mediante verificação de identidade conforme processo da ASONSEG. |
| Extração de CV via IA | Funcionalidade que processa o CV anexado pelo candidato (PDF/DOC/DOCX) via IA generativa e pré-preenche os campos estruturados do formulário para validação humana obrigatória do candidato. Best effort — falha não bloqueia o cadastro. |
| Categoria de serviço / Área de vaga | Classificação estruturada de conteúdo. Lista pré-cadastrada pela diretoria, com possibilidade de o usuário sugerir nova categoria/área que vira pendência para aprovação. |
| Região geográfica | Bairro/cidade onde vaga ou serviço acontece. Dado mestre gerenciado pela diretoria (lista de bairros de Florianópolis no MVP). |
| Auditoria imutável | Log inalterável de eventos críticos: autenticação, alteração de permissão, edição/exclusão de conteúdo, mudança de status, configuração global, ativação/revogação de consentimento, decisões de moderação, encaminhamentos. |

---

## 12. Perguntas em Aberto

| ID | Pergunta | Owner (cliente) | Prazo | Impacto se não respondida |
|---|---|---|---|---|
| QP-001 | Meios concretos de verificação de identidade na reivindicação de credencial | Diretoria + AS ASONSEG | Fase 0 | Carta com código? Presencial? Confirmação por AS via canal seguro? Combinação? |
| QP-002 | Provedor de IA generativa para extração de CV (Anthropic, OpenAI, Bedrock, etc.) | Bravi Arquiteto | Fase 0 | Critério LGPD: preferência por Zero Data Retention. |
| QP-003 | Provedor de CAPTCHA (reCAPTCHA v3, hCaptcha, Turnstile) | Bravi Arquiteto | Fase 0 | Critério: custo e UX (público da ASONSEG inclui baixo letramento digital). |
| QP-004 | Política de cache dos indicadores em tempo real da home | Bravi Arquiteto | Fase 0 | Cache de 1 min? 5 min? Mais? Decisão técnica. |
| QP-005 | Detalhamento dos filtros e agrupamentos por relatório | Bravi PO + diretoria | Sprints iniciais | MVP entrega estrutura mínima; refinamento iterativo. |
| QP-006 | Revisão final do catálogo de permissões delegáveis do Portal | Bravi PO + coordenador do Portal | Fase 0 | Lista inicial no Glossário, sujeita a revisão. |
| QP-007 | Metas concretas para MP1–MP10 | Sponsor ASONSEG + Bravi PO | Início do projeto | Definir números absolutos com o sponsor. |
| QP-008 | Política de retenção de logs de auditoria operacional | Diretoria ASONSEG + Bravi Arquiteto | Pré go-live | Decisão técnica + compliance. |
| QP-009 | Estratégia de divulgação inicial do portal pela ASONSEG | Diretoria ASONSEG | Pré go-live | Marketing/comunicação para a comunidade — fora do escopo do desenvolvimento, mas afeta volume e pico de tráfego. |
| QP-010 | Lista inicial de regiões geográficas, categorias de serviço e áreas de vaga | Diretoria ASONSEG | Pré go-live | Refinamento da lista do protótipo. |

---

## 13. Riscos de Negócio

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| RP-001 — Escopo (com fundação compartilhada) maior que orçamento aprovado | Alta | Alto | Estimativa fina do Tech Lead em sequência; nova rodada com diretoria; ADR de fatiamento se necessário. |
| RP-002 — DPO não designado a tempo do go-live | Média | Alto | Dependência D-001 bloqueante; acompanhamento próximo pelo Bravi PO. |
| RP-003 — Termos de consentimento por finalidade não revisados a tempo | Média | Alto | Dependência D-002; revisão jurídica em paralelo ao desenvolvimento; volume e diversidade de termos (candidato, prestador, cliente, empresa, ficha social, IA) maior que da Frente 4. |
| RP-004 — Carga de moderação inviabiliza operação | Média | Alto | Sem SLA formal no MVP; mas se volume crescer muito sem moderadores suficientes, conteúdo aprovável fica esperando. Mitigação: monitorar MP10 e dimensionar voluntários delegados conforme demanda. |
| RP-005 — Empresa-fantasma escapa da moderação manual | Média | Alto | Validação manual na primeira vaga é a principal defesa; CNPJ por dígito não basta; coordenador precisa de processo claro de inspeção. Mitigação: lista de verificação para o coordenador como entregável de Fase 0. |
| RP-006 — Adesão baixa da comunidade (pouco cadastro, pouca vaga) | Média | Médio | Depende da estratégia de divulgação da ASONSEG (QP-009). Sem tráfego orgânico via SEO no MVP — atrelado ao engajamento da rede ASONSEG. |
| RP-007 — Extração de CV via IA gera dados ruins e candidatos validam sem revisar | Baixa | Médio | AC-040-4 exige confirmação explícita do candidato; UI deve enfatizar revisão; treinamento textual no fluxo. Mitigação: monitorar MP1 vs qualidade percebida pelas empresas. |
| RP-008 — Uso de LLM com retenção de dados afeta LGPD | Média | Alto | Critério obrigatório de Zero Data Retention na escolha do provedor (QP-002); termo de consentimento explícito sobre uso de IA. |
| RP-009 — Volume de tráfego anônimo excede expectativa em pico | Baixa | Médio | Rate limiting amplo; arquitetura básica suporta volume baixo (premissa). Crescimento abrupto exigiria upgrade. |
| RP-010 — Ausência de fluxo formal de denúncia atrasa resposta a conteúdo problemático | Média | Médio | Canal externo via e-mail institucional; coordenador inativa via USP-018. V2 pode formalizar. |
| RP-011 — Sponsor não designado a tempo do kickoff | Média | Alto | Dependência D-003; bloqueante. Mesmo sponsor da Frente 4 (compartilhado). |

---

## Anexo A — Histórico de mudanças

Histórico mantido em `CHANGELOG.md`. Este PRD reflete sempre o estado atual; mudanças entre versões consultáveis no CHANGELOG.
