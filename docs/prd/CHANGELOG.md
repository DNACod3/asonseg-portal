# CHANGELOG — Projeto ASONSEG

Histórico de versões do PRD e dos ADRs do projeto.
Convenção: versão maior incrementa em mudança estrutural de escopo; versão menor incrementa em refinamento/correção.

---

## v0.3 (2026-05-22) — PRD do MVP Portal Empregabilidade e Serviços

### Entrega

Primeira versão completa do PRD do **MVP do projeto ASONSEG**: o **Portal Empregabilidade e Serviços** (Release 1), produzido após 14 blocos de elicitação conversacional com o cliente.

**Artefatos publicados nesta versão:**

- **PRD MVP Portal** (`prd-asonseg-portal-mvp.docx` e `prd-asonseg-portal-mvp.md`)
  - 13 seções padrão Bravi (visão, personas, escopo, métricas, requisitos funcionais, RNFs, dependências, equipe, backlog, decisões, glossário, perguntas em aberto, riscos).
  - 44 User Stories (USP-001 a USP-044) distribuídas em 13 épicos, todas com critérios de aceitação em EARS.
  - 20 itens de out-of-scope com justificativa.
  - 10 métricas (MP1 a MP10) com baselines = 0 (sistema novo) e metas a definir com sponsor.
  - 12 dependências (D-001 a D-012) com owner e status.
  - 10 perguntas em aberto (QP-001 a QP-010).
  - 11 riscos (RP-001 a RP-011) com mitigação.
  - Glossário com 23 termos do domínio do Portal.

- **8 ADRs novos** sobre as decisões estruturantes do MVP do Portal e da fundação compartilhada:
  - ADR-0011 — Pessoa como entidade fundamental, login único e papéis compostos
  - ADR-0012 — Beneficiário como papel social da Pessoa (revisão parcial do ADR-0002)
  - ADR-0013 — Consentimentos LGPD por finalidade (extensão do ADR-0003)
  - ADR-0014 — Empresa sem login próprio, com Pessoas-responsáveis (vínculo N:N)
  - ADR-0015 — Moderação humana pré-publicação como diferencial do Portal
  - ADR-0016 — Encaminhamento como entidade do domínio social
  - ADR-0017 — Visibilidade conservadora de dados pessoais entre papéis
  - ADR-0018 — Extração de CV via IA generativa (best effort, validação humana obrigatória)

### Principais decisões registradas

**Identidade e arquitetura (Cenário 1 — identidade unificada plena):**
- Pessoa é a entidade fundamental do sistema; login único; papéis compostos livremente (ADR-0011).
- Beneficiário deixa de ser entidade separada e vira papel social da Pessoa (ADR-0012).
- Empresa não tem login próprio; Pessoa-responsável opera em nome dela (ADR-0014).
- Múltiplos papéis públicos (candidato, prestador, cliente, empresa-responsável) ativáveis em auto-serviço; conteúdo publicado entra em moderação humana (ADR-0015).

**LGPD:**
- Consentimentos múltiplos por finalidade — 8 finalidades previstas no MVP (ADR-0013).
- Visibilidade conservadora: dados pessoais ocultos por padrão, revelação após autenticação + ação afirmativa (ADR-0017).
- Termos de responsabilidade do prestador, empresa e cliente.
- Retenção indefinida com base institucional (ADR-0008 estendido).

**Operação:**
- Toda vaga, CV e serviço passa por moderação humana pré-publicação por coordenador da área Portal Empregabilidade ou voluntário delegado (ADR-0015).
- Validação manual da Empresa na primeira vaga publicada (anti-empresa-fantasma).
- Sem SLA formal de moderação; sem sistema de denúncia no MVP (escapa via inativação manual pelo coordenador).
- Encaminhamento institucional de Pessoa para vaga como entidade própria — diferencial ASONSEG (ADR-0016).

