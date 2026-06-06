# Vagas Specification

## Problem Statement

Empresas parceiras da ASONSEG precisam divulgar oportunidades de trabalho para a comunidade atendida, e candidatos (anônimos ou autenticados) precisam descobrir e avaliar essas oportunidades. Sem um fluxo estruturado, vagas seriam publicadas sem controle de qualidade, ficariam visíveis após vencidas e exporiam dados de empresas indevidamente a visitantes anônimos. O Épico 5 (Vagas) resolve a publicação moderada, a busca pública filtrável, a visualização de detalhe com anonimização por papel do visitante, a gestão do ciclo de vida da vaga e a expiração automática por data de validade.

## Goals

- [ ] Permitir que a Pessoa-responsável de uma Empresa publique vagas com validade obrigatória, sujeitas a moderação.
- [ ] Permitir busca pública de vagas ativas com filtros combináveis e match textual case-insensitive sem acentos.
- [ ] Anonimizar o nome da Empresa para visitantes anônimos, exibindo apenas o setor.
- [ ] Exibir o detalhe completo da vaga com contador de candidaturas.
- [ ] Permitir que o responsável edite, pause, arquive e renove a validade da vaga.
- [ ] Expirar vagas automaticamente na data de validade (timezone América/São_Paulo) e avisar a Empresa 3 dias antes.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Busca semântica / Full-Text Search | Fora do MVP; busca usa match exato textual case-insensitive sem acentos. |
| Algoritmo de relevância / ranking | Ordenação é apenas por data de publicação (mais recente primeiro). |
| Candidatura a vaga | Pertence ao Épico 6 (USP-025+). |
| Internacionalização (i18n) | UI somente em PT-BR no MVP. |

## User Stories

### P1: Publicar vaga ⭐ MVP

**User Story**: Como Pessoa-responsável de uma Empresa, quero publicar uma vaga em nome da Empresa com título, área, descrição, requisitos, benefícios, salário, regime, local e validade, para que candidatos descubram e se candidatem.

**Why P1**: É a porta de entrada de todo o módulo de vagas; sem publicação não há conteúdo para buscar, ver ou candidatar. Marcada como Must no PRD (USP-020).

**Acceptance Criteria**:
1. QUANDO o responsável submete a vaga com todos os campos obrigatórios e data de validade preenchida, ENTÃO o sistema DEVE persistir com status "em moderação".
2. ENTÃO o sistema DEVE exigir data de validade obrigatória.
3. QUANDO a data de validade é anterior ou igual a hoje, ENTÃO o sistema DEVE bloquear o submit.
4. QUANDO o responsável solicita salvar como rascunho a qualquer momento, ENTÃO o sistema DEVE permitir o salvamento sem submissão à moderação.

**Independent Test**: Autenticar como Pessoa-responsável de uma Empresa, preencher o formulário com data de validade futura e submeter; verificar que a vaga foi persistida com status "em moderação"; repetir com data passada e verificar bloqueio; salvar rascunho sem submeter e verificar persistência.

### P1: Buscar vagas (pública) ⭐ MVP

**User Story**: Como qualquer pessoa (anônima ou autenticada), quero buscar vagas com filtros (área, escolaridade, tipo de contrato, regime, faixa de salário, região), para que eu encontre vagas que me interessem.

**Why P1**: É o principal ponto de descoberta de oportunidades para a comunidade. Must no PRD (USP-021).

**Acceptance Criteria**:
1. QUANDO o visitante acessa a lista de vagas, ENTÃO o sistema DEVE exibir apenas vagas com status "ativo" ordenadas por data de publicação (mais recente primeiro).
2. QUANDO o visitante aplica filtros, ENTÃO o sistema DEVE atualizar a lista respeitando todos os filtros simultaneamente.
3. QUANDO o visitante usa busca textual, ENTÃO o sistema DEVE aplicar match case-insensitive ignorando acentos sobre título, descrição e requisitos.
4. QUANDO a vaga é visualizada por visitante anônimo, ENTÃO o sistema DEVE anonimizar o nome da Empresa (exibindo apenas o setor).
5. QUANDO a vaga é visualizada por Pessoa autenticada, ENTÃO o sistema DEVE exibir o nome da Empresa.

**Independent Test**: Acessar a lista de vagas como anônimo e verificar que somente vagas "ativo" aparecem ordenadas por publicação decrescente e empresas anonimizadas (somente setor); aplicar dois filtros simultâneos e validar interseção; buscar termo com acento/maiúsculas e verificar match; autenticar e confirmar exibição do nome da Empresa.

### P1: Ver detalhe da vaga ⭐ MVP

**User Story**: Como qualquer pessoa (anônima ou autenticada), quero ver descrição completa, requisitos, benefícios e dados da empresa (quando autenticado) de uma vaga, para que eu decida se quero me candidatar.

**Why P1**: Necessário para o candidato avaliar a oportunidade antes de se candidatar. Must no PRD (USP-022).

