# ADR-0001 (Técnico) — Monolito modular Next.js fullstack como padrão arquitetural

- **Status:** Aceito — Estendido ao Release 1 (Portal MVP) em 2026-05-22
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO, Sponsor ASONSEG (a designar)
- **Tags:** stack | arquitetura | escopo

## Nota de extensão — Release 1 (Portal MVP)

Após o reposicionamento estratégico (CHANGELOG v0.2 e v0.3), o MVP passa a ser o **Portal Empregabilidade e Serviços** com fundação compartilhada (Cenário 1 — identidade unificada plena). A decisão arquitetural deste ADR — monolito modular Next.js fullstack — permanece **integralmente válida** e ganha ainda mais aderência no novo escopo:

- App Router + Server Components são especialmente fortes para portais com conteúdo público navegável anonimamente (busca de vagas, busca de serviços, home pública com indicadores) — reduz JS no cliente, melhora SEO quando ele for ativado em V2.
- Volume previsto (50–200 vagas, 200–500 candidatos, 30–100 empresas, 50–150 prestadores no primeiro ano) está dentro da janela confortável de um monolito modular.
- A justificativa por YAGNI/Simplicidade e Custo de Mudança é a mesma; nenhum dos novos requisitos justifica separação em serviços.

**Atualização do conjunto de módulos:** os 7 módulos originais (`identity`, `people`, `inventory`, `distribution`, `sales`, `audit`, `reporting`) refletiam o escopo da Frente 4. Para o Release 1 (Portal), os módulos internos passam a ser **11**:

1. `identity` — autenticação, sessão, recuperação de senha, bloqueio
2. `persons` — Pessoa unificada, papéis compostos, perfis por papel, ficha socioeconômica simplificada
3. `companies` — Empresa + vínculo N:N Pessoa-responsável
4. `consents` — consentimentos LGPD por finalidade
5. `moderation` — máquina de estados de moderação pré-publicação
6. `jobs` — vagas e candidaturas
7. `services` — serviços e manifestações de interesse
8. `referrals` — encaminhamentos institucionais
9. `cv-extraction` — integração com LLM (via abstração de provedor)
10. `audit` — `withAudit`, `audit_log`, retenção
11. `reporting` — relatórios, indicadores, home pública

Os módulos do Release 2 (Frente 4 — `inventory`, `distribution`, `sales`) entram quando esse release for retomado, reutilizando integralmente `identity`, `persons` (estendendo com Família), `audit`, `reporting`.

---

## Contexto e Problema

O PRD v0.1 cobre 57 user stories distribuídas em 13 épicos, com sete capacidades de negócio distintas (Identidade, Pessoas, Estoque, Distribuição, Vendas, Auditoria, Relatórios). Múltiplas personas (voluntário, coordenador, assistente social, diretoria) operam o sistema com visões e permissões diferenciadas. O domínio tem vocabulário rico — vínculo histórico temporal, indicação, conciliação dupla, fechamento de caixa, locais de estoque.

Apesar da riqueza do domínio, três restrições dominam:

- **Volume baixo** — ~200 famílias ativas, ~1.500 beneficiários, ~80 voluntários, centenas de movimentações/mês.
- **Orçamento ONG** — diretriz dominante de custo mínimo (ADR-0010 de negócio).
- **Time único e deploy único** — não há motivo organizacional para separar serviços.

Era necessário decidir o padrão arquitetural antes de qualquer outra escolha, porque ele determina a estrutura de pastas, a estratégia de deploy, o modelo de dados e o esforço operacional do projeto.

## Drivers de Decisão

- Custo operacional mínimo (ADR-0010 de negócio)
- Volume baixo no horizonte de 12-24 meses (PRD §6.4)
- Time pequeno (1 Tech Lead + 2 devs + QA + UI + PO + DevOps part-time conforme PRD §8.2)
- Sete capacidades de negócio distintas com necessidade de coesão interna alta
- Disponibilidade de 99% no horário operacional (8h-21h, PRD §6.2)
- Necessidade de transações atômicas em fluxos críticos (transferência entre locais, fechamento de caixa, entrega de cesta com baixa de N itens)

## Opções Consideradas

### Opção A — Monolito modular Next.js fullstack (escolhida)

**Descrição:** uma única aplicação Next.js (App Router) servindo tanto o frontend (Server Components + Client Components) quanto o backend (Server Actions + Route Handlers). Sete módulos organizados como pacotes internos (`src/modules/`). Um único banco Postgres (Supabase). Um único deploy.

