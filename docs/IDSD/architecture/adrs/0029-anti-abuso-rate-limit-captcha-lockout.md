# ADR-0029 — Anti-abuso: rate limiting, CAPTCHA, lockout e anti-enumeração

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead
- **Tags:** segurança, anti-abuso

## Contexto e Problema

O §6.3 do PRD exige CAPTCHA no auto-cadastro, rate limiting amplo nas APIs públicas e lockout no login. A camada ICE detalha vetores concretos (must-not):

- USP-001/P-005: submit de auto-cadastro sem CAPTCHA validado **server-side** é proibido — inclusive via chamada direta à API.
- USP-004/P-001: bloqueio de 5 tentativas/15min **não pode ser contornado** trocando IP nem e-mail — política cobre ambos os vetores.
- USP-005/P-001: link de reset de uso único; nova solicitação invalida pendentes.
- USP-001/P-008, USP-004/P-002, USP-005/P-002: **não revelar** existência/inexistência de Pessoa — mensagem genérica idêntica + **tempos de resposta comparáveis** (anti-timing).
- USP-013/L-002, USP-025/P-003, USP-028/P-005, USP-033/P-002, USP-037/P-005, USP-040/P-005: rate limit + alerta operacional contra enumeração de CPF, candidatura/manifestação/encaminhamento em massa, scraping de candidatos e abuso da API LLM.

## Drivers de Decisão

- Cobrir vetores combinados (IP + e-mail), não só um.
- CAPTCHA acessível ao público de baixo letramento digital (Turnstile — D-009).
- Anti-enumeração inclui **timing**, não só mensagem.
- Custo mínimo — preferir provedor gratuito e mecanismos nativos.

## Opções Consideradas

### Opção A — Turnstile (server-side) + lockout por chave combinada + rate limit por rota + respostas genéricas com tempo normalizado
- **Descrição:** (1) **Cloudflare Turnstile** no auto-cadastro, com **validação do token no servidor** antes de qualquer persistência (gate no endpoint, não só no form). (2) **Lockout** por chave combinada `(email, IP)` com contadores persistidos (5/15min) — cobre troca de IP e de e-mail. (3) **Rate limit por rota/identidade** (IP/usuário/Empresa/candidato) nas APIs públicas e sensíveis, com **alerta operacional** em volumes anômalos. (4) Fluxos de existência (login, reset, busca por CPF) retornam **resposta genérica idêntica** com **tempo de resposta normalizado** (trabalho assíncrono/constante) — anti-enumeração e anti-timing. (5) Token de reset **uso único**, invalida pendentes; não exposto em referrer.
- **Prós:** Cobre todos os vetores do ICE; Turnstile grátis e acessível; sem infra nova.
- **Contras:** Lockout e rate limit precisam de store de contadores (Postgres/edge) — simples no volume.

### Opção B — reCAPTCHA v3 + rate limit só por IP
- **Contras:** reCAPTCHA envia dados ao Google (atrito LGPD); rate limit só por IP é contornável por e-mail/IP rotativo (viola USP-004/P-001). Rejeitada.

## Decisão

Adotamos a **Opção A**: **Turnstile validado server-side**, **lockout por `(email, IP)`**, **rate limit por rota/identidade com alerta**, **respostas genéricas com timing normalizado** e **token de reset de uso único**. Limites concretos por rota ficam parametrizados (TD §8) e ajustáveis sem mudança estrutural.

## Consequências

**Positivas:**
- Brute-force, enumeração (mensagem + timing), scraping e abuso em massa mitigados.
- CAPTCHA acessível ao público-alvo; sem dependência de big tech para CAPTCHA.

**Negativas (trade-offs aceitos):**
- Normalizar timing exige cuidado (ex.: enviar e-mail sempre de forma assíncrona) — documentado no `runbook-rate-limit-anti-abuse`.
- Contadores de lockout/rate limit a manter; alertas a calibrar.

**Neutras / a monitorar:**
- Nº de logins bloqueados/dia como sinal de ataque vs. operação saudável (observabilidade).

## Referências

- §6.3 do PRD, ADR-0019 (Turnstile/infra), ADR-0027 (limite da API LLM), `runbook-rate-limit-anti-abuse`.
- USPs servidas: USP-001, USP-004, USP-005, USP-013, USP-025, USP-028, USP-033, USP-037, USP-040.
