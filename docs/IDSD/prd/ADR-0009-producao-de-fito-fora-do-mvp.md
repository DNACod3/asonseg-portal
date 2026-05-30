# ADR-0009: Produção de fitoterápico fora do escopo do MVP

**Status:** Aceito
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** §3.2 do PRD (Out of Scope); afeta indiretamente US-024, US-032, US-033, US-045
**Tags:** escopo

## Contexto

A operação da Pastoral da Saúde inclui um fluxo de **produção** de fitoterápicos: voluntários produtores recebem matéria-prima (folhas, álcool, mel, frascos vazios, rótulos), fabricam o produto (xaropes, pomadas, cápsulas), embalam, precificam, e o produto pronto entra no estoque dos produtores.

Modelar esse fluxo completamente no sistema implicaria adicionar capacidades de mini-ERP de produção:

- Controle de matéria-prima como item de estoque próprio.
- Conceito de **ordem de produção** que consome matéria-prima e gera produto final.
- Possível rastreio de lote/batch da produção.
- Possível controle de custo de produção por unidade.

Isso é claramente um escopo significativo. O orçamento aprovado inicialmente é R$ 50.000 (em revisão), e o MVP já tem 57 user stories sem incluir produção. Era necessário decidir antes da modelagem.

## Decisão

A **produção de fitoterápico fica explicitamente fora do escopo do MVP**.

O sistema **não controla** matéria-prima, **não tem** ordem de produção, **não rastreia** custo de produção.

O produtor, ao terminar de fabricar, registra apenas **entrada do produto final no estoque da produção** — usando o mesmo fluxo de US-024 (entrada de doação/movimentação), com categoria correspondente (fitoterápico).

Para fins de relatório (US-043), pode-se filtrar entradas por "fonte" caso isso venha a ser refinado, mas o MVP não diferencia "fito produzido internamente" de "fito doado externamente" no modelo de dados de movimentação — distinção pode ser feita por observação textual livre ou por convenção operacional (ex.: voluntário que registra é produtor → assume-se produção interna).

Esta decisão deve ser **revisitada em V2** quando a operação digital da ASONSEG amadurecer.

## Alternativas Consideradas

### Alternativa A: Controle completo de produção (mini-ERP)

Descrição: sistema controla matéria-prima como item de estoque, ordens de produção consomem MP e geram produto final, com rastreio opcional de lote/custo.

Prós:
- Rastreabilidade ponta-a-ponta da Pastoral da Saúde.
- Permite análise de custo unitário do que é produzido.
- Reduz dependência de controle paralelo em caderno/planilha.

Contras:
- **Esforço significativo** — provavelmente um épico inteiro adicional com 8-12 US.
- Adiciona conceitos novos (ordem de produção, BOM, consumo) que oneram o treinamento de voluntários.
- Pouco compatível com orçamento aprovado.

**Por que não escolhida:** desproporcional ao MVP. Cliente respondeu explicitamente "produção de fito não entra agora".

### Alternativa B: Híbrido — só registro de matéria-prima como entrada, sem ordem de produção

Descrição: sistema permite registrar entrada de matéria-prima como item de estoque (categoria nova "matéria-prima") mas não amarra à produção. Voluntário produtor "manualmente" baixa matéria-prima quando consome e registra entrada do produto final.

Prós:
- Esforço menor que controle completo.
- Algum nível de visibilidade da matéria-prima disponível.

Contras:
- "Manualmente baixar" abre brecha para erro e fricção.
- Sem ordem de produção, a relação entre MP consumida e produto gerado fica solta.
- Beneficio marginal para o esforço adicional.

**Por que não escolhida:** ganho pequeno para o custo de incluir um novo conceito de item ("matéria-prima") no catálogo. Marca uma posição intermediária que não satisfaz nem quem quer controle total nem quem quer simplicidade.

### Alternativa C: Fora do escopo no MVP (escolhida)

Como descrito em §Decisão.

Prós:
- Mantém o MVP focado no que tem maior valor agregado (controle de saídas e vendas).
- Permite que a operação atual de produção continue em controle paralelo da Pastoral da Saúde, sem mudança disruptiva.
- Libera orçamento e esforço para o que está dentro do escopo.

Contras:
- Pastoral da Saúde mantém controle paralelo (caderno/planilha) de matéria-prima.
- Custo de produção não é rastreado pelo sistema — afeta análise de margem de venda no longo prazo.
- Em algum momento isso vai virar gargalo natural da operação digital — V2 prevê inclusão.

**Por que escolhida:** alinha com a realidade orçamentária e mantém foco no maior valor agregado do MVP.

## Consequências

**Positivas:**
- MVP mais enxuto, foco em saídas, vendas e controle de estoque.
- Pastoral da Saúde não é forçada a mudar o controle interno de produção de uma vez — pode digitalizar em fase posterior.
- Reduz superfície de treinamento dos voluntários produtores no MVP.

**Negativas / Trade-offs:**
- Controle paralelo de produção continua no caderno — risco operacional permanece nessa parte.
- Não há rastreio do custo unitário no sistema — preço de venda é definido manualmente pelo produtor sem suporte do sistema.
- Quando a operação amadurecer, isso vai virar dor — V2 já fica como candidata natural.

**Implicações em outras decisões:**
- ADR-0006 (estoque único de fito): mantém-se válido. O produto entra como item no estoque da produção via fluxo normal de entrada (US-024).
- US-033 (preço de venda): o produtor define manualmente, sem amarra com custo.
- Relatórios (US-045) reportam apenas venda, não margem.

## Referências

- §3.2 do PRD (Out of Scope — "Produção de fitoterápico")
- ADR-0006 (estoque único de fito)
- Sessão de elicitação 2026-05-19, resposta "produção de fito não entra agora"