- **Prós:**
  - Aplicação única reduz custo de hosting (uma instância na Vercel)
  - Transações ACID nativas via `prisma.$transaction(...)` para fluxos críticos
  - Tipos TypeScript compartilhados entre client e server (zero código de DTO)
  - Server Components reduzem JavaScript no cliente — melhor p95 em telas read-heavy
  - Modularidade interna prepara o caminho para evolução futura sem custo presente
  - Padrão alinhado com a lente "YAGNI/Simplicidade" do arquiteto
- **Contras:**
  - Acoplamento maior entre módulos no início — disciplina de fronteiras precisa ser imposta por convenção e revisão de PR (mitigado no `project-guideline.md`)
  - Escalar uma capacidade exige escalar todo o monolito — aceitável no porte ASONSEG
- **Custo estimado:** US$ 0-25/mês (Vercel Hobby + Supabase Free no início)

### Opção B — Microsserviços por bounded context

**Descrição:** sete serviços independentes (um por capacidade), comunicação via REST ou eventos, banco separado por serviço, deploy independente.

- **Prós:**
  - Escala independente por capacidade
  - Times paralelos podem trabalhar sem se atrapalhar
  - Falha em um serviço isolada dos outros
- **Contras:**
  - Custo de infraestrutura 5-10x maior (sete deploys, mais bancos, mensageria)
  - Transações distribuídas em fluxos críticos (saga pattern, eventual consistency)
  - Complexidade operacional desproporcional ao porte da ASONSEG
  - Time único não tira nenhum benefício organizacional
- **Custo estimado:** US$ 200-500/mês mínimo

### Opção C — API REST separada + SPA frontend

**Descrição:** backend Express/Fastify expondo REST; frontend React/Vite separado. Dois deploys, dois repositórios ou monorepo.

- **Prós:**
  - Separação clara de responsabilidade entre back e front
  - Front pode ser servido em CDN barato (Cloudflare Pages)
  - Padrão mais convencional, devs mais acostumados
- **Contras:**
  - Duplicação de tipos (DTOs no back + tipos no front; ou gerados via OpenAPI)
  - Mais código de fetch/loading/error no front
  - Two-deploy story aumenta complexidade de CI/CD
  - Sem ganho real no porte ASONSEG
- **Custo estimado:** US$ 25-60/mês

## Decisão

Adotamos a **Opção A — monolito modular Next.js fullstack**, com sete módulos internos organizados em `src/modules/` e fronteiras de importação aplicadas via ESLint (`no-restricted-imports`).

Justificativa pelas lentes do arquiteto:
- **YAGNI/Simplicidade** — entrega o design mais simples que atende ao volume e aos RNFs declarados.
- **Custo de Mudança** — modularidade interna permite extrair módulos para serviços separados no futuro (V2 ou V3) se algum nicho realmente justificar, sem incorrer no custo agora.
- **Acoplamento & Coesão** — coesão alta por módulo (cada módulo tem responsabilidade clara); acoplamento controlado por contratos internos e ESLint rules.

## Consequências

**Positivas:**
- Custo de hosting próximo de zero no início (Vercel Hobby + Supabase Free)
- Transações ACID disponíveis para fluxos críticos (US-028 entrega de cesta, US-032 transferência, US-035-037 fechamento de caixa)
- Tipos compartilhados eliminam categoria inteira de bugs (drift entre back e front)
- Server Components reduzem JS no cliente — melhor experiência em celular de voluntário em campo

**Negativas (trade-offs aceitos):**
- Toda a aplicação compartilha o mesmo runtime — bug em um módulo afeta os outros (mitigado por testes, observabilidade e revisão)
- Escalar verticalmente é o único caminho até virar V2 (aceitável no horizonte de 12-24 meses)
- Disciplina de fronteiras entre módulos depende de convenção e revisão (mitigado pelo `project-guideline.md` seção 2.2)

**Neutras / a monitorar:**
- Se algum módulo isoladamente passar a representar >40% do tráfego ou exigir SLA diferente, reavaliar extração para serviço próprio
- Limite prático de monolito Next.js bem estruturado é por volta de 50-200 mil requests/dia — ASONSEG está duas ordens de grandeza abaixo

## Referências

- PRD §3.4 (Restrições — orçamento e diretriz de custo mínimo)
- PRD §6 (Requisitos Não-Funcionais)
- PRD §8.2 (Composição da squad — time pequeno)
- ADR-0010 de negócio (Custo mínimo como diretriz arquitetural)
- Lentes do arquiteto: YAGNI/Simplicidade, Custo de Mudança, Acoplamento & Coesão
