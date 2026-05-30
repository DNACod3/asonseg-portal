# Expectations — USP-023: Editar vaga (pausar, arquivar, renovar)

**Origem:** AC-023-1 a AC-023-4 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o responsável edita qualquer campo informativo da vaga ativa, the system SHALL alterar status para "rascunho", exigir nova moderação (USP-016) antes de voltar a "ativo", e gravar log da alteração (campos antes/depois).

- **E-002:** WHEN o responsável pausa a vaga, the system SHALL alterar status para "pausado" — vaga oculta da busca pública (USP-021) e do detalhe (USP-022 exibe mensagem clara) — sem exigir nova moderação para reativar.

- **E-003:** WHEN o responsável arquiva, the system SHALL alterar status para "arquivado" (terminal), preservar histórico de candidaturas, e o conteúdo deixa de aparecer em qualquer listagem pública.

- **E-004:** WHEN o responsável prorroga a validade de uma vaga ainda ativa, the system SHALL aceitar nova data futura (dentro do teto institucional) **sem exigir nova moderação** — prorrogação é metadata, não conteúdo.

- **E-005:** WHEN uma vaga editada volta a ser aprovada pelo coordenador, the system SHALL preservar a data de publicação original — vaga não ressurge no topo por edição cosmética.

  *Ajuste:* AC do PRD não cobre data de publicação; vem do F1 do intent (proteção contra ranking abusado).

## 2. Proibições (must-not)

- **P-001 (toca F1 — manipulação de ranking):** O sistema NÃO PODE alterar a data de publicação da vaga ao re-aprová-la após edição. Data de publicação original é preservada para ordenação em USP-021. Apenas vagas verdadeiramente novas sobem ao topo.

- **P-002 (toca F2 — prorrogação infinita):** O sistema NÃO PODE permitir prorrogação ilimitada da mesma vaga. Após N prorrogações ou ultrapassado um total acumulado, prorrogação requer nova moderação (volta a "rascunho") ou alerta o coordenador.
  ✅ RESOLVIDO (dono do intent): sem limite e sem total acumulado — prorrogação livre.

- **P-003 (toca F3 — vaga pausada acessível por URL):** O sistema NÃO PODE renderizar detalhe completo de vaga pausada sem mensagem clara "vaga temporariamente pausada" e sem desabilitar o botão "candidatar-se". Nem permitir candidatura silenciosa via API.

- **P-004 (toca F4 — candidaturas órfãs após edição):** O sistema NÃO PODE deixar candidaturas existentes em vaga recém-rebaixada para "rascunho" sem tratamento. Quando a edição modifica conteúdo substancial, candidatos são notificados sobre a mudança no momento da re-aprovação.
  ✅ RESOLVIDO (dono do intent): critério não se aplica — sem notificação aos candidatos na re-moderação.

- **P-005:** O sistema NÃO PODE permitir edição, pausa, arquivamento ou prorrogação por Pessoa sem vínculo "responsável" ativo da Empresa dona da vaga.

- **P-006:** O sistema NÃO PODE permitir reativação de vaga arquivada como "ativo" direto — arquivamento é terminal; voltar exige criar nova vaga.

## 3. Limites

- **L-001 (Performance):** Submit da edição/pausa/arquivar/prorrogar ≤ 2s p95.
- **L-002 (Teto de prorrogação):** N prorrogações máximas ou total acumulado, alinhado com teto de validade (USP-020/L-002).
- **L-003 (Auditoria):** Todas as transições de status registradas com responsável, data/hora, motivo (opcional).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Em ensaio: responsável edita descrição da vaga; sistema volta para "rascunho" e exige moderação; após aprovar, data de publicação **não muda** (verificado por inspeção da ordem em USP-021).

- **D-002:** Em ensaio: responsável pausa vaga; ela some da busca pública em ≤ 30s; URL direta exibe mensagem clara e bloqueia botão "candidatar-se"; após despausar, vaga volta sem nova moderação.

- **D-003:** Em ensaio de prorrogação: responsável prorroga validade em 30 dias; vaga continua ativa; depois prorroga mais 30 e mais 30 — após N prorrogações, sistema alerta ou exige nova moderação.

- **D-004:** Em ensaio de edição com candidaturas: vaga com 5 candidatos é editada substancialmente; ao re-aprovar, candidatos recebem notificação informando a mudança.

- **D-005:** Em teste de bypass: tentativa de prorrogação por Pessoa sem vínculo de responsável é rejeitada com erro determinístico.

- **D-006:** Em teste de cosmética: responsável edita um único caractere; sistema processa, coordenador re-aprova; data de publicação preservada — vaga não sobe.
