# Expectations — USP-066: Ver conteúdo integral do rascunho na fila de moderação

**Origem:** Lacuna de spec descoberta em staging (2026-08-15) — não deriva de AC do PRD v0.3.
Estende a USP-016, que entregou a decisão sem a leitura do conteúdo. Ver `intent-USP-066.md` §0.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o moderador abre um item da fila de moderação, the system SHALL exibir o conteúdo integral
  submetido daquele rascunho, conforme o `ContentKind`, **antes** de qualquer decisão — sem sair da fila.

- **E-002:** WHERE o item é uma vaga (`JOB`), the system SHALL exibir título, descrição, requisitos, faixa
  salarial, jornada, localidade e Empresa, exatamente como serão publicados se aprovada.

- **E-003:** WHERE o item é um serviço (`SERVICE`), the system SHALL exibir título, descrição, categoria,
  área de atendimento e as fotos submetidas.

- **E-004:** WHERE o item é perfil de candidato ou CV (`CANDIDATE_PROFILE` / `CV`), the system SHALL exibir
  escolaridade, área de formação, experiência, habilidades e cursos, e disponibilizar o arquivo de CV por
  URL assinada com TTL de 5 min (ADR-0005).

- **E-005:** WHEN o moderador visualiza conteúdo com campo sensível (CV/perfil de candidato), the system
  SHALL registrar audit `SENSITIVE_FIELD_VIEWED` com o moderador, o conteúdo e o momento (ADR-0010 conv. 3).

- **E-006:** IF o conteúdo do item não puder ser carregado, THEN the system SHALL exibir aviso claro e
  **desabilitar a aprovação** daquele item, mantendo devolver/rejeitar disponíveis — decidir "aprovar" sem
  ter lido é exatamente o que esta USP existe para impedir.

## 2. Proibições (must-not)

- **P-001 (toca F1 — moderação vira carimbo):** O sistema NÃO PODE oferecer a ação "aprovar" para um item
  cujo conteúdo não tenha sido carregado e exibido ao moderador. Botão de aprovar ativo sobre conteúdo
  invisível é a falha que esta USP corrige — reintroduzi-la anula a USP inteira.
  `eval(−)`: teste que renderiza um item com carga de conteúdo falha e afirma `aprovar` desabilitado.

- **P-002 (toca F2 — vazamento de PII):** O sistema NÃO PODE carregar nem transmitir ao cliente conteúdo de
  um `ContentKind` que o moderador não tem permissão para moderar (USP-056 / MOD-7). Restrição é no
  **`select` do Prisma condicionado ao papel**, não na renderização: filtrar só no View Model deixa a row
  crua vazar no payload Flight do RSC.
  `eval(−)`: teste que afirma ausência do campo restrito no payload serializado, não só na tela.

- **P-003 (toca F3 — preview ≠ publicado):** O sistema NÃO PODE exibir versão truncada, resumida ou
  cacheada do conteúdo sem sinalizar. O que o moderador lê é o que será publicado; truncamento silencioso
  de texto longo é proibido (truncar com "ver mais" explícito é permitido).
  `eval(−)`: teste com conteúdo longo afirmando que o texto integral está acessível.

- **P-004 (toca F4 — fila degradada):** O sistema NÃO PODE carregar o conteúdo integral de todos os itens
  no render da fila. A carga é **sob demanda por item** (ao abrir), preservando as leituras em lote que a
  USP-016 já faz. URL assinada de CV só é gerada quando o item é aberto, nunca em lote no `page.tsx`.
  `eval(−)`: teste afirmando que renderizar a fila com N itens não dispara N leituras de conteúdo.

- **P-005 (toca F1 — burlar a FSM):** O sistema NÃO PODE alterar status a partir da tela de detalhe por
  outra via que não `transitionContent` (herda P-006 da USP-016 / ADR-0024). Exibir conteúdo não abre
  caminho de escrita novo.

## 3. Fora de escopo

- Edição do conteúdo pelo moderador (devolver para ajustes continua sendo o caminho — USP-016 E-003).
- Comparação/diff entre versões do rascunho (não há versionamento de conteúdo no MVP).
- Preview de conteúdo já publicado (USP-018 trata do publicado).
