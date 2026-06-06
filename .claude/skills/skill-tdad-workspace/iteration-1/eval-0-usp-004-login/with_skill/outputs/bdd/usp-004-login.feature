# bdd/usp-004-login.feature
# Fonte: PRD §Épico 1 USP-004 (Autenticar no portal com e-mail e senha)
#        ADR-T-0003 (Supabase Auth + RBAC aplicacional; bloqueio 5 tentativas/15min via wrapper sobre auth_attempts;
#                    sessão server-side via @supabase/ssr em cookies HttpOnly)
#        ADR-T-0004 (auditoria append-only; auth_attempts registra success/failureCode)
#        ADR-T-0008 (Pessoa unificada — login só para Pessoa com supabaseUserId vinculado e is_active)
#        project-guideline §4 (Server Action), §12 (casos obrigatórios de teste)
#        technical-design §schema (model AuthAttempt: email, ip, success, failureCode, attemptedAt)

@usp-004 @modulo-identity
Funcionalidade: Autenticar no portal com e-mail e senha
  Como usuário com credencial ativa
  Quero fazer login no portal com meu e-mail e senha
  Para usar as funcionalidades autenticadas

  @ac-004-1 @happy-path
  Cenário: Credenciais válidas autenticam e redirecionam à tela inicial
    Dado uma Pessoa ativa com credencial de e-mail "joao@exemplo.com" e senha "SenhaForte!123"
    Quando ela submete o login com e-mail "joao@exemplo.com" e senha "SenhaForte!123"
    Então o sistema autentica a Pessoa
    E estabelece a sessão server-side em cookies HttpOnly
    E registra a tentativa em auth_attempts com sucesso
    E redireciona para a tela inicial
    E a ação retorna sucesso

  @ac-004-2 @borda @seguranca
  Cenário: Credenciais inválidas exibem mensagem genérica
    Dado uma Pessoa ativa com credencial de e-mail "joao@exemplo.com" e senha "SenhaForte!123"
    Quando ela submete o login com e-mail "joao@exemplo.com" e senha "SenhaErrada"
    Então o sistema rejeita a autenticação
    E exibe a mensagem genérica "credenciais inválidas"
    E não revela se o e-mail existe ou se a senha está incorreta
    E registra a tentativa em auth_attempts como falha

  @ac-004-2 @borda @seguranca
  Cenário: E-mail inexistente exibe a mesma mensagem genérica
    Dado que não existe credencial para o e-mail "ninguem@exemplo.com"
    Quando um visitante submete o login com e-mail "ninguem@exemplo.com" e qualquer senha
    Então o sistema rejeita a autenticação
    E exibe a mensagem genérica "credenciais inválidas"
    E não revela a inexistência do e-mail

  @ac-004-3 @borda @seguranca @rate-limit
  Cenário: Cinco falhas em quinze minutos bloqueiam novas tentativas por quinze minutos
    Dado uma Pessoa com e-mail "joao@exemplo.com"
    E que já houve 4 tentativas de login com falha para esse e-mail nos últimos 15 minutos
    Quando uma 5ª tentativa de login falha para esse e-mail
    Então o sistema bloqueia novas tentativas de login para esse e-mail
    E mantém o bloqueio por 15 minutos
    E rejeita uma 6ª tentativa mesmo que a senha correta seja informada
    E informa que a conta está temporariamente bloqueada

  @ac-004-3 @borda @rate-limit
  Cenário: Bloqueio expira após a janela de quinze minutos
    Dado que o e-mail "joao@exemplo.com" está bloqueado por excesso de tentativas
    Quando se passam mais de 15 minutos desde a última tentativa contabilizada
    E a Pessoa submete o login com a senha correta
    Então o sistema permite a tentativa
    E autentica a Pessoa

  @ac-004-3 @concorrencia @rate-limit
  Cenário: Tentativas simultâneas não driblam o limite de 5 em 15 minutos
    Dado uma Pessoa com e-mail "joao@exemplo.com" com 4 falhas nos últimos 15 minutos
    Quando duas tentativas de login com falha são submetidas simultaneamente para esse e-mail
    Então no máximo uma delas é contabilizada como a 5ª antes de o bloqueio passar a valer
    E a janela não é driblada por corrida (a contagem é consistente)

  @ac-004-4 @invariante @sessao
  Cenário: Sessão é encerrada após 12 horas de inatividade
    Dado uma Pessoa autenticada com sessão estabelecida
    Quando se passam 12 horas sem nenhuma atividade na sessão
    Então o sistema encerra a sessão
    E uma nova requisição autenticada é tratada como não autenticada
    E a Pessoa é redirecionada ao login

  @ac-004-4 @invariante @sessao
  Cenário: Atividade dentro da janela mantém a sessão viva
    Dado uma Pessoa autenticada com sessão estabelecida
    Quando há atividade na sessão antes de completar 12 horas de inatividade
    Então o sistema mantém a sessão ativa
