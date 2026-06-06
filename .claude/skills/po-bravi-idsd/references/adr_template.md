# Template de ADR (Architecture Decision Record) de Produto

Toda decisão de negócio relevante vira um ADR próprio em `decisions/ADR-NNNN-titulo-curto.md`. **No PRD apenas referenciamos** ("ver ADR-0003").

## Quando criar um ADR

Crie um ADR quando:
- Houve escolha entre 2+ opções com trade-offs reais
- A decisão restringe ou define escopo material
- Uma premissa virou regra que orienta o resto do PRD
- Mudou algo no PRD que outras pessoas precisam entender o "por que" daqui a 6 meses

**Não** crie ADR para:
- Detalhe que cabe em uma única frase ("usaremos o nome 'Pedido' em vez de 'Solicitação'") — vai pro glossário
- Decisão técnica de arquitetura/stack — isso é com o Arquiteto
- Definição que ainda está em discussão — espere fechar; ADR registra decisão tomada, não conversa

## Numeração

Sequencial por projeto, padded a 4 dígitos: `ADR-0001`, `ADR-0002`...

Título curto, em formato verbo-substantivo: `ADR-0003-regra-de-geracao-de-SKU.md`, não `ADR-0003-SKU.md`.

ADRs **não** são renumerados nem deletados. Decisão superada vira "Superseded by ADR-NNNN" no status.

## Template

```markdown
# ADR-NNNN: [Título descritivo da decisão]

**Status:** Proposto | Aceito | Superseded por ADR-MMMM | Revisado em ADR-MMMM
**Data:** YYYY-MM-DD
**Decisores:** [Nomes dos envolvidos na decisão — cliente + Bravi]
**US/Épicos impactados:** US-001, US-003, Épico 2
**Tags:** escopo | regra-de-negocio | integracao | dados | ux | conformidade

## Contexto

O que motivou a decisão. Pelo menos 1 parágrafo. Inclua:
- A situação ou problema que exigiu decisão
- Restrições relevantes (regulatórias, técnicas, de mercado)
- Quem trouxe a questão e quando
- O que acontece se NÃO decidirmos

## Decisão

O que foi decidido, em frase clara e normativa. Sem ambiguidade.

> Decidimos que o SKU será gerado automaticamente no formato XX-NNNNN, onde XX é o código de família do produto (2 letras maiúsculas) e NNNNN é um sequencial único de 5 dígitos por família.

## Alternativas Consideradas

**Esta seção é obrigatória. Sem ela, o ADR é nota, não ADR.**

Liste **todas** as alternativas reais que foram discutidas, mesmo as descartadas rapidamente. Para cada uma:

### Alternativa A: [nome curto]

Descrição: 1-2 frases sobre como funcionaria.

Prós:
- Ponto positivo concreto
- Outro ponto positivo

Contras:
- Limitação ou risco específico
- Custo associado

**Por que não escolhida:** uma frase explicando o motivo principal.

### Alternativa B: [nome curto]

(mesma estrutura)

### Alternativa C: [nome curto]

(mesma estrutura)

## Consequências

O que muda no projeto por causa desta decisão.

**Positivas:**
- O que melhora ou viabiliza

**Negativas / Trade-offs:**
- O que fica restrito ou mais caro
- Dívidas técnicas ou de produto introduzidas

**Implicações em outras decisões:**
- Decisões futuras condicionadas a esta
- ADRs que precisam ser ajustados

## Referências

- US-001, US-003 (afetadas)
- Reunião com cliente em YYYY-MM-DD (registro: link/ata)
- Documento externo: [link]
```

## Exemplo preenchido

