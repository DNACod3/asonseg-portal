# ADR-0007: Edição/exclusão de registros com janela mensal e escalação para coordenador

**Status:** Aceito
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** US-039, US-040, US-041
**Tags:** regra-de-negocio | conformidade

## Contexto

Voluntários registram operações em campo (entrada de doação, entrega de cesta, saída não-cesta, venda em capela). Erros são inevitáveis: trocar beneficiário, errar quantidade, escolher item errado. Sem mecanismo de correção, o sistema acumula registros incorretos e perde confiabilidade. Mas dar liberdade ampla também tem risco: edição retroativa pode mascarar problemas, alterar relatórios já consolidados, e dificultar auditoria.

Na elicitação, o cliente passou por iterações até chegar à configuração final:

- Primeira escolha: "voluntário pode editar/excluir o próprio registro a qualquer momento, sem restrição" (opção C ampla).
- Depois do alerta do PO sobre riscos de auditoria e relatórios mensais, refinou para: "pode reverter, mas só dentro do mês corrente".
- Para registros de meses anteriores, escolheu (b): "coordenador da área ou diretoria".
- Regra vale igual para entrada e saída de estoque.

Decisão precisa fechar antes da implementação para que o modelo de auditoria seja construído desde o início (log imutável é caro de adicionar depois).

## Decisão

Adotamos modelo de janela temporal por papel:

1. **Voluntário** pode editar ou excluir **registros que ele mesmo criou**, desde que estejam **dentro do mês civil corrente** (timezone América/São_Paulo). Não precisa de justificativa para correção dentro dessa janela.

2. **A partir da virada do mês civil**, o voluntário **perde** o direito de editar/excluir registros do mês anterior — mesmo os próprios.

3. **Coordenador da área** pode editar/excluir **qualquer registro da sua área** (de qualquer voluntário, em qualquer período, incluindo retroativos), **mediante justificativa textual obrigatória**.

4. **Diretoria** pode editar/excluir **qualquer registro** (qualquer área, qualquer período), **mediante justificativa textual obrigatória**.

5. **Toda alteração** (em qualquer papel, em qualquer período) gera **log imutável de auditoria** contendo: registro afetado, valores antes e depois, autor, data/hora, justificativa (quando obrigatória).

6. **Exclusão** marca o registro como excluído (soft delete) e **reverte o efeito da movimentação** no estoque/caixa correspondente — mas preserva os dados originais e quem fez a exclusão para auditoria.

7. **Alterações em períodos já consolidados em relatório** geram **alerta visível** ao coordenador/diretoria antes de confirmar (não bloqueia).

A regra vale **igualmente para entrada de doação, saída de cesta, saída não-cesta, venda em capela e transferência entre locais**.

## Alternativas Consideradas

### Alternativa A: Voluntário sem direito de edição/exclusão (escalação total)

Descrição: voluntário não corrige nada — toda correção exige coordenador ou pessoa com permissão delegada.

Prós:
- Coordenador tem controle total sobre integridade dos dados.
- Auditoria simples (só coordenador altera).

Contras:
- Coordenador vira gargalo para erros triviais (digitou 20 em vez de 10).
- Voluntário fica desmotivado a registrar com cuidado se "depois alguém arruma".
- Aumenta carga administrativa do coordenador.

**Por que não escolhida:** cliente quis dar autonomia ao voluntário para corrigir engano operacional do próprio registro.

### Alternativa B: Edição livre sem restrição temporal (recusada após alerta)

Descrição: voluntário pode editar/excluir o próprio registro a qualquer momento, mesmo de meses anteriores.

Prós:
- Máxima flexibilidade.
- Voluntário tem total autonomia.

Contras:
- Relatórios mensais fechados ficam vulneráveis a alterações retroativas.
- Risco de mascaramento de irregularidades descobertas tempos depois.
- Auditoria interna fica frágil — "minha cesta sumiu" pode virar registro deletado sem mostrar trilha clara.

**Por que não escolhida:** cliente, após alerta do PO sobre os riscos, refinou para janela mensal — equilíbrio melhor.

### Alternativa C: Janela mensal por papel (escolhida)

Como descrito em §Decisão.

Prós:
- Voluntário corrige engano operacional do dia a dia sem fricção.
- Mês fechado é mês fechado para o voluntário — relatórios mensais consolidados são estáveis na mão do voluntário.
- Correção retroativa é possível, mas requer escalação (coordenador/diretoria) com justificativa.
- Log imutável garante auditoria mesmo na janela "livre" do voluntário.

Contras:
- Modelo de auditoria precisa ser robusto desde o dia 1 (custo de desenvolvimento).
- Voluntário pode "esquecer de corrigir" e a janela passar — vai depender do coordenador.
- Lógica de "alerta sobre período consolidado" exige rastreio do que já foi reportado — pode ficar para versão refinada.

**Por que escolhida:** equilíbrio reconhecido pelo cliente após iteração.

### Alternativa D: Estorno em vez de exclusão (descartada)

Descrição: voluntário não exclui — apenas cria uma movimentação inversa ("estorno"). Modelo contábil clássico.

Prós:
- Maior fidelidade contábil.
- Auditoria pesada por design.

Contras:
- Voluntário com perfil de operação social não está acostumado com conceito de estorno.
- UI fica menos intuitiva ("por que tenho duas linhas, uma positiva e outra negativa?").
- Para ONG do porte da ASONSEG, ganho contábil não compensa atrito operacional.

**Por que não escolhida:** complexidade desproporcional ao porte e à maturidade da operação. Auditoria via log imutável atende o necessário.

## Consequências

**Positivas:**
- Voluntário tem agência para corrigir o próprio engano sem depender de coordenador.
- Mês fechado é mês fechado na mão do operador — relatórios mensais ganham estabilidade automática.
- Coordenador/diretoria mantém poder de correção retroativa com justificativa rastreável.
- Log imutável garante auditoria forte.

**Negativas / Trade-offs:**
- Modelo de auditoria não-negociável precisa ser robusto desde o dia 1.
- UI precisa expor claramente: "este registro pertence ao mês corrente — você pode editar" vs "mês anterior — só com escalação".
- Há um conceito de "fim do mês civil" que muda o comportamento do sistema da meia-noite em diante — risco de bug se mal tratado em timezone.
- Coordenador acumula correções de meses anteriores — pode virar carga administrativa periódica.

**Implicações em outras decisões:**
- ADR-0001 (delegação): "Inativar/excluir entrada de estoque incorreta" entra no catálogo de permissões delegáveis — coordenador pode delegar a voluntário de confiança para o caso de mês corrente.
- US-039, US-040, US-041 materializam essa decisão em ACs específicos.
- §6.3 do PRD (Segurança — log imutável de auditoria) deriva diretamente deste ADR.
- Risco R-008 (manipulação indevida na janela do voluntário) registrado em §13 do PRD.

## Referências

- US-039, US-040, US-041
- §6.3, §13 (R-008) do PRD
- Sessão de elicitação 2026-05-19, iteração da opção "C ampla" para "C com janela mensal"
