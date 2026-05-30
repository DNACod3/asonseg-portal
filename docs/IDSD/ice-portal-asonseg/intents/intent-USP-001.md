# Intent — USP-001: Auto-cadastro de Pessoa no portal (público)

**Origem:** PRD MVP Portal Empregabilidade e Serviços v0.3 §5.2, USP-001.
**Dono do intent:** Sponsor ASONSEG + diretoria (LGPD). Quando ativa papel candidato, prestador ou empresa-responsável, é também a finalidade dos respectivos donos institucionais.

## 1. Descrição

Uma Pessoa real da comunidade conclui o cadastro inicial no portal informando os dados estritamente necessários (nome, CPF, e-mail, senha), aceita o termo de consentimento da finalidade do papel que está ativando, e fica autenticada para usar a funcionalidade pública correspondente. O outcome esperado é uma Pessoa única no sistema (CPF e e-mail únicos), com a credencial ativa, ao menos um papel público ativo, consentimento(s) da(s) finalidade(s) correspondente(s) persistido(s), e log de auditoria registrado.

Esta USP é a **porta única de entrada** de qualquer Pessoa pública no portal. Tudo o que vem depois (candidatar-se, publicar vaga, oferecer serviço, manifestar interesse, ser encaminhado) depende dela funcionar com precisão LGPD e sem condição de corrida.

Por ser fundacional, qualquer fracasso de resultado aqui contamina o resto do sistema — em especial duplicidade silenciosa de Pessoa (que quebra a visão consolidada do ADR-0011 sem aparecer como erro) e ativação de papel sem consentimento correspondente (que quebra ADR-0013 sem disparar nenhum AC).

## 2. Restrições

- CPF obrigatório no auto-cadastro público. Exceção (Pessoa sem documento) só pela AS via USP-002.
- Senha armazenada com hash bcrypt ou equivalente vigente (§6.3).
  ✅ **Resolvido** (TD §7 / expectations E-007) — hashing delegado ao **Supabase Auth: bcrypt, cost 10**, gerenciado pelo provedor (não configurável pela app; a senha em claro nunca passa pelo nosso código). Meta verificável: senha persistida como hash bcrypt do Supabase Auth — algoritmo legado/texto-claro impossível por construção (fecha F3). _Atenção: não assumir "cost ≥12" — o Supabase Auth não expõe esse ajuste._ (técnico)
- E-mail único por Pessoa em todo o sistema.
- CPF único por Pessoa em todo o sistema.
- CAPTCHA obrigatório no submit (§6.3).
  ✅ **Resolvido** (ADR-0029 / ADR-0019) — **Cloudflare Turnstile** validado server-side (gratuito ilimitado, privacidade superior ao reCAPTCHA, modo acessível com áudio para baixo letramento digital). Fecha D-009 / QP-003. (técnico)
- Consentimento da finalidade do papel é coletado em **2ª transação atômica** logo após o cadastro (modelo lazy — ADR-0020 / TD §4.3): o cadastro persiste **PORTAL_ACCESS** em transação única e o papel fica **AWAITING_CONSENT** (não-ACTIVE) até o aceite da finalidade, quando consentimento + ativação do papel são gravados juntos numa única transação. Garantia estrutural: nenhum papel chega a ACTIVE sem a base legal da sua finalidade (ADR-0013 de negócio).
- TLS obrigatório (§6.3).
- Rate limiting amplo em todas as APIs públicas (§6.3).
  ✅ **Resolvido** (ADR-0029 / TD §8 / expectations L-003) — **N=3, M=15min** (3 cadastros/IP/15min). Mecanismo: contadores persistidos (rate limit por rota + lockout `(email,IP)`, 5/15min no login); CAPTCHA é o gate anti-bot primário do cadastro. (técnico)
- Auditoria imutável obrigatória (§6.3).

## 3. Cenários de fracasso (de resultado)

**F1. Pessoa duplicada por race condition em CPF ou e-mail.**
Dois submits simultâneos com o mesmo CPF (ou o mesmo e-mail) passam pela validação isolada — cada um verifica a unicidade em momento separado — e ambos persistem. CPF deixa de identificar Pessoa unicamente. A visão consolidada (USP-039) começa a contar duas Pessoas onde existe uma; candidaturas se dividem; encaminhamentos podem ir para a "metade errada".

✅ **Resolvido** (ADR-0021) — **unique constraint** em `cpf` e `email_login` é o guarda autoritativo (sem lock pessimista); o pré-check é só UX e não previne corrida. O conflito (P2002) vira `ActionResult` determinístico `CONFLICT` (`CPF_JA_CADASTRADO` / `EMAIL_JA_CADASTRADO`), semântica 409, nunca 500, nunca dupla escrita. Cobre também CNPJ (USP-012) e candidatura/manifestação únicas (USP-025/033). (arquitetural-estrutural — virou ADR-0021)

