# Expectations — USP-005: Recuperar senha esquecida

**Origem:** AC-005-1 a AC-005-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o usuário solicita recuperação informando um e-mail, the system SHALL responder com mensagem genérica de confirmação ("se este e-mail estiver cadastrado, enviaremos um link de redefinição"), **independente** de o e-mail existir no sistema.

- **E-002:** WHEN o e-mail informado está cadastrado e pertence a Pessoa ativa com credencial, the system SHALL enviar e-mail com link de redefinição contendo token único, criptograficamente seguro, válido por 24 horas e de **uso único**.

- **E-003:** WHEN o usuário acessa link válido e define nova senha que satisfaz a política, the system SHALL atualizar a senha, invalidar o link, invalidar todas as sessões ativas anteriores da Pessoa, e autenticar a Pessoa.

  *Ajuste do AC-005-3:* explicitada a invalidação de sessões ativas anteriores (toca F1 do USP-004 e F1 deste intent).

- **E-004:** IF a Pessoa correspondente está inativada (USP-007), THEN the system SHALL NOT enviar link de redefinição (mas SHALL retornar a mesma mensagem genérica para o solicitante).

## 2. Proibições (must-not)

- **P-001 (toca F1 — link reusável):** O sistema NÃO PODE permitir que um link de redefinição seja usado mais de uma vez, nem que dois links válidos coexistam para a mesma Pessoa. Cada nova solicitação invalida links pendentes anteriores.

- **P-002 (toca F2 — enumeração por timing):** O sistema NÃO PODE responder em tempos perceptivelmente diferentes entre "e-mail cadastrado" e "e-mail não cadastrado". O processamento (incluindo envio assíncrono de e-mail quando aplicável) precisa garantir tempos de resposta indistinguíveis para o solicitante.

- **P-003 (toca F3 — Pessoa inativada recupera acesso):** O sistema NÃO PODE gerar link de redefinição para Pessoa marcada como inativa (USP-007). Pessoa inativada não pode voltar ao sistema por essa rota.

- **P-004 (toca F4 — link para e-mail antigo):** O sistema NÃO PODE enviar o link de redefinição para endereço diferente do e-mail atual da Pessoa. Endereços antigos, cacheados ou histórico de mudança não recebem links válidos.

- **P-005 (toca F5 — token em URL exposta):** O sistema NÃO PODE construir o link de redefinição de modo que o token apareça em referrer header para terceiros (ex.: assets externos carregados na página de redefinição). Token vive curto e é descartado do front após uso.
  ✅ RESOLVIDO (ADR-0029 / TD §4.4): token de reset de uso único válido por 24h validado no servidor; `redefinirSenha` invalida o token e todas as sessões ativas da Pessoa (`session_epoch++`).

- **P-006:** O sistema NÃO PODE permitir redefinição de senha sem que a nova senha satisfaça a política (mínimo definido em USP-001 — hash bcrypt, política mínima).

## 3. Limites

- **L-001 (Performance):** Submit da solicitação responde em ≤ 2s p95 em ambos os caminhos (existe / não existe).
- **L-002 (E-mail):** Link entregue ao SMTP em ≤ 60s da solicitação.
- **L-003 (Validade do link):** 24 horas. Após esse prazo, o token é inválido mesmo que ainda não tenha sido usado.
- **L-004 (Uso único):** Cada token vale para 1 uso e expira no momento do uso.
- **L-005 (Rate limiting):** Máximo N solicitações de recuperação por e-mail ou IP por janela de M minutos, para evitar floods de e-mail abusivo.
  ✅ RESOLVIDO (ADR-0029): rate limit do fluxo de recuperação por rota/identidade; os valores de N e M são parâmetros tunáveis.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Pessoa real, em ensaio, recebe o link em < 1 min, define nova senha e está logada — fluxo único, sem precisar do suporte. Validado em ≥ 2 ensaios.

- **D-002:** Em teste de enumeração por timing: 20 tentativas alternadas com e-mails existentes e inexistentes retornam tempos de resposta indistinguíveis (within margem técnica acordada). Validado por engenheiro Bravi.

- **D-003:** Em teste de reuso: após usar um link de redefinição, tentativa de reusar o mesmo link é rejeitada com erro determinístico. Após nova solicitação enquanto há link pendente, o link antigo deixa de funcionar.

- **D-004:** Em teste com Pessoa inativada (USP-007): solicitação de recuperação para o e-mail dela retorna mensagem genérica (sem revelar inativação) **e nenhum e-mail é enviado**. Validado por inspeção do log de envio.

- **D-005:** Em teste de invalidação de sessão: Pessoa autenticada em dois browsers; redefinição por um caminho derruba a sessão do outro. Validado por engenheiro + sponsor.
