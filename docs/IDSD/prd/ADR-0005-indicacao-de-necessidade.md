# ADR-0005: Indicação de necessidade como pré-requisito para saída não-cesta

**Status:** Aceito
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** US-029, US-030, US-031, US-052, US-053
**Tags:** regra-de-negocio | escopo

## Contexto

A distribuição de itens **não-cesta** (roupa, fitoterápico, remédio, higiene, médico-hospitalar) na ASONSEG não tem regra de frequência fixa por beneficiário (decisão consciente do cliente — saída livre, com controle apenas por estoque). Mas a operação real **não é "qualquer voluntário entrega qualquer coisa a qualquer beneficiário"** — existe uma atuação contínua da **assistente social** que identifica e indica as necessidades caso a caso.

Durante a elicitação, três modelos foram considerados:

- **Modelo de habilitação prévia genérica** ("uma vez triada, a pessoa pode receber qualquer coisa") — cliente rejeitou.
- **Modelo de habilitação por categoria** ("pode receber roupa, mas não medicamento") — cliente rejeitou.
- **Modelo de indicação caso a caso** ("a Família Souza precisa de apoio para o inverno") — cliente escolheu.

Surgiu então a questão de como esse "caso a caso" se materializa em sistema sem virar amarra burocrática.

## Decisão

Adotamos o conceito de **Indicação de Necessidade**, com as características:

1. **Criada pela assistente social** para um **beneficiário OU uma família** como sujeito.
2. **Tem categoria** (roupa, fitoterápico, remédio, higiene, médico-hospitalar) e **tipo** (atendimento regular, emergencial, campanha sazonal).
3. **Descrição textual livre** ("apoio para o inverno", "atendimento de saúde", "kit dia das crianças") — assistente social mantém autonomia narrativa.
4. **Data de validade** definida pela própria assistente social na criação. Vencida automaticamente nessa data.
5. **Indicação ativa habilita N entregas** — não consome ao usar. O voluntário, ao registrar saída não-cesta, **seleciona uma indicação ativa** do beneficiário e vincula a entrega.
6. **Múltiplas indicações ativas** permitidas para o mesmo sujeito, com regra de **unicidade por (sujeito, categoria, tipo)** — não pode haver duas ativas com a mesma combinação.
7. **Encerramento manual** antes da validade permitido por: assistente social, coordenador, diretoria ou voluntário com permissão delegada — com **justificativa obrigatória**.
8. **Aviso, não bloqueio**, quando a categoria do item entregue diverge da categoria da indicação selecionada — voluntário confirma e segue (US-031).

**Sem indicação ativa, voluntário não consegue registrar saída não-cesta** (cesta básica segue regra própria, não usa indicação).

## Alternativas Consideradas

### Alternativa A: Habilitação genérica do beneficiário (recusada pelo cliente)

Descrição: triagem da família libera todos os membros para receber qualquer coisa. Sistema só registra a saída.

Prós:
- Trivial; sem entidade nova.
- Voluntário tem máxima autonomia operacional.

Contras:
- Perde-se a atuação ativa da assistente social.
- Sem controle social do que está saindo para quem.
- Voluntário decide sozinho — risco de entregas mal direcionadas.

**Por que não escolhida:** cliente quer manter o papel ativo da assistente social na indicação caso a caso.

### Alternativa B: Habilitação por categoria estruturada (recusada pelo cliente)

Descrição: cada beneficiário é habilitado por categoria ("Maria pode receber roupa e medicamento, mas não fitoterápico"). Estrutura permanente, não vencente.

Prós:
- Granularidade real de controle.
- Permite fluxos automatizados ("essa pessoa nunca recebeu X — bloquear").

Contras:
- Cliente: "não é assim que funciona aqui — é mais caso a caso".
- Estrutura permanente não captura a natureza pontual da necessidade (apoio para o inverno é diferente de apoio para enchente).

**Por que não escolhida:** não reflete a operação real.

### Alternativa C: Indicação aberta sem categoria (proposta inicial do cliente, evoluiu para C+D)

Descrição: indicação puramente textual ("Família Souza precisa de apoio para o inverno"), sem categoria ou tipo estruturado.

Prós:
- Máxima flexibilidade da assistente social.
- Cadastro de indicação trivial (1 campo).

Contras:
- Impossível ter regra de unicidade (toda indicação seria "única").
- Relatórios de "indicações por categoria" inviáveis.
- Auditoria sobre o que está sendo indicado fica frágil.

**Por que evoluímos para D:** ao discutirmos coexistência de múltiplas indicações ativas, cliente escolheu o modelo "(c3) sim, múltiplas com regra de diferenciação por categoria + tipo", o que implicou estruturar essas duas dimensões.

### Alternativa D: Indicação semi-estruturada (escolhida) — categoria + tipo + descrição livre + validade

Como descrito em §Decisão.

Prós:
- Preserva flexibilidade narrativa da assistente social (descrição livre).
- Estrutura mínima permite relatório, unicidade e auditoria.
- Validade definida pela própria assistente social evita poluição de lista do voluntário.
- Modelo de "abriga múltiplas entregas" é simples e expressivo.

Contras:
- Tipos pré-definidos (regular/emergencial/sazonal) podem não cobrir 100% dos cenários (Q-001 trata a evolução).
- Auditoria fina ("a indicação foi atendida integralmente?") fica difícil — modelo não conta o "consumo".
- Sem critério estruturado de prioridade dentro da indicação (não há "urgência: alta").

**Por que escolhida:** equilibra autonomia da assistente social com o mínimo de estrutura para o sistema operar com clareza e gerar relatórios úteis.

## Consequências

**Positivas:**
- Saída não-cesta passa a ter um "porquê" registrado, não é apenas registro mecânico de baixa de estoque.
- Assistente social mantém papel ativo de avaliação e indicação.
- Relatório de "indicações vencidas sem nenhuma entrega" (US-053) vira indicador útil de necessidades não atendidas.
- Múltiplas indicações simultâneas suportam contextos paralelos (regular + emergencial).

**Negativas / Trade-offs:**
- Voluntário precisa selecionar indicação no registro de saída — passo extra de fluxo.
- Risco de assistente social criar muitas indicações genéricas "para liberar entregas" — esvazia o propósito. Mitigado por relatório M8 (% de indicações vencidas sem atendimento).
- Modelo "aberto" (descrição livre + aviso, não bloqueio, em categoria divergente) tem rastreabilidade granular nas entregas, não nas necessidades. Aceitável para o MVP — risco registrado em R-007.
- Tipos pré-definidos podem se mostrar insuficientes — Q-001 (configurabilidade) fica em aberto para refinamento.

**Implicações em outras decisões:**
- ADR-0001 (delegação granular): "encerrar indicação" entra no catálogo de permissões delegáveis.
- US-031 (saída não-cesta) tem como pré-condição uma indicação ativa.
- US-053 (relatório de indicações vencidas sem entrega) materializa o controle social do modelo.

## Referências

- US-029, US-030, US-031, US-052, US-053
- §11 do PRD (Glossário — termo "Indicação de necessidade")
- Sessão de elicitação 2026-05-19, escolha pelo modelo "(d) aberto" evoluindo para "(c3) múltiplas com unicidade por categoria + tipo"
