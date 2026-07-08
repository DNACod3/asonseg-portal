# .specs/features/vagas/usp-024-expiracao-automatica/tests/bdd/usp-024-expiracao-automatica.feature
# Fonte: docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-024.md (E-001..E-004, P-001..P-005,
#        L-001..L-003, D-001..D-005) + .specs/features/vagas/usp-024-expiracao-automatica/spec.md (must-nots)
#        + design.md (§3 runJobExpiration/rota de cron/diasAteExpiracao/enqueueExpiryReminder).

@usp-024 @modulo-jobs @modulo-moderation
Funcionalidade: Expiração automática de vaga
  Como sistema (em nome do coordenador responsável pela higiene da lista)
  Quero mudar automaticamente para EXPIRED toda vaga cuja validade passou
  Para que a lista pública reflita sempre vagas vigentes e o status persistido não fique "ACTIVE fantasma"

  # --- E-001 / AC-024-1 — expiração materializada pelo job -----------------------------

  @ac-024-1 @e-001 @happy-path
  Cenário: O cron expira toda vaga ACTIVE com validade vencida
    Dado uma vaga "ACTIVE" com "validUntil" no passado (America/Sao_Paulo)
    E uma vaga "ACTIVE" com "validUntil" futuro
    E uma vaga já "EXPIRED"
    Quando a rota de cron executa
    Então a vaga vencida transiciona para "EXPIRED" via transitionContent(SYSTEM_JOB)
    E o sistema grava o evento de auditoria "JOB_EXPIRED" com before "{status:ACTIVE}" e after "{status:EXPIRED}"
    E a vaga vigente permanece "ACTIVE"
    E a vaga já "EXPIRED" permanece inalterada

  @ac-024-1 @u24-mn-07 @borda
  Cenário: Reexecução do cron sobre uma vaga já EXPIRED é idempotente
    Dado uma vaga "EXPIRED"
    Quando a rota de cron executa novamente
    Então a vaga NÃO é re-selecionada (a query filtra status='ACTIVE')
    E nenhum novo evento "JOB_EXPIRED" é gravado para essa vaga

  @ac-024-1 @borda
  Esquema do Cenário: Vaga não-ACTIVE vencida NÃO é expirada pelo cron
    Dado uma vaga "<status>" com "validUntil" no passado
    Quando a rota de cron executa
    Então essa vaga permanece "<status>" (a FSM só permite ACTIVE→EXPIRED; a query filtra status=ACTIVE)

    Exemplos:
      | status  |
      | PAUSED  |
      | DRAFT   |
      | ARCHIVED |

  @ac-024-1 @borda
  Cenário: Sem vagas vencidas, o cron responde resumo zerado sem erro
    Dado nenhuma vaga ACTIVE vencida
    Quando a rota de cron executa
    Então o sistema responde "{ expired: 0 }" sem erro

  # --- E-002 / P-001 — defesa em profundidade on-read -----------------------------------

  @e-002 @p-001 @borda
  Cenário: Vaga ACTIVE vencida (job ainda não rodou) é excluída da busca pública
    Dado uma vaga "ACTIVE" com "validUntil" no passado (job de expiração NÃO executou)
    Quando alguém busca vagas publicamente
    Então essa vaga NÃO aparece nos resultados

  @e-002 @p-001 @p-004 @borda
  Cenário: Detalhe de vaga ACTIVE vencida (job ainda não rodou) mostra "vaga encerrada"
    Dado uma vaga "ACTIVE" com "validUntil" no passado (job de expiração NÃO executou)
    Quando alguém abre o detalhe dessa vaga por URL direta
    Então a página mostra "vaga encerrada"
    E o botão "candidatar-se" NÃO é exibido ativo

  # --- P-002 — timezone --------------------------------------------------------------

  @p-002 @borda
  Cenário: A fronteira de expiração usa o dia-calendário de São Paulo, não UTC
    Dado uma vaga com "validUntil" = "31/12" (meia-noite BRT do dia seguinte é a fronteira)
    Quando "hoje" é calculado pelo job e pela query on-read
    Então ambos usam "hojeSaoPaulo()" (America/Sao_Paulo)
    E a vaga expira à meia-noite BRT do dia seguinte, não às 21h UTC do dia anterior

  @borda
  Cenário: validUntil exatamente hoje mantém a vaga visível
    Dado uma vaga "ACTIVE" com "validUntil" igual ao dia de hoje (America/Sao_Paulo)
    Quando o cron executa
    Então essa vaga permanece "ACTIVE" (a regra é validUntil < hoje para expirar)

  # --- P-005 — sem exclusão física -----------------------------------------------------

  @p-005 @borda
  Cenário: Expirar uma vaga não apaga a vaga nem suas candidaturas
    Dado uma vaga "ACTIVE" vencida com candidaturas ativas
    Quando o cron a expira
    Então a vaga ainda existe no banco com "status=EXPIRED"
    E as candidaturas continuam intactas

  # --- Rota de cron: autenticação + observabilidade (U24-MN-06) ------------------------

  @u24-mn-06 @borda
  Cenário: Requisição sem CRON_SECRET correto é recusada
    Quando a rota de cron é chamada sem o cabeçalho "Authorization: Bearer ${CRON_SECRET}" esperado
    Então o sistema responde "401"
    E nenhuma expiração é executada

  @borda
  Cenário: CRON_SECRET não configurado no ambiente responde 503
    Dado que a variável de ambiente "CRON_SECRET" não está configurada
    Quando a rota de cron é chamada
    Então o sistema responde "503"

  @happy-path
  Cenário: Execução bem-sucedida retorna o resumo e loga início/fim
    Quando a rota de cron é chamada com o segredo correto
    Então o sistema responde "200" com "{ expired: N, scanned: M }"
    E loga início e fim da execução com a contagem

  @borda
  Cenário: Erro durante a execução responde 500 e loga o erro
    Dado uma falha inesperada durante a expiração
    Quando a rota de cron executa
    Então o sistema responde "500"
    E registra "log.error" estruturado

  # --- E-003 — seam de aviso D-3 (enqueue Outbox), P2 -----------------------------------

  @e-003 @u24-mn-07 @happy-path
  Cenário: Vaga a 3 dias da validade sem lembrete enviado é enfileirada na Outbox
    Dado uma vaga "ACTIVE" que expira em exatamente 3 dias (America/Sao_Paulo)
    E "expiryReminderSentAt" ainda nulo
    Quando o cron executa
    Então o sistema grava uma linha "Outbox" com "topic='email'" e o payload da vaga
    E marca "expiryReminderSentAt = now()" na mesma passada

  @e-003 @u24-mn-07 @borda
  Cenário: Segunda execução não reenfileira o lembrete da mesma vaga
    Dado uma vaga "ACTIVE" a 3 dias da validade com "expiryReminderSentAt" já preenchido
    Quando o cron executa novamente
    Então nenhuma nova linha "Outbox" é criada para essa vaga

  # --- E-004 — badge "expira em N dias" no painel (P2) ----------------------------------

  @e-004 @p-003
  Cenário: diasAteExpiracao calcula os dias corretos por fuso
    Dado uma vaga com "validUntil" a N dias de hoje (America/Sao_Paulo)
    Quando "diasAteExpiracao(validUntil, hojeSP)" é chamado
    Então o resultado é N, considerando a fronteira de meia-noite BRT
