# Camada ICE — MVP Portal Empregabilidade e Serviços ASONSEG

**Cliente:** ASONSEG
**Projeto:** MVP Portal Empregabilidade e Serviços
**Base:** PRD v0.3 (22/05/2026) + 18 ADRs de negócio
**Método:** Intent-driven Software Development (skill po-bravi-idsd)
**Gerado em:** 27/05/2026

---

## O que é esta camada

Esta é a camada **ICE (Intent / Connections / Expectations)** do MVP do Portal. Ela complementa o PRD e os ADRs, traduzindo cada uma das 44 USPs em três artefatos que a esteira de desenvolvimento e o gate humano consomem:

| Artefato | O que responde | Para quem |
|---|---|---|
| **Matriz de conexões** | Como cada USP se conecta com as outras, com ADRs, métricas, riscos, dependências e Q-abertas. | Arquiteto, Tech Lead, PO ao orquestrar a sprint. |
| **Intent files (44)** | O que o dono institucional quer — outcome desejado, restrições, cenários de fracasso **de resultado**, cenários de sucesso. | Dev que precisa entender por que está fazendo. |
| **Expectations files (44)** | O que conta como pronto — cenários testáveis (EARS), **must-not** (proibições no idioma do dono), limites, critérios de pronto observáveis pelo dono. | Gate humano de revisão por USP antes do merge; QA; sponsor. |

A diferença principal frente a um PRD tradicional: o **must-not é explícito**. Cada proibição (`P-NNN`) cita exatamente qual fracasso de resultado (`F-X`) do intent ela mitiga. O dev tem o checklist do que **não pode acontecer** com o mesmo rigor com que recebe o checklist do que **deve acontecer**.

---

## Estrutura

```
ice-portal-asonseg/
├── README.md                           # Este arquivo
├── matriz-conexoes.md                  # Matriz completa: USP×ADR×Métrica×Risco×Dep×Q
├── intents/                            # 44 intent files
│   ├── intent-USP-001.md  …  intent-USP-044.md
└── expectations/                       # 44 expectations files
    ├── expectations-USP-001.md  …  expectations-USP-044.md
```

---

## Escopo da camada ICE

A camada cobre **as 44 USPs do MVP Portal** (USP-001 a USP-044), distribuídas em 13 épicos:

| Épico | USPs |
|---|---|
| 1 — Identidade, Acesso e Papéis | 001 a 008 |
| 2 — Cadastros Públicos | 009 a 011 |
| 3 — Gestão de Vínculos Pessoa-Empresa | 012 a 015 |
| 4 — Moderação de Conteúdo | 016 a 019 |
| 5 — Vagas | 020 a 024 |
| 6 — Candidaturas e Busca de Candidatos | 025 a 028 |
| 7 — Serviços | 029 a 032 |
| 8 — Manifestação de Interesse em Serviço | 033 a 035 |
| 9 — Ficha Social, Encaminhamento, Visão Consolidada | 036 a 039 |
| 10 — Extração de CV via IA Generativa | 040 |
| 11 — Indicadores e Relatórios | 041, 042 |
| 12 — Conformidade LGPD (Consentimentos) | 043 |
| 13 — Notificações por E-mail | 044 |

**ADRs aplicáveis ao MVP Portal** (cobertos pela matriz de conexões): 0001 (estendido), 0008 (estendido), 0010 (transversal), 0011, 0012, 0013, 0014, 0015, 0016, 0017, 0018.

**ADRs fora do escopo do MVP Portal** (vão para Release 2 / Frente 4 — não aparecem na matriz): 0002, 0003, 0004, 0005, 0006, 0007, 0009.

---

## USPs de alta concentração de risco

São as USPs que tocam múltiplos ADRs + múltiplos riscos críticos + dependências bloqueantes. Merecem revisão extra do gate humano:

