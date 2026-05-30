# ADR-0012: Beneficiário como papel social da Pessoa (revisão parcial do ADR-0002)

**Status:** Aceito — Aplicável ao Release 1 (MVP Portal Empregabilidade e Serviços)
**Data:** 2026-05-22
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** USP-001 a USP-002, USP-036 a USP-039
**Tags:** modelagem | dados | revisão de ADR | release 2

## Contexto

O ADR-0002 (PRD da Frente 4 v0.1) modelava Beneficiário e Família como entidades separadas com vínculo histórico temporal. Esse modelo refletia a realidade da operação social: cesta básica é entregue à família (representada pelo responsável); indicação de necessidade pode ser para beneficiário individual ou família; histórico temporal preserva a evolução dos vínculos.

Com a decisão da diretoria sobre Cenário 1 (identidade unificada plena — CHANGELOG v0.2), e a definição da Pessoa como entidade fundamental (ADR-0011), o conceito de "Beneficiário como entidade independente" deixou de fazer sentido. Pessoa unificada deve poder ser, simultaneamente, beneficiária social e candidata a uma vaga, sem que essas duas dimensões impliquem em entidades separadas no modelo.

Adicionalmente, no MVP do Portal, a entidade Família estruturada (com vínculos com tipo, datas, responsável único, etc.) NÃO entra — apenas a ficha socioeconômica simplificada com composição familiar declarada (USP-036). Família estruturada fica para o Release 2.

## Decisão

**Beneficiário deixa de ser entidade separada no modelo de dados.** Vira **papel social da Pessoa**, ativado pela assistente social quando a Pessoa entra em programa de atendimento da ASONSEG.

**No MVP do Portal (Release 1):**

- Pessoa pode ter papel "beneficiário social" ativo, atribuído pela AS.
- Ficha socioeconômica (renda aproximada, benefício social, situação de moradia, composição familiar declarada como texto/número) é vinculada à Pessoa, não a uma entidade Família.
- Não há entidade Família estruturada no MVP.
- Pessoa com papel beneficiário pode ser encaminhada para vaga (ver ADR-0016) e tratada normalmente em todos os outros fluxos do Portal.

**No Release 2 (Frente 4):**

- Entidade Família é introduzida, conforme descrito no ADR-0002.
- Vínculo Pessoa↔Família (com tipo de vínculo e histórico temporal — conforme ADR-0002) substitui o vínculo Beneficiário↔Família originalmente descrito no ADR-0002.
- Os 8 tipos de vínculo definidos no ADR-0002 (responsável, cônjuge, filho, filho em guarda compartilhada, enteado, idoso dependente, outro parente, agregado) e a regra de exclusividade (uma Pessoa só pode ser responsável de uma Família por vez, exceto guarda compartilhada) permanecem válidos.
- Histórico temporal (data início, data fim, tipo) permanece conforme ADR-0002.

## Alternativas Consideradas

**Alternativa A — Manter Beneficiário como entidade separada (descartada):** preservar integralmente ADR-0002 e ter duas entidades distintas (Pessoa para o Portal, Beneficiário para o Release 2). Por que não escolhida: contradiz Cenário 1 (identidade unificada plena); cria duplicidade quando uma Pessoa é cadastrada nos dois mundos; impossibilita visão consolidada; gera necessidade de "reconciliação" entre Pessoa do Portal e Beneficiário da Frente 4 — refactor caro.

**Alternativa B — Beneficiário como papel social da Pessoa (escolhida):** modelo descrito acima.

**Alternativa C — Família como entidade já no MVP (descartada):** trazer toda a entidade Família estruturada para o MVP do Portal, mesmo sem usar nas funcionalidades do Portal. Por que não escolhida: aumenta escopo do MVP sem benefício imediato; Família tem complexidade significativa (vínculos com tipo, exclusividades, histórico) que não justifica modelar antes do Release 2. Acordo com o cliente: ficha socioeconômica simplificada cobre o que o MVP precisa.

## Consequências

**Positivas:**

- Coerência com ADR-0011 (Pessoa como entidade fundamental).
- Refactor entre MVP e Release 2 minimizado — Release 2 chega para introduzir Família, não para refatorar Beneficiário.
- Visão consolidada (USP-039) abrange beneficiários sociais sem esforço extra.
- Encaminhamento (ADR-0016) opera sobre Pessoa, independente de ser beneficiária ou candidata-livre.

**Negativas / Trade-offs:**

- ADR-0002 fica parcialmente "obsoleto" — usuários do PRD precisam consultar tanto ADR-0002 (para Família e vínculos) quanto ADR-0012 (para o entendimento atualizado de Beneficiário). Mitigação: nota de reposicionamento no ADR-0002 explica essa relação.
- Conceito "beneficiário" passa a existir em dois níveis: papel da Pessoa (estrutural) e termo coloquial usado internamente. Sem impacto técnico, apenas conceitual.

**Implicações em outras decisões:**

- ADR-0002 recebe nota de reposicionamento (já aplicada na v0.2 do PRD da Frente 4).
- ADR-0011 referencia este ADR como parte da fundação compartilhada.
- USP-036 (ficha socioeconômica) modela campos da ficha vinculados à Pessoa, sem Família.

## Referências

- ADR-0002 (PRD Frente 4 — Beneficiário e família com vínculo histórico temporal).
- ADR-0011 (Pessoa como entidade fundamental).
- PRD MVP Portal, USP-036 (Ficha socioeconômica).
- CHANGELOG v0.2 — decisão Cenário 1.
