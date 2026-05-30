# Intent — USP-005: Recuperar senha esquecida

**Origem:** PRD v0.3 §5.2, USP-005.
**Dono do intent:** Sponsor + diretoria (segurança/UX).

## 1. Descrição

Uma Pessoa que esqueceu a senha solicita redefinição informando o e-mail cadastrado, recebe link único válido por 24h, define nova senha e recupera o acesso sem precisar de intervenção administrativa. O outcome é a Pessoa autenticada com a nova senha, e a antiga invalidada.

USP curta mas crítica em termos de segurança — fluxos de "esqueci minha senha" são vetores clássicos de takeover.

## 2. Restrições

- Link de redefinição válido por 24h.
- Mensagem genérica de confirmação independente de o e-mail existir (AC-005-2) — anti-enumeração.
- Após uso, link invalidado (uso único).
- Nova senha respeita política definida em USP-001 (hash bcrypt).
- Auditoria do evento.

## 3. Cenários de fracasso (de resultado)

**F1. Link de redefinição reutilizável após uso (ou clonável).**
Token do link não é invalidado depois de usado, ou é previsível/sequencial. Atacante que tiver acesso ao e-mail momentaneamente (sniffer, e-mail comprometido) consegue reusar o link.

**F2. Mensagem de erro distinta entre "e-mail cadastrado" e "e-mail não cadastrado" expõe enumeração.**
AC-005-2 exige mensagem genérica, mas tempo de resposta distinto (timing side-channel) revela: se o sistema demora para "enviar e-mail" e não demora quando não envia, o atacante distingue. Vetor sutil.

✅ RESOLVIDO (ADR-0029 / TD §4.4): resposta genérica idêntica com timing normalizado (anti-enumeração + anti-timing); `recuperarSenha` sempre retorna `{ok:true}` independentemente de o e-mail existir.

**F3. Pessoa inativada (USP-007) consegue redefinir senha e voltar a logar.**
Esquece-se de checar status "ativo" antes de gerar o link. Pessoa inativada por motivo grave volta ao sistema via recuperação.

**F4. Link enviado para e-mail antigo após troca de e-mail.**
Pessoa trocou de e-mail no perfil; bug envia o link para o e-mail anterior (cache ou registro antigo). Atacante com acesso ao e-mail antigo assume conta.

✅ ENCAMINHADO (PRD v0.4): troca de e-mail no painel da Pessoa a confirmar/explicitar no PRD v0.4 (fora do escopo dos ACs atuais da USP-005).

**F5. Link compartilhado em URL é interceptado por proxy corporativo / log de servidor.**
Token na URL fica em referrer, em log de proxy, em histórico do browser. Boa prática: link parametrizado por POST, ou token de uso único curto + validação adicional.

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa pede recuperação, recebe e-mail em < 1 minuto.
- Clica no link, define nova senha, está logada — fluxo único.
- Sessões anteriores invalidadas após troca de senha.

**Nível agregado:**
- Sem métrica MP direta.

## 5. Conexões

**USPs upstream:**
- USP-001 ou USP-003 — credencial existe.

**USPs downstream:**
- USP-004.

**ADRs aplicáveis:**
- ADR-0010

**Métricas tocadas:** —

**Riscos relacionados:** risco proposto: enumeração via timing; risco proposto: link reutilizável.

**Dependências:** —

**Q-abertas:** —
