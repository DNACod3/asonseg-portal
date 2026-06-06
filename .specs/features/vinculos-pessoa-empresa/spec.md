# Gestão de Vínculos Pessoa-Empresa Specification

## Problem Statement

No portal ASONSEG, uma Empresa não possui login próprio: ela é operada por uma ou mais Pessoas-responsáveis através de um vínculo N:N (`PersonCompanyGrant` do tipo `RESPONSIBLE`). Após o cadastro inicial da Empresa (USP-012), surge a necessidade de gerenciar quem pode operar vagas e serviços em nome dela e de manter os dados cadastrais atualizados.

Atualmente não existe forma de:
- adicionar outra Pessoa já cadastrada como responsável adicional de uma Empresa;
- remover um vínculo de responsável (próprio ou de terceiro) sem deixar a Empresa órfã de responsáveis;
- editar os dados cadastrais da Empresa, garantindo que alterações sensíveis (CNPJ, razão social, nome fantasia) reabram a verificação manual.

Esta feature (Épico 3) cobre a gestão completa desses vínculos e da edição da Empresa, preservando histórico para auditoria e respeitando a regra de que toda Empresa precisa ter ao menos uma Pessoa-responsável ativa.

## Goals

- [ ] Permitir que uma Pessoa-responsável adicione outra Pessoa **já cadastrada** como responsável adicional de uma Empresa, buscando-a por CPF ou e-mail.
- [ ] Permitir que uma Pessoa-responsável remova um vínculo de responsável (próprio ou de terceiro), preservando o histórico de vínculos encerrados.
- [ ] Garantir que toda Empresa mantenha ao menos uma Pessoa-responsável ativa em qualquer operação.
- [ ] Permitir que uma Pessoa-responsável edite os dados cadastrais da Empresa.
- [ ] Rebaixar automaticamente a flag "verificada" da Empresa quando CNPJ, razão social ou nome fantasia forem alterados.
- [ ] Notificar por e-mail a Pessoa adicionada e a Pessoa removida.

## Out of Scope

| Feature | Reason |
| Convite por e-mail para adicionar responsável de Empresa | Pessoa deve estar pré-cadastrada no portal; convite por e-mail vira candidato a V2. |
| Login próprio da Empresa | Empresa não tem login; é operada apenas por Pessoas-responsáveis vinculadas. |
| Cadastro inicial da Empresa e criação do vínculo automático | Coberto por USP-012 (Épico 2). |
| Marcar Empresa como "verificada" | A verificação positiva ocorre na moderação da vaga (USP-017); aqui só ocorre o rebaixamento. |
| Vínculos do tipo `FAMILY_RESPONSIBLE` e outros papéis de Empresa | Apenas `RESPONSIBLE` no MVP (Release 2). |

## User Stories

### P1: Adicionar responsável a uma Empresa ⭐ MVP

**User Story**: Como Pessoa-responsável de uma Empresa, quero adicionar outra Pessoa (já cadastrada no portal) como responsável adicional dessa Empresa, para que mais pessoas possam operar vagas e serviços em nome da Empresa.

**Why P1**: Prioridade "Must" no PRD. Sem ela, a Empresa fica dependente de um único responsável, criando ponto único de falha operacional e bloqueando a regra de inativação de Pessoa (USP-007) que exige redesignação.

**Acceptance Criteria**:
1. QUANDO o responsável atual busca uma Pessoa por CPF ou e-mail e a adiciona como responsável ENTÃO o sistema DEVE criar vínculo Pessoa↔Empresa com tipo "responsável" (`PersonCompanyGrant` tipo `RESPONSIBLE`).
2. QUANDO a Pessoa buscada não está cadastrada no portal ENTÃO o sistema DEVE bloquear a operação e orientar que essa Pessoa precisa fazer o auto-cadastro antes.
3. QUANDO o vínculo é criado ENTÃO o sistema DEVE enviar e-mail à nova Pessoa-responsável informando o vínculo.

**Independent Test**: Autenticada como responsável de uma Empresa existente, buscar uma segunda Pessoa pré-cadastrada por CPF, adicioná-la e verificar que o vínculo ativo foi criado e que o e-mail de notificação foi disparado; repetir buscando um CPF inexistente e confirmar o bloqueio com orientação de auto-cadastro.

### P1: Remover responsável de uma Empresa ⭐ MVP

**User Story**: Como Pessoa-responsável de uma Empresa, quero remover meu próprio vínculo ou de outro responsável da Empresa, para que a gestão da Empresa reflita as pessoas realmente envolvidas.

