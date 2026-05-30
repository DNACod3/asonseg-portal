# ADR-0004: Múltiplos locais de estoque como conceito estrutural do sistema

**Status:** Aceito
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** US-011, US-024, US-025, US-028, US-031, US-032, US-034, US-042 a US-047
**Tags:** escopo | regra-de-negocio | dados

## Contexto

Na elicitação inicial o entendimento foi de "um estoque por categoria de item" — modelo plano típico de pequena ONG. A descrição detalhada da operação da Pastoral da Saúde mudou esse entendimento:

- Os **produtores de fitoterápico** têm estoque próprio dos itens que produzem, separado do "estoque social" da matriz que recebe doações externas.
- Periodicamente, fitoterápicos são **transferidos para as 5 capelas** da igreja parceira, onde voluntários **vendedores** atendem os fiéis ao fim das missas.
- **Cada capela** tem seu próprio estoque, com saldo independente. O que está na capela 1 não está na capela 2.
- A capela também recebe **roupa transferida da matriz** para o bazar — então a regra "estoque por local" **não é** específica do fitoterápico, é estrutural.

Ignorar essa estrutura geraria duas patologias graves: (1) saldo "global" incorreto (somando tudo independente de onde está fisicamente), levando voluntários a tentar vender ou distribuir o que não está disponível no local; (2) impossibilidade de saber o que abastecer.

Decisão estrutural — define o modelo de dados de estoque e o conceito de transferência entre locais.

## Decisão

Adotamos **Local de Estoque** como entidade de primeira classe do sistema, presente em toda movimentação:

1. Cada movimentação (entrada, saída, transferência, venda) é **vinculada obrigatoriamente** a um **local específico**, com saldo próprio por (item, local).
2. **Saldo** é calculado por (item, local). Pode existir consolidação visual ("saldo total" somando todos os locais), mas o saldo operacional é sempre por local.
3. **Transferência entre locais** é uma operação atômica: baixa do local origem, credita no local destino, registra movimentação tipo "transferência" com referência única.
4. **Visibilidade do local** segue o acesso do usuário às áreas operacionais — voluntário vê apenas os locais a que tem acesso pela sua área.

**Locais previstos para o MVP:**

| Local | Tipo | Função |
|---|---|---|
| Matriz — Estoque Social | Central | Recebe doações; origem da distribuição social (cesta + não-cesta via indicação). |
| Matriz — Estoque da Produção de Fito | Central | Estoque do que os produtores fabricam. Origem das transferências para capelas e da distribuição via indicação. |
| Capela 1 a 5 | Satélite | Recebe transferências da matriz; estoque de venda (fito e roupa de bazar). Não atende beneficiário cadastrado. |

**Regras complementares:**

- Beneficiário/família é atendido **apenas na matriz** (capelas não fazem distribuição social, só venda).
- Roupa segue o mesmo padrão estrutural do fito: pode estar no estoque social da matriz (para distribuição via indicação) ou em capela (para bazar).

## Alternativas Consideradas

### Alternativa A: Local de estoque como conceito estrutural (escolhida)

Como descrito em §Decisão.

Prós:
- Modelo de dados reflete a realidade física da operação.
- Saldo por local é sempre verdadeiro; impossível "vender o que não está lá".
- Transferência entre locais é operação rastreável.
- Escalável: adicionar capela 6, ou um novo galpão da matriz, é cadastro, não mudança de código.

Contras:
- Aumenta o esforço de modelagem e de UI (sempre escolher local na operação).
- Voluntários precisam estar acostumados a pensar "de qual lugar estou tirando".

**Por que escolhida:** sem essa modelagem, não há como atender a venda em capela com saldo correto, nem rastrear abastecimento. Estrutural.

### Alternativa B: Local restrito à área "fitoterápico"

Descrição: tratar múltiplos locais como exceção específica de fitoterápicos. Outras categorias (alimento, roupa, medicamento) teriam estoque único.

Prós:
- Menor complexidade no MVP para categorias mais simples.
- Cesta básica permanece num modelo plano.

Contras:
- O cliente confirmou explicitamente: **"roupas tem o mesmo conceito"**. Tratar como exceção do fito gera modelagem inconsistente — quando precisar generalizar para roupa, exige refactor.
- Risco de criar duas modelagens paralelas na base.

**Por que não escolhida:** fato operacional descoberto na elicitação ("capelas vendem roupa também — bazar") invalida a opção. Generalizar desde o início é mais barato que refactorar.

### Alternativa C: Sem local — estoque consolidado por categoria

Descrição: ignorar a separação física. Sistema soma tudo num saldo único por item, independente de onde está.

Prós:
- Modelagem mais simples.
- UI mais direta (uma tela de saldo geral).

Contras:
- Vendedor na capela tentaria vender o que está na matriz.
- Coordenador não conseguiria saber o que abastecer.
- Conciliação física vs. sistema seria impossível.
- Falha grosseira na realidade operacional.

**Por que não escolhida:** não atende a operação real.

## Consequências

**Positivas:**
- Modelo coerente com a realidade física.
- Capacidade de abastecer capelas com transferência rastreável (US-032).
- Visibilidade clara de saldo por local (US-025).
- Relatórios por local viabilizam gestão (US-042, US-045, US-046).

**Negativas / Trade-offs:**
- UI de movimentação sempre exige escolha/confirmação do local.
- Voluntário precisa entender o conceito de "local" — treinamento mínimo necessário.
- Cadastro inicial dos 7 locais é dependência da Fase 0 (configuração da diretoria).
- Operações de transferência entre locais introduzem caso de inconsistência possível (falha no meio da operação) — exigem atomicidade.

**Implicações em outras decisões:**
- ADR-0006 (estoque único de fito por classificação de saída — doação vs venda) opera **dentro** de um local; não conflita.
- US-032 (transferência entre locais) é US de novo nível introduzida exclusivamente por esta decisão.
- US-024, US-028, US-031, US-034 referenciam o local como atributo obrigatório.
- ADR-0010 (custo mínimo) precisa contemplar isso na arquitetura (modelo de dados não-trivial).

## Referências

- US-011 (cadastro de locais), US-024 (entrada), US-025 (saldo), US-028 (entrega de cesta), US-031 (saída não-cesta), US-032 (transferência), US-034 (venda em capela)
- §11 do PRD (Glossário — termo "Local de estoque")
- Sessão de elicitação 2026-05-19, descrição do fluxo da Pastoral da Saúde
