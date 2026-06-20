# USP-022 — Ver detalhe da vaga — Spec

> **Modo ICE (thin adapter).** Esta spec NÃO re-deriva requisitos — RESOLVE o card da USP-022 na
> [`matriz-conexoes.md`](../../../../docs/IDSD/ice-portal-asonseg/matriz-conexoes.md) para
> [`intent-USP-022`](../../../../docs/IDSD/ice-portal-asonseg/intents/intent-USP-022.md) +
> [`expectations-USP-022`](../../../../docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-022.md).
> Os IDs de requisito SÃO os IDs ICE (`E-NNN`/`P-NNN`/`L-NNN`/`D-NNN`). Nada entra aqui que o card não aponte.

**Issue:** #172 · **Épico:** #6 (Fase 2) · **Requisito PRD:** VAG-03 · **Prioridade:** P1 (Must) · **Upstream:** USP-021 · **Downstream:** USP-025

## 1. História

Como qualquer pessoa (anônima ou autenticada), quero ver descrição completa, requisitos, benefícios, salário,
regime, local, validade e — quando autenticado com papel candidato — o botão "candidatar-se" de uma vaga, para
decidir se quero me candidatar. O contador "N pessoas se candidataram" dá sinal social. **Outcome:** o visitante
tem informação suficiente para decidir; quem decide, candidata sem fricção.

## 2. Requisitos funcionais (E — must-do)

| ID | EARS | Fonte |
|---|---|---|
| **E-001** | WHEN o visitante anônimo abre o detalhe de uma vaga, o sistema DEVE exibir todos os dados da vaga (descrição, requisitos, benefícios, salário, regime, local, validade) com a Empresa **anonimizada por setor** (ADR-0017) **em toda a página, API e metadados**. | expectations §1 |
| **E-002** | WHEN a Pessoa autenticada com papel candidato **ativo** abre o detalhe, o sistema DEVE exibir o **nome real da Empresa** e o botão **"candidatar-se"** (a ação pertence à USP-025; aqui só exibição). | expectations §1 |
| **E-003** | O sistema DEVE exibir o contador de candidaturas ("N pessoas se candidataram") **apenas a partir do limiar N = 3** (tunável), para evitar efeito psicológico inverso quando N é baixo. | expectations §1 / F1 |
| **E-004** | WHEN a Pessoa autenticada **sem** papel candidato ativo abre o detalhe, o sistema DEVE exibir CTA claro **"Ativar perfil candidato"** linkando para USP-009. | expectations §1 / F3 |
| **E-005** | WHEN a vaga **não está em status "ativo"** (pausada, arquivada, expirada, ou rebaixada via re-verificação de Empresa), o sistema DEVE exibir mensagem clara **"Vaga encerrada / temporariamente indisponível"** + CTA para outras vagas — **não** erro técnico, **não** candidatura silenciosa. | expectations §1 / F4 |

## 3. Proibições (P — must-not)

| ID | Proibição | Toca |
|---|---|---|
| **P-001** | NÃO PODE exibir contador com N = 0, 1 ou 2. Exibição só a partir do limiar (N ≥ 3). | F1 |
| **P-002** | NÃO PODE expor o nome real da Empresa para anônimo em **nenhum** canal técnico: HTML visível, JSON da API/payload Flight, meta tags Open Graph/Twitter Card, JSON-LD/schema.org, alt de imagem, URL canônica. Sanitização na **camada de serialização** (View Model), nunca no template. | F2 |
| **P-003** | NÃO PODE deixar Pessoa autenticada sem papel candidato sem caminho claro para ativar o papel. Sem CTA é fricção que perde candidato real. | F3 |
| **P-004** | NÃO PODE manter vaga acessível com sinais contraditórios quando a Empresa foi rebaixada para "não verificada" (USP-015). Vaga sai do ar (alinhado a USP-021/P-005 e USP-020/P-002). | F4 |
| **P-005** | NÃO PODE permitir candidatura (USP-025) a partir do detalhe quando a vaga não está em status "ativo". | — |

## 4. Limites (L — não-funcionais)

| ID | Limite |
|---|---|
| **L-001** | Carregamento do detalhe ≤ 2s p95. |
| **L-002** | Detalhe cacheável em janela curta — alinhado a USP-021/L-004 (ISR + revalidação on-demand). |
| **L-003** | Acesso público com rate limiting por IP (já no middleware — `RATE_LIMIT_DISABLED`). |

## 5. Critérios de pronto do dono do intent (D — UAT pós-merge)

- **D-001:** Anônimo abre o detalhe e a Empresa aparece como "Empresa do setor de Comércio Varejista" em **todos** os campos — validado por inspeção de HTML + JSON + metadados (OG/JSON-LD).
- **D-002:** Candidato autenticado abre e clica "candidatar-se" → fluxo USP-025 dispara sem fricção (≤ 30s).
- **D-003:** Prestador (sem papel candidato) abre e vê CTA "Ative seu perfil candidato" → clicando vai para USP-009.
- **D-004:** Vaga pausada/expirada: link direto exibe mensagem clara, **sem** botão candidatar, com CTA para a lista (USP-021).
- **D-005:** Vaga com 0 candidaturas → contador **não aparece**. Vaga com 7 → "7 pessoas se candidataram".

## 6. Escopo

**Dentro:** query de detalhe on-read; View Model `viewJobDetail` (anonimização + limiar do contador + flags por papel);
rota pública `(public)/vagas/[id]`; `generateMetadata` + JSON-LD anonimizados; estados de vaga não-ativa; introdução
da tabela `applications` **somente para contagem** (AD-012).

**Fora (outras USPs):** ação de candidatar-se e o caminho de escrita de `applications` (USP-025); expiração por cron
(USP-024); edição/pausa de vaga (USP-023); ativar perfil candidato (USP-009); criar conta (USP-001). O botão
"candidatar-se" aqui é **somente exibição** — o disparo é da USP-025.

## 7. Gate de entrada (ICE) — ✅ PASSOU (2026-06-20)

Sinais bloqueadores verificados no card e no ledger §2 da matriz:
1. Q-aberta(dono): **—** (card: `Q-abertas: —`). 2. ❓ técnico/arquitetural: **—**. 3. ADR Proposed/NECESSITA VALIDAÇÃO:
**nenhum** (ADR-0015/0017/0022/0026/0028 todos *Accepted*). 4. Pré-condição D-NNN bloqueante: **—**. 5. Premissa
PR-NNN aberta consumida: **—** (upstream USP-021 já em master). → **Nenhum sinal disparou. USP-022 entra em dev.**

**Classificação:** ICED (intent+expectations) + carrega must-nots (P-001..P-005) → **Large** (Tasks + Design obrigatórios).
