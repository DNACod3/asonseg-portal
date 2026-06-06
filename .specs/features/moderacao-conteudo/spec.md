# Moderação de Conteúdo Specification

## Problem Statement

O portal ASONSEG publica três tipos de conteúdo gerado por usuários — vagas (publicadas por Empresas/Pessoas), CVs (Pessoas candidatas) e serviços (prestadores). Sem uma etapa de revisão humana, conteúdo incompleto, fraudulento ou inadequado pode ficar visível ao público, expondo candidatos a empresas-fantasma e comprometendo a reputação da ONG.

O Épico 4 estabelece o fluxo de moderação operado pelo **coordenador da área Portal Empregabilidade (ou voluntário delegado)**: revisão de rascunhos antes da publicação, validação manual da Empresa na primeira vaga, inativação de conteúdo já publicado quando um problema é descoberto após a publicação, e enfileiramento de sugestões de novas categorias/áreas para aprovação da diretoria. Todas as transições de estado devem passar pela máquina de estados (`transitionContent`), nunca por atualização direta de status.

## Goals

- [ ] Permitir que o coordenador modere rascunhos de vaga, CV e serviço (aprovar / devolver para ajustes / rejeitar) com justificativa registrada (USP-016).
- [ ] Garantir validação manual obrigatória dos dados da Empresa durante a moderação da sua primeira vaga publicada (USP-017).
- [ ] Permitir inativar conteúdo já ativo com motivo obrigatório, disparando revalidação imediata do cache público (USP-018).
- [ ] Permitir que usuários sugiram nova categoria de serviço ou área de vaga, enfileirando a sugestão para aprovação da diretoria (USP-019).
- [ ] Assegurar que todas as mudanças de status ocorram exclusivamente via `transitionContent`, com transições validadas, justificativa quando exigida, transação com auditoria e e-mail ao autor.

## Out of Scope

| Feature | Reason |
|---|---|
| Fluxo formal de denúncia de conteúdo | Não previsto no MVP; coordenador age sob alerta externo via e-mail institucional (RP-010). USP-018 substitui parcialmente. |
| SLA formal de moderação | Sem SLA no MVP; coordenador processa a fila conforme capacidade (Notas USP-016, ADR-0015). MP10 é apenas métrica de acompanhamento. |
| Moderação automatizada por IA | Apenas revisão humana no MVP. |
| Filtros/triagem automática anti-spam na fila | Fila ordenada por data de envio, sem priorização automática. |
| Revalidação de Empresa em vagas subsequentes | Vagas seguintes da mesma Empresa não revalidam a Empresa, só o conteúdo (Notas USP-017). |

## User Stories

### P1: Moderar rascunho (vaga, CV ou serviço) ⭐ MVP

**User Story**: Como coordenador da área Portal Empregabilidade (ou voluntário delegado), quero revisar rascunhos de vaga, CV e serviço e aprovar, devolver para ajustes ou rejeitar para que apenas conteúdo verificado fique visível no portal.

**Why P1**: É a porta de entrada de qualidade de todo conteúdo público do portal; sem ela, conteúdo não verificado fica visível. Classificada como Must no PRD.

**Acceptance Criteria**:
1. QUANDO o coordenador acessa a fila de moderação ENTÃO o sistema DEVE listar rascunhos com status "em moderação" (`IN_MODERATION`) ordenados por data de envio.
2. QUANDO o coordenador aprova um rascunho ENTÃO o sistema DEVE transicionar o status para "ativo" (`ACTIVE`) via `transitionContent` e enviar e-mail ao autor.
3. QUANDO o coordenador devolve para ajustes ENTÃO o sistema DEVE exigir motivo textual obrigatório, transicionar o status para "aguardando ajustes" (`AWAITING_ADJUSTMENTS`) via `transitionContent` e enviar e-mail ao autor com o motivo.
4. QUANDO o coordenador rejeita definitivamente ENTÃO o sistema DEVE exigir motivo textual, transicionar o status para "rejeitado" (`REJECTED`) via `transitionContent` e enviar e-mail ao autor.
5. QUANDO uma decisão de moderação é tomada ENTÃO o sistema DEVE registrar log de auditoria da decisão (autor, momento, motivo) na mesma transação.
6. QUANDO uma transição é solicitada ENTÃO o sistema DEVE validar a transição contra a máquina de estados (`transitionContent`), nunca atualizando o status diretamente via Prisma.

