# .specs/features/vagas/usp-020-publicar-vaga/tests/bdd/usp-020-publicar-vaga.feature
# Fonte: expectations-USP-020.md (E-001/E-003/E-004/E-005 + must-not P-003/P-005/P-006 + L-003/L-004) · issue #161 · matriz-conexoes.md §USP-020
#        ADR-0014 (Empresa sem login, Pessoas-responsáveis) · ADR-0015 (moderação humana pré-publicação)
#        ADR-0021 (unicidade sob concorrência via UNIQUE → 409) · ADR-0020 (atomicidade + outbox) · ADR-0023 (auditoria append-only) · ADR-0028 (sanitização)
#        project-guideline §4 (Server Action), §12 (testes). EARS verbatim na traceability.md. Não enfraquecer (P4).
#
# RECORTE DE ESCOPO (#161): esta US leva a vaga de rascunho até "em moderação" (IN_MODERATION). Entra: criar rascunho
# (#164), submeter à moderação (#164) via transitionContent, validação de validade (#163), gate de responsável ativo,
# dedup exata, auditoria. FORA desta US (marcados @fora-desta-us): verificação atômica da 1ª vaga (E-002/P-001 → USP-016/017),
# filtro on-read de visibilidade pública (P-002/P-007 → USP-021/024), checklist legal de moderação (P-004 → USP-016).

