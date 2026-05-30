# Expectations — USP-032: Editar serviço (pausar, arquivar)

**Origem:** AC-032-1 a AC-032-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o prestador (PF, ou Pessoa-responsável ativa da Empresa) edita um serviço ativo, the system SHALL alterar status para "rascunho" e exigir nova moderação (USP-016) antes de voltar a "ativo".

- **E-002:** WHEN o prestador pausa, the system SHALL alterar status para "pausado" — serviço oculto da busca pública e do detalhe — sem exigir nova moderação para reativar.

- **E-003:** WHEN o prestador arquiva, the system SHALL alterar status para "arquivado" (terminal); serviço sai do portal permanentemente.

- **E-004:** The system SHALL preservar a data de publicação original ao re-aprovar serviço editado — sem ressurgir no topo da lista por edição cosmética (mesmo padrão de USP-023/E-005).

  *Ajuste:* AC do PRD não cobre; analogia com USP-023.

- **E-005:** The system SHALL enviar lembrete por e-mail (USP-044) ao prestador quando um serviço estiver pausado há ≥ N dias, oferecendo "deseja arquivar?".
  ✅ RESOLVIDO (dono do intent): N = 30 dias (tunável).

  *Ajuste:* AC do PRD não cobre lembrete; vem do F2 do intent (pausa ad eternum).

## 2. Proibições (must-not)

- **P-001 (toca F1 — serviço evergreen abandonado):** O sistema NÃO PODE deixar serviço "ativo" há ≥ M meses sem qualquer sinalização ao coordenador para revisão periódica. Mecanismo manual aceito no MVP, mas o sinal precisa existir.
  ✅ RESOLVIDO (dono do intent): mecanismo manual no MVP (coordenador roda revisão quando necessário); job automático fica para V2.

- **P-002 (toca F2 — pausa ad eternum):** O sistema NÃO PODE deixar serviço "pausado" indefinidamente sem comunicar o prestador (cf. E-005).

- **P-003 (toca F3 — manifestações órfãs após edição):** O sistema NÃO PODE deixar manifestações ativas em serviço recém-rebaixado para "rascunho" sem notificação ao cliente quando a edição é substancial.
  ✅ RESOLVIDO (dono do intent): sem notificação aos clientes na edição (coerente com USP-023); manifestações seguem sem atrito.

- **P-004:** O sistema NÃO PODE permitir edição/pausa/arquivamento por Pessoa diferente do prestador PF, ou sem vínculo "responsável" ativo da Empresa dona do serviço.

- **P-005:** O sistema NÃO PODE permitir reativação de serviço arquivado direto como "ativo" — arquivamento é terminal.

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (Lembrete de pausa):** E-mail "pausado há N dias" entregue ao SMTP em ≤ 24h após o limiar.
- **L-003 (Auditoria):** Transições de status registradas com responsável, data/hora.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Em ensaio: prestador edita descrição do serviço; status vai para "rascunho"; após re-aprovação, data de publicação preservada (verificado por inspeção da ordem em USP-030).

- **D-002:** Em ensaio: prestador pausa serviço; em ≤ 30s some da busca pública. Despausa em outro momento sem nova moderação.

- **D-003:** Em teste de pausa prolongada: serviço pausado há ≥ N dias dispara e-mail "deseja arquivar?".

- **D-004:** A coordenadora abre relatório de "serviços ativos há ≥ M meses sem manifestação" e usa como insumo para revisar com prestadores.

- **D-005:** Em teste de edição com manifestações ativas: serviço com 3 manifestações em curso é editado substancialmente; clientes recebem notificação na re-aprovação.

- **D-006:** Em teste de bypass: tentativa de chamada direta à API editando serviço por Pessoa sem permissão é rejeitada.
