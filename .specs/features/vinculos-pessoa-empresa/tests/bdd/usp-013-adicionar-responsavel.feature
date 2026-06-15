# .specs/features/vinculos-pessoa-empresa/tests/bdd/usp-013-adicionar-responsavel.feature
# Fonte: expectations-USP-013.md (E-001..E-003, P-001..P-005, L-002) · intent-USP-013.md (F1..F4)
#        technical-design §4.4/4.5/4.6 · ADR-0014/0017/0020/0021/0022/0029 · project-guideline §4,§12
# Modelo: PENDENTE+ACEITE (decisão de kickoff AD-006). Vínculo nasce PENDING; vira ACTIVE só no aceite.

@usp-013 @modulo-companies @vinculos-pessoa-empresa
Funcionalidade: Adicionar responsável a uma Empresa (modelo pendente+aceite)
  Como Pessoa-responsável ativa de uma Empresa
  Quero adicionar outra Pessoa já cadastrada como responsável adicional
  Para que mais pessoas possam operar vagas e serviços em nome da Empresa
  Respeitando o aceite explícito da Pessoa adicionada (LGPD) e sem vazar quem está cadastrado

  Contexto:
    Dado uma Empresa "Padaria Aurora" cadastrada no portal
    E uma Pessoa "Ana" responsável ATIVA dessa Empresa, autenticada

  # ---------- adicionarResponsavel ----------

  @ac-e-001 @ac-p-002 @happy-path
  Cenário: Adicionar Pessoa pré-cadastrada cria vínculo PENDENTE (não ativo)
    Dado uma Pessoa "Bruno" pré-cadastrada no portal com CPF válido
    Quando Ana busca por esse CPF e confirma a adição de Bruno como responsável
    Então o sistema cria um vínculo PersonCompanyGrant tipo "RESPONSIBLE" com status "PENDING"
    E o vínculo NÃO está ativo (Bruno ainda não opera a Empresa)
    E registra log de auditoria do evento "COMPANY_RESPONSIBLE_ADDED"
    E a ação retorna sucesso

  @ac-p-001 @ac-l-003 @seguranca
  Cenário: Busca por CPF retorna resposta binária sem PII antes da confirmação
    Dado uma Pessoa "Bruno" pré-cadastrada
    Quando Ana busca por esse CPF
    Então o sistema responde apenas "Pessoa encontrada" (binário)
    E NÃO retorna nome, foto nem qualquer dado identificador de Bruno antes da confirmação

  @ac-e-002 @borda
  Cenário: Pessoa não cadastrada bloqueia e orienta auto-cadastro (sem convite)
    Quando Ana busca por um CPF que não corresponde a nenhuma Pessoa cadastrada
    Então o sistema bloqueia a operação
    E orienta que essa Pessoa precisa fazer o auto-cadastro antes
    E NÃO dispara convite por e-mail

  @ac-e-003 @outbox
  Cenário: Criação do vínculo pendente enfileira e-mail com link de aceite
    Dado uma Pessoa "Bruno" pré-cadastrada
    Quando Ana confirma a adição de Bruno
    Então o sistema enfileira no outbox um e-mail "responsible-link-pending" para Bruno
    E o e-mail contém um link para revisar/aceitar o vínculo

  @ac-p-005 @permissao
  Cenário: Usuário que não é responsável ativo não pode buscar nem adicionar
    Dado uma Pessoa "Carla" que NÃO é responsável da Empresa "Padaria Aurora", autenticada
    Quando Carla tenta buscar uma Pessoa por CPF para adicionar à Empresa
    Então o sistema nega a operação por falta de permissão

  @ac-p-004 @concorrencia @borda
  Cenário: Duplicidade de vínculo é bloqueada (UNIQUE parcial + 409)
    Dado que Bruno já tem um vínculo "PENDING" ou "ACTIVE" com a Empresa
    Quando Ana tenta adicionar Bruno novamente
    Então o sistema bloqueia a duplicidade com erro "CONFLICT" (409)
    E permanece um único vínculo não-removido de Bruno com a Empresa

  @ac-p-004 @concorrencia
  Cenário: Duas adições simultâneas da mesma Pessoa criam um único vínculo
    Dado uma Pessoa "Bruno" pré-cadastrada sem vínculo com a Empresa
    Quando dois responsáveis adicionam Bruno simultaneamente
    Então exatamente um vínculo não-removido é criado
    E a segunda requisição recebe "CONFLICT" (409) determinístico

  @ac-l-002 @seguranca
  Cenário: Rate limit anti-enumeração nas buscas por CPF/e-mail
    Quando Ana excede o limite de buscas por CPF/e-mail na janela configurada
    Então o sistema passa a recusar novas buscas com erro de rate limit
    E nenhuma PII é revelada nas respostas recusadas

  @ac-e-001 @validacao
  Cenário: Entrada inválida é rejeitada pela validação Zod
    Quando Ana submete a adição com um identificador que não é CPF nem e-mail válido
    Então o sistema rejeita por falha de validação antes de qualquer busca

  # ---------- aceitarVinculoResponsavel ----------

  @ac-p-002 @ac-e-003 @happy-path
  Cenário: Pessoa adicionada aceita o vínculo e ele vira ATIVO
    Dado um vínculo "PENDING" de Bruno com a Empresa "Padaria Aurora"
    E Bruno autenticado
    Quando Bruno aceita o vínculo
    Então o status do vínculo passa para "ACTIVE"
    E o campo de data de aceite é preenchido
    E registra log de auditoria "COMPANY_RESPONSIBLE_LINK_ACCEPTED"

  @ac-p-003 @ac-e-001 @atomicidade
  Cenário: Aceite ativa papel e captura consentimento na mesma transação
    Dado um vínculo "PENDING" de Bruno com a Empresa
    E Bruno ainda não tem o papel "COMPANY_RESPONSIBLE" ativo
    Quando Bruno aceita o vínculo
    Então o papel "COMPANY_RESPONSIBLE" é ativado para Bruno
    E o consentimento da finalidade 5 (representação de Empresa) é capturado
    E vínculo, papel e consentimento ficam consistentes na mesma transação

  @ac-p-002 @borda
  Cenário: Aceite de vínculo que não está pendente é bloqueado (idempotência)
    Dado que Bruno não possui vínculo "PENDING" com a Empresa (já aceito, removido ou inexistente)
    Quando Bruno tenta aceitar o vínculo
    Então o sistema bloqueia com mensagem apropriada
    E nenhum papel ou consentimento adicional é gravado

  @ac-p-002 @permissao
  Cenário: Só a própria Pessoa do vínculo pode aceitá-lo
    Dado um vínculo "PENDING" de Bruno com a Empresa
    E uma Pessoa "Carla" autenticada (não é Bruno)
    Quando Carla tenta aceitar o vínculo de Bruno
    Então o sistema nega por falta de permissão
