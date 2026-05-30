# Expectations — USP-028: Empresa buscar candidatos (busca ativa)

**Origem:** AC-028-1 a AC-028-4 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa-responsável de Empresa **com vaga ativa** acessa a busca de candidatos, the system SHALL listar candidatos com status "ativo" (perfil moderado e aprovado — USP-009) ordenados por data de cadastro.
  ✅ RESOLVIDO (dono do intent): exige vaga ativa da Empresa (proporcionalidade LGPD finalidade 2).

  *Ajuste do AC-028-1:* explicita restrição "com vaga ativa" como defesa contra F1 do intent (mineração).

- **E-002:** WHEN a Pessoa-responsável aplica filtros (área de interesse, escolaridade, disponibilidade, localização), the system SHALL atualizar a lista respeitando todos em AND lógico.

- **E-003:** The system SHALL exibir, para cada candidato na lista: primeiro nome, cidade/região, área de interesse principal, escolaridade e qualificações resumidas **sanitizadas** (sem padrões óbvios de PII — e-mail, telefone, CPF removidos do texto livre).

  *Ajuste do AC-028-3:* explicita sanitização de PII no texto livre (toca F2 do intent).

- **E-004:** The system SHALL ocultar dados sensíveis (CPF, contato completo, endereço, CV completo) até que o candidato se candidate a uma vaga da Empresa (USP-025), conforme ADR-0017.

- **E-005:** The system SHALL exibir, ao candidato, na tela de aceite do consentimento da finalidade 2 (USP-009/USP-043), comunicação clara de que **o perfil aparecerá na busca ativa de empresas**.

  *Ajuste:* AC do PRD não cobre comunicação ao candidato; vem do F4 do intent (sentimento de surveillance).

## 2. Proibições (must-not)

- **P-001 (toca F1 — mineração):** O sistema NÃO PODE permitir busca ativa por Empresa-responsável sem vaga ativa publicada (alternativamente, sem ter participado de moderação aprovada nos últimos N meses). Defesa contra "Empresa criada apenas para minerar".
  ✅ RESOLVIDO (dono do intent): exige vaga ativa da Empresa; a cobertura jurídica da finalidade 2 permanece como gate D-001/D-002.

- **P-002 (toca F2 — PII vaza no texto livre):** O sistema NÃO PODE exibir qualificações resumidas com padrões óbvios de PII (e-mail, telefone, CPF, RG). Sanitização automática + aviso visível ao candidato no preenchimento de "não inclua telefone/e-mail/CPF aqui — esses campos serão revelados após candidatura".

- **P-003 (toca F3 — base grande sem relevância):** O sistema NÃO PODE deixar a busca sem indicação de relevância **e** sem mensagem clara sobre o estado "sem relevância semântica no MVP". Decisão consciente exige UX que torne isso visível (badge "ordenação por data de cadastro").

- **P-004 (toca F4 — surveillance sem aviso):** O sistema NÃO PODE incluir candidato na busca ativa sem que o consentimento da finalidade 2 cubra explicitamente esse uso. Sem cobertura, USP fica em gate jurídico.

- **P-005:** O sistema NÃO PODE permitir buscas em massa programáticas (scraping) por uma Empresa — rate limiting agressivo + alerta operacional em volumes anômalos.

- **P-006:** O sistema NÃO PODE registrar busca individualizada (queries da Empresa) sem auditoria — em caso de incidente LGPD, prestação de contas exige saber quem buscou o quê e quando.

## 3. Limites

- **L-001 (Performance):** Lista carrega ≤ 2s p95.
- **L-002 (Paginação):** Resultado paginado (tamanho a definir).
- **L-003 (Rate limiting):** Buscas por Empresa limitadas por janela.
  ✅ RESOLVIDO (ADR-0029): rate limit agressivo por rota/identidade (Empresa-responsável) com alerta operacional em volumes anômalos (anti-scraping/anti-enumeração); o limite concreto é parâmetro tunável.
- **L-004 (Auditoria):** Cada query registrada (Empresa-responsável que buscou, filtros aplicados, momento).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate jurídico — BLOQUEANTE):** Antes desta USP ir para produção, o **D-001 + D-002 do PRD** confirmam: (a) DPO designado; (b) consentimento da finalidade 2 cobre explicitamente a aparição em busca ativa. Sem essas confirmações por escrito, a USP **não vai para produção** — RP-003 indireto + risco proposto de mineração ficam desprotegidos.

- **D-002:** A Empresa-responsável, em ensaio, busca por "vendas + Londrina + ensino médio" e vê 8 candidatos com dados resumidos sem PII no texto livre. Validado por inspeção do conteúdo (engenheiro Bravi + sponsor).

- **D-003:** Em teste de PII no texto livre: candidato preenche "Telefone: 11 99999-9999, Email: x@y.com" nas qualificações; sistema sanitiza ou alerta antes do submit. Validado em USP-009 + visão em USP-028.

- **D-004:** Em teste de Empresa sem vaga ativa: tentativa de acesso à busca de candidatos é bloqueada (ou liberada conforme decisão acordada em E-001).

- **D-005:** A coordenadora abre auditoria de buscas de uma Empresa e vê o histórico (queries, datas, candidatos retornados em volume).

- **D-006:** O candidato, em ensaio, vê durante o cadastro USP-009 a comunicação clara: "Seu perfil ficará visível para empresas via busca ativa, sem dados sensíveis até você se candidatar".
