# ADR-0002: Beneficiário e família como entidades separadas com vínculo histórico temporal

**Status:** Aceito
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** US-012, US-013, US-014, US-015, US-016, US-018, US-019 a US-023, US-028, US-031, US-050, US-051
**Tags:** regra-de-negocio | dados | conformidade

## Contexto

A realidade da operação da ASONSEG, quando aprofundada durante a elicitação, mostrou-se mais rica do que o modelo "ONG cadastra famílias e entrega cestas":

- **Cesta básica** é entregue à família (representada pelo responsável).
- **Itens não-cesta** (roupa, fitoterápico, medicamento, higiene, médico-hospitalar) são entregues ao **beneficiário individual**, que pode ou não estar vinculado a uma família.
- **Composição familiar muda** ao longo do tempo: casamento da filha, separação dos pais, guarda compartilhada, óbito.
- Em guarda compartilhada, um filho integra **duas famílias simultaneamente**.
- Relatórios por família precisam mostrar não só o que a família recebeu como núcleo (cestas), mas também o que cada membro recebeu individualmente **enquanto o vínculo esteve ativo**.

Um modelo plano ("cadastra família e digita o número de filhos") perderia rastreabilidade individual, não comportaria guarda compartilhada, e tornaria o relatório histórico impreciso quando a composição muda.

Decisão precisava sair antes da modelagem do épico 3 (Beneficiário e Família) por ser estrutural.

## Decisão

Adotamos modelo com três entidades:

1. **Beneficiário** — pessoa física, entidade fundamental, identificada por CPF. Toda pessoa atendida é cadastrada individualmente.
2. **Família** — agrupamento com um único responsável (beneficiário maior de idade) e dados de moradia/socioeconômicos compartilhados.
3. **Vínculo (Beneficiário ↔ Família)** — relação N:N com **tipo** (8 tipos pré-definidos), **data de início** e **data de fim** (nula se ativo). Permite reconstruir a composição da família em qualquer momento histórico.

**Regras estruturais:**

- Toda família tem um responsável (obrigatório, único, maior de idade).
- Um beneficiário não pode ser responsável de mais de uma família simultaneamente.
- Vínculo múltiplo ativo entre um beneficiário e duas famílias **só é permitido** se o tipo do segundo vínculo for **"Filho(a) em guarda compartilhada"**. Demais tipos = vínculo único.
- Quando um vínculo termina (ex.: filha que casa), persiste-se `data fim` e nenhuma alteração posterior é permitida nesse vínculo. Atendimento recebido enquanto o vínculo estava ativo permanece no histórico da família.
- Composição familiar é **derivada** dos vínculos ativos (com cálculo automático de faixa etária a partir das datas de nascimento). Existe campo manual de fallback para situações em que nem todos os membros ainda foram cadastrados; o sistema sinaliza visualmente quando a composição mostrada é derivada (confiável) vs. declarada (fallback).

**Tipos de vínculo:** Responsável; Cônjuge/companheiro(a); Filho(a); Filho(a) em guarda compartilhada; Enteado(a); Pai/mãe (idoso dependente); Outro parente; Agregado.

## Alternativas Consideradas

### Alternativa A: Família plana com composição declarada

Descrição: cadastrar a família com nome do responsável, endereço, dados socioeconômicos e um campo "composição familiar" textual ou estruturado por faixa etária. Não cadastrar cada membro individualmente.

Prós:
- Modelagem simples; muito menos esforço de cadastro.
- Atende ao caso "padrão" (uma família, recebe cesta) sem ginástica.

Contras:
- **Impossível** entregar item nominal a um membro individual (a operação real exige isso, especialmente em fitoterápico e medicamento).
- **Impossível** modelar guarda compartilhada.
- Composição declarada fica desatualizada — quem revisa periodicamente?
- Relatório de "tudo que essa família recebeu, incluindo membros individuais" impossível de gerar.

**Por que não escolhida:** falha o requisito da operação real, identificado claramente na elicitação ("toda doação não-cesta é nominal para o beneficiário, mas deve aparecer na consulta da família dele").

### Alternativa B: Beneficiário + família com vínculo atual apenas (sem histórico temporal)

Descrição: beneficiário e família como entidades separadas, mas o vínculo é só "atual" — quando muda, simplesmente atualiza. Sem datas de início/fim.

Prós:
- Mais simples que o modelo escolhido (não tem que carregar histórico de vínculos).
- Cobre 80% dos casos sem complexidade extra.

Contras:
- Relatórios históricos ficam **incorretos**: quando a filha sai da família, todo o histórico passado dela "some" da consulta da família. Ex.: "Família Silva recebeu cobertor em 2024" — mas o cobertor foi entregue à filha, que hoje não está mais vinculada. O cobertor desaparece do relatório da família.
- Auditoria/prestação de contas fica comprometida em qualquer revisão retroativa.

**Por que não escolhida:** o cliente fez escolha explícita pelo modelo com histórico (Opção 1), reconhecendo o custo adicional. A ASONSEG presta contas institucionalmente e não pode ter relatório histórico que muda conforme o estado atual.

### Alternativa C: Modelo escolhido (vínculo histórico temporal com data início/fim)

Descrição: como descrito em §Decisão.

Prós:
- Relatório histórico fidedigno em qualquer ponto do tempo.
- Suporte natural a guarda compartilhada e mudanças de composição.
- Auditoria preservada para sempre.
- Composição derivada elimina sincronização manual.

Contras:
- Esforço de cadastro maior (cada membro individualmente).
- Modelagem mais complexa; consultas precisam considerar a janela temporal.
- UI de gestão de vínculos precisa expor encerrar/transferir vínculo de forma clara.

**Por que escolhida:** fidelidade institucional vence simplicidade técnica neste caso, e o cliente assumiu conscientemente o custo.

## Consequências

**Positivas:**
- Composição familiar sempre coerente com os vínculos.
- Relatórios históricos fidedignos, independente de mudanças posteriores.
- Modelo acomoda guarda compartilhada sem hack.
- Cadastro nominal de todos os beneficiários melhora o controle social.

**Negativas / Trade-offs:**
- Tempo de cadastro inicial maior (cada pessoa, não cada família).
- Consultas históricas exigem joins com janela temporal — performance precisa ser cuidada.
- Necessidade do campo manual de fallback para composição (transição inicial).
- Risco de inconsistência: vínculos abertos sem data fim que deveriam estar fechados; revisão periódica da assistente social ajuda.

**Implicações em outras decisões:**
- ADR-0003 (cadastro nominal de famílias e LGPD) deriva diretamente desta — beneficiário individual cadastrado = mais dado sensível para proteger.
- US-019 (triagem) opera sobre a entidade Família, não sobre beneficiário.
- US-031 (saída não-cesta) opera sobre Beneficiário, não sobre Família.
- US-050/US-051 (relatórios de atendimento) dependem da janela temporal de vínculo para consolidar corretamente.

## Referências

- US-012, US-013, US-014, US-015, US-016, US-018
- §11 do PRD (Glossário — termos "Beneficiário", "Família", "Vínculo", "Tipo de vínculo")
- Sessão de elicitação 2026-05-19, exemplos do cliente: filha que casa, separação dos pais com guarda compartilhada
