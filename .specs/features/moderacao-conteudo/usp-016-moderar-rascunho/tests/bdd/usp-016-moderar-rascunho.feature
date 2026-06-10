# .specs/features/moderacao-conteudo/usp-016-moderar-rascunho/tests/bdd/usp-016-moderar-rascunho.feature
# Fonte: PRD USP-016 · issue #117 · docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-016.md (E-001..E-005, P-001..P-007, L-001..L-004)
#        intent-USP-016.md (F1..F6) · ADR-0011 (máquina de estados / TRANSITIONS / transitionContent) · ADR-0024 (FSM, autor≠moderador, motivo obrigatório)
#        project-guideline §4 (Server Action), §12 (testes)
# ACs verbatim na matriz (traceability.md). Não enfraquecer (P4).

@usp-016 @modulo-moderation
Funcionalidade: Moderar rascunho (vaga, CV ou serviço)
  Como coordenador da área Portal Empregabilidade (ou voluntário com permissão delegada)
  Quero revisar rascunhos em moderação e aprovar, devolver para ajustes ou rejeitar
  Para que apenas conteúdo verificado fique visível no portal

  Contexto:
    Dado um coordenador autenticado "Cleia" com permissão de moderação ativa
    E os seguintes rascunhos com status "IN_MODERATION":
      | tipo    | titulo                     | autor   | enviadoEm        |
      | JOB     | Auxiliar de limpeza        | Empresa | 2026-06-01 09:00 |
      | CV      | Perfil de João             | João    | 2026-06-02 10:00 |
      | SERVICE | Conserto de eletrodoméstico| Pedro   | 2026-06-03 11:00 |

  # ───────────────────── E-001 — fila ordenada por data ─────────────────────

  @e-001 @happy-path
  Cenário: Fila lista rascunhos IN_MODERATION ordenados por data de envio (mais antigo primeiro)
    Quando "Cleia" acessa a fila de moderação
    Então o sistema lista os rascunhos com status "IN_MODERATION"
    E os ordena por data de envio do mais antigo para o mais recente
    E exibe o indicador de tipo (vaga, CV ou serviço) de cada item

  @e-001 @p-005 @borda @conflito-de-interesse
  Cenário: A fila não exibe itens cujo autor é o próprio moderador (autor≠moderador)
    Dado um rascunho "SERVICE" "Aula de violão" com status "IN_MODERATION" cujo autor é "Cleia"
    Quando "Cleia" acessa a fila de moderação
    Então o item "Aula de violão" não aparece na fila dela

  # ───────────────────── E-002 — aprovar ─────────────────────

  @e-002 @happy-path
  Cenário: Aprovar um rascunho transiciona para ACTIVE via transitionContent e notifica o autor
    Quando "Cleia" aprova o rascunho "Auxiliar de limpeza"
    Então o sistema transiciona o conteúdo de "IN_MODERATION" para "ACTIVE" via "transitionContent"
    E envia e-mail ao autor informando a aprovação
    E registra log de auditoria "CONTENT_APPROVED" na mesma transação
    E a ação retorna sucesso

  # ───────────────────── E-003 — devolver para ajustes ─────────────────────

  @e-003 @happy-path
  Cenário: Devolver para ajustes exige motivo, transiciona para AWAITING_ADJUSTMENTS e envia o motivo ao autor
    Quando "Cleia" devolve o rascunho "Perfil de João" com o motivo "Faltou descrever as atividades exercidas no cargo anterior"
    Então o sistema transiciona o conteúdo para "AWAITING_ADJUSTMENTS" via "transitionContent"
    E envia e-mail ao autor contendo o motivo
    E registra log de auditoria "CONTENT_RETURNED_FOR_ADJUSTMENTS" na mesma transação
    E a ação retorna sucesso

  @e-003 @p-003 @borda @validacao
  Esquema do Cenário: Devolver com motivo insuficiente é rejeitado (≥ 20 caracteres significativos)
    Quando "Cleia" tenta devolver o rascunho "Perfil de João" com o motivo "<motivo>"
    Então o sistema rejeita a decisão com erro "JUSTIFICATION_REQUIRED"
    E nenhuma transição de status ocorre
    E o conteúdo permanece em "IN_MODERATION"

    Exemplos:
      | motivo  |
      |         |
      | x       |
      | —       |
      | ok      |
      | ajustar |

  # ───────────────────── E-004 — rejeitar ─────────────────────

  @e-004 @happy-path
  Cenário: Rejeitar definitivamente exige motivo, transiciona para REJECTED e envia o motivo ao autor
    Quando "Cleia" rejeita o rascunho "Conserto de eletrodoméstico" com o motivo "Serviço não compatível com as diretrizes do portal"
    Então o sistema transiciona o conteúdo para "REJECTED" via "transitionContent"
    E envia e-mail ao autor contendo o motivo
    E registra log de auditoria "CONTENT_REJECTED" na mesma transação
    E a ação retorna sucesso

  @e-004 @p-003 @borda @validacao
  Cenário: Rejeitar com motivo vazio é bloqueado
    Quando "Cleia" tenta rejeitar o rascunho "Conserto de eletrodoméstico" com o motivo ""
    Então o sistema rejeita a decisão com erro "JUSTIFICATION_REQUIRED"
    E o conteúdo permanece em "IN_MODERATION"

  # ───────────────────── AC6 — toda transição validada pela máquina de estados ─────────────────────

  @ac-6 @borda @maquina-de-estados
  Cenário: Transição inválida é bloqueada pela máquina de estados (nunca update direto no Prisma)
    Dado um rascunho "JOB" "Vaga rejeitada" com status "REJECTED"
    Quando o sistema solicita a transição de "REJECTED" para "ACTIVE" com trigger "MODERATOR_ACTION"
    Então o sistema rejeita com erro "INVALID_TRANSITION"
    E o status do conteúdo não é alterado

  @ac-6 @maquina-de-estados
  Esquema do Cenário: Transições válidas declaradas em TRANSITIONS são aceitas por tipo de conteúdo
    Quando o sistema valida a transição de "<de>" para "<para>" com trigger "<trigger>" para o tipo "<tipo>"
    Então a transição é considerada válida

    Exemplos:
      | tipo    | de             | para                  | trigger                  |
      | JOB     | DRAFT          | IN_MODERATION         | AUTHOR_ACTION            |
      | JOB     | IN_MODERATION  | ACTIVE                | MODERATOR_ACTION         |
      | JOB     | IN_MODERATION  | AWAITING_ADJUSTMENTS  | MODERATOR_ACTION         |
      | JOB     | IN_MODERATION  | REJECTED              | MODERATOR_ACTION         |
      | CV      | IN_MODERATION  | ACTIVE                | MODERATOR_ACTION         |
      | SERVICE | IN_MODERATION  | ACTIVE                | MODERATOR_ACTION         |

  # ───────────────────── AC5 / P-006 — auditoria na mesma transação, sem bypass ─────────────────────

  @ac-5 @p-006 @auditoria
  Cenário: Toda decisão grava auditoria na mesma transação da mudança de status
    Quando "Cleia" aprova o rascunho "Auxiliar de limpeza"
    Então a mudança de status e o log de auditoria ocorrem na mesma transação
    E o log registra decisor, item, decisão, motivo e data/hora

  @ac-6 @p-006 @borda @concorrencia
  Cenário: Decisão concorrente sobre o mesmo item falha na segunda chamada (concorrência otimista)
    Dado que "Cleia" e "Bruno" abrem o mesmo rascunho "Auxiliar de limpeza" em "IN_MODERATION"
    Quando "Cleia" aprova o item e em seguida "Bruno" tenta aprovar o mesmo item
    Então a decisão de "Cleia" é aplicada
    E a decisão de "Bruno" falha com erro "INVALID_TRANSITION"

  # ───────────────────── P-007 — permissão ─────────────────────

  @p-007 @borda @permissao
  Cenário: Usuário sem permissão de moderação não pode decidir
    Dado um usuário autenticado "Visitante" sem permissão de moderação
    Quando "Visitante" tenta aprovar o rascunho "Auxiliar de limpeza"
    Então o sistema recusa com erro "FORBIDDEN"
    E nenhuma transição de status ocorre

  # ───────────────────── Diferidos / cross-US (não implementar nesta US) ─────────────────────

  @e-005 @p-001 @diferido
  Cenário: Alerta operacional de fila (>10 pendentes ou item >48h) — DIFERIDO (GAP-5, sem SLA no MVP)
    # Marcado @diferido — fact placeholder; sem implementação nesta US.

  @p-002 @cross-us @usp-017
  Cenário: Painel de Empresa "não verificada" na aprovação de 1ª vaga — pertence à USP-017
    # Marcado @cross-us — verificação de Empresa é da USP-017; aqui só há flag de exibição.

  @p-004 @cross-us @usp-018
  Cenário: Atalho para inativar conteúdo publicado — pertence à USP-018
    # Marcado @cross-us — ação de inativação é da USP-018.
