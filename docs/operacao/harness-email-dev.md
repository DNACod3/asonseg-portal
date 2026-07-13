# Harness de e-mail local (Mailpit + cron dev)

> **USP-060 / achado AUTH-9/REL-4.** Estritamente dev-env. Sem qualquer mudança
> de comportamento em produção: Resend continua sendo o adapter de produção
> (ADR-0012/USP-044) e o cron `dispatch-outbox` continua fail-closed em todo
> ambiente (`verifyCronSecret` — HYG-MN-04, intocado por esta USP).

## Problema que resolve

Sem este harness, nenhum e-mail transacional é visível em desenvolvimento: o
`.env.local` traz `RESEND_API_KEY` dummy (a chamada real falharia) e o cron
`dispatch-outbox` responde `503` sem `CRON_SECRET` configurado. Nenhum AC de
e-mail (boas-vindas, redefinição de senha, notificações) é verificável
visualmente.

## Como ligar

1. **Suba a stack local com o SMTP do Mailpit exposto** — `supabase/config.toml`
   já expõe `smtp_port = 55325` (seção `[inbucket]`). Se você já tinha a stack
   no ar antes desta mudança, reinicie: `supabase stop && supabase start`.
2. **No `.env.local`**, ligue a flag do harness e configure o segredo do cron
   (ver `.env.example` para o bloco completo):

   ```bash
   EMAIL_DEV_SMTP=true
   CRON_SECRET=cron-dev-local-secret
   ```

3. **Reinicie o `next dev`** para o processo reler o `.env.local`.

## Ver os e-mails

Qualquer fluxo que enfileira e-mail (cadastro, redefinição de senha,
candidatura, moderação etc.) grava no `Outbox` (`topic='email'`). Para
drenar a fila localmente e entregar ao Mailpit:

```bash
curl -H "x-cron-secret: cron-dev-local-secret" \
  http://127.0.0.1:3000/api/cron/dispatch-outbox
```

Resposta esperada: `{"ok":true,"sent":N,"failed":0,"skipped":M}` — sem `503`
(segredo ausente) nem `401` (segredo incorreto). Os e-mails de Auth
(confirmação/reset via Supabase) já caem direto no Mailpit, sem precisar do
cron.

Abra a UI do Mailpit em **http://127.0.0.1:55324** para ver os e-mails
entregues (assunto, corpo HTML/texto).

## Desligando

`EMAIL_DEV_SMTP=false` (ou remover a variável — o default é `false`) volta o
container a resolver `ResendEmailSender`, idêntico ao comportamento sem o
harness. `CRON_SECRET` pode continuar configurado sem efeito colateral — o
cron só é acionável por quem tem o segredo.

## Garantias de produção (HYG-MN-04 — nunca violadas)

- `EMAIL_DEV_SMTP=true` num deploy Vercel real (`VERCEL_ENV=production|preview`)
  faz o **parse do env lançar no boot** (`superRefine` em `shared/env.ts`) —
  impossível vazar o transporte dev para produção.
- `verifyCronSecret` é fail-closed em **todo** ambiente: sem `CRON_SECRET` →
  `503`; segredo incorreto → `401`. Nenhuma mudança de código no cron; só
  documentação de como configurar o segredo localmente.
- `nodemailer` é `devDependency`, importado dinamicamente dentro do adapter —
  fora do grafo estático de build de produção (provado pelo gate
  `NODE_ENV=production build`).
