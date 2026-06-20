# .specs/features/cadastros-publicos/usp-011-cadastro-cliente/tests/bdd/usp-011-cadastro-cliente.feature
# Fonte: expectations-USP-011.md (E-001/E-002 + must-not P-001..P-003 + L-001/L-002) · issue #118 · matriz-conexoes.md §USP-011
#        ADR-0011 (pessoa unificada, papel) · ADR-0013 (LGPD consentimento por finalidade)
#        ADR-0020 (atomicidade papel+consent+manifestação) · ADR-0023 (auditoria append-only)
#        project-guideline §4 (Server Action), §12 (testes). EARS verbatim na traceability.md. Não enfraquecer (P4).
#
# RECORTE DE ESCOPO (#118): esta US entrega o schema ClientProfile (#119) e o helper transacional idempotente
# `ensureClientRole(tx, …)` + evento CLIENT_ROLE_ACTIVATED (#120). A EXIBIÇÃO do termo (P-002 / E-001-UI), a
# composição da transação única e a criação da manifestação pertencem à USP-033 (`services.manifestarInteresse`),
# que consome este helper — esses cenários ficam marcados @fora-desta-us (cobertos por E2E da USP-033).

@usp-011 @modulo-persons
Funcionalidade: Ativação automática do papel de cliente de serviço
  Como Pessoa autenticada
  Quero que o papel de cliente seja ativado automaticamente na 1ª manifestação de interesse
  Para contratar serviços sem formulário adicional, com base legal registrada (finalidade 4)

  Contexto:
    Dada uma Pessoa autenticada chamada "Maria" sem o papel de cliente ativo
    E que ela aceitou a finalidade de consentimento "PORTAL_ACCESS"

  # ───────────────────── E-001 (parte server) — ativação atômica papel + consent na tx recebida ─────────────────────
  # Arquitetura: `ensureClientRole(tx, …)` é um HELPER que recebe a transação do chamador (USP-033). Dentro da MESMA
  # transação: cria/reaproveita o grant CLIENT (AWAITING_CONSENT→ACTIVE), persiste o Consent SERVICE_HIRING e garante
  # PORTAL_ACCESS, faz upsert do ClientProfile, e só então promove o grant a ACTIVE (P-001). Sem Server Action própria.

  @e-001 @happy-path @lgpd
  Cenário: Primeira ativação cria papel CLIENT, ClientProfile e consentimento SERVICE_HIRING na mesma transação
    Dado que "Maria" ainda não possui o papel de cliente
    Quando o helper de ativação de cliente é executado dentro da transação do chamador
    Então o sistema ativa o papel de cliente para "Maria" (grant CLIENT em status "ACTIVE"), sem moderação do papel
    E persiste o consentimento "SERVICE_HIRING" com versão, data e IP atômico à ativação do papel (P-001)
    E garante o consentimento "PORTAL_ACCESS" ativo
    E cria o perfil de cliente (ClientProfile) idempotente por personId
    E registra log de auditoria dos eventos "CLIENT_ROLE_ACTIVATED" e "CONSENT_GRANTED"
    E o helper retorna que houve ativação ("activated": verdadeiro)

  @e-001 @atomicidade @must-not @p-001
  Cenário: Papel CLIENT nunca chega a ACTIVE sem o consentimento da finalidade 4 persistido na mesma transação
    Dado que a persistência do consentimento "SERVICE_HIRING" falha dentro da transação
    Quando o helper de ativação de cliente é executado
    Então a transação inteira é revertida
    E nenhum grant CLIENT em status "ACTIVE" permanece para "Maria"
    E nenhum ClientProfile é criado

  # ───────────────────── E-002 / AC #118-3 — idempotência (no-op quando papel já ativo) ─────────────────────
  @e-002 @idempotencia @happy-path
  Cenário: Reexecução com papel de cliente já ativo é no-op idempotente
    Dado que "Maria" já possui o papel de cliente ativo
    Quando o helper de ativação de cliente é executado novamente
    Então nenhum novo grant CLIENT é criado
    E nenhum novo consentimento "SERVICE_HIRING" é criado
    E nenhum novo ClientProfile é criado
    E nenhum evento "CLIENT_ROLE_ACTIVATED" é registrado
    E o helper retorna que NÃO houve ativação ("activated": falso)

  @e-002 @idempotencia @auditoria
  Cenário: Evento CLIENT_ROLE_ACTIVATED é emitido apenas quando há ativação real
    Dado que "Maria" não possui o papel de cliente na 1ª execução e já o possui na 2ª
    Quando o helper é executado duas vezes
    Então exatamente um evento "CLIENT_ROLE_ACTIVATED" é registrado (somente na 1ª)

  # ───────────────────── Regra pura de idempotência (domínio) ─────────────────────
  @e-002 @dominio @unit
  Cenário: decideClientActivation indica ativação só quando o papel CLIENT está ausente
    Dado um conjunto de papéis atuais da Pessoa
    Quando "CLIENT" não está presente, então decideClientActivation indica needsActivation verdadeiro
    E quando "CLIENT" já está presente, então indica needsActivation falso

  # ───────────────────── P-003 — exige credencial (Pessoa logada) ─────────────────────
  # O guard de sessão (getCurrentPerson) é responsabilidade do chamador USP-033; aqui ancora-se a invariante
  # de que o helper opera sobre um personId resolvido da sessão, nunca de input arbitrário.
  @p-003 @seguranca @fora-desta-us
  Cenário: Pessoa sem credencial não pode ter papel de cliente ativado
    Dado um requisitante sem sessão autenticada no fluxo de manifestação (USP-033)
    Quando ele tenta manifestar interesse
    Então o sistema recusa com erro "UNAUTHENTICATED" antes de chamar o helper de ativação
    E nenhum papel de cliente é criado

  # ───────────────────── E-001 (UI) / P-002 — termo explícito antes do aceite — USP-033 ─────────────────────
  @e-001-ui @p-002 @lgpd @fora-desta-us
  Cenário: Termo da finalidade 4 é exibido e aceito explicitamente antes da ativação (USP-033)
    Dado que "Maria" abre o detalhe de um serviço (USP-031) e clica em "entrar em contato"
    Quando ela ainda não possui o papel de cliente
    Então o sistema exibe explicitamente o termo curto da finalidade 4 (scroll-to-accept)
    E exige aceite explícito antes de ativar o papel e revelar o contato
    # Verificado em E2E da USP-033, não nesta US.

  # ───────────────────── L-001 — desempenho — USP-033/release ─────────────────────
  @l-001 @performance @fora-desta-us
  Cenário: Ativação automática + manifestação concluem em ≤ 2s p95
    # Verificado em teste de carga/observabilidade da USP-033, não nesta US.
