# language: pt
@usp-017 @moderacao @companies
Funcionalidade: Validar Empresa na primeira vaga publicada
  Como coordenador (ou voluntário delegado)
  Quero verificar os dados da Empresa durante a moderação da primeira vaga dela
  Para evitar empresas-fantasma no portal (defesa principal contra RP-005)

  Contexto:
    Dado um coordenador autenticado com permissão de moderação
    E uma Empresa "Construtora Alfa" com isVerified=false
    E uma vaga dessa Empresa no status "em moderação"

  @ac-017-1 @ui @e-001
  Cenário: Painel de verificação aparece na primeira vaga de Empresa não verificada
    Quando o coordenador abre a vaga na fila de moderação
    Então o sistema exibe os dados da Empresa (CNPJ, razão social, nome fantasia, endereço, contato) em destaque
    E exibe o banner "Esta é a primeira vaga desta Empresa (ou Empresa editada após verificação — verificar manualmente)"
    E exibe a checklist de verificação interativa

  @ac-017-2 @backend @e-002
  Cenário: Aprovar a vaga marca a Empresa como verificada na mesma transação
    Quando o coordenador aprova a vaga
    Então a Empresa fica isVerified=true
    E é gravado verifiedAt, verifiedByPersonId (coordenador) e verificationJobId (a vaga aprovada)
    E é gravado um snapshot dos dados vigentes da Empresa (cnpj, razão social, nome fantasia, endereço, contato)
    E é registrado o evento de auditoria COMPANY_VERIFIED na MESMA transação que ativa a vaga
    E a vaga fica no status "ativa"

  @ac-017-2 @backend @e-002 @p-004
  Cenário: Snapshot usa os dados vigentes no momento da moderação, não os do rascunho
    Dado que a Pessoa-responsável editou a razão social da Empresa após enviar a vaga para moderação
    Quando o coordenador aprova a vaga
    Então o snapshot de verificação contém a razão social EDITADA (vigente), não a do rascunho

  @ac-017-3 @backend @e-003 @f3
  Cenário: Rejeitar a vaga mantém a Empresa não verificada e incrementa o contador de rejeições
    Quando o coordenador rejeita a vaga com o motivo "CNPJ não confere com a razão social informada"
    Então a Empresa permanece isVerified=false
    E o rejectionCount da Empresa é incrementado em 1
    E é registrado log de auditoria CONTENT_REJECTED com o motivo

  @ac-017-4 @backend @ui @e-004
  Cenário: Vaga subsequente de Empresa já verificada não reabre o painel de verificação
    Dado que a Empresa "Construtora Alfa" já está isVerified=true (verificada em 10/06/2026 por "Coord. Maria")
    E uma segunda vaga dessa Empresa está em moderação
    Quando o coordenador abre essa segunda vaga
    Então o sistema NÃO exibe o painel de verificação de Empresa
    E exibe apenas a indicação "Empresa verificada em 10/06/2026 por Coord. Maria"

  @ac-017-4 @backend @e-004
  Cenário: Aprovar vaga de Empresa já verificada é idempotente (não re-verifica)
    Dado que a Empresa já está isVerified=true com verifiedAt fixado
    Quando o coordenador aprova uma vaga subsequente dessa Empresa
    Então verifiedAt, verifiedByPersonId e o snapshot permanecem inalterados
    E nenhum novo evento COMPANY_VERIFIED é emitido

  @ac-017-p001 @ui @p-001 @must-not
  Cenário: Não é possível aprovar sem a checklist apresentada e marcada
    Quando o coordenador tenta confirmar a aprovação sem marcar os itens da checklist
    Então o sistema bloqueia a confirmação
    E só libera a aprovação quando todos os itens forem marcados ou explicitamente dispensados com motivo

  @ac-017-p002 @ui @p-002 @must-not
  Cenário: Verificação da Empresa e decisão da vaga são gestos conscientes separados
    Quando o coordenador visualiza a tela de moderação da primeira vaga
    Então o bloco "Verificação da Empresa" (checklist) está visualmente separado do bloco "Decisão da vaga"
    E cada um exige confirmação consciente própria (não uma decisão única indistinguível)

  @ac-017-p003 @ui @p-003 @must-not @d-005
  Cenário: Histórico de rejeições da Empresa é visível ao moderador
    Dado que a Empresa "Construtora Alfa" foi rejeitada 3 vezes anteriormente
    Quando o coordenador abre a vaga atual na moderação
    Então o sistema exibe o histórico completo de rejeições (quantas, quando, por quem, motivos)
    E destaca a Empresa como "rejeitada 3 vezes" (tratamento especial visível)

  @ac-017-p005 @backend @p-005 @must-not @d-004
  Cenário: Empresa não pode ser marcada verificada por nenhuma rota fora desta USP
    Quando há uma tentativa de marcar isVerified=true fora do hook de verificação (admin/API direta/automática)
    Então a operação é rejeitada com erro determinístico
    E a única rota que marca isVerified=true é a aprovação da 1ª vaga via transitionContent

  @ac-017-d006 @ui @d-006
  Cenário: Painel destaca campos alterados desde a verificação original (re-verificação USP-015)
    Dado uma Empresa que foi rebaixada a isVerified=false após edição de campos identitários (USP-015)
    E existe um snapshot da verificação anterior
    Quando o coordenador modera a nova vaga dessa Empresa
    Então o painel destaca quais campos foram alterados desde a verificação anterior

  @ac-017-l001 @nfr @perf
  Cenário: Painel de verificação carrega dentro do limite de desempenho
    Quando o coordenador abre o painel de verificação da Empresa
    Então o painel carrega em até 3 segundos (p95)
