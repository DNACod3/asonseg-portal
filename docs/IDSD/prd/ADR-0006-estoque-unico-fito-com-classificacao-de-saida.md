# ADR-0006: Estoque único de fitoterápico com classificação de saída (doação vs venda)

**Status:** Aceito
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** US-024, US-031, US-032, US-033, US-034, US-042, US-043, US-044, US-045
**Tags:** regra-de-negocio | dados

## Contexto

Fitoterápicos da Pastoral da Saúde têm dois destinos operacionais distintos:

- **Doação social** ao beneficiário cadastrado, via indicação da assistente social, dentro da matriz.
- **Venda ao fiel** na capela, ao fim das missas (com dinheiro ou PIX).

Como o mesmo produto pode seguir por qualquer um dos dois caminhos, surgiu a questão: o sistema deve modelar **dois estoques separados** ("estoque para venda" vs "estoque para doação") ou **um estoque único** com a classificação acontecendo no momento da saída?

A decisão tem implicações em modelagem de dados, fluxo de cadastro de entrada, e na semântica das transferências entre locais.

## Decisão

Adotamos **estoque único** por (item, local). O sistema **não diferencia** previamente "fito para venda" de "fito para doação" — todo fitoterápico produzido entra no estoque da produção e segue depois um dos caminhos.

A diferenciação acontece **no momento da saída**:

- **Saída tipo "doação"**: registrada via US-031 (entrega não-cesta), vinculada a uma indicação ativa do beneficiário; sai do estoque social ou da produção da matriz; sem preço, sem caixa.
- **Saída tipo "venda"**: registrada via US-034 (venda em capela), com forma de pagamento, vendedor e local capela; sai do estoque da capela; gera entrada no caixa (a conciliar).
- **Transferência entre locais** (US-032) é tipo próprio de movimentação, e é a operação que abastece capelas a partir da matriz produção. Não é "decisão sobre o destino comercial" — é apenas movimentação física.

Essa decisão **vale também para roupa** (que segue o mesmo padrão estrutural — pode ser doada na matriz via indicação ou vendida em capela como bazar).

## Alternativas Consideradas

### Alternativa A: Estoque único + classificação na saída (escolhida)

Como descrito em §Decisão.

Prós:
- Modelo de dados simples; uma linha de saldo por (item, local).
- Reflete a realidade: o produto físico é o mesmo, o destino é decidido no ato.
- Voluntário não precisa "mover" item de "estoque de venda" para "estoque de doação" — não há essa operação intermediária.
- Relatório de saídas por tipo (doação vs venda) é trivial: filtro por tipo de movimentação.

Contras:
- Não há "reserva" de estoque para fins específicos (ex.: "vamos manter 50 cápsulas para emergência social"). Mitigação: política operacional, não regra de sistema.

**Por que escolhida:** cliente confirmou explicitamente "o estoque é único". Reflete a realidade física e simplifica a operação.

### Alternativa B: Dois estoques separados por destino comercial

Descrição: modelar "estoque de fito para venda" e "estoque de fito para doação" como saldos distintos dentro do mesmo local físico. Existiria operação de "alocar X unidades para venda".

Prós:
- Permite reservar estoque para finalidades.
- Relatório de "quanto está alocado para cada finalidade" sai naturalmente.

Contras:
- Modelagem mais complexa (mais entidades).
- Voluntário/coordenador precisa decidir alocações constantemente.
- Quando precisa reverter ("essa cápsula que estava para venda virou doação emergencial"), gera operação intermediária de "realocação".
- Cliente: "estoque é único".

**Por que não escolhida:** complexidade não justificada pela operação real.

### Alternativa C: Diferenciação por categoria de item

Descrição: criar categorias paralelas no catálogo ("fito-venda" e "fito-doação") como itens diferentes.

Prós:
- Trivial em modelagem (item diferente, estoque diferente).

Contras:
- Cria itens duplicados no catálogo para o mesmo produto físico.
- Confunde a operação de produção (produtor faz "fito" — não "fito-venda" ou "fito-doação").
- Bloqueia conversão entre destinos.

**Por que não escolhida:** distorce a modelagem do catálogo. Não reflete a realidade.

## Consequências

**Positivas:**
- Modelo de estoque coerente e enxuto.
- Relatórios filtráveis por tipo de movimentação (saída tipo doação vs venda).
- Flexibilidade total para a operação decidir o destino conforme a demanda.
- Generalização natural para roupa, com mesma estrutura.

**Negativas / Trade-offs:**
- Não há reserva técnica de estoque para um destino — depende de disciplina operacional.
- Relatório de "previsão de receita esperada com o estoque atual" não é trivial — exige assumir que tudo é venda (ou parte por estimativa).
- Risco operacional: voluntário em capela pode "doar de favor" um item que deveria ser vendido. Sistema não bloqueia esse cenário porque, conceitualmente, ambas as saídas são legítimas. Mitigação: nas capelas, voluntário típico só tem permissão para registrar venda (não tem indicação ativa para registrar doação fora da matriz).

**Implicações em outras decisões:**
- ADR-0004 (múltiplos locais): combinação com este ADR garante que "estoque na capela = saldo único naquele local, vendável; estoque na matriz = saldo único, doável via indicação".
- ADR-0009 (produção fora do escopo): item entra no estoque pelo produtor via registro de "entrada" simples, sem amarra com matéria-prima.
- Relatórios de transparência (US-056) consolidam totais por tipo de saída — depende da classificação correta no momento.

## Referências

- US-024, US-031, US-032, US-033, US-034
- §11 do PRD (Glossário — termos "Local de estoque", "Vendedor", "Produtor")
- ADR-0004 (múltiplos locais), ADR-0009 (produção fora do escopo)
- Sessão de elicitação 2026-05-19, "o estoque é único"
