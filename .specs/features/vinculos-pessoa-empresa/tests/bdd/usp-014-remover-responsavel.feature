# .specs/features/vinculos-pessoa-empresa/tests/bdd/usp-014-remover-responsavel.feature
# Fonte: spec.md (AC-014-1..3 + Edge Cases) · design-usp-014.md (D-014-A..E)
#        technical-design §4.4/4.5/4.6 · ADR-0014/0020/0023/0030 · project-guideline §4,§12
# Modelo: remoção append-only via revokedAt/revokedBy + revokeReason (D-014-A/B).
# Invariante (AC-014-2): a Empresa precisa manter ≥1 responsável ACTIVE.

@usp-014 @modulo-companies @vinculos-pessoa-empresa
Funcionalidade: Remover responsável de uma Empresa (append-only, invariante ≥1 ativo)
  Como Pessoa-responsável de uma Empresa
  Quero remover meu próprio vínculo ou o de outro responsável
  Para que a gestão da Empresa reflita as pessoas realmente envolvidas
  Sem nunca deixar a Empresa sem responsável ativo e preservando o histórico

  Contexto:
    Dado uma Empresa "Padaria Aurora" cadastrada no portal
    E uma Pessoa "Ana" responsável ATIVA dessa Empresa, autenticada

  @ac-014-1 @happy-path
  Cenário: Remover um co-responsável quando há dois ativos
    Dado uma Pessoa "Bruno" também responsável ATIVO da Empresa "Padaria Aurora"
    Quando Ana remove o vínculo de Bruno
    Então o vínculo de Bruno passa a ter "revokedAt" e "revokedBy" preenchidos
    E o vínculo NÃO é apagado (histórico preservado)
    E registra log de auditoria do evento "COMPANY_RESPONSIBLE_REMOVED"
    E enfileira no outbox um e-mail "responsible-removed" para Bruno
    E a ação retorna sucesso

  @ac-014-1 @motivo
  Cenário: Remoção com motivo opcional grava o porquê no vínculo
    Dado uma Pessoa "Bruno" também responsável ATIVO da Empresa "Padaria Aurora"
    Quando Ana remove o vínculo de Bruno informando o motivo "Saiu da empresa"
    Então o campo "revokeReason" do vínculo de Bruno guarda "Saiu da empresa"

  @ac-014-2 @invariante @borda
  Cenário: Bloquear a remoção do último responsável ativo
    Dado que Ana é a ÚNICA responsável ATIVA da Empresa "Padaria Aurora"
    Quando Ana tenta remover o seu próprio vínculo
    Então o sistema bloqueia com erro "PRECONDITION_FAILED"
    E orienta designar outro responsável antes de remover o último
    E o vínculo de Ana permanece ATIVO

  @ac-014-1 @auto-remocao @borda
  Cenário: Auto-remoção é permitida quando há outro responsável ativo
    Dado uma Pessoa "Bruno" também responsável ATIVO da Empresa "Padaria Aurora"
    Quando Ana remove o seu próprio vínculo
    Então a remoção é concluída com sucesso
    E Ana perde o acesso de gestão da Empresa na próxima requisição (ADR-0030)

  @ac-014-3 @historico
  Cenário: Histórico de vínculos removidos é preservado para auditoria
    Dado uma Pessoa "Bruno" cujo vínculo com a Empresa já foi removido
    Quando consulta-se o histórico de vínculos da Empresa
    Então o vínculo removido de Bruno continua consultável com "revokedAt" preenchido

  @permissao
  Cenário: Pessoa que não é responsável ativo não pode remover vínculos
    Dado uma Pessoa "Carla" que NÃO é responsável da Empresa "Padaria Aurora", autenticada
    Quando Carla tenta remover o vínculo de outro responsável
    Então o sistema nega a operação por falta de permissão ("FORBIDDEN")

  @borda
  Cenário: Falha no envio do e-mail não reverte a remoção
    Dado uma Pessoa "Bruno" também responsável ATIVO da Empresa "Padaria Aurora"
    Quando Ana remove o vínculo de Bruno e o envio do e-mail falha
    Então a remoção permanece persistida (revokedAt preenchido)
    E a falha de e-mail é registrada sem reverter a operação

  @borda @idempotencia
  Cenário: Remover um vínculo inexistente ou já removido é bloqueado
    Quando Ana tenta remover um vínculo que não existe ou já foi removido
    Então o sistema bloqueia com erro "NOT_FOUND"

  @validacao
  Cenário: Entrada inválida é rejeitada pela validação Zod
    Quando Ana submete a remoção com um "grantId" que não é UUID
    Então o sistema rejeita por falha de validação antes de qualquer operação