**Tecnológicas:**
- Extração de CV via IA generativa (LLM) com validação humana obrigatória; provedor com Zero Data Retention preferencial (ADR-0018).
- Match exato robusto (case-insensitive, sem acentos) no MVP; busca semântica para V2.
- Ordenação por mais recente no MVP; algoritmo de relevância para V2.
- Só e-mail no MVP; WhatsApp e push para V2.
- Sem SEO no MVP; captação inicial pela comunidade ASONSEG.
- CAPTCHA no auto-cadastro; rate limiting amplo.

**Escopo e prioridades:**
- Ficha socioeconômica mínima da Pessoa entra no MVP; Família estruturada fica para Release 2.
- Sem gerenciamento de status de candidatura no MVP (Kanban Recebida → Vista → Contratado vai para V2).
- Convite por e-mail para adicionar responsável de Empresa fica para V2 (Pessoa precisa estar pré-cadastrada).

### Próximos passos do projeto

1. Cliente revisa o pacote completo do MVP do Portal.
2. Tech Lead/Arquiteto da Bravi roda estimativa fina sobre este PRD (Dependência D-010).
3. Cliente apresenta cenários à diretoria ASONSEG para decisão de orçamento.
4. Possível ADR-0019 de fatiamento se a estimativa exceder o orçamento aprovado.
5. Execução do Release 1 (Portal).
6. Reativação do PRD da Frente 4 (`prd-asonseg-frente4-v2`) para execução do Release 2.

### Observações

- Estimativa qualitativa de PO sobre o escopo do MVP do Portal (Cenário 1 — com fundação compartilhada) indica faixa provável de **R$ 80–150k**, acima do orçamento inicial aprovado de R$ 50k. Risco RP-001 registrado.
- ADRs ADR-0001 a ADR-0010 do PRD da Frente 4 permanecem aplicáveis ao Release 2 (com notas de reposicionamento aplicadas em v0.2). ADR-0002 e ADR-0003 são parcialmente revisados/estendidos pelos novos ADRs ADR-0012 e ADR-0013 respectivamente.

---

## v0.2 (2026-05-22) — Reposicionamento estratégico do projeto

### Decisão da diretoria ASONSEG

O **Portal Empregabilidade e Serviços** passa a ser o **MVP do projeto**. A **Frente 4 (Estoque, Logística e Fitoterápicos)** é **reposicionada para o Release 2 (V2)**.

**Justificativa registrada:**
- A gestão de beneficiários e atendimentos da Frente 4 já funciona manualmente há um bom tempo e pode continuar assim por um período adicional.
- O portal de vagas e serviços não existe hoje e foi identificado como prioridade institucional para iniciar imediatamente.

### Decisão complementar — Cenário 1 (identidade unificada plena)

Toda a fundação compartilhada do sistema é modelada **já no MVP do portal**, mesmo que algumas funcionalidades sociais só sejam ativadas no Release 2:

- **Pessoa** como entidade fundamental (login único)
- **Papéis compostos** (uma pessoa acumula livremente papéis internos, sociais e públicos)
- Autenticação e autorização unificadas
- **Consentimentos LGPD por finalidade** (múltiplos consentimentos, base legal própria)
- Auditoria imutável transversal
- **Encaminhamento** (de beneficiário para vaga) — entidade do domínio social presente no modelo
- **Visão consolidada** da pessoa para diretoria/assistente social/coordenador

### Impacto nos artefatos existentes

- **PRD da Frente 4 (v0.1 → v0.2):** rebatizado como "Release 2 (V2)", com banner de aviso de reposicionamento no topo. Conteúdo de escopo preservado integralmente.
- **ADRs ADR-0001 a ADR-0010:** todos receberam:
  - Status atualizado para "Aceito — Aplicável ao Release 2 (V2) - Frente 4".
  - Nota de reposicionamento explicitando o impacto no MVP do Portal.