**Independent Test**: Submeter um rascunho de cada tipo (vaga, CV, serviço) para moderação, abrir a fila ordenada por data, e exercitar os três desfechos (aprovar, devolver com motivo, rejeitar com motivo), verificando status resultante, e-mail ao autor e log de auditoria.

### P1: Validar Empresa na primeira vaga publicada ⭐ MVP

**User Story**: Como coordenador (ou voluntário delegado), quero verificar dados da Empresa (CNPJ, razão social, endereço) durante a moderação da primeira vaga dela para que eu evite empresas-fantasma ou fraudulentas no portal.

**Why P1**: Evita fraude e empresas-fantasma no portal, protegendo candidatos. Classificada como Must no PRD.

**Acceptance Criteria**:
1. QUANDO o coordenador modera uma vaga cuja Empresa está marcada como "não verificada" ENTÃO o sistema DEVE exibir os dados da Empresa (CNPJ, razão social, endereço) em destaque com solicitação explícita de verificação manual.
2. QUANDO o coordenador aprova a vaga (e portanto a Empresa) ENTÃO o sistema DEVE marcar a Empresa como "verificada" e registrar log com responsável e data, na mesma operação que ativa a vaga.
3. QUANDO o coordenador identifica inconsistência nos dados da Empresa ENTÃO o sistema DEVE permitir rejeitar a vaga com motivo, mantendo a Empresa como "não verificada".
4. QUANDO o coordenador modera uma vaga subsequente de uma Empresa já verificada ENTÃO o sistema DEVE moderar apenas o conteúdo da vaga, sem exigir nova verificação da Empresa.

**Independent Test**: Submeter a primeira vaga de uma Empresa "não verificada", confirmar que a tela de moderação destaca os dados da Empresa; aprovar e verificar que a Empresa fica "verificada" com log; em seguida submeter uma segunda vaga e confirmar que a verificação da Empresa não é solicitada novamente.

### P1: Inativar conteúdo já publicado ⭐ MVP

**User Story**: Como coordenador (ou voluntário delegado), quero inativar uma vaga, CV ou serviço que já está ativo para que eu responda a problemas descobertos após a publicação, mesmo sem fluxo formal de denúncia.

**Why P1**: É o único mecanismo de resposta a conteúdo problemático no MVP (substitui o fluxo de denúncia ausente). Classificada como Must no PRD.

**Acceptance Criteria**:
1. QUANDO o coordenador inativa conteúdo já ativo (`ACTIVE`) ENTÃO o sistema DEVE exigir motivo textual obrigatório, transicionar o status via `transitionContent` e enviar e-mail ao autor com o motivo.
2. QUANDO o conteúdo é inativado ENTÃO o sistema DEVE registrar log de auditoria da operação na mesma transação.
3. QUANDO a transição de inativação é concluída ENTÃO o sistema DEVE disparar revalidação imediata do cache público (`revalidatePath`/`revalidateTag`) para remover o conteúdo das listagens e páginas ISR.

**Independent Test**: Inativar um conteúdo `ACTIVE`, verificar que o motivo é obrigatório, que o status muda via máquina de estados, que o e-mail é enviado ao autor, que o log é gravado e que a página pública correspondente deixa de exibir o conteúdo imediatamente após a revalidação.

### P2: Sugerir nova categoria de serviço ou área de vaga

**User Story**: Como Pessoa autenticada (publicando vaga ou serviço), quero sugerir uma nova categoria ou área quando nenhuma existente serve para que meu conteúdo possa ser categorizado corretamente.

