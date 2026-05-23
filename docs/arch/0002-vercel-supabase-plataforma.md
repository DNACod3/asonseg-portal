# ADR-0002 (Técnico) — Vercel + Supabase como plataforma de hospedagem e dados gerenciados

- **Status:** Aceito — Estendido ao Release 1 (Portal MVP) em 2026-05-22
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO, Sponsor ASONSEG (a designar)
- **Tags:** infra | cloud | custo | lgpd

## Nota de extensão — Release 1 (Portal MVP)

A escolha Vercel + Supabase (região São Paulo) **continua válida** para o Portal MVP, com três ajustes de premissa para refletir o novo escopo:

1. **Tráfego anônimo público** — o Portal expõe páginas de busca de vagas, busca de serviços e home com indicadores que são navegáveis sem login. Isso aumenta o consumo de bandwidth da Vercel. O Hobby tem 100GB/mês de bandwidth; volume previsto cabe folgadamente, mas se a divulgação inicial da ASONSEG gerar pico de tráfego (QP-009 do PRD), pode ser necessário antecipar upgrade para Pro.

2. **Cache de conteúdo público** (ADR-T-0013) — a estratégia ISR + on-demand revalidation no Next.js App Router reduz hits ao banco e cabe nas features padrão da Vercel sem custo extra.

3. **LLM externo (ADR-T-0012)** — adiciona uma linha de custo recorrente (~US$ 5-30/mês em volume MVP) que não existia na arquitetura da Frente 4. Cobertura cambial.

**Custos atualizados para o Portal MVP:**

| Cenário | Componentes | Total |
|---|---|---|
| **Tier inicial** | Vercel Hobby + Supabase Free + LLM volume baixo + B2 backup | US$ 5-15/mês |
| **Tier confortável** | Vercel Pro + Supabase Pro + LLM volume médio + B2 | US$ 60-80/mês |
| **Tier expansão (se volume crescer)** | Mesma estrutura, LLM mais alto | US$ 100-150/mês |

A demais decisões (Hobby no início, sa-east-1, staging separado, lock-in moderado, riscos de Pooler e elegibilidade ONG) seguem como descritas abaixo, sem alteração.

---

## Contexto e Problema

ADR-0010 de negócio estabelece custo mínimo como diretriz arquitetural dominante. O cliente não impôs restrição tecnológica nem provedor preferencial, delegando a escolha à Bravi.

A escolha de plataforma é a maior linha de custo recorrente do projeto e tem implicações em:
- Postura LGPD (residência de dados — facultativa por lei, mas defensiva por percepção)
- Esforço operacional (managed vs. self-hosted)
- Lock-in e custo de migração futura
- SLA efetivo entregue ao cliente (PRD §6.2 — 99% em horário operacional)

Era necessário decidir antes de qualquer escolha de stack porque a plataforma define o que está disponível (auth, storage, banco) e o que precisa ser construído.

## Drivers de Decisão

- Custo mínimo recorrente (ADR-0010 de negócio)
- Ops próximo de zero (time pequeno, sem DevOps dedicado em tempo integral)
- LGPD — residência de dados em território brasileiro é um plus defensivo (PRD §6.7)
- Disponibilidade de 99% em horário 8h-21h (PRD §6.2)
- Lock-in tolerável apenas se a migração saída ficar em dias-de-trabalho, não meses
- Necessidade de Postgres (decidido em conjunto com ADR-0001 e a escolha de Prisma)

## Opções Consideradas

### Opção A — VPS no Brasil + Docker Compose self-managed

**Descrição:** AWS Lightsail SP, Magalu Cloud ou Locaweb VPS pequeno (2-4 vCPU, 4-8GB RAM) com Postgres no mesmo host, Docker Compose orquestrando, backup automatizado em object storage.

- **Prós:** custo recorrente baixo (R$ 50-150/mês); dados em território brasileiro; controle total; Docker Compose é o padrão lean adotado por Nei/Bravi
- **Contras:** ops fica com a Bravi (patching, monitoramento, gestão de backup); SLA depende do provedor BR (menos maduros que hyperscalers globais)
- **Custo:** R$ 50-150/mês (US$ 10-30/mês)

### Opção B — Vercel + Supabase (escolhida)

**Descrição:** Next.js deployado na Vercel (Hobby tier no início), dados em Supabase (Postgres + Auth + Storage em um projeto único), região South America (São Paulo, AWS sa-east-1).

- **Prós:**
  - Ops próximo de zero — provedor cuida de patching, backup, escalabilidade
  - Vercel é o ambiente de execução otimizado para Next.js (App Router, Server Actions, ISR)
  - Supabase entrega Postgres + Auth + Storage no mesmo provedor, integrados
  - Free/Hobby tier cobre o volume da ASONSEG nos primeiros meses
  - **Região São Paulo no Supabase** — dados em território brasileiro, residência LGPD-friendly
  - Migração para outro hosting é viável em dias (Next.js roda em qualquer Node, Postgres é portável via dump)
- **Contras:**
  - Cobrança em dólar — variação cambial pode impactar custo (mitigado: tiers Pro custam US$ 20+25 = US$ 45/mês, exposição limitada)
  - Vercel Hobby tem termos ambíguos para uso "não-pessoal" — risco operacional, mitigado em [Risco 1] abaixo
  - Lock-in moderado em Supabase (features como RLS, realtime, edge functions criam aderência se usadas — decisão deste ADR é não usar RLS, ver ADR-0003)
