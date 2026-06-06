# .specs/features/extracao-cv-ia/tests/bdd/usp-040-extracao-cv.feature
# Fonte: PRD §5.2 USP-040 · §6.1 (latência ≤30s p95) · §6.7 (LGPD/ZDR)
#        ADR-0018 negócio (extração de CV via IA, validação humana obrigatória)
#        ADR-T-0012 (abstração CVExtractor + Anthropic Claude) · ADR-T-0009 (finalidade 7 CV_AI_EXTRACTION)
#        project-guideline §4 (Server Action), §7 (LLM porta), §8 (consentimento),
#        §12 (testes), §21 (eval suite LLM)
# Fluxo crítico Top 8 #7 (architecture-document §6) → também tem fact E2E.

@usp-040 @modulo-cv-extraction @fluxo-critico
Funcionalidade: Extração automática de campos do CV via IA generativa
  Como candidato
  Quero fazer upload do meu currículo em PDF/DOC/DOCX e ter os campos pré-preenchidos
  Para economizar tempo no cadastro, revisando e confirmando antes de salvar

  Contexto:
    Dado um candidato autenticado com o papel "candidato" ativo
    E que o consentimento da finalidade "CV_AI_EXTRACTION" está ativo para esse candidato

  # --- AC-040-1: WHEN upload (PDF/DOC/DOCX ≤5MB) THE SYSTEM SHALL invocar LLM e extrair campos ---

  @ac-040-1 @happy-path
  Cenário: Upload de CV válido invoca o extrator e retorna campos estruturados
    Dado um arquivo de CV "curriculo-maria.pdf" do tipo "application/pdf" com 2 MB
    Quando o candidato faz upload do CV
    Então o sistema armazena o arquivo original do CV vinculado ao candidato
    E o sistema invoca o serviço de IA generativa (porta CVExtractor)
    E o resultado contém os campos estruturados: escolaridade, área de formação, experiência, habilidades e cursos
    E o sistema registra o evento de auditoria "CV_EXTRACTION_REQUESTED" antes do envio ao LLM
    E o sistema registra o evento de auditoria "CV_EXTRACTION_COMPLETED" após o retorno
    E a ação retorna sucesso

  @ac-040-1 @borda @validacao
  Esquema do Cenário: Upload é rejeitado por formato ou tamanho inválido antes de invocar o LLM
    Quando o candidato faz upload de um arquivo do tipo "<mime>" com <tamanho> MB
    Então o sistema rejeita o upload com o erro "<erro>"
    E o serviço de IA generativa NÃO é invocado
    E nenhum evento "CV_EXTRACTION_REQUESTED" é registrado

    Exemplos:
      | mime                    | tamanho | erro                |
      | image/png               | 1       | FORMATO_NAO_SUPORTADO |
      | application/zip         | 1       | FORMATO_NAO_SUPORTADO |
      | application/pdf         | 6       | ARQUIVO_MUITO_GRANDE  |

  # --- AC-040-2: WHEN extração retorna THE SYSTEM SHALL pré-preencher + exigir validação obrigatória ---

  @ac-040-2 @happy-path
  Cenário: Campos extraídos pré-preenchem o formulário marcados para validação obrigatória
    Dado que a extração retornou escolaridade "Ensino Superior" e área de formação "Administração"
    Quando o sistema processa o retorno da extração
    Então os campos do formulário são pré-preenchidos com os valores extraídos
    E os campos pré-preenchidos ficam marcados como "extraído automaticamente — requer validação"
    E os valores são exibidos ao candidato para validação obrigatória

  # --- AC-040-3: IF extração falha/vazia THEN deixar campos vazios, sem erro disruptivo ---

  @ac-040-3 @borda @fallback
  Esquema do Cenário: Falha ou retorno vazio da extração degrada graciosamente para preenchimento manual
    Dado que o arquivo do CV já foi armazenado vinculado ao candidato
    E que a extração retorna falha com o código "<codigo>"
    Quando o sistema processa o resultado da extração
    Então os campos do formulário ficam vazios para preenchimento manual
    E nenhuma mensagem de erro disruptiva é exibida ao candidato
    E o sistema registra o evento de auditoria "CV_EXTRACTION_FAILED" com o código do erro
    E a ação NÃO retorna erro bloqueante (o fluxo de cadastro continua)

    Exemplos:
      | codigo            |
      | TIMEOUT           |
      | PROVIDER_ERROR    |
      | PARSE_ERROR       |

  @ac-040-3 @borda @fallback
  Cenário: Extração que retorna todos os campos nulos é tratada como vazia, sem erro
    Dado que a extração retornou sucesso mas com todos os campos nulos
    Quando o sistema processa o resultado da extração
    Então os campos do formulário ficam vazios para preenchimento manual
    E nenhuma mensagem de erro disruptiva é exibida ao candidato

  # --- AC-040-4: THE SYSTEM SHALL exigir confirmação explícita antes de salvar (invariante) ---

  @ac-040-4 @invariante
  Cenário: Salvar sem confirmação explícita do candidato é bloqueado
    Dado que existem campos pré-preenchidos pela extração ainda não confirmados
    Quando o candidato tenta salvar o perfil sem confirmar explicitamente os campos
    Então o sistema bloqueia o salvamento exigindo confirmação explícita
    E os dados extraídos NÃO são persistidos no perfil do candidato

  @ac-040-4 @happy-path
  Cenário: Confirmação explícita persiste os campos e audita a confirmação
    Dado que o candidato revisou e ajustou os campos pré-preenchidos
    Quando o candidato confirma explicitamente os campos
    Então o sistema persiste os campos confirmados no perfil do candidato
    E o sistema registra o evento de auditoria "CV_USER_CONFIRMED_FIELDS"

  # --- AC-040-5: THE SYSTEM SHALL armazenar o arquivo original do CV vinculado ao candidato ---

  @ac-040-5 @invariante
  Cenário: O arquivo original do CV é armazenado vinculado ao candidato
    Quando o candidato faz upload de um CV válido
    Então o arquivo original é persistido no storage no caminho "cvs/{personId}/{uuid}"
    E o caminho do arquivo fica vinculado ao perfil do candidato
    E o arquivo é preservado mesmo que a extração falhe

  # --- Casos obrigatórios de Server Action sensível (project-guideline §12) ---

  @consentimento @seguranca
  Cenário: Upload sem consentimento da finalidade CV_AI_EXTRACTION é recusado antes de enviar ao LLM
    Dado um candidato autenticado SEM consentimento ativo da finalidade "CV_AI_EXTRACTION"
    Quando o candidato faz upload de um CV válido
    Então o sistema recusa a operação com o erro "CONSENT_REQUIRED"
    E o serviço de IA generativa NÃO é invocado
    E o conteúdo do CV NÃO é enviado ao provedor LLM
    E a UI sinaliza para exibir o termo da finalidade e pedir aceite

  @permissao @seguranca
  Cenário: Usuário sem o papel candidato não pode acionar a extração de CV
    Dado um usuário autenticado SEM o papel "candidato"
    Quando ele tenta fazer upload de um CV
    Então o sistema recusa a operação por permissão insuficiente

  @lgpd @seguranca
  Cenário: O conteúdo do CV nunca é gravado em log operacional
    Quando o candidato faz upload de um CV válido e a extração ocorre
    Então os logs operacionais e de auditoria contêm apenas referência (personId, storage_path) e metadata
    E nenhum log contém o conteúdo textual do CV nem o raw response do LLM
