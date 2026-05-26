# Spike — Cloudflare Turnstile (widget + verify)

- **Issue:** #107 · **US:** #105 · **Épico:** #4 (Fase 0)
- **Data:** 2026-05-26
- **Camada:** infra (spike) · **Decisão de base:** ADR-0014 (CAPTCHA)
- **Status:** Concluído

## Objetivo

Validar o fluxo do Cloudflare Turnstile ponta-a-ponta: renderização do widget no client e
verificação do token no server (`siteverify`). Definir onde plugar no fluxo de cadastro/contato,
idempotência e UX de falha.

## O que foi testado

Como o `siteverify` aceita as **chaves de teste públicas** do Cloudflare (sem conta/domínio),
foi possível exercitar o endpoint real `https://challenges.cloudflare.com/turnstile/v0/siteverify`
para todos os casos relevantes:

| Chave de teste | Comportamento |
|---|---|
| `1x...AA` (site) / `1x0000...AA` (secret) | sempre passa |
| `2x...AB` / `2x0000...AA` | sempre bloqueia |
| `3x0000...AA` (secret) | token já usado (`timeout-or-duplicate`) |

> O `.env.example` já traz as chaves de teste **always-pass** (`NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x...AA`,
> `TURNSTILE_SECRET_KEY=1x0000...AA`), então o boot local funciona sem conta Cloudflare.

## Resultados medidos (respostas reais do `siteverify`)

| # | Caso | HTTP | Resposta |
|---|---|---|---|
| 1 | Token válido (pass secret + dummy token) | 200 | `{"success":true,"challenge_ts":"…","hostname":"example.com"}` |
| 2 | Token **ausente** | 200 | `{"success":false,"error-codes":["missing-input-response"]}` |
| 3 | Secret **always-fail** + token | 200 | `{"success":false,"error-codes":["invalid-input-response"]}` |
| 4 | Token **já usado** (3x secret) | 200 | `{"success":false,"error-codes":["timeout-or-duplicate"]}` |
| 5 | Secret **inválido** | **400** | `{"success":false,"error-codes":["invalid-input-secret"]}` |

Latência do `siteverify` (de São Paulo, rede doméstica): ~35–250 ms (primeira chamada inclui
handshake TLS). Desprezível dentro de um Server Action.

## Achados

1. **`siteverify` sempre responde HTTP 200 para erros de _input do usuário_** (token ausente,
   inválido, expirado/duplicado). A decisão **deve** vir do campo `success`, nunca do status HTTP.
   Exceção: **secret inválido → HTTP 400** (erro de configuração do servidor, não do usuário).
2. **Token é de uso único.** Reenviar o mesmo token → `timeout-or-duplicate`. Implicação: o token
   é consumido na primeira verificação; **não dá para "revalidar"** o mesmo token num retry. Em
   falha de submit pós-verify, o client precisa **resetar o widget** e gerar token novo.
3. **Token expira (~300s).** `timeout-or-duplicate` cobre tanto expirado quanto reusado.
4. `error-codes` é o que diferencia os casos para logs/observabilidade. `hostname` e
   `challenge_ts` voltam só no sucesso e servem para auditoria.

## Recomendação de integração

### Onde plugar (fluxos do MVP)

CAPTCHA em endpoints **públicos não autenticados** sujeitos a abuso (ADR-0014):
`(auth)/cadastro`, `(auth)/recuperar-senha`, e formulário público de **contato/denúncia**.
Fluxos autenticados em `(app)/` **não** levam Turnstile.

### Client — widget

Componente client em `shared/ui/` (`<TurnstileWidget onToken={...} />`) que carrega o script
`https://challenges.cloudflare.com/turnstile/v0/api.js`, renderiza com `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
e entrega o token via campo oculto do React Hook Form. Em falha de submit, chamar
`turnstile.reset()` (Achado 2).

### Server — verificação (passo 1.5 do Server Action Pattern)

Helper em `shared/lib/turnstile.ts`, chamado **após a validação Zod e antes de `requirePermission`**:

```ts
// shared/lib/turnstile.ts
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body,
  });
  const data = (await r.json()) as { success: boolean; 'error-codes'?: string[] };
  if (!data.success) logger.warn({ codes: data['error-codes'] }, 'turnstile verify failed');
  return data.success === true;
}
```

No Server Action, em falha: `return { ok: false, error: 'Verificação anti-robô falhou. Tente novamente.' }`
(sem `throw`, conforme o padrão). **Não** vazar `error-codes` ao usuário — só ao logger (pino).

### Idempotência / UX de falha

- Token de uso único ⇒ a verificação acontece **uma vez** por submit; não cachear nem reusar.
- Em qualquer erro pós-verify (validação de negócio, etc.), o client **reseta o widget** antes do
  próximo submit, senão o segundo `siteverify` retorna `timeout-or-duplicate`.
- `siteverify` indisponível (rede): tratar como falha **fail-closed** em cadastro (bloqueia), com
  mensagem de "tente novamente" — registrar no Sentry.

## Como reproduzir

```bash
node verify.mjs   # script descartável: POST ao siteverify com as 5 combinações de chave de teste
```

> Script `verify.mjs` foi descartável (não versionado). Chaves de teste e respostas estão acima.

## Referências

- Cloudflare Turnstile — _Testing_ (chaves de teste públicas e seus comportamentos).
- Cloudflare Turnstile — _Server-side validation_ (`siteverify`, `error-codes`, `remoteip`).
- ADR-0014 — CAPTCHA no portal.
