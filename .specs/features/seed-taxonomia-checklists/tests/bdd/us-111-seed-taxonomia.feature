# Fonte: issue #111 (Épico #4 Fase 0) · PRD §11 Glossário, §3.3, D-007/QP-010, RP-005
#        USP-017 (validação de empresa) · technical-design (regions/job_areas/service_categories)

@us-111 @fase-0 @infra @modulo-seed
Funcionalidade: Seed de taxonomia inicial e checklist de empresa-fantasma
  Como time de produto/operação
  Quero a taxonomia inicial semeada e o checklist de empresa-fantasma documentado
  Para que vagas/serviços e a moderação tenham dados de referência desde o início

  @ac-111-1 @seed
  Cenário: O seed popula as três tabelas de taxonomia
    Dado um banco de dados recém-criado (migrations aplicadas, sem dados de seed)
    Quando o comando "npm run db:seed" é executado
    Então a tabela "regions" contém ao menos uma região ativa (bairros de Florianópolis/SC)
    E a tabela "job_areas" contém as áreas de vaga iniciais, todas com is_suggestion = false
    E a tabela "service_categories" contém as categorias iniciais, todas com is_suggestion = false

  @ac-111-1 @idempotencia
  Cenário: Re-executar o seed não duplica registros
    Dado que "npm run db:seed" já foi executado uma vez
    Quando "npm run db:seed" é executado novamente
    Então a contagem de registros em "regions", "job_areas" e "service_categories"
      permanece igual à da primeira execução
    E nenhum registro duplicado por "name" é criado

  @ac-111-2 @checklist @documentacao
  Cenário: O documento do checklist de empresa-fantasma existe e é verificável
    Quando a moderação precisa do checklist de validação de empresa
    Então existe um documento de checklist versionado no repositório (em docs/)
    E o documento lista os dados da Empresa a verificar (CNPJ, razão social, endereço)
    E o documento define critérios objetivos para APROVAR a empresa
    E o documento define critérios objetivos para REJEITAR a empresa com motivo

  @ac-111-2 @cnpj
  Cenário: O checklist exige verificação de CNPJ além do dígito verificador
    # RP-005: "CNPJ por dígito não basta" — o checklist precisa de inspeção além do algoritmo
    Quando o coordenador segue o checklist para uma empresa
    Então o checklist orienta uma verificação de existência/consistência do CNPJ
      além da mera validação de dígito verificador
