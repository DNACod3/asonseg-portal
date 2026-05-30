# Expectations — USP-020: Publicar vaga

**Origem:** AC-020-1 a AC-020-4 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa-responsável de uma Empresa submete uma vaga com todos os campos obrigatórios (título, área, descrição, requisitos, regime, local, validade) e data de validade futura, the system SHALL persistir a vaga com status "em moderação", vinculada à Empresa selecionada, com snapshot dos dados da Empresa no momento.

- **E-002:** IF a Empresa selecionada está "não verificada" (primeira vaga, ou Empresa rebaixada via USP-015), THEN the system SHALL marcar essa vaga internamente como "dispara verificação de Empresa" e exibi-la com destaque na fila do moderador (USP-017).

- **E-003:** The system SHALL permitir salvar como rascunho a qualquer momento sem submeter à moderação (AC-020-4).

- **E-004:** IF a data de validade é anterior ou igual a hoje (timezone América/São_Paulo), THEN the system SHALL bloquear o submit com mensagem clara.

- **E-005:** IF a data de validade ultrapassa um teto máximo razoável, THEN the system SHALL bloquear ou exibir alerta exigindo confirmação consciente.
  ✅ RESOLVIDO (dono do intent): teto = 180 dias (tunável).

## 2. Proibições (must-not)

- **P-001 (toca F1 — empresa-fantasma usa vaga como vetor):** O sistema NÃO PODE permitir que vaga de Empresa "não verificada" vá para status "ativo" sem que USP-017 tenha aprovado a Empresa **na mesma decisão**. Aprovação da vaga e verificação da Empresa ficam atomicamente vinculadas para a primeira vaga (e para vagas pós-edição de campos identitários).

- **P-002 (toca F2 — vaga ligada a Empresa rebaixada):** O sistema NÃO PODE manter vaga ativa visível na busca pública (USP-021) quando a Empresa foi rebaixada para "não verificada" via USP-015. Vagas existentes da Empresa rebaixada saem do ar até nova verificação na próxima vaga.
  ✅ RESOLVIDO (dono do intent): saem todas as vagas ativas da Empresa até a re-verificação.

- **P-003 (toca F3 — race condition):** O sistema NÃO PODE persistir duas vagas idênticas (mesmo título + Empresa + área) submetidas em janela curta por responsáveis diferentes da mesma Empresa. Sistema detecta similaridade e alerta antes do segundo submit consumar.
  ✅ RESOLVIDO (decisão PO 2026-05-29 / ADR-0021): não se aplica ao MVP — apenas deduplicação EXATA via UNIQUE → 409 (ADR-0021). Janela/critério de similaridade fuzzy ficam fora de escopo (V2).

- **P-004 (toca F4 — requisito ilegal):** O sistema NÃO PODE deixar passar para "ativo" vaga cujo conteúdo contenha requisito manifestamente discriminatório (idade máxima sem justificativa legal, gênero específico fora de hipóteses legais, etnia, religião). A moderação (USP-016) precisa de checklist explícito de conformidade legal mínima.
  ❓ Checklist legal a entregar na Fase 0. (dono do intent — coordenador + jurídico)

- **P-005 (toca F5 — validade muito longa):** O sistema NÃO PODE aceitar data de validade absurdamente futura (ex.: anos) sem alerta e confirmação consciente do responsável. Vaga "evergreen" polui a busca.

- **P-006:** O sistema NÃO PODE permitir submissão de vaga por Pessoa que não tem vínculo "responsável" ativo da Empresa selecionada. Tentar publicar para Empresa não vinculada é negado por gate de permissão antes de tocar persistência.

- **P-007:** O sistema NÃO PODE permitir que vaga em "em moderação" seja vista na busca pública (USP-021) — apenas vagas "ativo" aparecem.

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (Validade — teto):** Data de validade ≤ teto institucional acordado (alvo aspiracional: 90–180 dias). Verificar com coordenador.
- **L-003 (Campos obrigatórios):** Título, área (catálogo D-007), descrição, requisitos, regime, local e validade — sem submit se algum estiver vazio.
- **L-004 (Auditoria):** Log imutável da submissão (responsável, Empresa, data/hora, conteúdo) retido conforme ADR-0008.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate operacional — BLOQUEANTE):** Antes desta USP ir para produção, **D-007 do PRD (catálogo de áreas/categorias)** está fechado e **a checklist de conformidade legal mínima** (entregável de Fase 0) está validada com coordenador + jurídico. Sem catálogo, o campo "área" fica inconsistente; sem checklist legal, P-004 fica desprotegido.

- **D-002:** Pessoa-responsável de Empresa verificada, em ensaio, publica uma vaga em ≤ 3 minutos do clique inicial. Vaga aparece na fila do coordenador (USP-016) sem destaque de "primeira vaga".

- **D-003:** Pessoa-responsável de Empresa "não verificada", em ensaio, publica primeira vaga; o moderador (USP-016+017) vê o painel de verificação de Empresa em destaque; após aprovação, vaga vai ao ar e Empresa fica "verificada".

- **D-004:** Em teste de race condition: dois responsáveis da mesma Empresa submetem vaga similar simultaneamente; o sistema detecta e alerta o segundo antes do submit final.

- **D-005:** Em teste de bypass: tentativa de chamada direta à API publicando vaga para Empresa sem vínculo de responsável da Pessoa autenticada é rejeitada com erro determinístico.

- **D-006:** A coordenadora abre uma vaga ativa cuja Empresa foi editada (rebaixada via USP-015) e confere que a vaga **saiu do ar** até nova verificação na próxima publicação.
