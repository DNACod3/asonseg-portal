# Gestão de Vínculos Pessoa-Empresa Specification

## Problem Statement

No portal ASONSEG, uma Empresa não possui login próprio: ela é operada por uma ou mais Pessoas-responsáveis através de um vínculo N:N (`PersonCompanyGrant` do tipo `RESPONSIBLE`). Após o cadastro inicial da Empresa (USP-012), surge a necessidade de gerenciar quem pode operar vagas e serviços em nome dela e de manter os dados cadastrais atualizados.

Atualmente não existe forma de:
- adicionar outra Pessoa já cadastrada como responsável adicional de uma Empresa;
- remover um vínculo de responsável (próprio ou de terceiro) sem deixar a Empresa órfã de responsáveis;
- editar os dados cadastrais da Empresa, garantindo que alterações sensíveis (CNPJ, razão social, nome fantasia) reabram a verificação manual.

Esta feature (Épico 3) cobre a gestão completa desses vínculos e da edição da Empresa, preservando histórico para auditoria e respeitando a regra de que toda Empresa precisa ter ao menos uma Pessoa-responsável ativa.

## Goals

- [ ] Permitir que uma Pessoa-responsável adicione outra Pessoa **já cadastrada** como responsável adicional de uma Empresa, buscando-a por CPF ou e-mail (vínculo nasce **pendente** até aceite explícito da Pessoa adicionada).
- [ ] Permitir que a Pessoa adicionada **aceite** o vínculo pendente, ativando o papel `COMPANY_RESPONSIBLE` e capturando o consentimento da finalidade 5 na mesma transação.
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

> **Modelo de vínculo (reconciliado com o ICE — fonte da verdade):** o vínculo nasce **pendente de aceite** e só vira **ativo** quando a Pessoa adicionada confirma explicitamente (intent F2 / expectations P-002 / TD §4.4 `aceitarVinculoResponsavel`). A busca por CPF/e-mail retorna resposta **binária sem PII** (P-001) e é restrita a responsável ativo (P-005), com rate limit anti-enumeração (L-002/ADR-0029). Os AC abaixo substituem a redação original "criação imediata" do PRD.

**Acceptance Criteria** (chaveados aos IDs ICE):
1. **(E-001 / P-001 / P-005 / L-002)** QUANDO uma Pessoa-responsável **ativa** de uma Empresa busca uma Pessoa por CPF ou e-mail ENTÃO o sistema DEVE retornar resposta **binária** ("encontrada / não encontrada") **sem expor nome, foto ou qualquer PII** antes da confirmação, negar a busca a quem não é responsável ativo da Empresa, e aplicar rate limit por identidade/rota (anti-enumeração de CPF).
2. **(E-001)** QUANDO o responsável confirma a adição de uma Pessoa encontrada ENTÃO o sistema DEVE criar o vínculo `PersonCompanyGrant` tipo `RESPONSIBLE` com status **`PENDING`** (pendente de aceite — **não** ativo).
3. **(E-002)** QUANDO a Pessoa buscada não está cadastrada no portal ENTÃO o sistema DEVE bloquear a operação e orientar que essa Pessoa precisa fazer o auto-cadastro antes (sem convite por e-mail no MVP).
4. **(E-003 / P-002)** QUANDO o vínculo pendente é criado ENTÃO o sistema DEVE enviar e-mail à Pessoa adicionada com link para revisar/aceitar; e o vínculo SÓ vira **`ACTIVE`** quando essa Pessoa o aceita explicitamente (no painel ou via link).
5. **(P-003)** QUANDO a Pessoa adicionada aceita o vínculo ENTÃO o sistema DEVE, **na mesma transação**, marcar o vínculo `ACTIVE`, ativar o papel `COMPANY_RESPONSIBLE` na Pessoa (se inativo) e capturar o consentimento da finalidade 5 (representação de Empresa).
6. **(P-004 / ADR-0021)** QUANDO duas adições da mesma Pessoa à mesma Empresa ocorrem (mesmo simultâneas) ENTÃO o sistema DEVE criar **um único** vínculo não-removido, via UNIQUE parcial `(person_id, company_id) WHERE status IN ('PENDING','ACTIVE')` + `409` determinístico no segundo.

**Independent Test**: Autenticada como responsável **ativa** de uma Empresa, buscar uma segunda Pessoa pré-cadastrada por CPF e confirmar que a resposta é binária (sem nome); adicioná-la e verificar que o vínculo nasce `PENDING` e que o e-mail com link de aceite foi enfileirado no outbox; logar como a Pessoa adicionada, aceitar o vínculo e confirmar que ele vira `ACTIVE`, o papel `COMPANY_RESPONSIBLE` é ativado e o consent finalidade 5 é gravado na mesma transação. Repetir a busca com um CPF inexistente e confirmar o bloqueio com orientação de auto-cadastro; e uma busca por usuário não-responsável deve ser negada.

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

- QUANDO a Pessoa buscada para adicionar já tem vínculo `PENDING` ou `ACTIVE` na mesma Empresa ENTÃO o sistema DEVE bloquear a duplicidade (UNIQUE parcial → `409`) e informar que o vínculo já existe/está pendente.
- QUANDO a Pessoa adicionada tenta aceitar um vínculo que não está mais `PENDING` (já aceito, removido ou inexistente) ENTÃO o sistema DEVE bloquear com mensagem apropriada (idempotência defensiva).
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
| VPE-07 | USP-015 | Execute | Done |
| VPE-08 | USP-015 | Execute | Done |

## Success Criteria

- [ ] Pessoa-responsável **ativa** consegue buscar (resposta binária, sem PII) e adicionar outra Pessoa pré-cadastrada, criando vínculo `RESPONSIBLE` **`PENDING`** e e-mail de aceite enfileirado no outbox.
- [ ] Pessoa adicionada aceita o vínculo → status `ACTIVE`, papel `COMPANY_RESPONSIBLE` ativado e consent finalidade 5 capturado, tudo na mesma transação.
- [ ] Busca/adição por usuário **não-responsável** é negada (P-005); rate limit anti-enumeração aplicado (L-002).
- [ ] Tentativa de adicionar Pessoa não cadastrada é bloqueada com orientação de auto-cadastro (sem convite por e-mail).
- [ ] Pessoa-responsável consegue remover um vínculo, com `endedAt` preenchido, e-mail à removida e histórico preservado.
- [ ] Remoção que deixaria a Empresa sem responsável ativo é bloqueada.
- [ ] Edição de dados não-sensíveis é persistida sem alterar `isVerified`.
- [ ] Edição de CNPJ, razão social ou nome fantasia rebaixa `isVerified` para `false`.
- [ ] Todas as operações sensíveis registram auditoria e respeitam verificação de permissão da Pessoa-responsável.
