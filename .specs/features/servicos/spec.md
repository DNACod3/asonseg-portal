# Serviços Specification

## Problem Statement

Prestadores de serviço — pessoas físicas (PF) ou empresas representadas por uma Pessoa-responsável — precisam de um canal confiável para anunciar serviços, e a comunidade atendida pela ASONSEG precisa encontrar e avaliar essas ofertas para contratá-las. Hoje não existe um espaço estruturado, moderado e respeitoso à privacidade onde serviços possam ser publicados, descobertos por filtros e detalhados antes do contato. A ASONSEG atua exclusivamente como plataforma de conexão: não presta, não intermedia financeiramente e não garante a execução dos serviços anunciados, sendo necessário deixar essa isenção de responsabilidade explícita aos usuários.

## Goals

- [ ] Permitir que prestadores publiquem serviços como PF ou em nome de uma Empresa que representam, com submissão à moderação.
- [ ] Garantir que todo serviço publicado passe pelo fluxo de moderação antes de ficar visível publicamente.
- [ ] Oferecer busca pública de serviços com filtros (categoria, faixa de preço, região, disponibilidade) e busca textual sem acentos.
- [ ] Exibir página de detalhe completa do serviço, ocultando contato do prestador até manifestação de interesse autenticada.
- [ ] Permitir ao prestador gerenciar o ciclo de vida do serviço (editar/voltar a rascunho, pausar, arquivar).
- [ ] Apresentar termo de isenção de responsabilidade da ASONSEG nas telas de busca e detalhe.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Avaliações, notas e reputação (estrelas) | Apesar do protótipo exibir estrelas, sistema de avaliação está fora do MVP. |
| Manifestação de interesse e exibição de contato | Coberto pelo Épico 8 (USP-033), spec separada. |
| Pagamento ou intermediação financeira | ASONSEG é apenas plataforma de conexão; não há transação na plataforma. |
| Validade automática / expiração de serviço | Serviço fica ativo até o prestador pausar ou arquivar. |
| Internacionalização (i18n) | Apenas PT-BR no MVP. |
| Mensageria entre cliente e prestador | Contato ocorre fora da plataforma após manifestação de interesse. |

## User Stories

### P1: Publicar serviço ⭐ MVP

**User Story**: Como Pessoa com papel prestador de serviço OU Pessoa-responsável de uma Empresa, quero publicar um serviço em meu nome (PF) ou em nome de uma Empresa que represento, para que clientes descubram e contratem.

**Why P1**: É a porta de entrada de oferta da plataforma; sem publicação de serviços não há catálogo a ser buscado nem contratado. Marcado como Must no PRD.

**Acceptance Criteria**:
1. QUANDO o usuário inicia o cadastro de serviço ENTÃO o sistema DEVE exigir a escolha entre "publicar como PF" ou "publicar em nome de [Empresa X]", listando as empresas que a Pessoa representa.
2. QUANDO o serviço é submetido ENTÃO o sistema DEVE persistir o serviço com status "em moderação".
3. QUANDO o serviço é cadastrado ENTÃO o sistema DEVE exigir título, categoria, descrição, valor, unidade (por hora/diária/serviço/etc.), região(ões) de atendimento e disponibilidade (dias e horários).
4. QUANDO o usuário anexa fotos ENTÃO o sistema DEVE permitir até 3 fotos do trabalho (JPG/PNG/WEBP até 5MB cada) opcionalmente.

**Independent Test**: Autenticar como prestador, escolher "publicar como PF", preencher todos os campos obrigatórios, anexar 2 fotos válidas, submeter e verificar que o serviço foi persistido com status "em moderação" e que a publicação não fica visível na busca pública até aprovação.

### P1: Buscar serviços (pública) ⭐ MVP

**User Story**: Como qualquer pessoa (anônima ou autenticada), quero buscar serviços com filtros (categoria, faixa de preço, região, disponibilidade), para que eu encontre serviços que precisar.

**Why P1**: É o principal mecanismo de descoberta de oferta para a comunidade; essencial para o valor do portal. Marcado como Must no PRD.

**Acceptance Criteria**:
1. QUANDO o visitante acessa a lista de serviços ENTÃO o sistema DEVE exibir apenas serviços com status "ativo", ordenados por data de publicação.
2. QUANDO o visitante aplica filtros (categoria, faixa de preço, região, disponibilidade) ENTÃO o sistema DEVE atualizar a lista respeitando os filtros.
3. QUANDO o visitante realiza busca textual ENTÃO o sistema DEVE aplicar busca case-insensitive e sem acentos sobre título, descrição e categoria.
4. QUANDO a lista de serviços é exibida ENTÃO o sistema DEVE apresentar o termo de isenção de responsabilidade da ASONSEG, esclarecendo que a ASONSEG é apenas plataforma de conexão.

**Independent Test**: Como visitante anônimo, abrir a lista de serviços, confirmar que somente serviços "ativos" aparecem ordenados por data; aplicar filtro de categoria e região e confirmar atualização; buscar termo com acento (ex.: "jardinagem") e confirmar correspondência sem acentuação; verificar exibição do aviso de isenção.