| USP | Razão da concentração | Gate principal |
|---|---|---|
| **USP-001** Auto-cadastro | Atomicidade em 2 transações (Pessoa+credencial+PORTAL_ACCESS; depois papel+finalidade — lazy); F1 race condition | D-002 (termo da finalidade do papel) |
| **USP-003** Reivindicar credencial | Sequestro de identidade se verificação for fraca | **BLOQUEANTE**: D-011/QP-001 (meios de verificação) |
| **USP-009** Cadastro candidato | 5 ADRs, 3 riscos, ZDR + termo finalidade 7 | **BLOQUEANTE**: D-008/QP-002 + D-002 |
| **USP-012** Cadastro Empresa | RP-005 (empresa-fantasma) — vetor de entrada | D-002 (termo finalidade 5) |
| **USP-016** Moderar rascunho | RP-004 + RP-005 + RP-010 + diferencial ADR-0015 | Checklist legal + catálogo D-006 |
| **USP-017** Validar Empresa primeira vaga | Defesa principal contra RP-005 | **BLOQUEANTE**: checklist de verificação (Fase 0) |
| **USP-020** Publicar vaga | Vaga como vetor de empresa-fantasma + cláusula discriminatória | **BLOQUEANTE**: D-007 + checklist legal |
| **USP-025** Candidatar-se | Termo de responsabilidade da Empresa contra mineração | **BLOQUEANTE**: D-002 |
| **USP-028** Empresa busca candidatos | Mineração de dados + cobertura LGPD da finalidade 2 | **BLOQUEANTE**: D-001 + D-002 |
| **USP-029** Publicar serviço | Serviço ilegal/fraudulento + foto com PII | **BLOQUEANTE**: D-007 + checklist + D-002 |
| **USP-033** Manifestar interesse | Consentimento finalidade 4 sem percepção | **BLOQUEANTE**: D-002 |
| **USP-036** Ficha socioeconômica | Dado sensível social + RP-002 + RP-003 | **DUPLO BLOQUEANTE**: D-001 + D-002 |
| **USP-037** Encaminhar Pessoa | Diferencial ADR-0016 + LGPD finalidade 8 sem aceite prévio | **DUPLO BLOQUEANTE**: D-001 + D-002 |
| **USP-039** Visão consolidada | Materializa ADR-0011; expõe ficha social | **BLOQUEANTE**: D-001 (sem DPO, vai sem ficha social ou não vai) |
| **USP-040** Extração CV via IA | RP-007 (validação vazia) + RP-008 (ZDR) | **TRIPLO BLOQUEANTE**: D-001 + D-008/QP-002 + D-002 |
| **USP-042** Relatórios operacionais | PII em export + viés de MP9 | **BLOQUEANTE**: D-001 (sem DPO, sem PII em relatórios) |
| **USP-043** Consentimentos LGPD | **Pedra angular** — sem ela, todas as outras ficam em violação silenciosa | **BLOQUEANTE GLOBAL**: D-001 + D-002 (8 termos) + matriz de cascata + critério minor/major + decisão de revogação reversível |

---

## Gates de produção declarados

USPs cujo expectations file declara **bloqueio em produção mesmo com código pronto**, por dependência externa (jurídica, compliance, operacional) ainda não resolvida:

- **USP-001 D-004 (gate jurídico)** — termos das 4 finalidades dos papéis públicos
- **USP-002 D-002 (gate jurídico)** — modelo de evidência de consentimento em papel
- **USP-003 D-001 (gate operacional/jurídico)** — meios de verificação de identidade
- **USP-006 D-002 (gate jurídico)** — termo de cada finalidade dos papéis
- **USP-007 D-003 (gate jurídico)** — texto LGPD para inativação a pedido do titular
- **USP-008 D-002 (gate operacional)** — catálogo final de permissões
- **USP-009 D-001 (gate técnico/jurídico)** — ZDR + termo finalidade 7
- **USP-010 D-002 (gate jurídico)** — termo finalidade 3
- **USP-011 D-002 (gate jurídico)** — termo finalidade 4
- **USP-012 D-003 (gate jurídico)** — termo finalidade 5
- **USP-013 D-001 (gate jurídico)** — modelo de aceite explícito
- **USP-016 D-001 (gate operacional)** — catálogo + checklist Empresa
- **USP-017 D-001 (gate operacional/qualidade)** — checklist de verificação de Empresa
- **USP-018 D-001 (gate operacional)** — canal de sinalização externa
- **USP-020 D-001 (gate operacional)** — catálogo D-007 + checklist legal
- **USP-025 D-001 (gate jurídico)** — termo de responsabilidade da Empresa
- **USP-026 D-001 (gate jurídico)** — revogação de visibilidade pós-cancelamento
- **USP-027 D-005 (gate operacional)** — treinamento dos encaminhadores
- **USP-028 D-001 (gate jurídico)** — DPO + finalidade 2 cobrindo busca ativa
- **USP-029 D-001 (gate operacional)** — catálogo + checklist + termo finalidade 3
- **USP-033 D-001 (gate jurídico)** — DPO + termo finalidade 4
- **USP-034 D-001 (gate jurídico)** — revogação de visibilidade pós-cancelamento
- **USP-036 D-001 + D-002 (gate compliance LGPD — DUPLO)** — DPO + termo finalidade 6
- **USP-037 D-001 (gate compliance LGPD)** — DPO + termo finalidade 8 cobrindo encaminhamento sem aceite prévio
- **USP-039 D-001 (gate compliance LGPD)** — DPO designado
- **USP-040 D-001 (gate compliance LGPD — TRIPLO)** — DPO + ZDR + termo finalidade 7 com nome do provedor
- **USP-041 D-001 (gate operacional)** — política de exibição mínima (D-012/QP-004)
- **USP-042 D-001 (gate compliance LGPD)** — DPO para relatórios com PII
- **USP-043 D-001 (gate compliance LGPD — BLOQUEANTE GLOBAL)** — 5 peças: DPO + 8 termos + matriz cascata + critério minor/major + revogação reversível
- **USP-044 D-002 (gate jurídico)** — templates revisados por DPO + jurídico