- **ADR-0002 (beneficiário/família)** e **ADR-0003 (cadastro nominal e LGPD)** são os mais afetados:
  - ADR-0002 será **parcialmente revisado** por ADR novo no PRD do Portal: Beneficiário deixa de ser entidade separada e vira **papel social da Pessoa**. Família e vínculo histórico temporal permanecem.
  - ADR-0003 será **estendido** por ADR novo no PRD do Portal: consentimento único do beneficiário vira **consentimentos por finalidade** com base legal própria.

### Próximos passos do projeto

1. Elicitação completa do Portal Empregabilidade e Serviços (próxima rodada — em blocos).
2. Produção do PRD do MVP do Portal.
3. Estimativa fina pelo Tech Lead da Bravi sobre o novo MVP.
4. Decisão de orçamento com a diretoria (escopo combinado).
5. Execução do Release 1 (Portal).
6. Reativação deste PRD para execução do Release 2 (Frente 4).

### Observações

- O orçamento aprovado de R$ 50.000 será revisitado pela diretoria após a estimativa fina do MVP do Portal — estimativa qualitativa de PO sobre o Cenário 1 indica faixa provável de R$ 80–150k para o MVP, com benefício de redução significativa do custo do Release 2 (Frente 4).
- Dependências D-001 (DPO) e D-002 (revisão do termo de consentimento) **continuam bloqueantes**, agora para o MVP do Portal — e provavelmente mais críticas, dado o volume e a natureza dos novos titulares (candidatos, empresas, prestadores, clientes).

---

## v0.1 (2026-05-19) — Primeira versão para revisão

### PRD
- Versão inicial após elicitação completa com o cliente (Nei, CTO Bravi, em representação ao sponsor da ASONSEG).
- 13 seções padrão Bravi (visão, personas, escopo, métricas, requisitos funcionais, RNFs, dependências, equipe, backlog, decisões, glossário, perguntas em aberto, riscos).
- 57 user stories distribuídas em 13 épicos, todas com critérios de aceitação em EARS.
- 26 itens de out-of-scope com justificativa.
- 8 métricas (M1 a M8) com baselines a definir na Fase 0.
- 10 dependências (D-001 a D-010) com owner e status.
- 8 perguntas em aberto (Q-001 a Q-008) com prazo e impacto.
- 9 riscos (R-001 a R-009) com mitigação.
- Glossário com 28 termos do domínio.

### ADRs gerados
- ADR-0001: Modelo de permissões com delegação granular (papel + catálogo de permissões delegáveis).
- ADR-0002: Beneficiário e família como entidades separadas com vínculo histórico temporal.
- ADR-0003: Cadastro nominal de famílias atendidas e implicações LGPD (Modelo 1).
- ADR-0004: Múltiplos locais de estoque como conceito estrutural do sistema.
- ADR-0005: Indicação de necessidade como pré-requisito para saída não-cesta (modelo aberto com unicidade por categoria + tipo).
- ADR-0006: Estoque único de fitoterápico com classificação de saída (doação vs venda).
- ADR-0007: Edição/exclusão de registros com janela mensal e escalação para coordenador.
- ADR-0008: Retenção indefinida de dados pessoais e direito de acesso sob demanda.
- ADR-0009: Produção de fitoterápico fora do escopo do MVP.
- ADR-0010: Custo mínimo como diretriz arquitetural (decisão técnica delegada ao Arquiteto/Tech Lead).

### Observações
- Escopo completo levantado é maior que o orçamento inicial aprovado (R$ 50.000). Risco R-001 registrado.
- Sequência acordada (depois superada pelo reposicionamento de v0.2): Tech Lead/Arquiteto rodaria estimativa fina sobre este PRD; cliente levaria cenários à diretoria; refator do PRD para o escopo aprovado + ADR de fatiamento.
- Business model ainda não gerado — modalidade do projeto é escopo fechado, preço fixo.