### P1: Ver detalhe do serviço ⭐ MVP

**User Story**: Como qualquer pessoa, quero ver descrição completa, fotos, valor, região e nome do prestador (ou Empresa), para que eu decida se quero contratar.

**Why P1**: Necessário para a tomada de decisão antes da manifestação de interesse; complementa a busca. Marcado como Must no PRD.

**Acceptance Criteria**:
1. QUANDO o visitante (anônimo ou autenticado) abre o detalhe ENTÃO o sistema DEVE exibir nome do prestador/Empresa, categorias, descrição, fotos, valor, região e disponibilidade.
2. QUANDO o detalhe é exibido ENTÃO o sistema DEVE ocultar telefone e e-mail do prestador até manifestação de interesse autenticada.
3. QUANDO a Pessoa autenticada manifesta interesse ENTÃO o sistema DEVE exibir o contato do prestador (conforme USP-033).
4. QUANDO o detalhe do serviço é exibido ENTÃO o sistema DEVE apresentar o termo de isenção de responsabilidade da ASONSEG.

**Independent Test**: Abrir o detalhe de um serviço ativo como anônimo e confirmar que nome/categorias/descrição/fotos/valor/região/disponibilidade aparecem, mas telefone e e-mail estão ocultos; confirmar exibição do aviso de isenção da ASONSEG.

### P1: Editar serviço (pausar, arquivar) ⭐ MVP

**User Story**: Como prestador de serviço (PF ou via Empresa), quero editar (volta a rascunho), pausar ou arquivar o meu serviço, para que o serviço reflita meu momento atual.

**Why P1**: Dá controle de ciclo de vida ao prestador e mantém o catálogo atualizado e confiável. Marcado como Must no PRD.

**Acceptance Criteria**:
1. QUANDO o prestador edita um serviço ativo ENTÃO o sistema DEVE alterar o status para "rascunho" e exigir nova moderação.
2. QUANDO o prestador pausa o serviço ENTÃO o sistema DEVE alterar o status para "pausado".
3. QUANDO o prestador arquiva o serviço ENTÃO o sistema DEVE alterar o status para "arquivado".
4. QUANDO um serviço está ativo ENTÃO o sistema DEVE mantê-lo ativo sem validade automática, até que o prestador pause ou arquive.

**Independent Test**: Como prestador dono de um serviço ativo, editar o serviço e confirmar que o status muda para "rascunho" e que ele volta à moderação; em outro serviço ativo, pausar e confirmar status "pausado"; arquivar e confirmar status "arquivado"; confirmar que serviços pausados/arquivados não aparecem na busca pública.

## Edge Cases

- QUANDO uma Pessoa-responsável tenta publicar em nome de uma Empresa que não representa ENTÃO o sistema DEVE negar a operação por permissão.
- QUANDO o cadastro é submetido sem título, categoria, descrição, valor, unidade, região ou disponibilidade ENTÃO o sistema DEVE rejeitar a submissão com validação dos campos obrigatórios.
- QUANDO o usuário anexa mais de 3 fotos ou arquivos fora de JPG/PNG/WEBP ou acima de 5MB ENTÃO o sistema DEVE rejeitar o upload.
- QUANDO um visitante busca um termo com acentos ENTÃO o sistema DEVE normalizar e encontrar correspondências sem acentos.
- QUANDO um visitante tenta abrir o detalhe de um serviço que não está ativo (rascunho/em moderação/pausado/arquivado) ENTÃO o sistema DEVE não expô-lo publicamente.
- QUANDO um visitante anônimo tenta ver o contato do prestador ENTÃO o sistema DEVE manter telefone e e-mail ocultos.
- QUANDO um prestador tenta editar/pausar/arquivar um serviço que não é seu ENTÃO o sistema DEVE negar a operação por permissão.
- QUANDO a busca não retorna resultados para os filtros aplicados ENTÃO o sistema DEVE exibir estado vazio sem erro.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SVC-01 | USP-029 | Design | Pending |
| SVC-02 | USP-030 | Design | Pending |
| SVC-03 | USP-031 | Design | Pending |
| SVC-04 | USP-032 | Design | Pending |

## Success Criteria

- [ ] Prestador consegue publicar serviço como PF ou em nome de Empresa que representa, com status inicial "em moderação".
- [ ] Todos os campos obrigatórios e regras de upload de fotos (até 3, JPG/PNG/WEBP, 5MB) são validados.
- [ ] Busca pública lista apenas serviços "ativos", aplica filtros e busca textual sem acentos.
- [ ] Detalhe exibe dados do serviço e prestador/Empresa, ocultando contato até manifestação de interesse autenticada.
- [ ] Prestador altera ciclo de vida (rascunho→moderação, pausado, arquivado) somente em seus próprios serviços.
- [ ] Termo de isenção de responsabilidade da ASONSEG é exibido nas telas de busca e detalhe.
