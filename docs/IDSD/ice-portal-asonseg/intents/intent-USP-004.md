# Intent — USP-004: Login no portal

**Origem:** PRD v0.3 §5.1 (in-scope: autenticação por e-mail/senha) + §6.3 (segurança). USP-004 está listada no índice §5.1 com prioridade Must, mas a §5.2 do PRD não detalha os ACs.
**Dono do intent:** Sponsor + diretoria (segurança).

> ✅ ENCAMINHADO (PRD v0.4): ACs de login (e-mail+senha, lockout 5/15min, sessão 12h, troca no 1º acesso) a formalizar na §5.2 do PRD v0.4 — comportamento já validado pelo PO e implementado (ADR-0029/0030).

## 1. Descrição

Uma Pessoa com credencial ativa autentica-se no portal com e-mail e senha. O outcome é uma sessão autenticada de 12 horas, com identidade da Pessoa carregada e papéis ativos disponíveis. É o gate de entrada de todas as USPs autenticadas — qualquer fragilidade aqui (bypass de bloqueio, fixação de sessão, enumeração de e-mails) contamina o sistema inteiro.

## 2. Restrições

- E-mail e senha como meio único de autenticação no MVP. Sem SSO, sem OAuth, sem MFA.
- Hash bcrypt ou equivalente vigente (§6.3).
- Bloqueio temporário após 5 tentativas em 15 min (§6.3).
- Sessão de 12 horas (decidido na elicitação).
- Troca de senha exigida no 1º acesso de Pessoa cuja senha foi gerada pela ASONSEG (cenário da reivindicação USP-003).
- TLS obrigatório.
- Rate limiting por IP em todas as APIs públicas.
- Auditoria de tentativa de login (sucesso e falha) — §6.3.

## 3. Cenários de fracasso (de resultado)

**F1. Brute-force de senha por bypass do bloqueio.**
Bloqueio funciona por e-mail, mas atacante força distintos e-mails (ou usa proxies/IPs distintos) e contorna. Pessoa real fica bloqueada porque atacante tentou no mesmo e-mail dela; ou pior, atacante consegue acertar senha de Pessoa específica.

✅ RESOLVIDO (ADR-0029 / TD §4.4): lockout por chave combinada `(e-mail, IP)`, 5 tentativas/15 min (não exponencial), cobrindo tanto troca de IP quanto troca de e-mail isolada. Limites concretos são parâmetros tunáveis.

**F2. Enumeração de e-mails cadastrados via mensagem de erro distinta.**
Mensagem "e-mail não encontrado" vs "senha incorreta" revela quais e-mails têm conta. Atacante mineira a base. Combinado com vazamento externo de senhas, abre credential stuffing.

**F3. Fixação de sessão / session hijacking por cookie inseguro.**
Cookie de sessão sem flags adequadas (HttpOnly, Secure, SameSite); atacante via XSS ou rede interceptam cookie e fazem session hijacking.

**F4. Pessoa inativada (USP-007) continua conseguindo logar até o cookie de 12h expirar.**
USP-007 marca Pessoa inativa, mas se a verificação de inativação é só no login (não em cada requisição), a sessão ativa continua. Pessoa inativada por motivo grave permanece operando por até 12h.

✅ RESOLVIDO (ADR-0030): revalidação de status (e de permissões/vínculos) a cada request autenticado, com cache opcional de janela curta ≤30s — barato no volume previsto (ADR-0010).

**F5. Login bem-sucedido sem registro no log de auditoria por falha silenciosa.**
Log de auditoria falha (problema com serviço de logs); login completa mas evento não é gravado. Em incidente posterior, fica impossível saber quando a Pessoa autenticou.

**F6. Reset de senha (USP-005) cria janela em que ambas as senhas (antiga e nova) funcionam.**
Bug no fluxo de redefinição: a senha nova é gravada mas a antiga não é invalidada na sessão. Atacante que conhece a antiga continua usando até a sessão expirar.

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa com credencial autentica em ≤ 3 segundos do submit ao redirecionamento para área autenticada.
- Tentativas falhas dão mensagem genérica que não revela se o e-mail existe.
- Bloqueio após 5 tentativas em 15 min funciona consistentemente independente do vetor de ataque.
- Sessão de 12h respeitada.

**Nível agregado:**
- Sem métrica MP direta.
- ✅ RESOLVIDO (TD §8.3 / project-guideline §10): observabilidade contemplada — alerta de volume anômalo de login bloqueado; `auth_attempts` (tentativas falhas) retidos 90 dias (`AUTH_ATTEMPTS_RETENTION_DAYS`).

## 5. Conexões

**USPs upstream:**
- USP-001 ou USP-003 — credencial precisa existir.

**USPs downstream:**
- Toda USP autenticada.

**ADRs aplicáveis:**
- ADR-0010 (Custo mínimo)

**Métricas tocadas:** transversal — sem MP direta.

**Riscos relacionados:** RP-009 (volume de tráfego — rate limiting); risco proposto: brute-force e enumeração.

**Dependências:** —

**Q-abertas:** —
