# Expectations — USP-004: Autenticar no portal com e-mail e senha

**Origem:** AC-004-1 a AC-004-4 do PRD v0.3, mais derivação de §6.3 (segurança) e §5.1 (in-scope autenticação).

> ✅ ENCAMINHADO (PRD v0.4): lacuna de ACs de login a refletir no PRD v0.4; comportamento já definido e coberto pelos expectations.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o usuário submete e-mail e senha válidos, the system SHALL autenticar a Pessoa, iniciar sessão de 12 horas, carregar os papéis ativos da Pessoa e redirecionar para a tela inicial pertinente.

- **E-002:** IF as credenciais são inválidas (e-mail não cadastrado OU senha incorreta), THEN the system SHALL exibir mensagem genérica idêntica ("credenciais inválidas") em ambos os casos, sem revelar qual campo está errado.

  *Ajuste do AC-004-2:* explicita que a mensagem é **igual** para os dois casos (anti-enumeration).

- **E-003:** IF o usuário falhar 5 tentativas em 15 minutos, THEN the system SHALL bloquear novas tentativas para essa identidade pelo período definido, com mecânica que **não permite contorno por troca de IP nem por troca de e-mail isolada**.
  ✅ RESOLVIDO (ADR-0029 / TD §4.4): chave combinada `(e-mail, IP)`, 5 tentativas/15 min, não exponencial.

- **E-004:** WHILE o usuário está autenticado, the system SHALL encerrar a sessão após 12 horas (contagem desde o login, não inatividade).

  *Ajuste do AC-004-4:* explicitada a contagem fixa de 12h (a decisão de elicitação foi tempo fixo, não inatividade variável).

- **E-005:** WHEN uma Pessoa cuja senha foi gerada pela ASONSEG (cenário da reivindicação USP-003) autentica pela primeira vez, the system SHALL forçar troca de senha antes de liberar funcionalidades.

- **E-006:** WHEN o login é bem-sucedido, the system SHALL gravar log de auditoria com a Pessoa, IP, user agent, data/hora. Mesmo log em tentativas falhas.

## 2. Proibições (must-not)

- **P-001 (toca F1 — brute-force):** O sistema NÃO PODE permitir que um atacante contorne o bloqueio de 5 tentativas em 15 min apenas trocando IPs ou trocando e-mails alvos. A política de bloqueio precisa cobrir ambos os vetores.

- **P-002 (toca F2 — enumeração):** O sistema NÃO PODE retornar mensagem diferenciada para "e-mail não encontrado" vs "senha incorreta". Resposta é genérica e idêntica nas duas situações, e em tempos de resposta comparáveis (sem timing attack).

- **P-003 (toca F3 — cookie inseguro):** O sistema NÃO PODE emitir cookie de sessão sem as flags HttpOnly, Secure e SameSite adequadas. Em ambiente de produção, cookie inseguro é falha bloqueante.

- **P-004 (toca F4 — Pessoa inativada com sessão viva):** O sistema NÃO PODE permitir que Pessoa marcada como inativa (USP-007) execute operações autenticadas, mesmo que sua sessão de 12h ainda não tenha expirado. A verificação de status precisa acontecer em cada requisição ou em janela suficientemente curta para reagir a inativações urgentes.
  ✅ RESOLVIDO (ADR-0030): revalidação por request, com cache opcional ≤30s.

- **P-005 (toca F5 — log silencioso):** O sistema NÃO PODE concluir login bem-sucedido sem registrar log de auditoria correspondente. Falha na auditoria dispara alerta operacional.

- **P-006 (toca F6 — reset com janela dupla):** O sistema NÃO PODE permitir que, após uma redefinição de senha via USP-005, sessões ativas com a senha antiga continuem válidas. A redefinição invalida todas as sessões ativas da Pessoa.

- **P-007:** O sistema NÃO PODE permitir login de Pessoa cadastrada sem credencial (USP-002) por nenhuma rota — direta, "esqueci minha senha", ou alternativa.

## 3. Limites

- **L-001 (Performance):** Resposta do submit (sucesso ou falha) ≤ 3s p95. Tempos comparáveis entre sucesso e falha (mitigar timing attack).
- **L-002 (Sessão):** 12 horas fixas desde o login (decisão de elicitação).
- **L-003 (Lockout):** 5 tentativas em 15 min → bloqueio. Cobertura por e-mail e IP combinados.
- **L-004 (Rate limiting):** Endpoint de login com rate limiting agressivo por IP em todas as APIs públicas (§6.3).
  ✅ RESOLVIDO (ADR-0029 / TD §4.4): rate limit por rota/identidade com alerta; o limite concreto é parâmetro tunável.
- **L-005 (Cookie):** HttpOnly + Secure + SameSite adequados — não-negociáveis em produção.
- **L-006 (Retenção):** Log de tentativas (sucesso e falha) retido por janela suficiente para análise de incidente.
  ✅ RESOLVIDO parte técnica (ADR-0029 / project-guideline §10): lockout de 15 min e retenção de `auth_attempts` por 90 dias (`AUTH_ATTEMPTS_RETENTION_DAYS`). ❓ Validação da janela de retenção (proposta: 90 dias) pela DPO (Angélica) permanece como gate jurídico.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Em ensaio de carga sintética: 100 tentativas de senha errada para a mesma Pessoa, vindas de IPs diferentes, ainda assim acionam bloqueio dessa Pessoa após 5 tentativas no agregado, ou mecanismo equivalente. Validado por engenheiro Bravi + sponsor.

- **D-002:** Em teste de enumeração: 10 tentativas alternadas com e-mails existentes e inexistentes retornam mensagens idênticas e tempos de resposta indistinguíveis (within ±50ms ou margem técnica acordada).

- **D-003:** Em teste de inativação (USP-007): após inativar uma Pessoa com sessão ativa, sua próxima requisição autenticada é negada em ≤ N segundos, sem precisar esperar a expiração da sessão.
  ✅ RESOLVIDO parte técnica (ADR-0030): revalidação de status por request → próxima requisição da Pessoa inativada negada na janela curta ≤30s (cache opcional), sem esperar a expiração da sessão. ✅ RESOLVIDO (dono do intent): alvo operacional = efeito na próxima requisição (janela ≤30s), aceito.

- **D-004:** Em ensaio de redefinição (USP-005): a senha antiga deixa de funcionar **e** as sessões ativas com ela são derrubadas imediatamente. Validado por engenheiro + sponsor.

- **D-005:** O sponsor abre a auditoria de logins recentes (USP-008) e vê eventos de sucesso e falha com Pessoa, IP, user agent, data/hora.
