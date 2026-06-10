# .specs/features/cadastros-publicos/usp-009-cadastro-candidato/tests/bdd/usp-009-cadastro-candidato.feature
# Fonte: PRD USP-009 · issue #31 · matriz-conexoes.md (CAD-01..CAD-05)
#        ADR-0008/0011 (pessoa unificada, papel) · ADR-0009 (LGPD consentimento por finalidade)
#        ADR-0011 (máquina de estados / moderação) · project-guideline §4 (Server Action), §12 (testes)
# ACs verbatim na matriz (traceability.md). Não enfraquecer (P4).

@usp-009 @modulo-persons
Funcionalidade: Cadastro de candidato (ativação do papel)
  Como Pessoa autenticada
  Quero ativar o papel de candidato preenchendo dados pessoais, qualificações e áreas de interesse
  Para aparecer nas buscas de empresas e me candidatar a vagas

  Contexto:
    Dado uma Pessoa autenticada chamada "Maria" sem o papel de candidato ativo
    E que ela aceitou as finalidades de consentimento "PORTAL_ACCESS" e "JOB_APPLICATION"

  # ───────────────────────── CAD-01 — ativar papel em DRAFT ─────────────────────────

  @cad-01 @happy-path
  Cenário: Cadastro válido ativa o papel de candidato em rascunho (DRAFT)
    Dado que "Maria" informa escolaridade "ENSINO_MEDIO", área de interesse principal "Administração"
      e telefone "(11) 98888-7777"
    Quando ela submete o cadastro de candidato
    Então o sistema ativa o papel de candidato para "Maria"
    E cria o perfil de candidato com status "DRAFT"
    E registra log de auditoria do evento "CANDIDATE_ROLE_ACTIVATED"
    E a ação retorna sucesso

  @cad-01 @borda @validacao
  Esquema do Cenário: Submissão sem campo obrigatório é rejeitada na fronteira (Zod)
    Dado que "Maria" deixa o campo "<campo>" em branco
    Quando ela submete o cadastro de candidato
    Então o sistema rejeita a submissão com erro "VALIDATION"
    E aponta o erro no campo "<campo>" com mensagem em PT-BR
    E nenhum perfil de candidato é criado

    Exemplos:
      | campo                   |
      | educationLevel          |
      | primaryAreaOfInterestId |
      | phone                   |

  @cad-01 @seguranca @permissao
  Cenário: Submissão não autenticada é recusada
    Dado um requisitante sem sessão autenticada
    Quando ele tenta ativar o papel de candidato
    Então o sistema recusa com erro "UNAUTHENTICATED"
    E nenhum perfil de candidato é criado

  @cad-01 @borda @idempotencia
  Cenário: Reativar o papel não duplica o perfil de candidato
    Dado que "Maria" já tem um perfil de candidato em status "DRAFT"
    Quando ela submete novamente o cadastro de candidato
    Então o sistema não cria um segundo perfil de candidato
    E a ação retorna sucesso (idempotente)

  # ───────────────────────── CAD-05 — consentimento LGPD ─────────────────────────

  @cad-05 @happy-path @lgpd
  Cenário: Ativação exige consentimento ativo para PORTAL_ACCESS e JOB_APPLICATION
    Dado que "Maria" informa os dados obrigatórios válidos
    Quando ela submete o cadastro de candidato
    Então o sistema verifica consentimento ativo para "PORTAL_ACCESS"
    E verifica consentimento ativo para "JOB_APPLICATION"
    E só então ativa o papel de candidato

  @cad-05 @borda @lgpd
  Cenário: Ativação sem aceite de consentimento é bloqueada
    Dado que "Maria" NÃO aceitou a finalidade "JOB_APPLICATION"
    Quando ela tenta ativar o papel de candidato
    Então o sistema bloqueia com erro "CONSENT_REQUIRED"
    E nenhum perfil de candidato é criado

  @cad-05 @lgpd @ui
  Cenário: Formulário bloqueia o envio sem aceite de consentimento
    Dado que "Maria" preencheu todos os campos obrigatórios
    Mas NÃO marcou o aceite das finalidades "PORTAL_ACCESS" e "JOB_APPLICATION"
    Quando ela tenta enviar o formulário
    Então o botão de envio permanece bloqueado
    E a Server Action não é chamada

  # ───────────────────── CAD-03 — enviar para moderação (USP-016 mergeada ✅) ─────────────────────

  @cad-03 @happy-path
  Cenário: Enviar perfil para moderação transiciona DRAFT para IN_MODERATION
    Dado que "Maria" tem um perfil de candidato em status "DRAFT"
    Quando ela envia o perfil para moderação
    Então o sistema transiciona o status para "IN_MODERATION" via transitionContent() com contentKind "CANDIDATE_PROFILE" e trigger "AUTHOR_ACTION"
    E registra log de auditoria do evento "CONTENT_SUBMITTED_TO_MODERATION"
    E o item passa a aparecer na fila de moderação do coordenador
    E o status nunca é alterado por prisma.update direto

  @cad-03 @borda
  Cenário: Enviar para moderação a partir de um status inválido é rejeitado
    Dado que "Maria" tem um perfil de candidato em status "IN_MODERATION"
    Quando ela tenta enviar o perfil para moderação novamente
    Então o sistema rejeita com erro de transição inválida (INVALID_TRANSITION)
    E o status permanece "IN_MODERATION"

  # ───────────────────── CAD-02 — anexo de CV / extração IA (DIFERIDO USP-040) ─────────────────────

  @cad-02 @diferido-usp-040
  Cenário: Anexo de CV invoca extração por IA e pré-preenche campos
    Dado que "Maria" anexa um currículo em PDF de até 5MB
    Quando o cadastro é submetido com o anexo
    Então o sistema registra também consentimento "CV_AI_EXTRACTION"
    E invoca a extração automática por IA para pré-preencher campos
    # Diferido: o parsing/pré-preenchimento é especificado e testado na USP-040.
    # Aqui apenas a estrutura cv* e o ponto de invocação.

  # ───────────────────── CAD-04 — aprovação pelo coordenador (FORA — USP-016) ─────────────────────

  @cad-04 @diferido-usp-016
  Cenário: Aprovação do coordenador ativa o candidato e envia e-mail
    Dado que o perfil de "Maria" está em status "IN_MODERATION"
    Quando o coordenador aprova o perfil
    Então o sistema ativa o candidato (visível na busca)
    E envia e-mail ao candidato
    # Fora do escopo da USP-009: fluxo do coordenador é USP-016 (moderação) + US de e-mail.
