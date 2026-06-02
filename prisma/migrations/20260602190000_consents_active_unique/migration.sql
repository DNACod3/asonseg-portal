-- USP-043 (#37) — no máximo UM consentimento ativo por (pessoa, finalidade).
--
-- A unicidade já existente `(person_id, purpose, accepted_at)` NÃO impede dois
-- registros ativos simultâneos (o `accepted_at` difere entre duas grants
-- concorrentes). Este índice parcial fecha a corrida de grant duplicado exigida
-- pela DoD da #37 ("concorrência — sem duplicar ativo").
--
-- Índice PARCIAL (não expressável no schema Prisma, como os guards append-only
-- do `audit_log`): a revogação preenche `revoked_at`, a linha sai do índice e um
-- novo aceite pode reentrar — compatível com a revogação por UPDATE (ADR-0025).
CREATE UNIQUE INDEX "consents_active_purpose_unique"
  ON "consents" ("person_id", "purpose")
  WHERE "revoked_at" IS NULL;