- **Custo:**
  - Tier inicial: US$ 0/mês (Vercel Hobby + Supabase Free)
  - Tier confortável: US$ 45/mês (Vercel Pro + Supabase Pro)

### Opção C — AWS São Paulo com managed services (RDS + ECS Fargate + S3)

**Descrição:** infraestrutura completa em AWS sa-east-1 com Postgres gerenciado, container compute, object storage.

- **Prós:** maturidade máxima; dado em território brasileiro; multi-AZ disponível; integração nativa para tudo
- **Contras:** custo mínimo realista US$ 80-200/mês mesmo no menor porte; lock-in alto; complexidade operacional desproporcional ao volume
- **Custo:** US$ 80-200/mês

### Opção D — VPS pequeno em EU/US + Docker Compose (Hetzner)

**Descrição:** Hetzner Cloud Helsinki ou similar, mesma arquitetura da Opção A mas com dados fora do Brasil.

- **Prós:** o mais barato (R$ 20-60/mês); Hetzner tem ótima reputação de uptime
- **Contras:** dado fora do Brasil — exige cláusula explícita no termo de consentimento; ops fica com a Bravi
- **Custo:** R$ 20-60/mês (US$ 5-15/mês)

## Decisão

Adotamos a **Opção B — Vercel + Supabase**, com as seguintes especificações concretas confirmadas pelo cliente:

- **Vercel:** plano **Hobby** no início; revisar para Pro (US$ 20/mês) se a operação crescer ou se houver dúvida sobre o uso permitido em Hobby
- **Supabase:** projeto na região **South America (São Paulo, AWS sa-east-1)**; plano **Free** no início, escalar para Pro (US$ 25/mês) conforme necessidade
- **Ambientes:** produção + **staging separado** (segundo projeto Supabase Free + Vercel Preview/Production separados)

Justificativa pelas lentes do arquiteto:
- **Custo** — tier inicial é literalmente US$ 0/mês, e o tier confortável (US$ 45/mês) é o mais barato do conjunto de opções avaliadas que mantém ops próximo de zero
- **Fail-Fast & Blast Radius** — managed provider reduz superfície de incidente operacional
- **Custo de Mudança** — Next.js + Postgres + Prisma é portável; lock-in efetivo é em features específicas do Supabase que escolhemos não usar (ver ADR-0003)

## Consequências

**Positivas:**
- Custo recorrente em US$ 0/mês no início viabiliza o MVP dentro do orçamento aprovado
- Residência em São Paulo elimina conversa difícil sobre transferência internacional de dados no termo de consentimento (D-002 do PRD)
- Backup nativo do Supabase (7 dias no plano Pro, daily no Free) cobre a postura mínima exigida no ADR-0006 deste conjunto
- Vercel Preview deployments aceleram revisão com cliente

**Negativas (trade-offs aceitos):**
- Custo em dólar — flutuação cambial de até 20-30% no horizonte do projeto é possível; impacto financeiro absoluto é pequeno no porte
- Vercel Hobby não tem SLA contratual — confiamos no histórico operacional do provedor (uptime histórico próximo de 100%) e na disponibilidade declarada de 99% no horário operacional

**Neutras / a monitorar:**
- Se a operação ultrapassar 100k requests/mês, Vercel Hobby pode atingir limites — migração para Pro é one-click
- Se o storage de termos digitalizados ultrapassar 1GB, Supabase Free atinge limite — migração para Pro é one-click

## Riscos e Mitigações

**Risco 1 — Vercel Hobby pode não cobrir uso comercial/ONG legitimamente.** Termos da Vercel mencionam "personal/non-commercial" para Hobby. ASONSEG é sem fins lucrativos mas o sistema é operacional/institucional. **Mitigação:** verificar elegibilidade da ASONSEG no programa Vercel for Nonprofits; se inviável, migrar para Pro (US$ 20/mês). Decisão final tomada antes do go-live.

**Risco 2 — Region São Paulo no Supabase tem histórico mais curto que US-East/EU-West.** A região está em GA, mas é mais nova. **Mitigação:** backup duplo (Supabase nativo + dump diário externo em Backblaze B2, ver ADR-0006); fallback documentado para migração para US-East se houver incidente regional recorrente.

**Risco 3 — Connection pooling do Supabase + Prisma em serverless.** Em runtime serverless da Vercel, conexões diretas ao Postgres não escalam. **Mitigação:** usar o **Transaction Pooler do Supabase** (PgBouncer) na connection string para a aplicação; manter a Direct Connection apenas para migrations Prisma. Documentado no `project-guideline.md`.

## Referências

- PRD §3.4 (Restrições — orçamento)
- PRD §6.2 (Disponibilidade — 99% em horário operacional)
- PRD §6.7 (LGPD — residência de dados)
- PRD §7 D-008 (Tamanho máximo de arquivo termo digitalizado)
- ADR-0010 de negócio (Custo mínimo como diretriz arquitetural)
- ADR-0001 (técnico) — Monolito modular Next.js fullstack
- Lentes do arquiteto: Custo, Fail-Fast & Blast Radius, Custo de Mudança