**F2. Papel público ativo sem consentimento da finalidade correspondente persistido.**
A Pessoa é criada e o papel é ativado, mas o consentimento da finalidade daquele papel (candidatura a vagas, oferta de serviço, contratação de serviço, representação de empresa) não foi persistido — falha entre a transação do cadastro e a transação do consentimento. Resultado: papel funcional sem base legal LGPD documentada. ASONSEG fica em violação silenciosa.

✅ **Resolvido** (ADR-0020 + TD §4.3) — cadastro atômico: `person` + credencial + grant `AWAITING_CONSENT` + consent `PORTAL_ACCESS` + audit numa única transação (`withAudit`), e-mail de boas-vindas via **outbox** (sai só pós-commit — fecha F4). A finalidade do papel vem em 2ª transação atômica que insere o consentimento **e** ativa o grant juntos — invariante: nenhum grant chega a ACTIVE sem o consentimento da sua finalidade persistido na mesma transação. (arquitetural-estrutural — virou ADR-0020)

**F3. Senha armazenada com algoritmo legado ou em texto claro por bug de configuração.**
Bug de configuração ou regressão silenciosa faz com que senhas passem a ser persistidas com algoritmo fraco (MD5, SHA-1) ou em texto claro. Em vazamento futuro, comunidade inteira fica exposta a credential stuffing.

**F4. E-mail de boas-vindas enviado para Pessoa cujo cadastro falhou.**
Algum branch envia o e-mail antes de garantir a persistência da Pessoa — Pessoa recebe boas-vindas para conta que não existe. Confusão e desconfiança. Caso inverso (Pessoa persistiu, e-mail não chegou) é menos grave mas também precisa estar mapeado.

**F5. CAPTCHA pode ser ignorado por agente automatizado em via direta.**
Endpoint de auto-cadastro fica disponível sem o gate do CAPTCHA (bypass por chamada direta à API). Bots começam a popular o sistema com Pessoas falsas; moderação vira ingovernável.

**F6. Log de auditoria omite cadastro completado por falha silenciosa.**
A transação de cadastro completa, mas o log não é gravado por exceção tratada em silêncio. Resultado: Pessoa existe, ninguém sabe como entrou. Auditoria LGPD perde rastro do consentimento.

**F7. Auto-cadastro permite a marca de exceção de CPF (que só pode existir via USP-002).**
Bug de exposição: o formulário público aceita o flag "Pessoa sem documento" reservado à AS. CPF deixa de ser obrigatório no público, contaminando o modelo.

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa real da comunidade conclui o cadastro em fluxo único e fica autenticada.
- E-mail de boas-vindas chega em < 1 minuto.
- Próximo passo (cadastro do papel específico) está claro na tela pós-cadastro — não cai em home genérica.
- ✅ RESOLVIDO (dono do intent): meta de tempo total ≤ 3 minutos do clique inicial à autenticação concluída.
- ✅ RESOLVIDO (dono do intent): meta de conclusão ≥ 70% dos que iniciam o cadastro.

**Nível agregado:**
- MP1 (candidatos com perfil ativo), MP2 (empresas verificadas), MP3 (prestadores ativos) começam neste fluxo — mas só se "tornam" oficiais depois da moderação de conteúdo (USP-016).
- ❓ Metas absolutas pendentes do sponsor (D-004 / QP-007). (dono do intent)

## 5. Conexões

**USPs upstream** (precisam existir antes ou em paralelo):
- USP-043 — consentimento por finalidade precisa estar disponível no fluxo de cadastro (transação única).

**USPs downstream** (dependem deste intent):
- USP-004 — login só faz sentido depois do cadastro.
- USP-006 — ativar papel adicional pressupõe Pessoa autenticada criada aqui.
- USP-009, USP-010, USP-011, USP-012 — cada papel é ativado a partir desta USP (no momento do cadastro) ou via USP-006.
- USP-025, USP-033, USP-037 — só agem sobre Pessoa que existe.

**ADRs aplicáveis:**
- ADR-0010 (Custo mínimo — restringe escolha de provedor de CAPTCHA, SMTP, etc.)
- ADR-0011 (Pessoa como entidade fundamental)
- ADR-0013 (Consentimentos LGPD por finalidade)
- ADR-0017 (Visibilidade conservadora — IP, log, dados do cadastro têm restrição de acesso)

**Métricas tocadas:** MP1, MP2, MP3 (entrada do funil).

**Riscos relacionados:** RP-003 (termos por finalidade não revisados a tempo), RP-008 indireto (quando candidato anexa CV e dispara USP-040).

**Dependências:** D-002 (termos de consentimento), D-009 (CAPTCHA), QP-003.

**Q-abertas:** QP-003 (CAPTCHA).
