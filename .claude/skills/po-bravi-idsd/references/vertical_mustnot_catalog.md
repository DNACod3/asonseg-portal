# Catálogo de must-nots por vertical

A fatia de **memória empírica** que cabe na camada de PO. Projetos de uma mesma vertical repetem os mesmos fracassos de resultado; este catálogo consolida os que já apareceram, para que o greenfield seguinte não comece do zero no que já se sabe que dá errado.

## Como usar

1. **Na elicitação** — identifique a(s) vertical(is) do projeto e use a seção correspondente como **checklist de partida**. Para cada item: pergunte ao dono do intent "isto se aplica aqui?".
2. **O que sobrevive** vira `P-NNN` no expectations file da USP-vetor, com âncora ao fracasso `F-X` do intent e eval stub negativo.
3. **O que não se aplica** é descartado com uma linha de justificativa (não some em silêncio).
4. **Ao fechar o projeto** — todo must-not novo que se mostrou *genérico da vertical* (não regra específica do cliente) é promovido de volta a este catálogo, com a origem.

**O catálogo é semente, não verdade.** A vertical informa; o dono do intent do projeto atual decide. Nenhum must-not entra no expectations file sem confirmação — herdar cego é o oposto do método.

**Formato dos itens:** `CAT-<vertical>-NNN`. Cada item traz o texto da proibição (idioma do dono), a origem, e uma dica de eval negativo.

---

## LGPD / dado sensível

Origem recorrente: ASONSEG (Portal Empregabilidade), GG Vendas, qualquer projeto com IA sobre dado pessoal.

- **CAT-LGPD-001** — O sistema NÃO PODE ativar papel/finalidade que processa dado pessoal antes do consentimento específico daquela finalidade estar persistido (com versão, data, origem).
  - origem: ASONSEG · eval: `given finalidade sem consentimento then REPROVA se o processamento ocorreu`
- **CAT-LGPD-002** — O sistema NÃO PODE enviar dado pessoal a provedor de IA sem garantia de não-retenção (ZDR) quando a finalidade exige.
  - origem: ASONSEG / BM3 · eval: `given chamada ao provedor de IA then REPROVA se a flag de retenção não estiver desabilitada`
- **CAT-LGPD-003** — O sistema NÃO PODE processar dado de menor de idade por IA sem consentimento de responsável registrado.
  - origem: ASONSEG · eval: `given titular < 18 then REPROVA se houver processamento por IA sem consentimento de responsável`
- **CAT-LGPD-004** — O sistema NÃO PODE manter dado pessoal além do prazo de retenção declarado para a finalidade.
  - origem: ASONSEG · eval: `given registro além do prazo then REPROVA se ainda existir/legível`
- **CAT-LGPD-005** — O sistema NÃO PODE expor dado pessoal de um titular a outro perfil sem base legal/papel que o autorize.
  - origem: GG Vendas · eval: `given usuário sem papel autorizado then REPROVA se o dado de terceiro for visível`
- **CAT-LGPD-006** — O sistema NÃO PODE deixar de registrar em log de auditoria operação que cria, altera ou expõe dado sensível.
  - origem: ASONSEG · eval: `given operação sobre dado sensível then REPROVA se não há entrada de auditoria correspondente`

## Fiscal / NF-e / NFS-e

Origem recorrente: Cassol NFS-e MVP, integração de NF em GG Vendas.

- **CAT-FISC-001** — O sistema NÃO PODE emitir documento fiscal com valor divergente do pedido/serviço de origem.
  - origem: Cassol · eval: `given pedido X then REPROVA se o documento fiscal emitido tiver valor ≠ X sem ajuste registrado`
- **CAT-FISC-002** — O sistema NÃO PODE marcar como conciliado um documento sem correspondência confirmada na origem.
  - origem: Cassol · eval: `given item sem match na origem then REPROVA se status = conciliado`
