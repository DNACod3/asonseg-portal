# .specs/features/moderar-rascunho/tests/bdd/usp-016-moderar-rascunho.feature
# Fonte: PRD §5 Épico 4 USP-016 (linhas 438-452)
#        ADR-0015 (negócio — moderação humana pré-publicação)
#        ADR-T-0011 (máquina de estados de moderação — transitionContent, TRANSITIONS, requiresJustification)
#        ADR-T-0004 (auditoria append-only — eventos CONTENT_APPROVED / CONTENT_RETURNED_FOR_ADJUSTMENTS / CONTENT_REJECTED)
#        technical-design.md §3.3 (sequência) · enum PermissionId (MODERATE_JOB/MODERATE_CV/MODERATE_SERVICE)
#        architecture-document.md §6 (fluxo crítico Top 8 nº 8 — Moderação aprovar/devolver/rejeitar)
#        project-guideline.md §4 (Server Action), §6 (máquina de estados), §12 (casos obrigatórios)

@usp-016 @modulo-moderation
Funcionalidade: Moderar rascunho de vaga, CV ou serviço
  Como coordenador da área Portal Empregabilidade (ou voluntário delegado)
  Quero revisar rascunhos e aprovar, devolver para ajustes ou rejeitar
  Para que apenas conteúdo verificado fique visível no portal

  Contexto:
    Dado um coordenador autenticado com permissão de moderação do tipo de conteúdo
    E um conteúdo no status "em moderação" (IN_MODERATION)

  # ───────────────────────────────────────────────────────────────────────────
  # AC-016-1 — Fila de moderação (event-driven / listagem ordenada)
  # ───────────────────────────────────────────────────────────────────────────

  @ac-016-1 @happy-path @fila
  Cenário: Fila lista rascunhos em moderação ordenados por data de envio
    Dado que existem 3 conteúdos em "em moderação" enviados em datas distintas
    Quando o coordenador acessa a fila de moderação
    Então o sistema lista apenas os conteúdos com status "em moderação"
    E os apresenta ordenados pela data de envio para moderação
    E não inclui conteúdos em outros status (rascunho, ativo, rejeitado)

  @ac-016-1 @permissao
  Cenário: Acesso à fila exige permissão de moderação
    Dado um usuário autenticado SEM permissão de moderação
    Quando ele tenta acessar a fila de moderação
    Então o sistema recusa o acesso por falta de permissão

  # ───────────────────────────────────────────────────────────────────────────
  # AC-016-2 — Aprovar (event-driven / transição MODERATOR_ACTION sem justificativa)
  # ───────────────────────────────────────────────────────────────────────────

  @ac-016-2 @happy-path @aprovar
  Cenário: Aprovação ativa o conteúdo e notifica o autor
    Dado um rascunho em "em moderação"
    Quando o coordenador aprova o conteúdo
    Então o sistema altera o status para "ativo" (ACTIVE)
    E dispara e-mail de aprovação ao autor
    E registra log de auditoria CONTENT_APPROVED
    E a ação retorna sucesso

  @ac-016-2 @borda @transicao-invalida
  Cenário: Aprovar conteúdo que não está em moderação é rejeitado
    Dado um conteúdo já no status "ativo" (ACTIVE)
    Quando o coordenador tenta aprová-lo
    Então o sistema retorna erro de transição inválida (INVALID_TRANSITION)
    E o status do conteúdo permanece inalterado

  @ac-016-2 @borda @concorrencia
  Cenário: Aprovação dupla concorrente não ativa duas vezes
    Dado dois coordenadores abrindo o mesmo conteúdo em "em moderação"
    Quando ambos aprovam simultaneamente
    Então apenas a primeira transição é aplicada
    E a segunda retorna erro de transição inválida (INVALID_TRANSITION)

  # ───────────────────────────────────────────────────────────────────────────
  # AC-016-3 — Devolver para ajustes (event-driven + IF justificativa ausente)
  # ───────────────────────────────────────────────────────────────────────────

  @ac-016-3 @happy-path @devolver
  Cenário: Devolução com motivo coloca em "aguardando ajustes" e notifica autor
    Dado um rascunho em "em moderação"
    Quando o coordenador devolve para ajustes com o motivo "Faltam dados de contato"
    Então o sistema altera o status para "aguardando ajustes" (AWAITING_ADJUSTMENTS)
    E dispara e-mail ao autor contendo o motivo "Faltam dados de contato"
    E registra log de auditoria CONTENT_RETURNED_FOR_ADJUSTMENTS com o motivo
    E a ação retorna sucesso

  @ac-016-3 @borda @justificativa-obrigatoria
  Cenário: Devolver sem motivo é bloqueado
    Dado um rascunho em "em moderação"
    Quando o coordenador devolve para ajustes sem informar motivo
    Então o sistema bloqueia a operação por justificativa obrigatória (JUSTIFICATION_REQUIRED)
    E o status do conteúdo permanece "em moderação"
    E nenhum e-mail é enviado ao autor

  # ───────────────────────────────────────────────────────────────────────────
  # AC-016-4 — Rejeitar definitivamente (event-driven + IF justificativa ausente)
  # ───────────────────────────────────────────────────────────────────────────

  @ac-016-4 @happy-path @rejeitar
  Cenário: Rejeição com motivo marca "rejeitado" e notifica autor
    Dado um rascunho em "em moderação"
    Quando o coordenador rejeita definitivamente com o motivo "Conteúdo fora de escopo"
    Então o sistema altera o status para "rejeitado" (REJECTED)
    E dispara e-mail ao autor
    E registra log de auditoria CONTENT_REJECTED com o motivo
    E a ação retorna sucesso

  @ac-016-4 @borda @justificativa-obrigatoria
  Cenário: Rejeitar sem motivo é bloqueado
    Dado um rascunho em "em moderação"
    Quando o coordenador rejeita sem informar motivo
    Então o sistema bloqueia a operação por justificativa obrigatória (JUSTIFICATION_REQUIRED)
    E o status do conteúdo permanece "em moderação"

  # ───────────────────────────────────────────────────────────────────────────
  # AC-016-5 — Registro de decisão (ubíquo / auditoria append-only)
  # ───────────────────────────────────────────────────────────────────────────

  @ac-016-5 @auditoria
  Esquema do Cenário: Toda decisão de moderação registra log com autor, momento e motivo
    Dado um rascunho em "em moderação"
    Quando o coordenador executa a decisão "<decisao>" com motivo "<motivo>"
    Então o sistema registra um log de auditoria do tipo "<evento>"
    E o log contém o identificador do moderador (autor da decisão)
    E o log contém o timestamp da decisão
    E o log contém o motivo "<motivo>" quando a decisão exige justificativa

    Exemplos:
      | decisao  | motivo                    | evento                            |
      | aprovar  |                           | CONTENT_APPROVED                  |
      | devolver | Faltam dados de contato   | CONTENT_RETURNED_FOR_ADJUSTMENTS  |
      | rejeitar | Conteúdo fora de escopo   | CONTENT_REJECTED                  |

  @ac-016-5 @auditoria @imutabilidade
  Cenário: Log de decisão de moderação é append-only
    Dado um log de auditoria de uma decisão de moderação já gravado
    Quando se tenta alterar ou remover esse registro
    Então o sistema impede a operação (audit_log é append-only — REVOKE UPDATE/DELETE)
