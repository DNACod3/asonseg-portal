# Scripts de carga — ensaios manuais (não-CI)

Ferramentas de ensaio operadas **manualmente** em ambiente local, para validar
empiricamente garantias da arquitetura com o sponsor. **Nunca** apontar para
staging/produção.

## `login-brute-force.ts` — ensaio D-001 (lockout USP-004)

Demonstra o bloqueio `(email, ip)` após 5 falhas em 15 min (ADR-0029).

### Pré-requisitos

1. Stack local no ar: `supabase start`.
2. App no ar: `npm run dev` (porta 3000).
3. Uma Pessoa existente com credencial (via auto-cadastro USP-001), cujo e-mail
   você passa em `--email`.

### Endpoint

O script faz `POST` com corpo JSON `{ email, senha }` e header `x-forwarded-for`
(IP sintético). Aponte `--url` para um endpoint que aceite esse contrato e
delegue à `loginAction`. Como Server Actions usam um protocolo opaco, em ambiente
local exponha um shim temporário (route handler `POST /api/_dev/login` que apenas
chama `loginAction`) **apenas para o ensaio** — não commitar o shim.

### Execução

```bash
npx tsx scripts/load/login-brute-force.ts \
  --url http://127.0.0.1:3000/api/_dev/login \
  --email alvo@example.com \
  --attempts 12 \
  --ips 2
```

### Saída esperada

Por IP sintético:

- Tentativas **1–5**: chegam ao provedor (resposta de credencial inválida).
- Tentativa **6 em diante**: bloqueio transparente — **mesma** mensagem genérica
  (`Credenciais inválidas…`), sem revelar o lockout (anti-enumeração D-G).
- IPs distintos contam de forma independente (a chave é `(email, ip)`).

Confirme visualmente que o ponto de virada ocorre na 6ª tentativa e registre a
observação no PR para a validação com o sponsor (D-001).