@usp-020 @modulo-jobs
Funcionalidade: Publicar vaga em nome de uma Empresa
  Como Pessoa-responsável de uma Empresa
  Quero publicar uma vaga (rascunho ou submetida à moderação) em nome da Empresa
  Para que, após aprovação humana, candidatos descubram e se candidatem

  Contexto:
    Dada uma Pessoa autenticada chamada "Joana"
    E uma Empresa "Padaria Pão Quente" da qual "Joana" é responsável com vínculo "ACTIVE"
    E a área de vaga "Atendimento" no catálogo aprovado
    E que hoje é "2026-06-16" no fuso "America/Sao_Paulo"

  # ───────────────────── E-001 — submeter vaga válida → IN_MODERATION vinculada à Empresa ─────────────────────
  # submitJobForModeration: Zod(completo) → getCurrentPerson → gate responsável ativo → persiste campos →
  # transitionContent(JOB, IN_MODERATION, AUTHOR_ACTION). A FSM grava CONTENT_SUBMITTED_TO_MODERATION (TD §4.6).

  @e-001 @ac-020-1 @happy-path
  Cenário: Submissão válida persiste a vaga em moderação vinculada à Empresa
    Dado que "Joana" preencheu título, área "Atendimento", descrição, requisitos, regime e local
    E a data de validade "2026-09-01" (futura, dentro do teto)
    Quando "Joana" submete a vaga para moderação em nome da "Padaria Pão Quente"
    Então o sistema persiste a vaga com status "IN_MODERATION"
    E a vaga fica vinculada à Empresa "Padaria Pão Quente" (companyId) e ao autor "Joana"
    E registra o evento de auditoria "CONTENT_SUBMITTED_TO_MODERATION"
    E a operação retorna sucesso ("ok": verdadeiro)

  # ───────────────────── E-003 — salvar rascunho sem submeter ─────────────────────

  @e-003 @ac-020-4 @happy-path
  Cenário: Salvar como rascunho não envia à moderação
    Dado que "Joana" preencheu apenas o título da vaga
    Quando "Joana" salva a vaga como rascunho
    Então o sistema persiste a vaga com status "DRAFT"
    E a vaga NÃO entra na fila de moderação
    E registra o evento de auditoria "JOB_DRAFT_SAVED"

  # ───────────────────── E-004 — validade ≤ hoje (America/Sao_Paulo) bloqueia ─────────────────────

  @e-004 @ac-020-3 @borda @must-not
  Cenário: Data de validade no passado bloqueia o submit
    Dado que "Joana" preencheu todos os campos obrigatórios
    E a data de validade "2026-06-10" (anterior a hoje)
    Quando "Joana" submete a vaga para moderação
    Então o sistema bloqueia o submit com erro "VALIDATION"
    E exibe mensagem clara de que a validade deve ser futura
    E nenhuma vaga é persistida em moderação

  @e-004 @ac-020-3 @borda @must-not
  Cenário: Data de validade igual a hoje (fuso America/Sao_Paulo) bloqueia o submit
    Dado que "Joana" preencheu todos os campos obrigatórios
    E a data de validade "2026-06-16" (igual a hoje no fuso America/Sao_Paulo)
    Quando "Joana" submete a vaga para moderação
    Então o sistema bloqueia o submit com erro "VALIDATION"

  # ───────────────────── E-005 / P-005 — validade acima do teto (180 dias) bloqueia ─────────────────────

  @e-005 @p-005 @borda @must-not
  Cenário: Validade além do teto de 180 dias bloqueia o submit
    Dado que "Joana" preencheu todos os campos obrigatórios
    E a data de validade "2027-06-16" (mais de 180 dias no futuro)
    Quando "Joana" submete a vaga para moderação
    Então o sistema bloqueia o submit com erro "VALIDATION"
    E exibe mensagem indicando o teto máximo de 180 dias

  @e-005 @borda @happy-path
  Cenário: Validade exatamente no teto de 180 dias é aceita
    Dado que "Joana" preencheu todos os campos obrigatórios
    E a data de validade exatamente 180 dias após hoje
    Quando "Joana" submete a vaga para moderação
    Então o sistema persiste a vaga com status "IN_MODERATION"

  # ───────────────────── L-003 — campos obrigatórios ─────────────────────

  @l-003 @ac-020-2 @borda @must-not
  Esquema do Cenário: Submeter sem um campo obrigatório bloqueia
    Dado que "Joana" preencheu todos os campos obrigatórios exceto "<campo>"
    Quando "Joana" submete a vaga para moderação
    Então o sistema bloqueia o submit com erro "VALIDATION" apontando o campo "<campo>"

    Exemplos:
      | campo       |
      | titulo      |
      | area        |
      | descricao   |
      | requisitos  |
      | regime      |
      | local       |
      | validade    |

  # ───────────────────── P-006 — só responsável ativo da Empresa publica (anti-bypass) ─────────────────────

  @p-006 @must-not @seguranca
  Cenário: Pessoa sem vínculo de responsável ativo é negada antes da persistência
    Dada uma Pessoa autenticada chamada "Carlos" SEM vínculo de responsável da "Padaria Pão Quente"
    Quando "Carlos" tenta submeter uma vaga em nome da "Padaria Pão Quente"
    Então o sistema nega com erro "FORBIDDEN"
    E nenhuma vaga é persistida
    E a verificação de permissão ocorre antes de qualquer escrita (anti-IDOR, pessoaId da sessão)

  @p-006 @must-not @seguranca
  Cenário: Vínculo de responsável apenas PENDENTE não autoriza publicar
    Dada uma Pessoa autenticada chamada "Bia" com vínculo de responsável "PENDING" da "Padaria Pão Quente"
    Quando "Bia" tenta submeter uma vaga em nome da "Padaria Pão Quente"
    Então o sistema nega com erro "FORBIDDEN"

  # ───────────────────── P-003 — dedup EXATA (título + Empresa + área) → CONFLICT/409 (ADR-0021) ─────────────────────

  @p-003 @must-not @concorrencia
  Cenário: Segunda vaga idêntica viva da mesma Empresa é rejeitada com CONFLICT
    Dado que já existe uma vaga viva da "Padaria Pão Quente" com título "Atendente de balcão" na área "Atendimento"
    Quando "Joana" submete outra vaga da "Padaria Pão Quente" com o mesmo título "Atendente de balcão" e área "Atendimento"
    Então o sistema rejeita com erro "CONFLICT" (409 determinístico via constraint UNIQUE)
    E persiste apenas uma vaga viva com esse título+Empresa+área

  @p-003 @must-not @concorrencia
  Cenário: Submissão concorrente do mesmo rascunho resolve em uma única transição
    Dado um rascunho de vaga da "Padaria Pão Quente"
    Quando dois responsáveis submetem o mesmo rascunho simultaneamente
    Então apenas uma submissão transiciona para "IN_MODERATION"
    E a segunda recebe "INVALID_TRANSITION" (item já mudou)

  # ───────────────────── L-004 — log imutável da submissão ─────────────────────

  @l-004 @auditoria
  Cenário: A submissão gera log de auditoria imutável com responsável, Empresa e data
    Dado que "Joana" submete uma vaga válida em nome da "Padaria Pão Quente"
    Então é gravado no audit_log o evento "CONTENT_SUBMITTED_TO_MODERATION" com ator "Joana" e a entidade da vaga
    E o registro de auditoria é append-only (não pode ser alterado nem removido — ADR-0023)

  # ───────────────────── Fora desta US (downstream) ─────────────────────

  @fora-desta-us @e-002 @p-001
  Cenário: Primeira vaga de Empresa não verificada arrasta verificação na APROVAÇÃO (USP-016/017)
    # A marcação/verificação atômica acontece na ativação (transitionContent → ACTIVE), via COMPANY_VERIFY_HOOK.
    # Coberto pelos facts da USP-016/USP-017 — fora do escopo de #161.
    Dado que a feature de aprovação de moderação existe
    Então este comportamento é verificado na USP-016/017

  @fora-desta-us @p-002 @p-007
  Cenário: Vaga só aparece na busca pública quando ACTIVE + validade futura + Empresa verificada (USP-021/024)
    # Filtro on-read pertence à busca pública (USP-021) e à expiração (USP-024).
    Dado que a busca pública de vagas existe
    Então este filtro é verificado na USP-021/USP-024

  @fora-desta-us @p-004
  Cenário: Checklist de conformidade legal mínima na moderação (USP-016 + gate Fase 0)
    Dado que a moderação humana de vagas existe
    Então o checklist legal é verificado na USP-016 (entregável de Fase 0)
