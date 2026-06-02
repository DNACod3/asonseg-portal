# `src/modules/` — Monolito modular

Cada domínio do portal vive em um módulo isolado sob `src/modules/<nome>/`. Os 11 módulos do MVP:

`identity` · `persons` · `companies` · `consents` · `moderation` · `jobs` · `services` · `referrals` · `cv-extraction` · `audit` · `reporting`

## Template de módulo

Todo módulo segue **exatamente** esta estrutura:

```
modules/<nome>/
├── actions/       # Server Actions ('use server')
├── queries/       # Consultas read-only
├── domain/        # Tipos, enums, regras de negócio puras (sem IO)
├── schemas/       # Schemas Zod
├── components/    # Componentes React do módulo
├── views/         # View Models por papel do observador (privacidade)
├── ports/         # Interfaces (DI)
├── adapters/      # Implementações concretas
├── server/         # (opcional) Helpers server-only (Node): guards de sessão (ADR-0030)
├── __tests__/
└── index.ts       # Barrel export — todos os imports passam por aqui
```

> `server/` é **opcional**: helpers que só rodam no servidor Node (ex.:
> `requireActivePerson`/`getCurrentPerson` — revalidação de sessão por request,
> ADR-0030) e que não se encaixam em `actions/` (mutações) nem `queries/`
> (leituras read-only). Não confundir com o `requirePermission()` RBAC do passo
> 2 da sequência de Server Action sensível.

## Regra de import (obrigatória)

- ✅ Importe sempre via barrel: `import { x } from '@/modules/persons'`.
- ❌ Nunca via caminho profundo: `import { x } from '@/modules/persons/actions/x'`.

A regra `no-restricted-imports` no `eslint.config.mjs` proíbe `@/modules/*/*` e quebra o CI.
Imports **internos** ao próprio módulo usam caminhos relativos (`./actions/x`, `../domain`).

## Padrão de Server Action sensível

1. Validar input com Zod.
2. `requirePermission()`.
3. `requireActiveConsent()` quando aplicável (LGPD).
4. Checar pré-condições de negócio.
5. Executar dentro de `withAudit('EVENT_TYPE', async (tx) => { ... })`.

Retorno sempre `{ ok: true, data } | { ok: false, error }`. Nunca `throw` de uma Server Action.
