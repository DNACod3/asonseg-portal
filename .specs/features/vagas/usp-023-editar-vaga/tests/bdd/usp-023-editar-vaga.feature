# .specs/features/vagas/usp-023-editar-vaga/tests/bdd/usp-023-editar-vaga.feature
# Fonte: docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-023.md (E-001..E-005, P-001/003/005/006, L-003, D-001..D-006)
#        .specs/features/vagas/usp-023-editar-vaga/spec.md (must-nots) + design.md (§3 componentes/interfaces)
# Regenerado em T0 (skill-tdad) — substitui os facts stale de uma geração anterior que não
# refletiam o design vigente (actions editJob/pauseJob/unpauseJob/archiveJob/extendJobValidity/
# listCompanyJobs/getPausedJobNotice ainda não existiam nesse design).

@usp-023 @modulo-jobs @modulo-moderation
Funcionalidade: Editar vaga (pausar, arquivar, renovar)
  Como Pessoa-responsável ativa da Empresa dona da vaga
  Quero editar, pausar/despausar, arquivar e prorrogar a validade de uma vaga publicada
  Para gerenciar o ciclo de vida do anúncio sem depender de suporte

  Contexto:
    Dado uma vaga "ACTIVE" pertencente à Empresa "Empresa Alfa" (empresa verificada)
    E uma Pessoa "Ana" com vínculo RESPONSIBLE ativo na "Empresa Alfa"
    E uma Pessoa "Bruno" SEM vínculo RESPONSIBLE ativo na "Empresa Alfa"

  # --- E-001 / AC-023-1 — editar vaga ACTIVE -----------------------------------------

  @ac-023-1 @e-005 @p-001 @p-005 @happy-path
  Cenário: Editar vaga ACTIVE move para rascunho, audita e preserva published_at
    Dado que a vaga já foi ativada anteriormente e possui "published_at" gravado
    Quando Ana edita a descrição da vaga
    Então o sistema grava os campos novos e muda o status para "DRAFT" na mesma transação
    E registra o evento de auditoria "JOB_EDITED_AFTER_APPROVAL" com "before"/"after"
    E retorna sucesso com "{ jobId, status: 'DRAFT' }"
    Quando a vaga é resubmetida via "submitJobForModeration" e reaprovada pelo coordenador
    Então o "published_at" da vaga permanece igual ao valor gravado na 1ª ativação (D-006)

  @ac-023-1 @p-001 @happy-path
  Cenário: Primeira ativação grava published_at
    Dado uma vaga nova, aprovada pela primeira vez, sem "published_at" gravado
    Quando a transição para "ACTIVE" ocorre
    Então o sistema grava "published_at = now()"

  @ac-023-1 @p-005 @borda
  Cenário: Pessoa sem vínculo responsável não pode editar
    Quando Bruno tenta editar a vaga
    Então o sistema retorna "FORBIDDEN"
    E nenhuma escrita ocorre no banco

  @ac-023-1 @borda
  Cenário: Editar vaga que não está ACTIVE é recusado
    Dado uma vaga com status "PAUSED"
    Quando Ana tenta editar essa vaga
    Então o sistema recusa com um erro de conflito/precondição
    E nenhuma escrita parcial ocorre

  # --- E-002 / AC-023-2 — pausar / despausar -------------------------------------------

  @ac-023-2 @happy-path
  Cenário: Pausar vaga ACTIVE
    Quando Ana pausa a vaga
    Então o sistema transiciona a vaga de "ACTIVE" para "PAUSED" via transitionContent
    E registra o evento de auditoria "JOB_PAUSED"
    E a vaga some da busca pública "searchJobs"

  @ac-023-2 @happy-path
  Cenário: Despausar vaga PAUSED sem re-moderação
    Dado uma vaga com status "PAUSED"
    Quando Ana despausa a vaga
    Então o sistema transiciona a vaga de "PAUSED" para "ACTIVE" via transitionContent
    E registra o evento de auditoria "JOB_UNPAUSED"
    E NÃO exige nova moderação
    E a vaga volta a aparecer na busca pública

  @ac-023-2 @p-003 @borda
  Cenário: Detalhe de vaga pausada exibe mensagem e esconde o botão candidatar-se
    Dado uma vaga com status "PAUSED" de uma Empresa verificada
    Quando alguém abre o detalhe da vaga por URL direta
    Então a página exibe "vaga temporariamente pausada"
    E o botão "candidatar-se" NÃO é exibido ativo

  @ac-023-2 @p-005 @borda
  Cenário: Pessoa sem vínculo responsável não pode pausar nem despausar
    Quando Bruno tenta pausar a vaga
    Então o sistema retorna "FORBIDDEN"
    Quando Bruno tenta despausar a vaga
    Então o sistema retorna "FORBIDDEN"

  # --- E-003 / AC-023-3 — arquivar (terminal) ------------------------------------------

  @ac-023-3 @happy-path
  Cenário: Arquivar vaga ACTIVE
    Quando Ana arquiva a vaga
    Então o sistema transiciona a vaga de "ACTIVE" para "ARCHIVED" via transitionContent
    E registra o evento de auditoria "JOB_ARCHIVED"
    E a vaga sai de qualquer listagem pública
    E o histórico de candidaturas da vaga é preservado

  @ac-023-3 @p-006 @borda
  Cenário: Vaga arquivada não pode ser reativada diretamente
    Dado uma vaga com status "ARCHIVED"
    Quando o sistema tenta transicionar essa vaga de "ARCHIVED" para "ACTIVE"
    Então a transição é recusada com "INVALID_TRANSITION"

  @ac-023-3 @p-005 @borda
  Cenário: Pessoa sem vínculo responsável não pode arquivar
    Quando Bruno tenta arquivar a vaga
    Então o sistema retorna "FORBIDDEN"

  # --- E-004 / AC-023-4 — prorrogar validade -------------------------------------------

  @ac-023-4 @happy-path
  Cenário: Prorrogar validade de vaga ACTIVE
    Quando Ana prorroga a validade da vaga para uma data futura dentro do teto de 180 dias
    Então o sistema atualiza "validUntil"
    E o status da vaga permanece "ACTIVE" (sem transição)
    E registra o evento de auditoria "JOB_VALIDITY_EXTENDED" com before/after de "validUntil"
    E NÃO exige nova moderação

  @ac-023-4 @borda
  Esquema do Cenário: Data de prorrogação inválida é recusada
    Quando Ana tenta prorrogar a validade da vaga para "<data>"
    Então o sistema retorna "VALIDATION"

    Exemplos:
      | data                          |
      | uma data no passado           |
      | uma data acima de 180 dias    |

  @ac-023-4 @happy-path
  Cenário: Múltiplas prorrogações seguidas são aceitas
    Quando Ana prorroga a validade da vaga três vezes seguidas com datas futuras válidas
    Então todas as três prorrogações são aceitas

  @ac-023-4 @p-005 @borda
  Cenário: Pessoa sem vínculo responsável não pode prorrogar
    Quando Bruno tenta prorrogar a validade da vaga
    Então o sistema retorna "FORBIDDEN"

  # --- Painel de gestão -----------------------------------------------------------------

  @painel @happy-path
  Cenário: Responsável vê o painel de gestão de vagas da Empresa
    Quando Ana abre "(app)/empresa/[empresaId]/vagas"
    Então o sistema lista as vagas da Empresa em todos os status
    E cada vaga exibe ações contextuais coerentes com seu status

  @painel @p-005 @borda
  Cenário: Pessoa sem vínculo responsável não acessa o painel de outra Empresa
    Quando Bruno abre "(app)/empresa/[empresaId]/vagas" da "Empresa Alfa"
    Então o sistema responde "404 Not Found"
    E não revela a existência da Empresa

  @painel @happy-path
  Cenário: Fluxo de edição encadeia editJob e submitJobForModeration
    Quando Ana edita a vaga pela tela "/vagas/[jobId]/editar" e confirma
    Então o sistema chama "editJob" e, em sucesso, encadeia "submitJobForModeration"
    E a vaga volta para o fluxo de moderação

  # --- Must-not U23-MN-07 — guarda de arquitetura ---------------------------------------

  @u23-mn-07 @borda @guarda-estatica
  Cenário: Nenhum código fora do adapter ou de editJob escreve Job.status
    Dado o código-fonte do módulo "jobs"
    Quando se busca por escritas de "status" em "Job" fora de "PrismaJobStatusRepository" e "editJob"
    Então nenhuma ocorrência é encontrada
    E "editJob" só escreve "status" com "status: 'ACTIVE'" no "where"