**Why P2**: Classificada como Should no PRD; melhora a categorização mas o catálogo padronizado já cobre os casos iniciais. Não bloqueia a publicação no MVP.

**Acceptance Criteria**:
1. QUANDO o usuário escolhe "Outro / sugerir nova" no campo de categoria/área ENTÃO o sistema DEVE permitir digitar a sugestão como texto livre.
2. QUANDO o conteúdo é submetido para moderação ENTÃO o sistema DEVE enfileirar a sugestão (registro de `JobArea`/`ServiceCategory` com `isSuggestion = true`) para a diretoria aprovar ou rejeitar.
3. QUANDO a diretoria aprova uma sugestão ENTÃO o sistema DEVE adicionar a categoria/área ao catálogo padronizado (`isSuggestion = false`).

**Independent Test**: Publicar uma vaga e um serviço escolhendo "Outro / sugerir nova" com texto livre, confirmar que a sugestão é criada com `isSuggestion = true` e fica pendente; aprovar como diretoria e verificar que passa a integrar o catálogo padronizado disponível para seleção.

## Edge Cases

- QUANDO o coordenador tenta aprovar/devolver/rejeitar um rascunho que não está em `IN_MODERATION` (ex.: já decidido por outro moderador) ENTÃO o sistema DEVE rejeitar a transição inválida via `transitionContent` e informar o estado atual.
- QUANDO o coordenador devolve para ajustes, rejeita ou inativa sem informar o motivo textual ENTÃO o sistema DEVE bloquear a operação e exigir a justificativa.
- QUANDO o coordenador tenta inativar um conteúdo que não está `ACTIVE` ENTÃO o sistema DEVE rejeitar a transição como inválida na máquina de estados.
- QUANDO dois moderadores agem sobre o mesmo item simultaneamente ENTÃO o sistema DEVE garantir que apenas uma transição seja aplicada (transação) e a outra falhe com transição inválida.
- QUANDO a vaga em moderação pertence a uma Empresa não verificada e o coordenador aprova sem revisar os dados destacados ENTÃO o sistema DEVE ainda marcar a Empresa como verificada e registrar o responsável (a verificação é parte do ato de aprovar).
- QUANDO o usuário sugere uma categoria/área cujo texto coincide com uma já existente no catálogo ENTÃO a diretoria pode rejeitar a sugestão duplicada durante a aprovação (decisão humana).
- QUANDO o envio de e-mail ao autor falha ENTÃO o sistema DEVE preservar a transição de status já efetivada e o log de auditoria (a notificação não bloqueia a decisão de moderação).

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| MOD-01 | USP-016 | Design | Pending |
| MOD-02 | USP-017 | Design | Pending |
| MOD-03 | USP-018 | Design | Pending |
| MOD-04 | USP-019 | Design | Pending |

## Success Criteria

- [ ] Coordenador consegue aprovar, devolver para ajustes e rejeitar rascunhos de vaga, CV e serviço, sempre via `transitionContent` e com justificativa obrigatória nos casos de devolução/rejeição (USP-016).
- [ ] Toda decisão de moderação gera e-mail ao autor e log de auditoria na mesma transação.
- [ ] A primeira vaga de uma Empresa não verificada exibe os dados da Empresa em destaque; a aprovação marca a Empresa como verificada com responsável e data; vagas subsequentes não revalidam a Empresa (USP-017).
- [ ] Inativação de conteúdo ativo exige motivo, transiciona via máquina de estados e dispara revalidação imediata do cache público, removendo o item das listagens ISR (USP-018).
- [ ] Sugestões de categoria/área são criadas com `isSuggestion = true`, enfileiradas para a diretoria e incorporadas ao catálogo padronizado quando aprovadas (USP-019).
- [ ] Nenhuma mudança de status de conteúdo ocorre por atualização direta no Prisma — todas passam por `transitionContent`.
- [ ] **MP10 — Tempo médio de moderação (envio → decisão do coordenador) é monitorado, com meta proposta de < 72h** (a confirmar com o sponsor; sem SLA formal no MVP, apenas acompanhamento).
