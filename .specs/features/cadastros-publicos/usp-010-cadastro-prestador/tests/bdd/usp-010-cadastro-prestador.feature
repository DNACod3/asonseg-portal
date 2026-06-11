# .specs/features/cadastros-publicos/usp-010-cadastro-prestador/tests/bdd/usp-010-cadastro-prestador.feature
# Fonte: expectations-USP-010.md (E-001/E-002/E-003 + must-not P-001..P-005) · issue #110 · matriz-conexoes.md §USP-010
#        ADR-0011 (pessoa unificada, papel) · ADR-0013 (LGPD consentimento por finalidade)
#        ADR-0015 (papel NÃO é moderado; conteúdo é) · ADR-0020 (atomicidade papel+consent)
#        project-guideline §4 (Server Action), §12 (testes). EARS verbatim na traceability.md. Não enfraquecer (P4).

@usp-010 @modulo-persons
Funcionalidade: Cadastro de prestador de serviço PF (ativação do papel)
  Como Pessoa autenticada
  Quero ativar o papel de prestador de serviço PF e registrar meu perfil (descrição, região, foto)
  Para publicar serviços em meu nome (USP-029)

  Contexto:
    Dado uma Pessoa autenticada chamada "João" sem o papel de prestador ativo
    E que ele aceitou a finalidade de consentimento "PORTAL_ACCESS"

  # ───────────────────── E-001 — ativar papel imediatamente; consent atômico ao papel ─────────────────────
  # Arquitetura: duas Server Actions encadeadas. (1) `activateAdditionalRole` (USP-006) grava o papel
  # PROVIDER e o consentimento SERVICE_OFFERING na MESMA transação (invariante LGPD papel⇔consent, P-003).
  # (2) `activateProviderRole` cria o ProviderProfile DRAFT e audita PROVIDER_ROLE_ACTIVATED na transação
  # seguinte, após verificar (não regravar) os consentimentos. Não há transação única dos três eventos.

  @e-001 @happy-path @lgpd
  Cenário: Ativação com aceite do termo da finalidade 3 ativa o papel imediatamente
    Dado que "João" aceita o termo da finalidade "SERVICE_OFFERING" na versão vigente "service-offering@v1.0"
    Quando ele submete a ativação do papel de prestador
    Então o sistema ativa o papel de prestador para "João" imediatamente, sem moderação do papel
    E persiste o consentimento "SERVICE_OFFERING" com versão, data e IP atômico à ativação do papel (transação de `activateAdditionalRole`)
    E cria o perfil de prestador com status "DRAFT" na transação de `activateProviderRole`
    E registra log de auditoria dos eventos "ROLE_GRANT_ACTIVATED" e "CONSENT_GRANTED" (ativação do papel) e "PROVIDER_ROLE_ACTIVATED" (criação do perfil)
    E a ação retorna sucesso

  @e-001 @seguranca @permissao
  Cenário: Submissão não autenticada é recusada
    Dado um requisitante sem sessão autenticada
    Quando ele tenta ativar o papel de prestador
    Então o sistema recusa com erro "UNAUTHENTICATED"
    E nenhum papel nem perfil de prestador é criado

  @e-001 @borda @idempotencia
  Cenário: Reativar o papel não duplica papel nem perfil nem consentimento
    Dado que "João" já tem o papel de prestador ativo e um perfil em status "DRAFT"
    Quando ele submete novamente a ativação do papel de prestador
    Então o sistema não cria um segundo perfil de prestador
    E não duplica o papel nem o consentimento "SERVICE_OFFERING"
    E a ação retorna sucesso (idempotente)

  # ───────────────────── P-003 — consentimento na mesma transação ─────────────────────

  @p-003 @borda @lgpd
  Cenário: Ativação sem consentimento de SERVICE_OFFERING é bloqueada
    Dado que "João" NÃO aceitou a finalidade "SERVICE_OFFERING"
    Quando ele tenta ativar o papel de prestador
    Então o sistema bloqueia com erro "CONSENT_REQUIRED"
    E nenhum papel nem perfil de prestador é criado

  @p-003 @atomicidade @lgpd
  Cenário: Falha ao persistir o consentimento aborta a ativação do papel (atomicidade)
    Dado que "João" aceita o termo da finalidade "SERVICE_OFFERING"
    Mas a gravação do consentimento falha na transação
    Quando ele submete a ativação do papel de prestador
    Então o papel de prestador NÃO fica ativo
    E nenhum consentimento parcial é persistido (rollback completo)

  # ───────────────────── E-002 — CNPJ MEI redireciona ao fluxo USP-012 (ADR-0031) ─────────────────────
  # REVISÃO 2026-06-10 (ADR-0031): P-001 e P-002 REVOGADOS. CNPJ MEI não é mais atributo do
  # prestador PF — passa a residir em `companies` via USP-012. A USP-010 não coleta CNPJ.

  @e-002 @happy-path @redirect
  Cenário: Optar por registrar MEI redireciona ao fluxo de cadastro de Empresa (USP-012)
    Dado que "João" ativou o papel de prestador PF
    E que a tela do prestador NÃO possui campo de CNPJ
    Quando ele escolhe "registrar meu MEI / atuar como empresa"
    Então o sistema o redireciona ao fluxo de cadastro de Empresa (USP-012)
    E o cadastro do MEI cria uma Company "type=MEI" com "João" como responsável
    E o ProviderProfile de "João" permanece sem qualquer campo de CNPJ

  @e-002 @borda @must-not
  Cenário: A USP-010 nunca persiste CNPJ no ProviderProfile
    Dado que "João" ativa o papel de prestador
    Quando o ProviderProfile é criado
    Então o registro do perfil NÃO contém nenhum campo de CNPJ
    # CNPJ MEI vive em `companies` (ADR-0031); o redirect para USP-012 é o único caminho.

  # ───────────────────── E-003 / P-004 — próximo passo e copy de oferta ─────────────────────

  @e-003 @happy-path @ui
  Cenário: Após ativar o papel, o usuário é direcionado ao próximo passo
    Dado que "João" ativou o papel de prestador com sucesso
    Quando a ativação é concluída
    Então o sistema redireciona para "publicar primeiro serviço" (USP-029) ou para o painel do prestador

  @p-004 @ui @must-not
  Cenário: A tela de ativação explicita que o prestador OFERECE serviços
    Dado que "João" abre a tela de ativação do papel de prestador
    Quando a tela é exibida
    Então o texto explicita claramente "agora você OFERECE serviços"
    E distingue do papel cliente, que CONTRATA serviços

  @p-004 @ui @lgpd
  Cenário: Formulário bloqueia o envio sem aceite de consentimento
    Dado que "João" preencheu os campos do perfil
    Mas NÃO marcou o aceite das finalidades "PORTAL_ACCESS" e "SERVICE_OFFERING"
    Quando ele tenta enviar o formulário
    Então o botão de envio permanece bloqueado
    E a Server Action não é chamada

  # ───────────────────── P-005 — prestador precisa de credencial ─────────────────────

  @p-005 @seguranca @must-not
  Cenário: Pessoa sem credencial não pode ativar o papel de prestador
    Dado uma Pessoa cadastrada sem credencial (USP-002 sem USP-003)
    Quando ela tenta ativar o papel de prestador
    Então o sistema recusa a ativação
    E exige login (credencial) antes de prosseguir

  # ───────────────────── Fora de escopo desta US (marcados, não testados aqui) ─────────────────────

  @foto @diferido-fase-4
  Cenário: Upload de foto do prestador em bucket público
    Dado que "João" anexa uma foto de perfil
    Quando o perfil é salvo
    Então a foto é armazenada no bucket público "provider-photos" e o caminho persistido em photoStoragePath
    # Diferido: bucket provider-photos é entregável da Fase 4 (TD §5). Aqui só o campo photoStoragePath (nullable).
