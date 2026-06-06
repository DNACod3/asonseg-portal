# language: pt
# Fonte da verdade (P1): este arquivo materializa os critérios EARS da USP-004.
# US: USP-004 — Autenticar no portal com e-mail e senha
# PRD: docs/prd/prd-asonseg-portal-mvp.md (linhas 272-283)
# ADRs de apoio: ADR-0003 (Supabase Auth + RBAC aplicacional), ADR-0014 (CAPTCHA após 3 falhas),
#                ADR-0015 (sessão server-side, cookie 12h)
# Módulo alvo: src/modules/identity

Funcionalidade: Autenticação no portal com e-mail e senha
  Como usuário com credencial ativa
  Quero fazer login no portal com meu e-mail e senha
  Para que eu possa usar as funcionalidades autenticadas

  Contexto:
    Dado um usuário com credencial ativa de e-mail "ana@exemplo.org" e senha "Senha#Forte1"
    E a tabela "auth_attempts" sem tentativas recentes para esse e-mail

  # AC-004-1 — WHEN o usuário submete e-mail e senha válidos,
  #            the system SHALL autenticar e redirecionar à tela inicial.
  @AC-004-1 @happy-path
  Cenário: Login com credenciais válidas autentica e redireciona à tela inicial
    Quando o usuário submete o e-mail "ana@exemplo.org" e a senha "Senha#Forte1"
    Então a sessão server-side é estabelecida via cookie HttpOnly
    E o sistema registra uma tentativa de sucesso em "auth_attempts"
    E o sistema registra o evento de auditoria "LOGIN_SUCCEEDED"
    E o usuário é redirecionado para a tela inicial ("/")

  # AC-004-2 — IF as credenciais são inválidas,
  #            THEN the system SHALL exibir mensagem genérica "credenciais inválidas".
  @AC-004-2 @sad-path
  Cenário: Credenciais inválidas exibem mensagem genérica (sem revelar a causa)
    Quando o usuário submete o e-mail "ana@exemplo.org" e a senha "errada"
    Então o sistema retorna erro com código "INVALID_CREDENTIALS"
    E a mensagem exibida é exatamente "Credenciais inválidas"
    E a mensagem NÃO revela se o e-mail existe nem se a senha está incorreta
    E o sistema registra uma tentativa de falha em "auth_attempts"
    E o sistema registra o evento de auditoria "LOGIN_FAILED"
    E nenhuma sessão é estabelecida

  @AC-004-2 @sad-path
  Cenário: E-mail inexistente produz a mesma mensagem genérica que senha incorreta
    Quando o usuário submete o e-mail "naoexiste@exemplo.org" e a senha "qualquer"
    Então o sistema retorna erro com código "INVALID_CREDENTIALS"
    E a mensagem exibida é exatamente "Credenciais inválidas"

  # AC-004-3 — IF o usuário falhar 5 tentativas em 15 minutos,
  #            THEN the system SHALL bloquear novas tentativas por 15 minutos.
  @AC-004-3 @rate-limit
  Cenário: Bloqueio temporário após 5 falhas em 15 minutos
    Dado que o e-mail "ana@exemplo.org" acumulou 5 tentativas de falha nos últimos 15 minutos
    Quando o usuário submete o e-mail "ana@exemplo.org" e a senha "Senha#Forte1"
    Então o sistema retorna erro com código "TOO_MANY_ATTEMPTS"
    E o sistema NÃO valida as credenciais contra o provedor de autenticação
    E o bloqueio permanece ativo por 15 minutos a partir da 5ª falha

  @AC-004-3 @rate-limit @boundary
  Cenário: A 5ª tentativa de falha ainda é processada; a 6ª é bloqueada
    Dado que o e-mail "ana@exemplo.org" acumulou 4 tentativas de falha nos últimos 15 minutos
    Quando o usuário submete o e-mail "ana@exemplo.org" e a senha "errada"
    Então o sistema retorna erro com código "INVALID_CREDENTIALS"
    E essa é registrada como a 5ª falha
    Quando o usuário submete novamente o e-mail "ana@exemplo.org" e a senha "Senha#Forte1"
    Então o sistema retorna erro com código "TOO_MANY_ATTEMPTS"

  @AC-004-3 @rate-limit @recovery
  Cenário: Após a janela de 15 minutos o bloqueio expira e o login volta a ser processado
    Dado que o e-mail "ana@exemplo.org" acumulou 5 tentativas de falha há mais de 15 minutos
    Quando o usuário submete o e-mail "ana@exemplo.org" e a senha "Senha#Forte1"
    Então a sessão server-side é estabelecida via cookie HttpOnly
    E o usuário é redirecionado para a tela inicial ("/")

  # AC-004-4 — WHILE o usuário está autenticado,
  #            the system SHALL encerrar a sessão após 12 horas de inatividade.
  @AC-004-4 @session
  Cenário: Sessão é encerrada após 12 horas de inatividade
    Dado que o usuário está autenticado com a última atividade há 12 horas e 1 minuto
    Quando o usuário acessa uma rota autenticada
    Então a sessão é considerada expirada
    E o usuário é redirecionado para a tela de login
    E o cookie de sessão é invalidado

  @AC-004-4 @session @boundary
  Cenário: Sessão permanece válida dentro da janela de 12 horas
    Dado que o usuário está autenticado com a última atividade há 11 horas e 59 minutos
    Quando o usuário acessa uma rota autenticada
    Então a sessão permanece válida
    E o acesso à rota é permitido
