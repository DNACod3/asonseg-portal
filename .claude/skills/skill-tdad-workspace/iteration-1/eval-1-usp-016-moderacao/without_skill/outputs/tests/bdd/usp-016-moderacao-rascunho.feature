# tests/bdd/usp-016-moderacao-rascunho.feature
# Fonte: PRD §Épico 4 USP-016 (Moderar rascunho de vaga, CV ou serviço)
#        ADR-0011 técnico (máquina de estados de moderação · transitionContent)
#        ADR-0015 negócio (moderação humana pré-publicação)
#        ADR-T-0004 (audit log append-only) · ADR-T-0013 (revalidation on-demand)
#        technical-design §3.3 (sequence moderação) · §117-119 (MODERATE_JOB/CV/SERVICE)
#        project-guideline §4 (Server Action), §12 (casos obrigatórios de teste)
#
# Path-alvo na fase Execute: e2e/ (fluxo Top 8 #8) + modules/moderation/__tests__/

@usp-016 @modulo-moderation
Funcionalidade: Moderar rascunho de vaga, CV ou serviço
  Como coordenador da área Portal Empregabilidade (ou voluntário delegado)
  Quero revisar rascunhos e aprovar, devolver para ajustes ou rejeitar
  Para que apenas conteúdo verificado fique visível no portal

  Contexto:
    Dado que estou autenticado como coordenador com permissão de moderar o tipo de conteúdo
    E existe conteúdo com status "em moderação" (IN_MODERATION)

  # -------------------------------------------------------------------------
  # AC-016-1 — WHEN o coordenador acessa a fila de moderação, the system SHALL
  #            listar rascunhos com status "em moderação" ordenados por data de envio.
  # -------------------------------------------------------------------------
  @ac-016-1 @happy-path
  Cenário: Fila lista apenas conteúdo em moderação, ordenado por data de envio
    Dado os conteúdos em moderação enviados nas datas:
      | titulo                 | enviadoEm           |
      | Vaga Auxiliar          | 2026-05-20T09:00:00 |
      | CV João                | 2026-05-22T14:30:00 |
      | Serviço Costura        | 2026-05-21T11:00:00 |
    E também existe uma vaga já com status "ativo"
    Quando o coordenador acessa a fila de moderação
    Então a fila lista somente os 3 conteúdos com status "em moderação"
    E a vaga já ativa NÃO aparece na fila
    E a ordem é por data de envio: "Vaga Auxiliar", "Serviço Costura", "CV João"

  # -------------------------------------------------------------------------
  # AC-016-2 — WHEN o coordenador aprova, the system SHALL alterar status para
  #            "ativo" e enviar e-mail ao autor.
  # -------------------------------------------------------------------------
  @ac-016-2 @happy-path
  Cenário: Aprovar transita para ativo e notifica o autor
    Dado uma vaga em moderação de autoria de "empresa@exemplo.com"
    Quando o coordenador aprova a vaga
    Então o status da vaga passa para "ativo" (ACTIVE)
    E um e-mail de aprovação é enviado ao autor "empresa@exemplo.com"
    E é registrado o evento de auditoria CONTENT_APPROVED
    E o cache público das rotas afetadas é revalidado
    E a ação retorna sucesso

  # -------------------------------------------------------------------------
  # AC-016-3 — WHEN o coordenador devolve para ajustes, the system SHALL exigir
  #            motivo textual obrigatório, alterar status para "aguardando ajustes"
  #            e enviar e-mail ao autor com o motivo.
  # -------------------------------------------------------------------------
  @ac-016-3 @happy-path
  Cenário: Devolver para ajustes com motivo transita para aguardando ajustes
    Dado um CV em moderação de autoria de "candidato@exemplo.com"
    Quando o coordenador devolve para ajustes com o motivo "Foto ilegível, reenviar"
    Então o status do CV passa para "aguardando ajustes" (AWAITING_ADJUSTMENTS)
    E um e-mail é enviado ao autor "candidato@exemplo.com" contendo o motivo "Foto ilegível, reenviar"
    E é registrado o evento de auditoria CONTENT_RETURNED com o motivo
    E a ação retorna sucesso

  @ac-016-3 @borda
  Cenário: Devolver sem motivo é bloqueado (motivo obrigatório)
    Dado um CV em moderação
    Quando o coordenador tenta devolver para ajustes sem informar motivo
    Então o sistema bloqueia a operação com o erro "JUSTIFICATION_REQUIRED"
    E o status do CV permanece "em moderação"
    E nenhum e-mail é enviado

  # -------------------------------------------------------------------------
  # AC-016-4 — WHEN o coordenador rejeita definitivamente, the system SHALL exigir
  #            motivo textual, alterar status para "rejeitado" e enviar e-mail ao autor.
  # -------------------------------------------------------------------------
  @ac-016-4 @happy-path
  Cenário: Rejeitar definitivamente com motivo transita para rejeitado
    Dado um serviço em moderação de autoria de "prestador@exemplo.com"
    Quando o coordenador rejeita definitivamente com o motivo "Conteúdo viola diretrizes"
    Então o status do serviço passa para "rejeitado" (REJECTED)
    E um e-mail é enviado ao autor "prestador@exemplo.com" contendo o motivo
    E é registrado o evento de auditoria CONTENT_REJECTED com o motivo
    E a ação retorna sucesso

  @ac-016-4 @borda
  Cenário: Rejeitar sem motivo é bloqueado (motivo obrigatório)
    Dado um serviço em moderação
    Quando o coordenador tenta rejeitar definitivamente sem informar motivo
    Então o sistema bloqueia a operação com o erro "JUSTIFICATION_REQUIRED"
    E o status do serviço permanece "em moderação"

  # -------------------------------------------------------------------------
  # AC-016-5 — The system SHALL registrar log da decisão (autor, momento, motivo).
  # (ubíquo — vale em toda decisão; aqui validado de forma transversal)
  # -------------------------------------------------------------------------
  @ac-016-5 @auditoria
  Esquema do Cenário: Toda decisão de moderação registra log com decisor, momento e motivo
    Dado um <conteudo> em moderação
    Quando o coordenador "<decisor>" executa a decisão "<decisao>" com motivo "<motivo>"
    Então é registrado um log de auditoria do evento "<evento>"
    E o log contém o identificador do decisor "<decisor>"
    E o log contém o timestamp da decisão
    E o log contém o motivo "<motivo>" quando a decisão exige justificativa

    Exemplos:
      | conteudo | decisor              | decisao  | motivo                  | evento            |
      | vaga     | coord@exemplo.com    | aprovar  |                         | CONTENT_APPROVED  |
      | cv       | coord@exemplo.com    | devolver | Foto ilegível           | CONTENT_RETURNED  |
      | servico  | voluntario@exemplo.com | rejeitar | Viola diretrizes      | CONTENT_REJECTED  |

  # -------------------------------------------------------------------------
  # Casos obrigatórios de Server Action sensível (project-guideline §12)
  # que não estão explícitos no PRD mas são parte do contrato.
  # -------------------------------------------------------------------------
  @ac-016-2 @ac-016-3 @ac-016-4 @seguranca
  Cenário: Usuário sem permissão de moderação não pode decidir
    Dado que estou autenticado como uma Pessoa SEM a permissão de moderar o tipo de conteúdo
    Quando tento aprovar, devolver ou rejeitar um conteúdo em moderação
    Então o sistema recusa a operação por falta de permissão ("FORBIDDEN")
    E o status do conteúdo permanece "em moderação"

  @ac-016-2 @borda
  Cenário: Transição inválida a partir de estado não-moderável é recusada
    Dado uma vaga já com status "ativo"
    Quando o coordenador tenta aprovar a vaga novamente
    Então o sistema recusa com o erro "INVALID_TRANSITION"

  @ac-016-2 @concorrencia
  Cenário: Dois moderadores não aprovam o mesmo conteúdo em paralelo
    Dado uma vaga em moderação
    Quando dois coordenadores aprovam a mesma vaga simultaneamente
    Então apenas uma transição é aplicada (status final "ativo")
    E a segunda chamada falha com "INVALID_TRANSITION"
    E apenas um evento CONTENT_APPROVED é registrado