```markdown
# ADR-0003: Regra de geração de SKU para produtos cadastrados

**Status:** Aceito
**Data:** 2026-03-12
**Decisores:** Maria (cliente, dir. comercial), João (cliente, TI), Nei (Bravi PO)
**US/Épicos impactados:** US-001, US-002, US-008
**Tags:** regra-de-negocio | catalogo

## Contexto

O cliente precisa de um identificador único de produto que seja:
(a) legível para humanos (analistas precisam reconhecer família do produto à primeira vista),
(b) único e estável após criação,
(c) compatível com o sistema legado de etiquetagem (limite de 8 caracteres).

Não havia padrão definido — alguns produtos antigos usam códigos manuais inconsistentes.
Decisão precisava sair antes do início da Sprint 1 para destravar US-001 e US-008.

## Decisão

SKU será gerado automaticamente no formato `XX-NNNNN`, onde:
- `XX` = código de família do produto (2 letras maiúsculas), escolhido pelo analista no cadastro
- `NNNNN` = sequencial único de 5 dígitos dentro da família

Total: 8 caracteres, compatível com o legado. Geração é responsabilidade do sistema, não do usuário.
SKUs antigos manuais são mantidos como aliases para retrocompatibilidade.

## Alternativas Consideradas

### Alternativa A: UUID curto (8 chars de hash)

Descrição: gerar um hash randômico de 8 caracteres no cadastro.

Prós:
- Trivial de implementar
- Garantia matemática de unicidade global
- Sem necessidade de manter contador

Contras:
- Não legível por humanos — analistas perdem capacidade de reconhecer família
- Não tem ordenação natural — relatórios ficam menos intuitivos

**Por que não escolhida:** falha no requisito (a) — legibilidade humana é crítica para o time comercial que opera dezenas de produtos por dia.

### Alternativa B: Sequencial global (00000001, 00000002...)

Descrição: contador global incremental sem categorização.

Prós:
- Fácil de gerar
- Ordenação cronológica natural

Contras:
- Não comunica família do produto
- Risco de "embolar" produtos de famílias diferentes em buscas e relatórios

**Por que não escolhida:** mesmo motivo da A — não atende à legibilidade contextual.

### Alternativa C: SKU livre digitado pelo analista

Descrição: campo livre, validação apenas de unicidade.

Prós:
- Máxima flexibilidade
- Permite continuar padrões pré-existentes

Contras:
- Reproduz o problema atual (inconsistência)
- Risco de erro humano e colisões
- Custo de validação na UI

**Por que não escolhida:** o problema original é justamente a inconsistência de SKUs manuais. Manter livre não resolve a dor.

## Consequências

**Positivas:**
- Padrão consistente desde o dia 1
- Analistas reconhecem família à primeira vista
- Compatibilidade com etiquetadora legada preservada

**Negativas / Trade-offs:**
- Limite de 99.999 produtos por família — quando algum se aproximar, precisaremos repensar (ver risco no PRD seção 13)
- Famílias precisam ser cadastradas/aprovadas antes — adiciona uma etapa
- Migração de SKUs antigos exige tabela de aliases (US-008)

**Implicações em outras decisões:**
- US-008 (migração de catálogo legado) deve incluir tabela de aliases
- Relatórios e buscas precisam considerar tanto SKU novo quanto aliases — ver ADR-0005 quando definido

## Referências

- US-001, US-008
- Reunião com Maria e João em 2026-03-12 (ata: link)
- Catálogo atual do cliente: 4.200 produtos, 17 famílias estimadas
```

## Anti-padrões

### ADR sem alternativas

❌
> Decisão: usar webhook para integração.
> Justificativa: é a melhor forma.

Isso é nota, não ADR. Sem alternativas registradas, ninguém daqui a 6 meses sabe por que NÃO escolhemos polling, fila ou call síncrono.

### ADR rebatizado de nota técnica

ADRs deste skill são de **produto/negócio** — regras, escopo, decisões que mudam o comportamento esperado pelo cliente. Decisões técnicas (qual ORM, qual fila, qual cloud) são domínio do Arquiteto e ficam em ADRs técnicos próprios, não aqui.

### ADR de tudo

ADR pesa. Se você está abrindo ADR para decidir o nome de um botão ou a cor de uma tela, está errado. ADR é para decisão com **trade-off real** — onde escolher A fecha portas que B abriria.

### ADR que vira manual

ADR registra **a decisão e o porquê**, não o detalhe de implementação. Detalhe vai pra US, ADR fica em ~1 página. Se passou disso, considere quebrar em ADRs menores.
