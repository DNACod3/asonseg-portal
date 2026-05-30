# Expectations — USP-039: Visão consolidada da Pessoa

**Origem:** AC-039-1 e AC-039-2 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o usuário autorizado abre a ficha consolidada de uma Pessoa, the system SHALL exibir, em painel único, todas as dimensões da Pessoa: dados pessoais, papéis ativos, ficha socioeconômica (USP-036), candidaturas ativas e históricas (USP-025/USP-026), encaminhamentos com seus resultados (USP-037/USP-038), serviços oferecidos (USP-029), manifestações de interesse (USP-033), papéis organizacionais na ASONSEG (USP-008) — **respeitando a visibilidade por papel do solicitante**.

- **E-002:** WHERE o solicitante é AS ou diretoria, the system SHALL exibir tudo, incluindo ficha social (campo sensível).

- **E-003:** WHERE o solicitante é coordenador da área Portal Empregabilidade, the system SHALL exibir **apenas** dados operacionais relevantes à área — sem ficha social, **e sem distinguir candidatura espontânea de candidatura via encaminhamento ASONSEG** (defesa contra inferência indireta de situação social).
  ✅ RESOLVIDO (dono do intent): coordenador vê encaminhamentos COM badge "encaminhada via ASONSEG" (transparência). Nota: risco residual de inferência indireta a ser confirmado com DPO.

  *Ajuste do AC-039-2:* explicita ocultação do distintivo "encaminhada" para coordenador (toca F3 do intent).

- **E-004:** WHERE o solicitante é voluntário comum, the system SHALL bloquear o acesso a esta visão por qualquer rota.

- **E-005:** WHEN o usuário acessa a visão consolidada, the system SHALL registrar log imutável com solicitante, Pessoa acessada, data/hora, papel do solicitante.

## 2. Proibições (must-not)

- **P-001 (toca F1 — exposição acidental):** O sistema NÃO PODE permitir acesso à visão consolidada por usuário não autorizado por nenhuma rota — URL direta, API direta, permissão delegada errada. Autorização centralizada com testes automatizados por papel.

- **P-002 (toca F2 — sem DPO):** O sistema NÃO PODE materializar a visão consolidada com ficha social em produção sem DPO designado. Alternativa: visão sem ficha social até D-001 confirmado.

- **P-003 (toca F3 — inferência indireta):** O sistema NÃO PODE exibir, ao coordenador, sinais que permitam inferir situação social da Pessoa (badge "encaminhada", ausência de candidatura espontânea contrastando com presença na visão). Coordenador vê dados operacionais com unificação visual.

- **P-004 (toca F4 — performance):** O sistema NÃO PODE deixar o carregamento da visão de Pessoa "popular" ultrapassar limite operacional aceitável (≤ 3s p95 mesmo para Pessoa com 30+ candidaturas, 10+ encaminhamentos).

- **P-005 (toca F5 — cruzamento sem cobertura):** O sistema NÃO PODE permitir que dados de finalidades diferentes (candidatura finalidade 2, ficha social finalidade 6, encaminhamento finalidade 8) sejam usados para decisão social sem que o termo da finalidade 6 cubra explicitamente o cruzamento — ou sem decisão jurídica clara de que cruzamento é uso interno legítimo.
  ❓ Decisão a tomar com jurídico + DPO. (dono do intent)

- **P-006 (toca F6 — finalidade revogada):** O sistema NÃO PODE, após revogação de uma finalidade (USP-043), continuar usando os dados dessa finalidade para **ações ativas** — mas pode (deve, conforme ADR-0008) preservar histórico na visão consolidada com marcação clara "finalidade revogada em DD/MM/AAAA".
  ✅ RESOLVIDO (ADR-0025 + ADR-0008): retenção indefinida com marcação de revogação; histórico preservado, uso desativado. Alinhado com USP-043.

- **P-007:** O sistema NÃO PODE exportar a visão consolidada sem auditoria do export (quem, quando, para qual fim).

## 3. Limites

- **L-001 (Performance):** Carregamento ≤ 3s p95.
- **L-002 (Auditoria):** Cada acesso registrado em log imutável retido conforme ADR-0008.
- **L-003 (Visibilidade — ADR-0017):** Guard centralizado de campos sensíveis aplicado em todas as dimensões.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate compliance LGPD — BLOQUEANTE):** Antes desta USP ir para produção com ficha social, **D-001 do PRD (DPO designado)** está confirmado por escrito. Sem DPO, a USP **vai para produção sem o painel de ficha social** — ou não vai.

- **D-002 (gate jurídico):** Antes desta USP ir para produção, o jurídico + DPO decidem por escrito se cruzamento de finalidades na mesma tela é uso interno legítimo (sem consentimento adicional) ou requer cobertura no termo da finalidade 6. Sem decisão, P-005 fica desprotegido.

- **D-003:** A AS, em ensaio, abre Pessoa Maria; vê papéis, ficha social, candidaturas, encaminhamentos e resultados em painel único — todos os dados esperados.

- **D-004:** Em teste de permissão: o coordenador da área Portal abre a mesma Pessoa Maria e vê **versão restrita** — sem ficha social, sem distinção de candidatura espontânea vs encaminhada.

- **D-005:** Em teste de visibilidade: voluntário comum tenta abrir USP-039 por URL direta; sistema bloqueia com 403 + log da tentativa.

- **D-006:** Em teste de performance: Pessoa "popular" (preparada pela Bravi com 30 candidaturas + 10 encaminhamentos + 5 serviços) carrega ≤ 3s p95.

- **D-007:** A AS abre relatório de acessos à USP-039 da última semana e confere log completo (quem, quando, qual Pessoa).
