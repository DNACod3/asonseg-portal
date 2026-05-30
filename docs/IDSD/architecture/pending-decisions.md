# Registro de Decisões Pendentes — Camada ICE

**Origem:** marcadores `❓` remanescentes nos arquivos `intents/` e `expectations/` após o ciclo de resolução técnica (ADRs 0019–0030 + TD v1.1).
**Propósito:** cada decisão abaixo deve ser **solicitada da parte responsável ANTES do início da primeira atividade (USP) que a consome**. Este documento é o checklist operacional do PO + Tech Lead — nenhuma sprint que toca a atividade-gatilho deve ser iniciada sem o item correspondente resolvido (ou explicitamente waived).
**Versão:** 1.0 (2026-05-30)
**Cobertura:** 25 decisões únicas (37 marcadores `❓` remanescentes; intent e expectations da mesma USP frequentemente referenciam a mesma decisão).

---

## Como usar

1. **No planejamento de cada sprint:** consulte a coluna *Gatilho* — se a sprint inclui a USP listada como gatilho, a decisão correspondente precisa estar com status `decidido` ou `waived` ANTES do início.
2. **Trigger de solicitação:** mude `status` para `solicitado` ao enviar a pergunta ao owner. Anote a data do pedido em *Solicitado em*.
3. **Ao receber a resposta:** mude para `decidido`, registre em *Decisão* e atualize os arquivos ICE correspondentes (trocando o `❓` por `✅ RESOLVIDO`). Atualize também o TD ou ADR aplicável quando houver impacto.
4. **Waiver:** se o produto seguir sem a decisão (ex.: feature flag desliga a USP até a decisão chegar), marque `waived` + justificativa. O risco entra no log de riscos.

---

## Sumário por fase do plano de implementação

| Fase | Decisões a fechar antes |
|---|---|
| **Antes da Fase 1** | DEC-002, DEC-011, DEC-012, DEC-013, DEC-015, DEC-016, DEC-021 |
| **Antes da Fase 2** | DEC-001, DEC-003, DEC-004, DEC-005, DEC-006, DEC-018, DEC-019, DEC-020, DEC-022 |
| **Antes da Fase 3** | DEC-007, DEC-008, DEC-009, DEC-010, DEC-014, DEC-023, DEC-025 |
| **Antes do Go-Live** | DEC-017, DEC-024 |

## Sumário por owner

| Owner | Decisões |
|---|---|
| Jurídico + DPO (D-002 — redação dos termos) | DEC-001, DEC-002, DEC-003, DEC-004, DEC-005, DEC-006, DEC-007, DEC-008, DEC-009, DEC-010, DEC-011 |
| DPO Angélica (validações / interpretações) | DEC-012, DEC-013, DEC-014, DEC-015, DEC-016, DEC-017 |
| Coordenador (checklists / treinamento) | DEC-018, DEC-019, DEC-020, DEC-025 |
| Diretoria + Bravi PO | DEC-021, DEC-022, DEC-023 |
| Sponsor | DEC-024 |

---

## Registro

### DEC-001 — Forma jurídica do registro de evidência do termo físico cadastrado pela AS

