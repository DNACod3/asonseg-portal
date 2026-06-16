# .specs/features/vinculos-pessoa-empresa/tests/bdd/usp-015-editar-empresa.feature
# Fonte: spec.md (AC-015-1..2 + Edge Cases) · design-usp-015.md (D-015-A..F)
#        technical-design §4.4/4.5/4.6 · ADR-0020/0021/0023/0024/0030 · project-guideline §4,§12
# Expectations: E-001..003 / P-001/P-004/P-005.
# Invariante (P-001/D-015-C): mudança em campo identitário (cnpj, razaoSocial, nomeFantasia)
#   rebaixa isVerified=false NA MESMA TRANSAÇÃO da edição.

@usp-015 @modulo-companies @vinculos-pessoa-empresa
Funcionalidade: Editar dados da Empresa (rebaixamento atômico da verificação)
  Como Pessoa-responsável de uma Empresa
  Quero editar os dados cadastrais da Empresa
  Para que as informações fiquem atualizadas
  Reabrindo a verificação manual quando dados de identidade jurídica mudarem

  Contexto:
    Dado uma Empresa "Padaria Aurora" cadastrada e VERIFICADA (isVerified=true)
    E uma Pessoa "Ana" responsável ATIVA dessa Empresa, autenticada

  @ac-015-1 @e-001 @happy-path
  Cenário: Editar campo não-identitário persiste e mantém a verificação
    Quando Ana edita a "descrição" da Empresa para "Pães artesanais e cafés"
    Então as alterações são persistidas
    E "isVerified" permanece true
    E registra log de auditoria do evento "COMPANY_UPDATED" com before/after
    E a ação retorna sucesso com "downgraded" igual a false

  @ac-015-2 @e-002 @p-001
  Cenário: Editar campo identitário rebaixa a verificação na mesma transação
    Quando Ana edita o "nome fantasia" da Empresa para "Padaria Aurora & Cia"
    Então as alterações são persistidas
    E "isVerified" passa a false
    E o rebaixamento ocorre na MESMA transação da edição
    E registra log de auditoria do evento "COMPANY_UPDATED" com before/after incluindo isVerified
    E a ação retorna sucesso com "downgraded" igual a true

  @ac-015-2 @e-002
  Cenário: Editar razão social rebaixa a verificação
    Quando Ana edita a "razão social" da Empresa para "Padaria Aurora Alimentos Ltda"
    Então "isVerified" passa a false

  @ac-015-2 @e-002
  Cenário: Editar CNPJ rebaixa a verificação
    Quando Ana edita o "CNPJ" da Empresa para outro CNPJ válido não cadastrado
    Então "isVerified" passa a false

  @ac-015-1 @e-001 @edge
  Cenário: Editar somente endereço/setor não rebaixa
    Quando Ana edita o "endereço" e o "setor" da Empresa
    Então as alterações são persistidas
    E "isVerified" permanece true

  @p-004 @edge @permissao
  Cenário: Pessoa não-responsável não pode editar a Empresa
    Dado uma Pessoa "Carlos" que NÃO é responsável da Empresa "Padaria Aurora", autenticada
    Quando Carlos tenta editar a Empresa "Padaria Aurora"
    Então a operação é negada com erro "FORBIDDEN"
    E nenhuma alteração é persistida

  @p-005 @edge @cnpj
  Cenário: CNPJ que pertence a outra Empresa bloqueia a edição
    Dado uma outra Empresa "Mercado Sol" com um CNPJ válido já cadastrado
    Quando Ana edita o "CNPJ" da Empresa "Padaria Aurora" para o CNPJ de "Mercado Sol"
    Então a operação é negada com erro "CONFLICT"
    E "isVerified" da "Padaria Aurora" permanece inalterado

  @d-015-e @ui
  Cenário: UI avisa sobre re-verificação antes de confirmar mudança identitária
    Dado Ana na tela de edição da Empresa "Padaria Aurora"
    Quando Ana altera o "nome fantasia" e submete
    Então a UI exibe um diálogo de confirmação avisando que a alteração exigirá nova verificação manual
    E só após a confirmação a edição é enviada ao servidor

  @d-015-e @ui
  Cenário: UI não exige confirmação para mudança não-identitária
    Dado Ana na tela de edição da Empresa "Padaria Aurora"
    Quando Ana altera apenas a "descrição" e submete
    Então a edição é enviada ao servidor diretamente, sem diálogo de re-verificação