- **CAT-FISC-003** — O sistema NÃO PODE perder ou sobrescrever silenciosamente um documento que entrou no limbo (falha de processamento) — ele tem de permanecer recuperável pelo analista fiscal.
  - origem: Cassol · eval: `given documento em limbo then REPROVA se não estiver listável/recuperável no painel`
- **CAT-FISC-004** — O sistema NÃO PODE reprocessar/duplicar emissão de um documento já emitido (dupla emissão).
  - origem: Cassol · eval: `given documento já emitido when reprocessado then REPROVA se gerar segunda emissão`
- **CAT-FISC-005** — O sistema NÃO PODE concluir uma operação fiscal sem deixar trilha do que a IA decidiu vs. o que o analista confirmou (quando IA está habilitada por feature flag).
  - origem: Cassol · eval: `given operação com IA habilitada then REPROVA se não há registro de decisão da IA + confirmação humana`

## Financeiro / cobrança / agente em canal (WhatsApp)

Origem recorrente: BM3 (agente de cobrança via WhatsApp).

- **CAT-FIN-001** — O sistema NÃO PODE iniciar contato de cobrança fora da janela horária permitida pela regulação/política.
  - origem: BM3 · eval: `given horário fora da janela then REPROVA se uma mensagem de cobrança foi enviada`
- **CAT-FIN-002** — O sistema NÃO PODE prosseguir com cobrança a um devedor que já solicitou parar o contato (opt-out) naquele canal.
  - origem: BM3 · eval: `given devedor com opt-out then REPROVA se houver nova mensagem de cobrança`
- **CAT-FIN-003** — O sistema NÃO PODE expor valor de dívida, dados do contrato ou dado pessoal a um número/contato não verificado como o titular.
  - origem: BM3 · eval: `given contato não verificado then REPROVA se valor/contrato/dado foi revelado`
- **CAT-FIN-004** — O sistema NÃO PODE prometer/registrar acordo ou desconto fora dos limites aprovados, ainda que o devedor peça.
  - origem: BM3 · eval: `given proposta fora do limite aprovado then REPROVA se o agente confirmou/registrou o acordo`
- **CAT-FIN-005** — O sistema NÃO PODE persistir registro de pagamento/baixa sem confirmação da fonte autoritativa (API do banco / sistema interno).
  - origem: BM3 · eval: `given baixa sem confirmação da fonte then REPROVA se status = pago`
- **CAT-FIN-006** — O agente NÃO PODE usar tom coercitivo/ameaçador ou linguagem que caracterize assédio na cobrança.
  - origem: BM3 · eval: `given transcrição da conversa then REPROVA se classificador de tom acusar coerção/ameaça` ❓ critério de classificação a definir com o dono

## RH / recrutamento / integração de candidatos

Origem recorrente: Ubiminds/Symplr↔HireVue, ASONSEG (empregabilidade).

- **CAT-RH-001** — O sistema NÃO PODE exibir um candidato com qualificação/credencial que ele não confirmou.
  - origem: ASONSEG · eval: `given qualificação não confirmada pelo candidato then REPROVA se aparece no perfil público`
- **CAT-RH-002** — O sistema NÃO PODE encaminhar candidato com badge/credencial de parceiro depois que a credencial foi revogada.
  - origem: ASONSEG · eval: `given credencial revogada then REPROVA se o encaminhamento ainda exibe o badge`
- **CAT-RH-003** — O sistema NÃO PODE propagar para o sistema destino dado de candidato que falhou validação na origem (middleware não "limpa" erro herdando premissa morta).
  - origem: Ubiminds/HireVue · eval: `given registro inválido na origem then REPROVA se foi escrito no destino`

---

## Manutenção do catálogo

- Promova ao catálogo apenas must-nots **genéricos da vertical** — regra específica de um cliente fica no expectations daquele projeto, não aqui.
- Sempre registre a **origem** (projeto que revelou o item). É o equivalente, na camada de PO, ao "qual arquitetura funcionou sob quais restrições" da memória empírica do IDSD.
- Quando dois projetos da mesma vertical divergem num item, mantenha o mais geral e anote a variação — não duplique.