**Why P1**: Prioridade "Must" no PRD. Necessária para manter a lista de responsáveis fiel à realidade e para suportar a saída de pessoas, sem violar a invariante de ao menos um responsável ativo.

**Acceptance Criteria**:
1. QUANDO o responsável solicita remoção de um vínculo ENTÃO o sistema DEVE persistir a remoção (encerrar o vínculo, preenchendo `endedAt`) e enviar e-mail à Pessoa removida.
2. QUANDO a remoção deixaria a Empresa sem nenhum responsável ativo ENTÃO o sistema DEVE bloquear a operação e exigir designação de outro responsável antes.
3. QUANDO um vínculo é removido ENTÃO o sistema DEVE preservar o histórico de vínculos passados para auditoria.

**Independent Test**: Em uma Empresa com dois responsáveis ativos, remover um deles e verificar que o vínculo passa a ter `endedAt` preenchido, que o e-mail é enviado e que o registro histórico permanece consultável; em seguida, tentar remover o último responsável restante e confirmar o bloqueio.

### P1: Editar dados da Empresa ⭐ MVP

**User Story**: Como Pessoa-responsável, quero editar dados cadastrais da Empresa (descrição, endereço, contato, etc.), para que as informações fiquem atualizadas.

**Why P1**: Prioridade "Must" no PRD. Mantém os dados institucionais corretos e garante a integridade da verificação ao reabri-la quando dados de identidade jurídica mudam.

**Acceptance Criteria**:
1. QUANDO o responsável submete a edição ENTÃO o sistema DEVE persistir as alterações.
2. QUANDO a edição alterar CNPJ, razão social ou nome fantasia ENTÃO o sistema DEVE marcar a Empresa como "não verificada" novamente (`isVerified = false`), exigindo nova validação manual na próxima vaga publicada.

**Independent Test**: Editar apenas a descrição/endereço de uma Empresa verificada e confirmar que `isVerified` permanece `true`; depois editar o nome fantasia da mesma Empresa e confirmar que `isVerified` passa a `false`.

## Edge Cases

- QUANDO a Pessoa buscada para adicionar já é responsável ativa da mesma Empresa ENTÃO o sistema DEVE bloquear a duplicidade e informar que o vínculo já existe.
- QUANDO o responsável tenta adicionar uma Pessoa buscando por um CPF/e-mail que não corresponde a Pessoa cadastrada ENTÃO o sistema DEVE bloquear e orientar o auto-cadastro (não disparar convite).
- QUANDO o responsável remove o seu próprio vínculo e ainda existe outro responsável ativo ENTÃO o sistema DEVE permitir a remoção e o ator perde o acesso de gestão àquela Empresa.
- QUANDO a Pessoa-responsável a ser removida é a única ativa da Empresa ENTÃO o sistema DEVE bloquear e exigir a designação de outro responsável antes da remoção.
- QUANDO a edição não altera CNPJ, razão social nem nome fantasia ENTÃO o sistema DEVE persistir as alterações e manter a flag "verificada" inalterada.
- QUANDO o e-mail de notificação (adição/remoção) falha no envio ENTÃO o sistema DEVE persistir o vínculo/remoção e registrar a falha sem reverter a operação de gestão.
- QUANDO uma Pessoa que não é responsável da Empresa tenta adicionar/remover responsável ou editar a Empresa ENTÃO o sistema DEVE negar a operação por falta de permissão.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| VPE-01 | USP-013 | Design | Pending |
| VPE-02 | USP-013 | Design | Pending |
| VPE-03 | USP-013 | Design | Pending |
| VPE-04 | USP-014 | Design | Pending |
| VPE-05 | USP-014 | Design | Pending |
| VPE-06 | USP-014 | Design | Pending |
| VPE-07 | USP-015 | Design | Pending |
| VPE-08 | USP-015 | Design | Pending |

## Success Criteria

- [ ] Pessoa-responsável consegue adicionar outra Pessoa pré-cadastrada como responsável, com vínculo `RESPONSIBLE` ativo criado e e-mail enviado.
- [ ] Tentativa de adicionar Pessoa não cadastrada é bloqueada com orientação de auto-cadastro (sem convite por e-mail).
- [ ] Pessoa-responsável consegue remover um vínculo, com `endedAt` preenchido, e-mail à removida e histórico preservado.
- [ ] Remoção que deixaria a Empresa sem responsável ativo é bloqueada.
- [ ] Edição de dados não-sensíveis é persistida sem alterar `isVerified`.
- [ ] Edição de CNPJ, razão social ou nome fantasia rebaixa `isVerified` para `false`.
- [ ] Todas as operações sensíveis registram auditoria e respeitam verificação de permissão da Pessoa-responsável.
