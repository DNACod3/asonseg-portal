# USP-051 — Robustez de Formulários — Specification

> **Fonte da verdade upstream (adapt, don't re-derive):** dossiê de UAT
> `.specs/features/ajustes-uat/uat-findings-2026-07-11.md`, tabela **Fase 8** —
> achados **ORQ-2, ORQ-3, EMP-1, EMP-6, CAND-5, AUTH-7**. Cada achado ancora em
> AC/spec/PRD já existentes; este spec **indexa e reusa** esses IDs de achado
> como âncora canônica e traduz cada prohibição em Must-Not. Não re-deriva os
> requisitos das USPs originais (USP-004/005 login/senha, USP-020 publicar vaga,
> USP-040/CVE-01 extração de CV) — só corrige o comportamento defeituoso.
> **ROADMAP:** Fase 8, épico `ajustes-uat`, unidade USP-051.

## Problem Statement

Os formulários do portal falham em condições de borda que o UAT de 2026-07-11
expôs em build de produção: o login vaza credencial na URL num submit
pré-hidratação (GET fallback), a CSP de dev quebra a hidratação do React (login
inoperante em `npm run dev`), o formulário de vaga "morre" ao enviar com validade
vazia (RangeError não tratado), a validação de data aparece como tooltip nativo em
inglês, o upload de CV válido (1–5 MB) derruba a página por `bodySizeLimit` default
de 1 MB, e `/trocar-senha` mostra texto de "primeiro acesso" fora do 1º acesso.
São defeitos de robustez/segurança de formulário, todos corrigíveis **sem alterar
arquitetura nem premissas técnicas**.

## Goals

- [ ] Nenhum formulário de credencial (login, troca, redefinição de senha) coloca
      senha ou e-mail na query string da URL — em qualquer estado de hidratação.
- [ ] CSP de produção permanece sem `'unsafe-eval'`; `'unsafe-eval'` é liberado
      **apenas** em `NODE_ENV === 'development'`, destravando o login em dev.
- [ ] "Enviar para moderação" com validade vazia renderiza o erro PT-BR inline,
      sem `RangeError` e sem botão aparentemente morto.
- [ ] Validação de data da vaga usa as mensagens PT-BR do Zod (sem tooltip nativo
      em inglês).
- [ ] CV válido de até 5 MB (limite CVE-01) faz upload sem "Application error"; CV
      acima do limite é barrado no cliente com mensagem PT-BR antes do submit.
- [ ] `/trocar-senha` só afirma "primeiro acesso" quando a credencial está de fato
      em 1º acesso.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
| --- | --- |
| CSP baseada em nonce (endurecer `'unsafe-inline'`) | Follow-up documentado em `securityHeaders.ts` (exige reescrever o HTML por request) — fora do MVP; ORQ-2 é só sobre `'unsafe-eval'` em dev |
| Data da vaga exibida com -1 dia (fuso) | Achado **MOD-5**, escopo da USP-054 (ciclo de vida da vaga), não desta unidade |
| Perda de dados no save de candidato / status real / gate CV_AI_EXTRACTION | Achados **CAND-1/2/3/6**, escopo da USP-052 |
| Confinar `/trocar-senha` fora do 1º acesso | ADR-0030 mantém a página acessível; AUTH-7 corrige **só o texto** enganoso, não o roteamento |
| Migração de schema, dependência nova, mudança de arquitetura | Premissas invioláveis da Fase 8 |
| E2E autenticado dos formulários | Diferido pelo padrão do repo (lição L-007) — cobertura autoritativa em testes unit/component/page + build gate |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Quais formulários entram no "sem GET fallback" | agent | Todos os de credencial: **login** (email+senha), **troca de senha 1º acesso** (`ChangePasswordForm`), **redefinição** (`PasswordResetForm`), **e** a **solicitação de recuperação** (`PasswordResetRequestForm`, só e-mail) por defesa em profundidade | ORQ-3 fala em "credencial"; o must-not é escopado a forms com senha, mas a mesma mudança (`method="post"`) generaliza e email-na-URL também é indesejável (histórico/enumeração) | n |
| Técnica anti-GET-fallback | agent | `method="post"` inerte no `<form>` (RHF `handleSubmit` já dá `preventDefault` pós-hidratação) — **não** desabilitar submit até hidratar | `method="post"` impede o vazamento na URL independentemente do momento da hidratação; evita flash de botão desabilitado e um efeito de estado de hidratação. Ambos aceitos pela task; escolhido o mínimo | n |
| Valor de `serverActions.bodySizeLimit` | agent | `'6mb'` | `MAX_CV_BYTES = 5 MB` (CVE-01); o Next 15 conta `state + body`, então 6 MB dá ~1 MB de folga sobre o payload de 5 MB sem afrouxar mais que o necessário a proteção a DDoS | n |
| Copy neutra de `/trocar-senha` fora do 1º acesso | agent | "Por segurança, escolha uma nova senha para continuar." (remove a frase "Este é seu primeiro acesso."); título "Defina sua nova senha" inalterado | Só a frase é enganosa; a página segue acessível (ADR-0030) | n |
| Chave de cache da CSP passa a incluir o flag de ambiente | agent | `cacheKey = \`${supabaseOrigin ?? ''}|${isDev}\`` | `buildCsp` é memoizado; a política passa a variar por ambiente, então o flag precisa entrar na chave (também torna o contrato testável com `vi.stubEnv`) | n |
| Teste negativo de RF-MN-01 (sem GET) | agent | Assertir que o `<form>` renderizado tem `method="post"` (jsdom não executa a navegação nativa para observar a URL) | `method="post"` é a garantia estrutural de que o navegador não pode pôr credencial na query string | n |
| E2E dos formulários | agent | Diferido (padrão L-007) | Repo não tem seed de sessão Supabase no Playwright; cobertura autoritativa em unit/component/page + build | n |

**Owner** — todos os itens têm owner `agent` (discrição do planejador); **nenhum**
item tem owner externo bloqueante → o Entry Gate de Tasks está livre.

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Formulários de credencial sem fallback GET (ORQ-3) ⭐ MVP

**User Story**: Como usuário que autentica ou troca de senha, quero que minhas
credenciais nunca apareçam na URL, para que senha/e-mail não vazem em histórico do
navegador, logs de servidor/proxy ou cabeçalho Referer.

**Why P1**: Vazamento de credencial (senha em `?senha=…`) é falha de segurança
objetiva, reprodutível em rede lenta (submit antes da hidratação do React).

**Acceptance Criteria**:

1. WHEN o formulário de **login** é renderizado THEN o elemento `<form>` SHALL
   declarar `method="post"`.
2. WHEN o formulário de **troca de senha (1º acesso)** e o de **redefinição de
   senha (com token)** são renderizados THEN cada `<form>` SHALL declarar
   `method="post"`.
3. WHEN um desses formulários é submetido **antes da hidratação do React** (JS
   lento/indisponível) THEN o navegador SHALL usar o método POST (corpo da
   requisição), nunca GET com query string — sem `email`/`senha` na URL.
4. WHEN o React está hidratado e o usuário submete THEN o comportamento atual
   (RHF `handleSubmit` → Server Action com `preventDefault`, mensagem única
   anti-enumeração, navegação por `redirectTo`) SHALL permanecer **inalterado**
   (contrato `LoginForm.test.tsx` preservado).
5. WHEN o formulário de **solicitação de recuperação** (`PasswordResetRequestForm`,
   só e-mail) é renderizado THEN o `<form>` SHALL declarar `method="post"`
   (defesa em profundidade).

**Independent Test**: Renderizar cada formulário e verificar `method="post"` no
`<form>`; rodar as suítes existentes de cada formulário sem regressão.

---

### P1: CSP libera `unsafe-eval` só em desenvolvimento (ORQ-2) ⭐ MVP

**User Story**: Como desenvolvedor rodando `npm run dev`, quero que a hidratação do
React funcione (login operante), sem enfraquecer a CSP de produção.

**Why P1**: Sem `'unsafe-eval'` a hidratação do React em dev-mode quebra e o login
fica inoperante localmente; adicioná-lo em produção seria regressão de segurança.

**Acceptance Criteria**:

1. WHEN `NODE_ENV === 'development'` THEN a diretiva `script-src` da CSP SHALL
   incluir `'unsafe-eval'`.
2. WHEN `NODE_ENV !== 'development'` (produção, test) THEN `script-src` SHALL NOT
   incluir `'unsafe-eval'`.
3. WHEN a CSP é montada em qualquer ambiente THEN todos os itens do contrato
   existente (`script-src` com Turnstile e `'unsafe-inline'`, `frame-ancestors
   'none'`, `object-src 'none'`, `connect-src` com Supabase http+wss, HSTS
   condicional) SHALL permanecer inalterados (contrato `securityHeaders.test.ts`
   preservado).

**Independent Test**: `vi.stubEnv('NODE_ENV', …)` e assertir presença/ausência de
`'unsafe-eval'` em `script-src`; rodar `securityHeaders.test.ts` sem regressão.

---

### P1: Validade vazia não derruba o formulário de vaga (EMP-1) ⭐ MVP

**User Story**: Como responsável por empresa publicando vaga, quero ver a mensagem
PT-BR quando esqueço a validade, em vez de um botão "morto".

**Why P1**: `RangeError: Invalid time value` (data vazia formatada por
`date-fns-tz` dentro do `superRefine` de `publishJobSchema`) aborta a renderização
dos erros do RHF → "Enviar para moderação" parece não fazer nada (USP-020 AC2/AC4).

**Acceptance Criteria**:

1. WHEN `publishJobSchema.safeParse(...)` recebe `validUntil` vazia (`''`) ou não
   parseável THEN a validação SHALL NOT lançar exceção e SHALL retornar
   `success:false` com issue no campo `validUntil`.
2. WHEN o usuário clica "Enviar para moderação" com validade vazia THEN a mensagem
   PT-BR "Data de validade é obrigatória." SHALL ser renderizada inline.
3. WHEN a validade é uma data válida no passado, ou acima do teto, ou válida dentro
   do teto THEN as regras existentes (`'passado'`/`'excede_teto'`/`'ok'` de
   `validadeStatus`) SHALL permanecer inalteradas (contrato
   `publish-job.schema.spec.ts` preservado).

**Independent Test**: `publishJobSchema.safeParse` com `validUntil:''` — `not.toThrow`
e `success:false`; happy/passado/teto continuam verdes.

---

### P3: Validação de data da vaga em PT-BR via `noValidate` (EMP-6)

**User Story**: Como responsável por empresa, quero mensagens de validação de data
em português, não tooltips nativos do navegador em inglês.

**Why P3**: Os atributos nativos `min`/`max` do `<input type="date">` disparam a
validação nativa (tooltip em inglês) e suprimem o Zod PT-BR.

**Acceptance Criteria**:

1. WHEN o formulário de vaga (`JobForm`) é renderizado THEN o `<form>` SHALL
   declarar `noValidate` (o navegador não valida nativamente).
2. WHEN a validação de data falha ao enviar THEN a mensagem PT-BR do Zod SHALL ser
   exibida inline (não o tooltip nativo em inglês); os atributos `min`/`max` podem
   permanecer apenas como afordância do date picker.

**Independent Test**: Renderizar `JobForm` e verificar `noValidate` no `<form>`;
submeter com validade vazia e ver a mensagem PT-BR (depende do fix de EMP-1).

---

### P1: Upload de CV até 5 MB não derruba a página (CAND-5) ⭐ MVP

**User Story**: Como candidato, quero enviar meu currículo (até 5 MB, como a spec
CVE-01 permite) sem que a página quebre com "Application error".

**Why P1**: `next.config.ts` não configura `serverActions.bodySizeLimit` → default
1 MB < 5 MB do CVE-01; até um CV válido de 1–5 MB estoura o transporte (HTTP 413)
antes da action, e o erro não tratado no cliente derruba a página.

**Acceptance Criteria**:

1. WHEN o build é gerado THEN `next.config.ts` SHALL configurar
   `experimental.serverActions.bodySizeLimit` com folga sobre o limite CVE-01 de
   5 MB (`MAX_CV_BYTES`) — valor `'6mb'`.
2. WHEN o candidato seleciona um CV **acima** de `MAX_CV_BYTES` (5 MB) THEN o
   `CvUploadForm` SHALL exibir uma mensagem PT-BR de tamanho e SHALL NOT despachar
   a Server Action `uploadCv` (evita o erro de transporte).
3. WHEN o candidato seleciona um CV **válido de 1–5 MB** THEN o fluxo de upload
   SHALL prosseguir (chamar `uploadCv`) sem "Application error".

**Independent Test**: Componente — selecionar `File` > 5 MB: `uploadCv` não é
chamado e a mensagem PT-BR aparece; `File` ≤ 5 MB: `uploadCv` é chamado. Config —
importar `next.config` e assertir `bodySizeLimit` ≥ `MAX_CV_BYTES`.

---

### P3: Texto de "primeiro acesso" condicional em `/trocar-senha` (AUTH-7)

**User Story**: Como usuário que abre `/trocar-senha` fora do 1º acesso, não quero
ler "Este é seu primeiro acesso", que é enganoso.

**Why P3**: A página exibe a frase de 1º acesso incondicionalmente; a rota não
confina (ok por ADR-0030), mas o **texto** engana.

**Acceptance Criteria**:

1. WHEN a página `/trocar-senha` é renderizada para uma credencial com
   `primeiroAcesso === true` THEN a descrição SHALL conter "Este é seu primeiro
   acesso".
2. WHEN renderizada para credencial com `primeiroAcesso === false` (ou sem sessão)
   THEN a descrição SHALL NOT afirmar "primeiro acesso" (usa copy neutra).
3. WHEN a página é acessada em qualquer estado THEN ela SHALL continuar **não
   confinando** o acesso (só o texto muda — ADR-0030).

**Independent Test**: Page test com `getCurrentPerson` mockado nos dois ramos
(`primeiroAcesso` true/false) e no ramo sem sessão.

---

## Edge Cases

- WHEN o submit ocorre exatamente na janela pré-hidratação THEN o método nativo é
  POST → nenhuma credencial na URL (RF-MN-01).
- WHEN `validUntil` é uma string não vazia mas inválida (ex.: `'2020-13-40'`) THEN
  `publishJobSchema` retorna erro de validação sem lançar (RF-MN-03).
- WHEN `getCurrentPerson()` retorna `null` (sem sessão) em `/trocar-senha` THEN a
  descrição usa a copy neutra (não afirma 1º acesso).
- WHEN o CV selecionado tem exatamente `MAX_CV_BYTES` (5 MB) THEN é aceito
  (`isWithinCvSizeLimit` inclusivo) e `uploadCv` é chamado.
- WHEN `NODE_ENV` é `'test'` THEN a CSP não inclui `'unsafe-eval'` (só `development`
  o libera) — preserva o contrato de produção nos testes.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um teste negativo
que asserta a não-ocorrência do resultado proibido (validate.md §6b).

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| RF-MN-01 | WHEN um formulário que transporta senha (login, troca, redefinição) é submetido em qualquer estado de hidratação THEN SHALL NOT colocar senha ou e-mail na query string da URL | Vazamento de credencial em histórico do navegador, logs de servidor/proxy e Referer | T4, T5 | Assertir `<form method="post">` em cada formulário (login, troca, redefinição, solicitação) |
| RF-MN-02 | WHEN a CSP é montada com `NODE_ENV !== 'development'` THEN `script-src` SHALL NOT incluir `'unsafe-eval'` | Enfraquecimento da CSP de produção (execução de código via `eval`) | T1 | `NODE_ENV='production'` → `script-src` sem `'unsafe-eval'` |
| RF-MN-03 | WHEN `publishJobSchema`/`superRefine` processa `validUntil` vazia ou inválida THEN SHALL NOT lançar exceção que aborte a renderização dos erros | Botão de submit aparentemente morto; usuário sem feedback | T2 | `safeParse({…, validUntil:''})` → `not.toThrow` e `success:false` com issue em `validUntil` |
| RF-MN-04 | WHEN o candidato tenta enviar um CV **acima** do limite CVE-01 THEN o form SHALL NOT despachar a action `uploadCv` sem antes exibir mensagem PT-BR de tamanho | "Application error" (crash de transporte 413 não tratado) | T7 (guard client) + T6 (config ≥5 MB) | Selecionar `File` > `MAX_CV_BYTES` → `uploadCv` não chamado + mensagem PT-BR |
| RF-MN-05 | WHEN `/trocar-senha` é renderizada para quem não está em 1º acesso THEN SHALL NOT exibir "Este é seu primeiro acesso" | Texto enganoso ao usuário | T8 | `getCurrentPerson` mock `primeiroAcesso:false` → texto de 1º acesso ausente |

---

## Requirement Traceability

| Requirement ID | Story | Achado (upstream) | Phase | Status |
| --- | --- | --- | --- | --- |
| RF-01 | P1: Forms de credencial sem GET fallback | ORQ-3 | Tasks | Pending |
| RF-02 | P1: CSP unsafe-eval só em dev | ORQ-2 | Tasks | Pending |
| RF-03 | P1: Validade vazia não derruba o form | EMP-1 | Tasks | Pending |
| RF-04 | P3: `noValidate` no form de vaga | EMP-6 | Tasks | Pending |
| RF-05 | P1: Upload de CV até 5 MB + guard client | CAND-5 | Tasks | Pending |
| RF-06 | P3: Texto de 1º acesso condicional | AUTH-7 | Tasks | Pending |
| RF-MN-01 | P1: Forms de credencial | ORQ-3 | Tasks | Pending |
| RF-MN-02 | P1: CSP prod | ORQ-2 | Tasks | Pending |
| RF-MN-03 | P1: Schema de vaga | EMP-1 | Tasks | Pending |
| RF-MN-04 | P1: Upload de CV | CAND-5 | Tasks | Pending |
| RF-MN-05 | P3: `/trocar-senha` | AUTH-7 | Tasks | Pending |

**ID format:** `RF-NN` / must-nots `RF-MN-NN`. Os IDs de achado do dossiê
(ORQ-2/3, EMP-1/6, CAND-5, AUTH-7) são as âncoras upstream canônicas.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 requisitos (6 funcionais + 5 must-nots), todos mapeados a tasks (ver
tasks.md), 0 sem mapeamento.

---

## Success Criteria

- [ ] `<form method="post">` em login, troca, redefinição e solicitação de senha.
- [ ] CSP: `'unsafe-eval'` presente só em `development`, ausente em produção/test;
      `securityHeaders.test.ts` verde.
- [ ] `publishJobSchema` com validade vazia → `success:false` sem lançar;
      `publish-job.schema.spec.ts` verde; mensagem PT-BR renderizada no `JobForm`.
- [ ] `JobForm` com `noValidate`.
- [ ] `bodySizeLimit: '6mb'` no `next.config.ts`; CV > 5 MB barrado no cliente com
      mensagem PT-BR; CV ≤ 5 MB chama `uploadCv`.
- [ ] `/trocar-senha` só diz "primeiro acesso" quando `primeiroAcesso === true`.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` verdes;
      zero migração, zero dependência nova, arquitetura intacta.
