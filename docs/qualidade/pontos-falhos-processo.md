# Pontos falhos do processo — registro para o relatório de go-live

Registro vivo dos achados em que **o processo** (spec, arquitetura, provisionamento, verificação) deixou
passar algo, e não apenas o código. Alimenta o relatório exigido antes do cutover para produção.

Só entra aqui o achado cuja causa raiz é de processo. Bug comum de implementação — código que contraria a
própria spec — vai para o fluxo normal de correção, não para este registro.

## Taxonomia

| Classificação | Significado | Pergunta que a distingue |
|---|---|---|
| `falta-de-spec` | O comportamento certo nunca foi especificado. A implementação é fiel ao que foi escrito; o que foi escrito é que era insuficiente. | Os testes passam e o usuário mesmo assim não consegue fazer o trabalho? |
| `falha-de-processo` | A spec existia, mas um passo do processo não era executável/versionado — dependia de ação manual não registrada. | Um ambiente novo nasce quebrado se ninguém lembrar do passo? |
| `spec-ambigua` | Especificado, mas com duas leituras defensáveis, e a escolhida diverge da intenção. | Dois implementadores competentes fariam coisas diferentes lendo o mesmo texto? |
| `verificacao-cega` | Suíte verde sobre comportamento que nunca foi exercido de verdade. | O teste morreria se a feature fosse removida? |

## Achados

### PF-001 — Buckets de Storage nunca provisionados em ambiente hospedado

- **Classificação:** `falha-de-processo`
- **Descoberto em:** staging, 2026-08-15, por teste manual de upload de CV
- **Sintoma:** "Não foi possível enviar o currículo. Tente novamente." em todo upload de CV.
- **Causa raiz:** os buckets eram declarados apenas em `supabase/config.toml`, que **só provisiona a stack
  local do CLI** — projeto hospedado não lê esse arquivo. O passo equivalente em ambiente hospedado era
  manual (criar no Studio) e existia só como checkbox no DoD da task #97 em `docs/infra/supabase.md`. Foi
  executado em produção e nunca em staging: o projeto de staging tinha **zero buckets**.
- **Por que o processo não pegou:** um passo de provisionamento registrado como checkbox de DoD não é
  executável nem verificável depois. Nenhum teste cobre infraestrutura de ambiente hospedado, e o CI usa a
  stack local — onde o `config.toml` funciona e mascara a lacuna.
- **Alcance:** além do upload de CV, derrubaria `upload-service-photo` (bucket `provider-photos`) assim que
  fosse exercitado. Produção provavelmente não tem o bucket `consent-terms`.
- **Correção:** `scripts/ensure-buckets.ts` idempotente + `npm run storage:ensure:staging|prod`, com
  `STORAGE_BUCKET_SPECS` (`src/shared/lib/supabase/storage-buckets.ts`) como fonte de verdade versionada.
  Documentado em `docs/infra/supabase.md` como passo obrigatório. Corrigido em staging e validado.
- **Lição para o go-live:** varrer o DoD das tasks de infra por outros passos manuais que só existem como
  checkbox. Todo passo de provisionamento precisa de um comando idempotente versionado.

### PF-002 — Fila de moderação decide sem exibir o conteúdo moderado

- **Classificação:** `falta-de-spec`
- **Descoberto em:** staging, 2026-08-15, ao tentar aprovar um rascunho
- **Sintoma:** o moderador não consegue ler o conteúdo do rascunho para decidir; a fila mostra apenas
  título, autor e data, seguidos dos botões aprovar/devolver/rejeitar.
- **Causa raiz:** nenhuma expectation da USP-016 exige exibir o conteúdo. O `E-001` pede apenas *"listar
  rascunhos ... com indicador visual claro de tipo"*. O View Model `ModerationQueueItem` formaliza a
  omissão como intencional ("sem vazar dados do conteúdo além do título e do autor — ADR-0010"), não existe
  rota de detalhe, e a rota pública filtra por `ACTIVE` — logo o rascunho não é alcançável por lá.
- **Por que o processo não pegou:** a implementação é **fiel à spec**, e por isso toda a verificação passou
  — os testes checam o que foi especificado. O intent da USP-016 chama a moderação de "gate qualitativo do
  portal", mas nenhuma expectation traduziu isso em "o moderador precisa ler o conteúdo". A distância entre
  o intent e as expectations não tem sensor no processo atual: o Verifier confere spec↔código, não
  intent↔spec.
- **Alcance:** RP-007 (CV ruim validado) e RP-010 (conteúdo impróprio sem canal de denúncia) ficaram sem
  qualquer defesa, já que a moderação pré-publicação era a única barreira proativa. RP-005 tem defesa
  parcial via USP-017, que — ironicamente — dá inspeção detalhada da **Empresa** mas não da vaga.
- **Correção:** USP-066 (intent + expectations + card na matriz criados em 2026-08-15).
- **Lição para o go-live:** vale um passo de conferência intent↔expectations nas USPs marcadas como
  diferencial no PRD — verificar se cada fracasso de resultado (`F-N`) do intent tem ao menos uma
  expectation que o enderece. Aqui o `F1` da USP-016 falava de fila acumulando, mas nenhum `F` cobria
  "moderador decide sem base".

## Candidatos a achado (observados, ainda não classificados)

- **Guard `no-committed-secrets` estoura timeout** — teste síncrono que varre todo `git ls-files` leva ~10s
  contra o timeout padrão de 5s do Vitest, sem `testTimeout` próprio. Falha por lentidão de máquina, e a
  mensagem ("credencial real versionada") aparenta incidente de segurança quando não é. Flake latente em
  runner lento de CI. Ainda não classificado: pode ser só dívida de teste, não falha de processo.
- **ADRs 0017–0030 citados em todo o código sem arquivo correspondente** — `docs/arch/` só tem 0001–0016.
  Referências técnicas do código e da matriz apontam para documentos que não existem no repo.
