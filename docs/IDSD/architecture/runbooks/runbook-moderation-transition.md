# Runbook — Transição de estado de conteúdo (`transitionContent`)

**Tipo:** padrão de implementação reutilizável
**Usado por:** USP-009, 016, 017, 018, 019, 020, 023, 029, 032
**ADRs relacionados:** ADR-0024 (FSM de moderação), ADR-0015 (negócio), ADR-0023 (auditoria)
**Referência no TD:** §4.3 (fluxo de moderação), §4.5 (content_items, content_transitions)

## Quando usar

Sempre que o **status** de um conteúdo moderável (vaga, CV/perfil, serviço) muda: enviar para moderação, aprovar, devolver, rejeitar, pausar, prorrogar, arquivar, expirar, ou editar (volta a rascunho).

## Quando NÃO usar

Mudança de dados que **não** é status (ex.: editar a descrição sem republicar — embora editar conteúdo ativo dispare transição para rascunho). Entidades não moderáveis (Pessoa, Empresa, candidatura).

## O padrão (passo a passo)

```ts
await transitionContent(contentId, 'ativo', {
  moderadorId, motivo,           // motivo obrigatório se a transição exige
})
// transitionContent:
//  1. carrega o conteúdo e seu status atual (from)
//  2. valida from→to na TABELA DE TRANSIÇÕES (transição inválida → erro)
//  3. valida conflito de interesse: autor ≠ moderador (senão FORBIDDEN)
//  4. exige motivo quando a transição configura requiresReason (devolver/rejeitar/inativar)
//  5. dentro de withAudit('CONTENT_TRANSITIONED'):
//       - se 1ª vaga de Empresa não verificada e to='ativo': marca Empresa verificada (snapshot)
//       - UPDATE status; preserva published_at original em re-aprovação
//       - grava content_transitions (de, para, moderador, motivo)
//       - enfileira email.moderation_decision no outbox
```

Estados: `rascunho → em_moderacao → {ativo | aguardando_ajustes | rejeitado}`; pós-`ativo`: `pausado`, `expirado` (vaga), `arquivado`; editar ativo → `rascunho`.

## Pontos de atenção (gotchas)

- **Nunca `prisma.content.update({ status })` direto** — toda mudança de status passa por `transitionContent`, senão pula validação/auditoria/motivo (ADR-0024). Isso é bloqueante em PR.
- **Autor não modera o próprio conteúdo** — o item nem aparece na fila dele, mesmo com permissão delegada (USP-016/P-005). Filtre na query da fila.
- **Preserve `published_at` na re-aprovação** — ao reaprovar conteúdo editado, não reinicie a data de publicação (anti-manipulação de ranking — USP-023/P-001).
- **1ª vaga arrasta verificação da Empresa atomicamente** — aprovar a 1ª vaga de Empresa não verificada marca a Empresa verificada na MESMA transição (USP-020/P-001), usando snapshot dos dados vigentes no momento (USP-017/P-004), não do rascunho.
- **Motivo obrigatório em devolver/rejeitar/inativar** — transição sem motivo quando exigido deve falhar.
- **Prorrogar/pausar NÃO re-moderam** — só editar conteúdo volta a rascunho.

## Verificação

- [ ] Mudança de status só via `transitionContent` (nenhum update direto)
- [ ] Transição validada contra a tabela de transições
- [ ] Autor ≠ moderador garantido (fila e ação)
- [ ] Motivo presente quando exigido
- [ ] `published_at` preservado em re-aprovação
- [ ] 1ª vaga → verificação de Empresa na mesma transação (snapshot)
- [ ] `CONTENT_TRANSITIONED` auditado + e-mail via outbox

## Referências

- ADR-0024, ADR-0015, ADR-0023, ADR-0020; project-guideline §8.3
- TD §4.3, §4.5
- USPs servidas: ver cabeçalho
