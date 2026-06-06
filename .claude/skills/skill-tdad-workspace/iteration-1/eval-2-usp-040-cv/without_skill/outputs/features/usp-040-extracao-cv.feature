# language: pt
# Fact (BDD/Gherkin) — USP-040: Extração automática de CV via IA generativa
#
# Cenários derivados dos critérios EARS AC-040-1..5 + pré-condições transversais
# (consentimento CV_AI_EXTRACTION e auditoria). Cada cenário aponta para o(s)
# fact(s) executável(is) correspondente(s) na matriz de rastreabilidade
# (ver RASTREABILIDADE.md).
#
# Convenções da US que os cenários refletem:
#   - DEPENDE DE LLM: a extração é uma chamada externa probabilística; há ramo de
#     sucesso e ramo de falha (timeout/erro) com fallback gracioso.
#   - DEPENDE DE CONSENTIMENTO: finalidade CV_AI_EXTRACTION (LGPD, ADR-T-0009)
#     é pré-condição; sem ela o CV nem chega ao provedor.

Funcionalidade: Extração automática de CV via IA generativa (USP-040)
  Como candidato
  Quero fazer upload do meu currículo e ter os campos pré-preenchidos automaticamente
  Para economizar tempo no cadastro

  Contexto:
    Dado que existe um candidato "Maria" autenticado
    E o candidato possui consentimento ATIVO para a finalidade "CV_AI_EXTRACTION"

  # --- LGPD: consentimento é pré-condição -----------------------------------
  @lgpd @consentimento
  Cenário: Bloqueia upload quando o consentimento da finalidade está ausente
    Dado que o candidato NÃO possui consentimento ativo para "CV_AI_EXTRACTION"
    Quando o candidato tenta enviar "cv.pdf" (PDF, 2MB)
    Então o sistema retorna o erro "CONSENT_REQUIRED" apontando a finalidade "CV_AI_EXTRACTION"
    E nenhum arquivo é enviado ao Storage
    E nenhuma chamada é feita ao provedor de IA generativa

  @lgpd @consentimento @llm
  Cenário: Não envia o CV ao provedor LLM sem consentimento ativo
    Dado que o candidato já enviou um CV anteriormente
    Mas o candidato revogou o consentimento "CV_AI_EXTRACTION"
    Quando o candidato solicita a extração dos campos
    Então o sistema retorna o erro "CONSENT_REQUIRED"
    E o conteúdo do CV NÃO é enviado ao provedor de IA generativa

  # --- AC-040-1: upload + invocação do LLM ----------------------------------
  @ac-040-1 @llm
  Cenário: Upload de CV válido invoca a IA generativa e extrai campos estruturados
    Quando o candidato envia "cv.pdf" (PDF, 2MB)
    E solicita a extração
    Então o provedor de IA generativa é invocado uma vez com o conteúdo do CV
    E o sistema retorna os campos: escolaridade, área de formação, experiência, habilidades e cursos

  @ac-040-1
  Esquema do Cenário: Rejeita arquivos fora dos limites antes de chamar o LLM
    Quando o candidato tenta enviar um arquivo "<arquivo>" com MIME "<mime>" e tamanho "<tamanho>"
    Então o sistema retorna o erro "VALIDATION"
    E o provedor de IA generativa NÃO é invocado

    Exemplos:
      | arquivo     | mime          | tamanho |
      | grande.pdf  | application/pdf | 6MB   |
      | foto.png    | image/png       | 1MB   |

  # --- AC-040-2: pré-preenchimento + validação obrigatória ------------------
  @ac-040-2
  Cenário: Campos extraídos são pré-preenchidos e exigem validação do candidato
    Dado que a extração retornou campos com sucesso
    Quando o candidato visualiza o formulário
    Então os campos aparecem pré-preenchidos com os valores extraídos
    E o sistema sinaliza que a validação do candidato é obrigatória
    E os dados ainda NÃO estão persistidos como confirmados no perfil

  # --- AC-040-3: fallback gracioso ------------------------------------------
  @ac-040-3 @llm
  Cenário: Falha do provedor LLM resulta em fallback gracioso
    Dado que a chamada à IA generativa falha por timeout
    Quando o candidato solicita a extração
    Então o sistema deixa os campos vazios para preenchimento manual
    E não exibe uma mensagem de erro disruptiva
    E registra o evento de auditoria "CV_EXTRACTION_FAILED"

  @ac-040-3 @llm
  Cenário: Extração vazia resulta em campos vazios sem erro
    Dado que a IA generativa retorna todos os campos como vazios
    Quando o candidato solicita a extração
    Então o formulário fica vazio para preenchimento manual
    E nenhum erro disruptivo é exibido

  # --- AC-040-4: confirmação explícita --------------------------------------
  @ac-040-4
  Cenário: Salvar exige confirmação explícita do candidato
    Dado que existem campos extraídos pré-preenchidos
    Quando o candidato tenta salvar sem confirmar explicitamente
    Então o sistema recusa a operação com erro "VALIDATION"
    E os dados não são persistidos como confirmados

  @ac-040-4
  Cenário: Dados são persistidos após confirmação explícita
    Dado que existem campos extraídos pré-preenchidos
    Quando o candidato revisa, ajusta e confirma explicitamente os dados
    Então o sistema persiste os campos no perfil do candidato
    E registra o evento de auditoria "CV_USER_CONFIRMED_FIELDS"

  # --- AC-040-5: armazenar arquivo original ---------------------------------
  @ac-040-5
  Cenário: Arquivo original do CV é armazenado vinculado ao candidato
    Quando o candidato envia "cv.pdf" (PDF, 2MB) com consentimento ativo
    Então o arquivo é armazenado no bucket "cvs" sob o caminho do candidato
    E o perfil do candidato passa a referenciar o caminho e o hash SHA-256 do arquivo
    E o evento de auditoria "CV_UPLOADED" é registrado sem o conteúdo cru do CV