**Acceptance Criteria**:
1. QUANDO o visitante anônimo abre o detalhe, ENTÃO o sistema DEVE exibir todos os dados da vaga e anonimizar a Empresa.
2. QUANDO a Pessoa autenticada com papel candidato abre o detalhe, ENTÃO o sistema DEVE exibir o nome da Empresa e o botão "candidatar-se".
3. ENTÃO o sistema DEVE exibir contador de candidaturas ("N pessoas se candidataram").

**Independent Test**: Abrir o detalhe de uma vaga ativa como anônimo e verificar dados completos com Empresa anonimizada; autenticar como candidato e verificar nome da Empresa, botão "candidatar-se" e contador "N pessoas se candidataram".

### P1: Editar vaga (pausar, arquivar, renovar) ⭐ MVP

**User Story**: Como Pessoa-responsável da Empresa, quero editar a vaga (volta a rascunho), pausá-la temporariamente, arquivá-la, ou renovar sua validade, para que a vaga reflita o momento do recrutamento.

**Why P1**: Gestão do ciclo de vida da vaga é essencial para manter o conteúdo fiel ao recrutamento. Must no PRD (USP-023).

**Acceptance Criteria**:
1. QUANDO o responsável edita uma vaga ativa, ENTÃO o sistema DEVE alterar o status para "rascunho" e exigir nova moderação antes de voltar a "ativo".
2. QUANDO o responsável pausa a vaga, ENTÃO o sistema DEVE alterar o status para "pausado" (oculta da busca, sem exigir nova moderação para reativar).
3. QUANDO o responsável arquiva a vaga, ENTÃO o sistema DEVE alterar o status para "arquivado".
4. QUANDO o responsável prorroga a validade e a vaga ainda está ativa, ENTÃO o sistema DEVE permitir nova data de validade futura sem exigir nova moderação.

**Independent Test**: Como responsável, editar uma vaga ativa e verificar que voltou a "rascunho" exigindo moderação; pausar e confirmar status "pausado" e ausência na busca; arquivar e confirmar "arquivado"; prorrogar validade de vaga ativa com data futura e confirmar que não exigiu nova moderação.

### P1: Expiração automática de vaga ⭐ MVP

**User Story**: Como sistema, quero alterar automaticamente o status da vaga para "expirado" na data de validade, para que vagas vencidas não fiquem visíveis para candidatos.

**Why P1**: Garante que vagas vencidas saiam de circulação sem ação manual, preservando a confiança na busca pública. Must no PRD (USP-024).

**Acceptance Criteria**:
1. QUANDO a data de validade é atingida (timezone América/São_Paulo), ENTÃO o sistema DEVE alterar o status da vaga para "expirado" automaticamente.
2. ENTÃO o sistema DEVE ocultar vagas expiradas da busca pública.
3. QUANDO faltam 3 dias para a expiração, ENTÃO o sistema DEVE enviar e-mail à Empresa-responsável avisando.

**Independent Test**: Configurar uma vaga ativa com validade no dia corrente (América/São_Paulo), executar a rotina de expiração e verificar status "expirado" e ausência na busca pública; configurar vaga com validade em 3 dias e verificar disparo do e-mail de aviso à Empresa-responsável.

## Edge Cases

- QUANDO a data de validade enviada é igual a hoje ENTÃO o sistema DEVE bloquear o submit (apenas datas futuras são válidas).
- QUANDO o visitante aplica busca textual com acentos e/ou letras maiúsculas ENTÃO o sistema DEVE encontrar vagas equivalentes sem acentos e em qualquer caixa.
- QUANDO uma vaga está "pausado" ENTÃO o sistema DEVE ocultá-la da busca pública sem exigir nova moderação para reativá-la.
- QUANDO uma vaga ativa é editada ENTÃO o sistema DEVE retorná-la a "rascunho", removendo-a da busca até nova moderação.
- QUANDO uma vaga atinge a data de validade em "pausado" ou estado já não ativo ENTÃO o sistema DEVE seguir a regra de expiração mantendo a vaga fora da busca pública.
- QUANDO a Empresa tem o salário marcado como não visível (salaryVisible=false) ENTÃO o sistema DEVE omitir o salário na busca e no detalhe.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| VAG-01 | USP-020 | Design | Pending |
| VAG-02 | USP-021 | Design | Pending |
| VAG-03 | USP-022 | Design | Pending |
| VAG-04 | USP-023 | Design | Pending |
| VAG-05 | USP-024 | Design | Pending |

## Success Criteria

- [ ] Vagas só ficam visíveis publicamente após moderação e enquanto status="ativo" e dentro da validade.
- [ ] Data de validade é obrigatória e sempre futura no momento do submit.
- [ ] Busca aplica todos os filtros simultaneamente e match textual case-insensitive sem acentos sobre título, descrição e requisitos, ordenado por publicação decrescente.
- [ ] Empresa anonimizada (apenas setor) para anônimos; nome exibido para autenticados.
- [ ] Detalhe exibe contador de candidaturas e botão "candidatar-se" para candidato autenticado.
- [ ] Ciclo de vida (rascunho, em moderação, ativo, pausado, arquivado, expirado) respeita as regras de transição e de re-moderação.
- [ ] Vagas expiram automaticamente na validade (América/São_Paulo) e e-mail de aviso é enviado 3 dias antes.
