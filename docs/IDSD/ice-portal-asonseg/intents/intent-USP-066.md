# Intent — USP-066: Ver conteúdo integral do rascunho na fila de moderação

**Origem:** Lacuna descoberta em staging (2026-08-15). **Não** vem do PRD v0.3 — ver classificação abaixo.
**Dono do intent:** Coordenador da área Portal Empregabilidade (julga "pronto") + diretoria (define padrão de qualidade).
**Classificação do achado:** `falta-de-spec` — ver `docs/qualidade/pontos-falhos-processo.md` (PF-002).

## 0. Por que esta USP existe (registro do achado)

A USP-016 entregou a fila de moderação e as três decisões (aprovar / devolver / rejeitar) **sem nunca
exibir o conteúdo submetido**. O `ModerationQueueItem` expõe apenas `contentKind`, `contentId`, `title`,
`authorName`, `submittedAt`, `companyId` e `companyUnverified`; o card renderiza exatamente esses campos e
vai direto aos botões de decisão. Não existe rota de detalhe, e a rota pública de detalhe filtra por
`ACTIVE` no on-read — logo um rascunho `IN_MODERATION` também não é alcançável por lá.

O ponto importante: **a implementação está fiel à spec; a spec é que ficou curta.** O `E-001` da USP-016
pede apenas *"listar rascunhos ... com indicador visual claro de tipo"*, e nenhuma expectation exige exibir
o conteúdo. O comentário do próprio View Model formaliza a omissão como intencional ("sem vazar dados do
conteúdo além do título e do autor — ADR-0010"). Por isso os testes da USP-016 passam: eles verificam o que
foi especificado.

O intent da USP-016 chama a moderação de **"gate qualitativo do portal — diferencial declarado do MVP
(ADR-0015)"**. Julgar qualidade a partir de um título é o intent falhando na prática com todas as
expectations verdes. Esta USP fecha essa lacuna.

Ironia que ajuda a dimensionar: para vagas, a USP-017 já dá ao moderador inspeção detalhada **da Empresa**
(CNPJ, razão social, endereço, histórico de rejeições) — mas não da vaga que ele está aprovando.

## 1. Descrição

O moderador (coordenador ou voluntário com permissão delegada via USP-008) precisa **ler o conteúdo
integral que será publicado** antes de decidir. Ao abrir um item da fila, o sistema exibe o conteúdo
submetido conforme o `ContentKind`:

- **Vaga (`JOB`)** — título, descrição, requisitos, faixa salarial, jornada, localidade, Empresa.
- **Serviço (`SERVICE`)** — título, descrição, categoria, área de atendimento, fotos submetidas.
- **Perfil de candidato / CV (`CANDIDATE_PROFILE`, `CV`)** — escolaridade, área de formação, experiência,
  habilidades, cursos; e o arquivo de CV acessível por URL assinada.

O conteúdo exibido é exatamente o que será publicado se aprovado — a decisão deixa de ser cega.

## 2. Restrições

- Conteúdo lido **por View Model por `ContentKind`** (ADR-0010, convenção 1): moderador vendo dado de outra
  Pessoa nunca consulta Prisma direto.
- **`content_items` do TD §4.5 não existe** — nunca foi implementado; o status mora na própria entidade
  (padrão `CandidateProfile`). A leitura por tipo segue o padrão de adapter por `ContentKind` registrado no
  `shared/container`, como já faz `DispatchingContentStatusRepository`.
- Permissão por `ContentKind` (USP-056 / MOD-7): voluntário só enxerga o conteúdo dos tipos que pode moderar.
- Campos sensíveis revelados registram audit (`SENSITIVE_FIELD_VIEWED`, ADR-0010 convenção 3).
- Sem mudança na FSM: a decisão continua exclusivamente por `transitionContent` (ADR-0024 / P-006 da USP-016).
- Arquivo de CV por **URL assinada** com TTL de 5 min (ADR-0005), nunca URL pública.

## 3. Cenários de fracasso (de resultado)

**F1. Moderação vira carimbo — conteúdo ruim é publicado porque ninguém o leu.**
É o fracasso que já está materializado hoje. O moderador só tem título e autor; aprova por confiança no
autor ou pelo volume da fila. RP-005 (Empresa-fantasma) tem defesa parcial via USP-017, mas RP-007 (CV ruim
validado) e RP-010 (conteúdo impróprio sem canal de denúncia) ficam sem nenhuma defesa: a moderação
pré-publicação era justamente a única barreira proativa.

**F2. Voluntário com permissão parcial lê PII de CV que não deveria ver.**
A USP-056 restringiu **as ações** por `ContentKind`, mas exibir conteúdo abre uma superfície nova de
*leitura*. Um voluntário autorizado só a moderar vagas não pode passar a ver escolaridade, experiência e
arquivo de CV de candidatos só porque a fila agora mostra conteúdo. Sem cuidado explícito, a USP que
conserta F1 cria um vazamento de LGPD.

**F3. O que o moderador leu não é o que vai ao ar.**
Se o preview divergir do conteúdo real (campo omitido, truncamento silencioso, versão em cache), o
moderador aprova uma coisa e publica outra — e a auditoria registra uma decisão que não corresponde ao que
foi avaliado. Pior que não mostrar: mostrar errado dá falsa confiança.

**F4. Fila fica lenta e o coordenador volta a decidir no título.**
Carregar conteúdo integral de N itens de uma vez (com fotos e URLs assinadas) degrada a fila que a USP-016
otimizou com leituras em lote. Se abrir um item custar segundos, o moderador ignora o preview e F1
retorna por outro caminho — desta vez com o recurso construído e não usado.
