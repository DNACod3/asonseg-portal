/**
 * Ordenação dos blocos do painel `/inicio` por papel ativo (USP-067 — PNL-00
 * / A-17). Puro, sem IO — a ordem é a das chaves de `ALL_ROLE_LABELS`
 * (CANDIDATE, PROVIDER, CLIENT, COMPANY_RESPONSIBLE, VOLUNTEER, COORDINATOR,
 * SOCIAL_ASSISTANT, BOARD), colapsando COORDINATOR/SOCIAL_ASSISTANT/BOARD num
 * único bloco `INSTITUTIONAL` (a posição resultante — logo após
 * COMPANY_RESPONSIBLE — já bate com a 1ª dessas três chaves, COORDINATOR).
 * `VOLUNTEER` puro não tem bloco próprio (A-17): seu acesso institucional (só
 * por delegação) já é coberto pelo flag `institutional` do caller.
 */

export type PanelKey = 'CANDIDATE' | 'PROVIDER' | 'CLIENT' | 'COMPANY_RESPONSIBLE' | 'INSTITUTIONAL';

/**
 * Flag de acesso institucional já resolvido pelo caller (`page.tsx`) — união
 * de `roles ∩ {COORDINATOR, SOCIAL_ASSISTANT, BOARD}` e o guard ao vivo
 * `canAccessModerationQueue` (cobre o voluntário com delegação). Esta função
 * não decide acesso, só ordena — a decisão vive na raiz de composição
 * (PNL-MN-04).
 */
export interface RolePanelAccess {
  institutional: boolean;
}

const PANEL_ORDER: readonly PanelKey[] = [
  'CANDIDATE',
  'PROVIDER',
  'CLIENT',
  'COMPANY_RESPONSIBLE',
  'INSTITUTIONAL',
];

/**
 * Deriva a lista ordenada de blocos ativos para os papéis + acesso
 * institucional informados. Papel-zero (sem papel público/institucional)
 * retorna `[]` — a página ainda renderiza a saudação (PNL-00-6).
 */
export function orderActiveRolePanels(
  roles: readonly string[],
  access: RolePanelAccess,
): PanelKey[] {
  const activeRoles = new Set(roles);
  const isActive: Record<PanelKey, boolean> = {
    CANDIDATE: activeRoles.has('CANDIDATE'),
    PROVIDER: activeRoles.has('PROVIDER'),
    CLIENT: activeRoles.has('CLIENT'),
    COMPANY_RESPONSIBLE: activeRoles.has('COMPANY_RESPONSIBLE'),
    INSTITUTIONAL: access.institutional,
  };

  return PANEL_ORDER.filter((key) => isActive[key]);
}