---

## Riscos propostos (fora do §13 do PRD)

Riscos que emergiram da geração dos intents/expectations e que precisam ser revisados para inclusão no PRD v0.4:

- Sequestro de identidade na reivindicação de credencial (USP-003)
- Empresa órfã por bypass do gate de sucessão (USP-007/USP-014)
- Brute-force / enumeração no login (USP-004) e na recuperação de senha (USP-005)
- Revelação inadvertida de existência de Pessoa via busca por CPF (USP-013)
- Aquisição hostil de Empresa via fluxo de inclusão como responsável (USP-012)
- Vaga "evergreen" via prorrogação infinita (USP-023) ou validade longa demais (USP-020)
- Vaga com cláusula discriminatória escapando da moderação (USP-020)
- Manipulação de ranking via "edição cosmética + re-moderação" (USP-023)
- Job de expiração falha silenciosamente (USP-024) — mitigado por verificação on-read
- Mineração de dados de candidatos por Empresa (USP-025/USP-028)
- Candidatura em massa por candidato (USP-025)
- Contato exposto após cancelamento de candidatura/manifestação (USP-026/USP-034)
- Subir na lista da Empresa via cancelar + re-candidatar (USP-026)
- Serviço ilegal/fraudulento publicado (USP-029)
- Foto com PII de terceiros publicada (USP-029)
- Prestador PF se passando por Empresa não cadastrada (USP-029)
- Fingerprinting de identidade do prestador PF (USP-030)
- Contato vaza via descrição livre / fotos (USP-031)
- Serviço fantasma (ativo mas abandonado) sem higiene automática (USP-032)
- Manifestação em massa para coletar contatos (USP-033)
- Manifestações sem resposta erodem confiança no portal (USP-035)
- Viés de registro inflando MP9 (USP-038)
- Inferência indireta de situação social via dados operacionais visíveis ao coordenador (USP-039)
- LLM extraindo campos sensíveis não-mapeados — minimização LGPD (USP-040)
- Custo da API LLM crescendo descontrolado (USP-040)
- Contagem inflada artificialmente por verificações rápidas (USP-041)
- CSV exportado compartilhado por canal não-seguro (USP-042)
- Quota de SMTP estourada silenciosamente (USP-044)
- Phishing aproveitando identidade visual de e-mails do portal (USP-044)
- Badge "ASONSEG" desgastado por encaminhamentos de baixa qualidade (USP-027/USP-037)
- Permissão "Encaminhar" delegada sem revisão periódica (USP-037)

---

## Próximos passos sugeridos

1. **Revisão pelo sponsor + diretoria + DPO** dos gates declarados nos critérios de pronto (D-NNN) — confirmar quais são realmente bloqueantes de produção.
2. **Fase 0** — resolver as dependências marcadas (D-001 DPO, D-002 termos, D-005 relatórios, D-006 catálogo permissões, D-007 catálogo áreas/categorias, D-008/QP-002 provedor IA com ZDR, D-011/QP-001 verificação de identidade, D-012/QP-004 política de exibição mínima) + entregar a **checklist de verificação de Empresa** (USP-017) e a **checklist de conformidade legal mínima de vaga** (USP-020).
3. **CHANGELOG v0.4 do PRD** incorporando os riscos propostos acima.
4. **Esteira da arquitetura (Fase 1)** consumindo a camada ICE para produzir documento de arquitetura, project guideline, technical design document e ADRs técnicos — particularmente para as decisões "arquitetural-estrutural" marcadas nos intents (atomicidade transação, sanitização de PII em texto livre, log imutável de consentimentos, cascata de revogação por finalidade, política de cache da home, estratégia de expiração on-read, sanitização de uploads).
