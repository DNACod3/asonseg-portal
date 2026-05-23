# ADR-0014 (Técnico) — CAPTCHA via Cloudflare Turnstile no auto-cadastro público

- **Status:** Aceito
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** seguranca | anti-bot | custo | privacidade
- **Resolve:** QP-003 (provedor de CAPTCHA) e D-009 do PRD MVP Portal

## Contexto e Problema

PRD §6.3 e USP-001 AC-001-5 exigem **CAPTCHA no auto-cadastro público**. O fluxo de auto-cadastro é a porta de entrada do portal para visitantes anônimos virarem Pessoas — sem barreira, fica vulnerável a:

- Spam de cadastros automatizados
- Criação de Empresas-fantasma escalonada via bots
- Volume artificial nos indicadores da home

Critérios discutidos com o Tech Lead na conversa de planejamento:
- Custo recorrente (gratuito é ideal — ADR-0010 de negócio)
- UX (público da ASONSEG inclui pessoas com baixo letramento digital — CAPTCHAs visuais difíceis frustram)
- Privacidade (LGPD favorece soluções com mínimo rastreamento de terceiros)
- Compatibilidade com Next.js Server Actions

## Drivers de Decisão

- Custo recorrente — preferência por gratuito
- UX simples — preferência por desafios invisíveis ou de uma só etapa
- Privacidade — preferência por provedores que **não rastreiam usuários** (Google reCAPTCHA usa cookies de identificação)
- Integração Next.js — preferência por SDK estável e simples

## Opções Consideradas

### Opção A — Google reCAPTCHA v3

- **Prós:** maduro, gratuito até 1M chamadas/mês, score-based (invisível na maior parte das vezes)
- **Contras:** Google rastreia o usuário (cookies, fingerprint, comportamento de mouse); LGPD-unfriendly; má reputação em comunidades sensíveis à privacidade

### Opção B — hCaptcha

- **Prós:** alternativa ao reCAPTCHA com privacidade superior; gratuito
- **Contras:** ainda usa cookies; UX de "selecione todas as imagens" é difícil para público com baixo letramento

### Opção C — Cloudflare Turnstile (escolhida)

- **Prós:**
  - **Gratuito ilimitado** (sem teto de chamadas mensais — diferença significativa vs. reCAPTCHA Free)
  - **Sem cookies de rastreamento** — desafio resolvido localmente no navegador (PoW + heuristics) sem mandar dados pessoais para Cloudflare
  - **UX invisível** na maior parte das vezes (Cloudflare avalia sinais passivos do browser)
  - SDK oficial de React; integração com Server Actions documentada
  - LGPD-friendly; alinhamento com termo de consentimento de minimização
- **Contras:**
  - Menos maduro que reCAPTCHA; comunidade menor
  - Algumas redes corporativas/proxies podem ter mais falsos positivos
  - Cloudflare é provedor externo — mais um vendor (mas só client-side widget; sem dependência de runtime servidor)

### Opção D — CAPTCHA caseiro (math, slider, etc.)

- **Prós:** zero terceiros
- **Contras:** facilmente burlado por bots modernos; UX inferior

## Decisão

Adotamos a **Opção C — Cloudflare Turnstile**.

### Configuração

1. **Provisionar** site key em Cloudflare Dashboard (modo "Managed" ou "Non-interactive")
2. **Env vars:**
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (visível no client)
   - `TURNSTILE_SECRET_KEY` (server-side apenas, Vercel env secreta)
3. **Componente cliente:**

```tsx
// src/shared/ui/turnstile-widget.tsx
'use client'
import { Turnstile } from '@marsidev/react-turnstile'

export function TurnstileWidget({ onSuccess }: { onSuccess: (token: string) => void }) {
  return (
    <Turnstile
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
      onSuccess={onSuccess}
      options={{ language: 'pt-BR' }}
    />
  )
}
```

4. **Verificação server-side** em Server Action:

