# Resumo de entrega — Facts USP-004 (Autenticar no portal com e-mail e senha)

Gerado pela skill-tdad (EARS → Fact). Pronto para o Kickoff Gate (project-guideline §22/§23).

## Critérios de aceitação

- **Total de ACs:** 4 (AC-004-1 a AC-004-4), copiados verbatim do PRD (Épico 1, USP-004).
- **Cobertura:** 4/4 ACs com fact. Nenhum AC sem fact.

| AC | Padrão EARS | Resumo |
|----|-------------|--------|
| AC-004-1 | WHEN…SHALL (event-driven) | login válido autentica + redireciona |
| AC-004-2 | IF…THEN (unwanted) | credenciais inválidas → mensagem genérica (anti-enumeração) |
| AC-004-3 | IF…THEN (unwanted, stateful) | 5 falhas/15min → bloqueio de 15min |
| AC-004-4 | WHILE…SHALL (continuous) | sessão expira após 12h de inatividade (invariante) |

## Artefatos gerados

- `bdd/usp-004-login.feature` — Gherkin PT-BR, 8 cenários (1 happy path, 4 borda/segurança, 1 concorrência, 2 invariante de sessão), todos com tag `@ac-004-N`.
- `unit/usp-004-login.spec.ts` — Vitest red (stub `not implemented` + `it.todo`), espelha os cenários.
- `e2e/usp-004-login.e2e.ts` — Playwright red (`test.fixme`), 3 fluxos.
- `traceability.md` — matriz AC → cenário BDD → path-alvo + bloco "## Facts" para o issue.

## Facts por tipo

- **Integração (Vitest):** 9 facts — happy path; validação Zod (3 entradas); credenciais inválidas; e-mail inexistente; bloqueio 5/15min; 6ª tentativa bloqueada; expiração do bloqueio; concorrência da contagem; expiração e manutenção de sessão.
- **Schema Zod (fronteira):** 1 fact — `modules/identity/schemas/loginInput.ts`.
- **E2E (Playwright):** 3 cenários — login válido, credenciais inválidas, bloqueio temporário.
- **Property-based / eval LLM / View Model:** nenhum (não aplicável a esta US).

## Casos obrigatórios de Server Action (§12)

- Happy path — coberto (AC-004-1).
- Validação Zod — coberto (AC-004-2, entradas malformadas).
- Concorrência — coberto (AC-004-3, contagem da janela).
- Permissão recusada — N/A: login é ação pública pré-auth (justificado, ADR-T-0003).
- Consentimento ausente — N/A: login não tem finalidade LGPD vinculada.

## Decisão de E2E

USP-004 NÃO está na lista dos Top 8 fluxos críticos (architecture-document §6). Como o login é o portão de autenticação dos demais fluxos, foi gerado um esqueleto E2E `test.fixme` como candidato; promover à suíte permanente é decisão do Tech Lead no Gate.

## Lacunas / decisões pendentes (atenção no Gate)

1. Texto/código exato da mensagem de bloqueio (AC-004-3) — placeholder `ACCOUNT_TEMPORARILY_LOCKED`; confirmar com PO. Não bloqueia.
2. Escopo do bloqueio (por e-mail × por IP × ambos) (AC-004-3) — facts assumem por e-mail; confirmar com Tech Lead. Impacta teste de concorrência.
3. Mecânica de "12h de inatividade" (AC-004-4) — sliding vs. TTL absoluto do Supabase. Item mais próximo de bloqueio: se a plataforma não suportar inatividade deslizante nativa, exige wrapper. Resolver na Fase 0.

Todos os facts estão em status **Red** (falham por ausência de implementação).
