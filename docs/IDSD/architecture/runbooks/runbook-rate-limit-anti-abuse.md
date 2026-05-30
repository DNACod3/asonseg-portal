# Runbook — Rate limiting, lockout e anti-enumeração

**Tipo:** padrão de implementação reutilizável
**Usado por:** USP-001, 003, 004, 005, 013, 025, 028, 033, 037, 040
**ADRs relacionados:** ADR-0029 (anti-abuso), ADR-0019 (Turnstile/infra)
**Referência no TD:** §7.1 (auth), §8.3 (alertas)

## Quando usar

Endpoints públicos e sensíveis: auto-cadastro (CAPTCHA), login (lockout), recuperação de senha (token/anti-enumeração), busca de Pessoa por CPF (anti-enumeração), candidatura/manifestação/encaminhamento em massa, busca ativa de candidatos (anti-scraping), extração de CV (limite por candidato/dia).

## Quando NÃO usar

Operações internas autenticadas de baixo risco e sem vetor de abuso (ex.: salvar rascunho próprio).

## O padrão (passo a passo)

**CAPTCHA (auto-cadastro):**
```ts
const ok = await verifyTurnstile(input.captchaToken, ctx.ip)  // server-side
if (!ok) return { ok:false, error:'VALIDATION' }              // antes de qualquer persistência
```

**Lockout (login):** contador por **chave combinada** `(email, IP)`; 5 falhas/15min → bloqueia 15min. Persistir contadores (tabela/edge).

**Anti-enumeração (login, reset, busca por CPF):** resposta **genérica idêntica** independentemente de a Pessoa existir + **tempo de resposta normalizado** (trabalho constante / envio assíncrono) — anti-timing.

**Token de reset:** único, 24h, uso único, invalida pendentes na nova solicitação; não exposto em referrer.

**Rate limit por rota/identidade:** janela deslizante por IP/usuário/Empresa/candidato; **alerta operacional** em volume anômalo (candidatura/manifestação/encaminhamento em massa, scraping de candidatos, uso da API LLM).

## Pontos de atenção (gotchas)

- **Lockout só por IP é contornável** trocando IP; só por e-mail é contornável trocando alvo. Use a **chave combinada** (USP-004/P-001).
- **CAPTCHA validado no servidor** — bloqueie chamada direta à API sem token válido, não confie no widget do front (USP-001/P-005).
- **Anti-enumeração inclui timing** — mensagem genérica não basta se o tempo de resposta denuncia existência (envie e-mail sempre de forma assíncrona para igualar os caminhos — USP-005/P-002).
- **Token de reset fora da URL/referrer** — use POST/página intermediária (USP-005/P-005).
- **Rate limit sem alerta é meia defesa** — volumes anômalos precisam sinalizar ao coordenador/observabilidade (USP-025/P-003, USP-028/P-005).
- **Quota SMTP e custo LLM também são limites** — alerte a 80% da quota SMTP e acima do limite de extração/candidato/dia.

## Verificação

- [ ] CAPTCHA validado server-side antes de persistir
- [ ] Lockout por chave combinada (email, IP)
- [ ] Resposta genérica + timing normalizado em fluxos de existência
- [ ] Token de reset único/24h/uso único, fora de referrer
- [ ] Rate limit por rota/identidade + alerta em volume anômalo
- [ ] Alertas: quota SMTP ≥80%, custo/uso LLM, login bloqueado

## Referências

- ADR-0029, ADR-0019, ADR-0027 (limite LLM); project-guideline §11
- TD §7.1, §8.3
- USPs servidas: ver cabeçalho