```typescript
// src/modules/identity/adapters/turnstile-verifier.ts
import { env } from '@/shared/env'

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {}),
    }),
  })
  const data = await response.json()
  return { ok: data.success === true, error: data['error-codes']?.[0] }
}
```

5. **Server Action de auto-cadastro chama o verificador antes** de qualquer outra validação:

```typescript
// src/modules/identity/actions/registerPerson.ts
'use server'

export async function registerPerson(input: unknown) {
  const parsed = registerPersonSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: { code: 'VALIDATION', message: ... } }

  const captcha = await verifyTurnstileToken(parsed.data.captchaToken, getRequestIp())
  if (!captcha.ok) {
    return { ok: false, error: { code: 'CAPTCHA_FAILED', message: 'verifique que não é um robô e tente novamente' } }
  }

  // ... criar Pessoa, ativar papéis, registrar audit log
}
```

### Onde aplicar (escopo)

- **Auto-cadastro de Pessoa** (USP-001) — obrigatório
- **Reivindicação de credencial** (USP-003) — obrigatório
- **Recuperação de senha** (USP-005) — obrigatório
- **Manifestação de interesse anônima** — N/A, requer autenticação no MVP
- **Login** (USP-004) — **não aplicar** por padrão; aplicar **apenas após 3 tentativas falhas** consecutivas do mesmo IP (defesa adicional sem prejudicar UX da maioria); o bloqueio de 5/15min do PRD §6.3 continua aplicável

### Tratamento de falha

- Token inválido / expirado → mensagem clara em PT-BR: "Verificação falhou — tente novamente"
- Cloudflare API indisponível → fail-closed (recusa cadastro com mensagem "Sistema temporariamente indisponível, tente em alguns minutos") — pequena janela de impedimento de cadastro é preferível a deixar passar bots
- Audit log: evento `CAPTCHA_FAILED` registra IP, user_agent e error code do Turnstile para análise

### Acessibilidade

Turnstile tem modo acessível com áudio para usuários que não conseguem completar o desafio visual quando há fallback interativo. Configurar para PT-BR e usar `aria-live` no widget garante leitor de tela informativo.

## Consequências

**Positivas:**
- Zero custo recorrente
- Privacidade melhor que reCAPTCHA — alinhamento natural com a postura LGPD do projeto
- UX invisível na maior parte das vezes — público da ASONSEG menos impactado
- Integração simples (Server Action + 1 call HTTP server-side)
- Migração para outro CAPTCHA é local (apenas o `turnstile-verifier.ts` muda — pattern Port-Adapter implícito)

**Negativas (trade-offs aceitos):**
- Dependência de Cloudflare API server-side — single point durante o verify
- Em redes corporativas com proxy agressivo, alguns usuários podem ter falsos positivos — minoria

**Neutras / a monitorar:**
- Métrica de "% de tentativas de cadastro bloqueadas por CAPTCHA" no audit log — se for >5% no contexto da ASONSEG, investigar
- Se Cloudflare mudar política de gratuidade, avaliar hCaptcha como sucessor

## Riscos e Mitigações

**Risco 1 — Cloudflare deprecar Turnstile ou cobrar.** **Mitigação:** abstração leve no `turnstile-verifier.ts` permite trocar provedor com 1-2 horas de trabalho.

**Risco 2 — Bot mais sofisticado contorna Turnstile.** **Mitigação:** rate limiting amplo no auto-cadastro (5 tentativas/IP/15min); auditoria de cadastros (volume anômalo dispara alerta).

**Risco 3 — Usuário válido bloqueado por falso positivo.** **Mitigação:** Turnstile tem modo "Managed" que escala dificuldade automaticamente; suporte ASONSEG pode fazer cadastro pela AS (USP-002) em casos extremos.

## Referências

- PRD MVP Portal §6.3, USP-001 AC-001-5
- QP-003, D-009 (resolvidos)
- Documentação Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/
- Lentes do arquiteto: Custo, Compliance by Design, Custo de Mudança
