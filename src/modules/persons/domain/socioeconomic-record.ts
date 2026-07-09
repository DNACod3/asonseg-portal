/**
 * Regras puras da ficha socioeconômica da Pessoa (USP-036 / SOC-01, SOC-02).
 *
 * Sem IO — apenas a política de autorização e os tipos/labels de domínio.
 * Isolar aqui mantém a regra testável sem banco e reaproveitável pela Server
 * Action, pela query de leitura e pelo gate da rota `(app)/social/pessoas/[personId]/ficha`.
 *
 * SPEC_DEVIATION: design.md descreve a assinatura como `canManageSocioeconomicRecord(roles: Role[])`.
 * Reason: `CurrentPerson.roles` (identity/server/session.ts) já é tipado `string[]`
 * (papéis ATIVOS resolvidos por `getCurrentPerson`), e os dois precedentes diretos
 * deste mesmo módulo (`canRegisterAssisted`, `hasInactivationPrivilege`) usam
 * `readonly string[]` exatamente por isso — `Role[]` não seria atribuível a partir
 * de `string[]` sem cast. Mantém o mesmo comportamento/autorização; só ajusta o
 * tipo do parâmetro ao shape real do chamador.
 */

/**
 * Papéis institucionais autorizados a ver/editar a ficha socioeconômica
 * (Assumption #3/#4 da spec — capacidade intrínseca ao papel, não delegável a
 * `PermissionId`). Espelha `ASSISTED_REGISTRATION_ROLES` (USP-002).
 */
export const SOCIOECONOMIC_RECORD_ROLES = ['SOCIAL_ASSISTANT', 'BOARD'] as const;

export type SocioeconomicRecordRole = (typeof SOCIOECONOMIC_RECORD_ROLES)[number];

/**
 * `true` se algum papel ATIVO do ator autoriza ver/editar a ficha socioeconômica
 * de qualquer Pessoa (SOC-036-MN-01: nenhum outro papel passa por aqui).
 */
export function canManageSocioeconomicRecord(roles: readonly string[]): boolean {
  const allowed: readonly string[] = SOCIOECONOMIC_RECORD_ROLES;
  return roles.some((role) => allowed.includes(role));
}

/**
 * Faixas de renda aproximada (Assumption #5 — "aproximada" ⇒ faixa, não valor
 * decimal livre). Valores re-derivados localmente (mesmo padrão de
 * `EDUCATION_LEVELS` em `domain/candidate.ts`): mantém este arquivo livre de
 * import em runtime de `@prisma/client`, para poder ser consumido também pelo
 * Client Component (`socioeconomic-record-form.tsx`, carve-out ADR-0017) sem
 * arrastar Prisma para o bundle do cliente. Os valores casam 1:1 com o enum
 * Prisma `IncomeBracket` (prisma/schema.prisma).
 */
export const INCOME_BRACKETS = [
  'NO_INCOME',
  'UP_TO_1_MW',
  'FROM_1_TO_2_MW',
  'FROM_2_TO_3_MW',
  'ABOVE_3_MW',
  'UNDECLARED',
] as const;

export type IncomeBracket = (typeof INCOME_BRACKETS)[number];

/** Rótulos PT-BR para exibição na UI (sem i18n no MVP). */
export const INCOME_BRACKET_LABELS: Record<IncomeBracket, string> = {
  NO_INCOME: 'Sem renda',
  UP_TO_1_MW: 'Até 1 salário mínimo',
  FROM_1_TO_2_MW: 'De 1 a 2 salários mínimos',
  FROM_2_TO_3_MW: 'De 2 a 3 salários mínimos',
  ABOVE_3_MW: 'Acima de 3 salários mínimos',
  UNDECLARED: 'Não declarada',
};

/**
 * Situações de moradia (Assumption #6). Mesma justificativa de re-derivação
 * local que {@link INCOME_BRACKETS} — casa 1:1 com o enum Prisma `HousingSituation`.
 */
export const HOUSING_SITUATIONS = [
  'OWNED',
  'RENTED',
  'GRANTED',
  'FAMILY',
  'HOMELESS',
  'OTHER',
] as const;

export type HousingSituation = (typeof HOUSING_SITUATIONS)[number];

/** Rótulos PT-BR para exibição na UI (sem i18n no MVP). */
export const HOUSING_SITUATION_LABELS: Record<HousingSituation, string> = {
  OWNED: 'Própria',
  RENTED: 'Alugada',
  GRANTED: 'Cedida',
  FAMILY: 'Familiar',
  HOMELESS: 'Situação de rua',
  OTHER: 'Outra',
};

/** Shape mínimo sobre o qual {@link isEmptyRecord} decide (subset de `SocioeconomicRecordView`). */
export interface EmptyRecordCheck {
  incomeBracket: string | null;
  socialBenefit: string | null;
  housingSituation: string | null;
  familyComposition: string | null;
}

/** `true` quando nenhum dos 4 campos declarados foi preenchido (ficha "vazia"). */
export function isEmptyRecord(view: EmptyRecordCheck): boolean {
  return (
    view.incomeBracket === null &&
    view.socialBenefit === null &&
    view.housingSituation === null &&
    view.familyComposition === null
  );
}
