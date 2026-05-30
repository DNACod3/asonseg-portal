# ADR-0014: Empresa sem login próprio, com Pessoas-responsáveis (vínculo N:N)

**Status:** Aceito — Aplicável ao Release 1 (MVP Portal Empregabilidade e Serviços)
**Data:** 2026-05-22
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** USP-012 a USP-015, USP-020, USP-027, USP-029
**Tags:** modelagem | identidade | autorização | release 1

## Contexto

O protótipo do Portal sugeria, inicialmente, que Empresa seria um tipo de "usuário" do sistema com login próprio. Durante a elicitação, ficou claro que isso traz problemas:

1. Quem é a Pessoa que loga "como empresa"? Se for "a empresa", não tem rastreabilidade individual de quem fez o quê.
2. Como permitir que múltiplas pessoas operem em nome da mesma empresa? Compartilhar senha quebra rastreabilidade.
3. Empresa que muda de responsável (RH troca) — como gerenciar?

A direção institucional do cliente confirmou: Empresa não tem cadastro próprio com acesso. Uma Pessoa faz o cadastro da Empresa dentro do portal e se torna responsável por ela. Pode incluir outros responsáveis para criar vaga ou buscar candidatos em nome da empresa. Sempre deve existir pelo menos 1 responsável ativo.

A Pessoa, por sua vez, pode representar múltiplas Empresas (ex.: contador que representa 3 clientes; profissional liberal que tem 2 empresas).

## Decisão

**Empresa é uma entidade do sistema, mas NÃO tem login próprio.**

**Modelagem:**

- **Empresa** — entidade jurídica (CNPJ regular ou MEI) cadastrada dentro do portal. Atributos: razão social, nome fantasia, CNPJ, setor de atuação, descrição, endereço, telefone corporativo, status (ativa, inativa), flag "verificada" (booleana — true após a primeira vaga aprovada).
- **Vínculo Pessoa-responsável** — tabela associativa N:N entre Pessoa e Empresa, com atributos: data de início, data de fim (nula se ativo), tipo (sempre "responsável" no MVP — outros tipos podem ser introduzidos em V2 como "ponto de contato sem operar vagas", etc.).

**Regras estruturais:**

1. Toda Empresa tem ao menos um responsável ativo (data_fim nula). Sistema bloqueia remoção que deixaria empresa sem responsável (USP-014, AC-014-2).
2. Pessoa pode ter vínculo ativo com N empresas simultaneamente.
3. Empresa pode ter vínculo ativo com N pessoas simultaneamente.
4. Quem cadastra a Empresa vira automaticamente o responsável principal (USP-012, AC-012-1).
5. Adicionar nova Pessoa-responsável exige que ela já esteja cadastrada no portal (USP-013, AC-013-2) — sem fluxo de convite por e-mail no MVP.
6. Operações em nome da Empresa (publicar vaga, buscar candidatos, publicar serviço em nome da empresa) são feitas pela Pessoa-responsável logada, com rastreabilidade individual (log de auditoria identifica quem fez o quê).
7. Empresa sempre ativa no MVP — sem fluxo de inativação automática por inatividade (decidido em elicitação).
8. Editar CNPJ, razão social ou nome fantasia da Empresa rebaixa a flag "verificada" para false, exigindo nova validação manual na próxima vaga publicada (USP-015, AC-015-2).

## Alternativas Consideradas

**Alternativa A — Empresa com login próprio e usuários internos (descartada):** Empresa tem seu próprio cadastro com login (e-mail + senha) e pode ter múltiplos usuários internos com acesso. Por que não escolhida: complexidade extra de gestão de usuários da Empresa; perde rastreabilidade individual (quem é "a empresa"?); contradiz o modelo de Pessoa unificada (uma mesma pessoa poderia ter conta pessoal + conta empresa, confundindo identidades).

**Alternativa B — Empresa apenas como atributo da Pessoa-responsável (descartada):** sem entidade Empresa explícita; a Pessoa-responsável tem campos "razão social", "CNPJ" etc. Por que não escolhida: impossível N pessoas representarem a mesma empresa; impossível associar vagas/serviços à Empresa (ficam associadas à Pessoa); arquitetura confusa.

**Alternativa C — Empresa como entidade sem login, com vínculo N:N para Pessoas-responsáveis (escolhida):** modelo descrito acima.

**Alternativa D — Empresa como entidade com login compartilhado para os responsáveis (descartada):** Empresa tem um e-mail/senha que todos os responsáveis compartilham. Por que não escolhida: péssima prática de segurança (compartilhamento de senha); perde rastreabilidade.

## Consequências

**Positivas:**

- Rastreabilidade individual: log de auditoria identifica qual Pessoa fez cada operação em nome da Empresa.
- Flexibilidade: uma Pessoa representa N empresas; uma Empresa tem N representantes.
- Coerente com Pessoa unificada (ADR-0011): empresa-responsável é apenas mais um papel da Pessoa.
- Mudança de responsável de Empresa é simples (adiciona novo, remove antigo) sem reset de credenciais.

**Negativas / Trade-offs:**

- Sem login próprio da Empresa significa que a Empresa "não existe" se a última Pessoa-responsável for removida (mas regra obrigatória de ≥1 responsável mitiga).
- UX de "operar em nome de" pode confundir usuário no início — Pessoa logada precisa selecionar "publicar como eu" ou "publicar em nome de [Empresa X]" (USP-029, AC-029-1). Mitigação: dropdown claro e contextual; design da UX deve enfatizar essa escolha.
- Sem fluxo de convite por e-mail no MVP — Pessoa precisa estar pré-cadastrada (decisão registrada em USP-013). Convite por e-mail entra como candidato natural a V2.
- Adição de responsável depende de buscar Pessoa por CPF/e-mail — UX precisa ser cuidadosa para não revelar inadvertidamente se uma Pessoa específica está cadastrada (privacidade).

**Implicações em outras decisões:**

- USP-020 (Publicar vaga): vaga sempre tem uma Empresa associada; Pessoa-responsável é apenas o autor da operação.
- USP-029 (Publicar serviço): serviço pode ser PF (autor é Pessoa direto) ou em nome de Empresa (autor é Empresa, executor é a Pessoa-responsável que publicou).
- USP-019 (Validação manual de Empresa na primeira vaga): a flag "verificada" da Empresa é central nesse fluxo.

## Referências

- ADR-0011 (Pessoa como entidade fundamental).
- PRD MVP Portal, USP-012 a USP-015 (Cadastro e gestão de Empresa), USP-027 (Lista de candidatos da vaga), USP-029 (Publicar serviço).
- Protótipo HTML do Portal (cadastro de empresa).