- **Owner:** jurídico
- **Gate:** D-002
- **Descrição:** quando a AS cadastra Pessoa em situação extrema (USP-002), como o sistema registra a evidência do termo de consentimento assinado em papel — data + responsável (decidido) já vale como forma, ou jurídico exige upload de digitalização?
- **Gatilho:** USP-002 (cadastro pela AS) — Fase 1
- **Solicitar antes de:** Fase 1
- **Markers ICE:** [intent-USP-002:19](../ice-portal-asonseg/intents/intent-USP-002.md#L19) · [expectations-USP-002:15](../ice-portal-asonseg/expectations/expectations-USP-002.md#L15)
- **Status:** aberto

### DEC-002 — Granularidade da redação dos 8 termos (detalhada vs genérica)

- **Owner:** jurídico + DPO
- **Gate:** D-002 (meta-decisão)
- **Descrição:** os 8 termos das finalidades LGPD serão redigidos com detalhamento técnico-jurídico (mais robusto, menos legível) ou com linguagem genérica + transparente (compatível com público de baixo letramento)? Decisão estrutural que afeta todos os termos seguintes.
- **Gatilho:** USP-043 (consentimentos) — Fase 1
- **Solicitar antes de:** Fase 1 (antes da redação de qualquer termo)
- **Markers ICE:** [intent-USP-009:36](../ice-portal-asonseg/intents/intent-USP-009.md#L36)
- **Status:** aberto

### DEC-003 — Termo da finalidade 7 (extração de CV via IA) nomeando o provedor

- **Owner:** jurídico + DPO + Arquiteto
- **Gate:** D-002 + D-008 (confirmação contratual do ZDR)
- **Descrição:** termo precisa nomear explicitamente o provedor (Anthropic Claude) + cláusulas ZDR. Mudança de provedor = "major" → re-aceite de todos os candidatos (mecanismo já em ADR-0025).
- **Gatilho:** USP-009 (cadastro candidato com CV) — Fase 2; **bloqueante de produção** para USP-040 — Fase 3.
- **Solicitar antes de:** Fase 2 (USP-009 começa com extração via feature flag)
- **Markers ICE:** [intent-USP-009:31](../ice-portal-asonseg/intents/intent-USP-009.md#L31) · [intent-USP-040:31](../ice-portal-asonseg/intents/intent-USP-040.md#L31) · [intent-USP-040:36](../ice-portal-asonseg/intents/intent-USP-040.md#L36)
- **Status:** aberto

### DEC-004 — Termo de responsabilidade da Empresa (finalidade 2 — candidatura)

- **Owner:** jurídico + coordenador
- **Gate:** D-002
- **Descrição:** termo deve cobrir explicitamente "uso restrito à finalidade de avaliação para a vaga" (anti-mineração de dados de candidatos).
- **Gatilho:** USP-025 (candidatar-se) — Fase 2
- **Solicitar antes de:** Fase 2
- **Markers ICE:** [intent-USP-025:28](../ice-portal-asonseg/intents/intent-USP-025.md#L28)
- **Status:** aberto

### DEC-005 — Cobertura LGPD da finalidade 2 para busca ativa por Empresas

- **Owner:** jurídico + DPO
- **Gate:** D-001, D-002
- **Descrição:** a finalidade 2 ("candidatura a vagas") cobre o candidato APARECER em busca ativa de Empresas com vagas, ou exige uma finalidade separada? Influencia se USP-028 vai a produção sob o termo da finalidade 2 ou exige novo termo + re-aceite.
- **Gatilho:** USP-028 (Empresa busca candidatos) — Fase 2
- **Solicitar antes de:** Fase 2
- **Markers ICE:** [intent-USP-028:39](../ice-portal-asonseg/intents/intent-USP-028.md#L39)
- **Status:** aberto

### DEC-006 — Termo da finalidade 3 (oferta de serviço) cobrindo responsabilidade pelas fotos

- **Owner:** jurídico + coordenador
- **Gate:** D-002
- **Descrição:** termo de oferta de serviço deve explicitar que o prestador responde pelo conteúdo das fotos publicadas (PII de terceiros, direito de imagem).
- **Gatilho:** USP-010 (cadastro prestador) — Fase 2; USP-029 (publicar serviço) — Fase 2
- **Solicitar antes de:** Fase 2
- **Markers ICE:** [intent-USP-029:34](../ice-portal-asonseg/intents/intent-USP-029.md#L34)
- **Status:** aberto

### DEC-007 — Termo da finalidade 4 (contratação de serviço)

- **Owner:** jurídico + DPO + designer
- **Gate:** D-002
- **Descrição:** redação do termo exibido antes do clique "entrar em contato com prestador" (manifestação de interesse). UX já decidida: scroll-to-accept.
- **Gatilho:** USP-033 (manifestar interesse) — Fase 3
- **Solicitar antes de:** Fase 3
- **Markers ICE:** [intent-USP-033:24](../ice-portal-asonseg/intents/intent-USP-033.md#L24)
- **Status:** aberto

### DEC-008 — Termo da finalidade 6 (atendimento social)

- **Owner:** jurídico + DPO
- **Gate:** D-002
- **Descrição:** redação do termo da finalidade que cobre ficha socioeconômica e atendimento social.
- **Gatilho:** USP-036 (ficha social) — Fase 3
- **Solicitar antes de:** Fase 3
- **Markers ICE:** [intent-USP-036:30](../ice-portal-asonseg/intents/intent-USP-036.md#L30)
- **Status:** aberto

### DEC-009 — Termo da finalidade 8 (encaminhamento institucional sem aceite prévio)

- **Owner:** jurídico + DPO + AS
- **Gate:** D-002
- **Descrição:** redação que cubra "encaminhamento sem aceite prévio caso a caso" (o encaminhamento é feito pela AS/coordenador, não pela Pessoa).
- **Gatilho:** USP-037 (encaminhar Pessoa) — Fase 3
- **Solicitar antes de:** Fase 3
- **Markers ICE:** [intent-USP-037:29](../ice-portal-asonseg/intents/intent-USP-037.md#L29)
- **Status:** aberto

### DEC-010 — Redação final do template de e-mail do encaminhamento

- **Owner:** jurídico + AS + designer
- **Gate:** D-002 (parte de)
- **Descrição:** texto do e-mail que a Pessoa encaminhada recebe ("você foi encaminhada por X da ASONSEG porque ..."). Estrutura UX já decidida; falta a redação final aprovada.
- **Gatilho:** USP-037 (encaminhar Pessoa) — Fase 3
- **Solicitar antes de:** Fase 3
- **Markers ICE:** [intent-USP-037:39](../ice-portal-asonseg/intents/intent-USP-037.md#L39) · [expectations-USP-037:36](../ice-portal-asonseg/expectations/expectations-USP-037.md#L36)
- **Status:** aberto

### DEC-011 — Aprovação jurídica formal dos 8 termos (consolidador)

- **Owner:** jurídico + DPO
- **Gate:** D-002
- **Descrição:** revisão final + parecer jurídico aprovando os 8 termos das finalidades LGPD. Bloqueante global da USP-043 + dependentes (todas as USPs com consentimento). Consome o resultado de DEC-002 a DEC-010.
- **Gatilho:** USP-043 (consentimentos LGPD) — Fase 1
- **Solicitar antes de:** Fase 1 (entrega contínua: termos vão sendo aprovados conforme as fases dos consumidores)
- **Markers ICE:** [intent-USP-043:25](../ice-portal-asonseg/intents/intent-USP-043.md#L25)
- **Status:** aberto

### DEC-012 — Validação da janela de retenção de `auth_attempts` (proposta: 90 dias)

- **Owner:** DPO Angélica
- **Gate:** validação LGPD (não é D-002)
- **Descrição:** confirmar com a DPO que reter tentativas de login/cadastro falhas (IP + e-mail) por 90 dias é proporcional à finalidade anti-bot; tunável via env `AUTH_ATTEMPTS_RETENTION_DAYS`.
- **Gatilho:** USP-001/USP-004 (cadastro/login) — Fase 1
- **Solicitar antes de:** Fase 1
- **Markers ICE:** [expectations-USP-004:52](../ice-portal-asonseg/expectations/expectations-USP-004.md#L52)
- **Status:** aberto

### DEC-013 — Texto jurídico final da UX de inativação a pedido do titular

- **Owner:** jurídico + DPO
- **Gate:** D-003
- **Descrição:** texto exibido à Pessoa quando ela solicita desligamento sob LGPD: "seu histórico fica preservado por finalidade institucional; seu acesso está desativado; consentimentos suspensos" (UX já decidida — falta a redação final).
- **Gatilho:** USP-007 (inativar Pessoa) — Fase 1
- **Solicitar antes de:** Fase 1
- **Markers ICE:** [intent-USP-007:39](../ice-portal-asonseg/intents/intent-USP-007.md#L39)
- **Status:** aberto

### DEC-014 — Cruzamento de dados sociais com dados públicos do portal (visão consolidada)

- **Owner:** jurídico + DPO
- **Gate:** interpretação LGPD da finalidade 6 vs uso interno legítimo
- **Descrição:** o termo da finalidade 6 cobre o cruzamento de dados da ficha social com dados públicos do portal (candidaturas, manifestações)? Ou esse cruzamento é uso interno legítimo sem consentimento adicional? Afeta USP-039.
- **Gatilho:** USP-039 (visão consolidada) — Fase 3
- **Solicitar antes de:** Fase 3
- **Markers ICE:** [intent-USP-039:46](../ice-portal-asonseg/intents/intent-USP-039.md#L46) · [expectations-USP-039:31](../ice-portal-asonseg/expectations/expectations-USP-039.md#L31)
- **Status:** aberto

### DEC-015 — Preenchimento concreto da matriz de cascata de revogação

- **Owner:** DPO Angélica + jurídico
- **Gate:** ADR-0025 (mecanismo decidido; semântica pendente)
- **Descrição:** o que acontece exatamente com candidaturas/manifestações ATIVAS quando a Pessoa revoga o consentimento da finalidade vinculada — cancela / esconde / mantém histórico bloqueando novas? Empresa é notificada? Esta decisão é uma TABELA por finalidade. Mecanismo técnico (matriz declarativa + `requireActiveConsent`) já implementado, basta preencher.
- **Gatilho:** USP-043 (consentimentos) — Fase 1
- **Solicitar antes de:** Fase 1
- **Markers ICE:** [intent-USP-043:30](../ice-portal-asonseg/intents/intent-USP-043.md#L30) · [expectations-USP-043:18](../ice-portal-asonseg/expectations/expectations-USP-043.md#L18)
- **Status:** aberto

### DEC-016 — Critério e responsável pela classificação minor/major de mudanças de termo

- **Owner:** DPO Angélica + jurídico
- **Gate:** versionamento ADR-0025
- **Descrição:** quem classifica uma mudança de termo como "minor" (corrige typo, preserva aceite) vs "major" (muda escopo, exige re-aceite)? Critério documentado da DPO.
- **Gatilho:** USP-043 (consentimentos) — Fase 1; relevante ao longo da vida do produto
- **Solicitar antes de:** Fase 1
- **Markers ICE:** [intent-USP-043:35](../ice-portal-asonseg/intents/intent-USP-043.md#L35)
- **Status:** aberto

### DEC-017 — Revisão final dos templates de e-mail pela DPO (minimização)

- **Owner:** DPO Angélica + designer
- **Gate:** revisão LGPD
- **Descrição:** revisão dos templates de e-mail (welcome, candidatura, manifestação, encaminhamento, lembretes, etc.) garantindo minimização — só PII necessária, sem dado de terceiro além do mínimo.
- **Gatilho:** USP-044 (notificações por e-mail) — atravessa todas as fases
- **Solicitar antes de:** Go-Live (revisão consolidada; revisões parciais podem rodar conforme cada template fica pronto)
- **Markers ICE:** [intent-USP-044:28](../ice-portal-asonseg/intents/intent-USP-044.md#L28)
- **Status:** aberto

### DEC-018 — Checklist de verificação manual da Empresa na 1ª vaga

- **Owner:** coordenador + Bravi PO + sponsor
- **Gate:** Fase 0 (BLOQUEANTE de produção)
- **Descrição:** lista de itens que o coordenador checa ao aprovar a 1ª vaga de uma Empresa (defesa principal contra RP-005 empresa-fantasma). Validado pelo PO + sponsor antes do go-live da Fase 2.
- **Gatilho:** USP-017 (validar Empresa na 1ª vaga) — Fase 2
- **Solicitar antes de:** Fase 2
- **Markers ICE:** [intent-USP-012:25](../ice-portal-asonseg/intents/intent-USP-012.md#L25) · [intent-USP-017:25](../ice-portal-asonseg/intents/intent-USP-017.md#L25)
- **Status:** aberto

### DEC-019 — Checklist de conformidade legal mínima da vaga

- **Owner:** coordenador + jurídico
- **Gate:** Fase 0
- **Descrição:** lista de itens (palavras-chave discriminatórias, requisitos abusivos, condições ilegais) que o moderador verifica antes de aprovar uma vaga.
- **Gatilho:** USP-020 (publicar vaga) — Fase 2
- **Solicitar antes de:** Fase 2
- **Markers ICE:** [intent-USP-020:39](../ice-portal-asonseg/intents/intent-USP-020.md#L39) · [expectations-USP-020:29](../ice-portal-asonseg/expectations/expectations-USP-020.md#L29)
- **Status:** aberto

### DEC-020 — Checklist do moderador de serviços (categorias proibidas + bandeira vermelha)

- **Owner:** coordenador + jurídico
- **Gate:** Fase 0
- **Descrição:** lista textual de categorias proibidas e palavras-chave bandeira vermelha para moderação de serviços (incluindo orientação sobre fotos com PII).
- **Gatilho:** USP-029 (publicar serviço) — Fase 2
- **Solicitar antes de:** Fase 2
- **Markers ICE:** [intent-USP-029:24](../ice-portal-asonseg/intents/intent-USP-029.md#L24) · [expectations-USP-029:20](../ice-portal-asonseg/expectations/expectations-USP-029.md#L20)
- **Status:** aberto

### DEC-021 — Conteúdo final do catálogo de permissões delegáveis

- **Owner:** diretoria + coordenador + Bravi PO
- **Gate:** D-006 / QP-006 (Fase 0)
- **Descrição:** lista final das permissões delegáveis (namespace `portal:`) — o mecanismo (enum fechado) está decidido; falta a lista de itens com nomes humanos.
- **Gatilho:** USP-008 (configurar permissões delegadas) — Fase 1
- **Solicitar antes de:** Fase 1
- **Markers ICE:** [intent-USP-008:26](../ice-portal-asonseg/intents/intent-USP-008.md#L26) · [expectations-USP-008:13](../ice-portal-asonseg/expectations/expectations-USP-008.md#L13)
- **Status:** aberto

### DEC-022 — Catálogo de unidades de serviço + áreas/categorias/regiões com bairro

- **Owner:** diretoria + coordenador
- **Gate:** D-007 (Fase 0)
- **Descrição:** lista final do enum de unidades (hora, m², peça, dia, evento, ...) decidida como enum fechado; também as categorias de serviço e o catálogo de regiões expandido para nível de bairro (USP-030).
- **Gatilho:** USP-029 (publicar serviço) — Fase 2; USP-030 (buscar serviços) — Fase 2
- **Solicitar antes de:** Fase 2
- **Markers ICE:** [expectations-USP-029:28](../ice-portal-asonseg/expectations/expectations-USP-029.md#L28)
- **Status:** aberto

### DEC-023 — Lista dos 3-5 relatórios prioritários + filtros mínimos

- **Owner:** diretoria + coordenador
- **Gate:** D-005 / QP-005 (Fase 0)
- **Descrição:** diretoria valida cedo (primeiros sprints da Fase 3) quais 3-5 relatórios são prioritários no MVP e que filtros mínimos cada um precisa.
- **Gatilho:** USP-042 (relatórios operacionais) — Fase 3
- **Solicitar antes de:** Fase 3
- **Markers ICE:** [intent-USP-042:34](../ice-portal-asonseg/intents/intent-USP-042.md#L34) · [expectations-USP-042:29](../ice-portal-asonseg/expectations/expectations-USP-042.md#L29)
- **Status:** aberto

### DEC-024 — Metas absolutas finais das MP1–MP10

- **Owner:** sponsor
- **Gate:** D-004 / QP-007
- **Descrição:** números absolutos das metas das métricas-produto (MP1 a MP10). Propostas do dono do intent já registradas no TD §11; falta a ratificação formal do sponsor para o go-live.
- **Gatilho:** Go-Live
- **Solicitar antes de:** Go-Live (Lançamento)
- **Markers ICE:** [intent-USP-001:67](../ice-portal-asonseg/intents/intent-USP-001.md#L67)
- **Status:** aberto

### DEC-025 — Treinamento textual + guideline dos encaminhadores

- **Owner:** coordenador + AS (ADR-0016)
- **Gate:** operacional / Fase 0
- **Descrição:** material textual de treinamento + guideline para evitar encaminhamentos de baixo match ("spray-and-pray"); coordenador roda amostragem trimestral. Aplicado fora do sistema, mas pré-requisito para conceder a permissão "Encaminhar Pessoa".
- **Gatilho:** USP-037 (encaminhar Pessoa) — Fase 3
- **Solicitar antes de:** Fase 3
- **Markers ICE:** [intent-USP-027:35](../ice-portal-asonseg/intents/intent-USP-027.md#L35) · [expectations-USP-027:24](../ice-portal-asonseg/expectations/expectations-USP-027.md#L24)
- **Status:** aberto

---

## Convenções

- **Status:** `aberto` (não solicitado) · `solicitado` (pedido enviado ao owner) · `decidido` (resposta recebida + ICE/TD/ADR atualizados) · `waived` (seguirá com feature flag/fallback até a decisão chegar).
- **Atualização:** quando uma decisão for fechada, edite este arquivo (campos *Status*, *Decisão*, *Decidido em*) E o arquivo ICE correspondente (substituindo o `❓` por `✅ RESOLVIDO (decisor / fonte): ...`).
- **Visibilidade:** este arquivo é consultado no planejamento de cada sprint para detectar gates antes do início do trabalho.
